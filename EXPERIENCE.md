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
- 反馈（强调确定感，但仍无弹窗）：按钮变绿显示 `✓ Copied` 并轻微弹跳一下；**整行闪一下绿色（0.6 秒渐隐回分类底色）**，扫一眼就知道复制成了哪条。

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

### 删除与批量清除

所有删除/清除动作统一用**两步内联确认**：第一次点击按钮变成红色 `Sure?`，2.5 秒内再点一次才执行。没有模态弹框，不打断复制主流程。

- **单条命令**：行尾 × → 确认后从 `netcmd.commands` 删除。
- **分类操作 = 右键菜单**：右键分类标题（或 hover 出现的 ⋯ 按钮）弹出菜单：
  - **Clear all commands**：该分类下所有命令一次删除（解决逐条删慢的问题）
  - **Delete category**：随时可删，里面的命令**不丢**，自动落到 Uncategorized
- 删掉的命令想找回：Add command 重新加，或整体重置（见维护指南）。

### 拖动排序

- 飞书风格 **grip 手柄**：每行/每个分类标题前有六个点（⠿），hover 行时出现，移上去鼠标变抓手（grab），拖动中全局变 grabbing。
- **只能从 grip 拖动**（按下 grip 才启用拖拽），避免误拖和选字冲突；参数编辑中 grip 也无效。
- **命令行**：拖到目标位置（插入线指示落点）；拖到另一分类的行上/空白处 = 移动到该分类。
- **分类**：拖 grip 到另一个分类标题上 = 调整分类顺序。
- 排序结果即 `netcmd.commands` / `netcmd.categories` 的存储顺序。

### 数据替换（YAML）

页面底部 **Data (YAML)** 折叠框：

- 打开即显示当前全部数据的 YAML（categories + commands，所见即所得）。
- 直接改文本 → **Replace all**（两步确认）→ **整体替换**所有命令和分类。
- **Export** 下载文本框内容为 .yaml 文件；**Import** 载入本地 .yaml 到文本框（提示 review 后再 Replace all）。
- **Reload** 从存储重新生成（撤销手改）。
- YAML 只支持本工具生成的子集（`categories:` / `commands:` 两个列表），不追求通用；注释、单双引号、转义都支持。
- 换电脑/换浏览器：Export → 新环境 Import → Replace all。

## 大区分类（颜色系统）

每个分类一个颜色：**标题条用主题色（accent），命令行用同一色的半透明背景（tint）**。

### 颜色原则

1. **不遮挡字体**：背景 alpha 控制在 0.05～0.07，正文永远是深色 `#222`，任何分类下命令都清晰可读。
2. **护眼**：全部预设都是低饱和色，无大面积纯色，无高对比闪烁。
3. **半透明**：tint 是半透明叠加在页面底色上，hover 时再叠一层 4% 黑色（inset shadow），不改变文字颜色。
4. **圆角与阴影只给可交互控件**：按钮 4px 圆角 + `0 1px 2px rgba(0,0,0,0.05)` 极轻阴影；文本框/折叠框 6px；命令行、分类行保持全平（保密度）。禁止大圆角、渐变、重阴影。

### 内置分类

| 分类 | 颜色 | accent | 背景 tint |
|---|---|---|---|
| H3C（华三） | 浅红（半透明背景） | `#b0524a` | `rgba(176, 82, 74, 0.07)` |
| IB（英伟达 InfiniBand 交换机） | 浅绿（高级感） | `#0e7a5f` | `rgba(14, 122, 95, 0.05)` |

**UI 语言：界面全部英文**（Hide names / clear / delete / Uncategorized…），本文档保持中文。

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

全部在浏览器 localStorage，无后端、无账号、无同步。

**统一模型（schema 2）**：代码里的 `SEED_CATEGORIES` / `SEED_COMMANDS` 只是「出厂预设」，只在首次打开（或清空浏览器数据）时种入 localStorage。之后**所有命令和分类都是同一份用户数据**，增删改全走页面 UI，代码预设永不覆盖用户数据。

| key | 内容 |
|---|---|
| `netcmd.commands` | `[{name, template, cat}]` 全部命令（出厂 + 用户添加） |
| `netcmd.categories` | `[{id, name, color, builtin?}]` 全部分类（`builtin: true` = 出厂自带） |
| `netcmd.hideName` | `"1"` = 隐藏名称列 |
| `netcmd.schema` | 数据格式版本标记，当前 `"2"` |

从 v0.1.4 及更早版本升级时会自动迁移：已删的内置命令保持删除、自定义命令保留、自定义分类保留，旧 key（`netcmd.custom` / `netcmd.hidden`）迁移后清除。

清掉浏览器数据 = 恢复出厂预设，自定义内容清空，属预期行为。

## 维护指南

- **加命令 / 加分类**：直接用页面上的 + Add command / + Add category，不用改代码。
- **改出厂预设**（只影响新浏览器或重置后）：改 `app.js` 顶部 `SEED_COMMANDS` / `SEED_CATEGORIES`。
- **调颜色**：改 `COLOR_PRESETS` 里的 `accent`（标题色）和 `bg`（半透明行背景），保持 alpha ≤ 0.07。
- **改交互反馈**：Copied 时长在 `showCopied()`（当前 1200ms）；确认窗口在 `armConfirm()`（当前 2500ms）。
- **恢复出厂命令**：删掉的命令想找回，用 Add command 重新加即可；或控制台 `localStorage.removeItem('netcmd.commands'); localStorage.removeItem('netcmd.schema'); location.reload()` 重置全部命令（自定义的也会丢，慎用）。

## 永远不做

用户系统、登录、后端、数据库、云同步、AI、SSH/NETCONF、命令执行、设备连接、审计、日志、复杂搜索、标签、收藏、拖拽排序、树状命令、插件、模板市场、多用户、测试框架、CI/CD、Docker、"未来可扩展架构"。不为以后可能需要而提前设计。

## 版本记录

| 版本 | 内容 |
|---|---|
| v0.1 | 初始：无参 1-click 复制、参数表单、自定义模板 localStorage |
| v0.1.1 | 参数所见即所得：点 `{}` 原地输入，Enter 直接复制 |
| v0.1.2 | 大区分类 + 颜色系统（华三浅红 / IB 浅绿）、分类可添加可选色、本体验文档 |
| v0.1.3 | 修复自定义命令删除失效；内置命令也可删除（记入 netcmd.hidden）；名称列可隐藏；新增命令 Name 改为可选 |
| v0.1.4 | UI 全英文（华三→H3C）；所有删除动作两步确认（Sure?）；分类一键 clear；底部 Clear custom categories |
| v0.1.5 | 数据模型统一：命令/分类全部外置到 localStorage（schema 2），代码仅保留出厂预设，旧数据自动迁移；任何空分类可删 |
| v0.1.6 | 拖动排序（命令跨分类拖动、分类拖动排序）；YAML 数据替换（编辑/打开文件/下载/整体替换）；分类操作改为右键菜单 + ⋯ 按钮，删分类不再要求先清空 |
| v0.1.7 | 移除底部 Clear custom categories（右键菜单已覆盖）；飞书风格 grip 拖拽手柄（仅 grip 可拖、grab/grabbing 光标）；修复 Sure? 确认后按钮不恢复；YAML 按钮改名 Export / Import |
| v0.1.8 | 控件圆角化：按钮 4px + 极轻阴影，输入框/折叠框 6px，YAML 文本框 focus 高亮，行保持全平 |
| v0.1.9 | 复制反馈增强：✓ Copied + 按钮弹跳 + 整行绿色闪烁渐隐 |
