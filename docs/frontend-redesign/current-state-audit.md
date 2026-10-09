# LuckyTodo 前端现状审查

审查日期：2026-10-09。本文件只记录仓库中可核对的事实。无法从代码或本机命令确认的项标为「待验证」。

## 实际技术栈和版本

前端不是 React、Vue、Svelte，也没有路由库、状态管理库、CSS 框架或打包器。客户端是浏览器原生 ES Module，由静态文件直接运行。

| 位置 | 版本 / 事实 |
| --- | --- |
| 根 `package.json` `version` | `0.5.0` |
| `package-lock.json` 根 `version` 字段 | `0.3.0`（与根 `package.json` 不一致） |
| `apps/web/package.json` | `@luckytodo/web` `0.3.0`，无 dependencies |
| `apps/api/package.json` | `@luckytodo/api` `0.3.0`，无 npm 依赖 |
| `android/app/build.gradle` | `versionName` `0.3.1`，`versionCode` `4` |
| API 健康检查（`apps/api/test/api.test.js`） | 期望 `version` 为 `0.5.0` |
| Node 引擎 | `>=22`。本机执行 `node --version` 为 `v22.14.0` |
| 前端运行时 | 原生 DOM + `fetch` + IndexedDB + CSS 变量 |
| 后端（本阶段不改） | Node 内置 `node:http` + `node:sqlite`，入口 `apps/api/src/index.js` 的 `handle` |

已锁定的 Capacitor 版本来自 `package-lock.json`：

| 包 | 锁定版本 |
| --- | --- |
| `@capacitor/core` / `cli` / `android` / `ios` | `6.2.2` |
| `@capacitor/app` | `6.0.3` |
| `@capacitor/haptics` | `6.0.3` |
| `@capacitor/local-notifications` | `6.1.3` |
| `@capacitor/splash-screen` | `6.0.4` |
| `@capacitor/status-bar` | `6.0.3` |

Android 构建：Android Gradle Plugin `8.2.1`（`android/build.gradle`），`compileSdk` / `targetSdk` `34`，`minSdk` `22`（`android/variables.gradle`）。包名 `family.luckytodo.app`。

本机 `node_modules` 不存在，因此未执行 `npx cap sync`。按纪律未安装依赖。

## 目录结构与入口

```
apps/web/index.html          唯一用户入口，#app + boot splash
apps/web/app.js              全部页面、交互、本地状态（约 4218 行）
apps/web/src/styles.js       单一 CSS 字符串 `css`（约 1717 行），运行时注入 <style>
apps/web/src/api.js          会话、HTTP、同步队列、媒体上传
apps/web/src/db.js           IndexedDB `luckytodo-v1`
apps/web/src/native.js       Capacitor 插件探测与本地通知
apps/web/src/reminders.js    提醒调度
apps/web/src/widgetBridge.js 主屏组件快照与深链
apps/web/src/checkin.js      打卡收集（prompt/confirm）
apps/web/sw.js               PWA shell 缓存
apps/web/admin.html          独立运维页，内联样式，不走 app.js
apps/web/privacy.html
apps/web/terms.html
apps/web/public/             图标、manifest、logo
capacitor.config.json        webDir = apps/web
android/                     Capacitor 工程 + 自定义 WidgetBridge
ios/                         Capacitor 工程 + WidgetKit（本机为 Windows，未编译）
```

启动链：

1. `index.html` 加载 `./app.js?v=20261009h`。
2. `app.js` 把 `styles.js` 的 `css` 注入 `document.head`。
3. `boot()` 调用 `native.registerServiceWorker()`、`native.initNative()`、`bindDeepLinks()`，再按 `lt_token` 决定屏幕。
4. 根脚本 `npm start` 实际启动的是 API（`apps/api/src/index.js`）。`tryServeStatic` 会把 `apps/web` 作为静态根。`npm run web` 用 `python3 -m http.server 5173` 只提供前端，此时 `apiBase()` 指向 `http://127.0.0.1:8787`。

