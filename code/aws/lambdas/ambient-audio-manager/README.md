# ambient-audio-manager

Backend cho **Phần 1 — S3 File Management** của tính năng Ambient Sound.
Cấp presigned URL để trình duyệt upload MP3 thẳng lên S3, và list file trong bucket.

| Route | Method | Việc |
|---|---|---|
| `/ambient/upload-url` | POST | Trả `{ uploadUrl, publicUrl, key }` — presigned PUT URL (hết hạn 5 phút) |
| `/ambient/files` | GET | Trả `{ files: [{ name, url, size, lastModified }] }` (ListObjectsV2) |

> **Phần 2 (CRUD danh sách hiển thị cho user)** KHÔNG dùng Lambda này — nó là bảng
> Supabase `public.ambient_sounds`, frontend gọi thẳng qua RLS. Lambda chỉ lo S3.

---

## ⚠️ Tên bucket

S3 **không cho phép dấu gạch dưới** trong tên bucket, và tên có gạch dưới sẽ hỏng
URL virtual-hosted (HTTPS). Vì vậy **đừng** đặt `ambient_web_audio`. Nên dùng:

```
focus-mode-ambient-audio
```

Tên này còn khớp sẵn IAM `arn:aws:s3:::focus-mode-*/*` trong `aws/iam/lambda-execution-role.json`.
Nếu muốn tên khác, nhớ sửa cả IAM (mục 3) cho khớp.

---

## 1) Tạo bucket + Block Public Access

```bash
set AWS_REGION=ap-southeast-1
set BUCKET=focus-mode-ambient-audio

aws s3api create-bucket --bucket %BUCKET% --region %AWS_REGION% ^
  --create-bucket-configuration LocationConstraint=%AWS_REGION%

REM Cho phep public read (file nhac nen khong nhay cam). Tat 2 chan lien quan policy:
aws s3api put-public-access-block --bucket %BUCKET% ^
  --public-access-block-configuration BlockPublicAcls=true,IgnorePublicAcls=true,BlockPublicPolicy=false,RestrictPublicBuckets=false
```

## 2) Bucket policy — public read (để phát nhạc qua URL cố định)

`bucket-policy.json`:
```json
{
  "Version": "2012-10-17",
  "Statement": [{
    "Sid": "PublicReadAmbient",
    "Effect": "Allow",
    "Principal": "*",
    "Action": "s3:GetObject",
    "Resource": "arn:aws:s3:::focus-mode-ambient-audio/*"
  }]
}
```
```bash
aws s3api put-bucket-policy --bucket focus-mode-ambient-audio --policy file://bucket-policy.json
```

## 3) CORS bucket — cho browser PUT (upload) & GET (phát nhạc)

`cors.json` (thay origin bằng domain Amplify + localhost dev):
```json
{
  "CORSRules": [{
    "AllowedOrigins": ["https://focusmode.click", "http://localhost:3000"],
    "AllowedMethods": ["PUT", "GET", "HEAD"],
    "AllowedHeaders": ["*"],
    "ExposeHeaders": ["ETag"],
    "MaxAgeSeconds": 3000
  }]
}
```

```bash
  aws s3api put-bucket-cors --bucket focus-mode-ambient-audio --cors-configuration file://cors.json
```

## 4) IAM cho Lambda

`aws/iam/lambda-execution-role.json` đã có sẵn `s3:PutObject`/`s3:GetObject` trên
`focus-mode-*/*`. Cần **thêm `s3:ListBucket`** (trên chính bucket, không có `/*`) để
route list chạy — đã thêm sẵn trong file IAM (kiểm tra lại nếu role được tạo trước đó):
```json
{ "Effect": "Allow", "Action": ["s3:ListBucket"], "Resource": "arn:aws:s3:::focus-mode-*" }
```

## 5) Tạo & deploy Lambda

```bash
# Tạo function lần đầu (runtime python3.12, role đã có execution role ở trên):
aws lambda create-function ^
  --function-name ambient-audio-manager ^
  --runtime python3.12 --handler lambda_function.handler ^
  --role arn:aws:iam::677276113002:role/<lambda-execution-role> ^
  --timeout 15 --region ap-southeast-1 ^
  --environment "Variables={AMBIENT_S3_BUCKET=focus-mode-ambient-audio,AMBIENT_S3_PREFIX=}" ^
  --zip-file fileb://<(cd "$(dirname "$0")" && zip -j - lambda_function.py)

# Lần sau chỉ cập nhật code:
AWS_REGION=ap-southeast-1 ./deploy.sh
```

Env vars của Lambda:
- `AMBIENT_S3_BUCKET` = `focus-mode-ambient-audio` (bắt buộc)
- `AMBIENT_S3_PREFIX` = `` rỗng (hoặc `ambient/` nếu muốn gom vào thư mục)

## 6) Nối vào API Gateway

Thêm 2 route (xem `aws/api-gateway/openapi.yaml`), integration `aws_proxy` trỏ về
`ambient-audio-manager`, bật **CORS** trên API cho 2 route (`/ambient/upload-url`,
`/ambient/files`). Cả 2 dùng chung JWT authorizer Supabase như các route khác.
Nhớ `aws lambda add-permission` cho API Gateway được invoke function.

## 7) Frontend

Chỉ cần biến env đã có: `NUXT_PUBLIC_API_GATEWAY_URL` (base URL của API Gateway).
Frontend gọi `${API}/ambient/upload-url` và `${API}/ambient/files`, kèm
`Authorization: Bearer <supabase access_token>`.

---

## Kiểm thử nhanh (sau deploy)

```bash
TOKEN="<supabase access_token của 1 tài khoản đã đăng nhập>"
API="https://<api-id>.execute-api.ap-southeast-1.amazonaws.com/prod"

# List (rỗng lúc đầu)
curl -H "Authorization: Bearer $TOKEN" "$API/ambient/files"

# Xin presigned URL
curl -X POST -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d '{"filename":"rain.mp3","contentType":"audio/mpeg"}' "$API/ambient/upload-url"
```
Rồi test đầy đủ bằng trang **Admin → Ambient**: chọn file → Upload → thấy trong list
→ "Dùng ↓" → xuất hiện ở Phần 2 → mở trang Focus thấy nút nhạc → phát được.
