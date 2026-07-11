# UPDATE guide — cập nhật hệ thống AWS/AI sau này (Windows cmd)

> "Đổi cái gì → chạy lệnh gì → check gì". Dùng khi sửa code/config sau khi đã deploy.
> ID thật: account `677276113002` · region `ap-southeast-1` · API `ffepnb6gei` ·
> bucket `focus-mode-ambient-audio` · agent `KKJCF9RAKJ` · guardrail `9l9zw1sh1tei` ·
> action group `80WEPXLIJ8`. Chạy trong `code\aws`.

---

## 🔑 3 quy tắc dễ quên nhất

1. **Đổi env Lambda = GHI ĐÈ CẢ MAP.** `update-function-configuration --environment` xoá hết
   biến cũ, chỉ giữ những biến bạn liệt kê → **luôn liệt kê ĐỦ tất cả biến** (xem bảng env bên dưới).
2. **Mọi thay đổi Bedrock Agent** (instruction / action group / guardrail / model) →
   **`prepare-agent` lại → `update-agent-alias`** thì prod mới nhận. Chỉ sửa DRAFT mà không
   prepare + update alias thì alias `prod` vẫn chạy bản CŨ.
3. **File đọc bằng `file://` phải ASCII.** Có `—`, `"..."`, emoji… → CLI Windows đọc cp1252
   thành mojibake (`ΓÇö`). Giữ `agent-instructions.txt` thuần ASCII.

---

## 1) Đổi CODE Lambda

> ⚠️ **KHÔNG dùng `tar -a -cf function.zip ...` trong Git Bash** — GNU tar (đi kèm Git Bash)
> không hỗ trợ filter `.zip` qua `-a`, âm thầm tạo file SAI định dạng (AWS CLI báo lỗi khó hiểu
> `--zip-file must be a zip file with the fileb:// prefix` dù path đúng). Kiểm nhanh 1 file đã
> zip: `python3 -c "import zipfile; zipfile.ZipFile('function.zip')"` (lỗi `File is not a zip
> file` = dính bug này). **Luôn dùng PowerShell `Compress-Archive`.**

### agent-bff / ambient-audio-manager (chỉ stdlib + boto3)
```bat
cd lambdas\agent-bff
powershell -Command "Compress-Archive -Path lambda_function.py -DestinationPath function.zip -Force"
aws lambda update-function-code --function-name agent-bff --zip-file fileb://function.zip --region ap-southeast-1
cd ..\..
```
(ambient: đổi `agent-bff` → `ambient-audio-manager`.)

### agent-action-handler (có supabase-py → phải build wheel LINUX)
```bat
cd lambdas\agent-action-handler
if exist package rmdir /s /q package
pip install --platform manylinux2014_x86_64 --implementation cp --python-version 3.12 --only-binary=:all: --upgrade --target package -r requirements.txt
copy /y lambda_function.py package\ >nul
powershell -Command "Compress-Archive -Path package\* -DestinationPath function.zip -Force"
aws lambda update-function-code --function-name agent-action-handler --zip-file fileb://function.zip --region ap-southeast-1
cd ..\..
```
> Nếu `package\` đã có sẵn từ lần deploy trước (đủ wheel manylinux), có thể bỏ qua bước
> `pip install` — chỉ cần `copy /y lambda_function.py package\` rồi zip lại cho nhanh.
**Check:** `aws lambda get-function --function-name <fn> --region ap-southeast-1 --query "Configuration.[LastUpdateStatus,State]"` → `Successful` / `Active`.
CloudWatch log: `/aws/lambda/<fn>`.

## 2) Đổi ENV Lambda (nhớ liệt kê ĐỦ biến)

Bảng biến hiện tại của từng Lambda:

| Lambda | Biến env |
|---|---|
| `ambient-audio-manager` | `AMBIENT_S3_BUCKET`, `SUPABASE_URL`, `SUPABASE_ANON_KEY` |
| `agent-bff` | `BEDROCK_AGENT_ID`, `BEDROCK_AGENT_ALIAS_ID`, `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `ALLOWED_ORIGINS`, `AGENT_DAILY_LIMIT` (số lượt AI/user/ngày, mặc định 20 nếu không set) |
| `agent-action-handler` | `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` |

