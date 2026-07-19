# RAG Vectorisation — Content Embedding & Retrieval

> Cập nhật 2026-07-13 — đồng bộ với bản cài đặt hiện tại (**ĐÃ DEPLOY & LIVE**, không còn là spec).

> **Project:** Focus Mode App  
> **Embedding Model:** **Bedrock Cohere Embed Multilingual v3** (`cohere.embed-multilingual-v3`) — qua Bedrock API, KHÔNG đóng gói ML nào vào Lambda  
> **Vector Dimension:** **1024**  
> **Vector Store:** Supabase pgvector  
> **2 Lambda:** `admin-vectorizer` (sinh embedding, admin-only) + `rag-recommender` (truy hồi, user thường)  

> **Status (2026-07-13):** **ĐÃ DEPLOY & LIVE**, đã embed dữ liệu thật qua UI Admin Media, đã test
> `/rag` trả kết quả thật. Code đầy đủ: `aws/lambdas/admin-vectorizer/lambda_function.py` +
> `aws/lambdas/rag-recommender/lambda_function.py`. DB: bảng `public.media_library`
> (`embedding_vector VECTOR(1024)`, đổi từ 384 ở migration `00015`) + hàm
> `public.search_similar_content()` (migration `00001`, fix bug type mismatch ở `00016`).
> Frontend: `web/composables/useDataService.ts` (`generateEmbedding`/`generateAllEmbeddings`)
> và `web/composables/useRAG.ts` đều gửi `Authorization: Bearer <access_token>` thật.

---

## 1. Vì sao Cohere Embed Multilingual v3? (không phải MiniLM, không phải Titan)

Kế hoạch ban đầu (trong `docs/ai-features-roadmap.md` các bản trước) từng cân nhắc 2 phương án
khác — cả hai đều bị loại bỏ vì lý do cụ thể, verify thật chứ không phải chọn ngẫu nhiên:

| Phương án | Vì sao KHÔNG chọn |
|---|---|
| `all-MiniLM-L6-v2` (Sentence Transformers, 384-dim, tự host) | Phải đóng gói model + `sentence-transformers` vào Lambda Layer (~200MB) hoặc container image — phức tạp hơn hẳn so với gọi 1 API có sẵn |
| Bedrock **Titan Text Embeddings v2** (`amazon.titan-embed-text-v2:0`, 1024-dim) | **Không có sẵn ở `ap-southeast-1`** — đã verify thật qua `aws bedrock list-foundation-models --region ap-southeast-1` (chỉ có Claude/Nova/Cohere, không có `amazon.titan-*`). Muốn dùng phải gọi cross-region sang `us-east-1`. |
| Bedrock **Cohere Embed v4** (`cohere.embed-v4:0`) | Multimodal/multilingual nhưng **yêu cầu Inference Profile** (`get-foundation-model` trả `"inference": ["INFERENCE_PROFILE"]`) — phức tạp hơn, không cần thiết cho use case chỉ embed text |
| **Bedrock Cohere Embed Multilingual v3** ✅ đã chọn | Có sẵn NGAY tại `ap-southeast-1` (không cross-region), **không cần Inference Profile** (gọi `invoke_model` trực tiếp), 1024 chiều, xử lý tốt cả tiếng Việt (đã test thật với câu tiếng Việt có dấu) |

Kết quả: **Lambda gọi Bedrock CÙNG REGION với chính nó** — không cross-region, không cần IAM
`GetInferenceProfile` (khác hẳn với Bedrock Agent dùng Claude Haiku 4.5 global profile).

## 2. Content Types in `media_library`

| Type | Example | Embedding Source |
|---|---|---|
| `quote` | "The mind is everything. What you think you become." | `title` + `content_text` |
| `sutra` | Lamrim class transcripts, sutra passages | `title` + `content_text` (cắt về **2000 ký tự đầu** — xem cảnh báo §5) |
| `video` | YouTube self-help video | `title` (+ `content_text` nếu có mô tả) |
| `article` | Blog posts, mindfulness guides | `title` + `content_text` (cắt 2000 ký tự) |
| `audio` | Meditation audio tracks | `title` (+ `content_text` nếu có) |

## 3. Vectorisation Flow (thật)

