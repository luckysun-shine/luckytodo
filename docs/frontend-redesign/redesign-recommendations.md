# LuckyTodo 前端重设计建议

本文件是目标与迁移原则，不是实施任务。每条都对应 `current-state-audit.md` 里的代码事实。后端契约（同步、媒体、家庭、洞察）保持不动。

## 目标架构

继续以 `apps/web` 为 Capacitor `webDir`，继续用原生 ES Module，在现有 `index.html` 上替换屏幕实现。数据层保持 `db.js` + `api.js` 的「先写 IndexedDB，家庭模式再入队同步」。

不把第一阶段定义成引入 React/Vue。原因：仓库没有打包器，页面逻辑全部在 `app.js` 的命令式 `render()` 里。先换框架会把「可运行的同步、提醒、小组件」和「新视图层」绑成一次重写，无法按页面回滚。

目标模块边界：

```
apps/web/index.html
apps/web/app.js                 只保留 boot、订阅在线状态、调用 render
apps/web/src/state.js           屏幕、返回栈、各页自己的筛选；不再用一个 query 服务所有页
apps/web/src/nav.js             push/back，并同步 history（见下）
apps/web/src/screens/           每个 screen 或 tab 一个模块
apps/web/src/ui/                按钮、字段、列表行、空状态、sheet、toast、确认框
apps/web/src/domain/            日期键、周期文案、提醒时间计算（从 app.js 与 widgetBridge 各一份里收口）
apps/web/src/api.js             保持导出，不改 URL
apps/web/src/db.js              保持库名 luckytodo-v1
apps/web/src/native.js          唯一的 Capacitor 入口
apps/web/src/styles.js          先保留注入方式；token 分层后再考虑拆文件
```

`h()` 可以留下，作为唯一 DOM 构造器，直到某个屏幕证明需要更细的更新粒度。不要并行再写一套 innerHTML 模板。

### 建议：用历史栈表达层级，而不是只改 `state.tab`

- 解决的问题：`render()` 不写 history；`native.js` 的 `backButton` 在 `canGoBack` 时调用 `history.back()`，否则 `exitApp()`。计划详情、表单、个人中心没有历史条目。
- 影响范围：`native.js`、`boot`、`render`、`tabs`、`openPlanDetail`、`openCreateForm`、`closeForm`。深链 `bindDeepLinks` 改为走同一套 `nav`。
- 风险：WebView 与浏览器对 `popstate` 的时机不同；若 push 过多，系统返回会先关闭表单再退出，这是期望行为，但要避免一次点击 push 两条。
- 前置条件：先列出层级（认证流、主 Tab、个人中心/洞察、计划详情、新建菜单、全屏表单、裁剪层）。裁剪层目前挂在 `document.body`，返回栈要能关掉它。

建议的栈（手机）：

1. 认证：登录 ↔ 注册 → 家庭门 →（可选）合并 → 主壳。
2. 主壳 Tab 不逐次压栈；切换 Tab 使用 `replace`，避免返回键在五个 Tab 之间循环。
3. 压栈：个人中心、洞察、计划详情、创建菜单、表单。
4. 栈空时系统返回才 `exitApp()`。浏览器桌面没有硬件返回，要保留页内返回按钮。

刷新：把 `tab`、`planId` 写入 query 或 hash。认证页不要把令牌放进 URL。现有 `#luckytodo` 深链保持可解析。

### 建议：停止整页销毁输入中的 DOM

- 解决的问题：首页搜索每次 `input` 调用 `render()`，光标丢失；表单 `draftPatch` 靠记住 `scrollTop` 和 `skipAutoFocus` 补救。
- 影响范围：所有屏幕的事件绑定。拆屏之后，搜索应只替换列表节点。
- 风险：局部更新如果忘记在同步完成后刷新列表，会出现「已勾选但 UI 仍是旧状态」。完成待办这条路径今天靠整页 `render()` 保证一致。
- 前置条件：屏幕拆出之后再做。不要在 4200 行文件里先加一套 diff。

## 信息架构

手机（保持现有可发现性）：

- 底栏：首页、待办、计划、日历、便签。
- 二级：个人中心（头像）、洞察、计划详情。
- 全局添加：FAB 打开「便签 / 待办 / 日程 / 计划」。儿童仍不能新建日程和计划（`openCreateForm` 已有判断）。
- 认证与家庭门保持全屏，不显示底栏。

桌面（宽度足够时改变壳，不改变功能）：

- 左侧：同一五项加个人入口。不要在宽屏上把 430px 列居中后留下大块空白当作「桌面版」。
- 中间：当前 Tab 列表。
- 右侧：计划详情或只读摘要。没有选中项时显示当日事项，而不是再打开一个全屏 `form-screen` 盖住唯一列。
- 新建表单在桌面用对话框（限制最大宽度），在手机继续全屏。底层仍是同一份字段定义。

需要从产品上补进信息架构、而不是只换布局的缺口：

