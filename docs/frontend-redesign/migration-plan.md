# LuckyTodo 前端渐进迁移计划

原则：每一批都从当前可运行的 `apps/web` 出发，做完仍能登录、建家庭、新建并勾选待办、同步。禁止用新应用替换 `index.html` 入口。禁止在同一批里升级 Capacitor、改 IndexedDB 版本、改 API。

回滚的共同方式：该批只碰下列文件，用版本管理还原这些文件即可。不要依赖运行时特性开关。原生资源（图标、Android 布局、iOS Widget）不在前六批里改，因此不需要重新发商店包才能回滚 Web 逻辑；若某批改了 `capacitor.config.json`，回滚后需要再执行一次 `cap sync` 才与安装包一致。

当前入口必须始终是 `apps/web/index.html` → `app.js`。新文件通过 ES Module import 接入。在引入打包器之前，不要把入口改成 `dist/`。

## 依赖关系

```
批次 1 壳层 token 与宽度
    ↓
批次 2 返回栈（可与批次 1 并行开发，但合并顺序在 1 之后，避免两批同时改 styles）
    ↓
批次 3 拆出只读屏幕（首页、待办）
    ↓
批次 4 拆出计划 / 日历 / 便签 / 个人中心 / 洞察
    ↓
批次 5 表单改为「打开已有记录」+ 应用内确认框（依赖产品决定）
    ↓
批次 6 桌面三栏（依赖批次 4 的计划详情已是独立模块）

批次 7 删除死代码（依赖批次 4 完成且深链回归通过）
批次 8 版本号对齐（独立，可随时做，不阻塞界面）
```

批次 5 的产品决定未确认前，可以停在批次 4。批次 4 结束时外观可以仍接近今天，但文件边界已经能支持重做。

## 批次 1 — 壳层与 token 集中

- 目的：去掉「页面只能长在 430px 列里」这个隐含假设，并把颜色收口，为后面的屏幕拆分提供变量。不改业务函数行为。
- 模块：`apps/web/src/styles.js`，`apps/web/index.html`（`theme-color` 与启动背景），`apps/web/public/manifest.webmanifest`（`theme_color` / `background_color`）。本批不改 `app.js` 的渲染分支。
- 具体范围：
  - `#app` 在窄屏占满宽度；`max-width: 430px` 不再作为唯一布局。
  - 增加 `--safe-top`、`--safe-bottom`，替换散落的 `env(safe-area-inset-*)` 重复字面量时，保持像素结果不变。
  - 日间色相先不动。只把热力图、启动页里与 token 重复的字面量改成变量。
  - 不新增桌面三栏（留给批次 6），避免未拆分的绝对定位表单被拉满窗口。
- 验收：
  - 手机宽度下，登录、家庭门、五个 Tab、新建菜单、一条新建待办、勾选完成，与改前路径一致。
  - 宽于 960px 时应用不再是两侧留白的 430px 手机模型；底栏仍可用，表单仍盖住主列而不是撑破页面。
  - 日间强调色仍为 `#4eb7ac`，除非产品已另行确认。
- 回滚：还原上述三个文件。
- 前置：无。若产品尚未选定新品牌色，本批禁止改色相。

## 批次 2 — 返回栈与刷新

- 目的：系统返回与页内返回走同一层级；刷新不把用户从计划详情丢回首页。
- 模块：新建 `apps/web/src/nav.js`；修改 `apps/web/app.js` 中 `boot`、`render`、`tabs`、`openPlanDetail`、`openCreateForm`、`closeForm`、`bindDeepLinks`；修改 `apps/web/src/native.js` 的 `backButton`。
- 行为：
  - Tab 切换使用 `history.replaceState`。
  - 个人中心、洞察、计划详情、创建菜单、表单使用 `pushState`。
  - `popstate` 只改 `state` 再 `render`，不再次 `pushState`。
  - 栈空时 `backButton` 才 `exitApp()`。`canGoBack` 不再代表「应用内还有页面」。
  - `tab=today` 仍映射为 `home`，`tab=family` 仍映射为 `me`。
  - URL 只放 `tab` 与 `planId`。不放令牌、不放表单草稿。