`apps/web` 的 `build` 脚本只是把 `index.html`、`app.js`、`src`、`public` 复制到 `dist/`。没有编译、压缩或类型检查。该脚本使用 Unix `mkdir -p` 与 `cp`。本次未执行，避免写出 `dist/`。在 Windows 的 `cmd.exe` 下是否可运行：待验证。

## 页面、路由及功能清单

没有 URL 路由。导航是内存对象 `state`（`app.js`）上的 `screen` 与 `tab`。`render()` 每次 `root.innerHTML = ''` 后整页重建。代码里没有 `history.pushState`。刷新后 `boot()` 一律把 `state.tab` 设为 `home`，打开中的计划详情和表单会丢失。

`render()` 识别的 `state.screen`：

| screen | 函数 | 能否从当前启动路径到达 |
| --- | --- | --- |
| `cloud-login` | `renderCloudLogin` | 能。无 `lt_token` 或 401 时进入 |
| `cloud-register` | `renderCloudRegister` | 能。登录页按钮 |
| `family-gate` | `renderFamilyGate` | 能。已登录但 `hasFamily()` 为假 |
| `merge` | `renderMerge` | 能。加入家庭时本地有 `localOnly` / `guest` 记录 |
| `home` | `renderHome` | 能。已登录且已有家庭 |
| `plan-detail` | `renderPlanDetail` | 能。`openPlanDetail` |
| `local-register` / `local-login` | `renderLocalRegister` / `renderLocalLogin` | 不能从 `boot()` 进入。`render()` 在 `home` 且没有 token 时会强制回到 `cloud-login`，本机账号登录后的 `afterLocalLogin()` 会被这条规则打断 |
| `connect` / `setup` / `family-login` | `renderConnect` / `renderSetup` / `renderFamilyLogin` | 不能。只在这三页之间互相跳转，没有任何当前入口把 `state.screen` 设成 `connect` |

主界面底栏 `tabs()` 是五项：`home` / `todo` / `plans` / `cal` / `notes`。`me` 与 `insights` 不在底栏，从头像或洞察入口进入，并显示返回按钮。旧值 `today` 会改写成 `home`，`family` 会改写成 `me`（`renderHome`、`bindDeepLinks`）。

`renderTodayBody`（约 1331–1601 行）没有被 `bodyMap` 调用，属于死代码。当前首页是 `renderHomeBody`。

功能是否接通见 `feature-inventory.md`。这里只列导航事实：

- 登录、注册、创建家庭、邀请码加入、合并本地数据：已接到云端 API。
- 首页、待办、计划列表、计划详情、日历、便签、个人中心、洞察：在 `home` 屏内切换。
- 新建菜单与四类表单：`state.form` 覆盖在主屏上，不是独立 URL。
- 法律页 `privacy.html`、`terms.html` 与运维页 `admin.html` 是独立 HTML。

## 组件复用情况

没有组件目录。复用只发生在 `app.js` 的函数之间：

| 符号 | 作用 | 复用情况 |
| --- | --- | --- |
| `h` | 小型 hyperscript | 全应用唯一 DOM 构造器。`html` 属性走 `innerHTML`，目前主要用于内置 SVG |
| `authShell` / `authPasswordField` / `authTextField` | 认证表单骨架 | 本机登录注册在用；云端登录注册大多手写，没有走 `authShell` |
| `formShell` / `fieldEl` / `peoplePicker` / `attachBlock` | 新建表单 | 便签、待办、日程、计划共用 |
| `emptyState` / `todoCard` / `offlineBanner` / `tabs` | 列表与壳 | 多页共用 |
| `sparklineEl` / `yearHeatmapEl` | 计划可视化 | 计划列表与首页项目卡 |
| `avatarButton` / `openAvatarCrop` | 头像 | 个人中心可编辑；首页入口是 `profileEntryButton` |

重复而没有抽公共函数的部分：