```
Admin (/admin/media) → nút "Embed" / "Generate All Embeddings"
      │ POST {API}/embed  { mediaId }        (1 item)
      │ POST {API}/embed-all  {}              (batch — mọi item embedding_vector IS NULL)
      │ Authorization: Bearer <admin access_token>
      ▼
API Gateway (HTTP API ffepnb6gei, KHÔNG JWT authorizer — token ES256)
      ▼
Lambda admin-vectorizer
  1. Xác thực Bearer token in-Lambda: GET {SUPABASE_URL}/rest/v1/users?id=eq.{sub}&select=id,role
     (PostgREST tự verify chữ ký ES256 + RLS) → role phải 'admin', không thì 401/403
  2. Đọc media_library qua PostgREST BẰNG CHÍNH TOKEN CỦA ADMIN (KHÔNG dùng service_role)
     — RLS `media_read_all`/`media_write_admin` là lớp kiểm tra độc lập thứ 2
  3. Ghép text = title + content_text (cắt 2000 ký tự), gọi Bedrock:
     invoke_model(modelId='cohere.embed-multilingual-v3',
                   body={"texts": [...], "input_type": "search_document", "truncate": "END"})
     /embed-all: TOÀN BỘ text của các item cần embed đi trong 1 LẦN GỌI (Cohere nhận texts
     là mảng, tới 96 phần tử) — không gọi tuần tự từng item
  4. PATCH media_library SET embedding_vector = '[0.1,0.2,...]' (pgvector text literal)
     WHERE id = ... (vẫn dùng token admin, không service_role)
  5. Trả {mediaId, dimensions: 1024} hoặc {count: N}
```

## 4. Lambda Code — tóm tắt thật (không phải spec)

Code đầy đủ: `aws/lambdas/admin-vectorizer/lambda_function.py`. Điểm khác biệt so với thiết kế
ban đầu (không dùng `sentence-transformers`/`SentenceTransformer`/`service_role` như bản spec cũ):

- **Không có model nào load trong Lambda** — chỉ gọi `boto3.client('bedrock-runtime').invoke_model()`.
- **Không dùng `SUPABASE_SERVICE_ROLE_KEY`** — chỉ cần `SUPABASE_URL` + `SUPABASE_ANON_KEY`, dùng
  cùng access_token của admin caller cho mọi thao tác đọc/ghi `media_library`.
- **`/embed-all` batch thật sự** — 1 lệnh `invoke_model` cho tới 50 item (`MAX_BATCH`), thay vì
  vòng lặp gọi model từng item một.
- **Input text bị cắt còn 2000 ký tự** (`MAX_INPUT_CHARS`) trước khi gửi Bedrock — Bedrock Cohere
  Embed có giới hạn cứng **2048 ký tự/text** (đã verify thật: gửi >2048 ký tự → `ValidationException`
  ngay, tham số `truncate:"END"` KHÔNG cứu được vì đó là giới hạn request-validation của chính
  Bedrock, không phải giới hạn token nội bộ của model).

## 5. ⚠️ Giới hạn thật: nội dung dài bị cắt khi embed

Với bài giảng/transcript dài (vd 1 buổi giảng Lamrim ~1 tiếng, nhiều đoạn), **chỉ ~2000 ký tự đầu
tiên thực sự được embed** — phần còn lại (thường là phần cốt lõi nằm giữa/cuối bài) hoàn toàn
không ảnh hưởng tới vector, dù `content_text` vẫn lưu đủ trong DB và vẫn hiển thị đủ cho user khi
RAG match trúng. Đã đo thật trên 1 bài giảng mẫu: chỉ 4/19 đoạn (phần dẫn nhập) lọt vào 2000 ký
tự — 15 đoạn còn lại (nội dung chính) bị bỏ qua khi tính embedding.

**Đây là hạn chế đã biết, chưa xử lý triệt để** — cách xử lý đúng là **chunking** (chia nội dung
dài thành nhiều đoạn, mỗi đoạn 1 vector riêng trong bảng `media_chunks`, search theo đoạn rồi trỏ
về `media_id` gốc). Chi tiết đầy đủ + số liệu đo thật: **`docs/ai-features-roadmap.md` mục 5 (KB
ingestion pipeline)**.

## 6. Similarity Search — RAG Retrieval (thật)

Khác với thiết kế ban đầu (dùng `journal_text` làm query), **input thật của `rag-recommender` chỉ
là 1 nhãn emotion đã chuẩn hoá** (`focused/stressed/exhausted/relaxed/unmotivated` — do
`emotion-detector` trả về trước đó), không phải raw text. Lambda map nhãn → 1 câu mô tả ngắn
(`EMOTION_QUERY` trong code) rồi embed câu đó:

```python
EMOTION_QUERY = {
    'focused': 'Content to help someone stay deeply focused and maintain productive momentum.',
    'stressed': 'Calming, soothing content to help relieve stress and anxiety.',
    'exhausted': 'Gentle, restorative content for someone who is mentally drained and needs to recover energy.',
    'relaxed': 'Peaceful content that complements a calm, relaxed state of mind.',
    'unmotivated': 'Inspiring, motivating content to help spark drive and overcome procrastination.',
}
```

