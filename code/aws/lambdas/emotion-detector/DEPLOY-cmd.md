# emotion-detector — Deploy end-to-end (Windows cmd runbook)

> DistilBERT (ONNX INT8, đóng gói THẲNG trong Lambda — không gọi Bedrock/model AI ngoài).
> Region `ap-southeast-1`, account `677276113002`. Tái dùng HTTP API đã có `ffepnb6gei`
> (thêm route riêng `POST /emotion`) + role đã có `focus-ai-lambda-role` (đã có
> `logs:*` — đủ dùng, Lambda này KHÔNG gọi AWS API nào khác nên không cần thêm IAM).
> Chạy trong: `code\aws\lambdas\emotion-detector`. Đặt biến cho tiện:
> `set ACCOUNT=677276113002` · `set REGION=ap-southeast-1` · `set API_ID=ffepnb6gei`
> `set SUPA=https://uxvbcezmamdbzzplsner.supabase.co` · `set BUCKET=focus-mode-ambient-audio`

⚠️ **Đọc trước khi chạy — 2 điều khác với các Lambda trước trong repo này:**
1. **Gói deploy to hơn 50MB** (model ~80-90MB + onnxruntime/numpy/tokenizers) → **PHẢI upload qua S3 trước**, không dùng trực tiếp `--zip-file` được (giới hạn CLI là 50MB).
2. **Model KHÔNG nằm trong repo** (file .onnx quá to để commit git) — bạn phải tự chạy `prepare_model.py` **1 lần** để tải + export + quantize model trước khi đóng gói Lambda.

---

## Bước 0 — Cài deps để CHUẨN BỊ model (chỉ 1 lần, ở máy local)

`prepare-requirements.txt` khá nặng (torch + transformers + optimum, ~1-2 GB) — dùng
**venv riêng**, đừng cài lẫn vào `web/` hay dùng chung với deps runtime của Lambda.

```bat
python -m venv venv_prepare
venv_prepare\Scripts\activate
pip install -r prepare-requirements.txt
```

## Bước 1 — Export + quantize model (tải model từ HuggingFace Hub)

```bat
python prepare_model.py
```

Script này tự động:
1. Tải `bhadresh-savani/distilbert-base-uncased-emotion` (public, apache-2.0) từ HuggingFace Hub.
2. Export sang ONNX bằng `optimum`.
3. Quantize INT8 (dynamic quantization — không cần dữ liệu hiệu chuẩn).
4. Lưu tokenizer dạng `tokenizer.json` (fast tokenizer — Lambda dùng thư viện `tokenizers`
   nhẹ, KHÔNG cần cài `transformers`/`torch` lúc chạy thật).
5. In ra **thứ tự nhãn thật** (`id2label`) của model — **đối chiếu với `MODEL_LABELS`**
   trong `lambda_function.py` (dòng ~40). Nếu thứ tự khác thì PHẢI sửa lại
   `MODEL_LABELS` cho khớp, không thì nhãn trả về sẽ SAI hết.

Xong sẽ có thư mục `model/` chứa `model_quantized.onnx` + `tokenizer.json` + `config.json`.
Script tự in ra kích thước file cuối — ước tính ~80-90 MB cho `model_quantized.onnx`.

## Bước 2 — Test model NGAY TRÊN MÁY (trước khi tốn công deploy)

Đổi sang venv runtime (nhẹ hơn nhiều, đúng deps Lambda sẽ dùng thật):

```bat
venv_prepare\Scripts\deactivate
python -m venv venv_runtime
venv_runtime\Scripts\activate
pip install -r requirements.txt
python test_local.py
```

Kỳ vọng: 5 câu test in ra nhãn tương đối khớp với "kỳ vọng" ghi cạnh mỗi câu (câu
"unmotivated" là khó đoán nhất — xem ghi chú độ chính xác trong `README.md`). Nếu
`test_local.py` lỗi `FileNotFoundError` → Bước 1 chưa chạy đúng hoặc chạy sai thư mục.
Nếu nhãn ra toàn sai bét → kiểm tra lại `MODEL_LABELS` so với log Bước 1.

## Bước 3 — Đóng gói Lambda

```bat
if exist package rmdir /s /q package
pip install --platform manylinux2014_x86_64 --platform manylinux_2_28_x86_64 --platform manylinux_2_27_x86_64 --implementation cp --python-version 3.12 --abi cp312 --only-binary=:all: --upgrade --target package onnxruntime numpy
REM tokenizers dùng --no-deps: bản mới kéo theo huggingface_hub + httpx + anyio + fsspec... (~30MB)
REM chỉ dùng cho Tokenizer.from_pretrained() -- code này chỉ gọi Tokenizer.from_file(), không cần.
pip install --platform manylinux2014_x86_64 --platform manylinux_2_28_x86_64 --platform manylinux_2_27_x86_64 --implementation cp --python-version 3.12 --abi cp312 --only-binary=:all: --no-deps --upgrade --target package tokenizers
copy /y lambda_function.py package\ >nul
mkdir package\model
copy /y model\model_quantized.onnx package\model\ >nul
copy /y model\tokenizer.json package\model\ >nul
powershell -Command "Compress-Archive -Path package\* -DestinationPath function.zip -Force"
```