- 待办、便签、日程、计划打开后是同一条记录的编辑，而不是空白新建。证据：便签卡片调用 `openCreateForm('note')`。
- 删除与计划归档要有明确位置。今天 `deletedAt` 与 `archived` 都没有写入界面。
- 「已归档」筛选、洞察页「去我的配置模型」、忘记密码，这三处文案超过了实现，重做时要么做完要么改文案。
- 搜索属于各自页面。现在 `state.query` 跨 Tab 共享。

`admin.html` 保持运维入口，不并进家庭五栏。若以后要在 App 里配置 AI，只能配置开关与模型名，不能把 `AI_API_KEY` 放进前端包。

## 组件分层

| 层 | 内容 | 现在在哪 | 重做时的约束 |
| --- | --- | --- | --- |
| Token | 颜色、字号、间距、圆角、阴影、安全区、键盘底部 | `:root` 与 `#app` 混在一起；夜间强调色另起一套 | 语义名保持「背景 / 表面 / 文字 / 强调 / 危险」。磁贴色与优先级色分开。禁止新代码写 `#5b8def` 这类散色 |
| 基础控件 | 按钮、图标按钮、文本字段、选择、开关、toast | `.btn`、`.field`、`toast()` | 先服务现有 class，避免全站改名导致无法回滚 |
| 反馈 | 空状态、横幅、确认、打卡面板 | `emptyState`、`offlineBanner`、`prompt`/`confirm` | 系统对话框只留给浏览器无法拦截的权限框。打卡与儿童账号必须用本层 |
| 业务块 | 待办行、计划卡、成员堆叠、日历格子、热力 | `todoCard`、`sparklineEl` 等 | 只接收数据与回调，不直接调用 `render()` |
| 屏幕 | 上表各页 | `render*Body` | 一屏一个文件。死屏不要迁：`renderTodayBody`、本机登录、连接服务器 |
| 壳 | 顶栏、底栏、FAB、离线条、安全区 | `renderHome`、`tabs` | 手机与桌面在这一层分叉，屏幕内部少写 `position: absolute` |

图标继续用现有 SVG 字符串，直到有人做图标集。不要为了换图标引入图标字体库。

视觉方向（活泼、圆润、温暖、有成长感）落在 token 与空状态插画上，不引入积分、抽奖或强游戏反馈。现有完成时的 `lightTap` 可以保留。连续打卡用日历密度表达，不用奖杯动效。

## 响应式策略

断点建议（数值可在第一批壳层里用真机微调，原则先固定）：

- 默认：单列，底栏 + FAB，与今天一致。最大宽度不再锁死 430。内容区在手机上占满宽度，两侧只留 token 间距。
- `min-width: 960px`：侧栏 + 内容。底栏隐藏，FAB 改到内容区右下或改为标题栏按钮。
- `min-width: 1200px`：增加详情栏。计划列表点选不再 `state.screen = 'plan-detail'` 占满全屏，而是选中 id。手机仍走全屏详情，数据函数共用。

安全区：继续 `viewport-fit=cover` 与 `env(safe-area-inset-*)`。壳的 padding 使用变量 `--safe-top` / `--safe-bottom`，页面不要各自再写一套 `calc(8px + env(...))`。

键盘：

- 保留 Android `adjustResize`。
- 增加 `visualViewport` 写入 `--keyboard-inset`，表单主按钮留出该高度。这是针对 `100dvh` 在键盘弹出后不一定缩小的已知风险；真机未测，实现时用调试开关对比「只靠 resize」与「加上 inset」。
- 表单主按钮放在滚动区内或贴在 inset 之上，二选一，不要两套同时浮动导致双按钮。

弹层：焦点移入对话框，Escape 与遮罩关闭创建菜单；全屏表单只响应显式返回。桌面对话框不要使用今天 `.modal { width: min(100%, 430px) }` 这种「永远手机宽」的限制，改为 `min(560px, 100%)` 一类由 token 决定的宽度。

PWA：`portrait-primary` 会阻碍桌面横屏与平板。桌面布局若要在「添加到主屏幕」后可用，manifest 的 orientation 需要放宽。原生 App 的方向仍可保持竖屏，这是两处配置，不要假设改 CSS 就够。

## 渐进迁移原则

1. 每一批结束后，`index.html` 仍能被 `npm start` 的静态服务打开，登录到待办勾选仍可用。
2. 新屏幕与旧函数可以短暂并存，但同一 Tab 只能有一个实现被 `bodyMap` 引用。切换用显式 import，不用特性开关框架。
3. 不改 IndexedDB 版本，直到确有新索引。现在 `DB_VERSION` 为 1。
4. 不改同步 payload 字段名。UI 可以换说法，存储仍用 `dueAt`、`completions`、`executorIds`、`milestones`。
5. Capacitor 插件与 `WidgetBridge` 的方法名保持 `writeSnapshot` / `consumeDrafts`。
6. 死代码在对应屏幕迁完、确认无深链入口后再删。`luckytodo://` 仍可能带 `tab=today` 与 `tab=family`，映射要留在 `nav` 里。
7. 视觉批次不与「补编辑/删除」绑在同一个无法回滚的提交里。外观可以回滚，数据修复要单独回滚。

