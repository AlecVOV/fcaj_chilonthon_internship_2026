# Lambda Function Contracts — Detailed Request/Response

> Cập nhật 2026-07-12 — đồng bộ với bản cài đặt hiện tại (trạng thái implement đã ghi rõ).

> **Project:** Focus Mode App  
> **Architecture:** Event-Driven Serverless on AWS Free Tier  
> **Authentication:** Supabase JWT (Bearer token) validated at API Gateway  
> **Tài liệu này là SPEC.** Backend hiện chạy **cloud-only trên Supabase** (Postgres + Auth + pgvector); mọi read/write của frontend đi thẳng Supabase. Lớp AWS (API Gateway + Lambda + Bedrock) **CHƯA deploy**; các Lambda dưới đây chỉ có code ở 2 hàm agent (xem bảng dưới), còn lại mới chỉ có README.

## Trạng thái implement (2026-06-29)

| Lambda | Trạng thái | Ghi chú |
|---|---|---|
| `agent-bff` | **CÓ code** (`aws/lambdas/agent-bff/lambda_function.py`, có `deploy.sh`) | BFF gọi Bedrock InvokeAgent. CHƯA mô tả contract chi tiết trong file này — xem README của hàm. |
| `agent-action-handler` | **CÓ code** (`aws/lambdas/agent-action-handler/lambda_function.py`, có `deploy.sh`) | Action Group của Bedrock Agent: create/update/delete task trong Supabase. |
| `emotion-detector` | **ĐÃ DEPLOY & LIVE (2026-07-12)** (`aws/lambdas/emotion-detector/lambda_function.py`) | DistilBERT ONNX đóng gói trong Lambda (không qua Bedrock). Mục 1 dưới đây mô tả contract THẬT. Test qua `curl` với token thật trả 200, CloudWatch không lỗi. |
| `rag-recommender` | **MỚI README** (chưa có `lambda_function.py`) | Mục 2 dưới đây là spec. |
| `admin-vectorizer` | **MỚI README** (chưa có `lambda_function.py`) | Mục 4 dưới đây là spec. |
| Agentic Suggestions (`focus-ai-suggestions`) | **Chỉ spec** (chưa có thư mục/code) | Mục 3 dưới đây là spec đề xuất. |
| Layers (`onnx-transformers`, `sentence-transformers`) | **Chỉ spec** | `aws/layers/` mới có README. |
| API Gateway (`aws/api-gateway/openapi.yaml`) + Bedrock action group (`aws/bedrock/action-group-openapi.yaml`) | **Có spec, CHƯA deploy** | Frontend chỉ gọi khi có `NUXT_PUBLIC_API_GATEWAY_URL`; nếu thiếu thì dùng fallback (xem mục Frontend fallback). |

> **`report-generator` đã bị bỏ khỏi kế hoạch (2026-07-10)** — folder Lambda + spec đã xóa. Export report giờ chạy **thuần client-side**, xem bullet "Report" bên dưới.

> **Lưu ý route:** `/emotion` đã khớp giữa `openapi.yaml` và frontend. `/rag/recommend`,
> `/admin/vectorize` trong OpenAPI spec vẫn lệch với route rút gọn frontend gọi (`/rag`, `/admin` hoặc
> `/embed`) — khi deploy 2 lambda đó cần thống nhất route giữa hai bên trước.

## Frontend fallback (khi chưa có API Gateway URL)

- **Emotion** (`web/composables/useEmotionDetector.ts`): **ĐÃ DEPLOY & LIVE** — có URL → `POST {API}/emotion` kèm `Authorization: Bearer <access_token>`; chỉ rơi về **regex client-side** (đủ cả 5 nhãn kể cả `unmotivated`) nếu thiếu URL trong env.
- **RAG** (`web/composables/useRAG.ts`): có URL → `POST {API}/rag`; thiếu URL/ lỗi → trả **2 item hardcode** (On Patience – sutra; 5‑Minute Breathing – video).
- **Report** (`web/composables/useReportExport.ts`): **KHÔNG gọi API nào nữa** (đổi 2026-07-10) — luôn render Markdown + tải `.md` thuần client-side; không còn khái niệm "fallback", đây là đường duy nhất.
- **Agent chat** (`web/composables/useAgentChat.ts`): **bắt buộc** API Gateway URL; thiếu URL → **báo lỗi** "AI agent backend is not configured" (không có mock).

