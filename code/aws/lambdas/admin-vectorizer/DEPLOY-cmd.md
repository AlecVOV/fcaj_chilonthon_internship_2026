# admin-vectorizer — Deploy end-to-end (Windows cmd runbook)

> Bedrock **Cohere Embed Multilingual v3** (`cohere.embed-multilingual-v3`, 1024 chiều) —
> KHÔNG đóng gói ML model nào vào Lambda, chỉ gọi Bedrock API, **cùng region với Lambda**
> (`ap-southeast-1` — model này có sẵn tại Singapore, không cần gọi chéo vùng). Account
> `677276113002`. Tái dùng HTTP API `ffepnb6gei` + role `focus-ai-lambda-role` (cần thêm
> 1 quyền mới — xem Bước 1).
> `set ACCOUNT=677276113002` · `set REGION=ap-southeast-1` · `set API_ID=ffepnb6gei`

⚠️ **Đọc trước khi chạy — khác với mọi lambda AI khác trong repo:**

1. **Đã cân nhắc Titan Embed v2 trước, nhưng đổi sang Cohere** — Titan KHÔNG có ở
   `ap-southeast-1` (đã verify qua `aws bedrock list-foundation-models`: chỉ có
   Claude/Nova/Cohere). Cohere Embed Multilingual v3 thì **có sẵn ngay tại
   `ap-southeast-1`** (đã verify qua `get-foundation-model` + 1 lần `invoke-model` thật —
   ra đúng 1024 chiều, kể cả với input tiếng Việt) và **không cần Inference Profile**
   (khác với `cohere.embed-v4:0` — model đó YÊU CẦU `INFERENCE_PROFILE`, phức tạp hơn).
   Kết quả: Lambda này gọi Bedrock **cùng region với chính nó**, không cross-region,
   không cần `GetInferenceProfile`.
2. **Không cần `pip install --target`** — code chỉ dùng `boto3` (có sẵn trong Lambda
   runtime python3.12) + stdlib. Zip chỉ có 1 file `lambda_function.py`, vài KB, deploy
   thẳng bằng `--zip-file` (không cần qua S3 như `emotion-detector`).
3. **Không cần `SUPABASE_SERVICE_ROLE_KEY`** — Lambda dùng CHÍNH access_token của admin
   gọi API để đọc/ghi `media_library` qua PostgREST; RLS (`media_write_admin`/
   `media_update_admin`, đều dựa vào `is_admin()`) tự enforce. Giảm bề mặt secret.

---

## Bước 0 — Chạy migration 00015 (BẮT BUỘC trước khi deploy)

Trong Supabase Dashboard → SQL Editor, chạy **`supabase/migrations/00015_titan_embeddings.sql`**
(tên file giữ nguyên từ lúc soạn ban đầu — nội dung thực chất chỉ đổi
`media_library.embedding_vector` sang `VECTOR(1024)`, không gắn với model cụ thể nào, vẫn
đúng cho Cohere) — rebuild index + đổi chữ ký `search_similar_content()`. Lambda này gọi
Cohere ra đúng 1024 chiều — nếu chưa chạy migration, PATCH `embedding_vector` (1024 phần
tử) sẽ lỗi ngay vì cột vẫn đang là 384 chiều.

## Bước 1 — Thêm quyền `bedrock:InvokeModel` cho `focus-ai-lambda-role`

Role hiện tại (`focus-ai-exec` inline policy) **CHƯA có** `bedrock:InvokeModel` (chỉ có
`bedrock:InvokeAgent` cho Bedrock Agent). Ghi đè policy với statement mới (giữ nguyên mọi
statement cũ + thêm 1 statement cho Cohere Embed ở `ap-southeast-1`) — dùng chung cho cả
`admin-vectorizer` và `rag-recommender` sau này:

