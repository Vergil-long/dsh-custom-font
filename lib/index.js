// 宿主端：读取 Windows 已安装字体库，并通过本地 HTTP 接口提供给浏览器设置页。
import { execFile } from 'node:child_process';

// PowerShell 脚本：用 .NET 的 InstalledFontCollection 拿到干净的字体系列，
// 同时取英文名（.Name）和中文名（GetName(2052)），输出 JSON。
const POWERSHELL_SCRIPT = [
  "$ErrorActionPreference = 'Stop'",
  "[Console]::OutputEncoding = [System.Text.Encoding]::UTF8",
  "Add-Type -AssemblyName System.Drawing",
  "$c = New-Object System.Drawing.Text.InstalledFontCollection",
  "$list = foreach ($f in $c.Families) {",
  "  $en = $f.Name",
  "  $zh = $null",
  "  try { $zh = $f.GetName(2052) } catch { $zh = $null }",
  "  if (-not $zh) { $zh = $en }",
  "  [PSCustomObject]@{ en = $en; zh = $zh }",
  "}",
  "$list | Sort-Object -Property zh -Unique | ConvertTo-Json -Compress",
].join('\n');

let cachedFonts = null;   // null = 还没读；[] = 读失败 / 非 Windows
let fontsPromise = null;  // 进行中的读取，避免并发重复读

// 把 PowerShell 输出的 JSON 文本解析成 [{ en, zh }]，去重、兜底。
function parseFonts(stdout) {
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
    execFile('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', POWERSHELL_SCRIPT], {
      encoding: 'utf8',
      windowsHide: true,
      timeout: 15000,
      maxBuffer: 10 * 1024 * 1024,
    }, (error, stdout) => {
      if (error) return resolve([]);
      resolve(parseFonts(stdout));
    });
  });
}

// 带内存缓存；force=true 时重新读一次（对应设置页「刷新」按钮，能拿到新装的字体）。
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

export function apply(ctx) {
  // 等 webServer 服务就绪后，注册只读接口 /dsh-custom-font/fonts
  ctx.inject(['webServer'], (hostCtx) => {
    const host = hostCtx;
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
          response.writeHead(200, { 'cache-control': 'no-store', 'content-type': 'application/json; charset=utf-8' });
          response.end(JSON.stringify({ fonts }));
        },
      });
      return () => { if (typeof dispose === 'function') dispose(); };
    }, 'dsh-custom-font: fonts route');
  });
}
