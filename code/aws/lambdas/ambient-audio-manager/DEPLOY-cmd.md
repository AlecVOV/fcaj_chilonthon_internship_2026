# Deploy ambient-audio-manager — Windows cmd runbook

> Trạng thái đã xong (đã verify): bucket `focus-mode-ambient-audio` + 5 MP3 + public-read
> (GET file = HTTP 200) + CORS bucket. **Còn lại: IAM role → Lambda → Function URL → env frontend.**
>
> Dùng **Lambda Function URL** (không cần API Gateway). Region `ap-southeast-1`, account `677276113002`.
> Chạy các lệnh TRONG thư mục này: `code\aws\lambdas\ambient-audio-manager`.
> `cd /d "D:\Study\AI Engineer Job\Internship FCJ 2026\github_repository\code\aws\lambdas\ambient-audio-manager"`

---

## Bước 1 — Tạo IAM role cho Lambda

```bat
aws iam create-role --role-name ambient-audio-manager-role --assume-role-policy-document file://trust-policy.json
```
Gắn quyền (S3 + logs, least-privilege) và quyền ghi log mặc định:
```bat
aws iam put-role-policy --role-name ambient-audio-manager-role --policy-name focus-ambient-s3-logs --policy-document file://role-policy.json
aws iam attach-role-policy --role-name ambient-audio-manager-role --policy-arn arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole
```
**Check:**
```bat
aws iam get-role --role-name ambient-audio-manager-role --query "Role.Arn"
```
→ phải in ra `arn:aws:iam::677276113002:role/ambient-audio-manager-role`

## Bước 2 — Tạo Lambda function

> `function.zip` đã có sẵn (chứa `lambda_function.py`). Nếu sửa code, zip lại bằng PowerShell:
> `powershell -Command "Compress-Archive -Path lambda_function.py -DestinationPath function.zip -Force"`

```bat
aws lambda create-function --function-name ambient-audio-manager --runtime python3.12 --handler lambda_function.handler --role arn:aws:iam::677276113002:role/ambient-audio-manager-role --timeout 15 --memory-size 256 --region ap-southeast-1 --environment "Variables={AMBIENT_S3_BUCKET=focus-mode-ambient-audio}" --zip-file fileb://function.zip
```
> ⚠️ Nếu báo lỗi *"The role defined for the function cannot be assumed by Lambda"* → role vừa tạo chưa
> kịp lan truyền. Đợi ~10 giây rồi chạy lại **đúng lệnh trên**.

**Check:**
```bat
aws lambda get-function --function-name ambient-audio-manager --region ap-southeast-1 --query "Configuration.[FunctionName,Runtime,State]"
```
→ `State` = `Active`

## Bước 3 — Expose Lambda qua API Gateway (HTTP API)

> ⚠️ **Đã thử Lambda Function URL (`--auth-type NONE`) nhưng tài khoản này trả 403**
> dù cấu hình đúng chuẩn (không có org/SCP). Nên dùng **API Gateway HTTP API** — chạy tốt.
> (Nếu account bạn cho Function URL thì cách đó cũng được; ở đây ta đi API Gateway.)

Quick-create HTTP API trỏ thẳng Lambda (tự tạo route `$default` + deploy stage `$default`):
```bat
aws apigatewayv2 create-api --name ambient-api --protocol-type HTTP --target arn:aws:lambda:ap-southeast-1:677276113002:function:ambient-audio-manager --region ap-southeast-1
```
→ ghi lại `ApiId` (vd `ffepnb6gei`) và `ApiEndpoint` (vd `https://ffepnb6gei.execute-api.ap-southeast-1.amazonaws.com`).

Bật CORS (thay `<ID>`):
```bat
aws apigatewayv2 update-api --api-id <ID> --region ap-southeast-1 --cors-configuration "{\"AllowOrigins\":[\"https://main.d1efs1vwvbok9m.amplifyapp.com\",\"https://focusmode.click\",\"http://localhost:3000\"],\"AllowMethods\":[\"GET\",\"POST\"],\"AllowHeaders\":[\"authorization\",\"content-type\"],\"MaxAge\":3000}"
```

