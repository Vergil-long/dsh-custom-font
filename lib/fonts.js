/**
 * 内置字体资源：插件自带的两套开源字体，供「作者推荐」排版使用。
 *
 * 为什么内置（而不是要求用户先装到系统里）：
 *   作者推荐用的 STIX2Text / Latin Modern Mono Light 不是 Windows 自带字体。
 *   如果只写字体名，用户电脑上没有时浏览器会**静默回退**到别的字体——
 *   用户以为自己用的是推荐排版，其实不是，而且没有任何提示。
 *   内置之后：装插件就有这两套字体，任何电脑上效果一致，不碰用户系统。
 *
 * 为什么放 assets/ 而不是编码进 JS：
 *   字体文件约 820 KB（WOFF）。编进客户端 JS 会让插件体积翻十倍且每次页面加载都要解析；
 *   放成文件由宿主端按需返回，浏览器只在真正用到时才下载。
 *
 * 许可：STIX Two Text 为 SIL OFL 1.1，Latin Modern 为 GUST Font License，
 *       两者都允许随软件再分发。许可证原文见仓库 assets/fonts/ 与根目录 LICENSE-FONTS.md。
 */
import { existsSync, readFileSync, statSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));

/** 字体资源目录：lib/ 的上一级的 assets/fonts。 */
export function fontsDir() {
  return join(HERE, '..', 'assets', 'fonts');
}

/**
 * 内置字体清单。
 *   family  —— CSS font-family 用的名字（与字体文件内部名字一致）
 *   file    —— assets/fonts 下的文件名
 *   weight / style —— 用于生成 @font-face
 */
export const EMBEDDED_FONTS = [
  { family: 'STIX2Text', file: 'STIX2Text-Regular.woff', weight: 400, style: 'normal' },
  { family: 'STIX2Text', file: 'STIX2Text-Italic.woff', weight: 400, style: 'italic' },
  { family: 'STIX2Text', file: 'STIX2Text-Bold.woff', weight: 700, style: 'normal' },
  { family: 'STIX2Text', file: 'STIX2Text-BoldItalic.woff', weight: 700, style: 'italic' },
  { family: 'Latin Modern Mono Light', file: 'LMMonoLt10-Regular.woff', weight: 400, style: 'normal' },
  { family: 'Latin Modern Mono Light', file: 'LMMonoLt10-Italic.woff', weight: 400, style: 'italic' },
  { family: 'Latin Modern Mono Light', file: 'LMMonoLt10-Bold.woff', weight: 700, style: 'normal' },
];

/** 允许被请求的文件名白名单（防目录穿越：只认清单里出现过的名字）。 */
const ALLOWED = new Set(EMBEDDED_FONTS.map((f) => f.file));

const MIME = { '.woff': 'font/woff', '.woff2': 'font/woff2', '.otf': 'font/otf', '.ttf': 'font/ttf' };

/** 资源目录里实际存在的字体（缺文件时告诉前端缺哪个，而不是静默少一个字形）。 */
export function availableFonts() {
  const dir = fontsDir();
  const present = [];
  const missing = [];
  for (const font of EMBEDDED_FONTS) {
    (existsSync(join(dir, font.file)) ? present : missing).push(font.file);
  }
  return { fonts: present, missing, dir };
}

/**
 * 读取一个内置字体文件。
 * @param {string} name - 只允许清单里的文件名（去掉任何目录部分）。
 * @returns {{ok: true, body: Buffer, mime: string, size: number} | {ok: false, code: number, error: string}}
 */
export function readFontFile(name) {
  const safe = String(name || '').replace(/\\/g, '/').split('/').pop();
  if (!safe || !ALLOWED.has(safe)) {
    return { ok: false, code: 404, error: `不在内置字体清单里：${String(name || '').slice(0, 80)}` };
  }
  const path = join(fontsDir(), safe);
  if (!existsSync(path)) return { ok: false, code: 404, error: `字体文件不存在：${safe}` };
  try {
    const body = readFileSync(path);
    const ext = safe.slice(safe.lastIndexOf('.'));
    return { ok: true, body, mime: MIME[ext] || 'application/octet-stream', size: statSync(path).size };
  } catch (error) {
    return { ok: false, code: 500, error: `读取失败：${error.message}` };
  }
}

/** 给前端用的清单（不含文件内容）。 */
export function fontManifest() {
  const { missing } = availableFonts();
  return {
    fonts: EMBEDDED_FONTS.map((f) => ({ ...f, url: `/dsh-custom-font/font-asset?name=${encodeURIComponent(f.file)}` })),
    missing,
  };
}
