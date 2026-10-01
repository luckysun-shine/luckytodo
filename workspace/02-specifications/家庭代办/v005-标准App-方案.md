# 家庭代办 产品需求文档 v005（标准 App）

状态：**draft / 工程进行中**。本版相对 v003/v004，主路径改为云端标准 App：手机号注册登录、创建家庭、邀请加入；不再要求用户自建 NAS 或填写服务器地址。UI 以 Figma「LuckyTodo UI 原型」为准。

产品暂名 LuckyTodo。  
Figma：https://www.figma.com/design/uwS6F2XKfZdCwMCa3jmBfy/LuckyTodo-UI-原型（`fileKey=uwS6F2XKfZdCwMCa3jmBfy`）

## 1. 需求目标

1. 用户用**手机号**注册 / 登录（密码或验证码）。
2. 登录后**创建家庭**或**输入邀请码加入**。
3. 客户端默认连接官方 API，主路径无「连接家庭服务器」。
4. 保留：离线优先同步、便签/待办/日程/计划、角色权限、主屏组件。
5. 信息架构对齐 Figma 六 Tab：首页 / 待办 / 计划 / 日历 / 便签 / 家庭。

## 2. 非目标（一期）

- 云端 + NAS 双模式；用户自填 HTTPS。
- 一账号加入多个家庭。
- 儿童独立手机号注册。
- 远程推送、真短信商用网关、应用市场上架（列入 S2/S3）。
- 积分商城、群聊、OT 协作。

## 3. 数据模型

```text
users（全局账号）
  id, phone(可空=儿童号), password_hash, display_name, agreed_at, created_at, updated_at

families
  id, name, timezone, created_at

members（用户在家庭中的身份）
  id, family_id, user_id, display_name, role, disabled, avatar_*, revision, …

invites
  id, family_id, code, role, created_by, expires_at, max_uses, use_count, created_at

sessions
  token, user_id, member_id?, family_id?, device_name, expires_at, …

otp_codes（开发期可存库；生产可接短信网关）
  phone, code, expires_at
```

约束：成人 `phone` 全局唯一；一用户一期最多一个未删除的 `members` 行；儿童由家长创建，`phone` 为空，用临时登录名 `c_<memberId前8位>` 或家长设置的密码登录（本版儿童账号存于 users.phone 为 `child:<memberId>`）。

## 4. API 清单

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/api/auth/register` | 手机号+密码+显示名+同意协议 |
| POST | `/api/auth/login` | 手机号+密码 |
| POST | `/api/auth/otp/send` | 发验证码（开发打印/测试码） |
| POST | `/api/auth/otp/verify` | 验证码登录或注册 |
| POST | `/api/auth/logout` | 登出 |
| DELETE | `/api/auth/account` | 注销账号（S2） |
| GET | `/api/me` | 当前 user + member + family（无家庭时 family/member 为空） |
| POST | `/api/families` | 创建家庭（当前用户成 admin） |
| POST | `/api/invites` | 管理员生成邀请码 |
| POST | `/api/invites/accept` | 接受邀请码 |
| POST | `/api/members/child` | 家长/管理员创建儿童成员 |
| GET | `/api/families/export` | 导出家庭数据 JSON（S2） |
| POST | `/api/devices/push-token` | 登记推送 token（S2 占位） |
| — | `/api/sync/*` `/api/media/*` | 沿用；需已加入家庭 |

废弃主路径：`POST /api/setup/family`（保留兼容时返回 410 或内部转发到 register+create，文档标明废弃）。

## 5. 客户端流程

1. 启动 → 未登录进登录；已登录无家庭进「创建或加入」；有家庭进首页。
2. 登录屏对齐 Figma `46:54`：密码/验证码切换、协议、注册入口。
3. 底栏六项对齐 Figma；首页 `43:9`、家庭 `43:424` 优先高保真。

## 6. Figma 节点对照

| 画板 | nodeId | 客户端目标 |
|------|--------|------------|
| 登录 | `46:54` | 认证 |
| 新建待办 | `46:328` | 待办表单 |
| 新建计划 | `49:588` | 计划表单 |
| 首页 | `43:9` | tab=home |
| 待办 | `43:111` | tab=todo |
| 日历 | `43:180` | tab=cal |
| 便签 | `43:292` | tab=notes |
| 计划 | `43:345` | tab=plans |
| 家庭 | `43:424` | tab=family |
| 主屏组件示意 | `18:2` | Widget 视觉参考 |

## 7. 设计 Token（一期默认「家庭青绿」）

| Token | 值 |
|-------|-----|
| `--accent` | `#4EB7AC` |
| `--accent-strong` | `#3A9E94` |
| `--on-accent` | `#FFFFFF` |
| `--bg` | `#F5F6F8` |
| `--surface` | `#FFFFFF` |
| `--text` | `#1C1C1E` |
| `--muted` | `#8E8E93` |
| `--radius-md` | `20px` |
| `--radius-lg` | `24px` |
| `--shadow` | `0 8px 24px rgba(28,28,30,0.06)` |

旧皮肤 night / paper 可保留开关，默认 `family`（浅绿灰底 + 青绿强调）。

## 8. 验收（S1）

- 不填服务器地址即可注册登录。
- 创建家庭 + 邀请码加入，两端同步待办。
- 六 Tab 可切换；首页与家庭视觉接近 Figma。
- 儿童由家长创建，角色权限仍生效。

## 9. 相关

- [竞品对比与优化方向](../../01-discussions/家庭代办-竞品对比与优化方向.md)
- v003 / v004（对象模型与组件仍有效；NAS 主路径由本版 supersede）
