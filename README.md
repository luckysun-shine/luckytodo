# LuckyTodo

家庭便签 / 待办 / 日程 / 计划执行应用。**v005 起为主路径标准云端 App**：手机号注册登录、创建家庭、邀请家人；客户端默认连接官方 API，无需自建 NAS。

| 目录 | 说明 |
|------|------|
| `apps/api` | Node 22 多租户 API（用户/家庭/邀请 + SQLite 同步 + 媒体） |
| `apps/web` | 离线优先 Web 客户端（IndexedDB + 同步队列 + PWA，Figma 六 Tab） |
| `ios/` | Capacitor iOS 工程 |
| `android/` | Capacitor Android 工程 |
| `deploy/` | Docker Compose（官方/自托管实例） |
| `workspace/` | 讨论、PRD、原型；正式规格见 v005 |

## 客户端怎么用

1. **手机号 + 密码** 注册 / 登录（不使用短信验证码）。
2. **创建家庭**，或输入家人发来的**邀请码**加入。
3. 使用六 Tab：首页 / 待办 / 计划 / 日历 / 便签 / 家庭。
4. 儿童账号由家长在「家庭」中创建（不独立手机注册）。

规格：[workspace/02-specifications/家庭代办/v005-标准App-方案.md](./workspace/02-specifications/家庭代办/v005-标准App-方案.md)  
UI：[Figma LuckyTodo UI 原型](https://www.figma.com/design/uwS6F2XKfZdCwMCa3jmBfy/LuckyTodo-UI-原型)

## 本地开发

```bash
npm install

# API + 静态页（推荐）
npm start
# http://127.0.0.1:8787/

# 或仅静态前端（API 默认连 8787）
npm run web
# http://127.0.0.1:5173/
```

```bash
npm run test:api
```

环境变量（可选）：

- `LUCKYTODO_OBJECT_STORE` 对象存储占位（S2，未设则本地 media 卷）
- （可选）`LUCKYTODO_TEST_OTP` / `LUCKYTODO_SMS_WEBHOOK`：服务端仍保留 OTP 接口，客户端默认不使用

## 部署

```bash
cd deploy && cp -n .env.example .env
docker compose up -d --build
```

用反向代理把 **HTTPS 域名** 转到容器 `8787`。客户端**自动使用该域名**，用户不再填写服务器地址。

**AI 洞察**：见 [`apps/api/INSIGHTS.md`](./apps/api/INSIGHTS.md)。

## 已实现能力（v005）

- 云端手机号 + 密码注册 / 登录
- 创建家庭 + 邀请码加入 + 儿童账号
- 本机优先写入 + 同步队列；冲突可选手动解决
- 便签 / 待办 / 日程 / 计划；便签可转待办
- 六 Tab + 首页 / 家庭对齐 Figma 结构
- 导出家庭数据、注销账号、推送 token 登记占位
- 主屏组件（iOS / Android）仍可用

## 默认端口

- API / Web：`8787`
- 前端静态调试：`5173`
