window.__ModuleLoader__.load({
  id: "dsh-custom-font",
  factory: (require) => {
    var module = { exports: {} };
    var exports = module.exports;
    Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });

    // react 由宿主平台模块表提供（和 dshmarket 一样）
    var React = null;
    try { React = require("react"); } catch (e) { React = null; }

    /* ================= 默认配置 ================= */
    var STORAGE_KEY = "dsh-custom-font/settings";

    var DEFAULTS = {
      bodyFont: "仿宋",
      bodyFontEn: "Times New Roman",
      bodySize: 18,
      bodyWeight: 500,
      bodyColor: "#0a0a0a",
      headingFont: "黑体",
      headingFontEn: "Times New Roman",
      headingSize: 24,
      headingWeight: 700,
      codeFont: "Consolas",
      codeSize: 15,
      codeWeight: 400,
      uiFollow: true,
      // 高级设置：逐级覆盖（on=false 表示继承上面的基础设置）
      h1On: false, h1Font: "黑体", h1FontEn: "Times New Roman", h1Size: 28, h1Weight: 700,
      h2On: false, h2Font: "黑体", h2FontEn: "Times New Roman", h2Size: 24, h2Weight: 700,
      h3On: false, h3Font: "楷体", h3FontEn: "Times New Roman", h3Size: 22, h3Weight: 700,
      h4On: false, h4Font: "仿宋", h4FontEn: "Times New Roman", h4Size: 20, h4Weight: 700,
      h5On: false, h5Font: "仿宋", h5FontEn: "Times New Roman", h5Size: 18, h5Weight: 700,
      h6On: false, h6Font: "仿宋", h6FontEn: "Times New Roman", h6Size: 16, h6Weight: 700,
      quoteOn: false, quoteFont: "仿宋", quoteFontEn: "Times New Roman", quoteSize: 18, quoteWeight: 400,
      codeInlineOn: false, codeInlineFont: "宋体", codeInlineFontEn: "Consolas", codeInlineSize: 15, codeInlineWeight: 400,
      codeBlockOn: false, codeBlockFont: "宋体", codeBlockFontEn: "Consolas", codeBlockSize: 14, codeBlockWeight: 400,
      uiOn: false, uiFont: "微软雅黑", uiFontEn: "Segoe UI", uiSize: 16, uiWeight: 500
    };

    var WEIGHTS = [
      { label: "常规 (400)", value: 400 },
      { label: "略粗 (500)", value: 500 },
      { label: "半粗 (600)", value: 600 },
      { label: "加粗 (700)", value: 700 },
      { label: "特粗 (900)", value: 900 }
    ];

    // 内置兜底字体（读不到系统字体库时用）。name=显示名（中文优先），css=英文家族名。
    var FALLBACK_FONTS = [
      { name: "微软雅黑", css: "Microsoft YaHei" },
      { name: "宋体", css: "SimSun" },
      { name: "仿宋", css: "FangSong" },
      { name: "楷体", css: "KaiTi" },
      { name: "黑体", css: "SimHei" },
      { name: "等线", css: "DengXian" },
      { name: "微软正黑体", css: "Microsoft JhengHei" },
      { name: "幼圆", css: "YouYuan" },
      { name: "隶书", css: "LiSu" },
      { name: "华文仿宋", css: "STFangsong" },
      { name: "华文楷体", css: "STKaiti" },
      { name: "华文宋体", css: "STSong" },
      { name: "华文中宋", css: "STZhongsong" },
      { name: "华文细黑", css: "STXihei" },
      { name: "华文黑体", css: "STHeiti" },
      { name: "Arial", css: "Arial" },
      { name: "Times New Roman", css: "Times New Roman" },
      { name: "Georgia", css: "Georgia" },
      { name: "Verdana", css: "Verdana" },
      { name: "Tahoma", css: "Tahoma" },
      { name: "Segoe UI", css: "Segoe UI" },
      { name: "Calibri", css: "Calibri" },
      { name: "Cambria", css: "Cambria" },
      { name: "Garamond", css: "Garamond" },
      { name: "Trebuchet MS", css: "Trebuchet MS" },
      { name: "Courier New", css: "Courier New" },
      { name: "Consolas", css: "Consolas" },
      { name: "Comic Sans MS", css: "Comic Sans MS" },
      { name: "Impact", css: "Impact" }
    ];

    // 字体名 → { name, css } 查找表：先装兜底，系统字体读回来后再合并进来。
    var fontMap = new Map();
    FALLBACK_FONTS.forEach(function (f) { fontMap.set(f.name, f); });

    // 系统字体状态：null=还没读，[]=读失败/非 Windows，数组=已读到。
    var systemFonts = null;
    var fontFetchPromise = null;

    function clone(obj) { return JSON.parse(JSON.stringify(obj)); }

    function loadSettings() {
      var s = clone(DEFAULTS);
      try {
        var raw = localStorage.getItem(STORAGE_KEY);
        if (raw) {
          var parsed = JSON.parse(raw);
          if (parsed && typeof parsed === "object") {
            Object.keys(DEFAULTS).forEach(function (k) {
              var v = parsed[k];
              if (typeof v === "string" || typeof v === "number" || typeof v === "boolean") {
                s[k] = v;
              }
            });
          }
        }
      } catch (e) { /* 读取失败则用默认值 */ }
      return s;
    }

    var settings = loadSettings();

    function saveSettings() {
      try { localStorage.setItem(STORAGE_KEY, JSON.stringify(settings)); } catch (e) { /* 忽略 */ }
    }

    /* ================= 字体栈 ================= */
    function stack(name, generic) {
      name = String(name == null ? "" : name).trim();
      if (!name) return generic;
      // 用户直接输入了完整 font-family 栈（含逗号/引号），原样使用
      if (/[,"']/.test(name)) return name;
      var f = fontMap.get(name);
      if (f && f.css && f.css !== name) return '"' + name + '", "' + f.css + '", ' + generic;
      return '"' + name + '", ' + generic;
    }

    // 中英文分离：西文字体在前（负责英文/数字），中文字体在后（负责汉字），generic 兜底。
    function stackCJK(latin, cjk, generic) {
      var parts = [];
      [latin, cjk].forEach(function (name) {
        name = String(name == null ? "" : name).trim();
        if (!name) return;
        if (/[,"']/.test(name)) { parts.push(name); return; }
        var f = fontMap.get(name);
        parts.push('"' + name + '"');
        if (f && f.css && f.css !== name) parts.push('"' + f.css + '"');
      });
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

    /* ================= 生成 CSS ================= */
    function pushRule(lines, selector, font, size, weight) {
      lines.push(selector + " {");
      lines.push("  font-family: " + font + " !important;");
      lines.push("  font-size: " + size + "px !important;");
      lines.push("  font-weight: " + weight + " !important;");
      lines.push("}");
    }

    // 界面文字的字号/字重：按 5 个层级（base/s/xs/xxs/xxxs）写入 --dsw-font-* 变量。
    function uiFontVars(lines, stack, size, weight) {
      var s = clampSize(size);
      var w = clampWeight(weight);
      [["base-16", 0], ["s-14", 2], ["xs-13", 3], ["xxs-12", 4], ["xxxs-11", 5]].forEach(function (t) {
        var px = Math.max(8, s - t[1]);
        lines.push("  --dsw-font-" + t[0] + ": " + w + " " + px + "px/" + Math.round(px * 1.5) + "px " + stack + " !important;");
      });
    }

    function buildCss(s) {
      var body = stackCJK(s.bodyFontEn, s.bodyFont, "serif");
      var head = stackCJK(s.headingFontEn, s.headingFont, "sans-serif");
      var code = stack(s.codeFont, "monospace");
      var uiStack = stackCJK(s.uiFontEn, s.uiFont, "sans-serif");
      var color = String(s.bodyColor || "").trim();

      var lines = [];
      lines.push("/* dsh-custom-font（可配置版）——由设置页自动生成 */");
      lines.push(":root {");
      if (s.uiOn) {
        // 高级：自定义界面文字（家族 + 字号 + 字重）
        lines.push("  --dsw-font-family: " + uiStack + " !important;");
        uiFontVars(lines, uiStack, s.uiSize, s.uiWeight);
      } else if (s.uiFollow) {
        // 一般：界面文字跟随正文字体（只改家族）
        lines.push("  --dsw-font-family: " + body + " !important;");
      }
      lines.push("  --ds-font-family-code: " + code + " !important;");
      lines.push("}");

      // 正文（含列表、表格、引用）
      pushRule(lines, "p, li, td, th, blockquote", body, clampSize(s.bodySize), clampWeight(s.bodyWeight));
      // 标题（基础，h1~h6 全部）
      pushRule(lines, "h1, h2, h3, h4, h5, h6", head, clampSize(s.headingSize), clampWeight(s.headingWeight));
      // 行内代码（基础）
      pushRule(lines, "code, kbd, samp", code, clampSize(s.codeSize), clampWeight(s.codeWeight));
      // 代码块（基础）
      pushRule(lines, "pre, pre code", code, clampSize(s.codeSize), clampWeight(s.codeWeight));

      if (color) {
        // 正文字色只在浅色模式生效，避免深色模式变黑字看不清
        lines.push("body:not([data-ds-dark-theme]) p,");
        lines.push("body:not([data-ds-dark-theme]) li,");
        lines.push("body:not([data-ds-dark-theme]) td,");
        lines.push("body:not([data-ds-dark-theme]) th,");
        lines.push("body:not([data-ds-dark-theme]) blockquote {");
        lines.push("  color: " + color + " !important;");
        lines.push("}");
        lines.push("body:not([data-ds-dark-theme]) {");
        lines.push("  --dsw-alias-label-primary: " + color + " !important;");
        lines.push("}");
      }

      // —— 高级覆盖（逐个元素，晚于基础规则，故优先生效）——
      if (s.quoteOn) pushRule(lines, "blockquote", stackCJK(s.quoteFontEn, s.quoteFont, "serif"), clampSize(s.quoteSize), clampWeight(s.quoteWeight));
      ["h1", "h2", "h3", "h4", "h5", "h6"].forEach(function (lvl) {
        if (s[lvl + "On"]) pushRule(lines, lvl, stackCJK(s[lvl + "FontEn"], s[lvl + "Font"], "sans-serif"), clampSize(s[lvl + "Size"]), clampWeight(s[lvl + "Weight"]));
      });
      if (s.codeInlineOn) pushRule(lines, "code, kbd, samp", stackCJK(s.codeInlineFontEn, s.codeInlineFont, "monospace"), clampSize(s.codeInlineSize), clampWeight(s.codeInlineWeight));
      if (s.codeBlockOn) pushRule(lines, "pre, pre code", stackCJK(s.codeBlockFontEn, s.codeBlockFont, "monospace"), clampSize(s.codeBlockSize), clampWeight(s.codeBlockWeight));

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
      styleTag.textContent = buildCss(settings);
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
      ".dsh-font-settings { font-family: -apple-system, 'Segoe UI', 'Microsoft YaHei', 'PingFang SC', sans-serif; font-size: 13px; line-height: 1.7; padding: 4px 0 32px; max-width: 760px; color: inherit; }",
      ".dsh-font-settings .desc { opacity: .72; font-size: 12px; margin-bottom: 14px; }",
      ".dsh-font-settings .preview { border: 1px dashed rgba(127,127,127,.5); border-radius: 10px; padding: 12px 16px; margin-bottom: 16px; background: rgba(127,127,127,.06); }",
      ".dsh-font-settings .preview-label { font-size: 11px; opacity: .6; margin-bottom: 6px; }",
      ".dsh-font-settings .preview p.pv { margin: 6px 0; }",
      ".dsh-font-settings .preview h2.pv { margin: 6px 0; }",
      ".dsh-font-settings .preview code.pv { display: inline-block; margin: 4px 0; }",
      ".dsh-font-settings .group { border: 1px solid rgba(127,127,127,.28); border-radius: 10px; padding: 14px 16px; margin-bottom: 14px; }",
      ".dsh-font-settings .group-title { font-weight: 600; font-size: 14px; margin-bottom: 6px; }",
      ".dsh-font-settings .row { display: grid; grid-template-columns: 88px 1fr; align-items: center; gap: 12px; margin: 8px 0; }",
      ".dsh-font-settings .row > label { opacity: .85; font-size: 12px; }",
      ".dsh-font-settings .field { display: flex; align-items: center; gap: 8px; }",
      ".dsh-font-settings .unit { opacity: .6; font-size: 12px; }",
      ".dsh-font-settings input[type='text'], .dsh-font-settings input[type='number'], .dsh-font-settings select { padding: 6px 9px; border: 1px solid rgba(127,127,127,.4); border-radius: 7px; background: transparent; color: inherit; font-size: 13px; }",
      ".dsh-font-settings input[type='text'] { width: 100%; max-width: 320px; }",
      ".dsh-font-settings select { width: 100%; max-width: 320px; }",
      ".dsh-font-settings input[type='number'] { width: 86px; }",
      ".dsh-font-settings input[type='color'] { width: 44px; height: 30px; padding: 0; border: 1px solid rgba(127,127,127,.4); border-radius: 6px; background: transparent; cursor: pointer; }",
      ".dsh-font-settings .row-check { display: flex; align-items: center; gap: 8px; margin: 6px 0 16px; font-size: 12px; opacity: .9; }",
      ".dsh-font-settings .actions { display: flex; align-items: center; gap: 14px; flex-wrap: wrap; }",
      ".dsh-font-settings button { padding: 7px 16px; border: 1px solid rgba(127,127,127,.4); border-radius: 7px; background: rgba(127,127,127,.12); color: inherit; cursor: pointer; font-size: 13px; }",
      ".dsh-font-settings button:hover { background: rgba(127,127,127,.22); }",
      ".dsh-font-settings .hint { font-size: 11px; opacity: .6; }",
      ".dsh-font-settings .font-status { display: flex; align-items: center; gap: 12px; margin: 4px 0 14px; font-size: 12px; opacity: .85; }",
      ".dsh-font-settings .font-status .font-status-text { opacity: .8; }",
      ".dsh-font-settings .font-status button { padding: 4px 10px; font-size: 12px; }",
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
      ".dsh-font-settings .adv-ui { margin: 4px 0 6px; }"
    ].join("\n");

    function buildFieldRow(labelText, inputNode) {
      return el("div", { class: "row" }, [
        el("label", { text: labelText }),
        el("div", { class: "field" }, [inputNode])
      ]);
    }

    function commit() {
      saveSettings();
      applyCss();
    }

    function makeFontSelect(key) {
      var sel = el("select", { "data-font-key": key }, buildFontOptions(key));
      sel.value = settings[key];
      sel.addEventListener("change", function () {
        settings[key] = sel.value;
        commit();
      });
      return sel;
    }

    function makeSizeInput(key) {
      var input = el("input", { type: "number", min: "8", max: "72", step: "1", value: String(settings[key]) });
      input.addEventListener("input", function () {
        settings[key] = Number(input.value) || 16;
        commit();
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
        commit();
      });
      return sel;
    }

    function makeColorInput() {
      var input = el("input", { type: "color", value: settings.bodyColor });
      input.addEventListener("input", function () {
        settings.bodyColor = input.value;
        commit();
      });
      return input;
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
        commit();
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

    function fontStatusText() {
      if (systemFonts === null) return "正在读取系统字体…";
      if (systemFonts.length > 0) return "已读取 " + systemFonts.length + " 个系统字体，下拉可选";
      return "未读取到系统字体，使用内置列表";
    }

    function updateFontStatus(root) {
      if (!root) return;
      var t = root.querySelector(".font-status-text");
      if (t) t.textContent = fontStatusText();
    }

    function mergeSystemFonts(fonts) {
      systemFonts = fonts;
      fonts.forEach(function (f) { fontMap.set(f.name, f); });
    }

    function ensureSystemFonts(root, force) {
      if (!force && systemFonts !== null) { updateFontStatus(root); return; }
      if (typeof fetch !== "function") { systemFonts = []; updateFontStatus(root); return; }
      if (fontFetchPromise) return; // 已在读取中
      updateFontStatus(root);
      fontFetchPromise = fetch("/dsh-custom-font/fonts" + (force ? "?refresh=1" : ""))
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

    function buildPanel(root) {
      root.replaceChildren();

      root.appendChild(el("style", { text: PANEL_CSS }));

      // 系统字体库状态 + 刷新按钮
      var fontStatus = el("div", { class: "font-status" });
      fontStatus.appendChild(el("span", { class: "font-status-text", text: "" }));
      var refreshFontBtn = el("button", { type: "button", text: "刷新字体列表" });
      refreshFontBtn.addEventListener("click", function () { forceRefreshSystemFonts(root); });
      fontStatus.appendChild(refreshFontBtn);
      root.appendChild(fontStatus);

      root.appendChild(el("div", { class: "desc", text: "像 Word 一样改字体、字号、加粗，改动即时生效并自动保存。西文字体控制英文/数字，中文字体控制汉字；字体取自你电脑已安装的字体。" }));

      // 预览（直接用 p / h2 / code，跟随下方设置实时变化）
      var preview = el("div", { class: "preview" });
      preview.appendChild(el("div", { class: "preview-label", text: "预览（跟随当前设置）" }));
      preview.appendChild(el("h2", { class: "pv", text: "标题示例 H2" }));
      preview.appendChild(el("p", { class: "pv", text: "正文示例：春眠不觉晓，处处闻啼鸟。Hello 123" }));
      preview.appendChild(el("code", { class: "pv", text: "代码示例 const x = 1;" }));
      root.appendChild(preview);

      // 正文
      var bodyGroup = el("div", { class: "group" });
      bodyGroup.appendChild(el("div", { class: "group-title", text: "正文" }));
      bodyGroup.appendChild(buildFieldRow("中文字体", makeFontSelect("bodyFont")));
      bodyGroup.appendChild(buildFieldRow("西文字体", makeFontSelect("bodyFontEn")));
      bodyGroup.appendChild(buildFieldRow("字号", el("span", null, [makeSizeInput("bodySize"), el("span", { class: "unit", text: "px" })])));
      bodyGroup.appendChild(buildFieldRow("加粗", makeWeightSelect("bodyWeight")));
      bodyGroup.appendChild(buildFieldRow("颜色", makeColorInput()));
      root.appendChild(bodyGroup);

      // 标题
      var headGroup = el("div", { class: "group" });
      headGroup.appendChild(el("div", { class: "group-title", text: "标题（各级标题统一）" }));
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

      // 界面文字（一般设置）：让界面也使用正文字体
      var uiFollowRow = el("div", { class: "row-check" });
      var uiFollowCb = el("input", { type: "checkbox" });
      uiFollowCb.checked = !!settings.uiFollow;
      uiFollowCb.addEventListener("change", function () { settings.uiFollow = uiFollowCb.checked; commit(); });
      uiFollowRow.appendChild(uiFollowCb);
      uiFollowRow.appendChild(el("span", { text: "界面文字（按钮、菜单）也使用正文字体" }));
      root.appendChild(uiFollowRow);

      // 高级设置（默认收起）
      var advArea = el("div", { class: "adv-area" });
      advArea.style.display = "none";

      advArea.appendChild(el("div", { class: "adv-section-title", text: "标题层级 h1 ~ h6（勾选后独立设置；不勾选则继承上面的「标题」）" }));
      [["h1", "H1 一级标题"], ["h2", "H2 二级标题"], ["h3", "H3 三级标题"], ["h4", "H4 四级标题"], ["h5", "H5 五级标题"], ["h6", "H6 六级标题"]].forEach(function (p) {
        advArea.appendChild(makeAdvancedItem(p[0], p[1]));
      });

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

      // 操作
      var actions = el("div", { class: "actions" });
      var resetBtn = el("button", { type: "button", text: "恢复默认" });
      resetBtn.addEventListener("click", function () {
        settings = clone(DEFAULTS);
        try { localStorage.removeItem(STORAGE_KEY); } catch (e) { /* 忽略 */ }
        applyCss();
        buildPanel(root);
      });
      actions.appendChild(resetBtn);
      actions.appendChild(el("span", { class: "hint", text: "提示：字体名若电脑上没有，浏览器会自动用后备字体显示。" }));
      root.appendChild(actions);

      // 后台读取系统字体库，读到后自动扩充下拉框
      ensureSystemFonts(root);
    }

    function FontSettingsPanel() {
      var ref = React.useRef(null);
      React.useEffect(function () {
        if (ref.current) buildPanel(ref.current);
      }, []);
      return React.createElement("div", { className: "dsh-font-settings", ref: ref });
    }

    /* ================= 注册 ================= */
    function apply(ctx) {
      // 初始样式在模块加载时就已注入（见文件末尾 applyCss()），
      // 这里再执行一次确保覆盖任何更晚的宿主样式。
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

    exports.apply = apply;
    exports.inject = ["slots"];
    exports.name = "dsh-custom-font";
    return module.exports;
  }
});
