# API Gateway — Setup

> HTTP API `ffepnb6gei` **KHÔNG dùng JWT authorizer** — token Supabase ký **ES256** mà
> authorizer native chỉ hỗ trợ RS256, nên `openapi.yaml` cũng KHÔNG có block authorizer nào.
> Auth làm **TRONG từng Lambda** (Bearer → Supabase PostgREST verify + RLS; route admin tự
> check role). **Tất cả route trong `openapi.yaml` đã DEPLOY & LIVE (2026-07-13)** — không còn
> route nào ở trạng thái "spec đích". `openapi.yaml` giờ khớp đúng path frontend đang gọi thật.

## What this folder contains

`openapi.yaml` — spec tham khảo cho 7 route thật trên HTTP API `ffepnb6gei` (không phải nguồn
để deploy — xem "How it was actually deployed" bên dưới).

## How it was actually deployed

Route trong HTTP API này **KHÔNG** được tạo qua `import-api` (import nguyên `openapi.yaml`) —
mỗi Lambda được nối thủ công bằng 3 lệnh CLI (integration → route → add-permission), theo
runbook riêng của từng lambda (`aws/lambdas/<fn>/DEPLOY-cmd.md`):

```bash
aws apigatewayv2 create-integration --api-id ffepnb6gei --integration-type AWS_PROXY \
  --payload-format-version 2.0 --integration-uri arn:aws:lambda:...:function:<fn>
aws apigatewayv2 create-route --api-id ffepnb6gei --route-key "POST /<path>" \
  --target integrations/<IntegrationId>
aws lambda add-permission --function-name <fn> --statement-id apigw-<fn>-invoke \
  --action lambda:InvokeFunction --principal apigateway.amazonaws.com \
  --source-arn "arn:aws:execute-api:ap-southeast-1:<account>:ffepnb6gei/*/*"
```

`openapi.yaml` được viết/cập nhật để **mô tả đúng** kết quả sau khi deploy, không phải file
đầu vào để tạo API. Nếu dựng lại từ đầu ở account khác, theo `DEPLOY-cmd.md` của từng lambda
(thứ tự khuyến nghị: `ambient-audio-manager` → Bedrock Agent (`agent-bff`+`agent-action-handler`)
→ `emotion-detector` → `admin-vectorizer` → `rag-recommender`), KHÔNG dùng Option 1/2 import
wholesale bên dưới (giữ lại chỉ để tham khảo cách import 1 spec OpenAPI hoàn chỉnh nếu cần).

### Option 1: Import via AWS Console (tham khảo, KHÔNG phải cách đã dùng)
1. AWS Console → API Gateway → Create API → Import from OpenAPI
2. Paste the contents of `openapi.yaml`
3. Replace `${VAR}` placeholders with actual values
4. Deploy to `prod` stage

### Option 2: Via AWS CLI (tham khảo, KHÔNG phải cách đã dùng)
```bash
aws apigatewayv2 import-api \
  --body fileb://openapi.yaml \
  --fail-on-warnings \
  --region ap-southeast-1
```

## Routes (7/7 live, 2026-07-13)

| Route | Lambda | Auth | Status |
|-------|--------|------|--------|
| `$default` | `ambient-audio-manager` | in-Lambda (Bearer → PostgREST verify) | ✅ live |
| `POST /agent/chat` | `agent-bff` | in-Lambda (Bearer → PostgREST verify) | ✅ live |
| `POST /ambient/upload-url` | `ambient-audio-manager` | in-Lambda + check `role='admin'` | ✅ live |
| `POST /ambient/files` | `ambient-audio-manager` | in-Lambda + check `role='admin'` | ✅ live |
| `POST /emotion` | `emotion-detector` | in-Lambda (Bearer → PostgREST verify) | ✅ live |
| `POST /rag` | `rag-recommender` | in-Lambda (Bearer → PostgREST verify) | ✅ live |
| `POST /embed` + `POST /embed-all` | `admin-vectorizer` | in-Lambda + check `role='admin'` | ✅ live |

## Auth — KHÔNG dùng JWT authorizer

HTTP API JWT authorizer native chỉ verify **RS256**, nhưng Supabase Auth ký access_token bằng
**ES256** → authorizer sẽ từ chối mọi request hợp lệ. Vì vậy mọi route auth **TRONG Lambda**:
đọc `Authorization: Bearer <token>`, gọi `GET {SUPABASE_URL}/rest/v1/users?id=eq.{sub}` kèm
token đó — PostgREST tự verify chữ ký (mọi thuật toán) + áp RLS, không hợp lệ thì 401/403 ngay.
Route admin thì Lambda tự check thêm `role='admin'`. Xem `agent-bff`/`agent-action-handler`/
`ambient-audio-manager`/`emotion-detector`/`admin-vectorizer`/`rag-recommender` để có pattern
mẫu đã chạy thật (`admin-vectorizer`/`rag-recommender` còn dùng chính token caller để đọc/ghi
Supabase thay vì `service_role`, để RLS làm lớp kiểm tra độc lập thứ 2). `openapi.yaml` không
định nghĩa security scheme nào — đừng thêm lại JWT authorizer, nó không verify được token ES256.

## Post-deploy

1. Get the Invoke URL from API Gateway → Stages → `prod` (hoặc endpoint mặc định của HTTP API
   nếu không tạo stage riêng — thực tế đang dùng thẳng
   `https://ffepnb6gei.execute-api.ap-southeast-1.amazonaws.com`).
2. Update `web/.env`:
   ```env
   NUXT_PUBLIC_API_GATEWAY_URL=https://ffepnb6gei.execute-api.ap-southeast-1.amazonaws.com
   ```
   Đã set — mọi composable FE (`useAgentChat`, `useEmotionDetector`, `useRAG`,
   `useDataService`, `useAmbientSounds`) đều fallback về biến này nếu không có biến riêng.
