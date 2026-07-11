# AWS — Serverless Backend + AI Infrastructure

This folder contains all AWS resources for the Focus Mode App:
Lambda functions, API Gateway config, Bedrock Agent setup, and IAM policies.

## What's Inside

| Path | Purpose |
|------|---------|
| `lambdas/` | 6 Python 3.12 Lambda functions (see below) |
| `layers/` | Lambda Layers for ONNX Runtime + Sentence Transformers (spec only) |
| `api-gateway/` | OpenAPI spec — không có JWT authorizer (token Supabase ES256 không verify được); auth in-Lambda |
| `bedrock/` | Bedrock Agent: OpenAPI action schema + **`DEPLOY-cmd.md` (runbook end-to-end)** + Guardrail + hardened instructions |
| `iam/` | Lambda execution role + resource-based policies |
| `s3/` | Bucket policy + CORS cho `focus-mode-ambient-audio` (+ MP3 nguồn, gitignore) |
| **`UPDATE-guide.md`** | **Cập nhật hệ thống SAU deploy: đổi gì → chạy lệnh gì → check gì. Đọc khi sửa code/config/agent.** |

> **Pattern auth chung (đã chứng minh chạy):** access_token Supabase ký **ES256** nên KHÔNG
> dùng JWT authorizer ở API Gateway. Mỗi Lambda tự lấy `Authorization: Bearer <token>`, gọi
> `GET {SUPABASE_URL}/rest/v1/users?id=eq.{sub}` kèm token đó → PostgREST verify (mọi thuật
> toán) + RLS. Route admin thì Lambda tự check `role='admin'`.

## Lambda Functions

| # | Function | Trigger | Mem | Timeout | AI Model | Status |
|---|----------|---------|-----|---------|----------|--------|
| 0 | `ambient-audio-manager` | HTTP API `ffepnb6gei` `$default` (no authorizer, auth in-Lambda) | 256 MB | 15s | — | ✅ **DEPLOYED** |
| 1 | `agent-bff` | API Gateway `POST /agent/chat` → Bedrock InvokeAgent | 256 MB | 30s | Bedrock Agent (Haiku 4.5 global) | ✅ **DEPLOYED** |
| 2 | `agent-action-handler` | Bedrock Agent Action Group → Supabase tasks (list/create/update/delete) | 512 MB | 15s | — | ✅ **DEPLOYED** |
| 3 | `emotion-detector` | API Gateway `POST /emotion/detect` | 512 MB | 15s | distilbert ONNX | ⚪ README only — hiện app dùng fallback keyword-regex thuần client (`useEmotionDetector.ts`), KHÔNG phải AI; lambda ONNX vẫn là kế hoạch chưa làm |
| 4 | `rag-recommender` | API Gateway `POST /rag/recommend` | 512 MB | 10s | pgvector | ⚪ README only |
| 5 | `admin-vectorizer` | API Gateway `POST /admin/vectorize` (admin) | 512 MB | 15s | MiniLM-L6-v2 | ⚪ README only |

> **`report-generator` đã bị bỏ khỏi kế hoạch (2026-07-10)**: on-demand export giờ chạy thuần
> client-side (`web/composables/useReportExport.ts`, không qua Lambda/S3/SES); phần nightly-aggregate
> cũng không cần nữa. Không còn folder `lambdas/report-generator/`.

> **3/6 đã deploy thật**: `ambient-audio-manager` (role `ambient-audio-manager-role`),
> `agent-bff` + `agent-action-handler` (role `focus-ai-lambda-role`) — Bedrock Agent
> `task-manager-agent` (id `KKJCF9RAKJ`, alias `prod` = `K8YDCGJRW4`, model Haiku 4.5 global)
> LIVE, action group `todo-manager-api` có 4 operation (list/create/update/delete-task).
> Chi tiết cập nhật hệ thống: `UPDATE-guide.md`. 3 lambda còn lại (emotion/rag/vectorizer)
> **chưa code, chỉ có README** — quyết định có chủ đích (xem `docs/ai-features-roadmap.md`).

## Quick Start

0. **Ambient audio (ĐÃ deploy — tham khảo mẫu):** `lambdas/ambient-audio-manager/DEPLOY-cmd.md`
   (bucket + Lambda + HTTP API + auth in-Lambda ES256 — runbook đã verify 200).
1. **Bedrock Task Agent (ĐÃ deploy):** `bedrock/DEPLOY-cmd.md` — runbook gốc dùng để dựng từ đầu;
   để SỬA hệ thống đang chạy (đổi instructions/model/action group/env) dùng `UPDATE-guide.md`.
2. **AI còn lại (emotion / rag / vectorizer — chưa code):** viết theo từng README; đổi
   frontend path cho khớp openapi (đang lệch: `/emotion` vs `/emotion/detect`, `/rag` vs
   `/rag/recommend`, `/embed` vs `/admin/vectorize`) và gửi `Authorization: Bearer <access_token>`.

## Post-Deploy Check

- [x] **Ambient (live):** `curl https://ffepnb6gei.execute-api.ap-southeast-1.amazonaws.com/ambient/files`
      → 401 khi không token; 200 + danh sách file với token admin.
- [x] **Agent (live):** `POST /agent/chat` với `Bearer <access_token>` → tạo/sửa/xóa/list task;
      bộ test prompt-injection trong `bedrock/DEPLOY-cmd.md` Bước 12.
- [ ] Verify CloudWatch logs `/aws/lambda/<function>` cho từng function (định kỳ, không phải 1 lần).
- [x] Kiểm task do agent tạo có `user_id` = user đăng nhập (KHÔNG phải id trong prompt).
