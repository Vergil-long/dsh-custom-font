/**
 * 客户端半侧自检：把 client/client.js 放进最小 DOM 桩里跑，验证
 *   - 生成的 CSS 确实实现了《统一排版规范》（正文 16px、西文 STIX2Text、h1 22px 不加粗居中、
 *     引用竖线、链接暗红、代码字体、表头深底浅字…）
 *   - 设置链路：localStorage 兜底 → 宿主文件优先 → 保存时写回宿主
 *   - 导出/导入、一键套用规范、恢复默认
 *   - 样式热重载（旧 <style> 存在时也要替换内容）
 *
 *   node test/client.test.mjs
 */
import assert from 'node:assert/strict';

/* ── 最小 DOM 桩 ───────────────────────────────────────────────── */

const created = [];
let fetchCalls = [];

function makeElement(tag) {
  const node = {
    tagName: String(tag).toUpperCase(),
    className: '',
    textContent: '',
    value: '',
    checked: false,
    disabled: false,
    title: '',
    type: '',
    children: [],
    attributes: new Map(),
    style: {},
    isConnected: true,
    files: [],
    setAttribute: (key, value) => { node.attributes.set(key, value); if (key === 'class') node.className = value; },
    getAttribute: (key) => node.attributes.get(key) ?? null,
    hasAttribute: (key) => node.attributes.has(key),
    appendChild(child) {
      node.children.push(child);
      if (child && typeof child === 'object') child.parentNode = node;
      return child;
    },
    removeChild(child) {
      const index = node.children.indexOf(child);
      if (index >= 0) node.children.splice(index, 1);
      return child;
    },
    replaceChildren(...nodes) {
      node.children.length = 0;
      for (const child of nodes) node.appendChild(child);
    },
    remove() { node.isConnected = false; },
    addEventListener(type, handler) { (node.handlers ??= {})[type] = handler; },
    click() { node.handlers?.click?.({ target: node }); },
    querySelector(selector) { return findIn(node, selector); },
    querySelectorAll(selector) { return findAllIn(node, selector); },
  };
  created.push(node);
  return node;
}

/**
 * 极简选择器匹配：支持 tag / .class / tag.class / #id / [attr] / [attr=value] 的组合。
 * 注意要支持「标签+类」的复合写法（如 button.primary）——只支持单写法的桩会静默找不到元素。
 */
function matchesSelector(node, selector) {
  return selector.split(',').map((s) => s.trim()).filter(Boolean).some((part) => {
    const attrMatches = [...part.matchAll(/\[([^\]=]+)(?:=["']?([^\]"']*)["']?)?\]/g)];
    const base = part.replace(/\[[^\]]*\]/g, '');
    const tagName = (base.match(/^[A-Za-z][\w-]*/) ?? [null])[0];
    const classes = [...base.matchAll(/\.([\w-]+)/g)].map((m) => m[1]);
    const idMatch = /#([\w-]+)/.exec(base);

    if (tagName && node.tagName !== tagName.toUpperCase()) return false;
    const nodeClasses = String(node.className).split(/\s+/).filter(Boolean);
    for (const cls of classes) {
      if (!nodeClasses.includes(cls)) return false;
    }
    if (idMatch && node.attributes.get('id') !== idMatch[1]) return false;
    for (const [, name, value] of attrMatches) {
      if (!node.attributes.has(name)) return false;
      if (value !== undefined && String(node.attributes.get(name)) !== value) return false;
    }
    return true;
  });
}

function walk(node, visit) {
  visit(node);
  for (const child of node.children ?? []) walk(child, visit);
}

function findIn(root, selector) {
  let hit = null;
  walk(root, (node) => { if (!hit && node !== root && matchesSelector(node, selector)) hit = node; });
  return hit;
}

function findAllIn(root, selector) {
  const hits = [];
  walk(root, (node) => { if (node !== root && matchesSelector(node, selector)) hits.push(node); });
  return hits;
}

const head = makeElement('head');
const body = makeElement('body');

globalThis.window = {
  __ModuleLoader__: { load: (entry) => { globalThis.__loaded = entry; } },
  // 自检开关：主题模块不自动加载内置字体（要测"没加载时"的行为，前提必须成立）。
  // 需要自动加载的用例走 loadFreshModule()，那里会临时打开自动加载。
  __DSH_CUSTOM_FONT_NO_EMBEDDED__: true,
};
globalThis.document = {
  head,
  body,
  createElement: (tag) => makeElement(tag),
  querySelector: (selector) => findIn(head, selector),
  querySelectorAll: (selector) => findAllIn(head, selector),
};
globalThis.URL.createObjectURL = () => 'blob:stub';
globalThis.URL.revokeObjectURL = () => {};
globalThis.Blob = class Blob { constructor(parts) { this.parts = parts; } };
// 插件用 setTimeout 做"延迟写回宿主"的节流，这里接管它，好在用例里手动触发。
// 但 flush 自己必须用真定时器，否则永远等不到。
const realSetTimeout = globalThis.setTimeout;
globalThis.__timers = [];
globalThis.setTimeout = (fn, ms) => { globalThis.__timers.push({ fn, ms }); return globalThis.__timers.length; };
globalThis.clearTimeout = () => {};

