# dsh-custom-font

一个 DeepSeek Harness（DSH）插件：像 Word 一样，在设置页里直观地修改界面文字的 **字体 / 字号 / 加粗 / 颜色**，改动**即时生效（所见即所得）**并**自动保存**。

A DeepSeek Harness plugin for customizing fonts, sizes, weights, and colors across the whole interface — Word-style and WYSIWYG.

> 目前只支持 Windows（自动读取系统已装字体，不附带、不安装任何字体）。桌面版与 `dsh web` 网页版均可用。

## 功能特性

- ✅ 像 Word 一样改：选字体、改字号、调加粗、选颜色
- ✅ **所见即所得**：改动立刻应用到整个界面，无需重启
- ✅ **自动读取系统字体库**：Windows 下 200+ 个已装字体自动进下拉框，可一键刷新
- ✅ **中英文分开设置**：中文字体管汉字、西文字体管英文/数字（正文、标题各一套）
- ✅ 分三类基础设置：**正文 / 标题 / 代码**
- ✅ **高级设置**（可展开）：
  - h1~h6 六个标题层级逐级自定义
  - 引用（blockquote）、行内代码（code）、代码块（pre）
  - 界面文字（按钮、菜单）也可自定义字体 / 字号 / 加粗
- ✅ 自动保存（localStorage），下次打开依然是你的设置
- ✅ 一键「恢复默认」
- ✅ 深色模式下正文字色自动不生效，避免黑字看不清

## 安装

### 方式一：从 GitHub / npm 安装（普通用户）

```bash
npx @deepseek-ai/dsh plugin --profile web add dsh-custom-font
```

### 方式二：本地 link（开发调试）

```bash
# 1. 把本目录放到一个「没有空格」的路径（例如 C:/Users/you/dsh-custom-font）
# 2. link 进 web profile：
npx @deepseek-ai/dsh plugin --profile web add "link:C:/Users/you/dsh-custom-font"
```

> ⚠️ 路径里不能有空格（pnpm 会截断路径报错）。

## 使用方法

1. 打开 DeepSeek Harness → 进入**设置** → 找到左侧 **「自定义字体」**。
2. **基础设置**（三栏）：
   - **正文**：中文字体 / 西文字体 / 字号(px) / 加粗 / 颜色
   - **标题**：中文字体 / 西文字体 / 字号(px) / 加粗（各级标题统一）
   - **代码**：字体 / 字号(px) / 加粗
   - 勾选「界面文字也使用正文字体」让按钮、菜单一起换字体
3. 点 **「高级设置」** 展开：
   - **标题层级 h1~h6**：勾选某个层级即可单独设置（不勾选则继承基础「标题」）
   - **其他格式**：引用 / 行内代码 / 代码块
   - **界面文字**：勾选后自定义界面的字体 / 字号 / 加粗
4. 改完即时生效、自动保存；点「刷新字体列表」可同步新装的字体。

## 工作原理（给开发者）

- **宿主端** `lib/index.js`：用 PowerShell（.NET `InstalledFontCollection`）读取 Windows 已装字体库，得到「中文名 + 英文名」清单，通过本地只读接口 `/dsh-custom-font/fonts` 提供给浏览器，结果在内存缓存。
- **客户端** `client/client.js`：注册一个 `settings.section` 设置页；按当前设置动态生成一个 `<style>`（用 `!important` 作用于 `p / h1~h6 / code` 等元素 + `--dsw-font-*` 变量）。
- 设置保存在 `localStorage` 的 `dsh-custom-font/settings` 键。
- 中英分离原理：字体栈写成 `"西文字体", "中文字体", 后备`，浏览器对英文/数字用前者、对汉字用后者。

## 目录结构

```
dsh-custom-font/
├── package.json          # 插件元信息 + dsh 声明
├── cordis.patch.yml      # 插入 profile 的补丁
├── lib/index.js          # 宿主端（读 Windows 字体库 + 提供 /fonts 接口）
├── client/client.js      # 客户端：设置页 + 即时样式
├── README.md
└── LICENSE
```

## License

MIT