**Quan trọng — cấp quyền cho API Gateway gọi Lambda** (quick-create KHÔNG tự thêm; thiếu bước này sẽ bị **HTTP 500**):
```bat
aws lambda add-permission --function-name ambient-audio-manager --region ap-southeast-1 --statement-id apigw-ambient-invoke --action lambda:InvokeFunction --principal apigateway.amazonaws.com --source-arn "arn:aws:execute-api:ap-southeast-1:677276113002:<ID>/*/*"
```

## Bước 4 — Test endpoint (chưa cần frontend)

```bat
curl "https://<ID>.execute-api.ap-southeast-1.amazonaws.com/ambient/files"
```
→ phải trả JSON liệt kê 5 file mp3. Nếu **403** = thiếu CORS/route; nếu **500** = thiếu quyền
invoke (Bước 3 lệnh cuối); nếu ra **5 file** = **OK**.

> ✅ Với repo này đã deploy sẵn: `ApiId=ffepnb6gei`,
> endpoint = `https://ffepnb6gei.execute-api.ap-southeast-1.amazonaws.com` (đã test 200).

## Bước 5 — Nối vào frontend (biến env)

**Local dev** — sửa `code\web\.env`, thêm dòng (đã thêm sẵn cho bạn):
```
NUXT_PUBLIC_AMBIENT_API_URL=https://ffepnb6gei.execute-api.ap-southeast-1.amazonaws.com
```
Rồi khởi động lại `npm run dev`.

**Production (Amplify)** — Amplify Console → App → **Hosting → Environment variables** →
Add: `NUXT_PUBLIC_AMBIENT_API_URL` = cùng URL → **Redeploy** (Amplify build lại đọc biến này).

## Bước 6 — Test full trên web

1. (Nếu chưa) chạy migration `supabase/migrations/00013_ambient_sounds.sql` trong Supabase SQL Editor.
   Check: `select * from ambient_sounds;` chạy không lỗi.
2. Đăng nhập admin → **/admin/ambient**.
3. Phần 1: thấy **5 file** trong bucket → bấm **Dùng ↓** từng file (hoặc **Copy link**) → điền tên → **Add**.
4. Phần 2: các bài xuất hiện, toggle **Hiện/Ẩn** được.
5. Mở **/focus** → thấy nút nhạc → chọn → bấm Begin → **nghe nhạc phát**. 🎉
6. (Tuỳ chọn) Test upload: chọn 1 file audio nhỏ → **Upload lên S3** → thấy progress → xuất hiện trong list.

---

## Gỡ lỗi nhanh

| Triệu chứng | Nguyên nhân / cách xử lý |
|---|---|
| `curl .../ambient/files` trả `{"message":"..."}` 500 | Lambda thiếu quyền S3 → kiểm tra Bước 1 (role-policy.json đã gắn). |
| Trang admin Phần 1 báo "Chưa cấu hình" | Chưa set `NUXT_PUBLIC_AMBIENT_API_URL` (Bước 5) hoặc chưa restart/redeploy. |
| Upload "network error" (dù CORS đã đúng) | Presigned URL bị ký bằng endpoint **global** `s3.amazonaws.com` → S3 trả 301 → browser fail. **Đã fix**: Lambda tạo S3 client với `endpoint_url=https://s3.<region>.amazonaws.com` + virtual addressing → URL ký host regional. |
| Upload lỗi CORS thật | Bucket CORS thiếu origin đang chạy → thêm origin vào `aws/s3/cors.json` rồi `aws s3api put-bucket-cors ...`. |
| Nhạc không phát (403) | File chưa public → kiểm tra bucket policy (đã có, GET phải = 200). |
| Nút nhạc trống ở /focus | Chưa thêm bài ở Phần 2, hoặc chưa chạy migration 00013. |

---

## Bảo mật (hiện trạng — đọc kỹ)

