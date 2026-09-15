# dsh-custom-font

一个 DeepSeek Harness（DSH）插件：像 Word 一样，在设置页里直观地修改界面文字的
**字体 / 字号 / 加粗 / 颜色 / 版式**，改动**即时生效（所见即所得）**并**自动保存**。

A DeepSeek Harness plugin for customizing fonts, sizes, weights, colors and layout —
Word-style, WYSIWYG, auto-saved.

**自带两套开源字体**（STIX2Text、Latin Modern Mono Light），并内置一套**作者推荐**的排版，
装上就能看到效果——**不需要你先去装字体，也不会改动你的系统**。

## 功能特性

- ✅ 像 Word 一样改：选字体、改字号、调加粗、选颜色，改动立刻应用到整个界面
- ✅ **自动读取 Windows 已装字体库**（200+ 个字体自动进下拉框，可一键刷新）
- ✅ **中英文分开设置**：中文字体管汉字，西文字体管英文与数字（正文、标题各一套）
- ✅ **插件内置字体**：自带 STIX2Text 与 Latin Modern Mono Light，任何电脑上效果一致；
  不写注册表、不需要管理员权限，可在高级设置里关闭
- ✅ **一键「应用作者推荐」**：一套现成的公文/学术观感排版（见下）
- ✅ **版式可调**（高级设置）：正文两端对齐、一级标题居中 / 不加粗、引用块斜体 + 左侧竖线、
  行内代码灰底、表头深底浅字、链接颜色
- ✅ **分三类基础设置**：正文 / 标题 / 代码
- ✅ **高级设置**（可展开）：h1~h6 逐级自定义，引用 / 行内代码 / 代码块 / 界面文字逐项可调
- ✅ **设置存在 `~/.dsh`**：换桌面外壳不会丢，还能导出 / 导入
- ✅ 深色模式下正文色自动不生效，链接自动换成亮蓝，避免看不清
- ✅ 一键恢复默认值

## 安装

```bash
npx @deepseek-ai/dsh plugin --profile web add dsh-custom-font
```

> `web` 换成你实际使用的 profile 名。桌面版与 `dsh web` 网页版都可用。

## 使用

1. 打开 DeepSeek Harness → **设置** → 左侧 **「自定义字体」**
2. 基础页三栏：**正文**（中文字体 / 西文字体 / 字号 / 加粗 / 颜色）、**标题**、**代码**
3. 想改细节就点 **「高级设置」**：
   - **h1~h6 逐级**自定义（勾选后独立设置，不勾选则继承上面的「标题」）
   - **内置字体**开关与当前状态
   - **版式**：两端对齐、一级标题居中/不加粗、引用竖线、行内灰底、表头深底浅字、链接颜色
   - **其他格式**：引用 / 行内代码 / 代码块 / 界面文字
4. 改完即时生效、自动保存。设置文件在 `~/.dsh/dsh-custom-font/settings.json`，
   也可以点「导出设置」「导入设置」备份或搬到别的机器。

## 作者推荐

插件内置一套作者推荐的排版（**是推荐，不是规定**——任何一项都可以改掉）：

| 元素 | 设置 |
|---|---|
| 正文 | 西文 STIX2Text + 中文 仿宋_GB2312（回落仿宋） / 16px / 常规 / 纯黑 / 两端对齐 |
| 一级标题 `#` | 方正小标宋简体 / 22px / **不加粗** / 居中 |
| 二级标题 `##` | 黑体 / 18px / 900 |
| 三级标题 `###` | 楷体_GB2312 / 18px / 900 |
| 四~六级标题 | 仿宋_GB2312 / 18px / 900 |
| 代码 | Latin Modern Mono Light / 行内 14px 带灰底 |
| 引用块 | 继承正文 / 斜体 / 左侧 2px 竖线 `#a2a9b1` |
| 链接 | DeepSeek 蓝 `#4D6BFE`（悬停 `#2E4FD8`；深色模式自动换亮蓝） |
| 表格 | 表头黑体 700 / 深底浅字 `#575c61` / 边框 `#a2a9b1` |

点设置页的「**应用作者推荐**」即可一次写好；改乱之后也可以用它复位。

**关于数字**：数字与英文一样，跟随你选的**西文字体**（字体栈里西文排在中文之前）。
中文字体本身也含数字字形，所以顺序反了数字会悄悄变成中文样式——插件保证了这个顺序。

