# API Gateway — Setup

> HTTP API `ffepnb6gei` **KHÔNG dùng JWT authorizer** — token Supabase ký **ES256** mà
> authorizer native chỉ hỗ trợ RS256, nên `openapi.yaml` cũng KHÔNG có block authorizer nào.
> Auth làm **TRONG từng Lambda** (Bearer → Supabase PostgREST verify + RLS; route admin tự
> check role). Route AI (`/emotion`, `/rag`, `/admin/vectorize`) là **spec đích, CHƯA deploy**
> và path còn lệch với frontend — sẽ chuẩn hoá khi viết các lambda đó. Route ĐANG chạy:
> `/agent/chat`, `/ambient/upload-url`, `/ambient/files`.

## What this folder contains

`openapi.yaml` — spec API Gateway cho các route AI chưa deploy (`/emotion/detect`,
`/rag/recommend`, `/admin/vectorize`) + 2 route đã live (`/agent/chat`, `/ambient/*`).

## How to deploy

### Option 1: Import via AWS Console
1. AWS Console → API Gateway → Create API → Import from OpenAPI
2. Paste the contents of `openapi.yaml`
3. Replace `${VAR}` placeholders with actual values
4. Deploy to `prod` stage

### Option 2: Via AWS CLI
```bash
aws apigatewayv2 import-api \
  --body fileb://openapi.yaml \
  --fail-on-warnings \
  --region ap-southeast-1
```

## Routes

| Route | Lambda | Auth | Status |
|-------|--------|------|--------|
| `$default` | `ambient-audio-manager` | in-Lambda (Bearer → PostgREST verify) | ✅ live |
| `POST /agent/chat` | `agent-bff` | in-Lambda (Bearer → PostgREST verify) | ✅ live |
| `POST /emotion/detect` | `focus-emotion-detector` | in-Lambda (kế hoạch) | ⚪ chưa deploy |
| `POST /rag/recommend` | `focus-rag-recommender` | in-Lambda (kế hoạch) | ⚪ chưa deploy |
| `POST /admin/vectorize` | `focus-admin-vectorize` | in-Lambda + check `role='admin'` (kế hoạch) | ⚪ chưa deploy |

## Auth — KHÔNG dùng JWT authorizer

HTTP API JWT authorizer native chỉ verify **RS256**, nhưng Supabase Auth ký access_token bằng
**ES256** → authorizer sẽ từ chối mọi request hợp lệ. Vì vậy mọi route auth **TRONG Lambda**:
đọc `Authorization: Bearer <token>`, gọi `GET {SUPABASE_URL}/rest/v1/users?id=eq.{sub}` kèm
token đó — PostgREST tự verify chữ ký (mọi thuật toán) + áp RLS, không hợp lệ thì 401/403 ngay.
Route admin thì Lambda tự check thêm `role='admin'`. Xem `agent-bff`/`agent-action-handler`/
`ambient-audio-manager` để có pattern mẫu đã chạy thật. `openapi.yaml` không định nghĩa
security scheme nào — đừng thêm lại JWT authorizer, nó không verify được token ES256.

## Post-deploy

1. Get the Invoke URL from API Gateway → Stages → `prod`
2. Update `web/.env`:
   ```env
   NUXT_PUBLIC_API_GATEWAY_URL=https://xxxx.execute-api.ap-southeast-1.amazonaws.com/prod
   ```