/* 内存版 localStorage：模块加载时就会读它 */
const store = new Map();
globalThis.localStorage = {
  getItem: (key) => (store.has(key) ? store.get(key) : null),
  setItem: (key, value) => { store.set(key, String(value)); },
  removeItem: (key) => { store.delete(key); },
};

/** 测试用的系统字体清单（故意**不含** STIX2Text / Latin Modern Mono Light，
 *  好验证"系统没装时由内置字体接管"这条链路）。 */
const SYSTEM_FONTS = [
  { en: 'FangSong_GB2312', zh: '仿宋_GB2312' },
  { en: 'FZXiaoBiaoSong-B05S', zh: '方正小标宋简体' },
  { en: 'SimHei', zh: '黑体' },
  { en: 'KaiTi_GB2312', zh: '楷体_GB2312' },
  { en: 'DengXian', zh: '等线' },
  { en: 'Times New Roman', zh: 'Times New Roman' },
  { en: 'Consolas', zh: 'Consolas' },
];

/** 插件内置字体清单（与 lib/fonts.js 的 EMBEDDED_FONTS 一致）。 */
const EMBEDDED_MANIFEST = [
  { family: 'STIX2Text', file: 'STIX2Text-Regular.woff', weight: 400, style: 'normal' },
  { family: 'STIX2Text', file: 'STIX2Text-Italic.woff', weight: 400, style: 'italic' },
  { family: 'STIX2Text', file: 'STIX2Text-Bold.woff', weight: 700, style: 'normal' },
  { family: 'STIX2Text', file: 'STIX2Text-BoldItalic.woff', weight: 700, style: 'italic' },
  { family: 'Latin Modern Mono Light', file: 'LMMonoLt10-Regular.woff', weight: 400, style: 'normal' },
  { family: 'Latin Modern Mono Light', file: 'LMMonoLt10-Italic.woff', weight: 400, style: 'italic' },
  { family: 'Latin Modern Mono Light', file: 'LMMonoLt10-Bold.woff', weight: 700, style: 'normal' },
];

/* 内存版宿主：settings.json 的存在与否由 __serverSettings 控制 */
let serverSettings = null;
let postCount = 0;

globalThis.fetch = async (url, options = {}) => {
  const target = String(url);
  fetchCalls.push({ url: target, options });
  if (target.startsWith('/dsh-custom-font/fonts')) {
    return { ok: true, status: 200, json: async () => ({ fonts: SYSTEM_FONTS }) };
  }
  if (target.startsWith('/dsh-custom-font/font-manifest')) {
    return {
      ok: true,
      status: 200,
      json: async () => ({
        ok: true,
        missing: [],
        fonts: EMBEDDED_MANIFEST.map((f) => ({ ...f, url: `/dsh-custom-font/font-asset?name=${f.file}` })),
      }),
    };
  }
  if (target.startsWith('/dsh-custom-font/font-asset')) {
    // 返回一个假的"字体二进制"即可——客户端只把它转成 blob URL
    return { ok: true, status: 200, blob: async () => ({ __font: target }) };
  }
  if (target.startsWith('/dsh-custom-font/settings/export')) {
    return { ok: true, json: async () => ({ ok: true, text: JSON.stringify(serverSettings ?? {}, null, 2), path: 'C:\\Users\\x\\.dsh\\dsh-custom-font\\settings.json' }) };
  }
  if (target.startsWith('/dsh-custom-font/settings')) {
    if (options.method === 'POST') {
      const patch = JSON.parse(options.body).settings ?? {};
      serverSettings = { ...(serverSettings ?? {}), ...patch };
      postCount += 1;
      return { ok: true, status: 200, json: async () => ({ ok: true, written: Object.keys(patch).length, path: 'C:\\Users\\x\\.dsh\\dsh-custom-font\\settings.json' }) };
    }
    return {
      ok: true,
      status: 200,
      json: async () => ({
        ok: true,
        // 宿主文件 = 浏览器存储里那份（真机上换壳前两者就是同一批设置）。
        // 用 null 模拟"宿主还没有文件"，用 {} 模拟"文件存在但是空的"。
        settings: serverSettings,
        source: serverSettings ? 'file' : 'missing',
        path: 'C:\\Users\\x\\.dsh\\dsh-custom-font\\settings.json',
        error: null,
      }),
    };
  }
  return { ok: false, status: 404, json: async () => ({}) };
};

