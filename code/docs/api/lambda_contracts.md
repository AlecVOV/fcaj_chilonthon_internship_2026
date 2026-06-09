# Lambda Function Contracts — Detailed Request/Response

> **Project:** Focus Mode App  
> **Architecture:** Event-Driven Serverless on AWS Free Tier  
> **Authentication:** Supabase JWT (Bearer token) validated at API Gateway  

---

## 1. Emotion Detection Lambda (`focus-emotion-detector`)

| Property | Value |
|---|---|
| **Runtime** | Python 3.12 |
| **Trigger** | API Gateway `POST /emotion/detect` |
| **Memory** | 512 MB (Free Tier limit) |
| **Timeout** | 15 seconds |
| **Package** | `onnxruntime`, `transformers[torch]`, `psycopg2-binary` |
| **Model** | `distilbert-base-uncased-emotion` (quantized ONNX, ~82 MB) |

### Request

```json
POST /emotion/detect
Authorization: Bearer <supabase_jwt>
Content-Type: application/json

{
  "journal_text": "Today I was extremely focused on my thesis. Finished 3 chapters!",
  "session_id": "550e8400-e29b-41d4-a716-446655440000"
}
```

### Processing

1. Validate JWT (Supabase public key).
2. Load ONNX model from `/opt/model/distilbert-emotion.onnx` (Lambda Layer).
3. Tokenize `journal_text` (max 512 tokens) using HuggingFace tokenizer.
4. Run inference → softmax → map to 5 labels:
   - `0`: focused
   - `1`: stressed
   - `2`: exhausted
   - `3`: relaxed
   - `4`: unmotivated
5. Update `public.focus_sessions` row: set `emotion_label` and `emotion_confidence`.
6. (Optional) Generate 384-dim embedding via `all-MiniLM-L6-v2` for downstream RAG.

### Response (200 OK)

```json
{
  "session_id": "550e8400-e29b-41d4-a716-446655440000",
  "emotion_label": "focused",
  "confidence": 0.91,
  "embedding_vector": null
}
```

### Error Responses

| Status | Body |
|---|---|
| 400 | `{"error": "BadRequest", "message": "journal_text is required and must be ≤ 1000 chars"}` |
| 401 | `{"error": "Unauthorized", "message": "Invalid or expired JWT"}` |
| 500 | `{"error": "InternalError", "message": "Model inference failed: <reason>"}` |

---

## 2. Report Generator Lambda (`focus-report-generator`)

| Property | Value |
|---|---|
| **Runtime** | Python 3.12 |
| **Trigger** | EventBridge `cron(59 16 * * ? *)` (23:59 UTC+7) and API Gateway `POST /reports/generate` |
| **Memory** | 1024 MB |
| **Timeout** | 60 seconds |
| **Package** | `jinja2`, `boto3`, `psycopg2-binary`, `supabase` |
| **LaTeX Engine** | Tectonic (Lambda Layer, ~15 MB standalone binary) |

### Request (API Gateway)

```json
POST /reports/generate
Authorization: Bearer <supabase_jwt>

{
  "user_id": "550e8400-e29b-41d4-a716-446655440000",
  "date": "2026-05-20",
  "send_email": true
}
```

### Request (EventBridge — nightly cron)

```json
{
  "source": "aws.events",
  "detail-type": "Scheduled Event",
  "time": "2026-05-20T16:59:00Z",
  "detail": {}
}
```
When triggered by EventBridge, the Lambda queries **all users** who had focus sessions on the previous day and generates reports for each.

### Processing (per user)

