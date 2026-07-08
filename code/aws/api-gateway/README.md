# API Gateway — Setup

> ⚠️ **Thực tế deploy KHÁC spec này ở phần AUTH.** HTTP API `ffepnb6gei` **KHÔNG dùng JWT
> authorizer** — token Supabase ký **ES256** mà authorizer native chỉ hỗ trợ RS256. Auth làm
> **TRONG từng Lambda** (Bearer → Supabase PostgREST verify + RLS; route admin tự check role).
> Route AI (`/emotion`, `/rag`, `/report`, `/embed`) là **spec đích, CHƯA deploy** và path còn
> lệch với frontend — sẽ chuẩn hoá khi viết các lambda đó. Route ĐANG chạy: `/agent/chat`,
> `/ambient/upload-url`, `/ambient/files`.

## What this folder contains

`openapi.yaml` — spec API Gateway (block `x-amazon-apigateway-authorizer` chỉ để tài liệu,
KHÔNG áp dụng thực tế — xem cảnh báo trên).

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

| Route | Lambda | Auth |
|-------|--------|------|
| `POST /agent/chat` | `agent-bff` | JWT |
| `POST /emotion/detect` | `focus-emotion-detector` | JWT |
| `POST /report` | `focus-report-generator` | JWT |
| `POST /rag/recommend` | `focus-rag-recommender` | JWT |
| `POST /admin/vectorize` | `focus-admin-vectorize` | JWT + Admin |

## JWT Authorizer

- **Type:** JWT
- **Issuer:** `https://[PROJECT].supabase.co/auth/v1`
- **Audience:** `authenticated`

## Post-deploy

1. Get the Invoke URL from API Gateway → Stages → `prod`
2. Update `web/.env`:
   ```env
   NUXT_PUBLIC_API_GATEWAY_URL=https://xxxx.execute-api.ap-southeast-1.amazonaws.com/prod
   ```