- 验收：
  - 从计划详情按页内返回与按浏览器后退，都回到计划列表。
  - 打开新建表单后后退，回到创建菜单或关闭菜单（实现时写死一种，并在本文件补一行最终选择）。建议：后退关闭表单并回到菜单；再后退关闭菜单。
  - 刷新计划详情 URL 仍打开该计划；无此 id 时回到计划 Tab（与今天 `renderPlanDetail` 找不到计划时的回退一致）。
  - 首页栈空时，Android 返回退出应用。本项在有 JDK/设备前标为待验证，浏览器可用 `history.back()` 模拟。
- 回滚：删除 `nav.js`，还原 `app.js` 与 `native.js`。
- 前置：批次 1 已合并（减少 `styles.js` 冲突）。不依赖新视觉。

## 批次 3 — 拆出首页与待办，行为不变

- 目的：把最大的两块视图移出 `app.js`，验证「import 屏幕函数」不会破坏整页 `render()`。
- 模块：新建 `apps/web/src/screens/home.js`、`apps/web/src/screens/todos.js`、`apps/web/src/ui/icons.js`（仅移动 `icons` 字符串）。`app.js` 的 `bodyMap` 改为调用新模块。`renderTodayBody` 仍留在旧文件且不被调用，本批不删。
- 验收：
  - 首页统计数字、跳转 Tab、计划入口、待办勾选、待办三个筛选与改前一致。
  - 首页搜索的光标问题可以在本批修掉（只更新列表，不重建壳），因为这是缺陷而不是新产品。若修复，需补一条：输入过程中焦点与光标位置保持。
  - `state.query` 若仍共享，在本批注明，留到批次 4 再拆开，避免半套状态。
- 回滚：`bodyMap` 指回原函数，新文件可留但不被 import。
- 前置：批次 2 的导航函数已存在，新屏幕通过它切换 Tab，不直接散落 `state.tab = ...; render()`。

## 批次 4 — 拆出其余主屏

- 目的：计划、日历、便签、个人中心、洞察、认证与家庭门各自一个模块。
- 模块：`apps/web/src/screens/` 下对应文件；`apps/web/src/domain/dates.js` 收口 `dayKey`（`app.js` 与 `widgetBridge.js` 改为调用它，输出必须一致）。
- 验收：对照 `feature-inventory.md` 中状态为「已实现」的行做手工路径：注册登录、创建/加入家庭、四类新建、勾选、转待办、打卡（仍可为系统对话框）、同步、导出、退出。日历下拉与月份切换仍可用。
- 回滚：按屏幕 revert。一个屏幕失败不回滚已经验收的屏幕。
- 前置：批次 3 的 import 方式已在浏览器与「API 静态托管」两种打开方式下通过。`5173` 静态站也要打开一次，因为 `apiBase()` 在该端口会改目标。

## 批次 5 — 记录编辑与应用内确认

- 目的：补上「打开的是这一条」以及删除/归档；去掉主路径上的 `prompt`/`confirm`。
- 模块：`screens` 中的表单、`checkin.js`、`renderMeBody` 里的儿童账号与冲突处理。`api.saveLocalEntity` 签名保持。
- 验收：
  - 点击便签打开原标题与正文，保存后 id 不变（同步队列更新同一 id）。
  - 待办、日程同样可打开。若产品决定日程本批只读，则按钮不可用并写明原因，不能再打开空白新建冒充编辑。
  - 删除一条待办后，本机列表消失，家庭模式下对端 pull 后也不见。用 API 测试或两浏览器会话验证。
  - 归档计划后出现在「已归档」，且默认首页不再展示。
  - 打卡可以填写文字；选照片仍在同一次点击手势内打开文件选择。
  - 儿童账号表单不使用 `prompt`。
- 回滚：还原表单与 `checkin.js`。已同步到服务器的删除不能靠还原前端文件复活，验收时只用测试家庭。这是本计划里唯一会写用户数据的批次，必须单独发布。
- 前置：产品确认删除权限与「转待办是否保留便签」。未确认则不做本批。