Tạo file `focus-ai-exec-policy.json`:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": ["logs:CreateLogGroup", "logs:CreateLogStream", "logs:PutLogEvents"],
      "Resource": "arn:aws:logs:*:*:*"
    },
    {
      "Effect": "Allow",
      "Action": ["s3:PutObject", "s3:GetObject"],
      "Resource": "arn:aws:s3:::focus-mode-*/*"
    },
    {
      "Effect": "Allow",
      "Action": ["s3:ListBucket"],
      "Resource": "arn:aws:s3:::focus-mode-*"
    },
    {
      "Effect": "Allow",
      "Action": ["ses:SendEmail", "ses:SendRawEmail"],
      "Resource": "*"
    },
    {
      "Effect": "Allow",
      "Action": ["bedrock:InvokeAgent"],
      "Resource": "arn:aws:bedrock:ap-southeast-1:677276113002:agent-alias/*"
    },
    {
      "Effect": "Allow",
      "Action": ["secretsmanager:GetSecretValue"],
      "Resource": "arn:aws:secretsmanager:*:*:secret:focus-mode/*"
    },
    {
      "Effect": "Allow",
      "Action": ["bedrock:InvokeModel"],
      "Resource": "arn:aws:bedrock:ap-southeast-1::foundation-model/cohere.embed-multilingual-v3"
    }
  ]
}
```

```bat
aws iam put-role-policy --role-name focus-ai-lambda-role --policy-name focus-ai-exec ^
  --policy-document file://focus-ai-exec-policy.json
```

> 6 statement đầu COPY NGUYÊN từ policy hiện tại (đã đọc thật qua
> `aws iam get-role-policy --role-name focus-ai-lambda-role --policy-name focus-ai-exec`
> lúc soạn runbook này) — chỉ statement cuối là MỚI. ARN model là **foundation-model**
> KHÔNG có account ID ở giữa (đã verify đúng format qua `aws bedrock get-foundation-model`).
> Nếu role đã đổi từ lúc đó, chạy lệnh `get-role-policy` trên trước để lấy bản mới nhất
> rồi tự thêm statement Cohere vào.

## Bước 2 — Đóng gói (không cần pip)

```bat
if exist function.zip del function.zip
powershell -Command "Compress-Archive -Path lambda_function.py -DestinationPath function.zip -Force"
```

## Bước 3 — Tạo Lambda

```bat
aws lambda create-function --function-name admin-vectorizer --runtime python3.12 --handler lambda_function.handler ^
  --role arn:aws:iam::%ACCOUNT%:role/focus-ai-lambda-role --timeout 30 --memory-size 256 --region %REGION% ^
  --zip-file fileb://function.zip ^
  --environment "Variables={SUPABASE_URL=https://uxvbcezmamdbzzplsner.supabase.co,SUPABASE_ANON_KEY=<ANON_KEY>,ALLOWED_ORIGINS=https://main.d1efs1vwvbok9m.amplifyapp.com,https://focusmode.click,http://localhost:3000,COHERE_MODEL_ID=cohere.embed-multilingual-v3,EMBED_DIMENSIONS=1024}"
```

> Timeout 30s (không phải 15s như các lambda khác) — `/embed-all` giờ gọi Cohere **1 lần
> duy nhất theo batch** (tới `MAX_BATCH=50` item cùng lúc trong 1 `invoke-model`, không
> gọi tuần tự từng item), nên thường nhanh hơn nhiều; 30s vẫn để dư phòng PostgREST ghi
> tuần tự 50 dòng. Nếu media library có nhiều item hơn `MAX_BATCH`, gọi `/embed-all` nhiều
> lần cho tới khi `count` trả về `0`.

**Update code lần sau:**
```bat
aws lambda update-function-code --function-name admin-vectorizer --region %REGION% --zip-file fileb://function.zip
```

**Check:** `aws lambda get-function --function-name admin-vectorizer --region %REGION% --query "Configuration.[LastUpdateStatus,State]"` → `Successful` / `Active`.

## Bước 4 — Route API Gateway `/embed` + `/embed-all`

```bat
REM 4a. Integration:
aws apigatewayv2 create-integration --api-id %API_ID% --region %REGION% ^
  --integration-type AWS_PROXY --payload-format-version 2.0 ^
  --integration-uri arn:aws:lambda:%REGION%:%ACCOUNT%:function:admin-vectorizer
REM -> ghi IntegrationId

REM 4b. 2 route dùng CHUNG 1 integration:
aws apigatewayv2 create-route --api-id %API_ID% --region %REGION% ^
  --route-key "POST /embed" --target integrations/<IntegrationId>
aws apigatewayv2 create-route --api-id %API_ID% --region %REGION% ^
  --route-key "POST /embed-all" --target integrations/<IntegrationId>