```
1. Query focus_sessions WHERE user_id = ? AND start_time::date = ?date
2. Query tasks WHERE user_id = ? AND updated_at::date = ?date
3. Query daily_worklogs for existing mood_summary
4. Build template context dict:
   {
     "REPORT-DATE-FULL": "May 20, 2026",
     "USER-DISPLAY-NAME": "John Doe",
     "USER-EMAIL": "john@example.com",
     "TOTAL-FOCUS-TIME": "155",
     "SESSIONS-COUNT": 5,
     "TASKS-COMPLETED": 3,
     "TASKS-TOTAL": 5,
     "DOMINANT-EMOTION": "focused",
     "STREAK-DAYS": 12,
     "TASK-LIST-ROWS": "completed & Write thesis & 50 \\\\\ncompleted & Review paper & 30 \\\\\npending & Plan sprint & 0 \\\\",
     "PEAK-FOCUS-HOUR": "22:00 (3 sessions)",
     "MOST-PRODUCTIVE-DAY": "Wednesday (avg 180 min)",
     "LONGEST-STREAK": "95",
     "MOOD-SUMMARY-TEXT": "You maintained strong focus throughout the day, with a slight dip after lunch.",
     "AI-SUGGESTIONS-BLOCK": "\\begin{itemize}\n  \\item Your focus peaks at 22:00. Schedule deep work in the evening.\n  \\item You lose focus after ~90 minutes on Mondays. Try 25/5 Pomodoro cycles.\n\\end{itemize}",
     "RAG-RECOMMENDATIONS-BLOCK": "\\begin{itemize}\n  \\item \\textbf{On Patience} (sutra) — Lamrim Class 2023\n  \\item \\textbf{5-Minute Breathing} (video) — Self-Help\n\\end{itemize}",
     "APP-URL": "https://focusmode.app"
   }
5. Render LaTeX from Jinja2 template → write .tex string
6. Compile .tex → .pdf via Tectonic (subprocess call)
7. Upload both files to S3: s3://YOUR_BUCKET_NAME/reports/{user_id}/{date}/
8. Insert/Update daily_worklogs row with S3 URLs
9. If send_email=true: call Amazon SES SendRawEmail with PDF attachment
```

### Response (200 OK)

```json
{
  "worklog_id": "660e8400-e29b-41d4-a716-446655440000",
  "latex_url": "https://YOUR_BUCKET_NAME.s3.ap-southeast-1.amazonaws.com/reports/550e8400/2026-05-20/report.tex",
  "pdf_url": "https://YOUR_BUCKET_NAME.s3.ap-southeast-1.amazonaws.com/reports/550e8400/2026-05-20/report.pdf",
  "email_sent": true,
  "message": "Report generated and emailed to user@example.com"
}
```

### Email Template (SES)

**Subject:** `Your Daily Focus Report — May 20, 2026`  
**Body (HTML):** Brief summary + link to PDF on S3  
**Attachment:** `focus_report_2026-05-20.pdf`

---

## 3. RAG Recommender Lambda (`focus-rag-recommender`)

| Property | Value |
|---|---|
| **Runtime** | Python 3.12 |
| **Trigger** | API Gateway `POST /rag/recommend` |
| **Memory** | 512 MB |
| **Timeout** | 10 seconds |
| **Package** | `psycopg2-binary`, `supabase`, `sentence-transformers` |

### Request

```json
POST /rag/recommend
Authorization: Bearer <supabase_jwt>

{
  "session_id": "550e8400-e29b-41d4-a716-446655440000",
  "limit": 5,
  "types": ["quote", "sutra"]
}
```

### Processing

1. Query `focus_sessions` for `session_id` → get `journal_text`, `emotion_label`.
2. If `journal_text` exists, generate its embedding via `all-MiniLM-L6-v2` (384-dim).
3. Query `media_library` using pgvector cosine similarity:

```sql
SELECT id, title, content_text, content_url, type, source,
       1 - (embedding_vector <=> query_embedding) AS similarity
FROM media_library
WHERE is_active = TRUE
  AND embedding_vector IS NOT NULL
  AND (types IS NULL OR type = ANY(types))
ORDER BY embedding_vector <=> query_embedding
LIMIT {limit};
```

4. Return ranked results.

### Response (200 OK)

```json
{
  "session_id": "550e8400-e29b-41d4-a716-446655440000",
  "emotion_matched": "stressed",
  "recommendations": [
    {
      "id": "770e8400-e29b-41d4-a716-446655440000",
      "title": "Calming the Restless Mind",
      "type": "sutra",
      "content_text": "Just as a lake stirred by wind...",
      "content_url": null,
      "source": "Lamrim Class 2023 — Week 5",
      "similarity": 0.93
    },
    {
      "id": "880e8400-e29b-41d4-a716-446655440000",
      "title": "The Power of Breathing",
      "type": "video",
      "content_text": "A simple 5-minute breathing exercise...",
      "content_url": "https://youtube.com/watch?v={{VIDEO_ID}}",
      "source": "Self-Help",
      "similarity": 0.87
    }
  ]
}
```

