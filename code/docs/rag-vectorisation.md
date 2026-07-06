# RAG Vectorisation — Content Embedding & Retrieval

> Cập nhật 2026-06-29 — đồng bộ với bản cài đặt hiện tại (trạng thái implement đã ghi rõ).

> **Project:** Focus Mode App  
> **Embedding Model:** `all-MiniLM-L6-v2` (Sentence Transformers)  
> **Vector Dimension:** 384  
> **Vector Store:** Supabase pgvector  
> **Trigger:** Admin action via CMS → AWS Lambda → pgvector  

> **Status (2026-06-29):** Đây là **SPEC**. Hai Lambda liên quan đều mới chỉ có **README** (chưa có `lambda_function.py`): `admin-vectorizer` (sinh embedding) và `rag-recommender` (truy hồi). Layer `sentence-transformers` chỉ là spec; API Gateway có spec nhưng **CHƯA deploy**.
>
> Đã có sẵn trong DB Supabase (migration `00001_initial_schema.sql`): bảng `public.media_library` với `type` CHECK 5 giá trị (`quote`, `sutra`, `video`, `article`, `audio`), cột `embedding_vector VECTOR(384)`, index `ivfflat` cosine; và hàm `public.search_similar_content(query_embedding, match_threshold, match_count, filter_type)` dùng cho truy hồi.
>
> Frontend hiện tại (`web/composables/useRAG.ts`): nếu có `NUXT_PUBLIC_API_GATEWAY_URL` thì `POST {API}/rag`; nếu thiếu URL hoặc lỗi thì trả **2 item hardcode** (On Patience – sutra; 5‑Minute Breathing – video). Backend ghi/đọc trực tiếp Supabase (cloud-only).

---

## 1. Why all-MiniLM-L6-v2?

| Criterion | all-MiniLM-L6-v2 | Alternative (text-embedding-3-small) |
|---|---|---|
| **Dimension** | 384 | 1536 |
| **Model Size** | ~90 MB | ~500 MB |
| **Speed** | ~1400 sentences/sec | ~900 sentences/sec |
| **Lambda Memory** | Fits in 512 MB | Needs 1024+ MB |
| **Quality (MTEB)** | 56.3 | 61.0 |
| **Cost** | Free (local inference) | OpenAI API ($) |

✅ **384 dimensions** keeps pgvector indices small (< 1 MB per 1000 entries) and cosine similarity queries fast (< 50ms on Free Tier).

## 2. Content Types in `media_library`

| Type | Example | Embedding Source |
|---|---|---|
| `quote` | "The mind is everything. What you think you become." | Full quote text |
| `sutra` | Lamrim class transcripts, sutra passages | Full passage text |
| `video` | YouTube self-help video | Title + description (fetched via YouTube API) |
| `article` | Blog posts, mindfulness guides | Full article text (first 2000 chars) |
| `audio` | Meditation audio tracks | Title + description |

## 3. Vectorisation Flow

```
┌──────────────────┐
│  Admin CMS        │
│  (Nuxt 4 / Vue 3) │
│  /admin/media     │
│  Admin pastes new  │
│  quote/sutra text  │
└────────┬───────────┘
         │ POST /admin/vectorize
         ▼
┌──────────────────────────────────────┐
│  API Gateway                          │
│  (Validates JWT → admin role check)  │
└────────┬─────────────────────────────┘
         │
         ▼
┌──────────────────────────────────────┐
│  AWS Lambda: focus-admin-vectorize   │
│                                       │
│  1. Receive {title, content_text,    │
│              type, source, tags}      │
│  2. Load all-MiniLM-L6-v2 (cached)   │
│  3. model.encode(content_text)        │
│     → numpy array shape (384,)        │
│  4. INSERT INTO media_library         │
│     (title, content_text, type,       │
│      source, tags,                    │
│      embedding_vector)                │
│  5. Return {id, message}              │
└────────┬─────────────────────────────┘
         │
         ▼
┌──────────────────────────────────────┐
│  Supabase PostgreSQL + pgvector       │
│                                       │
│  INSERT INTO media_library (...)      │
│  VALUES (..., '[0.023, -0.141, ...]')│
│                                       │
│  → ivfflat index auto-updated        │
└──────────────────────────────────────┘
```

## 4. Embedding Lambda Code (`focus-admin-vectorize`)

