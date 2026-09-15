# 内置字体许可说明

本目录下的字体文件随本插件（dsh-custom-font）一起分发，供「作者推荐」排版使用。
它们**不是**本插件的作品，版权归原作者所有，按各自的开放许可证再分发。

## 一、STIX2Text（4 个字重）

| 项 | 内容 |
|---|---|
| 文件 | `STIX2Text-Regular.woff`、`STIX2Text-Italic.woff`、`STIX2Text-Bold.woff`、`STIX2Text-BoldItalic.woff` |
| 上游 | STIX Two Text（Version 2.0.0，2016），由 STI Pub Companies 发布 |
| 许可证 | **SIL Open Font License 1.1**（OFL-1.1） |
| 官方地址 | <https://www.stixfonts.org/> · <https://github.com/stipub/stixfonts> |

OFL 允许自由使用、修改、再分发（含随软件打包），条件包括：
保留版权与许可声明；**衍生版本不得使用保留字体名（Reserved Font Name）**。

> 本插件的处理：这里分发的是**上游原始字形**，未做任何轮廓修改；
> `font-family` 使用名 `STIX2Text`（上游排版族名为 `STIX Two Text`）。
> 若将来需要修改字形，必须按 OFL 改名后再分发。

## 二、Latin Modern Mono Light（3 个字重）

| 项 | 内容 |
|---|---|
| 文件 | `LMMonoLt10-Regular.woff`、`LMMonoLt10-Italic.woff`、`LMMonoLt10-Bold.woff` |
| 上游 | Latin Modern Mono Light 10（GUST e-foundry / B. Jackowski & J. M. Nowacki） |
| 许可证 | **GUST Font License**（等同于 LaTeX Project Public License 1.3c 或更新版本） |
| 官方地址 | <https://www.gust.org.pl/projects/e-foundry/latin-modern> |

GUST Font License 允许使用、修改、再分发，条件包括：
保留许可证与版权声明；**衍生版本改名并附带 manifest 说明改动**。

> 本插件的处理：这里分发的是上游原始字体（原名 `LM Mono Light 10`，排版族名 `Latin Modern Mono Light`），
> 未做轮廓修改；`font-family` 使用其**排版族名** `Latin Modern Mono Light`。
> 完整改动记录见仓库外的转换说明（本插件只做分发，未生成衍生字体）。

## 三、这些字体为什么放在插件里

「作者推荐」排版指定的西文字体（STIX2Text）与代码字体（Latin Modern Mono Light）
**不是 Windows 自带字体**。若不随插件提供，用户电脑没装时浏览器会**静默回退**到别的字体，
用户以为在用推荐排版，实际不是，且界面上没有任何提示。

内置之后：装上插件即可看到一致的排版效果，**不修改用户系统**、不写注册表、不需要管理员权限。

用户若希望系统里也装上（便于 Word / Obsidian 等其他软件使用），
可在插件设置 → 高级设置里看到说明，或使用仓库附带的一键安装脚本。
