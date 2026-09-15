/**
 * 字体设置持久化：`$DSH_HOME/dsh-custom-font/settings.json`
 *
 * 为什么要有这个模块（而不是继续用 localStorage）：
 *   `localStorage` 由 Chromium 按「外壳应用数据目录 + 访问源」双重隔离，
 *   两个桌面外壳的 productName 不同 → 两个独立存储区 → **换外壳必丢设置**。
 *   `$DSH_HOME`（默认 `~/.dsh`）是内核自己的用户目录，跟外壳无关，换壳不丢。
 *
 * 与 dsh-email-notify 同样的做法：第三方插件的 settings 命名空间不在宿主
 * api-proxy 白名单里，浏览器端读写不了，所以用一个自己的 JSON 文件 + 本地 HTTP 接口。
 */
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';

/** 插件私有子目录名（与包名一致，便于用户找到）。 */
const DIR_NAME = 'dsh-custom-font';
const FILE_NAME = 'settings.json';

/** 取 DSH 用户目录：优先宿主注入的解析器，其次 $DSH_HOME，最后 ~/.dsh。 */
export function resolveDshHome(preferred) {
  if (typeof preferred === 'string' && preferred.trim()) return preferred.trim();
  const fromEnv = process.env.DSH_HOME;
  if (typeof fromEnv === 'string' && fromEnv.trim()) return fromEnv.trim();
  return join(homedir(), '.dsh');
}

/** 设置文件所在目录。 */
export function configDir(preferredHome) {
  return join(resolveDshHome(preferredHome), DIR_NAME);
}

/** 设置文件完整路径。 */
export function configPath(preferredHome) {
  return join(configDir(preferredHome), FILE_NAME);
}

/**
 * 可写入的键及其类型。
 *
 * 刻意用白名单：设置文件是用户可见的普通 JSON，手改出错（拼错键名、类型写错）
 * 不能让它把插件搞崩，也不能让一个陌生键悄悄生效。
 * 键必须与 client/client.js 的 DEFAULTS 保持一致，test/client.test.mjs 会核对。
 */
const WRITABLE = {
  // 正文
  bodyFont: 'string',
  bodyFontEn: 'string',
  bodySize: 'number',
  bodyWeight: 'number',
  bodyColor: 'string',
  // 标题（基础）
  headingFont: 'string',
  headingFontEn: 'string',
  headingSize: 'number',
  headingWeight: 'number',
  // 代码
  codeFont: 'string',
  codeSize: 'number',
  codeWeight: 'number',
  // 界面文字
  uiFollow: 'boolean',
  // 作者推荐排版开关
  justifyBody: 'boolean',
  h1Center: 'boolean',
  h1NoBold: 'boolean',
  quoteItalic: 'boolean',
  quoteBar: 'boolean',
  linkColorOn: 'boolean',
  linkColor: 'string',
  linkColorHover: 'string',
  inlineCodeBg: 'boolean',
  tableHeader: 'boolean',
  embeddedFonts: 'boolean',
  // 高级：逐级标题
  h1On: 'boolean', h1Font: 'string', h1FontEn: 'string', h1Size: 'number', h1Weight: 'number',
  h2On: 'boolean', h2Font: 'string', h2FontEn: 'string', h2Size: 'number', h2Weight: 'number',
  h3On: 'boolean', h3Font: 'string', h3FontEn: 'string', h3Size: 'number', h3Weight: 'number',
  h4On: 'boolean', h4Font: 'string', h4FontEn: 'string', h4Size: 'number', h4Weight: 'number',
  h5On: 'boolean', h5Font: 'string', h5FontEn: 'string', h5Size: 'number', h5Weight: 'number',
  h6On: 'boolean', h6Font: 'string', h6FontEn: 'string', h6Size: 'number', h6Weight: 'number',
  // 高级：其他元素
  quoteOn: 'boolean', quoteFont: 'string', quoteFontEn: 'string', quoteSize: 'number', quoteWeight: 'number',
  codeInlineOn: 'boolean', codeInlineFont: 'string', codeInlineFontEn: 'string', codeInlineSize: 'number', codeInlineWeight: 'number',
  codeBlockOn: 'boolean', codeBlockFont: 'string', codeBlockFontEn: 'string', codeBlockSize: 'number', codeBlockWeight: 'number',
  uiOn: 'boolean', uiFont: 'string', uiFontEn: 'string', uiSize: 'number', uiWeight: 'number',
};