## 分项建议

### 1. 壳层与 token 先于页面装修

- 解决问题：430px 锁死、色值多源、夜间/纸色/日间强调色不一致，导致后续页面会继续抄错色。
- 影响：`styles.js`、`index.html` 启动色、`manifest.webmanifest`、`capacitor.config.json` 的 Splash/StatusBar。
- 风险：改 `--accent` 会立刻改变全部按钮。应先加别名，再逐页替换散色。
- 前置：确认日间品牌色以 `#4eb7ac` 为准，还是向夜间的 `#2dd8fe` 靠拢。未确认前，第一批只集中变量、不改色相。

### 2. 返回栈与刷新

- 解决问题：硬件返回退出应用、刷新丢失详情与表单。
- 影响：`native.js`、导航调用点。
- 风险：与现有页内返回按钮重复触发，可能一次关掉两层。验收时要数栈深。
- 前置：层级表（见上）。不依赖视觉定稿。

### 3. 按屏幕把 `app.js` 拆开，行为不变

- 解决问题：无法单独重做某一页；重复的日期与周期文案。
- 影响：新增 `screens/` 与 `domain/`，`app.js` 变薄。`renderTodayBody` 不迁移。
- 风险：拆的时候容易顺手改交互。验收必须对照 `feature-inventory.md` 的「已实现」行。
- 前置：第 2 条的 `nav` 接口稳定，否则每个屏幕还会直接改 `state.tab` 并调用全局 `render`。

### 4. 编辑、删除、归档作为独立产品批次

- 解决问题：便签点开是空白表单；归档筛选没有数据来源；删除协议已存在但没有 UI。
- 影响：四类表单与 `saveLocalEntity` 调用。需要把草稿从「总是 `defaultDraft`」改为「可由实体填充」。
- 风险：错误的 `deletedAt` 会经同步传播到全家。必须有确认，且冲突策略沿用现有 `resolveConflict`。
- 前置：产品确认谁可以删除、归档是否只影响计划、便签转待办后原便签是否保留。

### 5. 系统对话框替换

- 解决问题：`checkin.js`、儿童账号、冲突、注销使用 `prompt`/`confirm`，样式与键盘不可控。
- 影响：这些调用点与新的确认/表单控件。
- 风险：文件选择必须仍由 `<input type="file">` 触发，不能包进异步对话框后丢失用户手势。打卡照片要保持「点击按钮 → 同步打开文件框」。
- 前置：基础确认控件（第 3 条拆出 `ui/` 之后）。

### 6. 桌面三栏

- 解决问题：桌面没有信息架构，只有居中手机列。
- 影响：壳层 CSS、计划列表与详情的组合方式、manifest 方向。
- 风险：FAB、底栏、`form-screen { inset: 0 }` 都是相对 `#app` 绝对定位。若只把 `#app` 拉宽而不改定位，表单会铺满整个窗口。
- 前置：第 1 条壳层；计划详情已从 `app.js` 拆出，便于同一组件嵌入右栏。

### 7. 自托管 NAS 的客户端策略（不做后端改造）

- 解决问题：APK 内默认 origin 是 Capacitor 的 `https://localhost`，`apiBase()` 只有在端口 `5173` 或 `file:` 时才指向 `127.0.0.1:8787`。用户把现有服务放到 NAS 上时，打包 App 不会自动发现它。
- 影响：仅客户端基址。已有 `lt_server` 覆盖，但没有设置界面（旧 `renderConnect` 已死）。
- 风险：在登录页重新露出服务器地址，会和「官方云、用户不填 NAS」的现行 README 冲突。
- 前置：产品选择其一即可，都不需要改 API 代码：
  - A. 继续由同一个 HTTPS 域名提供页面和 API（浏览器与 PWA 已按 `location.origin` 工作）。
  - B. 仅原生包增加一个「高级：服务器地址」写入 `lt_server`，默认仍为空。
  - C. Capacitor `server.url` 指向 NAS（这会改变离线包策略，需要单独验证，不建议和视觉批次一起做）。

### 8. 主题入口

- 解决问题：`night` / `paper` / `large` 已实现样式，应用内无法切换，重做时容易被当成废代码删掉，或被误当成当前品牌。
- 影响：设置页与 `applyChrome`。状态栏颜色要跟着 `lt_theme` 更新（今天只在 `initNative` 时设一次）。
- 风险：纸色与夜间把强调色改成青色，和日间青绿不是同一品牌。若三套一起「换新」，工作量是三倍。
- 前置：决定保留日间单主题，还是保留三套并做出入口。建议重设计先只承诺日间；夜间与纸色 CSS 留到设置批次再决定删或对齐色相。

## 不建议在本阶段做的事

- 更换 IndexedDB、重写同步队列、改实体字段。
- 升级 Capacitor 7/8 或 Android `targetSdk`。
- 把 `admin.html` 和家庭 App 合成一个构建产物。
- 用游戏化积分替代现在的打卡热力与连续天数。
- 为了桌面布局引入一套只在桌面存在的第二数据源。
