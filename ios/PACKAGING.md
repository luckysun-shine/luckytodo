# LuckyTodo 打包 IPA 教程

本仓库是 **Capacitor + WidgetKit** 工程。打 IPA 需要 **macOS + Xcode**；导出后再用 **全能签** 重签名安装到 iPhone。

相关说明：主屏组件见 [`WIDGETS.md`](./WIDGETS.md)。

## 0. 前提

| 项 | 说明 |
|----|------|
| 电脑 | macOS + 较新 Xcode（建议带 iOS 17 SDK，主屏组件才完整） |
| 证书 | 已有全能签；本机可先用 Apple ID 自动签名打出 IPA |
| Bundle ID | 主 App：`family.luckytodo.app`；组件：`family.luckytodo.app.widget` |
| App Group | `group.family.luckytodo.app`（主 App + 组件扩展都要有） |

> 云端 / Linux 环境无法完成 Archive；请在本机 Mac 上操作。

## 1. 同步前端到 iOS 工程

在仓库根目录：

```bash
git checkout main
git pull
npm install
npx cap sync ios
npx cap open ios
```

- `cap sync` 会把 `apps/web` 拷进 iOS，并更新原生依赖。
- **以后改了前端，每次打 IPA 前都要再 sync 一次。**
- 打开的应是 **`ios/App/App.xcworkspace`**（CocoaPods），不要只开 `.xcodeproj`。

## 2. Xcode 签名配置（首次必做）

1. 左侧选中工程 **App**。TARGETS 里应有两个目标：
   - **App**
   - **LuckyTodoWidgetExtension**
2. 两个目标都打开 **Signing & Capabilities**：
   - 勾选 **Automatically manage signing**（或按你的证书方式手动配置）
   - **Team** 选 **同一个团队**
3. 确认 Capabilities 里都有 **App Groups**，且包含：

   `group.family.luckytodo.app`

   （仓库内 `App/App.entitlements` 与 `LuckyTodoWidget/LuckyTodoWidget.entitlements` 已写好，一般只需 Team 对上。）
4. 顶部运行设备选 **Any iOS Device (arm64)**（不要选模拟器，否则无法 Archive）。

版本号可在两个 target 的 **General → Version / Build** 中修改，建议主 App 与 Widget **保持一致**。

## 3. 真机跑通（强烈建议先做）

1. 用线连接 iPhone，在 Xcode 中选中该真机，点 Run。
2. 检查：
   - App 能打开并完成登录
   - 长按主屏 → 添加组件 → 能看到 **LuckyTodo**（今日提醒 / 家庭日历）
   - 「我的」里能 **刷新组件数据**

组件装不上或空白时，优先检查：**App 与 Extension 是否同一 Team**、**App Group 是否生效**。

## 4. Archive 出包

1. 菜单 **Product → Scheme** 选 **App**
2. 设备仍选 **Any iOS Device (arm64)**
3. **Product → Archive**
4. 完成后弹出 **Organizer**（没有则 **Window → Organizer**）

## 5. 导出 IPA

在 Organizer 中选刚打好的 Archive → **Distribute App**：

1. 推荐选 **Ad Hoc** 或 **Development**（有企业账号可选 Enterprise）
2. 按向导导出；确保 **Widget Extension 一起打进包**
3. 导出到文件夹，得到 `.ipa`

若提示描述文件 / 设备 UDID：

- 开发签：设备需加入该 Team
- 打算完全交给全能签：也可先导出，再在全能签里重签覆盖

## 6. 全能签安装

1. 将 IPA 拷到全能签可读取的位置
2. 用全能签对 IPA **重签名**（尽量保留 **App Groups**；主屏组件依赖它）
3. 安装到 iPhone
4. **设置 → 通用 → VPN 与设备管理** → 信任对应证书
5. 打开 LuckyTodo，登录一次；需要时在「我的」点 **刷新组件数据**
6. 再到主屏添加组件做验证

**证书掉签后**：重新签名安装 → 打开 App 同步 / 刷新一次 → 本地通知与组件快照会恢复。重签名场景下 **不以 APNs 远程推送为准**，提醒走本机 Local Notifications。

## 7. 日常重打流程

```bash
# 只改了 Web
npx cap sync ios

# 改了原生代码或 Pod 依赖
cd ios/App && pod install && cd ../..
npx cap open ios
```

然后重复：**Any iOS Device → Archive → Distribute → 全能签**。

也可使用仓库脚本别名：

```bash
npm run cap:sync
npm run cap:ios
```

## 8. 常见问题

| 现象 | 处理 |
|------|------|
| Archive 灰色不可点 | 设备改成 Any iOS Device，不要选模拟器 |
| 装上没有主屏组件 | Extension 未进包，或重签弄丢 App Group / 未签 Extension |
| 组件空白、不刷新 | 确认同一 App Group；打开 App 刷新快照；交互式「添加」需 iOS 17+ |
| 本地通知不响 | 首次允许通知；重装后打开 App 再同步一次以重新登记 |
| `cap open` / Pod 报错 | 先 `npm install`，用 `App.xcworkspace` 打开；必要时在 `ios/App` 执行 `pod install` |
| 前端改了但 App 里还是旧的 | 忘记执行 `npx cap sync ios` |

## 9. 最短路径（备忘）

```text
npm install
→ npx cap sync ios
→ Xcode：App + Widget 同一 Team + App Group
→ Any iOS Device → Archive → Distribute 导出 IPA
→ 全能签重签安装
```
