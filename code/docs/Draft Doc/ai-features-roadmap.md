# AI Features Roadmap — các tính năng AI còn lại (kế hoạch implement)

> Trạng thái 2026-07-12. **App đã chạy đầy đủ** — 2 tính năng dưới đây (vectorizer/rag)
> đều có **fallback client** nên là *nâng cấp*, không phải blocker. Đã deploy: **Bedrock Task
> Agent** + **Ambient Sound** + **Emotion Detector**. `emotion-detector` **ĐÃ DEPLOY & LIVE**
> (DistilBERT ONNX đóng gói trong Lambda, xem `aws/lambdas/emotion-detector/`) — test qua
> `curl` với token thật trả 200, CloudWatch xác nhận không lỗi.
> `report-generator` đã bị bỏ khỏi kế hoạch (export report giờ
> thuần client-side, xem `docs/PROJECT_STATE.md` mục 23).
>
> 💡 **Nguyên tắc vàng:** phần khó duy nhất là nhét model ML vào Lambda (giới hạn layer 250MB).
> Vì **Bedrock đã bật sẵn** (account có access Claude Haiku 4.5, có thể xin thêm Titan Embeddings),
> nên làm 2 tính năng còn lại (vectorizer/rag) qua **Bedrock API** để tránh đóng gói ML → đa số
> thành Dễ/Medium. `emotion-detector` **CỐ TÌNH không dùng Bedrock** — đã hỏi user, chọn giữ
> DistilBERT ONNX (đóng gói qua S3 vì zip >50MB, không qua Lambda Layer).

## Bảng tổng quan

| # | Lambda | Route (openapi) | Fallback hiện tại | Cách khôn | Effort | Phụ thuộc |
|---|---|---|---|---|---|---|
| 1 | emotion-detector | `POST /emotion` | — (đã deploy, không còn cần fallback) | ✅ **DEPLOYED & LIVE (2026-07-12)** — DistilBERT ONNX trong Lambda | Xong | — |
| 2 | admin-vectorizer | `POST /embed`,`/embed-all` * | nút Embed lỗi | Bedrock Titan Embeddings | 🟡 ~2-3h | migration đổi chiều vector |
| 3 | rag-recommender | `POST /rag` * | 2 gợi ý hardcode | Titan embed query + pgvector | 🟡 ~1-2h | #2 + có nội dung media |
| 4 | nightly aggregation | EventBridge cron | dashboard tính client | Lambda gom daily_stats | 🟢 ~1h | — (LOW priority) |
| 5 | KB ingestion | — | admin nhập tay CMS | crawl/ingest pipeline | 🔴 optional | #2 |

> **`report-generator` đã bị bỏ khỏi kế hoạch (2026-07-10)** — export report giờ chạy thuần
> client-side (`useReportExport.ts`), không cần Lambda/S3/SES nữa. Xem `docs/PROJECT_STATE.md`
> mục 23. Đây là quyết định scope, không phải thiếu sót — đừng đề xuất lại trừ khi cần email báo cáo thật.

\* Frontend path/env đã chuẩn bị: emotion dùng `NUXT_PUBLIC_EMOTION_API_URL` (fallback về
`apiGatewayUrl` nếu thiếu), rag dùng `NUXT_PUBLIC_RAG_API_URL` (rỗng→fallback). Route trong
`openapi.yaml` đã khớp `/emotion`; `/rag/recommend`, `/admin/vectorize` vẫn **lệch** với frontend
(`/rag`, `/embed`) — chốt 1 hợp đồng khi làm (khuyến nghị theo frontend cho gọn).

## Pattern dùng chung (mọi lambda mới)
- **Auth:** route user-facing → verify token in-Lambda như `agent-bff._verify_user` (Bearer → Supabase
  PostgREST). Route admin (`/embed`) → thêm check `role='admin'` như `ambient-audio-manager`.
- **Deploy:** thêm route vào HTTP API `ffepnb6gei` + `aws lambda add-permission` cho apigateway
  (xem `aws/bedrock/DEPLOY-cmd.md` Bước 10). Không dep → zip `tar`; có dep → pip `--platform manylinux2014_x86_64`.
- **IAM:** execution role `focus-ai-lambda-role` hiện có logs + s3 + `bedrock:InvokeAgent`. **Cần thêm
  `bedrock:InvokeModel`** (+ `GetInferenceProfile` nếu dùng global profile) cho lambda gọi Bedrock (vectorizer, rag).
  `emotion-detector` KHÔNG cần quyền này (không gọi Bedrock, chỉ cần `logs:*`).
- **Secret:** `SUPABASE_SERVICE_ROLE_KEY` → Secrets Manager (đừng plaintext env).

---

## 1. emotion-detector (✅ ĐÃ DEPLOY & LIVE — DistilBERT ONNX trong Lambda)

**Mục đích:** phân tích journal sau phiên focus → 1 trong 5 nhãn `focused/stressed/exhausted/relaxed/unmotivated` + confidence. Trả về cho frontend lưu cùng session (Lambda không tự ghi DB).

**Cách:** DistilBERT (`bhadresh-savani/distilbert-base-uncased-emotion`) export ONNX + quantize INT8,
đóng gói **thẳng trong Lambda** (không qua Bedrock, không qua Lambda Layer) — `onnxruntime` +
`tokenizers` runtime. Đã cân nhắc đổi qua Bedrock Claude classify (nhanh/dễ hơn) nhưng **user chọn
giữ ONNX** khi được hỏi lại (2026-07-12).