Ví dụ đổi 1 biến của agent-bff (vẫn phải ghi lại HẾT):
```bat
aws lambda update-function-configuration --function-name agent-bff --region ap-southeast-1 --environment "Variables={BEDROCK_AGENT_ID=KKJCF9RAKJ,BEDROCK_AGENT_ALIAS_ID=<ALIAS_ID>,SUPABASE_URL=https://uxvbcezmamdbzzplsner.supabase.co,SUPABASE_ANON_KEY=<ANON_KEY>,ALLOWED_ORIGINS=https://main.d1efs1vwvbok9m.amplifyapp.com,https://focusmode.click,http://localhost:3000,AGENT_DAILY_LIMIT=20}"
```
**Check:** `aws lambda get-function-configuration --function-name agent-bff --region ap-southeast-1 --query "Environment.Variables"` → đủ biến.

## 3) Đổi INSTRUCTIONS của Agent (`agent-instructions.txt`)

```bat
aws bedrock-agent update-agent --region ap-southeast-1 --agent-id KKJCF9RAKJ ^
  --agent-name task-manager-agent ^
  --agent-resource-role-arn arn:aws:iam::677276113002:role/AmazonBedrockExecutionRoleForAgents_task ^
  --foundation-model global.anthropic.claude-haiku-4-5-20251001-v1:0 ^
  --instruction file://bedrock/agent-instructions.txt ^
  --guardrail-configuration "guardrailIdentifier=9l9zw1sh1tei,guardrailVersion=1" ^
  --idle-session-ttl-in-seconds 600
```
> ⚠️ `update-agent` GHI ĐÈ toàn bộ → phải truyền lại `--guardrail-configuration` +
> `--foundation-model` + role, không thì bị gỡ. File instruction phải ASCII.
> Model hiện tại LÀ `global.anthropic.claude-haiku-4-5-20251001-v1:0` (Haiku 4.5, global
> cross-region, 50 RPM) — account này KHÔNG có access Haiku 3, đừng đổi nhầm về model cũ.
Rồi **prepare + update alias** (mục 7).

## 4) Đổi ACTION GROUP / OpenAPI schema (`action-group-openapi.yaml`)

```bat
aws s3 cp bedrock\action-group-openapi.yaml s3://focus-mode-ambient-audio/schemas/action-group-openapi.yaml --region ap-southeast-1
aws bedrock-agent update-agent-action-group --region ap-southeast-1 ^
  --agent-id KKJCF9RAKJ --agent-version DRAFT ^
  --action-group-id 80WEPXLIJ8 --action-group-name todo-manager-api ^
  --action-group-executor "lambda=arn:aws:lambda:ap-southeast-1:677276113002:function:agent-action-handler" ^
  --api-schema "s3={s3BucketName=focus-mode-ambient-audio,s3ObjectKey=schemas/action-group-openapi.yaml}"
```
> ⚠️ Schema BẮT BUỘC có `description` ở **mỗi operation** và ở **cấp parameter** (không phải
> trong `schema`), nếu không lỗi `Failed to create OpenAPI 3 model ... 'description' is missing`.
> Action group hiện có 4 operation: `GET /list-tasks`, `POST /create-task`, `PUT /update-task`,
> `DELETE /delete-task` (`list-tasks` thêm 2026-07-10 để agent tự resolve tiêu đề → taskId).
Rồi **prepare + update alias** (mục 7).

## 5) Đổi GUARDRAIL

Sửa `guardrail-config.json` → tạo bản mới + version mới:
```bat
aws bedrock update-guardrail --region ap-southeast-1 --guardrail-identifier 9l9zw1sh1tei --cli-input-json file://bedrock/guardrail-config.json
aws bedrock create-guardrail-version --region ap-southeast-1 --guardrail-identifier 9l9zw1sh1tei
```
→ ghi `version` mới (vd `2`), rồi gắn vào agent bằng `update-agent` (mục 3) với
`guardrailVersion=<mới>` → **prepare + update alias**.

## 6) Đổi FOUNDATION MODEL

`update-agent` (mục 3) với `--foundation-model <model-id-mới>` (nhớ bật Model access cho model đó
trước) → **prepare + update alias**.

## 7) ⭐ SAU MỌI THAY ĐỔI AGENT: prepare + đẩy ra alias prod