---

## 1. Emotion Detection Lambda (`emotion-detector`) — ĐÃ DEPLOY & LIVE

> **Status:** **ĐÃ DEPLOY & LIVE** (`aws/lambdas/emotion-detector/lambda_function.py`, 2026-07-12).
> Test qua `curl` với token thật trả 200 + CloudWatch không lỗi. Frontend chỉ fallback regex
> client-side nếu thiếu API Gateway URL trong env. Nhãn app: `focused`, `stressed`, `exhausted`, `relaxed`,
> `unmotivated`. **Stateless** — Lambda KHÔNG ghi Supabase, frontend tự lưu.

| Property | Value |
|---|---|
| **Runtime** | Python 3.12 |
| **Trigger** | API Gateway `POST /emotion` |
| **Memory** | 512 MB |
| **Timeout** | 15 seconds |
| **Package** | `onnxruntime`, `numpy`, `tokenizers` (KHÔNG có `transformers`/`torch`/`psycopg2` lúc runtime) |
| **Model** | `bhadresh-savani/distilbert-base-uncased-emotion` (quantized ONNX INT8, ~80-90 MB), đóng gói thẳng trong Lambda zip qua S3 (không Lambda Layer) |
| **Auth** | In-Lambda, giống `agent-bff`/`ambient-audio-manager` (Bearer token → PostgREST verify) |

### Request

```json
POST /emotion
Authorization: Bearer <supabase_access_token>
Content-Type: application/json

{
  "text": "Today I was extremely focused on my thesis. Finished 3 chapters!"
}
```

### Processing

1. Verify token in-Lambda: `GET {SUPABASE_URL}/rest/v1/users?id=eq.{sub}` với Bearer token đó (PostgREST verify chữ ký ES256 + RLS) — KHÔNG dùng JWT authorizer của API Gateway.
2. Load model ONNX + tokenizer 1 lần lúc cold start (`onnxruntime` + `tokenizers`, cache module-level).
3. Tokenize `text` (max 256 tokens, truncate + pad); text input bị cắt còn ≤1000 ký tự trước đó (không reject).
4. Run inference → softmax → argmax → nhãn gốc model (6 lớp: `sadness, joy, love, anger, fear, surprise`).
5. Map sang nhãn app qua bảng xấp xỉ thủ công `MAP_TO_APP_LABEL` (`joy→focused`, `love→relaxed`, `surprise→focused`, `anger→stressed`, `fear→stressed`, `sadness→exhausted`); confidence dưới `THRESHOLD_UNMOTIVATED` (mặc định 0.35) → gán `unmotivated`.
6. Trả kết quả — **không ghi DB**. Frontend tự lưu `emotion_label`/`emotion_confidence` cùng lúc lưu session.

### Response (200 OK)

```json
{
  "label": "focused",
  "confidence": 0.91
}
```

### Error Responses

| Status | Body |
|---|---|
| 401 | Token thiếu/hết hạn/không hợp lệ (verify qua PostgREST thất bại) |
| 500 | Lỗi inference hoặc lỗi không mong đợi khác |

> ⚠️ Mapping 6→5 nhãn là **xấp xỉ**, không phải phân loại chính xác cao — chi tiết + lý do xem
> `aws/lambdas/emotion-detector/README.md`.

---

## 2. RAG Recommender Lambda (`focus-rag-recommender`)

> **Status:** MỚI README (chưa có `lambda_function.py`). Spec dưới đây. Frontend (`web/composables/useRAG.ts`) gọi `POST {API}/rag` khi có URL, ngược lại trả 2 item hardcode. Truy vấn pgvector dùng hàm `public.search_similar_content()` (đã có trong migration `00001`); embedding `all-MiniLM-L6-v2` = **384 chiều**; `media_type` hợp lệ = quote/sutra/video/article/audio.

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
3. Query `media_library` qua hàm `public.search_similar_content()` (đã có sẵn trong migration `00001`), thay vì SQL inline:

