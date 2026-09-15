/**
 * 宿主端（Node 侧）：
 *   1. 读取 Windows 已安装字体库 → `GET /dsh-custom-font/fonts`
 *   2. 读写本插件设置（存在 `$DSH_HOME/dsh-custom-font/settings.json`）
 *        `GET  /dsh-custom-font/settings`  → 读
 *        `POST /dsh-custom-font/settings`  → 写（只认白名单字段）
 *        `GET  /dsh-custom-font/settings/export` → 导出文件原文
 *   3. 内置字体资源（插件自带，解决"用户电脑没装推荐字体"）
 *        `GET /dsh-custom-font/font-manifest`        → 清单
 *        `GET /dsh-custom-font/font-asset?name=xxx`  → 字体文件本体
 *
 * 设置**不**放浏览器 localStorage：那东西按「外壳应用数据目录 + 访问源」隔离，
 * 换一个桌面外壳就丢一次（productName 不同 = 两个独立存储区）。
 * 放在 $DSH_HOME 下跟着内核用户数据走，换壳不丢。
 */
import { execFile } from 'node:child_process';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { configPath, exportSettings, loadSettings, resolveDshHome, saveSettings } from './config.js';
import { fontManifest, readFontFile } from './fonts.js';

/** 一次最多接受多大的设置 JSON（防止畸形请求占内存）。 */
const MAX_BODY_BYTES = 256 * 1024;

/**
 * PowerShell 脚本：用 .NET 的 InstalledFontCollection 拿到干净的字体系列，
 * 同时取英文名（.Name）和中文名（GetName(2052)），输出 JSON。
 *
 * ⚠️ 刻意**不**设 `[Console]::OutputEncoding`：PowerShell 5.1 下这会写出 UTF-8 BOM，
 * 而本函数按 utf8 解码后 JSON.parse 会把 BOM 当非法字符 → 整个字体列表读空。
 * 非 ASCII 用 \uXXXX 转义（ConvertTo-Json 自带），所以不需要改编码。
 */
const POWERSHELL_SCRIPT = [
  "$ErrorActionPreference = 'Stop'",
  'Add-Type -AssemblyName System.Drawing',
  '$c = New-Object System.Drawing.Text.InstalledFontCollection',
  '$list = foreach ($f in $c.Families) {',
  '  $en = $f.Name',
  '  $zh = $null',
  '  try { $zh = $f.GetName(2052) } catch { $zh = $null }',
  '  if (-not $zh) { $zh = $en }',
  '  [PSCustomObject]@{ en = $en; zh = $zh }',
  '}',
  '$list | Sort-Object -Property zh -Unique | ConvertTo-Json -Compress',
].join('\n');

let cachedFonts = null;   // null = 还没读；[] = 读失败 / 非 Windows
let fontsPromise = null;  // 进行中的读取，避免并发重复读

/** 把 PowerShell 输出的 JSON 文本解析成 [{ en, zh }]，去重、兜底。 */
export function parseFonts(stdout) {
  try {
    const clean = String(stdout || '').replace(/^\uFEFF/, '').trim();
    if (!clean) return [];
    const parsed = JSON.parse(clean);
    const arr = Array.isArray(parsed) ? parsed : (parsed && typeof parsed === 'object' ? [parsed] : []);
    const seen = new Set();
    const out = [];
    for (const f of arr) {
      if (!f || typeof f !== 'object') continue;
      const en = String(f.en || '').trim();
      const zh = String(f.zh || '').trim();
      const name = zh || en;
      if (!name || seen.has(name)) continue;
      seen.add(name);
      out.push({ en: en || name, zh: name });
    }
    return out;
  } catch {
    return [];
  }
}

