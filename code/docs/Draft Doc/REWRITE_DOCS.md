# Plan viết lại full doc

> Lập ngày 2026-07-13, sau khi cả 6/6 lambda AI đã deploy & live (xem `docs/PROJECT_STATE.md` mục 31). Đây là plan cho bước 3 trong roadmap §5 của `PROJECT_STATE.md`: "Viết full doc — cập nhật toàn bộ `docs/` cho khớp trạng thái cuối". Tất cả các mục dưới đây dựa trên khảo sát thật (grep/đọc trực tiếp từng file), không đoán.

**Thứ tự thực hiện đề xuất:** Tier 0 (quyết định 2 chỗ trùng lặp trước) → Tier 1 → Tier 5 → Tier 2 → Tier 3 → Tier 4 (nặng nhất, để cuối).

---

## Tier 0 — Sai lệch nghiêm trọng, cần quyết định trước (không chỉ sửa status)

| # | File | Vấn đề thật (đã verify) | Đề xuất |
|---|---|---|---|
| 1 | `aws/README.md` | Bảng Lambda dòng 31-32: `rag-recommender`/`admin-vectorizer` vẫn ghi **"⚪ README only"** — sai, cả 2 đã deploy & live | Sửa thành ✅ DEPLOYED, model Cohere, route `/rag`/`/embed`/`/embed-all` |
| 2 | `aws/api-gateway/README.md` | Ghi rõ "Route AI (`/emotion`, `/rag`, `/admin/vectorize`) là spec đích, **CHƯA deploy**" — sai hoàn toàn, cả 3 route đã live | Viết lại toàn bộ đoạn trạng thái |
| 3 | `supabase/README.md` | Danh sách migration dừng ở **00014**, thiếu hẳn `00015`/`00016` | Thêm 2 dòng + sửa "run 00001→00014" thành "→00016" |
| 4 | ⚠️ **`docs/api/openapi.yaml` VS `aws/api-gateway/openapi.yaml`** | **2 bản OpenAPI spec riêng biệt, đã lệch nhau nặng**: bản `docs/` (475 dòng) còn route `/emotion/detect`, `/reports/generate` (report-generator đã **xoá bỏ** từ 2026-07-10!), `/ai/suggestions` (tính năng chưa từng build), `/admin/vectorize` — không route nào khớp thực tế. Chỉ bản `aws/api-gateway/openapi.yaml` được duy trì đúng suốt session | **Cần quyết định**: (a) xoá `docs/api/openapi.yaml`, để lại 1 dòng redirect trỏ sang `aws/api-gateway/openapi.yaml` — khuyến nghị, vì giữ 2 bản chính là lý do nó lệch; hay (b) viết lại 475 dòng cho khớp — tốn công, dễ lệch lại lần sau |
| 5 | ⚠️ **`docs/database/schema.sql` VS `supabase/migrations/*.sql`** | Bản `docs/` vẫn `VECTOR(384)` (2 chỗ), chỉ có **7 bảng** (thiếu `ambient_sounds`, `agent_conversations`, `agent_messages`, `agent_daily_usage`, `daily_stats` = 5 bảng) | Tương tự #4 — khuyến nghị thay bằng **1 file ngắn trỏ về `supabase/migrations/`** (nguồn chuẩn thật) thay vì cố duy trì bản sao thứ 2 |

## Tier 1 — Doc mô tả tính năng AI vừa xong, cần viết lại thật (không chỉ đổi status)

| # | File | Vấn đề | Việc cần làm |
|---|---|---|---|
| 6 | `docs/rag-vectorisation.md` | Ghi model là **all-MiniLM-L6-v2 (Sentence Transformers)** — sai 100%, giờ là Cohere Embed Multilingual v3 qua Bedrock | Viết lại cùng mức độ với `docs/nlp-emotion.md` đã làm: model thật, contract thật, kiến trúc (không cross-region, asymmetric search_document/search_query), câu chuyện bug `00015`→`00016`, giới hạn 2000 ký tự (link sang mục đã note ở `ai-features-roadmap.md`) |
| 7 | `docs/admin-cms.md` §8 | "admin-vectorizer Lambda currently has README only — no code", map route `/admin/vectorize` cũ, nói nút Embed "sẽ báo lỗi" | Cập nhật: đã deploy, route `/embed`+`/embed-all` thật, `Authorization` header đã vá — nút Embed chạy được thật |
| 8 | `docs/ai-features-roadmap.md` | Đã duy trì đúng suốt session | Chỉ đọc lại 1 lượt xác nhận, không cần sửa nhiều |