- `dayKey` 在 `app.js` 与 `widgetBridge.js` 各写一份；日期解析还有 `localDayKeyFromIso` 与 `localDayFromIso`。
- 计划周期文案 `{ daily, weekly, monthly, interval }` 在 `renderPlansBody`、`renderPlanDetail` 等处重复。
- `admin.html`、`privacy.html`、`terms.html` 各自内联样式，不使用 `styles.js` 的 token。
- 图标是 `icons` 对象里的 SVG 字符串，创建菜单里便签图标被赋成 `icons.today`（`renderCreateMenu`）。

## 状态管理与数据流

全局可变对象 `state` 字段（初始定义）：`tab`、`online`、`theme`、`homeFilter`、`font`、`toastTimer`、`screen`、`form`、`members`、`hideBanner`、`query`、`mergeCount`、`planId`、`calCursor`、`calSelected`、`calExpanded`。

运行中还会动态增加 `planFilter`、`gateMode`。搜索词 `state.query` 被首页、待办、便签共用，切换 Tab 不会清空。

持久化：

| 存储 | 键 / 库 | 内容 |
| --- | --- | --- |
| `localStorage` | `lt_token`、`lt_user`、`lt_member`、`lt_family`、`lt_mode` | 云端会话 |
| `localStorage` | `lt_server` | 可选 API 根地址，界面无入口，`apiBase()` 读取 |
| `localStorage` | `lt_theme`、`lt_font`、`lt_cal_expanded`、`lt_local_accounts`、`lt_widget_snapshot`、`lt_admin_token` | 主题、字号、日历展开、本机账号、组件快照、运维页令牌 |
| `sessionStorage` | `lt_hide_banner` | 关闭离线/未入家横幅 |
| IndexedDB `luckytodo-v1` | `kv`、`entities`、`queue`、`blobs` | 成员缓存、实体、同步队列、本地附件 |

写入路径：界面调用 `api.saveLocalEntity` → `db.putEntity`；家庭模式下再 `db.enqueue`。`maybeSync` / `syncNow` 执行 `POST /api/sync/push` 与 `GET /api/sync/pull?since=`。冲突写入 `syncStatus: 'conflict'` 与 `kv` 键 `conflict:<id>`。

主题与字号只在 `applyChrome()` 里读取。全仓库没有把 `lt_theme` 或 `lt_font` 写回 `localStorage` 的界面。`night` / `paper` / `large` 的 CSS 存在，但用户无法在应用内切换。

每次 `render()` 销毁并重建 DOM。例外：待办搜索在重建后用 `selectionStart` 恢复光标；首页搜索（`renderHomeBody`）每次输入都 `render()`，不恢复光标。`draftPatch` 用 `skipAutoFocus` 避免表单重建后跳回第一个输入框，并恢复 `.form-screen .scroller` 的 `scrollTop`。

## API 和模拟数据情况

前端没有独立 mock 服务，也没有写死的任务列表。列表数据来自 IndexedDB。空状态文案是界面文案，不是假数据。

`api.js` 已封装并被主流程使用的接口：`/api/health`、`/api/auth/register`、`/api/auth/login`、`/api/auth/logout`、`/api/auth/account`、`/api/me`、`/api/families`、`/api/invites`、`/api/invites/accept`、`/api/members/child`、`/api/families/export`、`/api/devices/push-token`、`/api/sync/push`、`/api/sync/pull`、`/api/media/upload`、`/api/insights/latest`、`/api/insights/run`。

已导出但 `app.js` 未调用：`otpSend`、`otpVerify`、`setApiBase`（仅定义，无设置页）。服务端仍保留 OTP 路由；客户端默认不走验证码。

`registerPushToken` 在个人中心被调用时，传入的是 ``web-${Date.now()}`` 占位字符串，不是系统推送令牌。按钮文案为「登记推送（占位）」。

媒体地址 `mediaUrl()` 把 `lt_token` 放进 query。服务端 `authFrom` 允许这种方式，注释写明是为了 `<img src>`。风险在于令牌会出现在图片 URL 中。本文不记录令牌值。

