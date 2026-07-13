# Admin Vectorizer — Lambda Function

> ✅ **Code đã viết xong (2026-07-12), CHƯA deploy** — cần bạn tự chạy theo
> **[`DEPLOY-cmd.md`](DEPLOY-cmd.md)** (gồm cả migration DB bắt buộc chạy trước).

**Purpose:** Khi admin thêm/sửa media trong CMS (`/admin/media`), sinh embedding vector
cho `content_text` (+ `title`) rồi lưu vào `media_library.embedding_vector` (pgvector)
để `rag-recommender` dùng tìm nội dung tương tự theo cảm xúc.

## Model

| Property | Value |
|----------|-------|
| Model | **Bedrock Cohere Embed Multilingual v3** (`cohere.embed-multilingual-v3`) — **KHÔNG** đóng gói ML, gọi qua Bedrock API |
| Dimension | **1024** (xem migration `00015`) |
| Region model | **`ap-southeast-1`** — có sẵn ngay tại Singapore, **cùng region với Lambda** (không cross-region) |

> **Vì sao Cohere chứ không phải Titan?** Ban đầu định dùng Bedrock Titan Embed v2, nhưng
> **Titan không có ở `ap-southeast-1`** (đã verify qua `aws bedrock list-foundation-models`).
> Cohere Embed Multilingual v3 thì có sẵn tại đây, cùng 1024 chiều, **không cần Inference
> Profile** (khác `cohere.embed-v4:0` — model đó cần), và xử lý được cả tiếng Việt (đã
> test thật). Đơn giản hơn hẳn — không cross-region, không thêm IAM phức tạp.

## Kiến trúc

- **`lambda_function.py`** — handler thật: xác thực admin in-Lambda (cùng pattern
  `ambient-audio-manager`: Bearer token → PostgREST verify role='admin'), rồi dùng
  **chính token của admin đó** (không dùng `service_role`) để đọc/ghi `media_library`
  qua PostgREST — RLS (`media_write_admin`/`media_update_admin`, dựa vào `is_admin()`)
  là lớp kiểm tra thứ 2 độc lập. Input embed = `title` + `content_text` ghép lại (để
  media thiếu `content_text`, vd video/quote ngắn, vẫn có ít nhất `title` để embed).
  `/embed-all` gọi Cohere **1 lần theo batch** (Cohere API nhận `texts` là mảng, tới 96
  phần tử/lần) thay vì gọi tuần tự từng item — nhanh hơn, ít rủi ro timeout hơn.
- **`requirements.txt`** — chỉ `boto3` (có sẵn trong Lambda runtime, liệt kê để chạy
  local). Không cần `pip install --target`, không Lambda Layer.

## Routes

| Route | Body | Trả về |
|---|---|---|
| `POST /embed` | `{ "mediaId": "<uuid>" }` | `{ "mediaId": "...", "dimensions": 1024 }` |
| `POST /embed-all` | `{}` | `{ "count": N }` — embed mọi item còn `embedding_vector IS NULL`, cap 50 item/lần gọi (1 lệnh gọi Cohere theo batch) |

## Deploy

Xem **[`DEPLOY-cmd.md`](DEPLOY-cmd.md)** — **Bước 0 bắt buộc chạy migration
`supabase/migrations/00015_titan_embeddings.sql`** trước (đổi cột `embedding_vector` từ
384→1024 chiều — tên file giữ nguyên từ lúc soạn ban đầu, nội dung không gắn với model cụ
thể nào) rồi mới deploy Lambda, nếu không PATCH sẽ lỗi kiểu dữ liệu ngay. `DEPLOY-cmd.md`
cũng có bước thêm quyền IAM `bedrock:InvokeModel` (role hiện tại `focus-ai-lambda-role`
chưa có).

## Environment Variables

| Key | Bắt buộc | Ghi chú |
|-----|-----|--------|
| `SUPABASE_URL` | ✅ | dùng cho cả auth-check lẫn đọc/ghi `media_library` |
| `SUPABASE_ANON_KEY` | ✅ | apikey cho PostgREST — **KHÔNG cần `SERVICE_ROLE_KEY`** (dùng token caller + RLS) |
| `COHERE_MODEL_ID` | tùy chọn | mặc định `cohere.embed-multilingual-v3` |
| `EMBED_DIMENSIONS` | tùy chọn | mặc định `1024` — phải khớp `VECTOR(n)` trong DB |
| `ALLOWED_ORIGINS` | tùy chọn | CSV domain cho CORS |

## Lambda Config

| Setting | Value |
|---------|-------|
| Runtime | Python 3.12 |
| Memory | 256 MB |
| Timeout | 30 giây (dài hơn bình thường để dư phòng PostgREST ghi tuần tự nhiều dòng ở `/embed-all`) |
| Role | `focus-ai-lambda-role` (cần thêm `bedrock:InvokeModel` — xem `DEPLOY-cmd.md` Bước 1) |
| Layer | Không dùng |
