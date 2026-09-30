# LuckyTodo Android 主屏组件

对齐 iOS v004：**今日提醒** + **家庭日历**。

## 组件

| 组件 | 尺寸 | 能力 |
|------|------|------|
| 今日提醒 | 小 / 中 / 大（可缩放） | 今日提醒列表；点按打开 App / 对应事项 |
| 家庭日历 | 中 / 大（可缩放） | 本周条 / 月历落点、当日事项；组件内「+」快速添加待办草稿 |

## 数据流

与 iOS 共用同一套 Web 快照协议（`apps/web/src/widgetBridge.js`）：

1. App 登录后 `publishWidgetSnapshot()` → Capacitor 插件 `WidgetBridge.writeSnapshot`
2. Android 写入应用私有目录 `files/widgets/widget-snapshot.json`
3. `AppWidgetManager` 刷新两个 Provider
4. 日历组件「+」写入 `widget-drafts.json`（标题默认「新待办」）
5. 下次打开 App 时 `consumeWidgetDrafts()` 落成本机待办

深链：

- `luckytodo://home?tab=today`
- `luckytodo://home?tab=cal`
- `luckytodo://item?type=todo&id=...`
- `luckytodo://create?type=todo&day=YYYY-MM-DD`

## 添加组件

1. `npm install && npx cap sync android`
2. Android Studio 安装到真机
3. 打开 App 登录一次（生成快照）
4. 长按桌面空白 → 小组件 / 窗口小工具 → **LuckyTodo**
5. 选择「今日提醒」或「家庭日历」

在 App「我的 → 主屏组件」可查看最近快照并点「刷新组件数据」。

## 代码位置

| 路径 | 说明 |
|------|------|
| `widget/WidgetBridgePlugin.java` | Capacitor 桥：writeSnapshot / consumeDrafts / reloadTimelines |
| `widget/WidgetStore.java` | 快照与草稿 JSON |
| `widget/TodayRemindersWidgetProvider.java` | 今日提醒 |
| `widget/FamilyCalendarWidgetProvider.java` | 家庭日历 |
| `widget/AddTodoActionReceiver.java` | 组件内快速添加 |
| `res/layout/widget_*.xml` | RemoteViews 布局 |

## 注意

- Android 没有 iOS App Group；组件与 App 同 UID，共享 `files/widgets/`
- 卸载 App 会清除组件数据与草稿
- 部分桌面启动器对缩放尺寸支持不一致；可在中/大尺寸下查看完整列表与月历
- Google Play 上架材料（隐私政策等）仍需另备；本组件不依赖 Play 服务
