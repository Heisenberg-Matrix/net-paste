# NetCmd 项目体验总结

> 这份文档记录 NetCmd 全部的体验决策和维护方法，长期更新。
> 改任何交互、颜色、命令之前，先看这份文档。

## 一句话定位

网络工程师自己用的「网络命令复制粘贴器」。不教命令、不执行命令，只做一件事：

**打开页面 → 一眼找到熟悉的命令 → 点击 → 复制 → 去终端粘贴。**

### 唯二 KPI

| 场景 | 目标 |
|---|---|
| 无参数命令 | **1 Click → Clipboard** |
| 有参数命令 | **1 Click → Fill → Enter → Clipboard** |

任何改动如果不能改善这两条，就不要做。

## 核心交互

### 无参数命令

- 点击命令行任意位置或 `Copy` 按钮 → 立即复制完整命令。
- 反馈：按钮变绿显示 `Copied`，1.2 秒后恢复。**没有任何需要关闭的弹窗。**

### 有参数命令（所见即所得）

- 命令里的 `{peer}`、`{interface}`、`{ip}`、`{vlan}` 等占位符以橙色显示，**本身就是可点击的**。
- 点击占位符 → **原地**变成内联输入框（虚线下划线，融入命令文本），直接输入。
- 多参数模板：点击后所有占位符同时变为输入框，焦点落在你点击的那个；重新点击行则聚焦第一个还没填的。
- 同名参数出现多次：只显示为一个输入点，Enter 后替换所有同名占位符。
- **Enter →** 值直接填进命令行（绿色显示最终命令）**并复制到剪贴板**，不需要第二次点 Copy。
- `Esc` 取消编辑，已输入的值保留，下次点击还在。
- 已填的绿色值可以再次点击修改，改完再 Enter 重新复制。
- 空着的参数复制时保留 `{xxx}` 原样。

### 命令列表

- 命令固定排列，方便形成视觉和肌肉记忆。
- 每行 = 短名称（灰色，可选） + 完整命令（等宽字体，参数高亮） + Copy + 删除 ×。
- **名称列可隐藏**：右上角「隐藏名称 / 显示名称」切换，偏好存 localStorage。
- **新增命令时 Name 是可选的**，只填 Template 即可保存。
- 一屏尽量看到所有常用命令：13px 等宽字体、紧凑行距、无卡片、无留白。

### 删除命令

- 每条命令（内置和自定义）行尾都有 ×，点击直接删除，无确认弹窗。
- 自定义命令：从 `netcmd.custom` 里移除。
- 内置命令：模板记入 `netcmd.hidden`，刷新后仍然隐藏。
- 恢复内置命令：浏览器控制台执行 `localStorage.removeItem('netcmd.hidden')` 后刷新。

## 大区分类（颜色系统）

每个分类一个颜色：**标题条用主题色（accent），命令行用同一色的半透明背景（tint）**。

### 颜色原则

1. **不遮挡字体**：背景 alpha 控制在 0.05～0.07，正文永远是深色 `#222`，任何分类下命令都清晰可读。
2. **护眼**：全部预设都是低饱和色，无大面积纯色，无高对比闪烁。
3. **半透明**：tint 是半透明叠加在页面底色上，hover 时再叠一层 4% 黑色（inset shadow），不改变文字颜色。

### 内置分类

| 分类 | 颜色 | accent | 背景 tint |
|---|---|---|---|
| 华三 | 浅红（半透明背景） | `#b0524a` | `rgba(176, 82, 74, 0.07)` |
| IB（英伟达 InfiniBand 交换机） | 浅绿（高级感） | `#0e7a5f` | `rgba(14, 122, 95, 0.05)` |

### 分类管理

- **+ Add category**：输入分类名 + 从护眼色板里选一个颜色（色块点选，默认浅蓝）。
- 自定义分类**只在为空时可以删除**（标题条右侧 ×）；分类下还有命令时先删命令。
- 自定义命令保存时可以选择所属分类；没选的进入「未分类」（灰色，只在有内容时显示）。
- 分类数据存 localStorage，刷新不丢。

### 护眼色板（可选预设）

浅红 / 浅绿 / 浅蓝 / 浅黄 / 浅紫 / 浅青 / 灰。加新颜色改 `app.js` 里的 `COLOR_PRESETS`。

## 内置命令清单

只收录**查询类、安全**的命令，绝不收录配置修改命令。

- **华三（14 条）**：`display ip routing-table`、`display current-configuration`、`display ip interface brief`、`display arp all`、`display mac-address`、`display vlan`、`display lldp neighbor brief`、`display ospf peer brief`、BGP peer / advertised / received routes、`display interface {interface}`、`display ip routing-table {ip}`、`display vlan {vlan}`
- **IB（10 条）**：`ibstat`、`ibnetdiscover`、`ibqueryerrors`、`ibdiagnet`、`ibhosts`、`ibswitches`、`smpquery portcounters {lid}`、`show version`、`show inventory`、`show running-config`

## 数据存储

全部在浏览器 localStorage，无后端、无账号、无同步：

| key | 内容 |
|---|---|
| `netcmd.custom` | `[{name, template, cat}]` 自定义命令 |
| `netcmd.categories` | `[{id, name, color}]` 自定义分类（内置华三/IB 不在此列） |
| `netcmd.hidden` | `[template, ...]` 用户删除的内置命令 |
| `netcmd.hideName` | `"1"` = 隐藏名称列 |

清掉浏览器数据 = 自定义内容清空，属预期行为。

## 维护指南

- **加内置命令**：改 `app.js` 顶部 `BUILTINS` 数组（`cat` 填 `h3c` / `ib`）。
- **加内置分类**：改 `DEFAULT_CATEGORIES`。
- **调颜色**：改 `COLOR_PRESETS` 里的 `accent`（标题色）和 `bg`（半透明行背景），保持 alpha ≤ 0.07。
- **改交互反馈**：Copied 时长在 `showCopied()`（当前 1200ms）。

## 永远不做

用户系统、登录、后端、数据库、云同步、AI、SSH/NETCONF、命令执行、设备连接、审计、日志、复杂搜索、标签、收藏、拖拽排序、树状命令、插件、模板市场、多用户、测试框架、CI/CD、Docker、"未来可扩展架构"。不为以后可能需要而提前设计。

## 版本记录

| 版本 | 内容 |
|---|---|
| v0.1 | 初始：无参 1-click 复制、参数表单、自定义模板 localStorage |
| v0.1.1 | 参数所见即所得：点 `{}` 原地输入，Enter 直接复制 |
| v0.1.2 | 大区分类 + 颜色系统（华三浅红 / IB 浅绿）、分类可添加可选色、本体验文档 |
| v0.1.3 | 修复自定义命令删除失效；内置命令也可删除（记入 netcmd.hidden）；名称列可隐藏；新增命令 Name 改为可选 |