Bedrock versioning: **DRAFT** = bản làm việc · `prepare-agent` = biên dịch DRAFT ·
**alias `prod`** trỏ tới một **version cố định** (snapshot). Sửa DRAFT xong PHẢI:
```bat
aws bedrock-agent prepare-agent --region ap-southeast-1 --agent-id KKJCF9RAKJ
REM chờ PREPARED:
aws bedrock-agent get-agent --region ap-southeast-1 --agent-id KKJCF9RAKJ --query "agent.agentStatus"
REM đẩy DRAFT (đã prepare) thành version mới + trỏ alias prod vào đó:
aws bedrock-agent update-agent-alias --region ap-southeast-1 --agent-id KKJCF9RAKJ --agent-alias-id <ALIAS_ID> --agent-alias-name prod
```
> Lần đầu tạo alias thì dùng `create-agent-alias` (đã làm ở Bước 8). Từ lần sau dùng
> `update-agent-alias` để alias `prod` trỏ sang version mới. Không update alias → `agent-bff`
> (gọi qua `BEDROCK_AGENT_ALIAS_ID`) vẫn chạy bản CŨ.
> Test nhanh trước khi đẩy prod: dùng test alias `TSTALIASID` (trỏ DRAFT) trong Console → Test.

## 8) Đổi IAM policy (`iam/lambda-execution-role.json` hoặc agent policy)

```bat
aws iam put-role-policy --role-name focus-ai-lambda-role --policy-name focus-ai-exec --policy-document file://iam/lambda-execution-role.json
```
(`put-role-policy` GHI ĐÈ policy inline cùng tên.) Agent role: `--role-name AmazonBedrockExecutionRoleForAgents_task --policy-name agent-invoke-model --policy-document file://bedrock/agent-permissions-policy.json`.

## 9) Đổi FRONTEND (web/)

- **Code:** `git push` → **Amplify tự build** production. Local: `npm run dev`.
- **Env (vd `NUXT_PUBLIC_API_GATEWAY_URL`, `NUXT_PUBLIC_AMBIENT_API_URL`):** Amplify Console →
  App → Environment variables → sửa → **Redeploy**. Local: sửa `web/.env` → restart `npm run dev`.

## 10) Đổi DATABASE (Supabase)

Viết migration mới `supabase/migrations/000XX_*.sql` → chạy trong **Supabase → SQL Editor**
(dự án chạy migration thủ công, không có CI). Cập nhật `docs/PROJECT_STATE.md`.

## 11) Đổi BUCKET policy / CORS (ambient)

```bat
aws s3api put-bucket-policy --bucket focus-mode-ambient-audio --policy file://s3/bucket-policy.json
aws s3api put-bucket-cors --bucket focus-mode-ambient-audio --cors-configuration file://s3/cors.json
```

---

## Bảng tra nhanh: "đổi gì → chạy gì"

| Đổi | Lệnh chính | Sau đó |
|---|---|---|
| Code agent-bff / ambient | `tar` + `update-function-code` | — |
| Code agent-action-handler | pip manylinux + `tar -C package .` + `update-function-code` | — |
| Env Lambda | `update-function-configuration` (ĐỦ biến) | — |
| Agent instruction | `update-agent` (đủ param) | **prepare + update-alias** |
| Action group / schema | `s3 cp` + `update-agent-action-group` | **prepare + update-alias** |
| Guardrail | `update-guardrail` + `create-guardrail-version` + `update-agent` | **prepare + update-alias** |
| Model | `update-agent --foundation-model` | **prepare + update-alias** |
| IAM | `put-role-policy` | — |
| Frontend code | `git push` (Amplify build) | — |
| Frontend env | Amplify env → Redeploy | — |
| DB | chạy migration ở Supabase SQL Editor | update PROJECT_STATE |

## Gỡ lỗi (đã gặp)

| Triệu chứng | Xử lý |
|---|---|
| Env cũ mất sau khi update | `update-function-configuration` ghi đè cả map — liệt kê ĐỦ biến. |
| `ImportError pydantic_core` | Đóng gói sai wheel — build lại action-handler bằng `--platform manylinux2014_x86_64`. |
| Agent vẫn chạy bản cũ sau khi sửa | Quên `prepare-agent` + `update-agent-alias`. |
| `'description' is missing` (action group) | Schema thiếu `description` ở operation/parameter. |
| Instructions ra `ΓÇö` | File instruction có non-ASCII — chuyển ASCII, `update-agent` + prepare lại. |
| `AccessDeniedException` InvokeModel | Chưa bật Model access hoặc agent role thiếu quyền. |