REM 4c. Cho API Gateway invoke Lambda:
aws lambda add-permission --function-name admin-vectorizer --region %REGION% ^
  --statement-id apigw-vectorizer-invoke --action lambda:InvokeFunction --principal apigateway.amazonaws.com ^
  --source-arn "arn:aws:execute-api:%REGION%:%ACCOUNT%:%API_ID%/*/*"
```

## Bước 5 — Frontend

✅ **Đã vá (2026-07-13)** — `web/composables/useDataService.ts` (`generateEmbedding`/
`generateAllEmbeddings`) giờ gửi kèm `Authorization: Bearer <access_token>` (trước đó
KHÔNG gửi gì cả, P0 từng note trong `docs/PROJECT_STATE.md` §3 — đã vá sớm hơn kế hoạch
gốc vì cần test UI thật ngay). Nút "Embed"/"Generate All Embeddings" ở `/admin/media` giờ
chạy được thật với tài khoản admin đã đăng nhập, không cần tự lấy token/curl thủ công nữa.
Không cần biến env riêng — dùng chung `NUXT_PUBLIC_API_GATEWAY_URL` đã set sẵn.

## Bước 6 — Test

```bat
set API=https://ffepnb6gei.execute-api.ap-southeast-1.amazonaws.com
set TOK=<access_token của tài khoản ADMIN — DevTools → Local Storage>

REM Không token -> 401:
curl -s -i -X POST "%API%/embed" -H "Content-Type: application/json" -d "{\"mediaId\":\"00000000-0000-0000-0000-000000000000\"}"

REM Với token admin + mediaId thật (lấy 1 id từ bảng media_library qua Supabase Studio):
curl -s -X POST "%API%/embed" -H "Authorization: Bearer %TOK%" -H "Content-Type: application/json" -d "{\"mediaId\":\"<uuid thật>\"}"

REM Embed hàng loạt (mọi item embedding_vector IS NULL):
curl -s -X POST "%API%/embed-all" -H "Authorization: Bearer %TOK%" -H "Content-Type: application/json" -d "{}"
```

Kỳ vọng: `/embed` → `{"mediaId":"...","dimensions":1024}`; `/embed-all` → `{"count":N}`.
Verify trong Supabase Studio: `SELECT id, title, embedding_vector IS NOT NULL AS embedded FROM media_library;`

---

## Gỡ lỗi nhanh

| Triệu chứng | Nguyên nhân / xử lý |
|---|---|
| `AccessDeniedException: ... bedrock:InvokeModel ...` khi gọi Cohere | Chưa chạy Bước 1 (thêm IAM), hoặc role chưa propagate (đợi vài giây rồi thử lại). |
| `ValidationException` từ Cohere nói model không tồn tại | Kiểm tra `COHERE_MODEL_ID=cohere.embed-multilingual-v3` đúng chính tả trong env Lambda. |
| Lỗi Postgres khi PATCH `embedding_vector` (kiểu dữ liệu không khớp) | Chưa chạy Bước 0 (migration 00015) — cột vẫn là `VECTOR(384)` trong khi Cohere trả 1024 chiều. |
| `/embed` trả 403 dù đúng admin | Kiểm tra `role` thật trong bảng `public.users` (không phải `auth.users`) — CloudWatch log dòng `AUTH DENY` in ra role đọc được. |
| `/embed-all` báo lỗi `texts` quá dài hoặc quá nhiều | `MAX_BATCH=50` dưới giới hạn 96 text/lần của Cohere nên bình thường không chạm; nếu 1 `content_text` quá dài, `MAX_INPUT_CHARS=2000` + `truncate: END` đã tự cắt bớt — không nên lỗi vì độ dài. |
| Muốn đổi model embedding khác (không phải Cohere) | Sửa `COHERE_MODEL_ID`/format request trong `_embed_texts()` + `EMBED_DIMENSIONS` — nhớ chạy lại migration đổi `VECTOR(n)` cho khớp chiều mới, và `rag-recommender` cũng phải đổi theo (2 bên phải luôn CÙNG model/chiều). |

## Cập nhật hệ thống sau này

Đổi code `lambda_function.py` → lặp lại Bước 2 (đóng gói) → Bước 3 phần "Update code lần sau".
