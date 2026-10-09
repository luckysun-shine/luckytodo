# LuckyTodo 前端依赖审查

范围：用户界面运行、打包进 Capacitor、以及前端直接 import 的模块。后端 Node 内置模块不在「建议替换」之列。版本以 `package-lock.json` 锁定值为准；根 `package.json` 只声明了 `^6` 范围。

本机没有 `node_modules`。下表不是 `npm ls` 的现场输出，而是锁文件中的解析结果。

## 直接依赖

| 依赖 | 锁定版本 | 用途 | 何处使用 | 重复能力 | 维护风险 | 建议 |
| --- | --- | --- | --- | --- | --- | --- |
| `@capacitor/core` | 6.2.2 | 运行时桥、`isNativePlatform`、`Plugins` | `native.js`、`widgetBridge.js`、`app.js` `bindDeepLinks` | 无第二套桥 | 6.x 相对 2026 年的 Capacitor 7/8 主线已落后。升级会牵动 Android Gradle 与 iOS 工程 | 保留。不要为了视觉重做而升级大版本 |
| `@capacitor/cli` | 6.2.2 | `cap sync` / `cap open` | 根脚本 `cap:*` | 无 | 与 core 必须同主版本 | 保留 |
| `@capacitor/android` | 6.2.2 | Android 工程依赖 | `android/` | 无 | 与 `compileSdk 34`、AGP 8.2.1 绑定 | 保留 |
| `@capacitor/ios` | 6.2.2 | iOS 工程依赖 | `ios/` | 无 | 本机无法验证 Pod / Xcode | 保留 |
| `@capacitor/app` | 6.0.3 | 深链 `appUrlOpen`、返回键、`exitApp` | `native.js` `initNative`；`app.js` 再次直接访问 `Capacitor.Plugins.App` | 返回键逻辑与应用内返回按钮是两套 | 插件 API 稳定；风险在调用方式不统一 | 保留。返回行为收口到 `native.js`，不要在页面里再挂一个 listener |
| `@capacitor/status-bar` | 6.0.3 | 状态栏样式与背景色 | `native.initNative` | HTML `theme-color`、Capacitor 配置、CSS 背景各写一套颜色 | 三处颜色漂移 | 保留插件。颜色改由同一组 token 生成，而不是换库 |
| `@capacitor/splash-screen` | 6.0.4 | 原生启动图隐藏 | `initNative`、`capacitor.config.json` | HTML `#boot-splash` | 双闪屏背景不一致 | 保留。重做品牌时同时改原生资源与 HTML |
| `@capacitor/haptics` | 6.0.3 | 完成待办轻触感 | `native.lightTap` | 无 | 低。浏览器中空操作 | 保留 |
| `@capacitor/local-notifications` | 6.1.3 | 原生日程提醒 | `native.scheduleLocal`、`reminders.reschedule` | 浏览器 `Notification` + `setTimeout` | 未见取消旧通知的调用，存在重复调度的可能 | 保留插件。重做提醒时补取消/替换策略，而不是换库 |

根 `package.json` 没有前端 UI 库。`apps/web/package.json` 与 `apps/api/package.json` 的 `dependencies` 为空。API 使用 Node 内置 `node:sqlite`、`node:http`、`node:test`。

## 锁文件中的传递依赖

这些包由 Capacitor CLI 带入，应用源码没有直接 import：`@ionic/cli-framework-output`、`@ionic/utils-fs`、`@ionic/utils-subprocess`、`@ionic/utils-terminal`、`commander`、`debug`、`native-run`、`open`、`plist`、`prompts`、`rimraf`、`semver`、`tar`、`tslib`、`xml2js` 等。

建议：保留为 CLI 的传递依赖。不要在业务代码里引用它们，也不要为了「清洁 lockfile」单独升级。

## 非 npm、但属于前端运行时依赖

| 能力 | 版本 / 来源 | 用途 | 重复 | 风险 | 建议 |
| --- | --- | --- | --- | --- | --- |
| 浏览器 ES Module | 无包 | `index.html` 直接加载 `app.js` | 若引入打包器会变成第二套模块解析 | 无 tree-shaking；缓存靠查询参数 `?v=20261009h` 手写 | 在拆文件阶段继续使用。只有当本地 `file:` 或原生路径模块解析出问题，再引入 Vite 一类打包器 |
| IndexedDB | 平台 API，库名 `luckytodo-v1` | 实体、队列、blob、kv | 无第二数据库 | `api.js` `txDelete` 又自己 `indexedDB.open` 了一次，没有复用 `db.js` 的连接封装 | 保留 IndexedDB。删除/清空走 `db.js`，不要换 localForage 等等价库 |
| `localStorage` / `sessionStorage` | 平台 | 会话与少量 UI 偏好 | 与 IndexedDB 的 kv 并存 | 令牌在 `lt_token`。媒体 URL 会带上它 | 保留会话存储。不要再增加一份状态库 |
| Service Worker | `sw.js`，缓存名 `luckytodo-shell-v20261009h` | 非原生离线壳 | 原生包故意不注册 | 预缓存列表与模块拆分容易脱节 | 保留。拆文件时把新入口加入 `SHELL`，并升级缓存名 |
| Google Fonts | `index.html` 外链 `Plus Jakarta Sans`、`Noto Sans SC` | 品牌字体 | CSS 已写 `PingFang SC` 回退 | 构建不内置字体；国内或离线环境会闪默认字体 | 保留字体族。把 woff2 放到 `public/` 再去掉运行时外链，这是资源决策，不是换库 |
| 自定义 Android `WidgetBridge` | `android/.../WidgetBridgePlugin.java` | 快照与草稿 | iOS 有同名 Swift 插件 | 两端合同必须与 `widgetBridge.js` 一致 | 保留。这是产品能力，不是可替换的 npm 包 |
| 自定义 iOS WidgetKit | `ios/App/LuckyTodoWidget/` | 今日提醒、家庭日历 | Android RemoteViews 另做一套布局 | 前端重做不会自动更新小组件视觉 | 保留桥。小组件皮肤单独排期 |

## 仓库里不存在、因此不要预设的库

当前源码与 lockfile 中都没有：React、Vue、Svelte、Preact、Lit、Angular、React Router、Vue Router、Redux、Zustand、Pinia、MobX、TanStack Query、Axios、jQuery、Tailwind、Bootstrap、Sass、PostCSS、Vite、Webpack、esbuild、TypeScript、ESLint、Prettier、Playwright、Cypress、Vitest、Jest。

建议：不要因为个人偏好把其中任何一个放进第一批迁移。引入构建工具或视图库的前提见 `redesign-recommendations.md`：只有在「继续用原生 ES Module 无法保持 Capacitor `webDir` 可运行」被证实时才升级工具链。

## 版本不一致（不是依赖重复，但会误导发布）

| 标记 | 值 |
| --- | --- |
| 根 `package.json` | `0.5.0` |
| lockfile 根 `version` | `0.3.0` |
| `apps/web` / `apps/api` package | `0.3.0` |
| Android `versionName` | `0.3.1` |
| API `/api/health` 测试期望 | `0.5.0` |

建议：保留现有依赖版本，单独做一次版本号对齐（根包、Web、API、Android、health）。那是发布卫生，不属于换框架。对齐前要确认应用商店里的 `versionCode` 只能增加，不能为了好看改小。
