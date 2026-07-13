# rag-recommender — Deploy end-to-end (Windows cmd runbook)

> Bedrock **Cohere Embed Multilingual v3** (`cohere.embed-multilingual-v3`, 1024 chiều) —
> CÙNG model/chiều với `admin-vectorizer` (bắt buộc, khác chiều là RPC lỗi), cùng region
> với Lambda (`ap-southeast-1` — model có sẵn tại Singapore, không cross-region). Account
> `677276113002`. Tái dùng HTTP API `ffepnb6gei` + role `focus-ai-lambda-role`.
> `set ACCOUNT=677276113002` · `set REGION=ap-southeast-1` · `set API_ID=ffepnb6gei`

⚠️ **Đọc trước:** Không cần `pip install`, chỉ zip 1 file — xem chi tiết lý do chọn Cohere
(thay vì Titan, không có ở vùng này) trong
`aws/lambdas/admin-vectorizer/DEPLOY-cmd.md` mục cảnh báo #1.

**Phụ thuộc:** Deploy **SAU** `admin-vectorizer` — cần:
1. Migration `00015` đã chạy (media_library.embedding_vector = VECTOR(1024)).
2. **Migration `00016` đã chạy** (`supabase/migrations/00016_fix_search_similarity_type.sql`)
   — **BẮT BUỘC**, sửa bug thật có sẵn từ `00001_initial_schema.sql`: cột `similarity` khai
   `REAL` nhưng biểu thức `1 - (embedding <=> query)` trả `DOUBLE PRECISION`, khiến RPC
   luôn lỗi `42804` ngay khi có ít nhất 1 dòng match (đã verify thật qua curl PostgREST
   trực tiếp — lỗi chỉ lộ ra khi RPC này được gọi thật lần đầu, tức là ngay bây giờ). Thiếu
   migration này thì `/rag` sẽ luôn trả `{"message": "Loi noi bo, thu lai sau."}` (500) mỗi
   khi có ít nhất 1 media đã embed đủ giống câu query.
3. IAM `bedrock:InvokeModel` đã thêm vào `focus-ai-lambda-role` (Bước 1 của
   `admin-vectorizer/DEPLOY-cmd.md` — **dùng chung 1 statement cho cả 2 lambda**, không
   cần thêm lần nữa nếu đã làm rồi).
4. Nên có ít nhất vài media item **đã embed** (`admin-vectorizer` `/embed-all`) — nếu
   `media_library` toàn `embedding_vector IS NULL` thì RPC luôn trả mảng rỗng (không
   phải lỗi, chỉ là chưa có gì để gợi ý).

---

## Bước 1 — Đóng gói (không cần pip)

```bat
if exist function.zip del function.zip
powershell -Command "Compress-Archive -Path lambda_function.py -DestinationPath function.zip -Force"
```

## Bước 2 — Tạo Lambda

```bat
aws lambda create-function --function-name rag-recommender --runtime python3.12 --handler lambda_function.handler ^
  --role arn:aws:iam::%ACCOUNT%:role/focus-ai-lambda-role --timeout 15 --memory-size 256 --region %REGION% ^
  --zip-file fileb://function.zip ^
  --environment "Variables={SUPABASE_URL=https://uxvbcezmamdbzzplsner.supabase.co,SUPABASE_ANON_KEY=<ANON_KEY>,ALLOWED_ORIGINS=https://main.d1efs1vwvbok9m.amplifyapp.com,https://focusmode.click,http://localhost:3000,COHERE_MODEL_ID=cohere.embed-multilingual-v3,EMBED_DIMENSIONS=1024,MATCH_THRESHOLD=0.3}"
```

**Update code lần sau:**
```bat
aws lambda update-function-code --function-name rag-recommender --region %REGION% --zip-file fileb://function.zip
```

**Check:** `aws lambda get-function --function-name rag-recommender --region %REGION% --query "Configuration.[LastUpdateStatus,State]"` → `Successful` / `Active`.

## Bước 3 — Route API Gateway `POST /rag`

