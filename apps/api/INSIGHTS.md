# AI 洞察（NAS 定时）

服务端每 **12 小时**汇总家庭数据，调用可配置的 OpenAI 兼容模型，把结果写入 `insight_reports`；App「洞察」页只读最新报告。

## 要不要做完整管理后台？

**现阶段不需要。** 配置入口有三层即可：

1. **Docker 环境变量**（运维默认）：`AI_ENABLED` / `AI_BASE_URL` / `AI_API_KEY` / `AI_MODEL`
2. **浏览器轻量页** `/admin.html`：管理员登录后改模型、立即生成（不是全站后台）
3. **App「我的」**：家庭管理员可在手机上改同一套配置

成员、待办、计划仍在 App 内管理；以后若要日志、备份、多家庭，再考虑独立管理后台。

## 配置示例（docker compose）

```bash
cd deploy
cp .env.example .env
# 编辑 .env 填入密钥
docker compose up -d --build
```

或浏览器打开：`https://你的域名/admin.html`

## API

| 方法 | 路径 | 说明 |
|------|------|------|
| GET/PUT | `/api/settings/ai` | 管理员读写 AI 配置（密钥对外脱敏） |
| GET | `/api/insights/latest` | 读最新报告 |
| POST | `/api/insights/run` | 家长/管理员手动生成（默认 1 小时限流） |

未配置模型或调用失败时，任务会 **规则兜底** 仍写入一份可读卡片，避免洞察页空白。
