# Bedrock Agent — Setup

> ✅ **LIVE**: agent `task-manager-agent` (id `KKJCF9RAKJ`), alias `prod` = `K8YDCGJRW4`, model
> **`global.anthropic.claude-haiku-4-5-20251001-v1:0`**. Action group `todo-manager-api`
> (id `80WEPXLIJ8`) có 4 operation: `GET /list-tasks`, `POST /create-task`, `PUT /update-task`,
> `DELETE /delete-task`. Đây là README ban đầu (giữ lại tham khảo cấu trúc Console) — để
> **deploy từ đầu** dùng [`DEPLOY-cmd.md`](DEPLOY-cmd.md) (runbook end-to-end, kèm bảo mật +
> chống prompt injection); để **sửa hệ thống đang chạy** (đổi instructions/model/action
> group/env) dùng `../UPDATE-guide.md`. Đặc biệt: token Supabase ký **ES256** nên KHÔNG dùng
> JWT authorizer ở API Gateway — agent-bff tự verify token trong Lambda (như ambient-audio-manager).

## What this folder contains

- `action-group-openapi.yaml` — OpenAPI schema cho Action Group (list/create/update/delete-task).
- `DEPLOY-cmd.md` — runbook deploy đầy đủ (Windows cmd) + ma trận bảo mật + test injection.
- `agent-instructions.txt` — instructions đã hardened chống prompt injection (dán vào agent).
- `guardrail-config.json` — cấu hình Guardrail (Prompt Attack HIGH + denied topics + PII).
- `agent-trust-policy.json` / `agent-permissions-policy.json` — IAM cho Bedrock Agent service role.

## Setup in AWS Console

### 1. Create Agent
1. Bedrock Console → Agents → Create Agent
2. Agent Name: `task-manager-agent`
3. Foundation Model: **`global.anthropic.claude-haiku-4-5-20251001-v1:0`** (Haiku 4.5, global cross-region profile, 50 RPM — nguồn chuẩn `DEPLOY-cmd.md`). Cần agent role có `bedrock:GetInferenceProfile` để dùng global profile.
4. Agent Instructions:
```
You are a task management assistant. When a user describes what they need to do:

1. EVALUATE if the description has enough detail (title, due date, priority)
2. IF detailed enough → CALL the create-task action and confirm
3. IF not detailed → ASK follow-up questions to gather more context
4. For complex requests → suggest breaking into multiple tasks
5. ALWAYS confirm what was done with the user
```

### 2. Create Action Group
1. Action Group Name: `todo-manager-api`
2. OpenAPI Schema: Upload `action-group-openapi.yaml`
3. Lambda Handler: `agent-action-handler`

### 3. Configure Guardrails (Optional)
1. Enable PII redaction
2. Enable prompt attack prevention
3. Set max response length

### 4. Create Alias
1. Alias Name: `prod`
2. Associate with latest agent version

### 5. Lambda Resource Policy
```bash
aws lambda add-permission \
  --function-name agent-action-handler \
  --statement-id bedrock-agent-invoke \
  --action lambda:InvokeFunction \
  --principal bedrock.amazonaws.com \
  --source-arn "arn:aws:bedrock:${REGION}:${ACCOUNT}:agent/*" \
  --region ap-southeast-1
```

### 6. Get Agent IDs
After creation, note:
- **Agent ID:** `XXXXXXXXXX` (thực tế đang chạy: `KKJCF9RAKJ`)
- **Agent Alias ID:** `YYYYYYYYYY` (thực tế đang chạy: `K8YDCGJRW4`, tên alias `prod`)

Set these as environment variables on the `agent-bff` Lambda (`BEDROCK_AGENT_ID`,
`BEDROCK_AGENT_ALIAS_ID`).
