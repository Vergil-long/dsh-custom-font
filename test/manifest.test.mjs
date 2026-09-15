/**
 * 清单自检：守住"插件能不能被 DSH 装上并加载"这件事。
 *
 * 这一层最容易静默失败——清单里少一个字段、路径写错、client 包装里的 id 与包名不一致，
 * 结果就是"设置页里根本没有那一节"，而日志里什么都看不见。
 * 按运行时的实际校验规则逐条对着查（规则来自 dsh-client-modules 与 dsh bundle patch）。
 *
 *   node test/manifest.test.mjs
 */
import assert from 'node:assert/strict';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const read = (relative) => readFileSync(join(root, relative), 'utf8');

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

const pkg = JSON.parse(read('package.json'));

await test('package.json 基本字段齐全（name/version/license/main/type）', () => {
  assert.equal(pkg.type, 'module', '必须是 ESM（宿主半侧用的是 import/export）');
  assert.match(pkg.name, /^dsh-[\w.-]+$/, '包名应当以 dsh- 开头（DSH 插件命名习惯）');
  assert.match(pkg.version, /^\d+\.\d+\.\d+$/);
  assert.equal(pkg.license, 'MIT');
  assert.ok(pkg.main, '要有 main，否则宿主半侧无法按包名加载');
  assert.ok(existsSync(join(root, pkg.main)), `main 指向的文件不存在：${pkg.main}`);
  assert.ok(pkg.repository?.url, 'GitHub 封装后应当有 repository（npm 关联与市场排版都要）');
  assert.ok(pkg.author, '应当有 author');
});

await test('dsh.bundle.patch 存在，且那份 patch 确实插入了本包', () => {
  const patchPath = pkg.dsh?.bundle?.patch;
  assert.ok(patchPath, '缺少 dsh.bundle.patch');
  assert.ok(existsSync(join(root, patchPath)), `patch 文件不存在：${patchPath}`);
  const text = read(patchPath);
  assert.match(text, /-\s*insert:/, 'patch 应当是一条 insert 列表');
  assert.match(text, new RegExp(`id:\\s*['"]?${pkg.name}['"]?`), `patch 里没有 id: ${pkg.name}`);
  assert.match(text, new RegExp(`name:\\s*['"]${pkg.name}['"]`), `patch 里没有 name: '${pkg.name}'`);
});

await test('dsh.client 声明符合 dsh-client-modules 的严格校验', () => {
  const client = pkg.dsh?.client;
  assert.ok(client, '缺少 dsh.client（浏览器半侧不会被装配）');
  assert.equal(typeof client.platform, 'string', 'platform 必须是字符串');
  assert.equal(client.platform, 'web');
  if (client.inject !== undefined) {
    assert.ok(Array.isArray(client.inject) && client.inject.every((item) => typeof item === 'string'),
      'inject 必须是字符串数组');
  }
  if (client.immediately !== undefined) {
    assert.equal(typeof client.immediately, 'boolean', 'immediately 必须是布尔');
  }
});

await test('exports["./client"] 能解析到真实文件', () => {
  const entry = pkg.exports?.['./client'];
  const resolved = typeof entry === 'string' ? entry : entry?.default;
  assert.equal(typeof resolved, 'string', 'exports["./client"] 必须是字符串或带 default 的对象');
  assert.ok(existsSync(join(root, resolved)), `client 文件不存在：${resolved}`);
});