`admin.html` 调用 `/api/auth/login`、`/api/settings/ai`、`/api/insights/latest`、`/api/insights/run`。登录框标签是「用户名」。服务端 `POST /api/auth/login` 会把 `body.username` 先按手机号解析，因此在该框输入手机号可以登录；标签与云端主流程不一致。

环境变量名（只列名称，不列值）：`PORT`、`LUCKYTODO_DATA`、`LUCKYTODO_WEB`、`LUCKYTODO_NO_LISTEN`、`LUCKYTODO_TEST_OTP`、`LUCKYTODO_SMS_WEBHOOK`、`LUCKYTODO_OBJECT_STORE`、`LUCKYTODO_INSIGHT_NO_RATELIMIT`、`AI_ENABLED`、`AI_BASE_URL`、`AI_API_KEY`、`AI_MODEL`、`INSIGHT_INTERVAL_MS`、`NODE_ENV`。`AI_API_KEY` 与短信 webhook 属于敏感配置，不应写入前端文档或提交到仓库。OTP 发送在未设置 `LUCKYTODO_TEST_OTP` 时使用源码内的固定回退值，且非 production 响应可能带 `debugCode`。这是后端风险，本阶段不改。

## 样式方案、设计 token 和响应式实现

样式方案：`styles.js` 导出模板字符串，运行时注入。没有 Tailwind、CSS Modules 或预处理器。

`:root` 有间距、圆角、字体、点击高度和三枚磁贴色。`#app` 上有日间语义色：背景、表面、文字、强调色 `#4eb7ac`、完成/警告/失误、描边、阴影。`[data-theme="night"]` 与 `[data-theme="paper"]` 把强调色改成 `#2dd8fe`。大字号只有 `#app[data-font="large"] { font-size: 17.5px }`。

响应式事实：

- `#app` 写死 `max-width: 430px`，水平居中，`height: 100dvh`。
- `styles.js` 里唯一的 `@media` 是 `prefers-reduced-motion: reduce`。没有桌面断点，没有双栏布局。
- `manifest.webmanifest` 的 `orientation` 为 `portrait-primary`。
- `capacitor.config.json` 的 iOS `preferredContentMode` 为 `mobile`。
- 安全区：顶栏、底栏、FAB、sheet、表单、裁剪层使用 `env(safe-area-inset-top/bottom)`。`index.html` 有 `viewport-fit=cover`。
- 桌面浏览器上的实际表现是一条 430px 手机列，两侧是 `body` 背景 `#f3f5f8`。

色值没有单源：

- 日间强调色 `#4eb7ac`，`theme-color` meta 初始 `#f6f7f6`，manifest `theme_color` `#4eae9a`，启动页背景 `#eaf8fc`，Capacitor Splash/StatusBar `#ffffff`，通知图标色 `#2dd8fe`。
- 热力图 `.hm-cell.on.tone-sky` 使用 `#5b8def`，未走 token。
- 字体来自 Google Fonts：`Plus Jakarta Sans` 与 `Noto Sans SC`。离线或网络受限时依赖系统回退。`font-family` 里还写了 `PingFang SC`。

弹层：`.modal` 宽 `min(100%, 430px)` 并水平居中；`.sheet` 从底部进入；`.form-screen` 是 `#app` 内 `position: absolute; inset: 0`。创建菜单点击遮罩可关。代码里没有焦点陷阱，也没有 Escape 关闭。头像裁剪 `.crop-mask` 直接挂到 `document.body`，因此可以盖住 430px 列以外的区域。

## 测试、构建与代码质量

| 项 | 现状 |
| --- | --- |
| API 测试 | `node --test apps/api/test/api.test.js`。本次 11 项通过。使用临时目录，不写仓库内数据库。Node 打印 SQLite experimental warning |
| 前端测试 | 仅 `node apps/web/src/widgetBridge.test.mjs`，覆盖 `handleDeepLink`。本次通过。没有页面、表单或 CSS 测试 |
| Android 单测 | `ExampleUnitTest.addition_isCorrect`，与业务无关 |
| Lint / 格式化 / CI | 仓库内未找到 ESLint、Prettier、TypeScript、GitHub Actions 配置 |
| 前端构建 | 复制静态文件。未执行 |
| 依赖安装 | 本机无 `node_modules`。未执行 `npm install` |