function readWindowsFonts() {
  if (process.platform !== 'win32') return Promise.resolve([]);
  return new Promise((resolve) => {
    // spawn 本身可能失败（受限沙箱里抓子进程输出会 EPERM）。这类失败必须降级成
    // "读不到字体"（返回 []），而不是让 Promise 抛出去把整条路由带崩——下拉框退回内置列表即可用。
    let settled = false;
    const finish = (list) => { if (!settled) { settled = true; resolve(list); } };
    try {
      const child = execFile('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', POWERSHELL_SCRIPT], {
        encoding: 'utf8',
        windowsHide: true,
        timeout: 15000,
        maxBuffer: 10 * 1024 * 1024,
      }, (error, stdout) => {
        if (error) return finish([]);
        finish(parseFonts(stdout));
      });
      // execFile 同步抛错（如 EPERM）之外的异步失败走这里
      if (child && typeof child.on === 'function') child.on('error', () => finish([]));
    } catch {
      finish([]);
    }
  });
}

/** 带内存缓存；force=true 时重新读一次（对应设置页「刷新」按钮，能拿到新装的字体）。 */
function getFonts(force) {
  if (!force && cachedFonts !== null) return Promise.resolve(cachedFonts);
  if (fontsPromise === null) {
    fontsPromise = readWindowsFonts()
      .then((list) => {
        cachedFonts = list;
        return list;
      })
      .finally(() => { fontsPromise = null; });
  }
  return fontsPromise;
}

/** 读请求体（带上限），返回文本；超限返回 null。 */
function readBody(request) {
  return new Promise((resolve) => {
    const chunks = [];
    let size = 0;
    let aborted = false;
    request.on('data', (chunk) => {
      if (aborted) return;
      size += chunk.length;
      if (size > MAX_BODY_BYTES) {
        aborted = true;
        resolve(null);
        return;
      }
      chunks.push(chunk);
    });
    request.on('end', () => { if (!aborted) resolve(Buffer.concat(chunks).toString('utf8')); });
    request.on('error', () => { if (!aborted) resolve(null); });
  });
}

function sendJson(response, status, payload) {
  response.writeHead(status, {
    'cache-control': 'no-store',
    'content-type': 'application/json; charset=utf-8',
  });
  response.end(JSON.stringify(payload));
}

/**
 * 宿主半侧入口。
 * @param {object} ctx - cordis 上下文。
 */