```bat
aws apigatewayv2 create-integration --api-id %API_ID% --region %REGION% ^
  --integration-type AWS_PROXY --payload-format-version 2.0 ^
  --integration-uri arn:aws:lambda:%REGION%:%ACCOUNT%:function:rag-recommender
REM -> ghi IntegrationId

aws apigatewayv2 create-route --api-id %API_ID% --region %REGION% ^
  --route-key "POST /rag" --target integrations/<IntegrationId>

aws lambda add-permission --function-name rag-recommender --region %REGION% ^
  --statement-id apigw-rag-invoke --action lambda:InvokeFunction --principal apigateway.amazonaws.com ^
  --source-arn "arn:aws:execute-api:%REGION%:%ACCOUNT%:%API_ID%/*/*"
```

## Bước 4 — Frontend

✅ **Đã vá (2026-07-13)** — `web/composables/useRAG.ts` giờ gửi kèm
`Authorization: Bearer <access_token>` (trước KHÔNG gửi gì cả). Route này chỉ cần user
đã đăng nhập (không cần admin). Không cần biến env riêng — dùng chung
`NUXT_PUBLIC_API_GATEWAY_URL`. Đây là composable CUỐI CÙNG còn thiếu auth header — cả 6
lambda AI giờ đã có frontend gọi đúng, đủ header thật.

## Bước 5 — Test

```bat
set API=https://ffepnb6gei.execute-api.ap-southeast-1.amazonaws.com
set TOK=<access_token — bất kỳ user nào đã đăng nhập, không cần admin>

REM Không token -> 401:
curl -s -i -X POST "%API%/rag" -H "Content-Type: application/json" -d "{\"emotion\":\"stressed\"}"

REM Với token:
curl -s -X POST "%API%/rag" -H "Authorization: Bearer %TOK%" -H "Content-Type: application/json" -d "{\"emotion\":\"stressed\",\"limit\":3}"
```

Kỳ vọng: mảng JSON `[{ "id", "title", "content_text", "content_url", "type", "source",
"similarity" }, ...]` — rỗng `[]` nếu chưa có media nào được embed (không phải lỗi).

---

## Gỡ lỗi nhanh

| Triệu chứng | Nguyên nhân / xử lý |
|---|---|
| `/rag` trả 500 `{"message": "Loi noi bo, thu lai sau."}` | **Rất có thể chưa chạy migration `00016`** (xem mục Phụ thuộc #2 — bug `similarity REAL` vs `DOUBLE PRECISION`, lỗi Postgres `42804`). CloudWatch `/aws/lambda/rag-recommender` dòng `ERROR rag-recommender: search_similar_content RPC that bai (HTTP 400): {...}` sẽ in nguyên JSON lỗi thật của PostgREST (code/message/details) — đọc field `details` để xác nhận. |
| Luôn trả `[]` dù đã embed media | `match_threshold` (0.3) cao hơn similarity thực tế — thử hạ `MATCH_THRESHOLD` qua env, hoặc kiểm tra `admin-vectorizer` đã thật sự ghi được `embedding_vector` chưa (`SELECT embedding_vector IS NOT NULL FROM media_library`). |
| RPC lỗi kiểu dữ liệu (`vector` dimension mismatch) | `EMBED_DIMENSIONS` giữa `rag-recommender` và `admin-vectorizer` KHÔNG khớp nhau, hoặc migration `00015` chưa chạy. 2 lambda PHẢI cùng 1024 chiều. |
| `AccessDeniedException bedrock:InvokeModel` | Chưa thêm IAM (xem `admin-vectorizer/DEPLOY-cmd.md` Bước 1) hoặc chưa propagate — đợi vài giây thử lại. |
| `/rag` trả 401 dù có token | Token hết hạn/không hợp lệ — CloudWatch `/aws/lambda/rag-recommender` dòng `AUTH DENY` in chi tiết. |

## Cập nhật hệ thống sau này

Đổi code `lambda_function.py` → lặp lại Bước 1 (đóng gói) → Bước 2 phần "Update code lần sau".
Đổi cách map emotion→câu mô tả → sửa `EMOTION_QUERY` trong `lambda_function.py`, không cần
đổi gì ở DB/frontend.