```python
import json
import os
import numpy as np
from sentence_transformers import SentenceTransformer
from supabase import create_client

# Load model once (global scope for warm starts)
MODEL_NAME = "sentence-transformers/all-MiniLM-L6-v2"
model = SentenceTransformer(MODEL_NAME)

supabase = create_client(
    os.environ["SUPABASE_URL"],
    os.environ["SUPABASE_SERVICE_ROLE_KEY"]
)

def is_admin(jwt_claims: dict) -> bool:
    """Check if the caller has admin role."""
    app_metadata = jwt_claims.get("app_metadata", {})
    return app_metadata.get("role") == "admin"

def lambda_handler(event, context):
    # Validate JWT claims (set by API Gateway authorizer)
    claims = event.get("requestContext", {}).get("authorizer", {}).get("claims", {})
    if not is_admin(claims):
        return {
            "statusCode": 403,
            "body": json.dumps({
                "error": "Forbidden",
                "message": "Admin role required"
            })
        }

    body = json.loads(event.get("body", "{}"))
    title = body.get("title", "").strip()
    content_text = body.get("content_text", "").strip()
    content_type = body.get("type", "quote")
    source = body.get("source", "")
    tags = body.get("tags", [])
    content_url = body.get("content_url")

    if not title or not content_text:
        return {
            "statusCode": 400,
            "body": json.dumps({
                "error": "BadRequest",
                "message": "title and content_text are required"
            })
        }

    # Generate embedding
    embedding = model.encode(content_text)
    # Convert to Python list for JSON/PostgreSQL
    embedding_list = embedding.tolist()

    # Insert into Supabase
    result = supabase.table("media_library").insert({
        "title": title,
        "content_text": content_text,
        "content_url": content_url,
        "type": content_type,
        "source": source,
        "tags": tags,
        "embedding_vector": embedding_list,
        "created_by": claims.get("sub")  # admin user UUID
    }).execute()

    new_id = result.data[0]["id"] if result.data else None

    return {
        "statusCode": 201,
        "body": json.dumps({
            "id": new_id,
            "message": f"Content embedded and stored. Vector dimension: {len(embedding_list)}"
        })
    }
```

## 5. Similarity Search Query (RAG Retrieval)

When a user completes a focus session with a detected emotion, the RAG Recommender Lambda queries pgvector **qua hàm có sẵn** `public.search_similar_content()` (đã định nghĩa trong migration `00001`) thay vì SQL inline:

```sql
-- search_similar_content(query_embedding VECTOR(384), match_threshold REAL DEFAULT 0.3,
--                         match_count INTEGER DEFAULT 5, filter_type TEXT DEFAULT NULL)
SELECT * FROM public.search_similar_content(
    query_embedding => :embedding,   -- VECTOR(384) từ all-MiniLM-L6-v2
    match_threshold => 0.3,          -- tối thiểu 30% match
    match_count     => 5,
    filter_type     => NULL           -- hoặc một trong: quote|sutra|video|article|audio
);
```

Bên trong, hàm thực thi logic cosine tương đương (giữ lại để tham khảo):

```sql
-- Cosine similarity: 1 - cosine_distance = similarity score (0 to 1)
SELECT
    id, title, content_text, content_url, type, source,
    1 - (embedding_vector <=> query_embedding) AS similarity
FROM public.media_library
WHERE is_active = TRUE
  AND embedding_vector IS NOT NULL
  AND 1 - (embedding_vector <=> query_embedding) > 0.3   -- minimum 30% match
ORDER BY embedding_vector <=> query_embedding             -- ascending distance
LIMIT 5;
```

### Query Strategy

| User Emotion | Query Embedding From | Content Type Priority |
|---|---|---|
| `focused` | session journal_text | `quote`, `video` (motivational) |
| `stressed` | session journal_text | `sutra`, `audio` (calming) |
| `exhausted` | session journal_text | `audio`, `quote` (restorative) |
| `relaxed` | session journal_text | `article`, `quote` (reflective) |
| `unmotivated` | session journal_text | `video`, `quote` (energizing) |

## 6. pgvector Index Configuration

```sql
-- IVF Flat index for approximate nearest neighbor (ANN) search
-- lists = 100 is optimal for < 10,000 rows (Free Tier scale)
CREATE INDEX idx_media_embedding ON media_library
    USING ivfflat (embedding_vector vector_cosine_ops)
    WITH (lists = 100);

-- For exact search (small dataset), just use:
-- ORDER BY embedding_vector <=> query_embedding
-- (the <=> operator computes cosine distance)
```

## 7. Batch Vectorisation (Admin Bulk Upload)

For bulk importing content (e.g., 100+ Lamrim quotes at once):

```python
def batch_vectorize(contents: list[dict]) -> list[dict]:
    """Vectorize multiple content items efficiently."""
    texts = [item["content_text"] for item in contents]
    embeddings = model.encode(texts, batch_size=32, show_progress_bar=True)

    results = []
    for item, emb in zip(contents, embeddings):
        results.append({
            **item,
            "embedding_vector": emb.tolist()
        })

    # Batch insert (Supabase supports bulk insert)
    supabase.table("media_library").insert(results).execute()
    return results
```

## 8. Content Lifecycle

```
Admin adds content → vectorized immediately → available in RAG queries
                                                        │
                                                        ▼
                                              Admin can deactivate
                                              (is_active = false)
                                                        │
                                                        ▼
                                              Excluded from similarity
                                              search results
```

## 9. Monitoring & Maintenance

| Check | Frequency | Method |
|---|---|---|
| Embedding dimension | On insert | Assert `len(vector) == 384` |
| Index performance | Weekly | `EXPLAIN ANALYZE` on similarity query |
| Stale content | Monthly | Query `is_active = false AND updated_at < NOW() - INTERVAL '90 days'` for cleanup |
| Model drift | Per semester | Re-evaluate retrieval quality with sample queries |