质量上的结构性问题：`app.js` 同时承担路由、视图、表单校验和部分领域规则；全量重绘使输入、焦点和滚动都要手工补救；死代码（本机账号、连接服务器、`renderTodayBody`）仍留在 `render()` 分支里。

## Capacitor / Android 兼容性

`capacitor.config.json`：`appId` `family.luckytodo.app`，`webDir` `apps/web`，Android/iOS scheme 为 `https`，`allowMixedContent: false`。Splash 时长 0 且自动隐藏。StatusBar `style` `DARK`、背景 `#ffffff`。

`native.js`：

- `isNative()` 探测 `Capacitor.isNativePlatform`。浏览器中插件调用被跳过。
- `initNative` 按 `lt_theme === 'night'` 设置状态栏，并隐藏 Splash。
- `backButton`：若 `canGoBack` 则 `window.history.back()`，否则 `App.exitApp()`。前端从未 `pushState`，WebView 历史通常只有入口页。因此从计划详情、表单、个人中心按系统返回，很大概率直接退出。真机行为：待验证。
- 本地通知走 `@capacitor/local-notifications`，浏览器回退到 Web Notification。`reminders.reschedule` 最多保留 60 条未来提醒；浏览器路径用 `setTimeout`，页面关闭后不会响。
- 原生环境不注册 Service Worker（`registerServiceWorker` 里 `isNative()` 直接 return）。

Android 清单（`AndroidManifest.xml`）：

- `windowSoftInputMode="adjustResize"`。
- `configChanges` 含 `keyboard|keyboardHidden|orientation|screenSize|uiMode`。
- 深链 scheme `luckytodo`。
- 权限：`INTERNET`、`SCHEDULE_EXACT_ALARM`。
- 桌面组件：`TodayRemindersWidgetProvider`、`FamilyCalendarWidgetProvider`，以及 `AddTodoActionReceiver`。
- `usesCleartextTraffic="false"`。开发时 `apiBase()` 对 5173 端口返回 `http://127.0.0.1:8787`。打进 APK 后页面 origin 是 `https://localhost`，不会走 5173 分支，因此默认请求同源 `https://localhost`，不会打到开发机 API。真机连自建服务器需要 `lt_server` 或由 WebView 加载远程 HTTPS。这条与「未来 NAS」有关，本次未在设备上验证。

键盘：除系统 `adjustResize` 外，前端没有 `visualViewport` 监听，也没有键盘高度变量。`#app` 使用 `100dvh`。在部分 Android WebView 上 `dvh` 不随键盘缩小，表单底部会被挡住。代码层面存在此风险；真机是否复现：待验证。

安全区：CSS 已预留 inset。Capacitor 6 状态栏是否真正把 WebView 画到刘海下方，取决于系统与 `StatusBar` 插件行为。本机未安装 JDK（`java` 不在 PATH），`ANDROID_HOME` 与 `ANDROID_SDK_ROOT` 均未设置，无法安装或截图验证。

主屏组件链路是通的：`widgetBridge.publishWidgetSnapshot` 写 `lt_widget_snapshot`，原生存在时调用 `WidgetBridge.writeSnapshot`。Android 插件类是 `family.luckytodo.app.widget.WidgetBridgePlugin`，`MainActivity` 在 `onCreate` 注册、`onResume` 刷新。iOS 对应 `ios/App/App/Plugins/WidgetBridgePlugin.swift` 与 WidgetKit 扩展。Windows 上不能编译 iOS：待验证。

`bindDeepLinks` 监听 `App.appUrlOpen`，并在启动时解析 `location.hash` 中以 `#luckytodo` 开头的链接。导航过程中不会把当前 Tab 写回 hash。

## 已知问题及证据

