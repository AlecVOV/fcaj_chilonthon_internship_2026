# AWS — Serverless Backend + AI Infrastructure

This folder contains all AWS resources for the Focus Mode App:
Lambda functions, API Gateway config, Bedrock Agent setup, and IAM policies.

## What's Inside

| Path | Purpose |
|------|---------|
| `lambdas/` | 6 Python 3.12 Lambda functions (see below) — **cả 6 đã deploy & live** |
| `layers/` | Lambda Layers — **không dùng** (cả 6 lambda đều bundle deps thẳng hoặc gọi Bedrock API, không cần layer); xem `layers/README.md` |
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
| 3 | `emotion-detector` | API Gateway `POST /emotion` | 512 MB | 15s | DistilBERT ONNX (đóng gói trong Lambda, không gọi Bedrock) | ✅ **DEPLOYED & LIVE (2026-07-12)** — test qua `curl` với token thật trả 200 + CloudWatch xác nhận không lỗi |
| 4 | `rag-recommender` | API Gateway `POST /rag` | 256 MB | 15s | Bedrock Cohere Embed Multilingual v3 (1024-dim, cùng region, không cross-region) | ✅ **DEPLOYED & LIVE (2026-07-13)** — `curl` với token thật trả về mảng gợi ý thật |
| 5 | `admin-vectorizer` | API Gateway `POST /embed` + `POST /embed-all` (admin) | 256 MB | 30s | Bedrock Cohere Embed Multilingual v3 (1024-dim) | ✅ **DEPLOYED & LIVE (2026-07-13)** — đã embed thật qua UI Admin Media |

> **`report-generator` đã bị bỏ khỏi kế hoạch (2026-07-10)**: on-demand export giờ chạy thuần
> client-side (`web/composables/useReportExport.ts`, không qua Lambda/S3/SES); phần nightly-aggregate
> cũng không cần nữa. Không còn folder `lambdas/report-generator/`.

> **6/6 đã deploy thật (2026-07-13)**: `ambient-audio-manager` (role `ambient-audio-manager-role`),
> `agent-bff` + `agent-action-handler` + `emotion-detector` + `rag-recommender` + `admin-vectorizer`
> (role `focus-ai-lambda-role`) — Bedrock Agent `task-manager-agent` (id `KKJCF9RAKJ`, alias `prod` =
> `K8YDCGJRW4`, model Haiku 4.5 global) LIVE, action group `todo-manager-api` có 4 operation
> (list/create/update/delete-task). `emotion-detector` deploy qua S3 (zip 83.7 MB — vượt giới hạn
> CLI 50MB), route `POST /emotion` trên HTTP API `ffepnb6gei` (integration `p2ikfo3`, route
> `u118lpg`). `rag-recommender`/`admin-vectorizer` ban đầu định dùng Bedrock Titan Embed v2 nhưng
> **Titan không có ở `ap-southeast-1`** (đã verify qua `list-foundation-models`) — đổi sang **Cohere
> Embed Multilingual v3** (có sẵn tại chỗ, cùng 1024 chiều, không cần cross-region/inference
> profile, xử lý tốt cả tiếng Việt). Migration `00015` (VECTOR 384→1024) + `00016` (fix bug thật
> `similarity REAL` vs `double precision` có sẵn từ `00001`, chỉ lộ ra khi RPC được gọi lần đầu)
> đều đã chạy. Chi tiết cập nhật hệ thống: `UPDATE-guide.md`; đầy đủ câu chuyện deploy + 3 bug thật
> gặp phải: `docs/PROJECT_STATE.md` mục 29-31.

## Quick Start

0. **Ambient audio (ĐÃ deploy — tham khảo mẫu):** `lambdas/ambient-audio-manager/DEPLOY-cmd.md`
   (bucket + Lambda + HTTP API + auth in-Lambda ES256 — runbook đã verify 200).
1. **Bedrock Task Agent (ĐÃ deploy):** `bedrock/DEPLOY-cmd.md` — runbook gốc dùng để dựng từ đầu;
   để SỬA hệ thống đang chạy (đổi instructions/model/action group/env) dùng `UPDATE-guide.md`.
2. **Emotion detector (ĐÃ deploy — tham khảo mẫu cho lambda có bước "prepare model" nặng):**
   `lambdas/emotion-detector/DEPLOY-cmd.md` — venv riêng để export ONNX, đóng gói qua S3 vì
   >50MB, pitfall platform tag `manylinux2014_x86_64` đã lỗi thời cho onnxruntime/numpy mới.
3. **admin-vectorizer (ĐÃ deploy — tham khảo mẫu cho lambda gọi Bedrock, không cần pip):**
   `lambdas/admin-vectorizer/DEPLOY-cmd.md` — chỉ zip 1 file, thêm IAM `bedrock:InvokeModel`
   cho Cohere (dùng chung với rag-recommender).
4. **rag-recommender (ĐÃ deploy):** `lambdas/rag-recommender/DEPLOY-cmd.md` — deploy SAU
   admin-vectorizer (dùng chung migration + IAM).

## Post-Deploy Check

- [x] **Ambient (live):** `curl https://ffepnb6gei.execute-api.ap-southeast-1.amazonaws.com/ambient/files`
      → 401 khi không token; 200 + danh sách file với token admin.
- [x] **Agent (live):** `POST /agent/chat` với `Bearer <access_token>` → tạo/sửa/xóa/list task;
      bộ test prompt-injection trong `bedrock/DEPLOY-cmd.md` Bước 12.
- [x] **Emotion (live, 2026-07-12):** `POST /emotion` không token → 401; với `Bearer <access_token>` thật →
      200 + `{"label":...,"confidence":...}`; CloudWatch `/aws/lambda/emotion-detector` không có lỗi
      (cold start ~5.3s, warm 1.4-2.2s, peak memory ~275MB/512MB).
- [x] **Admin-vectorizer (live, 2026-07-13):** `/embed`/`/embed-all` không token → 401; qua UI
      Admin Media với token admin → embed thật, `has_embedding` chuyển `Yes`.
- [x] **RAG (live, 2026-07-13):** `/rag` không token → 401; với token thật → mảng gợi ý thật
      (sau khi fix migration `00016` — bug `42804 similarity type mismatch` có sẵn từ `00001`).
- [ ] Verify CloudWatch logs `/aws/lambda/<function>` cho từng function (định kỳ, không phải 1 lần).
- [x] Kiểm task do agent tạo có `user_id` = user đăng nhập (KHÔNG phải id trong prompt).
