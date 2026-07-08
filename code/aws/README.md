# AWS — Serverless Backend + AI Infrastructure

This folder contains all AWS resources for the Focus Mode App:
Lambda functions, API Gateway config, Bedrock Agent setup, and IAM policies.

## What's Inside

| Path | Purpose |
|------|---------|
| `lambdas/` | 7 Python 3.12 Lambda functions (see below) |
| `layers/` | Lambda Layers for ONNX Runtime + Sentence Transformers (spec only) |
| `api-gateway/` | OpenAPI spec — ⚠️ authorizer trong spec KHÔNG dùng (token Supabase ES256); auth in-Lambda |
| `bedrock/` | Bedrock Agent: OpenAPI action schema + **`DEPLOY-cmd.md` (runbook end-to-end)** + Guardrail + hardened instructions |
| `iam/` | Lambda execution role + resource-based policies |
| `s3/` | Bucket policy + CORS cho `focus-mode-ambient-audio` (+ MP3 nguồn, gitignore) |

> **Pattern auth chung (đã chứng minh chạy):** access_token Supabase ký **ES256** nên KHÔNG
> dùng JWT authorizer ở API Gateway. Mỗi Lambda tự lấy `Authorization: Bearer <token>`, gọi
> `GET {SUPABASE_URL}/rest/v1/users?id=eq.{sub}` kèm token đó → PostgREST verify (mọi thuật
> toán) + RLS. Route admin thì Lambda tự check `role='admin'`.

## Lambda Functions

| # | Function | Trigger | Mem | Timeout | AI Model | Status |
|---|----------|---------|-----|---------|----------|--------|
| 0 | `ambient-audio-manager` | HTTP API `ffepnb6gei` `$default` (no authorizer, auth in-Lambda) | 256 MB | 15s | — | ✅ **DEPLOYED** |
| 1 | `agent-bff` | API Gateway `POST /agent/chat` → Bedrock InvokeAgent | 256 MB | 30s | Bedrock Agent | 🟡 code-ready (blocked: Bedrock Agent) |
| 2 | `agent-action-handler` | Bedrock Agent Action Group → Supabase tasks | 512 MB | 15s | — | 🟡 code-ready (blocked: Bedrock Agent) |
| 3 | `emotion-detector` | API Gateway `POST /emotion/detect` | 512 MB | 15s | distilbert ONNX | ⚪ README only |
| 4 | `report-generator` | API Gateway `POST /report` + EventBridge | 1024 MB | 60s | — | ⚪ README only |
| 5 | `rag-recommender` | API Gateway `POST /rag/recommend` | 512 MB | 10s | pgvector | ⚪ README only |
| 6 | `admin-vectorizer` | API Gateway `POST /admin/vectorize` (admin) | 512 MB | 15s | MiniLM-L6-v2 | ⚪ README only |

> Chỉ **ambient-audio-manager** đã deploy thật (dùng role riêng `ambient-audio-manager-role`).
> **agent-bff** + **agent-action-handler** đã có code hoàn chỉnh (đã fix theo audit) nhưng
> chưa deploy được vì **Bedrock Agent chưa tạo** → theo `bedrock/DEPLOY-cmd.md`. 4 lambda còn
> lại mới chỉ có README.

## Quick Start

0. **Ambient audio (ĐÃ deploy — tham khảo mẫu):** `lambdas/ambient-audio-manager/DEPLOY-cmd.md`
   (bucket + Lambda + HTTP API + auth in-Lambda ES256 — runbook đã verify 200).
1. **Bedrock Task Agent (làm tiếp):** `bedrock/DEPLOY-cmd.md` — end-to-end: model access →
   IAM roles → deploy agent-bff + agent-action-handler → Guardrail → Agent (hardened
   instructions) → Action Group → prepare + alias → route `POST /agent/chat` → test injection.
2. **AI còn lại (emotion / rag / vectorizer / report):** viết code theo từng README; đổi frontend
   path cho khớp openapi (đang lệch: `/emotion` vs `/emotion/detect`, `/rag` vs `/rag/recommend`,
   `/embed` vs `/admin/vectorize`) và gửi `Authorization: Bearer <access_token>`.

## Post-Deploy Check

- [ ] **Ambient (live):** `curl https://ffepnb6gei.execute-api.ap-southeast-1.amazonaws.com/ambient/files`
      → 401 khi không token; 200 + danh sách file với token admin.
- [ ] **Agent (sau deploy):** `curl -X POST .../agent/chat` với `Bearer <access_token>` → tạo task;
      chạy bộ test prompt-injection trong `bedrock/DEPLOY-cmd.md` Bước 12.
- [ ] Verify CloudWatch logs `/aws/lambda/<function>` cho từng function.
- [ ] Kiểm task do agent tạo có `user_id` = user đăng nhập (KHÔNG phải id trong prompt).
