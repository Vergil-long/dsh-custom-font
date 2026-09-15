/**
 * 宿主半侧自检：设置文件的读写、白名单、原子性，内置字体资源，以及各条 HTTP 路由的真实行为。
 *
 * 用一个假 ctx（只提供 inject / effect / logger）把插件挂起来，拿到它注册的路由，
 * 再用假的 request/response 走一遍——验证的是"逻辑与协议对不对"。
 *
 *   node test/host.test.mjs
 */
import assert from 'node:assert/strict';
import { existsSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

/* ── 隔离的 DSH_HOME：绝不能碰到用户真实的 ~/.dsh ───────────────── */
const home = mkdtempSync(join(tmpdir(), 'dsh-custom-font-host-'));
process.env.DSH_HOME = home;

const config = await import('../lib/config.js');
const host = await import('../lib/index.js');
const fontAssets = await import('../lib/fonts.js');

let failures = 0;
async function test(name, fn) {
  try {
    await fn();
    console.log(`✓ ${name}`);
  } catch (error) {
    failures += 1;
    console.log(`✗ ${name}\n   ${error.message}`);
  }
}

/* ── 假 ctx：收集注册的路由与 effect 清理函数 ──────────────────── */
const routes = new Map();
const effects = [];
function makeCtx() {
  return {
    inject(names, callback) {
      // 与 cordis 的语义对齐：注入的服务名在宿主上可用时才回调。
      // 这里 dshHomePath 故意不给（验证回落路径），webServer 给。
      if (names.includes('webServer')) {
        callback({
          webServer: {
            register(route) {
              routes.set(route.path, route);
              return () => routes.delete(route.path);
            },
          },
          // 真 cordis 的 effect 是**立即执行**传入的函数、并接管它返回的清理函数。
          // 桩如果只记录不执行，插件里的注册代码就根本不会跑。
          effect(fn, label) {
            effects.push({ fn, label });
            const dispose = fn();
            return typeof dispose === 'function' ? dispose : () => {};
          },
          logger: { info() {} },
        });
        return;
      }
      // dshHomePath / 其他服务：不回调 —— 插件应回落到 $DSH_HOME。
    },
  };
}

host.apply(makeCtx());

/* ── 假 request / response ─────────────────────────────────────── */
function fakeResponse() {
  return {
    status: 0,
    headers: null,
    body: '',
    writeHead(status, headers) { this.status = status; this.headers = headers; return this; },
    end(chunk) { this.body = chunk ?? ''; return this; },
    json() { return JSON.parse(this.body); },
  };
}

function fakeRequest({ method = 'GET', url = '/', body } = {}) {
  const handlers = {};
  const request = {
    method,
    url,
    on(type, handler) { (handlers[type] ??= []).push(handler); return request; },
  };
  // 异步投递，模拟真实流：data → end
  queueMicrotask(() => {
    if (body !== undefined) {
      for (const handler of handlers.data ?? []) handler(Buffer.from(body, 'utf8'));
    }
    for (const handler of handlers.end ?? []) handler();
  });
  return request;
}

async function call(path, options) {
  // 路由按路径注册，查询串不参与匹配（真实服务器也一样）——查表时要去掉 ?query。
  const routePath = path.split('?')[0];
  const route = routes.get(routePath);
  assert.ok(route, `路由未注册：${routePath}`);
  const response = fakeResponse();
  await route.handler(fakeRequest({ url: path, ...options }), response);
  return response;
}

/* ── 用例 ─────────────────────────────────────────────────────── */

await test('sanity: 挂载后五条路由都注册了', () => {
  assert.deepEqual([...routes.keys()].sort(), [
    '/dsh-custom-font/font-asset',
    '/dsh-custom-font/font-manifest',
    '/dsh-custom-font/fonts',
    '/dsh-custom-font/settings',
    '/dsh-custom-font/settings/export',
  ]);
  assert.equal(effects.length, 5, '每条路由都应包在 host.effect 里（便于插件卸载时清理）');
});

await test('设置文件路径落在 $DSH_HOME/dsh-custom-font/settings.json', () => {
  const path = config.configPath(undefined);
  assert.equal(path, join(home, 'dsh-custom-font', 'settings.json'));
});

await test('GET /settings：文件还不存在时返回 settings: null（前端据此回落 localStorage）', async () => {
  const res = await call('/dsh-custom-font/settings');
  assert.equal(res.status, 200);
  const json = res.json();
  assert.equal(json.ok, true);
  assert.equal(json.settings, null);
  assert.equal(json.source, 'missing');
  assert.equal(json.path, join(home, 'dsh-custom-font', 'settings.json'));
});

await test('POST /settings：写入白名单字段，未知键被丢弃', async () => {
  const res = await call('/dsh-custom-font/settings', {
    method: 'POST',
    body: JSON.stringify({ settings: { bodySize: 16, bodyFont: '仿宋_GB2312', 恶意键: 'x', __proto__: { a: 1 } } }),
  });
  assert.equal(res.status, 200);
  assert.equal(res.json().ok, true);
  assert.equal(res.json().written, 2);

  const written = JSON.parse(readFileSync(join(home, 'dsh-custom-font', 'settings.json'), 'utf8'));
  assert.equal(written.bodySize, 16);
  assert.equal(written.bodyFont, '仿宋_GB2312');
  assert.equal('恶意键' in written, false, '白名单之外的键不该落盘');
});

await test('GET /settings：读回来的是刚写下的值', async () => {
  const res = await call('/dsh-custom-font/settings');
  const json = res.json();
  assert.equal(json.source, 'file');
  assert.equal(json.settings.bodySize, 16);
  assert.equal(json.settings.bodyFont, '仿宋_GB2312');
});

await test('POST /settings：增量写入不会抹掉之前写过的键', async () => {
  await call('/dsh-custom-font/settings', {
    method: 'POST',
    body: JSON.stringify({ settings: { h1Center: true } }),
  });
  const written = JSON.parse(readFileSync(join(home, 'dsh-custom-font', 'settings.json'), 'utf8'));
  assert.equal(written.bodySize, 16, '旧键应当保留');
  assert.equal(written.h1Center, true, '新键应当写入');
});

await test('POST /settings：类型不对的值被忽略，不写坏文件', async () => {
  await call('/dsh-custom-font/settings', {
    method: 'POST',
    body: JSON.stringify({ settings: { bodySize: '很大', bodyWeight: { a: 1 }, h1Center: 'yes' } }),
  });
  const written = JSON.parse(readFileSync(join(home, 'dsh-custom-font', 'settings.json'), 'utf8'));
  assert.equal(written.bodySize, 16, '非法数字不该覆盖原值');
  assert.equal(written.h1Center, true, '字符串 "yes" 不是布尔，不该写入');
});

await test('POST /settings：请求体不是 JSON 时返回 400，且不破坏已有文件', async () => {
  const before = readFileSync(join(home, 'dsh-custom-font', 'settings.json'), 'utf8');
  const res = await call('/dsh-custom-font/settings', { method: 'POST', body: '{ 这不是 JSON' });
  assert.equal(res.status, 400);
  assert.equal(res.json().ok, false);
  assert.equal(readFileSync(join(home, 'dsh-custom-font', 'settings.json'), 'utf8'), before);
});

await test('设置文件被手改坏（非法 JSON）时：GET 报错但不崩，POST 能自愈重写', async () => {
  const path = join(home, 'dsh-custom-font', 'settings.json');
  writeFileSync(path, '{ 坏掉的 json', 'utf8');
  const broken = await call('/dsh-custom-font/settings');
  assert.equal(broken.status, 200);
  assert.equal(broken.json().settings, null);
  assert.equal(broken.json().source, 'error');
  assert.ok(broken.json().error, '应当回报错误原因，便于排查');

  const healed = await call('/dsh-custom-font/settings', {
    method: 'POST',
    body: JSON.stringify({ settings: { bodySize: 18 } }),
  });
  assert.equal(healed.status, 200);
  const written = JSON.parse(readFileSync(path, 'utf8'));
  assert.equal(written.bodySize, 18, '坏文件应当被重写成可用的');
});

await test('GET /settings/export：导出的是文件原文（含已写入的键）', async () => {
  const res = await call('/dsh-custom-font/settings/export');
  assert.equal(res.status, 200);
  const json = res.json();
  assert.equal(json.ok, true);
  assert.match(json.text, /"bodySize": 18/);
});

await test('GET /fonts：返回字符串数组结构（未装字体时为 []，也要是合法 JSON）', async () => {
  const res = await call('/dsh-custom-font/fonts');
  assert.equal(res.status, 200);
  const json = res.json();
  assert.ok(Array.isArray(json.fonts), 'fonts 必须是数组');
  for (const font of json.fonts) {
    assert.equal(typeof font.en, 'string');
    assert.equal(typeof font.zh, 'string');
  }
});

await test('方法不允许时返回 405', async () => {
  const res = await call('/dsh-custom-font/settings', { method: 'DELETE' });
  assert.equal(res.status, 405);
  assert.equal(res.json().ok, false);
});

/* ── 内置字体（解决"用户电脑没装推荐字体"） ───────────────────── */

await test('内置字体文件都在仓库里（打包漏文件时这里会先炸）', () => {
  const { fonts, missing, dir } = fontAssets.availableFonts();
  assert.deepEqual(missing, [], `assets/fonts 里缺少：${missing.join(', ')}（目录 ${dir}）`);
  assert.equal(fonts.length, 7, '应当是 4 个 STIX2Text 字重 + 3 个 Latin Modern 字重');
});

await test('GET /font-manifest：列出每个字体文件与它的下载地址', async () => {
  const res = await call('/dsh-custom-font/font-manifest');
  assert.equal(res.status, 200);
  const json = res.json();
  assert.equal(json.ok, true);
  assert.equal(json.fonts.length, 7);
  assert.deepEqual(json.missing, []);
  for (const font of json.fonts) {
    assert.ok(font.file.endsWith('.woff'), `应当是 woff：${font.file}`);
    assert.equal(typeof font.family, 'string');
    assert.equal(typeof font.weight, 'number');
    assert.match(font.style, /^(normal|italic)$/);
    assert.match(font.url, /^\/dsh-custom-font\/font-asset\?name=/);
  }
  const families = new Set(json.fonts.map((f) => f.family));
  assert.equal(families.has('STIX2Text'), true);
  assert.equal(families.has('Latin Modern Mono Light'), true);
});

await test('GET /font-asset：按名字返回字体文件本体，MIME 与体积正确', async () => {
  const res = await call('/dsh-custom-font/font-asset?name=STIX2Text-Regular.woff');
  assert.equal(res.status, 200);
  assert.equal(res.headers['content-type'], 'font/woff');
  assert.equal(Number(res.headers['content-length']), Buffer.byteLength(res.body));
  // 真·WOFF 文件头
  assert.equal(String(res.body.subarray(0, 4)), 'wOFF');
  assert.equal(res.headers['cache-control'].includes('max-age'), true, '字体内容不变，应当允许浏览器缓存');
});

await test('GET /font-asset：目录穿越被拒（这条是安全红线）', async () => {
  const attacks = [
    '..%2F..%2Fpackage.json',
    '../package.json',
    '..\\..\\package.json',
    '%2e%2e%2f%2e%2e%2fpackage.json',
    '/etc/passwd',
    'C:\\Windows\\win.ini',
    '',                            // 没带 name
    'STIX2Text-Regular.woff.bak',  // 不在清单里
  ];
  for (const name of attacks) {
    const res = await call(`/dsh-custom-font/font-asset?name=${name}`);
    assert.notEqual(res.status, 200, `不该放行：${name}`);
    assert.equal(res.json().ok, false, `应当是错误响应：${name}`);
  }
});

await test('readFontFile：只认清单里的文件名，且返回真实字节', () => {
  const ok = fontAssets.readFontFile('LMMonoLt10-Regular.woff');
  assert.equal(ok.ok, true);
  assert.equal(String(ok.body.subarray(0, 4)), 'wOFF');
  assert.ok(ok.size > 10000, '字体文件不可能这么小');

  const traversal = fontAssets.readFontFile('../../package.json');
  assert.equal(traversal.ok, false);
  assert.equal(traversal.code, 404);

  const missingFont = fontAssets.readFontFile('NotAFont.woff');
  assert.equal(missingFont.ok, false);
});

await test('parseFonts：容忍 BOM、单对象、字段缺失与垃圾输入', () => {
  assert.deepEqual(host.parseFonts('\uFEFF[{"en":"Arial","zh":"Arial"}]'), [{ en: 'Arial', zh: 'Arial' }]);
  assert.deepEqual(host.parseFonts('{"en":"SimHei","zh":"黑体"}'), [{ en: 'SimHei', zh: '黑体' }]);
  assert.deepEqual(host.parseFonts('[{"en":"X"}]'), [{ en: 'X', zh: 'X' }], 'zh 缺失时回落到 en');
  assert.deepEqual(host.parseFonts('[{"en":"A","zh":"A"},{"en":"A","zh":"A"}]').length, 1, '应当去重');
  assert.deepEqual(host.parseFonts(''), []);
  assert.deepEqual(host.parseFonts('不是 JSON'), []);
  assert.deepEqual(host.parseFonts(null), []);
});

await test('原子写入：不留 .tmp 残file，且文件是可解析 JSON + 末尾换行', () => {
  const path = join(home, 'dsh-custom-font', 'settings.json');
  assert.equal(existsSync(`${path}.tmp`), false, '写作过程应当用临时文件再改名，不该留下 .tmp');
  const text = readFileSync(path, 'utf8');
  assert.doesNotThrow(() => JSON.parse(text));
  assert.equal(text.endsWith('\n'), true);
});

await test('$DSH_HOME 没设时回落到 ~/.dsh（只验证路径计算，不写盘）', () => {
  const saved = process.env.DSH_HOME;
  delete process.env.DSH_HOME;
  try {
    const resolved = config.configPath(undefined);
    assert.match(resolved.replace(/\\/g, '/'), /\/\.dsh\/dsh-custom-font\/settings\.json$/);
  } finally {
    process.env.DSH_HOME = saved;
  }
});

await test('宿主注入的 dshHomePath 优先于环境变量', () => {
  const custom = join(home, 'custom-home');
  assert.equal(config.configPath(custom), join(custom, 'dsh-custom-font', 'settings.json'));
});

console.log(failures === 0 ? '\n全部通过' : `\n失败 ${failures} 项`);
process.exit(failures === 0 ? 0 : 1);
