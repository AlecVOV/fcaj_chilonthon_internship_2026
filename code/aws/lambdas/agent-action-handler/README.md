# Agent Action Handler — Lambda Function

> ✅ **DEPLOYED** — 4 operation: `GET /list-tasks`, `POST /create-task`, `PUT /update-task`,
> `DELETE /delete-task`. `list-tasks` (thêm 2026-07-10) luôn `.eq('user_id', user_id)` từ
> `sessionAttributes` (không phải list toàn bảng) — agent dùng nó để tự tìm `taskId` theo
> tiêu đề/status trước khi update/delete, thay vì phải được cho ID trực tiếp.

**Purpose:** Called by Bedrock Agent via the Action Group. Receives structured task
operations and executes them against Supabase PostgreSQL.

## Input (Bedrock Agent → Lambda)

`create-task`:
```json
{
  "apiPath": "/create-task",
  "httpMethod": "POST",
  "parameters": [
    {"name": "title", "value": "Write internship report"},
    {"name": "dueDate", "value": "2026-06-15"},
    {"name": "priority", "value": "3"}
  ],
  "sessionAttributes": {"userId": "user-uuid"}
}
```

`list-tasks` (query param `status` optional — pending/in_progress/completed/cancelled):
```json
{
  "apiPath": "/list-tasks",
  "httpMethod": "GET",
  "parameters": [{"name": "status", "value": "pending"}],
  "sessionAttributes": {"userId": "user-uuid"}
}
```
Trả thêm field `tasks: [{id, title, status, priority, dueDate}]` (cap 50 kết quả, mới nhất
trước) trong `responseBody`.

## Output (Lambda → Bedrock Agent)

```json
{
  "messageVersion": "1.0",
  "response": {
    "actionGroup": "todo-manager-api",
    "httpStatusCode": 200,
    "responseBody": {
      "application/json": {"body": "{\"message\":\"Task created\",\"status\":\"success\"}"}
    }
  }
}
```

## Deploy

```bash
chmod +x deploy.sh
./deploy.sh agent-action-handler
```

## Environment Variables

| Key | Value |
|-----|-------|
| `SUPABASE_URL` | `https://xxxx.supabase.co` |
| `SUPABASE_SERVICE_ROLE_KEY` | `eyJhbGciOi...` |