Code đầy đủ: `aws/lambdas/emotion-detector/` — `lambda_function.py` (handler),
`prepare_model.py` (export model 1 lần, chạy local), `test_local.py`, `DEPLOY-cmd.md` (runbook AWS
đầy đủ, gồm bước qua S3 vì zip >50MB, và bẫy platform tag `manylinux2014_x86_64` đã lỗi thời cho
onnxruntime/numpy mới — xem cảnh báo trong file). Chi tiết mapping 6→5 nhãn (xấp xỉ, không có model
public khớp sẵn) xem `aws/lambdas/emotion-detector/README.md`.

**Đã deploy (2026-07-12):** Lambda `emotion-detector` (role `focus-ai-lambda-role`, zip 83.7MB qua S3),
route `POST /emotion` trên HTTP API `ffepnb6gei`. Test `curl` với token thật → 200 +
`{"label":...,"confidence":...}`; không token → 401; CloudWatch không có lỗi.

## 2. admin-vectorizer — embedding (🟡 Medium — Bedrock Titan)

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

## 3. rag-recommender (🟡 Medium — phụ thuộc #2)

**Mục đích:** theo emotion → gợi ý nội dung tương tự (sutra/quote/video) từ `media_library`.

**Cách:** map emotion→câu mô tả → **embed câu đó bằng Titan** (cùng model #2 để cùng chiều) →
gọi RPC `search_similar_content(query_embedding, match_count=5, ...)` (đã có sẵn) → trả top-5.
**Bước:** viết lambda (Titan embed + supabase.rpc) → route `POST /rag` → set `NUXT_PUBLIC_RAG_API_URL`
→ `useRAG.ts` gửi Authorization. **Phụ thuộc:** #2 (cùng chiều embedding) + `media_library` phải CÓ nội dung
đã embed (nếu trống → không có gì để gợi ý; admin nhập media qua CMS `/admin/media` trước).
**Test:** emotion `stressed` → trả các media liên quan.

## 4. Nightly worklog aggregation (🟢 Dễ — LOW priority)

`daily_worklogs`/`daily_stats` dự kiến gom nightly nhưng chưa có gì chạy. **Dashboard hiện tính
client-side inline nên KHÔNG bắt buộc.** Nếu làm: Lambda + EventBridge cron gom `focus_sessions`→`daily_stats`
(service_role). Chỉ cần khi muốn report/analytics phía server nhanh hơn.

## 5. KB ingestion pipeline (🔴 Optional/advanced)

Để RAG hữu ích cần `media_library` có nhiều nội dung. Hiện admin nhập tay qua CMS (đủ cho demo). Pipeline
crawl/ingest tự động (bảng `media_chunks`, chunking, model đa ngữ) là nâng cao — làm sau nếu cần scale nội dung.

> ⚠️ **Phát hiện thật (2026-07-12), lý do CHÍNH cần `media_chunks`/chunking**: `admin-vectorizer`
> hiện cắt `title + content_text` về **2000 ký tự trước khi embed** (`MAX_INPUT_CHARS` trong
> `lambda_function.py`) — bắt buộc, vì Bedrock Cohere Embed **chặn cứng ở 2048 ký tự/text**
> (đã verify thật: gửi text >2048 ký tự → `ValidationException`, KHÔNG tự cắt kể cả có tham số
> `truncate:"END"` — tham số đó chỉ cắt theo token NỘI BỘ trong giới hạn cho phép, không vượt
> qua được rào request-validation 2048 ký tự của chính Bedrock). **Đo thật trên 1 bài giảng
> Lamrim dài** (~19 đoạn, transcript ~1 tiếng): chỉ **4 đoạn đầu** (phần dẫn nhập) lọt vào 2000
> ký tự đó — **15 đoạn còn lại (phần cốt lõi: Giới-Định-Tuệ, phương pháp thiền, ví dụ minh
> hoạ...) hoàn toàn không được tính vào vector**, không lỗi, không cảnh báo, chỉ âm thầm bị bỏ
> qua. **Không mất dữ liệu** (`content_text` vẫn lưu đủ, RAG match trúng vẫn trả full text cho
> user đọc) — chỉ **matching kém chính xác hơn** vì vector chỉ đại diện cho đoạn mở đầu, không
> đại diện cho toàn bộ nội dung thật của bài. Với quote/sutra ngắn thì không sao; với bài giảng
> dài kiểu Lamrim/transcript lớp học thì đây là hạn chế thật, cần **chunking** (chia nhỏ theo
> đoạn, mỗi đoạn 1 vector riêng trong `media_chunks`, khi search thì match theo đoạn rồi trỏ về
> `media_id` gốc) mới xử lý triệt để — chưa làm, ghi lại đây để làm sau.

---

## Thứ tự đề xuất
1. ~~**emotion-detector**~~ — ✅ xong, đã deploy & live (2026-07-12).
2. **vectorizer + rag** (cặp, còn lại duy nhất) — quyết định chiều embedding trước (Titan 1024 + migration, HAY container MiniLM 384).
3. (tùy chọn) nightly aggregation, KB ingestion.

> Khi bắt tay: theo `aws/bedrock/DEPLOY-cmd.md` (pattern deploy) + `aws/UPDATE-guide.md` (cập nhật) +
> `docs/bedrock-agent-findings.md` (bẫy đã gặp: model access, quota RPM, GetInferenceProfile, ES256 auth).