- **API Gateway đang PUBLIC, không authorizer.** Frontend có gửi `Authorization: Bearer <Supabase JWT>`
  nhưng API **chưa verify** → ai có URL đều gọi được `/ambient/upload-url` và `/ambient/files`
  (xin presigned URL để upload lên bucket + liệt kê file). **Chấp nhận được cho demo.**
- **Bảng CRUD (Phần 2) vẫn an toàn**: đọc/ghi `ambient_sounds` qua Supabase, RLS chặn ghi
  cho người không phải admin (`is_admin()`). Kẻ lạ không sửa được danh sách nhạc user thấy.
- **Rủi ro thực tế nếu để public**: người có URL có thể upload file rác vào bucket (tốn dung lượng).
  Bucket chỉ chứa nhạc nền không nhạy cảm nên tác động thấp.
- **Siết lại — CÁCH 2 (verify token trong Lambda) ĐÃ IMPLEMENT** ✅ trong `lambda_function.py`:
  hàm `_authorize()` verify Supabase JWT **HS256** (chữ ký + `exp` + `aud`) rồi gọi Supabase REST
  (bằng chính token user, RLS-scoped) để chắc chắn `role='admin'`. **Bật bằng cách set env** (xem Bước 7).
- **Cách 1 (JWT authorizer ở API Gateway) — GIỮ LÀM TÀI LIỆU, KHÔNG dùng**: Supabase phát JWT
  **HS256 (khóa đối xứng)** → authorizer JWT native của API Gateway (cần JWKS/RS256) **không verify được**
  → sẽ phải viết custom Lambda authorizer. Vì vậy chọn cách 2 (nhẹ hơn, không cần authorizer riêng).
  (Trùng P0 auth trong `PROJECT_STATE.md`.)

## Bước 7 — Bật auth (cách 2) khi muốn siết

Đã có sẵn `SUPABASE_URL` + `SUPABASE_ANON_KEY` trên Lambda. Chỉ cần thêm **JWT Secret** của Supabase
(**Supabase Dashboard → Project Settings → API → JWT Settings → "JWT Secret"** — chuỗi dài).

**Cách dễ (Console, tự merge, không mất var khác):** Lambda Console → `ambient-audio-manager` →
Configuration → Environment variables → Edit → Add → key `SUPABASE_JWT_SECRET`, value `<jwt secret>` → Save.

**Hoặc CLI** (phải liệt kê ĐỦ 4 var vì nó ghi đè cả map — thay `<...>`):
```bat
aws lambda update-function-configuration --function-name ambient-audio-manager --region ap-southeast-1 --environment "Variables={AMBIENT_S3_BUCKET=focus-mode-ambient-audio,SUPABASE_URL=https://uxvbcezmamdbzzplsner.supabase.co,SUPABASE_ANON_KEY=<anon_key>,SUPABASE_JWT_SECRET=<jwt_secret>}"
```

**Sau khi bật, kiểm:**
- Vào web (đang đăng nhập admin) → `/admin/ambient` vẫn thấy file (token admin hợp lệ → qua).
- `curl ".../ambient/files"` **không kèm token** → phải trả **401**.
- Đã verify sẵn (bằng secret tạm): JWT hợp lệ→200, thiếu token→401, token sai→401. ✅

**Nếu lỡ bật sai làm admin bị chặn** (401/403): xoá var `SUPABASE_JWT_SECRET` (Console → Remove, hoặc
CLI set lại map không có secret) → về public ngay.

> 🔑 **Rotate secret:** `SUPABASE_JWT_SECRET` = "Legacy JWT secret" trong Supabase (Project Settings →
> API → JWT Settings). **Nếu sau này rotate/đổi legacy secret bên Supabase thì PHẢI cập nhật lại biến
> này trên Lambda**, nếu không token admin sẽ verify fail → **admin bị 401**. (Anon key hiển thị trong
> `.env` cũng ký bằng secret này nên rotate là ảnh hưởng cả hệ.)
- **Tối thiểu khác**: giới hạn IP/WAF, hoặc rút ngắn hạn presigned (đang 5 phút).
