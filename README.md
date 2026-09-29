# LuckyTodo

家庭便签 / 待办 / 日程 / 计划执行应用。服务跑在飞牛 fnOS（Docker），iPhone 通过 HTTPS 连接；IPA 可用全能签签名安装。

| 目录 | 说明 |
|------|------|
| `apps/api` | Node 22 家庭 API（SQLite + 媒体卷），离线同步推拉、成员、头像/附件 |
| `apps/web` | 离线优先 Web 客户端（IndexedDB + 同步队列 + PWA） |
| `ios/` | Capacitor iOS 工程（Xcode / 全能签） |
| `deploy/` | 飞牛 Docker Compose |
| `workspace/` | 讨论、PRD、HTML 原型 |

## 客户端怎么用

1. **首次打开必须注册本机账号**（无游客模式）。
2. **可不配置 NAS**：本机离线使用；无多端同步、无家庭多账号关联。
3. 在「我的」里 **连接家庭服务器** 后，才开启同步与多账号能力；本机数据可合并。

## 本地开发

```bash
# 安装依赖（Capacitor 等）
npm install

# 终端 1：API（同时可托管静态页）
npm start
# 浏览器打开 http://127.0.0.1:8787/

# 或只开前端静态服务
npm run web
# http://127.0.0.1:5173/
```

API 测试：

```bash
npm run test:api
```

## 飞牛 fnOS 部署

```bash
cd deploy && docker compose up -d --build
```

用飞牛反向代理把 **HTTPS 域名** 转到容器 `8787`，手机「连接服务器」填写该地址。

## 打 IPA（macOS + Xcode / 全能签）

本仓库已包含 `ios/` Capacitor 工程与 App Icon。**完整步骤见 [`ios/PACKAGING.md`](./ios/PACKAGING.md)**（签名、Archive、全能签、组件注意点）。

```bash
npm install
npx cap sync ios
npx cap open ios
```

在 Xcode 中为 **App** 与 **LuckyTodoWidgetExtension** 配置同一 Signing Team 后 Archive 导出 IPA，再用全能签签名安装。

- 提醒：原生端用 Local Notifications；浏览器/PWA 用 Web Notification。
- 重签名场景下不以 APNs 推送为准。

## 已实现能力（对照 v003 + 后续迭代）

- 强制本机登录；NAS 可选
- 本机优先写入 + 同步队列；联网后 push / pull
- 便签 / 待办 / 日程 / 计划（含里程碑节点提醒与完成情况）
- 头像与附件，单文件 ≤ 20MB，单条最多 9 个
- 皮肤：夜航 / 日间 / 暖纸；字号标准 / 大
- 启动闪屏 + PWA Service Worker + LuckyTodo Logo
- Capacitor：StatusBar / SplashScreen / LocalNotifications / Haptics
- **主屏组件（v004）**：今日提醒 + 家庭日历 WidgetKit；App Group 快照；组件内添加待办（iOS 17+）。详见 `ios/WIDGETS.md`

## 主屏组件（iOS）

| 组件 | 尺寸 | 说明 |
|------|------|------|
| 今日提醒 | 小 / 中 / 大 | 今日提醒列表，点进 App |
| 家庭日历 | 中 / 大 | 周条/月历落点；iOS 17+ 可在组件内添加待办 |

```bash
npm install && npx cap sync ios && npx cap open ios
```

Xcode 中为 **App** 与 **LuckyTodoWidgetExtension** 配置同一 Signing Team，确认 App Groups 含 `group.family.luckytodo.app`。浏览器无法预览系统组件；App 内「我的」可查看最近快照并手动刷新。

## 默认端口

- API / Web：`8787`
- 前端静态调试：`5173`
