# Admin Vectorizer — Lambda Function

**Purpose:** When admin adds new media in the CMS, generate a 384-dimension
embedding vector using all-MiniLM-L6-v2 and store it in Supabase pgvector.

## Model

| Property | Value |
|----------|-------|
| Model | all-MiniLM-L6-v2 (Sentence Transformers) |
| Dimension | 384 |
| Size | ~90 MB |
| Speed | ~1400 sentences/sec |

## Flow

1. Admin adds media → CMS calls `useDataService.createMedia()`
2. (Cloud mode) → POST `/admin/vectorize` → this Lambda
3. Lambda loads all-MiniLM-L6-v2, encodes `content_text`
4. `UPDATE media_library SET embedding_vector = '[...]' WHERE id = ?`

## Deploy

This function requires the `sentence-transformers` Lambda Layer (see `../../layers/README.md`).

```bash
chmod +x deploy.sh
./deploy.sh focus-admin-vectorize
```

## Lambda Config

| Setting | Value |
|---------|-------|
| Runtime | Python 3.12 |
| Memory | 512 MB |
| Timeout | 15 seconds |
| Layer | `sentence-transformers` |
