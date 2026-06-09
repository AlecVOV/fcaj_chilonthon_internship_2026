# RAG Recommender — Lambda Function

**Purpose:** Given an emotion label, query Supabase pgvector for semantically
similar content (sutras, quotes, videos) to recommend to the user.

## How It Works

1. Receives emotion label (e.g., "stressed")
2. Maps emotion to a reference embedding vector
3. Queries `media_library` with pgvector cosine similarity (`<=>`)
4. Returns top 5 matching items

## pgvector Query

```sql
SELECT id, title, content_text, content_url, type, source,
       1 - (embedding_vector <=> query_embedding) AS similarity
FROM media_library
WHERE embedding_vector IS NOT NULL
ORDER BY embedding_vector <=> query_embedding
LIMIT 5;
```

## Deploy

```bash
chmod +x deploy.sh
./deploy.sh focus-rag-recommender
```

## Lambda Config

| Setting | Value |
|---------|-------|
| Runtime | Python 3.12 |
| Memory | 512 MB |
| Timeout | 10 seconds |
