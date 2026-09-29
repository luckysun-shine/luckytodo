# LuckyTodo 主屏组件（WidgetKit）

对应需求说明书 **v004**：家庭日历 + 今日提醒，液态玻璃视觉。

## 已实现

| 组件 | 尺寸 | 能力 |
|------|------|------|
| 今日提醒 | 小 / 中 / 大 | 今日提醒列表、点进 App 深链 |
| 家庭日历 | 中 / 大 | 周条/月历落点、当日事项、iOS 17+ 组件内「添加」待办 |

数据通过 App Group `group.family.luckytodo.app` 共享：

- 主 App 写入 `widget-snapshot.json`（Web → `WidgetBridge.writeSnapshot`）
- 组件写入 `widget-drafts.json`，主 App 启动时 `consumeDrafts` 落成本机待办/日程

## Xcode 配置（首次）

1. `npm install && npx cap sync ios && npx cap open ios`
2. 选中 **App** 与 **LuckyTodoWidgetExtension**，Signing Team 设为同一团队（全能签同证书）
3. 确认 Capabilities → App Groups 包含 `group.family.luckytodo.app`（已写在 entitlements）
4. 真机或模拟器运行后：长按主屏 → 添加组件 → LuckyTodo

## 深链

- `luckytodo://home?tab=today`
- `luckytodo://item?type=todo&id=...`
- `luckytodo://create?type=todo&day=YYYY-MM-DD`

## 注意

- Widget Extension 最低 **iOS 17**（交互式添加）
- 主 App 最低 **iOS 15**
- 浏览器 / 未签名环境无法渲染系统主屏组件；可用 App 内「我的」查看最近快照摘要
