# AI Features Roadmap — các tính năng AI còn lại (kế hoạch implement)

> Trạng thái 2026-07-09. **App đã chạy đầy đủ** — 4 tính năng dưới đây đều có **fallback client**
> nên là *nâng cấp*, không phải blocker. Đã deploy: **Bedrock Task Agent** + **Ambient Sound**.
>
> 💡 **Nguyên tắc vàng:** phần khó duy nhất là nhét model ML vào Lambda (giới hạn layer 250MB).
> Vì **Bedrock đã bật sẵn** (account có access Claude Haiku 4.5, có thể xin thêm Titan Embeddings),
> nên làm các tính năng qua **Bedrock API** để tránh đóng gói ML → đa số thành Dễ/Medium.

## Bảng tổng quan

| # | Lambda | Route (openapi) | Fallback hiện tại | Cách khôn | Effort | Phụ thuộc |
|---|---|---|---|---|---|---|
| 1 | emotion-detector | `POST /emotion` * | regex client | Bedrock Claude classify | 🟢 ~1h | — |
| 2 | report-generator | `POST /report` + cron | tải `.md` client | Query Supabase + SES | 🟡 ~1-2h | SES verify |
| 3 | admin-vectorizer | `POST /embed`,`/embed-all` * | nút Embed lỗi | Bedrock Titan Embeddings | 🟡 ~2-3h | migration đổi chiều vector |
| 4 | rag-recommender | `POST /rag` * | 2 gợi ý hardcode | Titan embed query + pgvector | 🟡 ~1-2h | #3 + có nội dung media |
| 5 | nightly aggregation | EventBridge cron | dashboard tính client | Lambda gom daily_stats | 🟢 ~1h | — (LOW priority) |
| 6 | KB ingestion | — | admin nhập tay CMS | crawl/ingest pipeline | 🔴 optional | #3 |

\* Frontend path/env đã chuẩn bị: emotion dùng `NUXT_PUBLIC_EMOTION_API_URL`, rag dùng
`NUXT_PUBLIC_RAG_API_URL` (rỗng→fallback). Route trong `openapi.yaml` hiện là `/emotion/detect`,
`/rag/recommend`, `/admin/vectorize` — **lệch** với frontend (`/emotion`, `/rag`, `/embed`); chốt 1
hợp đồng khi làm (khuyến nghị theo frontend cho gọn).

## Pattern dùng chung (mọi lambda mới)
- **Auth:** route user-facing → verify token in-Lambda như `agent-bff._verify_user` (Bearer → Supabase
  PostgREST). Route admin (`/embed`) → thêm check `role='admin'` như `ambient-audio-manager`.
- **Deploy:** thêm route vào HTTP API `ffepnb6gei` + `aws lambda add-permission` cho apigateway
  (xem `aws/bedrock/DEPLOY-cmd.md` Bước 10). Không dep → zip `tar`; có dep → pip `--platform manylinux2014_x86_64`.
- **IAM:** execution role `focus-ai-lambda-role` hiện có logs + s3 + `bedrock:InvokeAgent`. **Cần thêm
  `bedrock:InvokeModel`** (+ `GetInferenceProfile` nếu dùng global profile) cho lambda gọi Bedrock (emotion, vectorizer, rag).
- **Secret:** `SUPABASE_SERVICE_ROLE_KEY` → Secrets Manager (đừng plaintext env).

---

## 1. emotion-detector (🟢 Dễ — qua Bedrock)

**Mục đích:** phân tích journal sau phiên focus → 1 trong 5 nhãn `focused/stressed/exhausted/relaxed/unmotivated` + confidence. Ghi vào `focus_sessions.emotion_label/emotion_confidence`.

**Cách:** KHÔNG dùng distilbert ONNX (layer ~120MB, khó). Dùng **Claude Haiku 4.5** (đã có) classify:
```python
# invoke_model / converse với prompt phân loại, temperature=0, ép JSON output
prompt = f'''Classify the mood of this journal into EXACTLY one of:
focused, stressed, exhausted, relaxed, unmotivated.
Return JSON {{"emotion_label": "...", "confidence": 0.0-1.0}} only.
Journal: """{text[:1000]}"""'''
# bedrock-runtime.invoke_model(modelId='global.anthropic.claude-haiku-4-5-20251001-v1:0', ...)
# parse JSON, validate label in 5 giá trị -> trả {emotion_label, confidence}
```
**Bước:** viết `lambda_function.py` (stdlib + boto3, verify token in-lambda) → deploy (zip tar) → thêm
IAM `bedrock:InvokeModel` + `GetInferenceProfile` cho role → route `POST /emotion` → set
`NUXT_PUBLIC_EMOTION_API_URL` (Amplify + .env) → sửa `useEmotionDetector.ts` gửi Authorization.
**Gotcha:** ép model trả JSON (dùng temperature 0 + validate); quota Haiku 4.5 = 50 RPM (đủ).
**Test:** journal "I feel overwhelmed" → `stressed`.

