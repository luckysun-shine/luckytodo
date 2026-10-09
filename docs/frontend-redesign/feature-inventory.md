# LuckyTodo 功能清单

状态含义：已实现 = 主路径可用且有对应代码；部分实现 = 有数据或接口，但界面不完整或只在部分入口可用；未实现 = 规格或界面文案提到，代码没有接通；待验证 = 需要真机或特定环境才能确认。

「建议处理」只表示重设计阶段的处置，不是本阶段要改的代码。

| 功能 | 所在文件与符号 | 状态 | 依赖 | 建议处理方式 |
| --- | --- | --- | --- | --- |
| 手机号 + 密码注册 | `app.js` `renderCloudRegister`；`api.js` `register`；`POST /api/auth/register` | 已实现 | 在线 API、协议勾选 | 保留流程，重做认证页视觉。注册页协议链接是纯文本，登录页才有 `terms.html` / `privacy.html` 链接，应一并补齐 |
| 手机号 + 密码登录 | `renderCloudLogin`；`api.js` `login` | 已实现 | `lt_token` 会话 | 保留。忘记密码目前只 `toast`，见下行 |
| 忘记密码 / 重置 | `renderCloudLogin` 按钮 | 未实现 | 无重置接口调用 | 重设计时不要做成可点的假按钮。要么接上后端重置，要么改成说明文字。本阶段不改后端 |
| 短信验证码登录 | `api.js` `otpSend` / `otpVerify`；服务端 `/api/auth/otp/*` | 未实现（客户端） | `LUCKYTODO_TEST_OTP`、`LUCKYTODO_SMS_WEBHOOK` | 客户端不要接上，除非产品明确要 OTP。服务端固定回退码是风险，留在后端阶段处理 |
| 启动与会话恢复 | `boot`、`api.fetchMe` | 已实现 | `lt_token`；401 时 `logout` | 保留。刷新始终回首页 Tab，与路由改造一起处理 |
| 创建家庭 | `renderFamilyGate`；`api.createFamily` | 已实现 | 已登录用户 | 保留 |
| 邀请码加入 | `renderFamilyGate`；`api.acceptInvite`、`createInvite` | 已实现 | 管理员/家长可在个人中心发码 | 保留。邀请码复制依赖 `navigator.clipboard`，失败时仍 toast 显示码 |
| 儿童账号 | `renderMeBody` 内 `prompt`；`api.createChild` | 部分实现 | 角色 `admin` 或 `parent` | 换成应用内表单。不要继续用系统 `prompt` 收集儿童密码 |
| 本机用户名账号 | `renderLocalRegister`、`renderLocalLogin`；`api.createLocalAccount` | 未实现（入口已断） | `lt_local_accounts` | 删除死界面。不要在重设计里恢复「前端 SHA-256 + localStorage」账号 |
| 填写服务器地址 / 旧家庭初始化 | `renderConnect`、`renderSetup`、`renderFamilyLogin` | 未实现（入口已断） | `api.health`、已废弃的 `/api/setup/family`（测试期望 410） | 删除这三屏。NAS 部署继续用「页面与 API 同源」或单独的 `lt_server` 策略，不恢复这套 UI |
| 本地数据并入家庭 | `renderMerge`；`api.mergeLocalDataToFamily`、`clearGuestData` | 已实现 | IndexedDB 中 `guest` 或 `localOnly` 记录 | 保留。清空前的 `confirm` 以后换成应用内确认 |
| 五栏导航 | `tabs` | 已实现 | `state.tab` | 手机保留五项。桌面不要再复制这条底栏，改为侧栏。个人中心与洞察保持二级页 |
| 首页概览 | `renderHomeBody` | 已实现 | 本地 note/todo/event/plan/checkin | 保留信息：问候、四项统计、洞察卡、计划、今日待办、最近便签。搜索与待办页解耦 |
| 旧今日仪表盘 | `renderTodayBody` | 未实现（无调用） | 无 | 确认无产品依赖后删除，避免两套首页 |
| 待办列表与完成 | `renderTodoBody`、`todoCard` | 已实现 | `completions[memberId]` | 保留勾选与待同步标记。补编辑、删除。筛选「今天」把没有 `dueAt` 的待办也算进今天（`renderTodoBody`），重做时要确认这是不是预期 |
| 待办优先级、截止、提醒、执行人 | `renderTodoForm`、`computeTodoRemindAt`、`peoplePicker` | 已实现（仅新建） | 家庭成员列表 | 表单改成可打开已有记录。儿童角色不能改执行人 |
| 日程 | `renderEventForm`、`renderCalBody`、`computeEventRemindAt` | 部分实现 | 儿童不能新建日程 | 日历能看见日程，点击日程卡片没有进入编辑。新建能力保留 |
| 日历月视图与当日列表 | `renderCalBody`、`buildMonthCells`、`bindCalPull` | 已实现 | 聚合 event/todo/note/checkin/milestone | 保留周一为首、下拉展开。桌面可改为常驻月历，不依赖手势。事项点击：计划进详情，便签只跳 Tab，待办/日程不可点开 |
| 便签新建、可见范围、置顶 | `renderNoteForm` | 已实现（仅新建） | 非家庭模式强制 `visibility: self` | 保留字段。列表点击必须打开该条，而不是空白新建 |
| 便签转待办 | `renderNotesBody` | 已实现 | `saveLocalEntity('todo')` | 保留。转换不删除原便签，重设计时要在文案里写清楚 |
| 计划新建与周期 | `renderPlanForm` | 已实现（仅新建） | 日/周/月/间隔、里程碑、执行人、提醒时刻 | 保留领域字段。创建时 `archived: false`，没有归档操作 |
| 计划列表、火花线、年热力 | `renderPlansBody`、`sparklineEl`、`yearHeatmapEl` | 已实现 | 本地 checkin | 视觉可重做。热力色不要继续写死在组件里 |
| 计划详情、里程碑进度 | `renderPlanDetail`、`updateMilestone` | 部分实现 | `prompt` 填写进度说明 | 保留详情页。进度说明改成应用内输入。没有编辑计划标题/周期的入口 |
| 计划打卡 | `checkin.js` `collectCheckinPayload`；详情页保存 `checkin` | 部分实现 | `prompt` + `confirm` + 文件选择 | 改成打卡面板（文字、可选照片）。`renderTodayBody` 里的打卡按钮是死代码 |
| 连续打卡统计 | `renderHomeBody` 内 streak 循环 | 已实现 | 本地 checkin 的日期集合 | 保留计算，迁出首页函数以便测试 |
| 洞察（服务端） | `renderInsightsBody`、`loadHomeInsight` | 部分实现 | 家庭模式、`/api/insights/latest`、管理员 `/api/insights/run` | 保留展示与手动刷新。模型配置不在「我的」，而在 `admin.html`，文案需改准 |
| 洞察（本机规则兜底） | `renderInsightsBody` 后半段 | 已实现 | 近 7 日本地打卡与未完成待办 | 离线时保留，避免洞察页空白 |
| AI 模型配置 | `admin.html`；`PUT /api/settings/ai` | 部分实现 | 管理员登录、`AI_*` 环境变量可预置 | 是否进入 App 内由产品决定。未决定前保持独立页，不要把密钥写进前端仓库 |
| 个人中心 / 成员 | `renderMeBody` | 已实现 | `fetchMe` 同步的 members | 保留成员、共享待办、动态。动态是本地拼接的短句，不是服务端 feed |
| 头像拍摄与裁剪 | `openAvatarCrop`、`avatarButton` | 已实现 | 家庭模式；`uploadMedia({ purpose: 'avatar' })` 后 `fetchMe` | 保留裁剪交互。非家庭模式按钮不可用，文案已说明 |
| 立即同步 | `renderMeBody` → `api.syncNow` | 已实现 | 家庭模式且在线 | 保留。失败只 toast |
| 导出家庭 JSON | `api.exportFamily` | 已实现 | 在线、浏览器下载 | 保留。Capacitor 里 `<a download>` 是否弹出系统分享：待验证 |
| 冲突处理 | `api.listConflicts`、`resolveConflict` | 部分实现 | 一次只处理 `conflicts[0]`，用 `confirm` | 改成列表。选择项写清楚「服务器版本 / 我的版本」 |
| 推送令牌登记 | `api.registerPushToken` | 部分实现 | 占位字符串，注释写明 S2 再接 APNs/FCM | 重设计不要把它画成已开通的通知开关。真推送留到后端与原生阶段 |
| 注销账号 | `api.deleteAccount` | 已实现 | `DELETE /api/auth/account` | 保留，确认框改成应用内，并写明不可恢复 |
| 退出登录 | `renderMeBody` | 已实现 | `POST /api/auth/logout` 失败仍清本地会话 | 保留 |
| 离线横幅 | `offlineBanner` | 已实现 | `navigator.onLine`、`sessionStorage` | 保留。关闭状态按会话记住即可 |
| 本地提醒 | `reminders.reschedule`、`native.scheduleLocal` | 部分实现 | 通知权限；原生用 LocalNotifications；浏览器 `setTimeout` | 原生路径保留。浏览器提醒不要在文案里承诺关页后仍会响。是否取消旧通知再重排：代码只 `schedule`，没有看到 cancel，重复进入可能叠提醒。待验证 |
| 触感 | `native.lightTap` | 已实现 | 仅原生 Haptics；完成待办时调用 | 保留，浏览器无操作是预期 |
| 主屏组件快照 | `widgetBridge.publishWidgetSnapshot` | 已实现 | Android `WidgetBridgePlugin` / iOS 插件 | 保留数据合同（`reminders`、`markedDays`、`dayItems`）。视觉重做不要随意改字段名 |
| 组件草稿回写 | `consumeWidgetDrafts` | 已实现 | 原生 `consumeDrafts` | 保留。浏览器无插件时返回空数组 |
| 深链 | `handleDeepLink`、`bindDeepLinks` | 部分实现 | `luckytodo:` scheme | 保留解析。导航不回写 URL，刷新与系统返回另案处理。单测已覆盖三例 |
| 主题：日间 / 夜间 / 纸色 | `styles.js` `[data-theme]`；`applyChrome` | 部分实现 | 只能靠事先写入 `lt_theme` | 产品确认要保留哪些主题后，再做设置项。未确认前不要删 CSS，避免已手动写入的用户突然丢样式 |
| 大字号 | `[data-font="large"]` | 部分实现 | `lt_font`，无设置项 | 与主题同一决定 |
| 附件 | `attachBlock`、`uploadMedia`、`validateAttachment` | 部分实现 | 单文件 20MB、最多 9 个；离线先存 IndexedDB blob | 新建可用。已有记录看不到、也删不掉附件。离线 blob 之后如何补传：`syncNow` 不上传 blobs，待验证是否会一直 `pending` |
| 软删除 | `saveLocalEntity` 的 `deletedAt`；服务端 sync 接受该字段 | 未实现（界面） | 同步协议已支持 | 先定删除规则（仅创建者 / 管理员 / 执行人），再做入口 |
| 计划归档 | `payload.archived`、计划筛选「已归档」 | 未实现（写入） | 筛选 UI 已在 | 与编辑计划一起做，否则「已归档」是空筛选 |
| 法律页 | `privacy.html`、`terms.html` | 已实现 | 独立静态页 | 保留内容责任方。视觉可以后再对齐，不阻塞主流程 |
| 运维页 | `admin.html` | 部分实现 | 与 App 不同的视觉和登录标签 | 默认不纳入家庭端视觉重做。若要放进 App，先定权限与密钥展示方式 |
| PWA 安装与离线壳 | `sw.js`、`manifest.webmanifest`、`index.html` | 部分实现 | 非原生才注册 SW；方向锁竖屏 | 手机 PWA 保留。桌面若要横屏使用，需改 `orientation`。预缓存列表要跟模块拆分一起更新 |
| 启动闪屏 | `index.html` `#boot-splash`；Capacitor Splash | 已实现 | 原生 Splash 时长为 0，主要靠 HTML 闪屏 | 重做时两套闪屏背景一起改，避免先白后青 |
| 搜索 | 首页、待办、便签读取同一 `state.query` | 部分实现 | 全量 `render` | 搜索状态按页面分开。首页不要每次击键重建整页 |

## 数据实体（本地与同步）

`saveLocalEntity` 与日历聚合实际使用的 `entityType`：`note`、`todo`、`event`、`plan`、`checkin`。服务端 push 还允许 `attachment_meta`、`list`（`apps/api/src/index.js`）。前端没有创建这两类的界面。待验证它们是否仍被旧数据使用；重设计不要删除服务端兼容，除非确认没有历史数据。