export function apply(ctx) {
  // 目录解析优先级：ctx.dshHomePath() > $DSH_HOME > ~/.dsh
  let homeOverride = null;
  try {
    ctx.inject(['dshHomePath'], (homeCtx) => {
      try {
        if (typeof homeCtx.dshHomePath === 'function') homeOverride = homeCtx.dshHomePath();
      } catch { /* 服务读不到就回落到环境变量 */ }
    });
  } catch { /* 老版本宿主没有这个服务：无害，回落即可 */ }

  const home = () => homeOverride ?? resolveDshHome(process.env.DSH_HOME || undefined);

  ctx.inject(['webServer'], (hostCtx) => {
    const host = hostCtx;

    // ── 字体库 ────────────────────────────────────────────────
    host.effect(() => {
      const dispose = host.webServer.register({
        kind: 'exact',
        path: '/dsh-custom-font/fonts',
        handler: async (request, response) => {
          if (request.method !== 'GET') {
            response.writeHead(405, { allow: 'GET', 'content-type': 'application/json; charset=utf-8' });
            response.end(JSON.stringify({ fonts: [] }));
            return;
          }
          let force = false;
          try {
            force = new URL(request.url, 'http://localhost').searchParams.get('refresh') === '1';
          } catch { /* 忽略无法解析的 url */ }
          const fonts = await getFonts(force);
          sendJson(response, 200, { fonts });
        },
      });
      return () => { if (typeof dispose === 'function') dispose(); };
    }, 'dsh-custom-font: fonts route');

    // ── 设置读写 ──────────────────────────────────────────────
    host.effect(() => {
      const dispose = host.webServer.register({
        kind: 'exact',
        path: '/dsh-custom-font/settings',
        handler: async (request, response) => {
          if (request.method === 'GET') {
            const result = loadSettings(home());
            sendJson(response, 200, {
              ok: true,
              // settings 为 null = 文件还没建，浏览器端应回落到 localStorage / 内置默认值
              settings: result.settings,
              source: result.source,
              path: result.path,
              error: result.error,
            });
            return;
          }

          if (request.method === 'POST') {
            const raw = await readBody(request);
            if (raw === null) {
              sendJson(response, 413, { ok: false, error: '请求体过大或读取失败' });
              return;
            }
            let parsed;
            try {
              parsed = JSON.parse(raw);
            } catch {
              sendJson(response, 400, { ok: false, error: '请求体不是合法 JSON' });
              return;
            }
            const patch = parsed && typeof parsed === 'object' && parsed.settings !== undefined
              ? parsed.settings
              : parsed;
            const result = saveSettings(patch, home());
            if (!result.ok) {
              sendJson(response, 500, { ok: false, error: result.error });
              return;
            }
            sendJson(response, 200, { ok: true, written: result.written, path: result.path });
            return;
          }

          response.writeHead(405, { allow: 'GET, POST', 'content-type': 'application/json; charset=utf-8' });
          response.end(JSON.stringify({ ok: false, error: '只支持 GET / POST' }));
        },
      });
      return () => { if (typeof dispose === 'function') dispose(); };
    }, 'dsh-custom-font: settings route');

    // ── 导出（把设置文件原文交给浏览器端另存） ────────────────
    host.effect(() => {
      const dispose = host.webServer.register({
        kind: 'exact',
        path: '/dsh-custom-font/settings/export',
        handler: async (request, response) => {
          if (request.method !== 'GET') {
            response.writeHead(405, { allow: 'GET', 'content-type': 'application/json; charset=utf-8' });
            response.end(JSON.stringify({ ok: false, error: '只支持 GET' }));
            return;
          }
          const result = exportSettings(home());
          if (!result.ok) {
            sendJson(response, 404, { ok: false, error: result.error, path: result.path });
            return;
          }
          sendJson(response, 200, { ok: true, text: result.text, path: result.path });
        },
      });
      return () => { if (typeof dispose === 'function') dispose(); };
    }, 'dsh-custom-font: settings export route');

    // ── 内置字体清单 ──────────────────────────────────────────
    host.effect(() => {
      const dispose = host.webServer.register({
        kind: 'exact',
        path: '/dsh-custom-font/font-manifest',
        handler: async (request, response) => {
          if (request.method !== 'GET') {
            response.writeHead(405, { allow: 'GET', 'content-type': 'application/json; charset=utf-8' });
            response.end(JSON.stringify({ ok: false, error: '只支持 GET' }));
            return;
          }
          // 浏览器可以长期缓存这份清单（文件名里没有版本号，改动即新增/删除条目）
          response.writeHead(200, { 'cache-control': 'no-cache', 'content-type': 'application/json; charset=utf-8' });
          response.end(JSON.stringify({ ok: true, ...fontManifest() }));
        },
      });
      return () => { if (typeof dispose === 'function') dispose(); };
    }, 'dsh-custom-font: font manifest route');

    // ── 内置字体文件本体 ──────────────────────────────────────
    host.effect(() => {
      const dispose = host.webServer.register({
        kind: 'exact',
        path: '/dsh-custom-font/font-asset',
        handler: async (request, response) => {
          if (request.method !== 'GET') {
            response.writeHead(405, { allow: 'GET', 'content-type': 'application/json; charset=utf-8' });
            response.end(JSON.stringify({ ok: false, error: '只支持 GET' }));
            return;
          }
          let name = '';
          try {
            name = new URL(request.url, 'http://localhost').searchParams.get('name') || '';
          } catch { /* 无法解析的 url 按空名处理，下面会返回 404 */ }
          const result = readFontFile(name);
          if (!result.ok) {
            sendJson(response, result.code, { ok: false, error: result.error });
            return;
          }
          // 字体文件内容不会变（文件名就是标识），可以让浏览器放心缓存
          response.writeHead(200, {
            'content-type': result.mime,
            'content-length': String(result.size),
            'cache-control': 'public, max-age=86400',
          });
          response.end(result.body);
        },
      });
      return () => { if (typeof dispose === 'function') dispose(); };
    }, 'dsh-custom-font: font asset route');
  });

  // 便于宿主日志看到设置文件落在哪（只报路径，不打印任何设置内容）。
  try {
    ctx.logger?.info?.(`[dsh-custom-font] 设置文件：${configPath(home())}`);
  } catch { /* 没有 logger 就算了 */ }
}

export const name = 'dsh-custom-font';