## 批次 6 — 桌面三栏与键盘

- 目的：宽屏侧栏 + 列表 + 详情；键盘不挡住表单主按钮。
- 模块：壳 CSS、计划列表与详情的组合、`visualViewport` 小模块、`manifest.webmanifest` 的 `orientation`。
- 验收：
  - 视口 &lt; 960px：与批次 5 之后的手机布局一致，含安全区。
  - 视口 ≥ 1200px：计划详情出现在右栏，浏览器后退行为与手机全屏详情一致（关掉详情而不是退出站点）。
  - Android 真机：聚焦表单最下方输入时，主按钮仍可点。无设备则本条保持待验证，不宣称完成。
- 回滚：还原壳 CSS 与 manifest 方向。详情模块仍可全屏使用。
- 前置：批次 4。批次 5 未做时，右栏可以是只读详情，不阻塞本批。

## 批次 7 — 删除不可达代码

- 目的：去掉会误导重做的死路径。
- 模块：`app.js` 中 `renderTodayBody`、`renderLocalRegister`、`renderLocalLogin`、`renderConnect`、`renderSetup`、`renderFamilyLogin` 及其专用样式（确认无引用后）。`api.js` 的 `createLocalAccount` 若无引用再删。`lt_server` 与 `setApiBase` 保留到 NAS 策略选定。
- 验收：全库搜索这些函数名无引用；登录到同步的主路径仍通过；`handleDeepLink` 单测仍通过。
- 回滚：还原删除提交。
- 前置：批次 4 已完成，且确认没有外部文档把「连接服务器」页当作现行入口（README 已描述云端登录，`android/PACKAGING.md` 仍写本机注册与「我的里连接家庭服务器」，删除代码时要同步改这些说明，否则打包的人会按旧步骤验收）。

## 批次 8 — 版本号对齐（独立）

- 目的：根包、Web、API、`/api/health`、Android `versionName` 使用同一个用户可见版本。`versionCode` 只增不减。
- 模块：四个版本源与 API 测试断言。lockfile 的根 `version` 会在下一次合法的 lock 更新时跟上，本批不手改 lockfile 哈希。
- 验收：`node --test apps/api/test/api.test.js` 仍通过。
- 回滚：还原版本字段。若已经用更大的 `versionCode` 上架，则不能把 `versionCode` 改回去。
- 前置：无。可在任意批次之后做。

## 第一批实际会改的文件

若只批准「先做最小的一批」：执行批次 1，文件只有

- `apps/web/src/styles.js`
- `apps/web/index.html`
- `apps/web/public/manifest.webmanifest`

批次 2 才触及 `apps/web/app.js`、`apps/web/src/native.js` 与新建 `apps/web/src/nav.js`。在批次 1 的验收完成前，不要同时改 `app.js`。

## 每批都要做的检查

- 浏览器：登录、家庭门、五个 Tab、新建待办、勾选、打开计划详情、页内返回。
- 静态端口 `5173` 与 API 端口 `8787` 各看一次基址是否仍符合 `apiBase()`。
- `node --test apps/api/test/api.test.js` 与 `node apps/web/src/widgetBridge.test.mjs`。API 测试不是前端测试，但能防止有人在迁移时误改共享契约。
- 有 Android 环境时再做：`npx cap sync android` 后安装 debug，看启动闪屏、返回键、键盘。当前环境缺少 JDK 与 `ANDROID_HOME`，这些检查保持待验证，不作为批次 1–4 的阻塞项。
- 改过的屏幕在窄屏与 ≥1200px 各看一次。批次 6 之前，宽屏只要求「不破版、主路径可点」，不要求三栏。

## 明确不做

- 不新建第二套前端应用并行替换。
- 不在迁移中途把 `webDir` 改到未经验证的 `dist/`。
- 不升级 Capacitor、Gradle、`targetSdk`。
- 不修改 `apps/api` 的路由与表结构（批次 8 若只改 health 字符串，须单独说明并让 API 测试期望与之相同）。
- 不把小组件 XML / SwiftUI 和 Web 视觉绑成同一批。