## 字体从哪来

插件内置以下两套**开源字体**（共 7 个 WOFF 文件，约 820 KB），随插件一起分发：

| 字体 | 用途 | 许可证 |
|---|---|---|
| [STIX Two Text](https://www.stixfonts.org/)（4 个字重） | 作者推荐的西文正文字体 | SIL Open Font License 1.1 |
| [Latin Modern Mono Light](https://www.gust.org.pl/projects/e-foundry/latin-modern)（3 个字重） | 作者推荐的代码字体 | GUST Font License |

许可证原文与说明见 [`assets/fonts/LICENSE-FONTS.md`](assets/fonts/LICENSE-FONTS.md)。
字体文件**只在需要时**由本地宿主端返回给浏览器，不联网下载。

> 想让自己系统里也装上这两套字体（给 Word、Obsidian 等其他软件用）：
> 可以把 `assets/fonts/` 下的 WOFF 转成 TTF/OTF 后安装；插件本身不需要这一步。

## 工作原理（给开发者）

- **宿主端** `lib/index.js`
  - `GET /dsh-custom-font/fonts`：用 PowerShell（.NET `InstalledFontCollection`）读取 Windows 已装字体，
    返回「中文名 + 英文名」清单（内存缓存，`?refresh=1` 强制重读）
  - `GET/POST /dsh-custom-font/settings`：读写设置文件，写入按**类型白名单**过滤，先写临时文件再改名（原子写入）
  - `GET /dsh-custom-font/settings/export`：导出设置文件原文
  - `GET /dsh-custom-font/font-manifest`、`GET /dsh-custom-font/font-asset?name=…`：内置字体清单与文件本体
    （文件名走白名单校验，防目录穿越）
- **客户端** `client/client.js`
  - 注册一个 `settings.section` 设置页
  - 按当前设置生成一个 `<style>`（`!important` 作用于 `p / h1~h6 / code / blockquote / a / table` 等，
    并写 `--dsw-font-*` 变量）——样式内容变化时会替换，避免升级后新样式不生效
  - 内置字体以 `@font-face` + blob URL 注入，`font-display: swap`
  - 启动时优先读宿主设置文件；读到旧版 localStorage 里的设置会自动迁移上去
- **设置文件**：`~/.dsh/dsh-custom-font/settings.json`（`$DSH_HOME` 优先）。
  为什么不放浏览器 localStorage：它按「外壳应用数据目录 + 访问源」隔离，**换一个桌面外壳就丢一次**。

## 常见问题

**问：字体下拉框里没有某个字体，直接输入字体名行吗？**
下拉框取自你系统已装的字体。想用没装的字体，可以选一个字体后手动改设置文件里的名字，
但浏览器会回退到后备字体——**这正是插件要把两套推荐字体内置进来的原因**。

**问：为什么正文数字的字形跟中文不一样？**
这是设计如此：数字跟随西文字体（作者推荐里是 STIX2Text）。

**问：改了设置换台电脑就没了？**
设置跟着 `~/.dsh` 走，不跟着外壳走。换电脑请用「导出设置 / 导入设置」。

**问：我不喜欢这套排版。**
基础页逐项改即可；「应用作者推荐」只是把推荐值批量写进去的快捷方式，随时可以再改。

## 目录结构

```
dsh-custom-font/
├── package.json          # 插件元信息 + dsh 声明
├── cordis.patch.yml      # 插入 profile 的补丁
├── lib/
│   ├── index.js          # 宿主端：字体库 / 设置 / 字体资源 接口
│   ├── config.js         # 设置文件读写（原子写入 + 类型白名单）
│   └── fonts.js          # 内置字体清单与文件读取
├── client/client.js      # 客户端：设置页 UI + 样式生成
├── assets/fonts/         # 内置字体（WOFF）+ 许可证说明
├── test/                 # 自检（清单 / 宿主端 / 客户端）
└── CHANGELOG.md
```

## 自检

```bash
npm test
```

三套用例：清单一致性、宿主端接口与设置文件、客户端样式生成与设置链路。
其中包含对作者推荐排版逐条的断言、目录穿越拒绝、以及"数字跟随西文"的字体栈顺序断言。

## License

插件代码：MIT。
内置字体：各自的开源许可证，见 [`assets/fonts/LICENSE-FONTS.md`](assets/fonts/LICENSE-FONTS.md)。