> ⚠️ **`--platform manylinux2014_x86_64` một mình KHÔNG đủ nữa** (2026-07-12 — đã dính lỗi
> thật khi chạy runbook này): `onnxruntime`/`numpy` bản mới không còn phát hành wheel gắn
> tag `manylinux2014_x86_64`, chỉ có `manylinux_2_27_x86_64`/`manylinux_2_28_x86_64` (glibc
> mới hơn — vẫn tương thích ngược với Amazon Linux 2023 runtime của Lambda python3.12, glibc
> 2.34). Thiếu 2 tag đó → `pip install` báo `No matching distribution found for onnxruntime`
> **và không tạo ra thư mục `package\`** → lệnh `copy lambda_function.py package\` ngay sau
> sẽ báo "The system cannot find the path specified" → zip tạo ra **thiếu cả code lẫn
> dependency**, deploy sẽ lỗi ngay. Luôn truyền **cả 3 platform tag** như lệnh trên (pip
> chọn tag khớp cho từng package). Nếu lệnh pip báo `No matching distribution` cho package
> khác trong tương lai (họ đổi tag lần nữa) — check tag thật trên PyPI rồi thêm vào.
>
> ⚠️ **KHÔNG dùng `tar -a -cf function.zip ...` trong Git Bash** — GNU tar không hỗ trợ
> nén `.zip`, âm thầm tạo file sai định dạng (đã dính bug này ở lambda khác trong repo,
> xem `aws/UPDATE-guide.md`). Luôn dùng PowerShell `Compress-Archive` như trên.

Kiểm tra kích thước — nếu vượt hẳn 250MB (giới hạn Lambda uncompressed) thì cân nhắc bỏ
bớt: `numpy` có thể thay bằng thao tác thuần Python cho phần softmax nếu cần giảm size.

```bat
powershell -Command "(Get-Item function.zip).Length / 1MB"
```

## Bước 4 — Upload zip lên S3 (bắt buộc vì >50MB) rồi tạo Lambda

```bat
aws s3 cp function.zip s3://%BUCKET%/lambda-packages/emotion-detector.zip --region %REGION%

aws lambda create-function --function-name emotion-detector --runtime python3.12 --handler lambda_function.handler ^
  --role arn:aws:iam::%ACCOUNT%:role/focus-ai-lambda-role --timeout 15 --memory-size 512 --region %REGION% ^
  --code S3Bucket=%BUCKET%,S3Key=lambda-packages/emotion-detector.zip ^
  --environment "Variables={SUPABASE_URL=%SUPA%,SUPABASE_ANON_KEY=<ANON_KEY>,ALLOWED_ORIGINS=https://main.d1efs1vwvbok9m.amplifyapp.com,https://focusmode.click,http://localhost:3000}"
```

> **Update code lần sau:** re-zip (Bước 3) → `aws s3 cp` đè lên key cũ → sau đó:
> ```bat
> aws lambda update-function-code --function-name emotion-detector --region %REGION% ^
>   --s3-bucket %BUCKET% --s3-key lambda-packages/emotion-detector.zip
> ```
> (KHÔNG dùng `--zip-file` cho lần update vì vẫn >50MB.)

**Check:** `aws lambda get-function --function-name emotion-detector --region %REGION% --query "Configuration.[LastUpdateStatus,State]"` → `Successful` / `Active`.

## Bước 5 — Route API Gateway `POST /emotion` → emotion-detector

Tái dùng HTTP API `ffepnb6gei` đã có (giống cách `agent-bff` đã làm ở
`aws/bedrock/DEPLOY-cmd.md` Bước 10):

```bat
REM 5a. Integration (proxy):
aws apigatewayv2 create-integration --api-id %API_ID% --region %REGION% ^
  --integration-type AWS_PROXY --payload-format-version 2.0 ^
  --integration-uri arn:aws:lambda:%REGION%:%ACCOUNT%:function:emotion-detector
REM -> ghi IntegrationId

REM 5b. Route:
aws apigatewayv2 create-route --api-id %API_ID% --region %REGION% ^
  --route-key "POST /emotion" --target integrations/<IntegrationId>

REM 5c. Cho API Gateway invoke Lambda:
aws lambda add-permission --function-name emotion-detector --region %REGION% ^
  --statement-id apigw-emotion-invoke --action lambda:InvokeFunction --principal apigateway.amazonaws.com ^
  --source-arn "arn:aws:execute-api:%REGION%:%ACCOUNT%:%API_ID%/*/*"
