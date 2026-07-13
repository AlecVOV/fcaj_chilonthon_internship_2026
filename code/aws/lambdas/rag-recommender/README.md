# RAG Recommender — Lambda Function

> ✅ **Code đã viết xong (2026-07-12), CHƯA deploy** — cần bạn tự chạy theo
> **[`DEPLOY-cmd.md`](DEPLOY-cmd.md)**. Deploy **SAU** `admin-vectorizer` (phụ thuộc
> cùng migration + IAM + nên có sẵn vài media đã embed để test thấy kết quả).

**Purpose:** Sau khi `emotion-detector` phân loại cảm xúc phiên Focus vừa kết thúc,
gợi ý nội dung liên quan (sutra/quote/video) từ `media_library` theo cảm xúc đó.

## Model

| Property | Value |
|----------|-------|
| Model | **Bedrock Cohere Embed Multilingual v3** (`cohere.embed-multilingual-v3`) — **cùng model/1024 chiều với `admin-vectorizer`, bắt buộc khớp nhau** |
| Region model | **`ap-southeast-1`** — có sẵn ngay tại Singapore, cùng region với Lambda (không cross-region — xem `admin-vectorizer/README.md` phần "Vì sao Cohere") |

## Cách hoạt động

Input của route này chỉ là **1 nhãn emotion đã chuẩn hoá** (`focused/stressed/exhausted/
relaxed/unmotivated`), không phải raw journal text — nên Lambda **map nhãn → 1 câu mô tả
ngắn** (`EMOTION_QUERY` trong `lambda_function.py`) rồi embed câu đó bằng Cohere (embed 1
câu có ngữ cảnh chính xác hơn embed 1 từ đơn lẻ, dùng `input_type="search_query"` —
BẤT ĐỐI XỨNG có chủ đích với `admin-vectorizer` dùng `"search_document"`, đúng khuyến
nghị của Cohere để tăng độ chính xác retrieval), sau đó gọi RPC Postgres
`search_similar_content()` (đã có sẵn từ migration `00001`, đổi chiều ở `00015`) để tìm
media tương tự bằng cosine similarity.

```
emotion label -> câu mô tả (EMOTION_QUERY) -> Cohere embed, input_type=search_query (1024d)
  -> RPC search_similar_content(query_embedding, match_threshold=0.3, match_count, filter_type=NULL)
  -> mảng media tương tự nhất
```

## Kiến trúc

- **`lambda_function.py`** — xác thực user thường (không cần admin, cùng pattern
  `emotion-detector`), rồi gọi RPC **bằng chính token của caller** (không dùng
  `service_role`) — hàm Postgres mặc định `SECURITY INVOKER` nên RLS `media_read_all`
  (mọi user đã đăng nhập đọc được) áp dụng bình thường.
- **`requirements.txt`** — chỉ `boto3` (có sẵn trong Lambda runtime).

## Route

| Route | Body | Trả về |
|---|---|---|
| `POST /rag` | `{ "emotion": "stressed", "limit": 3 }` | Mảng phẳng `[{ id, title, content_text, content_url, type, source, similarity }, ...]` — khớp đúng kiểu `any[]` mà `useRAG.ts` đang kỳ vọng |

## Deploy

Xem **[`DEPLOY-cmd.md`](DEPLOY-cmd.md)** — phụ thuộc `admin-vectorizer` đã deploy trước
(cùng migration `00015` + quyền IAM `bedrock:InvokeModel`).

## Environment Variables

| Key | Bắt buộc | Ghi chú |
|-----|-----|--------|
| `SUPABASE_URL` / `SUPABASE_ANON_KEY` | ✅ | auth-check + gọi RPC bằng token caller |
| `COHERE_MODEL_ID` | tùy chọn | mặc định `cohere.embed-multilingual-v3` |
| `EMBED_DIMENSIONS` | tùy chọn | mặc định `1024` — **phải khớp với `admin-vectorizer`** |
| `MATCH_THRESHOLD` | tùy chọn | mặc định `0.3` — hạ xuống nếu kết quả luôn rỗng |
| `ALLOWED_ORIGINS` | tùy chọn | CSV domain cho CORS |

## Lambda Config

| Setting | Value |
|---------|-------|
| Runtime | Python 3.12 |
| Memory | 256 MB |
| Timeout | 15 giây |
| Role | `focus-ai-lambda-role` (dùng chung quyền `bedrock:InvokeModel` đã thêm cho `admin-vectorizer`) |
| Layer | Không dùng |