const flush = () => new Promise((resolve) => process.nextTick(resolve));

/* ── 加载被测模块 ─────────────────────────────────────────────── */

await import('../client/client.js?t=' + Date.now());
const entry = globalThis.__loaded;
/**
 * 最小 React 桩。
 * 关键：真 React 是「组件函数返回元素树 → 提交 DOM → 执行 effect」。
 * effect 必须**在 ref 挂好之后同步执行**，否则面板永远不会构建，
 * 测出来的是"什么都没渲染"，而不是"渲染得对不对"。
 */
const ReactStub = {
  useRef: (init) => ({ current: init ?? null }),
  useState: (init) => [init, () => {}],
  useEffect: (fn) => { globalThis.__pendingEffects.push(fn); },
  createElement: (tag, props, ...rest) => {
    if (typeof tag === 'function') {
      const tree = tag(props ?? {});
      const pending = globalThis.__pendingEffects.splice(0);
      for (const effect of pending) effect();
      return tree;
    }
    const node = makeElement(tag);
    if (props) {
      if (props.className) node.className = props.className;
      if (props.ref) props.ref.current = node;
      if (props.text) node.textContent = props.text;
      if (props.value !== undefined) node.value = props.value;
      if (props.type) node.type = props.type;
      if (props.href) node.setAttribute('href', props.href);
    }
    for (const child of rest.flat()) {
      if (child === null || child === undefined || child === false) continue;
      if (typeof child === 'string' || typeof child === 'number') {
        const text = makeElement('span');
        text.textContent = String(child);
        node.appendChild(text);
      } else {
        node.appendChild(child);
      }
    }
    return node;
  },
};
globalThis.__pendingEffects = [];
const mod = entry.factory((name) => {
  if (name === 'react') return ReactStub;
  throw new Error(`未预期的 require("${name}")`);
});
const internals = mod.__internals;
const css = (overrides = {}) => internals.buildCss({ ...internals.DEFAULTS, ...overrides });
const styleTag = () => created.find((n) => n.tagName === 'STYLE' && n.attributes.get('data-plugin') === 'dsh-custom-font');
/** 收集某个节点树里的全部文本（含它自己）。 */
function collectTexts(root) {
  const texts = [];
  walk(root, (node) => { if (node.textContent) texts.push(node.textContent); });
  return texts;
}

/** 收集文本，但跳过某个子树 —— 用来验证"这一项不在基础页、只在高级设置里"。 */
function collectTextsSkipping(root, skip) {
  const texts = [];
  const visit = (node) => {
    if (node === skip) return;
    if (node.textContent) texts.push(node.textContent);
    for (const child of node.children ?? []) visit(child);
  };
  visit(root);
  return texts;
}

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

/* ── 规范实现：逐条对着《统一排版规范》v1.3 C 部分 ─────────────── */