```

CORS của API `ffepnb6gei` đã cấu hình sẵn cho các origin Amplify/localhost (làm lúc
deploy ambient-audio-manager) — không cần chỉnh thêm.

## Bước 6 — Frontend

**Không cần biến env riêng** — `useEmotionDetector.ts` giờ dùng chung `apiGatewayUrl`
(giống `agent-bff`) thay vì `NUXT_PUBLIC_EMOTION_API_URL` riêng (route `/emotion` giờ
đã tồn tại thật trên API Gateway, không còn rơi vào `$default`→ambient→401 nữa — lý do
tách biến riêng trước đây không còn áp dụng). Chỉ cần đảm bảo
`NUXT_PUBLIC_API_GATEWAY_URL` đã set (đã set từ lúc deploy `agent-bff`).

## Bước 7 — Test

```bat
set API=https://ffepnb6gei.execute-api.ap-southeast-1.amazonaws.com
set TOK=<supabase access_token — lấy qua DevTools như DEPLOY-cmd.md của bedrock>

curl -s -X POST "%API%/emotion" -H "Authorization: Bearer %TOK%" -H "Content-Type: application/json" -d "{\"text\":\"I was completely focused and got so much done today.\"}"

REM Không token -> phải 401:
curl -s -i -X POST "%API%/emotion" -H "Content-Type: application/json" -d "{\"text\":\"hi\"}"
```

Kỳ vọng: `{"label":"focused","confidence":0.NN}`. Test qua UI thật: trang `/focus` →
hoàn thành 1 phiên → viết journal → xem nhãn cảm xúc hiển thị (gọi qua
`useEmotionDetector.ts` → `/emotion`, không còn fallback regex nữa vì đã có
`NUXT_PUBLIC_API_GATEWAY_URL`).

---

## Gỡ lỗi nhanh

| Triệu chứng | Nguyên nhân / xử lý |
|---|---|
| `pip install --target package` báo `No matching distribution found for onnxruntime` (Bước 3), sau đó `copy lambda_function.py package\` báo "cannot find the path specified" | Thiếu platform tag mới (`manylinux_2_27_x86_64`/`manylinux_2_28_x86_64`) — xem cảnh báo ngay trên Bước 3. Chạy lại đúng lệnh có đủ 3 `--platform`. **Luôn kiểm tra `dir package` có `onnxruntime`/`numpy`/`tokenizers`/`lambda_function.py` trước khi nén zip** — đừng tin zip tạo ra thành công là gói đủ. |
| `prepare_model.py` lỗi tải model | Cần internet; HuggingFace Hub có thể chậm lần đầu (tải ~260MB bản gốc trước khi quantize). Thử lại. |
| `test_local.py` nhãn sai lung tung | `MODEL_LABELS` trong `lambda_function.py` không khớp thứ tự thật — xem log Bước 1 in ra, sửa lại mảng cho đúng. |
| Zip >50MB, `aws lambda create-function --zip-file` báo lỗi | Đúng như dự kiến — dùng đường S3 (Bước 4), không dùng `--zip-file` trực tiếp. |
| Deploy xong nhưng gọi API 500 `ImportError` hoặc lỗi load `.so` | Gói sai wheel (build trên Windows thay vì Linux) — chạy lại Bước 3 với đúng cờ `--platform manylinux2014_x86_64 --only-binary=:all:`. |
| Cold start rất chậm (>10s) hoặc timeout | Model load lúc cold start là bước tốn thời gian nhất; 15s timeout thường đủ nhưng nếu vẫn thiếu, tăng lên 20-30s. Muốn nhanh hơn nữa thì tăng memory (Lambda cấp CPU tỉ lệ theo memory). |
| `/emotion` trả 401 dù có token | Kiểm tra `SUPABASE_URL`/`SUPABASE_ANON_KEY` đã set đúng trong env Lambda (Bước 4) — xem CloudWatch `/aws/lambda/emotion-detector` dòng `AUTH DENY`. |
| Nhãn luôn ra `unmotivated` | `THRESHOLD_UNMOTIVATED` (mặc định 0.35) đang quá cao so với confidence thực tế model trả — hạ xuống qua env var nếu cần, hoặc xem lại text test có quá ngắn/mơ hồ không. |
| Package quá 250MB uncompressed | Lambda sẽ từ chối deploy. Cân nhắc: bỏ `numpy` (tự viết softmax bằng `math`), hoặc chuyển sang Lambda **Container Image** (giới hạn 10GB, không bị ràng buộc 250MB — nhưng phức tạp hơn, cần Dockerfile + ECR, ngoài phạm vi runbook này). |

## Cập nhật hệ thống sau này

Đổi code `lambda_function.py` → lặp lại Bước 3 (đóng gói) → Bước 4 phần "Update code
lần sau". Đổi model (ví dụ đổi threshold hoặc mapping nhãn) → chỉ cần sửa
`lambda_function.py`, KHÔNG cần chạy lại `prepare_model.py`. Đổi sang model khác hẳn →
sửa `MODEL_ID` trong `prepare_model.py` rồi chạy lại từ Bước 1.