```sql
-- search_similar_content(query_embedding VECTOR(384), match_threshold REAL DEFAULT 0.3,
--                         match_count INTEGER DEFAULT 5, filter_type TEXT DEFAULT NULL)
SELECT * FROM public.search_similar_content(
    query_embedding => :embedding,   -- VECTOR(384)
    match_threshold => 0.3,
    match_count     => :limit,
    filter_type     => :type          -- một trong: quote|sutra|video|article|audio, hoặc NULL
);
-- Hàm đã lọc is_active = TRUE, embedding_vector IS NOT NULL và ngưỡng similarity,
-- trả về: id, title, content_text, content_url, type, source, similarity.
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

## 3. Agentic Suggestions Lambda (`focus-ai-suggestions`)

> **Status:** Chỉ spec — CHƯA có thư mục/code trong `aws/lambdas/`. Mục "AI Suggestions"/"Recommended Content" từng là chuỗi tĩnh hardcode trong report Markdown đã bị **bỏ hẳn** (2026-07-10, xem `docs/PROJECT_STATE.md` mục 18/R1) — report giờ không có phần suggestions nào cho tới khi lambda này thật sự được xây.

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

## 4. Admin Vectorization Lambda (`focus-admin-vectorize` / thư mục `admin-vectorizer`)

> **Status:** MỚI README (chưa có `lambda_function.py`). Spec dưới đây. Khi implement: sinh embedding `all-MiniLM-L6-v2` 384 chiều rồi INSERT vào `public.media_library` (`type` ∈ quote/sutra/video/article/audio, cột `embedding_vector VECTOR(384)`).

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

## 5. Agent BFF Lambda (`agent-bff`) — IMPLEMENTED

> **Status:** CÓ code (`aws/lambdas/agent-bff/lambda_function.py`, handler `handler`, có `deploy.sh`). Đây là hàm duy nhất phục vụ Agent chat ở phía frontend.

| Property | Value |
|---|---|
| **Runtime** | Python 3.12 |
| **Trigger** | API Gateway `POST /agent/chat` |
| **Package** | `boto3` |
| **Env** | `BEDROCK_AGENT_ID`, `BEDROCK_AGENT_ALIAS_ID`, `AWS_REGION` |

### Request

```json
POST /agent/chat
Authorization: Bearer <supabase_jwt>

{
  "sessionId": "session-<userId>-<ts>",
  "inputText": "Add a task to finish the thesis tomorrow"
}
```
`userId` lấy từ JWT claim `sub` (`requestContext.authorizer.claims.sub`).

### Processing

1. Gọi `bedrock-agent-runtime.invoke_agent(agentId, agentAliasId, sessionId, inputText, sessionState={sessionAttributes:{userId}})`.
2. Stream và gộp các `chunk` của `completion`.

### Response (200 OK)

```json
{ "sessionId": "session-...", "responseText": "Task created: Finish the thesis" }
```

> Frontend (`web/composables/useAgentChat.ts`) **bắt buộc** `NUXT_PUBLIC_API_GATEWAY_URL`; thiếu URL → báo lỗi, không có mock.

---

## 6. Agent Action Handler Lambda (`agent-action-handler`) — IMPLEMENTED

> **Status:** CÓ code (`aws/lambdas/agent-action-handler/lambda_function.py`, handler `handler`, có `deploy.sh`). Là Action Group của Bedrock Agent, ghi thẳng Supabase. Contract đầu vào theo `aws/bedrock/action-group-openapi.yaml`.

| Property | Value |
|---|---|
| **Runtime** | Python 3.12 |
| **Trigger** | Bedrock Agent Action Group (`todo-manager-api`) |
| **Package** | `supabase` |
| **Env** | `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` |

### Actions

| apiPath | method | Hành vi |
|---|---|---|
| `/create-task` | POST | INSERT `tasks` (`status='pending'`, `priority` mặc định 0, `due_date` tùy chọn). |
| `/update-task` | PUT | UPDATE `tasks` theo `taskId` (chỉ row thuộc `user_id`); 404 nếu không thấy/không sở hữu. |
| `/delete-task` | DELETE | DELETE `tasks` theo `taskId` thuộc `user_id`. |

`userId` lấy từ `sessionAttributes.userId` do `agent-bff` truyền vào. Mọi thao tác ghi vào bảng `public.tasks` của Supabase (cloud-only).

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