## Tier 2 — Doc trạng thái tổng quan, cần refresh số liệu

| # | File | Vấn đề |
|---|---|---|
| 9 | `docs/cloud-migration-plan.md` | Nói chung chung "AI compute chưa deploy" |
| 10 | `docs/project-assessment.md` | Ghi "4/6 lambda chưa code" — dùng cho slide/proposal sau nên cần đúng |
| 11 | `docs/user-stories.md` | "28/44 story ✅" — cần soát lại story nào giờ ✅ nhờ RAG/embedding chạy được |
| 12 | `docs/testing-plan.md` | Chưa có mục test cho 2 lambda mới + 2 tính năng ambient mới |
| 13 | `docs/state-management.md` | `useAmbientSound.ts` giờ có thêm `previewingUrl`/`preview()`/`stopPreview()` |
| 14 | `docs/nuxt-directory-structure.md` | Có thể không cần sửa (không tạo file mới ở FE) — chỉ verify |
| 15 | `docs/bedrock-agent-findings.md` | Không liên quan RAG/vectorizer — verify-only |
| 16 | `docs/environment.example` | Không có env FE mới (ragApiUrl fallback sẵn) — verify-only |

## Tier 3 — AWS infra sub-docs

| # | File | Vấn đề |
|---|---|---|
| 17 | `aws/layers/README.md` | Mô tả layer `onnx-transformers`/`sentence-transformers` — giờ **xác nhận cả 3 lambda AI mới đều KHÔNG dùng layer nào** (emotion-detector bundle thẳng, rag/vectorizer gọi Bedrock API) |
| 18 | `aws/iam/README.md` + `lambda-execution-role.json` | Cần verify JSON mẫu có khớp policy thật (đã thêm `bedrock:InvokeModel` cho Cohere) chưa |

## Tier 4 — File lớn nhất, khó nhất: `Plan_and_Deploy.md` (1600+ dòng)

Phần RAG/vectorizer trong này mô tả **kiến trúc KHÁC** những gì thực sự build: hàm `search_similar_chunks()` (không tồn tại, thực tế dùng `search_similar_content()` có sẵn), bảng `media_chunks` (chưa làm), model `all-MiniLM`/`paraphrase-multilingual` (thực tế Cohere), layer `sentence-transformers` (thực tế không dùng layer). Rải rác ở §2, §4, §5, §7, §9, §14 (nhiều đoạn Mermaid), §15.

→ **Khuyến nghị: KHÔNG rewrite toàn bộ** (quá tốn công, dễ vỡ). Thay bằng **đánh dấu tại chỗ** từng đoạn sai (đúng pattern đã dùng cho `project-assessment.md` — giữ nội dung gốc làm lịch sử kế hoạch, chú thích "**Thực tế đã build khác**: ... xem `docs/PROJECT_STATE.md` mục 31") — ưu tiên sửa đúng ở §1 (tóm tắt điều hành) và §2 (bảng hiện trạng theo tầng) vì đây là phần người đọc lướt qua đầu tiên.

## Tier 5 — Chốt lại chính `PROJECT_STATE.md`

Dòng header "Cập nhật: 2026-07-08" (dòng 3) đang lệch với nội dung thật (changelog đã tới mục 31, ngày 2026-07-13) — sửa 1 dòng.

## Ngoài phạm vi (không đụng, đúng quy tắc đã thống nhất)

`docs/Internship Documentation.md`, `docs/Supply Document.md` (RFP gốc), `CLAUDE.md`, `DESIGN-claude.md` (chưa thấy liên quan AI/RAG).