**Bất đối xứng có chủ đích**: `admin-vectorizer` embed nội dung lưu trữ với `input_type:
"search_document"`, còn `rag-recommender` embed câu query với `input_type: "search_query"` —
đúng khuyến nghị của Cohere để tăng độ chính xác retrieval (2 input_type khác nhau cho 2 vai trò
khác nhau, dù cùng model/cùng chiều).

Sau khi có vector câu query, gọi RPC có sẵn (KHÔNG viết SQL inline):

```sql
-- search_similar_content(query_embedding VECTOR(1024), match_threshold REAL DEFAULT 0.3,
--                         match_count INTEGER DEFAULT 5, filter_type TEXT DEFAULT NULL)
SELECT * FROM public.search_similar_content(
    query_embedding => :embedding,   -- VECTOR(1024) từ Cohere Embed Multilingual v3
    match_threshold => 0.3,
    match_count     => 3,             -- mặc định FE gửi limit=3
    filter_type     => NULL           -- hoặc một trong: quote|sutra|video|article|audio
);
```

RPC này gọi bằng **chính access_token của user thường** (không cần admin, không dùng
`service_role`) — hàm Postgres mặc định `SECURITY INVOKER` nên chạy dưới quyền caller, RLS
`media_read_all` (mọi user đã đăng nhập đọc được) tự áp dụng.

### ⚠️ Bug thật đã gặp + đã fix (migration `00016`)

Lần đầu tiên RPC này được gọi thật trong lịch sử project (2026-07-13, sau khi `rag-recommender`
deploy), nó lỗi `42804: Returned type double precision does not match expected type real in
column 7` — bug **có sẵn từ migration `00001_initial_schema.sql`**: cột `similarity` khai `REAL`
nhưng biểu thức `1 - (embedding <=> query)` (toán tử pgvector) luôn trả `DOUBLE PRECISION`.
Chưa từng lộ ra vì trước đó chưa Lambda nào gọi RPC này. Fix bằng **migration `00016`** (ép kiểu
tường minh `::REAL` trong `SELECT`).

### Query Strategy

| User Emotion | Query Text (embed với `search_query`) | Content Type Priority |
|---|---|---|
| `focused` | "Content to help someone stay deeply focused..." | `quote`, `video` (motivational) |
| `stressed` | "Calming, soothing content to help relieve stress..." | `sutra`, `audio` (calming) |
| `exhausted` | "Gentle, restorative content for someone who is mentally drained..." | `audio`, `quote` (restorative) |
| `relaxed` | "Peaceful content that complements a calm, relaxed state..." | `article`, `quote` (reflective) |
| `unmotivated` | "Inspiring, motivating content to help spark drive..." | `video`, `quote` (energizing) |

## 7. pgvector Index Configuration

```sql
-- IVF Flat index for approximate nearest neighbor (ANN) search
-- lists = 100 là hợp lý cho < 10,000 dòng (quy mô demo)
CREATE INDEX idx_media_embedding ON media_library
    USING ivfflat (embedding_vector vector_cosine_ops)
    WITH (lists = 100);
```

Index này được **rebuild** ở migration `00015` khi đổi chiều 384→1024 (index cũ gắn với dimension
cũ, phải drop + tạo lại, không tự động chuyển đổi).

## 8. Batch Vectorisation (Admin Bulk Upload) — thật, đã implement

`/embed-all` gọi Bedrock Cohere **1 LẦN DUY NHẤT** cho tới 50 item cùng lúc (không lặp gọi model
từng item), rồi lặp ghi từng dòng vào Postgres (bước ghi vẫn phải tuần tự vì PostgREST PATCH là
theo từng resource). Nếu `media_library` có nhiều hơn 50 item chưa embed, gọi lại `/embed-all`
nhiều lần cho tới khi `count` trả về `0`.

## 9. Content Lifecycle

```
Admin thêm content (createMedia, chưa có embedding_vector)
      │
      ▼
Admin bấm "Embed" hoặc "Generate All Embeddings" → admin-vectorizer → embedding_vector có giá trị
      │
      ▼
Available trong RAG queries (rag-recommender → search_similar_content)
      │
      ▼
Admin có thể set is_active = false → bị loại khỏi kết quả search (không xoá data)
```

## 10. Monitoring & Maintenance

| Check | Frequency | Method |
|---|---|---|
| Embedding dimension | On insert | `EMBED_DIMENSIONS=1024` — assert trong `admin-vectorizer` (`_embed_texts()` raise nếu Cohere trả sai số chiều) |
| Index performance | Weekly | `EXPLAIN ANALYZE` on `search_similar_content()` |
| Stale content | Monthly | Query `is_active = false AND updated_at < NOW() - INTERVAL '90 days'` for cleanup |
| Nội dung dài bị cắt embedding | Khi thêm content mới | Xem §5 — cân nhắc rút gọn `content_text` xuống dưới ~2000 ký tự thủ công, hoặc chờ chunking (chưa làm) |
