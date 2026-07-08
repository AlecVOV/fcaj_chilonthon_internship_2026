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
| `/ambient/files` **401** dù đã đăng nhập admin | Token Supabase ký **ES256** (asymmetric signing keys), KHÔNG phải HS256 → verify bằng legacy secret luôn fail. **Đã fix**: để Supabase validate token (gọi REST), không tự verify chữ ký. Xem "Bug auth" bên dưới. |
| `/ambient/files` **403** với đúng tài khoản admin | Admin đọc được **nhiều dòng** `users` (RLS), code lấy nhầm `rows[0]` (≠ admin). **Đã fix**: lọc `?id=eq.{sub}` lấy đúng dòng của caller. Xem "Bug auth" bên dưới. |

---

## Bảo mật (hiện trạng — đã BẬT auth admin-only)

- **API Gateway public, KHÔNG authorizer** — nhưng **Lambda tự xác thực** trong `_authorize()`:
  bắt buộc có `Authorization: Bearer <token>`, để **Supabase validate token** + chỉ cho **admin**.
- **Bật khi có env `SUPABASE_URL` + `SUPABASE_ANON_KEY`** (đã set). Không set 2 biến này = public.
  → Không cần `SUPABASE_JWT_SECRET` nữa (biến này giờ **thừa**, có thể xoá).
- **Cách hoạt động (cách 2 — để Supabase validate, thuật-toán-agnostic):**
  1. Lấy token từ header `Authorization: Bearer`.
  2. Lấy `sub` bằng cách decode payload (KHÔNG tự verify chữ ký — vì token là **ES256**, xem Bug #1).
  3. Gọi `GET {SUPABASE_URL}/rest/v1/users?id=eq.{sub}&select=id,role` **kèm token đó**
     → PostgREST **verify token bằng đúng khóa của project** (mọi thuật toán) + RLS.
  4. Token sai/hết hạn → PostgREST 401 → Lambda **401**. `role != 'admin'` → **403**. `role='admin'` → cho qua.
- **Bảng CRUD (Phần 2)** vẫn được RLS `is_admin()` bảo vệ độc lập ở tầng Supabase.
- **Cách 1 (JWT authorizer native ở API Gateway) — KHÔNG dùng**: chỉ verify được RS/ES qua JWKS
  hoặc HS qua secret; cấu hình rườm rà hơn cách 2. Giữ làm tài liệu (trùng P0 auth `PROJECT_STATE.md`).

### 🐛 Bug auth đã gặp & fix (ghi lại để không dẫm lại)

**Bug #1 — 401 dù đã đăng nhập admin.** Ban đầu Lambda tự verify chữ ký JWT bằng **HS256** với
"Legacy JWT secret". Nhưng project này đã bật **JWT Signing Keys bất đối xứng** → access_token của user
ký bằng **ES256** (header `{"alg":"ES256"}`), KHÔNG phải HS256. (Anon key vẫn là HS256 nên verify anon
key PASS gây nhầm là secret đúng — nhưng token user thì khác khóa.) Verify HS256 luôn fail chữ ký → 401.
→ **Fix:** bỏ tự verify; **để PostgREST/Supabase validate token** (gọi REST kèm token). Đúng cho mọi
thuật toán, khỏi lệ thuộc secret. `SUPABASE_JWT_SECRET` từ đó không cần nữa.

**Bug #2 — 403 với đúng tài khoản admin.** Sau khi qua 401, code hỏi `GET /rest/v1/users?select=id,role`
rồi lấy `rows[0].role`. Với **admin**, RLS cho đọc **TẤT CẢ** users (để admin panel liệt kê) → query trả
**nhiều dòng** (log thực tế: `rows=6 role=user`), `rows[0]` là một user bất kỳ ≠ admin → 403.
→ **Fix:** decode `sub` từ token rồi lọc **`?id=eq.{sub}`** để lấy **đúng dòng của caller** (luôn 1 dòng),
đọc `role` của chính họ. (Log sau fix: `rows=1 role=admin` → 200.)

**Bài học:** (1) đừng giả định thuật toán ký JWT của Supabase — kiểm `alg` trong header; ưu tiên để
Supabase tự validate. (2) đừng giả định RLS chỉ trả 1 dòng — với admin (`is_admin()`) nó trả cả bảng;
luôn lọc theo `sub`.

## Bước 7 — Auth (đã bật) & vận hành

- **Đã bật sẵn** (env `SUPABASE_URL` + `SUPABASE_ANON_KEY` có trên Lambda). Không cần làm gì thêm.
- **Kiểm nhanh:**
  - Admin đăng nhập → `/admin/ambient` thấy file (200). *(Đã xác nhận chạy.)*
  - `curl ".../ambient/files"` **không token** → **401**; token rác → 401; user thường → 403.
- **Tạm tắt auth (về public)** nếu cần: xoá `SUPABASE_URL` **hoặc** `SUPABASE_ANON_KEY` khỏi env Lambda.
- **Dọn:** có thể **xoá biến `SUPABASE_JWT_SECRET`** (không còn dùng sau khi bỏ verify HS256).
- **Log chẩn đoán:** Lambda in `AUTH: header_present=.. alg=..` và `AUTH: rows=.. role=..` +
  `AUTH DENY <code>: <lý do>` vào CloudWatch `/aws/lambda/ambient-audio-manager` — soi khi có sự cố.
- **Siết thêm (tùy chọn):** giới hạn IP/WAF, rút ngắn hạn presigned (đang 5 phút).