---

## 4. Agentic Suggestions Lambda (`focus-ai-suggestions`)

| Property | Value |
|---|---|
| **Runtime** | Python 3.12 |
| **Trigger** | API Gateway `GET /ai/suggestions` & EventBridge weekly cron |
| **Memory** | 512 MB |
| **Timeout** | 20 seconds |

### Request

```json
GET /ai/suggestions?user_id=550e8400-e29b-41d4-a716-446655440000&days=30
Authorization: Bearer <supabase_jwt>
```

### Processing

1. Query focus_sessions for past N days.
2. Compute heuristics:
   - **Peak energy hour:** hour with highest avg `duration_actual` / `duration_planned` ratio.
   - **Slump day:** weekday with most "unmotivated" / "exhausted" sessions.
   - **Optimal session length:** avg `duration_actual` before emotion dips.
3. Generate suggestions (rule-based for MVP; Bedrock integration planned for Phase 3).

### Response (200 OK)

```json
{
  "user_id": "550e8400-e29b-41d4-a716-446655440000",
  "analysis_period_days": 30,
  "suggestions": [
    {
      "type": "energy_peak",
      "message": "Your focus peaks at 22:00. Consider scheduling deep work sessions between 21:00–23:00.",
      "confidence": 0.82
    },
    {
      "type": "break_time",
      "message": "You lose focus after ~90 minutes on Monday mornings. Try 25/5 Pomodoro cycles on Mondays.",
      "confidence": 0.75
    },
    {
      "type": "task_priority",
      "message": "You complete 80% of tasks tagged 'high priority' within the first 2 focus sessions. Front-load your most important tasks.",
      "confidence": 0.91
    }
  ]
}
```

---

## 5. Admin Vectorization Lambda (`focus-admin-vectorize`)

| Property | Value |
|---|---|
| **Runtime** | Python 3.12 |
| **Trigger** | API Gateway `POST /admin/vectorize` |
| **Memory** | 1024 MB |
| **Timeout** | 30 seconds |
| **Model** | `all-MiniLM-L6-v2` via `sentence-transformers` |

### Request

```json
POST /admin/vectorize
Authorization: Bearer <supabase_jwt>     // Must be admin role

{
  "title": "On Patience — Lamrim Class 2023",
  "content_text": "Patience is the antidote to anger. When anger arises, one must contemplate the disadvantages of hatred and cultivate loving-kindness towards all beings, even those who harm us...",
  "content_url": null,
  "type": "sutra",
  "source": "Lamrim Class 2023 — Week 12",
  "tags": ["patience", "lamrim", "anger-management"]
}
```

### Processing

1. Validate admin JWT (check `app_metadata.role == 'admin'`).
2. Load `all-MiniLM-L6-v2` model.
3. Generate 384-dim embedding from `content_text`.
4. INSERT into `public.media_library` with `embedding_vector`.
5. Return the new row ID.

### Response (201 Created)

```json
{
  "id": "990e8400-e29b-41d4-a716-446655440000",
  "message": "Content embedded and stored successfully. Vector dimension: 384"
}
```

### Response (403 Forbidden)

```json
{
  "error": "Forbidden",
  "message": "Admin role required to vectorize content.",
  "statusCode": 403
}
```

---

## Lambda Environment Variables (All Functions)

| Variable | Description |
|---|---|
| `SUPABASE_URL` | `https://{{PROJECT_ID}}.supabase.co` |
| `SUPABASE_SERVICE_ROLE_KEY` | Service role key for bypassing RLS |
| `SUPABASE_JWT_SECRET` | Public signing key for JWT validation |
| `S3_BUCKET_NAME` | `{{YOUR_BUCKET_NAME}}` |
| `AWS_REGION` | `ap-southeast-1` |
| `SES_SENDER_EMAIL` | `reports@{{YOUR_DOMAIN}}` |
| `HF_API_TOKEN` | HuggingFace API token (if using HF Inference fallback) |
