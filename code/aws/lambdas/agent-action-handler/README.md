# Agent Action Handler — Lambda Function

**Purpose:** Called by Bedrock Agent via the Action Group. Receives structured task
operations and executes them against Supabase PostgreSQL.

## Input (Bedrock Agent → Lambda)

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