## 2. report-generator (🟡 Medium — không ML)

**Mục đích:** báo cáo ngày (focus time, mood, tasks, streak) → Markdown → email SES; + cron nightly.

**Bước:** query Supabase (`focus_sessions`, `tasks`, `daily_stats`) theo user+date → render Markdown
template → (tùy chọn) upload S3 `focus-mode-reports` → SES `send_email`. Trigger: `POST /report`
(nút Export) + EventBridge `cron(59 16 * * ? *)`. Env: SUPABASE_URL, SERVICE_ROLE_KEY, S3_BUCKET, SES_SENDER_EMAIL.
**Gotcha:** SES phải **verify sender identity** + **thoát sandbox** (mặc định chỉ gửi tới email đã verify);
PDF (Pandoc) cần layer/container → **bỏ PDF, gửi Markdown/HTML** cho đơn giản. IAM cần `ses:SendEmail` (đã có).
**Test:** `POST /report {user_id,date}` → nhận email.

## 3. admin-vectorizer — embedding (🟡 Medium — Bedrock Titan)

**Mục đích:** admin thêm media → sinh embedding lưu `media_library.embedding_vector` (pgvector) cho RAG.

**Cách:** thay all-MiniLM (layer ~200MB) bằng **Bedrock Titan Text Embeddings v2** (`amazon.titan-embed-text-v2:0`, API, không layer).
**⚠️ Vướng chiều vector:** DB đang `VECTOR(384)` (MiniLM); Titan v2 = **1024** (hoặc 256/512, KHÔNG có 384).
→ Cần **migration** đổi `media_library.embedding_vector` → `VECTOR(1024)` + đổi tham số hàm
`search_similar_content(query_embedding VECTOR(1024), ...)` + rebuild ivfflat index + re-embed media cũ.
*(Thay thế: giữ MiniLM 384 nhưng chạy bằng **container image Lambda** (tới 10GB) — không cần migration,
nhưng setup ECR/Docker phức tạp hơn.)*
**Bước:** migration đổi chiều → viết lambda (invoke Titan → UPDATE embedding_vector) → route `POST /embed`
(+ `/embed-all`) admin-only → IAM `bedrock:InvokeModel` cho Titan → xin **model access Titan** trên Console.
**Test:** admin bấm Embed 1 media → `embedding_vector` != null.

## 4. rag-recommender (🟡 Medium — phụ thuộc #3)

**Mục đích:** theo emotion → gợi ý nội dung tương tự (sutra/quote/video) từ `media_library`.

**Cách:** map emotion→câu mô tả → **embed câu đó bằng Titan** (cùng model #3 để cùng chiều) →
gọi RPC `search_similar_content(query_embedding, match_count=5, ...)` (đã có sẵn) → trả top-5.
**Bước:** viết lambda (Titan embed + supabase.rpc) → route `POST /rag` → set `NUXT_PUBLIC_RAG_API_URL`
→ `useRAG.ts` gửi Authorization. **Phụ thuộc:** #3 (cùng chiều embedding) + `media_library` phải CÓ nội dung
đã embed (nếu trống → không có gì để gợi ý; admin nhập media qua CMS `/admin/media` trước).
**Test:** emotion `stressed` → trả các media liên quan.

## 5. Nightly worklog aggregation (🟢 Dễ — LOW priority)

`daily_worklogs`/`daily_stats` dự kiến gom nightly nhưng chưa có gì chạy. **Dashboard hiện tính
client-side inline nên KHÔNG bắt buộc.** Nếu làm: Lambda + EventBridge cron gom `focus_sessions`→`daily_stats`
(service_role). Chỉ cần khi muốn report/analytics phía server nhanh hơn.

## 6. KB ingestion pipeline (🔴 Optional/advanced)

Để RAG hữu ích cần `media_library` có nhiều nội dung. Hiện admin nhập tay qua CMS (đủ cho demo). Pipeline
crawl/ingest tự động (bảng `media_chunks`, chunking, model đa ngữ) là nâng cao — làm sau nếu cần scale nội dung.

---

## Thứ tự đề xuất
1. **emotion-detector (Bedrock)** — dễ nhất, không migration, nâng cấp thấy ngay ở trang Focus.
2. **report-generator** — không ML, deliverable đẹp (email báo cáo).
3. **vectorizer + rag** (cặp) — quyết định chiều embedding trước (Titan 1024 + migration, HAY container MiniLM 384).
4. (tùy chọn) nightly aggregation, KB ingestion.

> Khi bắt tay: theo `aws/bedrock/DEPLOY-cmd.md` (pattern deploy) + `aws/UPDATE-guide.md` (cập nhật) +
> `docs/bedrock-agent-findings.md` (bẫy đã gặp: model access, quota RPM, GetInferenceProfile, ES256 auth).
