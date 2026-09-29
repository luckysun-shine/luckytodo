# LuckyTodo

家庭便签 / 待办 / 日程 / 计划执行应用。服务跑在飞牛 fnOS（Docker），iPhone 通过 HTTPS 连接；IPA 可用全能签签名安装。

本仓库按需求说明书 **v003** 实现第一版可运行工程：

| 目录 | 说明 |
|------|------|
| `apps/api` | Node 22 家庭 API（SQLite + 媒体卷），离线同步推拉、成员、头像/附件 |
| `apps/web` | 离线优先 Web 客户端（IndexedDB + 同步队列），可打包进 Capacitor/IPA |
| `deploy` | 飞牛 Docker Compose |
| `workspace/` | 讨论、PRD、HTML 原型（产品文档） |

## 本地快速跑

```bash
# 终端 1：API（同时可提供静态页面）
cd apps/api
LUCKYTODO_DATA=./data node src/index.js

# 浏览器打开
# http://127.0.0.1:8787/
# 连接服务器时填写 http://127.0.0.1:8787 （本机调试可用 HTTP）
```

跑 API 测试：

```bash
cd apps/api && node --test test/*.test.js
```

## 飞牛 fnOS 部署

1. 把本仓库拷到 NAS（或只拷 `apps/api` + `deploy`）。
2. 在 `deploy` 目录执行：

```bash
docker compose up -d --build
```

3. 用飞牛已有反向代理把 **HTTPS 域名** 转到容器 `8787`。
4. 手机客户端「连接服务器」填写该 `https://` 地址。

数据与附件落在 Docker 卷 `luckytodo_data`（`/data`）。

## 客户端能力（对照 v003）

- 未登录也可本机使用；登录后若有访客数据 **必须提示合并**
- 本机优先写入 + 同步队列；联网后 push / pull
- 便签 / 待办 / 日程 / 计划；计划打卡
- 头像与附件，单文件 **≤ 20MB**，单条最多 9 个
- 皮肤：夜航 / 日间清晰 / 暖纸；字号标准 / 大
- AI 洞察：基于本机近 7 日数据本地计算，不出家庭

## 打 IPA（全能签）

在 macOS 上：

```bash
npm i -g @capacitor/cli @capacitor/ios
npx cap add ios
npx cap sync ios
npx cap open ios
```

用 Xcode Archive 导出 IPA，再用全能签签名安装。提醒依赖系统本地通知；重签名场景下不以 APNs 为准。

## 默认端口

- API / Web：`8787`