/** 所有已知键名（宿主端校验用）。 */
export function writableKeys() {
  return Object.keys(WRITABLE);
}

/** 按类型收窄一个来路不明的值；类型不对返回 undefined 表示「忽略这一项」。 */
function coerce(kind, value) {
  if (kind === 'boolean') {
    if (typeof value === 'boolean') return value;
    if (value === 'true') return true;
    if (value === 'false') return false;
    return undefined;
  }
  if (kind === 'number') {
    const num = typeof value === 'number' ? value : Number(String(value ?? '').trim());
    return Number.isFinite(num) ? num : undefined;
  }
  if (kind === 'string') return typeof value === 'string' ? value : undefined;
  return undefined;
}

/**
 * 从任意输入里挑出允许写入的字段。
 * @param {unknown} patch - 来路不明的对象（设置页提交 / 导入的 JSON）。
 * @returns {object} 只含白名单字段的对象。
 */
export function pickWritable(patch) {
  const out = {};
  if (patch === null || typeof patch !== 'object' || Array.isArray(patch)) return out;
  for (const [key, kind] of Object.entries(WRITABLE)) {
    if (!(key in patch)) continue;
    const value = coerce(kind, patch[key]);
    if (value !== undefined) out[key] = value;
  }
  return out;
}

/**
 * 读取设置文件。
 * @param {string} [preferredHome] - 宿主注入的 DSH 目录解析结果。
 * @returns {{settings: object|null, path: string, source: 'file'|'missing'|'error', error: string|null}}
 *   `settings` 为 null 表示文件不存在或读不出来（调用方应回落到 localStorage / 内置默认值）。
 */
export function loadSettings(preferredHome) {
  const path = configPath(preferredHome);
  if (!existsSync(path)) return { settings: null, path, source: 'missing', error: null };
  try {
    const raw = readFileSync(path, 'utf8').replace(/^\uFEFF/, '');
    const parsed = JSON.parse(raw);
    const picked = pickWritable(parsed);
    return { settings: picked, path, source: 'file', error: null };
  } catch (error) {
    return { settings: null, path, source: 'error', error: `设置文件读取失败：${error.message}` };
  }
}

/**
 * 写入设置文件（只覆盖白名单字段，未知键与手写注释键原样保留）。
 *
 * 先写临时文件再改名：中途失败不会留下半个 JSON（坑：install.mjs 的"先删后复制"不是原子操作）。
 *
 * @param {unknown} patch - 设置页提交或导入的部分字段。
 * @param {string} [preferredHome] - 宿主注入的 DSH 目录。
 * @returns {{ok: boolean, error?: string, settings?: object, path?: string, written?: number}}
 */
export function saveSettings(patch, preferredHome) {
  const path = configPath(preferredHome);
  const picked = pickWritable(patch);

  let raw = {};
  try {
    if (existsSync(path)) {
      const existing = JSON.parse(readFileSync(path, 'utf8').replace(/^\uFEFF/, ''));
      if (existing !== null && typeof existing === 'object' && !Array.isArray(existing)) raw = existing;
    }
  } catch {
    // 文件坏了也别丢人：下面会以现有键为底（读失败则空对象）重写一份可用的。
    raw = {};
  }

  Object.assign(raw, picked);
  try {
    mkdirSync(configDir(preferredHome), { recursive: true });
    const temp = `${path}.tmp`;
    writeFileSync(temp, `${JSON.stringify(raw, null, 2)}\n`, 'utf8');
    renameSync(temp, path);
  } catch (error) {
    return { ok: false, error: `写入失败：${error.message}`, path };
  }
  return { ok: true, settings: raw, path, written: Object.keys(picked).length };
}

/** 导出给用户备份的完整 JSON 文本。 */
export function exportSettings(preferredHome) {
  const path = configPath(preferredHome);
  if (existsSync(path)) {
    try {
      return { ok: true, text: readFileSync(path, 'utf8'), path };
    } catch (error) {
      return { ok: false, error: `读取失败：${error.message}`, path };
    }
  }
  return { ok: false, error: '设置文件还不存在（说明还没改过任何设置）', path };
}
