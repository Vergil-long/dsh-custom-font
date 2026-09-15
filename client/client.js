window.__ModuleLoader__.load({
  id: "dsh-custom-font",
  factory: (require) => {
    var module = { exports: {} };
    var exports = module.exports;
    Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });

    // react 由宿主平台模块表提供（和 dshmarket 一样）
    var React = null;
    try { React = require("react"); } catch (e) { React = null; }

    /* ================= 常量 ================= */
    // 老键名保持不变：老用户 localStorage 里的设置要能被读出来（升级不丢设置）。
    var STORAGE_KEY = "dsh-custom-font/settings";
    var SETTINGS_API = "/dsh-custom-font/settings";
    var EXPORT_API = "/dsh-custom-font/settings/export";
    var FONTS_API = "/dsh-custom-font/fonts";
    var MANIFEST_API = "/dsh-custom-font/font-manifest";

    /* ================= 默认配置 ================= */
    // 这是一套「作者推荐」的排版：中文仿宋体系 + 西文 STIX2Text，公文/学术观感。
    // 它只是**起点**，不是规定——任何一项都能在设置页里改掉，改完就按你的来。
    var DEFAULTS = {
      // 正文：西文 STIX2Text，中文 仿宋_GB2312 → 仿宋，16px，行高 1.5
      bodyFont: "仿宋_GB2312",
      bodyFontEn: "STIX2Text",
      bodySize: 16,
      bodyWeight: 400,
      bodyColor: "#000000",
      // 标题（基础）：作者推荐里各级不同，这里放"未单独设置时"的兜底值
      headingFont: "黑体",
      headingFontEn: "STIX2Text",
      headingSize: 18,
      headingWeight: 900,
      // 代码：Latin Modern Mono Light
      codeFont: "Latin Modern Mono Light",
      codeSize: 15,
      codeWeight: 400,
      // 界面文字：跟随正文
      uiFollow: true,
      // 作者推荐的版式（不是"字体"的那些要求）
      justifyBody: true,
      h1Center: true,
      h1NoBold: true,
      quoteItalic: true,
      quoteBar: true,
      linkColorOn: true,
      // 链接用 DeepSeek 蓝（#4D6BFE），不用传统公文红——红链接在深色界面里太扎眼
      linkColor: "#4D6BFE",
      linkColorHover: "#2E4FD8",
      inlineCodeBg: true,
      tableHeader: true,
      // 内置字体：插件自带 STIX2Text / Latin Modern Mono Light，
      // 用户电脑没装这两套字体时也能看到作者推荐的排版（不碰用户系统）
      embeddedFonts: true,
      // 高级：逐级标题（作者推荐：h1 小标宋 22 不加粗居中；h2 黑体 18/900；h3 楷体 18/900；h4~h6 仿宋 18/900）
      h1On: true, h1Font: "方正小标宋简体", h1FontEn: "STIX2Text", h1Size: 22, h1Weight: 400,
      h2On: true, h2Font: "黑体", h2FontEn: "STIX2Text", h2Size: 18, h2Weight: 900,
      h3On: true, h3Font: "楷体_GB2312", h3FontEn: "STIX2Text", h3Size: 18, h3Weight: 900,
      h4On: true, h4Font: "仿宋_GB2312", h4FontEn: "STIX2Text", h4Size: 18, h4Weight: 900,
      h5On: true, h5Font: "仿宋_GB2312", h5FontEn: "STIX2Text", h5Size: 18, h5Weight: 900,
      h6On: true, h6Font: "仿宋_GB2312", h6FontEn: "STIX2Text", h6Size: 18, h6Weight: 900,
      // 高级：其他元素
      quoteOn: false, quoteFont: "仿宋_GB2312", quoteFontEn: "STIX2Text", quoteSize: 16, quoteWeight: 400,
      codeInlineOn: true, codeInlineFont: "等线", codeInlineFontEn: "Latin Modern Mono Light", codeInlineSize: 14, codeInlineWeight: 400,
      codeBlockOn: true, codeBlockFont: "等线", codeBlockFontEn: "Latin Modern Mono Light", codeBlockSize: 14, codeBlockWeight: 400,
      uiOn: false, uiFont: "微软雅黑", uiFontEn: "Segoe UI", uiSize: 16, uiWeight: 500
    };

    /** 一键应用「作者推荐」：作者为安装本插件的用户推荐的一套排版。 */
    var SPEC = {
      bodyFont: "仿宋_GB2312",
      headingFont: "黑体",
      codeFont: "Latin Modern Mono Light",
      bodySize: 16, bodyWeight: 400, bodyColor: "#000000",
      justifyBody: true, h1Center: true, h1NoBold: true,
      quoteItalic: true, quoteBar: true,
      linkColorOn: true, linkColor: "#4D6BFE", linkColorHover: "#2E4FD8",
      inlineCodeBg: true, tableHeader: true,
      h1On: true, h1Font: "方正小标宋简体", h1Size: 22, h1Weight: 400,
      h2On: true, h2Font: "黑体", h2Size: 18, h2Weight: 900,
      h3On: true, h3Font: "楷体_GB2312", h3Size: 18, h3Weight: 900,
      h4On: true, h4Font: "仿宋_GB2312", h4Size: 18, h4Weight: 900,
      h5On: true, h5Font: "仿宋_GB2312", h5Size: 18, h5Weight: 900,
      h6On: true, h6Font: "仿宋_GB2312", h6Size: 18, h6Weight: 900,
      quoteOn: false,
      codeInlineOn: true, codeInlineSize: 14, codeInlineFont: "等线", codeInlineFontEn: "Latin Modern Mono Light",
      codeBlockOn: true, codeBlockSize: 14, codeBlockFont: "等线", codeBlockFontEn: "Latin Modern Mono Light"
    };

    /** 旧版用过的链接红（在深色界面里扎眼）；随首次升级迁移到 DeepSeek 蓝。 */
    var LEGACY_LINK_RED = { "#a00": 1, "#aa0000": 1, "#c00": 1, "#cc0000": 1 };

    var WEIGHTS = [
      { label: "常规 (400)", value: 400 },
      { label: "略粗 (500)", value: 500 },
      { label: "半粗 (600)", value: 600 },
      { label: "加粗 (700)", value: 700 },
      { label: "特粗 (900)", value: 900 }
    ];

    /* ================= 字体名映射 ================= */
    // 内置兜底字体（读不到系统字体库时用）。name=显示名（中文优先），css=英文家族名。
    var FALLBACK_FONTS = [
      { name: "仿宋_GB2312", css: "FangSong_GB2312", alt: "仿宋" },
      { name: "楷体_GB2312", css: "KaiTi_GB2312", alt: "楷体" },
      { name: "方正小标宋简体", css: "FZXiaoBiaoSong-B05S" },
      { name: "仿宋", css: "FangSong" },
      { name: "楷体", css: "KaiTi" },
      { name: "黑体", css: "SimHei" },
      { name: "宋体", css: "SimSun" },
      { name: "微软雅黑", css: "Microsoft YaHei" },
      { name: "等线", css: "DengXian" },
      { name: "思源黑体", css: "Source Han Sans SC" },
      { name: "STIX2Text", css: "STIXTwoText" },
      { name: "STIX2Text Math", css: "STIXTwoMath" },
      { name: "Latin Modern Mono Light", css: "LMMonoLt10-Regular" },
      { name: "Times New Roman", css: "Times New Roman" },
      { name: "Consolas", css: "Consolas" },
      { name: "Segoe UI", css: "Segoe UI" },
      { name: "Arial", css: "Arial" },
      { name: "Georgia", css: "Georgia" },
      { name: "Cambria", css: "Cambria" },
      { name: "Courier New", css: "Courier New" }
    ];

    // 字体名 → { name, css, alt } 查找表：先装兜底，系统字体读回来后再合并进来。
    var fontMap = new Map();
    FALLBACK_FONTS.forEach(function (f) { fontMap.set(f.name, f); });

    // 系统字体状态：null=还没读，[]=读失败/非 Windows，数组=已读到。
    var systemFonts = null;
    var fontFetchPromise = null;
    /**
     * 系统字体**名字**集合（只装宿主真正返回的那些）。
     *
     * ⚠️ 不能拿 fontMap 来判断"系统有没有这个字体"：fontMap 里预装了内置兜底字体
     * （包括 STIX2Text / Latin Modern Mono Light），查它永远有、等于没查。
     */
    var systemFontNames = new Set();

    function clone(obj) { return JSON.parse(JSON.stringify(obj)); }

    /* ================= 设置：本地 + 宿主双向 ================= */
    /** 宿主端设置文件是否可用（null=未知，true/false=已知）。 */
    var hostStore = { available: null, path: "", error: null, source: "" };
    /** 启动时通知 UI 刷新（宿主设置读回来或写入失败时用）。 */
    var settingsListeners = [];

    function notifySettings() {
      settingsListeners.forEach(function (fn) { try { fn(); } catch (e) { /* 单个订阅者出错不影响别人 */ } });
    }

    function loadFromLocalStorage() {
      var s = clone(DEFAULTS);
      try {
        var raw = localStorage.getItem(STORAGE_KEY);
        if (raw) {
          var parsed = JSON.parse(raw);
          if (parsed && typeof parsed === "object") {
            Object.keys(DEFAULTS).forEach(function (k) {
              var v = parsed[k];
              if (typeof v === "string" || typeof v === "number" || typeof v === "boolean") s[k] = v;
            });
          }
        }
      } catch (e) { /* 读取失败则用默认值 */ }
      return s;
    }

    /**
     * 一次性迁移：把作者推荐里用过的**链接红**换成 DeepSeek 蓝。
     * 只动这一个字段、只在这个值确实是那两种红时动，其余设置一律不碰。
     */
    function migrateLinkColor(s) {
      var changed = false;
      var keys = ["linkColor", "linkColorHover"];
      keys.forEach(function (key) {
        var v = String(s[key] || "").trim().toLowerCase();
        if (LEGACY_LINK_RED[v]) {
          s[key] = key === "linkColor" ? SPEC.linkColor : SPEC.linkColorHover;
          changed = true;
        }
      });
      return changed;
    }

    function saveToLocalStorage(s) {
      try { localStorage.setItem(STORAGE_KEY, JSON.stringify(s)); } catch (e) { /* 忽略 */ }
    }

    // 先用 localStorage（同步、立刻可用），随后异步问宿主拿"真身"。
    var settings = loadFromLocalStorage();
    // 首次运行标记：localStorage 里没有、宿主文件也没有时，视为"刚装上"，不自动写文件。
    var hadLocal = (function () {
      try { return localStorage.getItem(STORAGE_KEY) !== null; } catch (e) { return false; }
    })();
    // 链接红 → DeepSeek 蓝 的一次性迁移（见 migrateLinkColor）。
    var linkColorMigrated = migrateLinkColor(settings);

    var saveTimer = null;

    function postSettings(patch) {
      if (typeof fetch !== "function") return;
      try {
        fetch(SETTINGS_API, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ settings: patch })
        }).then(function (r) {
          if (!r || !r.ok) throw new Error("HTTP " + (r ? r.status : "?"));
          hostStore.available = true;
          hostStore.error = null;
        }).catch(function (err) {
          hostStore.available = false;
          hostStore.error = String(err && err.message || err);
          notifySettings();
        });
      } catch (e) { /* 忽略 */ }
    }

    /** 保存：localStorage 立刻写，宿主文件延迟 400ms 合并写（避免拖滑块时打爆接口）。 */
    function commit(patch) {
      saveToLocalStorage(settings);
      if (patch) {
        var pending = Object.assign({}, patch);
        if (saveTimer) clearTimeout(saveTimer);
        saveTimer = setTimeout(function () { saveTimer = null; postSettings(pending); }, 400);
      }
    }

    /** 从宿主端拉设置。宿主文件优先；宿主没有文件时，把 localStorage 里的设置迁移上去。 */
    function syncFromHost() {
      if (typeof fetch !== "function") return;
      fetch(SETTINGS_API).then(function (r) { return r.json(); }).then(function (data) {
        if (!data || !data.ok) throw new Error((data && data.error) || "读取失败");
        hostStore.path = data.path || "";
        hostStore.source = data.source || "";
        if (data.settings && typeof data.settings === "object") {
          Object.keys(DEFAULTS).forEach(function (k) {
            if (k in data.settings) settings[k] = data.settings[k];
          });
          hostStore.available = true;
          hostStore.error = null;
          // 宿主文件里若是旧的链接红，也一并迁成 DeepSeek 蓝。
          if (migrateLinkColor(settings)) postSettings({ linkColor: settings.linkColor, linkColorHover: settings.linkColorHover });
          saveToLocalStorage(settings);
          applyCss();
          notifySettings();
          return;
        }
        // 宿主还没有文件：若 localStorage 里已有用户设置，就迁过去（只迁一次）。
        hostStore.available = true;
        if (hadLocal) postSettings(clone(settings));
        notifySettings();
      }).catch(function (err) {
        hostStore.available = false;
        hostStore.error = String(err && err.message || err);
        notifySettings();
      });
    }

    /* ================= 内置字体（解决"用户电脑没装推荐字体"） ================= */
    /**
     * 为什么要有这一段：
     *   作者推荐用的 STIX2Text / Latin Modern Mono Light 不是 Windows 自带字体。
     *   若只写字体名，用户电脑上没有时浏览器会**静默回退**——用户以为在用推荐排版，
     *   其实不是，而且界面上没有任何提示。
     *   插件自带这两套开源字体（WOFF，放在 assets/fonts，由宿主端按需返回），
     *   用 @font-face 直接喂给浏览器：任何电脑上效果一致，且**不碰用户系统**。
     */
    var embedded = {
      state: "idle",     // idle | loading | ready | off | error
      blobUrls: {},      // css 字体名 -> objectURL
      manifest: null,    // 宿主返回的字体清单
      missing: [],       // 宿主那边缺的文件（打包不完整时能看出来）
      error: null,
      waiters: [],
      promise: null,
      // 加载失败后的冷却时间戳：网络/宿主有问题时不至于每次开设置页都打一轮请求
      retryAfter: 0
    };

    function notifyEmbedded() {
      var list = embedded.waiters.splice(0);
      list.forEach(function (fn) { try { fn(); } catch (e) { /* 忽略 */ } });
    }

    /** 生成 @font-face 规则。字体名与字体内部名一致，所以普通字体名就能命中。 */
    function embeddedFontCss() {
      var lines = [];
      Object.keys(embedded.blobUrls).forEach(function (key) {
        var item = embedded.blobUrls[key];
        lines.push("/* 内置字体：" + item.family + " " + item.style + " " + item.weight + " */");
        lines.push("@font-face {");
        lines.push("  font-style: " + item.style + ";");
        lines.push("  font-weight: " + item.weight + ";");
        lines.push('  font-family: "' + item.family + '";');
        lines.push("  font-display: swap;");
        lines.push('  src: url("' + item.url + '") format("woff");');
        lines.push("}");
      });
      return lines.join("\n");
    }

    /** 数据已经准备好（或确定拿不到）了吗——UI 用它决定按钮状态。 */
    function embeddedReady() {
      return embedded.state === "ready" || embedded.state === "off" || embedded.state === "error";
    }

    /**
     * 确保内置字体已加载。
     * @param {boolean} [force] - 忽略冷却、强制重来（重新注入时用）。
     * @returns {Promise<boolean>}
     */
    function ensureEmbeddedFonts(force) {
      if (typeof fetch !== "function" || typeof URL === "undefined" || typeof URL.createObjectURL !== "function") {
        embedded.state = "error";
        embedded.error = "当前环境不支持加载内置字体";
        notifyEmbedded();
        return Promise.resolve(false);
      }
      if (embedded.state === "ready") return Promise.resolve(true);
      if (embedded.promise) return embedded.promise;
      if (!force && embedded.state === "error" && Date.now() < embedded.retryAfter) {
        return Promise.resolve(false);
      }
      embedded.state = "loading";
      embedded.error = null;
      embedded.promise = fetch(MANIFEST_API)
        .then(function (r) { return r.json(); })
        .then(function (data) {
          if (!data || !data.ok) throw new Error((data && data.error) || "清单读取失败");
          embedded.manifest = data;
          embedded.missing = Array.isArray(data.missing) ? data.missing : [];
          var fonts = Array.isArray(data.fonts) ? data.fonts : [];
          if (fonts.length === 0) throw new Error("内置字体清单是空的");
          return Promise.all(fonts.map(function (font) {
            return fetch(font.url)
              .then(function (r) {
                if (!r.ok) throw new Error(font.file + " 下载失败（HTTP " + r.status + "）");
                return r.blob();
              })
              .then(function (blob) { return { font: font, url: URL.createObjectURL(blob) }; });
          }));
        })
        .then(function (loaded) {
          // 旧的 objectURL 先释放，避免反复重载时泄漏
          Object.keys(embedded.blobUrls).forEach(function (key) {
            try { URL.revokeObjectURL(embedded.blobUrls[key].url); } catch (e) { /* 忽略 */ }
          });
          embedded.blobUrls = {};
          loaded.forEach(function (item) {
            var font = item.font;
            embedded.blobUrls[font.family + "|" + font.style + "|" + font.weight] = {
              family: font.family,
              weight: font.weight,
              style: font.style,
              url: item.url
            };
          });
          embedded.state = "ready";
          embedded.error = null;
          applyCss();
          notifyEmbedded();
          return true;
        })
        .catch(function (err) {
          embedded.state = "error";
          embedded.error = String(err && err.message || err);
          // 30 秒内不重复尝试（设置页反复开关时别打爆接口）
          embedded.retryAfter = Date.now() + 30000;
          notifyEmbedded();
          return false;
        })
        .then(function (ok) {
          embedded.promise = null;
          return ok;
        });
      return embedded.promise;
    }

    /* ================= 字体栈 ================= */
    function familyOf(name) {
      name = String(name == null ? "" : name).trim();
      if (!name) return [];
      // 用户直接输入了完整 font-family 栈（含逗号/引号），原样使用
      if (/[,"']/.test(name)) return [name];
      var f = fontMap.get(name);
      var parts = ['"' + name + '"'];
      if (f && f.css && f.css !== name) parts.push('"' + f.css + '"');
      // 中文名带了 GB2312 后缀时，补上系统里常见的同名简写，避免个别机器只装了其中一个
      var alt = f && f.alt;
      if (!alt && /_GB2312$/.test(name)) {
        var short = name.replace(/_GB2312$/, "");
        var sf = fontMap.get(short);
        alt = short;
        if (sf && sf.css && sf.css !== short) parts.push('"' + sf.css + '"');
      }
      if (alt && alt !== name) parts.push('"' + alt + '"');
      return parts;
    }

    function stackCJK(latin, cjk, generic) {
      var parts = [];
      familyOf(latin).forEach(function (p) { parts.push(p); });
      familyOf(cjk).forEach(function (p) { parts.push(p); });
      parts.push(generic);
      return parts.join(", ");
    }

    function stack(name, generic) {
      var parts = familyOf(name);
      if (parts.length === 0) return generic;
      parts.push(generic);
      return parts.join(", ");
    }

    function clampSize(n) {
      n = Number(n);
      if (!isFinite(n)) return 16;
      return Math.max(8, Math.min(72, Math.round(n)));
    }

    function clampWeight(n) {
      n = Number(n);
      if (!isFinite(n)) return 400;
      return Math.max(100, Math.min(900, n));
    }

    function safeColor(value, fallback) {
      var v = String(value == null ? "" : value).trim();
      if (/^#[0-9a-fA-F]{3,8}$/.test(v)) return v;
      if (/^rgba?\([0-9.,%\s/]+\)$/.test(v)) return v;
      return fallback;
    }

    /* ================= 生成 CSS ================= */
    var QUOTE_BAR = "#a2a9b1";
    var CODE_BG = "#f3f4f4";
    var CODE_BORDER = "#e7eaed";

    function pushRule(lines, selector, font, size, weight) {
      lines.push(selector + " {");
      lines.push("  font-family: " + font + " !important;");
      lines.push("  font-size: " + size + "px !important;");
      if (weight !== null && weight !== undefined) lines.push("  font-weight: " + weight + " !important;");
      lines.push("}");
    }

    // 界面文字的字号/字重：按 5 个层级（base/s/xs/xxs/xxxs）写入 --dsw-font-* 变量。
    function uiFontVars(lines, stackValue, size, weight) {
      var s = clampSize(size);
      var w = clampWeight(weight);
      [["base-16", 0], ["s-14", 2], ["xs-13", 3], ["xxs-12", 4], ["xxxs-11", 5]].forEach(function (t) {
        var px = Math.max(8, s - t[1]);
        lines.push("  --dsw-font-" + t[0] + ": " + w + " " + px + "px/" + Math.round(px * 1.5) + "px " + stackValue + " !important;");
      });
    }

    var HEADING_LEVELS = ["h1", "h2", "h3", "h4", "h5", "h6"];
    // 各级标题的后备字体族：一级是宋体系（衬线），二级黑体（无衬线），三~六级楷/仿宋（衬线）。
    var HEADING_GENERIC = { h1: "serif", h2: "sans-serif", h3: "serif", h4: "serif", h5: "serif", h6: "serif" };

    function headingStack(s, level) {
      var generic = HEADING_GENERIC[level] || "sans-serif";
      if (s[level + "On"]) {
        return stackCJK(s[level + "FontEn"] || s.headingFontEn, s[level + "Font"] || s.headingFont, generic);
      }
      return stackCJK(s.headingFontEn, s.headingFont, generic);
    }

    function buildCss(s) {
      var body = stackCJK(s.bodyFontEn, s.bodyFont, "serif");
      var code = stack(s.codeFont, "monospace");
      var uiStack = stackCJK(s.uiFontEn, s.uiFont, "sans-serif");
      var color = safeColor(s.bodyColor, "");

      var lines = [];
      lines.push("/* dsh-custom-font（作者推荐版）—— 由设置页自动生成，改设置即可，不用手改这里 */");

      // 内置字体的 @font-face 必须放在最前面
      if (s.embeddedFonts && embedded.state === "ready") {
        var face = embeddedFontCss();
        if (face) lines.push(face);
      }

      lines.push(":root {");
      if (s.uiOn) {
        lines.push("  --dsw-font-family: " + uiStack + " !important;");
        uiFontVars(lines, uiStack, s.uiSize, s.uiWeight);
      } else if (s.uiFollow) {
        lines.push("  --dsw-font-family: " + body + " !important;");
      }
      lines.push("  --ds-font-family-code: " + code + " !important;");
      lines.push("}");

      // 正文（段落 / 列表 / 表格单元格 / 引用）
      pushRule(lines, "p, li, td, blockquote", body, clampSize(s.bodySize), clampWeight(s.bodyWeight));
      // 标题（基础：未逐级自定义时的兜底，逐级规则在后面覆盖）
      pushRule(lines, "h1, h2, h3, h4, h5, h6",
        stackCJK(s.headingFontEn, s.headingFont, "sans-serif"),
        clampSize(s.headingSize), clampWeight(s.headingWeight));
      // 代码（基础）
      pushRule(lines, "code, kbd, samp", code, clampSize(s.codeSize), clampWeight(s.codeWeight));
      pushRule(lines, "pre, pre code", code, clampSize(s.codeSize), clampWeight(s.codeWeight));

      // —— 规范专属版式 ——
      if (s.justifyBody) {
        lines.push("p, li {");
        lines.push("  text-align: justify !important;");
        lines.push("}");
      }

      if (s.h1Center) {
        lines.push("h1 {");
        lines.push("  text-align: center !important;");
        lines.push("}");
      }
      if (s.h1NoBold) {
        // 小标宋本身就是标题体，再加粗会糊；规范要求不加粗
        lines.push("h1 {");
        lines.push("  font-weight: 400 !important;");
        lines.push("}");
      }

      if (s.quoteItalic || s.quoteBar) {
        lines.push("blockquote {");
        if (s.quoteItalic) lines.push("  font-style: italic !important;");
        if (s.quoteBar) {
          lines.push("  border-left: 2px solid " + QUOTE_BAR + " !important;");
          lines.push("  padding-left: 24px !important;");
        }
        lines.push("}");
      }

      if (s.linkColorOn) {
        var link = safeColor(s.linkColor, "#4D6BFE");
        var linkHover = safeColor(s.linkColorHover, "#2E4FD8");
        lines.push("body:not([data-ds-dark-theme]) a,");
        lines.push("body:not([data-ds-dark-theme]) a:visited {");
        lines.push("  color: " + link + " !important;");
        lines.push("}");
        lines.push("body:not([data-ds-dark-theme]) a:hover {");
        lines.push("  color: " + linkHover + " !important;");
        lines.push("}");
        // 深色模式：用户设的颜色往往太暗看不清，统一换成亮蓝（固定值，不跟着用户设的色走）
        lines.push("body[data-ds-dark-theme] a,");
        lines.push("body[data-ds-dark-theme] a:visited {");
        lines.push("  color: #7B96FF !important;");
        lines.push("}");
      }

      if (s.inlineCodeBg) {
        // 借鉴 GitHub 主题的行内代码样式；只上底色、不碰 font-size（那由上面的规则管）
        lines.push("code, kbd, samp {");
        lines.push("  background-color: " + CODE_BG + " !important;");
        lines.push("  border: 1px solid " + CODE_BORDER + " !important;");
        lines.push("  border-radius: 3px !important;");
        lines.push("  padding: 0 2px !important;");
        lines.push("}");
      }

      if (s.tableHeader) {
        lines.push("table th {");
        lines.push("  font-family: " + stackCJK(s.headingFontEn, s.headingFont, "sans-serif") + " !important;");
        lines.push("  font-weight: 700 !important;");
        lines.push("  background: #575c61 !important;");
        lines.push("  color: #f3f3f3 !important;");
        lines.push("  border-color: #333 !important;");
        lines.push("}");
        lines.push("table td {");
        lines.push("  background: transparent !important;");
        lines.push("}");
        lines.push("table th, table td {");
        lines.push("  border: 1px solid " + QUOTE_BAR + " !important;");
        lines.push("}");
      }

      if (color) {
        // 正文字色只在浅色模式生效，避免深色模式变黑字看不清
        lines.push("body:not([data-ds-dark-theme]) p,");
        lines.push("body:not([data-ds-dark-theme]) li,");
        lines.push("body:not([data-ds-dark-theme]) td,");
        lines.push("body:not([data-ds-dark-theme]) blockquote {");
        lines.push("  color: " + color + " !important;");
        lines.push("}");
        lines.push("body:not([data-ds-dark-theme]) {");
        lines.push("  --dsw-alias-label-primary: " + color + " !important;");
        lines.push("}");
      }

      // —— 高级覆盖（逐级标题 / 引用 / 行内代码 / 代码块 / 界面文字）——
      HEADING_LEVELS.forEach(function (lvl) {
        if (s[lvl + "On"]) {
          pushRule(lines, lvl, headingStack(s, lvl), clampSize(s[lvl + "Size"]), clampWeight(s[lvl + "Weight"]));
        }
      });
      if (s.quoteOn) {
        pushRule(lines, "blockquote", stackCJK(s.quoteFontEn, s.quoteFont, "serif"),
          clampSize(s.quoteSize), clampWeight(s.quoteWeight));
        // 引用块的字重规则写在版式规则之前会被覆盖，这里补回斜体/竖线
        if (s.quoteItalic) {
          lines.push("blockquote {");
          lines.push("  font-style: italic !important;");
          lines.push("}");
        }
        if (s.quoteBar) {
          lines.push("blockquote {");
          lines.push("  border-left: 2px solid " + QUOTE_BAR + " !important;");
          lines.push("  padding-left: 24px !important;");
          lines.push("}");
        }
      }
      if (s.codeInlineOn) {
        pushRule(lines, "code, kbd, samp",
          stackCJK(s.codeInlineFontEn, s.codeInlineFont, "monospace"),
          clampSize(s.codeInlineSize), clampWeight(s.codeInlineWeight));
      }
      if (s.codeBlockOn) {
        pushRule(lines, "pre, pre code",
          stackCJK(s.codeBlockFontEn, s.codeBlockFont, "monospace"),
          clampSize(s.codeBlockSize), clampWeight(s.codeBlockWeight));
      }
      if (s.uiOn) {
        pushRule(lines, "body, button, input, select, textarea", uiStack,
          clampSize(s.uiSize), clampWeight(s.uiWeight));
      }

      return lines.join("\n");
    }

    var styleTag = null;
    function applyCss() {
      if (typeof document === "undefined" || !document.head) return;
      if (!styleTag || !styleTag.isConnected) {
        styleTag = document.querySelector('style[data-plugin="dsh-custom-font"]');
        if (!styleTag) {
          styleTag = document.createElement("style");
          styleTag.setAttribute("data-plugin", "dsh-custom-font");
          document.head.appendChild(styleTag);
        }
      }
      // 内容变了就替换：插件升级/热重载后 DOM 是新的、旧样式还留着，
      // 只判断"有没有这个 <style>"就返回会导致新样式永远不生效。
      var next = buildCss(settings);
      if (styleTag.textContent !== next) styleTag.textContent = next;
    }

    /* ================= 设置面板 ================= */
    function el(tag, attrs, children) {
      var node = document.createElement(tag);
      if (attrs) {
        Object.keys(attrs).forEach(function (k) {
          var v = attrs[k];
          if (k === "text") node.textContent = v;
          else if (k === "html") node.innerHTML = v;
          else if (k === "class") node.className = v;
          else if (k === "value") node.value = v;
          else if (v !== null && v !== undefined) node.setAttribute(k, v);
        });
      }
      (children || []).forEach(function (c) { node.appendChild(c); });
      return node;
    }

    var PANEL_CSS = [
      ".dsh-font-settings { font-family: -apple-system, 'Segoe UI', 'Microsoft YaHei', 'PingFang SC', sans-serif; font-size: 13px; line-height: 1.7; padding: 4px 0 32px; max-width: 780px; color: inherit; }",
      ".dsh-font-settings .desc { opacity: .72; font-size: 12px; margin-bottom: 14px; }",
      ".dsh-font-settings .preview { border: 1px dashed rgba(127,127,127,.5); border-radius: 10px; padding: 12px 16px; margin-bottom: 16px; background: rgba(127,127,127,.06); }",
      ".dsh-font-settings .preview-label { font-size: 11px; opacity: .6; margin-bottom: 6px; }",
      ".dsh-font-settings .preview p.pv { margin: 6px 0; }",
      ".dsh-font-settings .preview h1.pv { margin: 8px 0 6px; }",
      ".dsh-font-settings .preview h2.pv { margin: 6px 0; }",
      ".dsh-font-settings .preview code.pv { display: inline-block; margin: 4px 0; }",
      ".dsh-font-settings .preview blockquote.pv { margin: 6px 0; color: #383838; }",
      ".dsh-font-settings .group { border: 1px solid rgba(127,127,127,.28); border-radius: 10px; padding: 14px 16px; margin-bottom: 14px; }",
      ".dsh-font-settings .group-title { font-weight: 600; font-size: 14px; margin-bottom: 6px; }",
      ".dsh-font-settings .row { display: grid; grid-template-columns: 88px 1fr; align-items: center; gap: 12px; margin: 8px 0; }",
      ".dsh-font-settings .row > label { opacity: .85; font-size: 12px; }",
      ".dsh-font-settings .field { display: flex; align-items: center; gap: 8px; }",
      ".dsh-font-settings .unit { opacity: .6; font-size: 12px; }",
      ".dsh-font-settings input[type='text'], .dsh-font-settings input[type='number'], .dsh-font-settings select { padding: 6px 9px; border: 1px solid rgba(127,127,127,.4); border-radius: 7px; background: transparent; color: inherit; font-size: 13px; }",
      ".dsh-font-settings input[type='text'] { width: 100%; max-width: 340px; }",
      ".dsh-font-settings select { width: 100%; max-width: 340px; }",
      ".dsh-font-settings input[type='number'] { width: 86px; }",
      ".dsh-font-settings input[type='color'] { width: 44px; height: 30px; padding: 0; border: 1px solid rgba(127,127,127,.4); border-radius: 6px; background: transparent; cursor: pointer; }",
      ".dsh-font-settings .row-check { display: flex; align-items: center; gap: 8px; margin: 6px 0; font-size: 12px; opacity: .9; }",
      ".dsh-font-settings .actions { display: flex; align-items: center; gap: 12px; flex-wrap: wrap; margin-top: 4px; }",
      ".dsh-font-settings button { padding: 7px 16px; border: 1px solid rgba(127,127,127,.4); border-radius: 7px; background: rgba(127,127,127,.12); color: inherit; cursor: pointer; font-size: 13px; }",
      ".dsh-font-settings button:hover { background: rgba(127,127,127,.22); }",
      ".dsh-font-settings button.primary { background: rgba(64,132,255,.18); border-color: rgba(64,132,255,.5); }",
      ".dsh-font-settings .hint { font-size: 11px; opacity: .6; }",
      ".dsh-font-settings .status { display: flex; align-items: center; gap: 12px; margin: 4px 0 14px; font-size: 12px; opacity: .85; flex-wrap: wrap; }",
      ".dsh-font-settings .status .status-text { opacity: .85; }",
      ".dsh-font-settings .status button { padding: 4px 10px; font-size: 12px; }",
      ".dsh-font-settings .adv-area { border: 1px solid rgba(127,127,127,.28); border-radius: 10px; padding: 4px 16px 10px; margin: 10px 0 14px; }",
      ".dsh-font-settings .adv-section-title { font-weight: 600; font-size: 13px; margin: 12px 0 4px; }",
      ".dsh-font-settings .adv-item { border-top: 1px dashed rgba(127,127,127,.22); padding: 8px 0; }",
      ".dsh-font-settings .adv-section-title + .adv-item { border-top: none; }",
      ".dsh-font-settings .adv-head { display: flex; align-items: center; gap: 8px; margin-bottom: 6px; }",
      ".dsh-font-settings .adv-head input[type='checkbox'] { margin: 0; }",
      ".dsh-font-settings .adv-label { font-size: 13px; font-weight: 600; }",
      ".dsh-font-settings .adv-hint { font-size: 11px; opacity: .6; }",
      ".dsh-font-settings .adv-controls { padding-left: 26px; }",
      ".dsh-font-settings .adv-controls .row { grid-template-columns: 60px 1fr; }",
      ".dsh-font-settings .msg { font-size: 12px; margin-top: 10px; min-height: 18px; opacity: .85; }"
    ].join("\n");

    function buildFieldRow(labelText, inputNode) {
      return el("div", { class: "row" }, [
        el("label", { text: labelText }),
        el("div", { class: "field" }, [inputNode])
      ]);
    }

    function makeToggle(labelText, key, title) {
      var row = el("div", { class: "row-check" });
      var cb = el("input", { type: "checkbox" });
      cb.checked = !!settings[key];
      if (title) cb.title = title;
      cb.addEventListener("change", function () {
        settings[key] = cb.checked;
        commit(patchOf(key));
      });
      row.appendChild(cb);
      row.appendChild(el("span", { text: labelText }));
      return row;
    }

    function makeFontSelect(key) {
      var sel = el("select", { "data-font-key": key }, buildFontOptions(key));
      sel.value = settings[key];
      sel.addEventListener("change", function () {
        settings[key] = sel.value;
        commit(patchOf(key));
      });
      return sel;
    }

    function makeSizeInput(key) {
      var input = el("input", { type: "number", min: "8", max: "72", step: "1", value: String(settings[key]) });
      input.addEventListener("input", function () {
        settings[key] = Number(input.value) || 16;
        commit(patchOf(key));
      });
      return input;
    }

    function makeWeightSelect(key) {
      var sel = el("select", null, WEIGHTS.map(function (w) {
        return el("option", { value: String(w.value), text: w.label });
      }));
      sel.value = String(settings[key]);
      sel.addEventListener("change", function () {
        settings[key] = Number(sel.value) || 400;
        commit(patchOf(key));
      });
      return sel;
    }

    function makeColorInput(key, fallback) {
      var input = el("input", { type: "color", value: safeColor(settings[key], fallback) });
      input.addEventListener("input", function () {
        settings[key] = input.value;
        commit(patchOf(key));
      });
      return input;
    }

    function patchOf(key) {
      var p = {};
      p[key] = settings[key];
      return p;
    }

    function makeAdvancedItem(key, labelText) {
      var box = el("div", { class: "adv-item" });

      var head = el("div", { class: "adv-head" });
      var cb = el("input", { type: "checkbox" });
      cb.checked = !!settings[key + "On"];
      head.appendChild(cb);
      head.appendChild(el("span", { class: "adv-label", text: labelText }));
      var hint = el("span", { class: "adv-hint", text: "" });
      head.appendChild(hint);
      box.appendChild(head);

      var controls = el("div", { class: "adv-controls" });
      controls.appendChild(buildFieldRow("中文字体", makeFontSelect(key + "Font")));
      controls.appendChild(buildFieldRow("西文字体", makeFontSelect(key + "FontEn")));
      controls.appendChild(buildFieldRow("字号", el("span", null, [makeSizeInput(key + "Size"), el("span", { class: "unit", text: "px" })])));
      controls.appendChild(buildFieldRow("加粗", makeWeightSelect(key + "Weight")));
      box.appendChild(controls);

      function syncEnabled() {
        var on = cb.checked;
        hint.textContent = on ? "自定义" : "继承基础设置";
        controls.style.opacity = on ? "1" : "0.55";
        controls.querySelectorAll("select, input").forEach(function (n) { n.disabled = !on; });
      }

      cb.addEventListener("change", function () {
        settings[key + "On"] = cb.checked;
        syncEnabled();
        commit(patchOf(key + "On"));
      });
      syncEnabled();

      return box;
    }

    /* ================= 系统字体库 ================= */
    function getFontChoices() {
      var names = [];
      fontMap.forEach(function (_, n) { names.push(n); });
      names.sort(function (a, b) { return a.localeCompare(b, "zh"); });
      return names;
    }

    function buildFontOptions(key) {
      var names = getFontChoices();
      var cur = settings[key];
      if (cur && names.indexOf(cur) === -1) names = [cur].concat(names);
      return names.map(function (n) { return el("option", { value: n, text: n }); });
    }

    function rebuildFontSelects(root) {
      if (!root) return;
      var selects = root.querySelectorAll("select[data-font-key]");
      selects.forEach(function (sel) {
        var key = sel.getAttribute("data-font-key");
        sel.replaceChildren();
        buildFontOptions(key).forEach(function (o) { sel.appendChild(o); });
        sel.value = settings[key];
      });
    }

    /** 作者推荐用到的字体（STIX2Text / Latin Modern Mono Light）——系统没装时由内置字体接管。 */
    var SPEC_FONTS = ["STIX2Text", "Latin Modern Mono Light"];

    /** 状态行的纯文本版（不含根节点）；updateFontStatus 会额外带上"内置字体"的状态。 */
    function fontStatusText() {
      if (systemFonts === null) return "正在读取系统字体…";
      if (systemFonts.length > 0) return "已读取 " + systemFonts.length + " 个系统字体，作者推荐的字体系统里都有";
      return "未读取到系统字体，使用内置列表";
    }

    /** 作者推荐用到的字体（STIX2Text / Latin Modern Mono Light）是否已在系统字体库里。 */
    function missingSpecFonts() {
      if (!systemFonts || systemFonts.length === 0) return [];
      return SPEC_FONTS.filter(function (name) { return !systemFontNames.has(name); });
    }

    /**
     * 状态行文案。这一行的重点是**别让用户误判**：
     *   - 系统没装推荐字体，但插件内置字体已生效 → 明确说"已由插件内置字体接管"
     *   - 系统没装、内置也没开 → 明确说"浏览器会静默回退"，这是用户最需要知道的
     */
    function updateFontStatus(root) {
      if (!root) return;
      var t = root.querySelector(".font-status-text");
      if (!t) return;
      var parts = [];
      if (systemFonts === null) parts.push("正在读取系统字体…");
      else if (systemFonts.length > 0) parts.push("已读取 " + systemFonts.length + " 个系统字体");
      else parts.push("未读取到系统字体，使用内置列表");

      var missing = missingSpecFonts();
      if (missing.length === 0 && systemFonts && systemFonts.length > 0) {
        parts.push("作者推荐的字体系统里都有");
      } else if (missing.length > 0) {
        if (settings.embeddedFonts) {
          if (embedded.state === "ready") parts.push("系统缺 " + missing.join("、") + "，已由插件内置字体接管");
          else if (embedded.state === "loading") parts.push("系统缺 " + missing.join("、") + "，正在加载内置字体…");
          else if (embedded.state === "error") parts.push("系统缺 " + missing.join("、") + "，内置字体加载失败（" + (embedded.error || "未知原因") + "）");
          else parts.push("系统缺 " + missing.join("、") + "，正在准备内置字体…");
        } else {
          parts.push("⚠️ 系统缺 " + missing.join("、") + "，且内置字体已关闭 → 会静默回退到其他字体");
        }
      }
      t.textContent = parts.join("；");
    }

    function mergeSystemFonts(fonts) {
      systemFonts = fonts;
      systemFontNames = new Set();
      fonts.forEach(function (f) {
        fontMap.set(f.name, f);
        systemFontNames.add(f.name);
        // 宿主返回的是 {en, zh}：英文名也要能对上（用户可能按英文名选字体）
        if (f.css) systemFontNames.add(f.css);
      });
    }

    function ensureSystemFonts(root, force) {
      if (!force && systemFonts !== null) { updateFontStatus(root); return; }
      if (typeof fetch !== "function") { systemFonts = []; updateFontStatus(root); return; }
      if (fontFetchPromise) return;
      updateFontStatus(root);
      fontFetchPromise = fetch(FONTS_API + (force ? "?refresh=1" : ""))
        .then(function (r) { return r.json(); })
        .then(function (data) {
          var fonts = (data && Array.isArray(data.fonts)) ? data.fonts : [];
          mergeSystemFonts(fonts.map(function (f) {
            var en = String(f && f.en || "").trim();
            var zh = String(f && f.zh || "").trim();
            return { name: (zh || en), css: (en || zh) };
          }).filter(function (f) { return !!f.name; }));
          rebuildFontSelects(root);
        })
        .catch(function () { systemFonts = []; })
        .then(function () {
          fontFetchPromise = null;
          updateFontStatus(root);
        });
    }

    function forceRefreshSystemFonts(root) {
      systemFonts = null;
      ensureSystemFonts(root, true);
    }

    /* ================= 导出 / 导入 ================= */
    function triggerDownload(filename, text) {
      try {
        var blob = new Blob([text], { type: "application/json" });
        var url = URL.createObjectURL(blob);
        var a = document.createElement("a");
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        setTimeout(function () { URL.revokeObjectURL(url); }, 2000);
        return true;
      } catch (e) { return false; }
    }

    function exportSettingsFile(root) {
      var msg = root.querySelector(".msg");
      if (typeof fetch === "function") {
        fetch(EXPORT_API).then(function (r) { return r.json(); }).then(function (data) {
          if (data && data.ok && data.text) {
            triggerDownload("dsh-custom-font-settings.json", data.text);
            if (msg) msg.textContent = "已导出设置文件（浏览器下载目录）";
            return;
          }
          // 宿主文件还不存在：直接把当前内存里的设置导出去
          fallbackExport(msg);
        }).catch(function () { fallbackExport(msg); });
        return;
      }
      fallbackExport(msg);
    }

    function fallbackExport(msg) {
      var text = JSON.stringify(settings, null, 2) + "\n";
      var ok = triggerDownload("dsh-custom-font-settings.json", text);
      if (msg) msg.textContent = ok ? "已导出当前设置（宿主文件尚未生成）" : "导出失败：浏览器不允许下载";
    }

    function importSettingsFile(root, file) {
      var msg = root.querySelector(".msg");
      if (!file) return;
      var reader = new FileReader();
      reader.onload = function () {
        try {
          var parsed = JSON.parse(String(reader.result));
          var patch = (parsed && typeof parsed === "object" && parsed.settings !== undefined) ? parsed.settings : parsed;
          if (!patch || typeof patch !== "object") throw new Error("不是有效的设置对象");
          var count = 0;
          Object.keys(DEFAULTS).forEach(function (k) {
            if (!(k in patch)) return;
            var v = patch[k];
            var expected = typeof DEFAULTS[k];
            if (typeof v !== expected) return;
            settings[k] = v;
            count++;
          });
          if (count === 0) throw new Error("文件里没有可识别的设置项");
          saveToLocalStorage(settings);
          applyCss();
          postSettings(clone(settings));
          buildPanel(root);
          var next = root.querySelector(".msg");
          if (next) next.textContent = "已导入 " + count + " 项设置（并写入 ~/.dsh）";
        } catch (err) {
          if (msg) msg.textContent = "导入失败：" + (err && err.message || err);
        }
      };
      reader.onerror = function () { if (msg) msg.textContent = "导入失败：读不到文件"; };
      reader.readAsText(file);
    }

    /* ================= 面板 ================= */
    function buildPanel(root) {
      root.replaceChildren();

      root.appendChild(el("style", { text: PANEL_CSS }));

      // 状态行：字体库 + 设置存哪 + 刷新
      var status = el("div", { class: "status" });
      status.appendChild(el("span", { class: "font-status-text", text: "" }));
      var refreshFontBtn = el("button", { type: "button", text: "刷新字体列表" });
      refreshFontBtn.addEventListener("click", function () { forceRefreshSystemFonts(root); });
      status.appendChild(refreshFontBtn);
      root.appendChild(status);

      root.appendChild(el("div", { class: "desc", text: "像 Word 一样改字体、字号、加粗、颜色，改动即时生效并自动保存。西文字体管英文/数字，中文字体管汉字；字体取自你电脑已安装的字体。" }));

      // 预设
      var presetGroup = el("div", { class: "group" });
      presetGroup.appendChild(el("div", { class: "group-title", text: "一键套用" }));
      var presetRow = el("div", { class: "actions" });
      var specBtn = el("button", { type: "button", class: "primary", text: "应用作者推荐" });
      specBtn.addEventListener("click", function () {
        Object.keys(SPEC).forEach(function (k) { settings[k] = SPEC[k]; });
        saveToLocalStorage(settings);
        applyCss();
        postSettings(Object.assign({}, SPEC));
        buildPanel(root);
        var next = root.querySelector(".msg");
        if (next) next.textContent = "已应用作者推荐：正文 16px 仿宋_GB2312 + STIX2Text，一级标题小标宋 22px 居中不加粗，链接 DeepSeek 蓝。不满意的地方照常逐项改。";
      });
      var defaultBtn = el("button", { type: "button", text: "恢复插件默认值" });
      defaultBtn.addEventListener("click", function () {
        settings = clone(DEFAULTS);
        saveToLocalStorage(settings);
        applyCss();
        postSettings(clone(DEFAULTS));
        buildPanel(root);
        var next = root.querySelector(".msg");
        if (next) next.textContent = "已恢复插件默认值。";
      });
      presetRow.appendChild(specBtn);
      presetRow.appendChild(defaultBtn);
      presetGroup.appendChild(presetRow);
      presetGroup.appendChild(el("div", { class: "hint", text: "「作者推荐」是作者为安装本插件的用户推荐的一套排版（公文/学术观感），仅供参考；「恢复默认值」回到插件出厂设置。两者内容相同，前者用于你改乱之后一键复位。" }));
      root.appendChild(presetGroup);

      // 预览
      var preview = el("div", { class: "preview" });
      preview.appendChild(el("div", { class: "preview-label", text: "预览（跟随当前设置）" }));
      preview.appendChild(el("h1", { class: "pv", text: "一级标题示例：统一排版规范" }));
      preview.appendChild(el("h2", { class: "pv", text: "二级标题示例" }));
      preview.appendChild(el("p", { class: "pv", text: "正文示例：春眠不觉晓，处处闻啼鸟。The quick brown fox jumps over the lazy dog. 2026" }));
      preview.appendChild(el("blockquote", { class: "pv", text: "引用示例：政治经济学批判的出发点不是观念，而是物质生活关系。" }));
      preview.appendChild(el("p", { class: "pv" }, [
        el("span", { text: "链接示例：" }),
        el("a", { href: "https://www.deepseek.com/", text: "https://www.deepseek.com/" }),
        el("span", { text: "　" }),
        el("code", { class: "pv", text: "const x = 1;" })
      ]));
      root.appendChild(preview);

      // 正文
      var bodyGroup = el("div", { class: "group" });
      bodyGroup.appendChild(el("div", { class: "group-title", text: "正文" }));
      bodyGroup.appendChild(buildFieldRow("中文字体", makeFontSelect("bodyFont")));
      bodyGroup.appendChild(buildFieldRow("西文字体", makeFontSelect("bodyFontEn")));
      bodyGroup.appendChild(buildFieldRow("字号", el("span", null, [makeSizeInput("bodySize"), el("span", { class: "unit", text: "px" })])));
      bodyGroup.appendChild(buildFieldRow("加粗", makeWeightSelect("bodyWeight")));
      bodyGroup.appendChild(buildFieldRow("颜色", makeColorInput("bodyColor", "#000000")));
      root.appendChild(bodyGroup);

      // 标题（基础）
      var headGroup = el("div", { class: "group" });
      headGroup.appendChild(el("div", { class: "group-title", text: "标题（各级标题统一；要逐级不同请用下面的「高级设置」）" }));
      headGroup.appendChild(buildFieldRow("中文字体", makeFontSelect("headingFont")));
      headGroup.appendChild(buildFieldRow("西文字体", makeFontSelect("headingFontEn")));
      headGroup.appendChild(buildFieldRow("字号", el("span", null, [makeSizeInput("headingSize"), el("span", { class: "unit", text: "px" })])));
      headGroup.appendChild(buildFieldRow("加粗", makeWeightSelect("headingWeight")));
      root.appendChild(headGroup);

      // 代码
      var codeGroup = el("div", { class: "group" });
      codeGroup.appendChild(el("div", { class: "group-title", text: "代码" }));
      codeGroup.appendChild(buildFieldRow("字体", makeFontSelect("codeFont")));
      codeGroup.appendChild(buildFieldRow("字号", el("span", null, [makeSizeInput("codeSize"), el("span", { class: "unit", text: "px" })])));
      codeGroup.appendChild(buildFieldRow("加粗", makeWeightSelect("codeWeight")));
      root.appendChild(codeGroup);

      // 界面文字
      var uiFollowRow = el("div", { class: "row-check" });
      var uiFollowCb = el("input", { type: "checkbox" });
      uiFollowCb.checked = !!settings.uiFollow;
      uiFollowCb.addEventListener("change", function () {
        settings.uiFollow = uiFollowCb.checked;
        commit(patchOf("uiFollow"));
      });
      uiFollowRow.appendChild(uiFollowCb);
      uiFollowRow.appendChild(el("span", { text: "界面文字（按钮、菜单）也使用正文字体" }));
      root.appendChild(uiFollowRow);

      // 高级设置（默认收起）
      var advArea = el("div", { class: "adv-area" });
      advArea.style.display = "none";

      advArea.appendChild(el("div", { class: "adv-section-title", text: "标题层级 h1 ~ h6（勾选后独立设置；不勾选则继承上面的「标题」）" }));
      [["h1", "H1 一级标题（规范：小标宋 22px 不加粗居中）"],
       ["h2", "H2 二级标题（规范：黑体 18px / 900）"],
       ["h3", "H3 三级标题（规范：楷体 18px / 900）"],
       ["h4", "H4 四级标题（规范：仿宋 18px / 900）"],
       ["h5", "H5 五级标题（规范：仿宋 18px / 900）"],
       ["h6", "H6 六级标题（规范：仿宋 18px / 900）"]].forEach(function (p) {
        advArea.appendChild(makeAdvancedItem(p[0], p[1]));
      });

      advArea.appendChild(el("div", { class: "adv-section-title", text: "内置字体（插件自带，与系统字体无关）" }));
      var embeddedRow = el("div", { class: "row-check" });
      var embeddedCb = el("input", { type: "checkbox" });
      embeddedCb.checked = !!settings.embeddedFonts;
      embeddedCb.title = "插件自带 STIX2Text 与 Latin Modern Mono Light：任何电脑上都能看到作者推荐的排版，且不修改你的系统";
      embeddedCb.addEventListener("change", function () {
        settings.embeddedFonts = embeddedCb.checked;
        commit(patchOf("embeddedFonts"));
        if (embeddedCb.checked) ensureEmbeddedFonts(false);
        applyCss();
        updateFontStatus(root);
        buildPanel(root);
      });
      embeddedRow.appendChild(embeddedCb);
      embeddedRow.appendChild(el("span", { text: "使用插件内置字体（STIX2Text / Latin Modern Mono Light）" }));
      advArea.appendChild(embeddedRow);
      var embeddedHint = el("div", { class: "hint", text: embeddedHintText() });
      advArea.appendChild(embeddedHint);

      advArea.appendChild(el("div", { class: "adv-section-title", text: "作者推荐的版式（作者推荐里「不是字体」的那些要求；不需要就关掉）" }));
      advArea.appendChild(makeToggle("正文两端对齐", "justifyBody"));
      advArea.appendChild(makeToggle("一级标题居中", "h1Center"));
      advArea.appendChild(makeToggle("一级标题不加粗", "h1NoBold", "小标宋本身是标题体，再加粗会糊"));
      advArea.appendChild(makeToggle("引用块使用斜体", "quoteItalic"));
      advArea.appendChild(makeToggle("引用块左侧 2px 竖线 #a2a9b1", "quoteBar"));
      advArea.appendChild(makeToggle("行内代码加灰底（GitHub 风格）", "inlineCodeBg"));
      advArea.appendChild(makeToggle("表头深底浅字（黑体 700）", "tableHeader"));
      advArea.appendChild(makeToggle("链接使用自定义颜色", "linkColorOn"));
      var linkRow = el("div", { class: "row" });
      linkRow.appendChild(el("label", { text: "链接颜色" }));
      linkRow.appendChild(el("div", { class: "field" }, [
        el("span", { class: "unit", text: "常态" }), makeColorInput("linkColor", "#4D6BFE"),
        el("span", { class: "unit", text: "悬停" }), makeColorInput("linkColorHover", "#2E4FD8"),
        el("span", { class: "hint", text: "作者推荐用 DeepSeek 蓝 #4D6BFE；深色模式下自动换亮蓝，避免看不清" })
      ]));
      advArea.appendChild(linkRow);

      advArea.appendChild(el("div", { class: "adv-section-title", text: "其他常用 Markdown 格式" }));
      advArea.appendChild(makeAdvancedItem("quote", "引用 blockquote"));
      advArea.appendChild(makeAdvancedItem("codeInline", "行内代码 code"));
      advArea.appendChild(makeAdvancedItem("codeBlock", "代码块 pre"));

      advArea.appendChild(el("div", { class: "adv-section-title", text: "界面文字（勾选后自定义界面字体/字号/加粗；不勾选则跟随上面勾选或系统默认）" }));
      advArea.appendChild(makeAdvancedItem("ui", "界面文字"));

      var advBtn = el("button", { type: "button", text: "高级设置" });
      advBtn.addEventListener("click", function () {
        var hidden = advArea.style.display === "none";
        advArea.style.display = hidden ? "block" : "none";
        advBtn.textContent = hidden ? "收起高级设置" : "高级设置";
      });
      root.appendChild(advBtn);
      root.appendChild(advArea);

      // 操作：导入 / 导出 / 存储位置说明
      var actions = el("div", { class: "actions" });
      var exportBtn = el("button", { type: "button", text: "导出设置" });
      exportBtn.addEventListener("click", function () { exportSettingsFile(root); });
      actions.appendChild(exportBtn);

      var importInput = el("input", { type: "file", accept: ".json,application/json" });
      importInput.style.display = "none";
      importInput.addEventListener("change", function () {
        var file = importInput.files && importInput.files[0];
        importSettingsFile(root, file);
        importInput.value = "";
      });
      var importBtn = el("button", { type: "button", text: "导入设置" });
      importBtn.addEventListener("click", function () { importInput.click(); });
      actions.appendChild(importBtn);
      actions.appendChild(importInput);
      root.appendChild(actions);

      root.appendChild(el("div", { class: "hint", text: storageHint() }));
      root.appendChild(el("div", { class: "msg", text: "" }));

      ensureSystemFonts(root);
      // 内置字体：开启时后台加载（加载完会重画一次，状态行也会更新）
      if (settings.embeddedFonts && !embeddedReady()) {
        ensureEmbeddedFonts(false).then(function () {
          applyCss();
          updateFontStatus(root);
        });
      }
    }

    /** 测试开关：置 window.__DSH_CUSTOM_FONT_NO_EMBEDDED__ = true 可跳过自动加载内置字体。 */
    function autoEmbeddedDisabled() {
      try {
        return typeof window !== "undefined" && window.__DSH_CUSTOM_FONT_NO_EMBEDDED__ === true;
      } catch (e) { return false; }
    }

    /** 高级设置里那句"内置字体现在是什么状态"的说明。 */
    function embeddedHintText() {
      if (!settings.embeddedFonts) {
        return "已关闭：只按字体名调用系统字体。系统里没装的字体会被浏览器**静默回退**掉（你看不出来），除非你自己装了。";
      }
      if (embedded.state === "ready") {
        var count = Object.keys(embedded.blobUrls).length;
        var text = "已加载 " + count + " 个内置字体文件，作者推荐的排版在任何电脑上都一致；不写注册表、不装进系统。";
        if (embedded.missing.length > 0) text += "⚠️ 打包缺少：" + embedded.missing.join("、");
        return text;
      }
      if (embedded.state === "loading") return "正在加载内置字体…";
      if (embedded.state === "error") return "内置字体加载失败：" + (embedded.error || "未知原因") + "（30 秒后可重试；此时会回退到系统字体）";
      return "尚未加载。";
    }

    function storageHint() {
      var where = hostStore.path || "（还没确定）";
      if (hostStore.available === false) {
        return "⚠️ 设置文件不可用（" + (hostStore.error || "未知原因") + "），当前只存在浏览器存储里 —— 换桌面外壳会丢。路径：" + where;
      }
      if (hostStore.available === null) return "设置保存位置：读取中…";
      return "设置保存在这里（跟着 DSH 用户数据走，换外壳不丢）：" + where;
    }

    function FontSettingsPanel() {
      var ref = React.useRef(null);
      var [, forceRender] = React.useState ? React.useState(0) : [0, function () {}];
      React.useEffect(function () {
        if (ref.current) buildPanel(ref.current);
        var listener = function () { if (ref.current) buildPanel(ref.current); };
        settingsListeners.push(listener);
        // 每次打开设置页都问一次宿主：文件可能在别处被改过（比如换壳后）
        syncFromHost();
        return function () {
          var i = settingsListeners.indexOf(listener);
          if (i >= 0) settingsListeners.splice(i, 1);
        };
      }, []);
      return React.createElement("div", { className: "dsh-font-settings", ref: ref });
    }

    /* ================= 注册 ================= */
    function apply(ctx) {
      // 初始样式在模块加载时就已注入（见文件末尾 applyCss()），这里再执行一次确保覆盖任何更晚的宿主样式。
      applyCss();

      var slots = ctx && ctx.slots;
      if (!React || !slots || typeof slots.inject !== "function") return;

      slots.inject("settings.section", function () {
        return slots.register({
          name: "settings.section",
          id: "custom-font",
          order: 60,
          label: function () { return "自定义字体"; }
        }, function () { return React.createElement(FontSettingsPanel); });
      });
    }

    // 页面加载即生效（即使设置页还没打开）
    applyCss();
    // 模块加载后就去问宿主端要"真身"设置（异步，不阻塞首屏）
    syncFromHost();
    // 内置字体后台加载：作者推荐的字体不是 Windows 自带，装上插件就该看得见
    if (!autoEmbeddedDisabled()) ensureEmbeddedFonts(false);

    exports.apply = apply;
    exports.inject = ["slots"];
    exports.name = "dsh-custom-font";

    // 供自检脚本调用的内部函数（浏览器里没人用这些导出，仅供 test/client.test.mjs 断言）
    exports.__internals = {
      DEFAULTS: DEFAULTS,
      SPEC: SPEC,
      buildCss: buildCss,
      stackCjk: stack,
      fontStatusText: fontStatusText,
      SPEC_FONTS: SPEC_FONTS,
      storageKey: STORAGE_KEY,
      getSettings: function () { return settings; },
      setSettings: function (next) { settings = next; },
      hostStore: hostStore,
      // 内置字体相关（自检用）
      embedded: embedded,
      ensureEmbeddedFonts: ensureEmbeddedFonts,
      embeddedFontCss: embeddedFontCss,
      embeddedReady: embeddedReady
    };
    return module.exports;
  }
});