1. 整页重绘，没有路由。证据：`render()`、`state`、`boot()`。刷新丢失 Tab、计划详情和未保存表单。
2. 系统返回键不理解应用内层级。证据：`native.js` `backButton` 与全仓库无 `pushState`。
3. 桌面没有布局。证据：`#app { max-width: 430px }`，无宽度 `@media`。
4. 新建后不能编辑。待办只能切换完成；便签卡片 `onClick` 调用 `openCreateForm('note')`，打开的是空白草稿，不是该条便签。日历里的便签只切到便签 Tab。
5. 没有删除入口。`saveLocalEntity` 接受 `deletedAt`，界面没有调用。计划 `archived` 在创建时恒为 `false`，列表却有「已归档」筛选，没有把计划标为归档的操作。
6. 打卡、里程碑备注、儿童账号、冲突处理、注销使用 `prompt` / `confirm` / `alert`（`checkin.js`、`renderPlanDetail`、`promptMilestoneProgress`、`renderMeBody`）。系统对话框在 WebView 里样式不可控，也容易被键盘和返回键打断。
7. 主题与大字号只有样式、没有设置项。证据：仅 `getItem('lt_theme'|'lt_font')`，无对应 `setItem`。
8. 本机账号与「连接服务器」整段 UI 已不可达，但仍参与 `render()`。证据见上文 screen 表。`api.js` 的 `createLocalAccount` 把 SHA-256 摘要放在 `lt_local_accounts`。该路径当前走不到；若重设计时重新接上，不能把它当成可用的账号系统。
9. 版本号分裂：根包 `0.5.0`、Web/API 包 `0.3.0`、Android `0.3.1`、lockfile 根版本 `0.3.0`。
10. 个人中心文案提到可在「我的」配置 AI（`renderInsightsBody`），`renderMeBody` 没有模型设置。设置实际在 `admin.html`。
11. 首页搜索每次击键重建整棵树且不恢复光标（`renderHomeBody`）。待办搜索有恢复逻辑。
12. 色板与启动色不一致，见样式一节。
13. Service Worker 预缓存列表不含 `checkin.js`、`widgetBridge.js`。对 `.js` 使用 network-first，在线访问后会写入缓存；冷启动且从未成功拉取过这些模块时，离线会失败。原生包不注册 SW。

## 高风险问题

按对重设计和日常使用的影响排序：

1. `app.js` 单文件全量重绘。任何视觉拆分都会直接碰到导航、焦点和同步。这是后续改动的主要耦合点。
2. 返回栈缺失。Android 硬件返回与应用内「返回」不是同一套状态，重做弹层和详情页时容易出现退出应用或返回错页。
3. 桌面与手机共用 430px 列。若不先定断点策略，组件会继续按手机绝对定位（底栏、FAB、`position: absolute` 表单）堆叠。
4. 编辑、删除、归档未接通。重做信息架构时如果只换皮，这些缺口会留在新界面里。
5. 会话令牌进入媒体 URL，以及 OTP 固定回退（后端）。重设计不应把 `lt_token` 再复制到更多 query 或日志。

## 待验证事项

- 真机：状态栏与 `safe-area-inset-*` 是否对齐；键盘是否挡住表单底部按钮；硬件返回在首页、详情、表单、sheet 上的实际行为。
- 打进 APK 后的 API 基址：默认同源 `https://localhost` 无法访问 NAS。需要产品决定用隐藏的 `lt_server`、远程 `server.url`，还是继续由同一 HTTPS 域名同时提供页面和 API。
- `npm run build:web` 在 Windows cmd 下是否成功。
- iOS Widget 与 `cap sync ios`。本机无 macOS/Xcode。
- Android `assembleDebug`。本机无 JDK、无 `ANDROID_HOME`，且无 `node_modules`。
- Google Fonts 在目标家庭网络中是否稳定。
- `100dvh` + `adjustResize` 在项目实际覆盖的 Android 版本上的组合结果。`minSdk` 为 22，旧 WebView 对 `dvh` 的支持不一致。