await test('client 包装里的 id 与包名一致，且用的是 __ModuleLoader__ 格式', () => {
  const entry = pkg.exports['./client'];
  const source = read(typeof entry === 'string' ? entry : entry.default);
  assert.match(source, /window\.__ModuleLoader__\.load\(/, 'client 半侧必须是 __ModuleLoader__.load 包装格式');
  const idMatch = /id:\s*["']([^"']+)["']/.exec(source);
  assert.ok(idMatch, '包装里没有 id');
  assert.equal(idMatch[1], pkg.name, '包装里的 id 必须与包名一致');
  assert.match(source, /factory:/, '包装里要有 factory');
});

await test('宿主半侧可以 import，并导出 apply', async () => {
  // Windows 上动态 import 绝对路径必须转成 file:// URL，否则报 "protocol 'f:'"。
  const module = await import(pathToFileURL(join(root, pkg.main)).href);
  assert.equal(typeof module.apply, 'function', '宿主半侧必须导出 apply(ctx)');
  if (module.name !== undefined) assert.equal(typeof module.name, 'string');
});

await test('exports 里声明的入口都存在', () => {
  for (const [key, value] of Object.entries(pkg.exports ?? {})) {
    const target = typeof value === 'string' ? value : value?.default;
    if (typeof target !== 'string') continue;
    assert.ok(existsSync(join(root, target)), `exports["${key}"] 指向的文件不存在：${target}`);
  }
});

await test('files 字段里的每一项都存在（npm 发布时不会缺文件）', () => {
  for (const item of pkg.files ?? []) {
    assert.ok(existsSync(join(root, item)), `files 里列了不存在的项：${item}`);
  }
  for (const required of ['README.md', 'LICENSE']) {
    assert.ok(pkg.files?.includes(required), `files 里应当包含 ${required}`);
  }
});

await test('宿主端设置白名单与客户端 DEFAULTS 的键完全一致', () => {
  // 两处不一致的后果很隐蔽：设置页改了、看起来生效了，但写文件时被静默丢掉，
  // 下次启动又变回去。所以这里逐个键对。
  const configSource = read('lib/config.js');
  const clientSource = read('client/client.js');
  // 白名单里一行可能写多个键，所以用全局匹配抓 "键: '类型'," 的全部出现。
  const keysFromConfig = [...configSource.matchAll(/([A-Za-z][A-Za-z0-9]*):\s*'(?:string|number|boolean)'/g)].map((m) => m[1]);
  const defaultsBlock = /var DEFAULTS = \{([\s\S]*?)\n    \};/.exec(clientSource);
  assert.ok(defaultsBlock, 'client.js 里应当有 DEFAULTS 块');
  const keysFromClient = [...defaultsBlock[1].matchAll(/([A-Za-z][A-Za-z0-9]*)\s*:/g)].map((m) => m[1]);
  const missingOnHost = keysFromClient.filter((key) => !keysFromConfig.includes(key));
  assert.deepEqual(missingOnHost, [], `这些设置键在宿主端白名单里没有，会被静默丢弃：${missingOnHost.join(', ')}`);
});

await test('插件不依赖任何 @deepseek-ai/* 运行时包（第三方插件不该耦合内核内部）', () => {
  const deps = { ...(pkg.dependencies ?? {}), ...(pkg.peerDependencies ?? {}) };
  const official = Object.keys(deps).filter((name) => name.startsWith('@deepseek-ai/'));
  assert.deepEqual(official, [], `不应当依赖官方内核包：${official.join(', ')}`);
});

await test('assets/fonts 里的文件与 lib/fonts.js 的清单一致（不多不少）', async () => {
  const { EMBEDDED_FONTS, fontsDir } = await import(pathToFileURL(join(root, 'lib/fonts.js')).href);
  const listed = new Set(EMBEDDED_FONTS.map((f) => f.file));
  const actual = readdirSync(fontsDir()).filter((name) => !name.startsWith('.') && name.endsWith('.woff'));
  for (const file of actual) {
    assert.equal(listed.has(file), true, `assets/fonts 里的 ${file} 没登记在 lib/fonts.js（用户拿不到它）`);
  }
  for (const file of listed) {
    assert.equal(actual.includes(file), true, `lib/fonts.js 登记的 ${file} 在 assets/fonts 里不存在 → 前端会 404`);
  }
});

await test('内置字体的许可证说明随包提供（OFL 与 GUST 都要求）', () => {
  const licensePath = join(root, 'assets', 'fonts', 'LICENSE-FONTS.md');
  assert.ok(existsSync(licensePath), '应当有 assets/fonts/LICENSE-FONTS.md');
  const text = readFileSync(licensePath, 'utf8');
  assert.match(text, /SIL Open Font License|OFL/i, '应当写明 STIX 的许可证');
  assert.match(text, /GUST/i, '应当写明 Latin Modern 的许可证');
});

await test('files 字段包含 assets（否则发布后用户拿不到内置字体）', () => {
  assert.equal(pkg.files?.includes('assets'), true, 'files 里必须有 assets');
});

console.log(failures === 0 ? '\n全部通过' : `\n失败 ${failures} 项`);
process.exit(failures === 0 ? 0 : 1);