await test('默认值就是规范值：正文 16px / 400、色 #000、西文在前', () => {
  const rules = css();
  const bodyRule = /p, li, td, blockquote \{[\s\S]*?\}/.exec(rules)[0];
  assert.match(bodyRule, /font-family: "STIX2Text", "STIXTwoText", "仿宋_GB2312", "FangSong_GB2312", "仿宋", serif !important;/,
    '西文在前、中文在后，且仿宋_GB2312 带简写回落');
  assert.match(bodyRule, /font-size: 16px !important;/);
  assert.match(bodyRule, /font-weight: 400 !important;/);
  assert.match(rules, /--dsw-alias-label-primary: #000000 !important;/);
});

await test('一级标题：小标宋 22px、不加粗、居中', () => {
  const rules = css();
  // 注意：基础规则是 "h1, h2, h3, h4, h5, h6 {"，要抓的是**单独一条 h1 规则**（带 font-family 那条）。
  const h1 = /(?:^|\n)h1 \{\n  font-family: [^\n]+\n  font-size: [^\n]+\n  font-weight: [^\n]+\n\}/.exec(rules);
  assert.ok(h1, '应当有单独一条 h1 规则');
  assert.match(h1[0], /"方正小标宋简体", "FZXiaoBiaoSong-B05S", serif !important;/, 'h1 应当用小标宋（衬线兜底）');
  assert.match(h1[0], /font-size: 22px !important;/);
  assert.match(h1[0], /font-weight: 400 !important;/, '规范要求不加粗');
  assert.match(rules, /h1 \{\n  text-align: center !important;\n\}/);
});

await test('二~六级标题：黑体/楷体/仿宋 + 18px + 900', () => {
  const rules = css();
  const h2 = /h2 \{[\s\S]*?\}/.exec(rules)[0];
  const h3 = /h3 \{[\s\S]*?\}/.exec(rules)[0];
  const h4 = /h4 \{[\s\S]*?\}/.exec(rules)[0];
  const h6 = /h6 \{[\s\S]*?\}/.exec(rules)[0];
  assert.match(h2, /"黑体", "SimHei", sans-serif !important;/);
  assert.match(h2, /font-size: 18px !important;/);
  assert.match(h2, /font-weight: 900 !important;/);
  assert.match(h3, /"楷体_GB2312", "KaiTi_GB2312", "楷体", serif !important;/);
  assert.match(h3, /font-weight: 900 !important;/);
  assert.match(h4, /"仿宋_GB2312", "FangSong_GB2312", "仿宋", serif !important;/);
  assert.match(h6, /font-size: 18px !important;/);
});

await test('代码：Latin Modern Mono Light，行内代码有 GitHub 灰底', () => {
  const rules = css();
  assert.match(rules, /--ds-font-family-code: "Latin Modern Mono Light", "LMMonoLt10-Regular", monospace !important;/);
  assert.match(rules, /background-color: #f3f4f4 !important;/);
  assert.match(rules, /border: 1px solid #e7eaed !important;/);
});

await test('引用块：斜体 + 左侧 2px 竖线 #a2a9b1', () => {
  const rules = css();
  assert.match(rules, /blockquote \{[\s\S]*?font-style: italic !important;[\s\S]*?\}/);
  assert.match(rules, /border-left: 2px solid #a2a9b1 !important;/);
});

await test('链接：作者推荐的 DeepSeek 蓝（#4D6BFE / 悬停 #2E4FD8）；深色模式自动换亮蓝', () => {
  const rules = css();
  assert.match(rules, /body:not\(\[data-ds-dark-theme\]\) a,\nbody:not\(\[data-ds-dark-theme\]\) a:visited \{\n  color: #4D6BFE !important;/);
  assert.match(rules, /body:not\(\[data-ds-dark-theme\]\) a:hover \{\n  color: #2E4FD8 !important;/);
  assert.match(rules, /body\[data-ds-dark-theme\] a,/);
  assert.equal(/#a00|#c00|#ff8a80/.test(rules), false, '不该再出现旧的红链接色');
});

await test('表格：表头黑体 700、深底浅字、边框 #a2a9b1', () => {
  const rules = css();
  const th = /table th \{[\s\S]*?\}/.exec(rules)[0];
  assert.match(th, /font-weight: 700 !important;/);
  assert.match(th, /background: #575c61 !important;/);
  assert.match(th, /color: #f3f3f3 !important;/);
  assert.match(rules, /border: 1px solid #a2a9b1 !important;/);
});

await test('正文两端对齐', () => {
  assert.match(css(), /p, li \{\n  text-align: justify !important;\n\}/);
});

/* ── 数字跟随西文（本次新增的明确保证） ─────────────────────────
 * 原理：CSS 的 font-family 是"从左往右找第一个能显示该字符的字体"。
 * 仿宋等中文字体**也含数字字形**，所以只要把西文字体写在前面，数字就会用西文字体；
 * 一旦顺序反了，数字会悄悄变成中文宋体的样式，而且很难看出来。
 * 因此这里对**每一条**字体规则都断言顺序，而不是抽查一条。
 */
await test('数字跟随西文：所有字体规则里西文字体都排在中文前面', () => {
  const rules = css();
  // 抓出所有 font-family 声明
  const families = [...rules.matchAll(/font-family: ([^;]+) !important;/g)].map((m) => m[1]);
  assert.ok(families.length >= 8, `应当有多条字体规则，实际 ${families.length} 条`);

  const latinFirst = [
    ['"STIX2Text"', '"仿宋_GB2312"'],
    ['"STIX2Text"', '"黑体"'],
    ['"STIX2Text"', '"楷体_GB2312"'],
    ['"STIX2Text"', '"方正小标宋简体"'],
  ];
  const bodyRule = families.find((f) => f.includes('仿宋_GB2312') && f.includes('STIX2Text'));
  assert.ok(bodyRule, '正文规则里应当同时有西文与中文字体');
  assert.ok(bodyRule.indexOf('"STIX2Text"') < bodyRule.indexOf('"仿宋_GB2312"'),
    `正文字体栈里西文必须在中文前面（否则数字会变成中文宋体的样式）：${bodyRule}`);

  // 逐个标题层级也检查
  for (const level of ['h1', 'h2', 'h3', 'h4']) {
    const rule = new RegExp(`(?:^|\\n)${level} \\{\\n  font-family: ([^;]+) !important;`).exec(rules);
    assert.ok(rule, `${level} 应当有字体规则`);
    const stack = rule[1];
    if (stack.includes('STIX2Text') && stack.includes('仿宋_GB2312')) {
      assert.ok(stack.indexOf('"STIX2Text"') < stack.indexOf('"仿宋_GB2312"'), `${level} 的顺序反了：${stack}`);
    }
  }
  void latinFirst;
});

await test('数字跟随西文：换个西文字体，顺序依然正确（不是写死的）', () => {
  const rules = css({ bodyFontEn: 'Georgia', bodyFont: '仿宋' });
  const body = /p, li, td, blockquote \{\n  font-family: ([^;]+) !important;/.exec(rules)[1];
  assert.ok(body.indexOf('"Georgia"') < body.indexOf('"仿宋"'), `换成 Georgia 后顺序仍应正确：${body}`);
});

await test('关掉某个开关后，对应的 CSS 规则就消失（开关真的在起作用）', () => {
  assert.equal(/text-align: center/.test(css({ h1Center: false })), false);
  assert.equal(/border-left: 2px solid/.test(css({ quoteBar: false })), false);
  assert.equal(/background-color: #f3f4f4/.test(css({ inlineCodeBg: false })), false);
  assert.equal(/table th/.test(css({ tableHeader: false })), false);
  assert.equal(/justify/.test(css({ justifyBody: false })), false);
  assert.equal(/color: #a00/.test(css({ linkColorOn: false })), false);
});

await test('改字号立刻反映到 CSS（所见即所得）', () => {
  assert.match(css({ bodySize: 20 }), /p, li, td, blockquote \{[\s\S]*?font-size: 20px !important;/);
  assert.match(css({ bodySize: 999 }), /font-size: 72px !important;/, '越界值应被夹住，不该生成无效 CSS');
  assert.match(css({ bodySize: 1 }), /font-size: 8px !important;/);
});

await test('非法颜色值回落到默认，不会生成坏 CSS', () => {
  const rules = css({ bodyColor: 'javascript:alert(1)' });
  assert.equal(/javascript:/.test(rules), false);
  assert.match(css({ linkColor: 'red; } body { display:none' }), /color: #4D6BFE !important;/, '注入尝试应被拒绝并回落');
});

await test('界面文字跟随正文：--dsw-font-family 被指到正文栈', () => {
  assert.match(css({ uiFollow: true }), /--dsw-font-family: "STIX2Text", "STIXTwoText", "仿宋_GB2312"[^;]*serif !important;/);
  assert.equal(/--dsw-font-family/.test(css({ uiFollow: false, uiOn: false })), false);
});

await test('模块加载即注入样式，且不需要打开设置页', async () => {
  await flush();
  const style = styleTag();
  assert.ok(style, '应当在 <head> 里注入 <style data-plugin="dsh-custom-font">');
  assert.match(style.textContent, /dsh-custom-font（作者推荐版）/);
});

/* ── 设置链路 ─────────────────────────────────────────────────── */

await test('启动时向宿主要设置（不靠 localStorage 单打独斗）', async () => {
  await flush();
  assert.ok(fetchCalls.some((call) => call.url.startsWith('/dsh-custom-font/settings')), '应当 GET 一次宿主设置');
});

await test('首次运行：localStorage 为空时，不会凭空把默认值写进宿主文件', async () => {
  await flush();
  await new Promise((resolve) => realSetTimeout(resolve, 0));
  assert.equal(serverSettings, null, '没改过任何设置就不该落盘');
});

await test('宿主文件里有设置时，以宿主为准（换壳后设置跟人走）', async () => {
  serverSettings = { bodySize: 19, h1Center: false };
  const registrations = [];
  mod.apply({ slots: { inject: (name, produce) => registrations.push({ name, value: produce() }), register: (spec, factory) => ({ spec, factory }) } });
  assert.equal(registrations.length, 1);
  const panel = registrations[0].value.factory();
  await flush();
  await flush();
  const settings = internals.getSettings();
  assert.equal(settings.bodySize, 19, '应当从宿主文件读到 bodySize');
  assert.equal(settings.h1Center, false);
  assert.ok(panel, '面板应当被渲染');
});

await test('改设置 → 立刻写 localStorage，并（延迟）写回宿主文件', async () => {
  const before = postCount;
  serverSettings = { ...serverSettings };
  const registrations = [];
  mod.apply({ slots: { inject: (name, produce) => registrations.push({ name, value: produce() }), register: (spec, factory) => ({ spec, factory }) } });
  const panel = registrations[0].value.factory();
  await flush();

  const sizeInput = findIn(panel, "input[type='number']");
  assert.ok(sizeInput, '面板里应当有字号输入框');
  sizeInput.value = '17';
  sizeInput.handlers.input({ target: sizeInput });
  assert.equal(JSON.parse(store.get('dsh-custom-font/settings')).bodySize, 17, 'localStorage 应当立刻更新（刷新不丢）');

  // 延迟写回：跑掉插件安排的定时器
  const timers = globalThis.__timers.splice(0);
  for (const timer of timers) timer.fn();
  await flush();
  assert.equal(postCount > before, true, '应当 POST 回宿主文件');
  assert.equal(serverSettings.bodySize, 17);
});

await test('基础页能看到关键项，且版式项**不在**基础页（按用户要求收进高级设置）', async () => {
  const registrations = [];
  mod.apply({ slots: { inject: (name, produce) => registrations.push({ name, value: produce() }), register: (spec, factory) => ({ spec, factory }) } });
  const panel = registrations[0].value.factory();
  await flush();
  const texts = collectTexts(panel);
  for (const label of ['应用作者推荐', '恢复插件默认值', '导出设置', '导入设置', '高级设置']) {
    assert.equal(texts.includes(label), true, `基础页上应当有「${label}」`);
  }
  // 高级设置默认收起：版式项虽然渲染了，但必须落在 .adv-area 里
  const advArea = findIn(panel, '.adv-area');
  assert.ok(advArea, '应当有高级设置区域');
  const outsideTexts = collectTextsSkipping(panel, advArea);
  const advTexts = collectTexts(advArea);
  for (const label of ['正文两端对齐', '一级标题居中', '引用块左侧 2px 竖线 #a2a9b1', '链接使用自定义颜色', '作者推荐的版式']) {
    assert.equal(advTexts.some((t) => t === label || t.includes(label)), true, `「${label}」应当在高级设置里`);
    assert.equal(outsideTexts.includes(label), false, `「${label}」不该出现在基础页`);
  }
  assert.equal(texts.some((t) => t.includes('设置保存在这里')), true, '应当告诉用户设置存哪（换壳不丢）');
});

await test('点「应用作者推荐」：把作者推荐值写进设置并落盘', async () => {
  const before = postCount;
  serverSettings = {};
  internals.setSettings({ ...internals.DEFAULTS, bodySize: 30, bodyFont: '宋体' });
  const registrations = [];
  mod.apply({ slots: { inject: (name, produce) => registrations.push({ name, value: produce() }), register: (spec, factory) => ({ spec, factory }) } });
  const panel = registrations[0].value.factory();
  await flush();
  const specBtn = findIn(panel, 'button.primary');
  assert.ok(specBtn, '应当有应用作者推荐的按钮');
  assert.equal(specBtn.textContent, '应用作者推荐');
  specBtn.handlers.click({ target: specBtn });
  await flush();

  const settings = internals.getSettings();
  assert.equal(settings.bodyFont, '仿宋_GB2312');
  assert.equal(settings.bodyFontEn, 'STIX2Text');
  assert.equal(settings.bodySize, 16);
  assert.equal(settings.h1Font, '方正小标宋简体');
  assert.equal(settings.h1Size, 22);
  assert.equal(settings.h1Weight, 400);
  assert.equal(settings.codeFont, 'Latin Modern Mono Light');
  assert.equal(settings.linkColor, '#4D6BFE', '作者推荐的链接色是 DeepSeek 蓝');
  assert.equal(settings.linkColorHover, '#2E4FD8');
  assert.equal(postCount > before, true, '应当写回宿主文件');
  assert.equal(serverSettings.bodyFont, '仿宋_GB2312');

  // 复位，别影响后续用例
  internals.setSettings({ ...internals.DEFAULTS });
});

await test('链接红 → DeepSeek 蓝：一次性迁移（只动这一个字段）', async () => {
  // 每次都用"新加载的模块自己的内部视图"来断言，避免和主模块实例的 settings 混淆。
  const loadFresh = async (tag) => {
    delete globalThis.__loaded;
    await import(`../client/client.js?${tag}=${Date.now()}`);
    const loaded = globalThis.__loaded.factory((name) => {
      if (name === 'react') return ReactStub;
      throw new Error(`未预期的 require("${name}")`);
    });
    return loaded.__internals;
  };

  // ① 造一份"老设置"：链接是旧红，字号是用户自己调过的 21
  const legacy = { bodySize: 21, linkColor: '#a00', linkColorHover: '#c00', bodyFont: '仿宋' };
  store.set('dsh-custom-font/settings', JSON.stringify(legacy));
  serverSettings = legacy;
  const migrated = await loadFresh('migrate');
  await flush();
  await flush();
  assert.equal(migrated.getSettings().linkColor, '#4D6BFE', '旧红应当迁成 DeepSeek 蓝');
  assert.equal(migrated.getSettings().linkColorHover, '#2E4FD8');
  assert.equal(migrated.getSettings().bodySize, 21, '用户自己调过的字号必须原样保留');
  assert.equal(migrated.getSettings().bodyFont, '仿宋', '其余设置一个字都不该动');

  // ② 已经是蓝的再加载一次：不该被改坏
  store.set('dsh-custom-font/settings', JSON.stringify({ linkColor: '#4D6BFE' }));
  const again = await loadFresh('migrate2');
  assert.equal(again.getSettings().linkColor, '#4D6BFE');

  // ③ 用户自己选的红（不在旧默认值列表里）不该被改
  const customRed = { linkColor: '#b00020' };
  store.set('dsh-custom-font/settings', JSON.stringify(customRed));
  serverSettings = customRed; // 宿主文件里也是这个值（换壳前的真实状态）
  const custom = await loadFresh('migrate3');
  // 宿主同步是异步的，断言前必须让它落地（这也正是"宿主文件优先"生效的时刻）
  await flush();
  await flush();
  assert.equal(custom.getSettings().linkColor, '#b00020', '用户自定义的红色不该被迁移改动');
  serverSettings = null;

  store.delete('dsh-custom-font/settings');
});

await test('导入设置：只接受认识的键与正确类型，导完立刻生效并落盘', async () => {
  globalThis.FileReader = class FileReader {
    readAsText(file) { this.result = file.__text; queueMicrotask(() => this.onload()); }
  };
  const before = postCount;
  const registrations = [];
  mod.apply({ slots: { inject: (name, produce) => registrations.push({ name, value: produce() }), register: (spec, factory) => ({ spec, factory }) } });
  const panel = registrations[0].value.factory();
  await flush();

  const importBtn = findAllIn(panel, 'button').find((b) => b.textContent === '导入设置');
  findIn(panel, "input[type='file']").files = [{ __text: JSON.stringify({ bodySize: 21, 未知键: 1, h1Center: 'no' }) }];
  findIn(panel, "input[type='file']").handlers.change({ target: findIn(panel, "input[type='file']") });
  await flush();

  const settings = internals.getSettings();
  assert.equal(settings.bodySize, 21, '合法值应当导入');
  assert.equal(settings.h1Center, true, '类型不对的项应当被忽略（保持原值）');
  assert.equal('未知键' in settings, false);
  assert.equal(postCount > before, true, '导入后应当落盘');
  void importBtn;
  internals.setSettings({ ...internals.DEFAULTS });
});

/**
 * 重新加载一份干净的客户端模块（每个用例用自己的实例，互不干扰内部状态）。
 * 注意：模块加载时会异步问宿主设置，调用方需要自己 flush。
 */
async function loadFreshModule() {
  return loadFreshModuleWithAutoLoad(true);
}

/**
 * 重新加载一份干净的客户端模块。
 * @param {boolean} autoLoad - 是否允许模块加载时自动拉取内置字体。
 *   测"没加载时的行为"必须传 false，否则模块自己在后台就把它加载了。
 */
async function loadFreshModuleWithAutoLoad(autoLoad) {
  delete globalThis.__loaded;
  globalThis.window.__DSH_CUSTOM_FONT_NO_EMBEDDED__ = !autoLoad;
  await import(`../client/client.js?fresh=${Date.now()}-${Math.round(Math.random() * 1e6)}`);
  globalThis.window.__DSH_CUSTOM_FONT_NO_EMBEDDED__ = true;
  return globalThis.__loaded.factory((name) => {
    if (name === 'react') return ReactStub;
    throw new Error(`未预期的 require("${name}")`);
  });
}

/* ── 热重载 / 状态文本 ─────────────────────────────────────────── */

await test('字体库读回来后：状态行报数量，并说清推荐字体由谁提供', async () => {
  const registrations = [];
  mod.apply({ slots: { inject: (name, produce) => registrations.push({ name, value: produce() }), register: (spec, factory) => ({ spec, factory }) } });
  const panel = registrations[0].value.factory();
  await flush();
  await flush();
  const statusText = findIn(panel, '.font-status-text');
  assert.ok(statusText, '应当有字体状态文本');
  assert.match(statusText.textContent, /已读取 \d+ 个系统字体/);
  // 测试用的系统字体清单里没有 STIX2Text / Latin Modern Mono Light → 必须明确说清由内置字体接管
  assert.match(statusText.textContent, /已由插件内置字体接管/);
});

await test('样式热重载：旧 <style> 在页面里时也要替换内容（不是"有就跳过"）', async () => {
  const style = styleTag();
  style.textContent = 'OLD-CSS';
  internals.setSettings({ ...internals.DEFAULTS, bodySize: 23 });
  // 重新加载模块 = 模拟插件升级后的新代码
  await import('../client/client.js?reload=' + Date.now());
  const reloaded = globalThis.__loaded.factory((name) => {
    if (name === 'react') return ReactStub;
    throw new Error(`未预期的 require("${name}")`);
  });
  reloaded.__internals.setSettings({ ...internals.DEFAULTS, bodySize: 23 });
  reloaded.apply({});
  assert.notEqual(style.textContent, 'OLD-CSS', '应当替换旧样式内容');
  assert.match(style.textContent, /font-size: 23px !important;/);
  internals.setSettings({ ...internals.DEFAULTS });
});

/* ── 内置字体（解决"用户电脑没装推荐字体"） ───────────────────── */

await test('内置字体未加载时：CSS 里没有 @font-face（不假装有）', async () => {
  // 用干净实例 + 关掉自动加载：这才是"真的没加载"的前提
  const mod0 = await loadFreshModuleWithAutoLoad(false);
  const internal = mod0.__internals;
  await flush();
  internal.setSettings({ ...internal.DEFAULTS, embeddedFonts: true });
  assert.equal(internal.embedded.state === 'ready', false, '这个实例不该已经加载过内置字体');
  assert.equal(/@font-face/.test(internal.buildCss(internal.getSettings())), false);
});

await test('内置字体已加载时：CSS 顶部出现 @font-face，两套字体的变体齐全', async () => {
  const mod2 = await loadFreshModule();
  const internal = mod2.__internals;
  await flush();
  internal.setSettings({ ...internal.DEFAULTS, embeddedFonts: true });
  const loaded = await internal.ensureEmbeddedFonts(true);
  await flush();
  assert.equal(loaded, true, '应当加载成功');
  assert.equal(internal.embedded.state, 'ready');

  const rules = internal.buildCss(internal.getSettings());
  const faces = rules.match(/@font-face \{/g) ?? [];
  assert.equal(faces.length, 7, 'STIX2Text 4 个变体 + Latin Modern 3 个变体');
  assert.match(rules, /font-style: italic;\n  font-weight: 400;\n  font-family: "STIX2Text";/);
  assert.match(rules, /font-style: normal;\n  font-weight: 400;\n  font-family: "Latin Modern Mono Light";/);
  assert.match(rules, /font-display: swap;/, '字体没到之前先用后备字体显示，别让正文空着');
  assert.match(rules, /src: url\("blob:stub/);
  const faceIndex = rules.indexOf('@font-face');
  const rootIndex = rules.indexOf(':root {');
  assert.ok(faceIndex >= 0 && faceIndex < rootIndex, '@font-face 应当排在 :root 之前');
});

await test('关掉内置字体后：@font-face 消失，字体名照样写进 CSS（回落到系统字体）', async () => {
  const mod3 = await loadFreshModule();
  const internal = mod3.__internals;
  await flush();
  internal.setSettings({ ...internal.DEFAULTS, embeddedFonts: false });
  await internal.ensureEmbeddedFonts(true);
  const rules = internal.buildCss(internal.getSettings());
  assert.equal(/@font-face/.test(rules), false, '关掉后不该再注入内置字体');
  assert.match(rules, /"STIX2Text"/, '字体名照旧写在栈里，交给系统字体去匹配');
});

await test('内置字体加载失败时：状态变成 error 并记下原因，CSS 不受影响', async () => {
  const mod4 = await loadFreshModule();
  const internal = mod4.__internals;
  await flush();
  const realFetch = globalThis.fetch;
  globalThis.fetch = async (url, options) => {
    if (String(url).startsWith('/dsh-custom-font/font-manifest')) throw new Error('模拟断网');
    return realFetch(url, options);
  };
  internal.setSettings({ ...internal.DEFAULTS, embeddedFonts: true });
  const ok = await internal.ensureEmbeddedFonts(true);
  assert.equal(ok, false);
  assert.equal(internal.embedded.state, 'error');
  assert.match(internal.embedded.error, /模拟断网/);
  assert.equal(/@font-face/.test(internal.buildCss(internal.getSettings())), false);
  globalThis.fetch = realFetch;
});

await test('高级设置里有内置字体开关，且说明当前状态', async () => {
  const mod5 = await loadFreshModule();
  const internal = mod5.__internals;
  await flush();
  internal.setSettings({ ...internal.DEFAULTS, embeddedFonts: true });
  await internal.ensureEmbeddedFonts(true);
  const registrations = [];
  mod5.apply({ slots: { inject: (name, produce) => registrations.push({ name, value: produce() }), register: (spec, factory) => ({ spec, factory }) } });
  const panel = registrations[0].value.factory();
  await flush();
  const advArea = findIn(panel, '.adv-area');
  const advTexts = collectTexts(advArea);
  assert.equal(advTexts.some((t) => t.includes('内置字体')), true, '高级设置里应当有内置字体一节');
  assert.equal(advTexts.some((t) => t.includes('使用插件内置字体')), true, '应当有开关文案');
  assert.equal(advTexts.some((t) => t.includes('已加载 7 个内置字体文件')), true, `应当报告已加载数量：${advTexts.filter((t) => t.includes('内置')).join(' | ')}`);
  assert.equal(advTexts.some((t) => t.includes('不写注册表、不装进系统')), true, '应当说明不会碰用户系统');
});

console.log(failures === 0 ? '\n全部通过' : `\n失败 ${failures} 项`);
process.exit(failures === 0 ? 0 : 1);
