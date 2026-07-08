# Agent BFF — Lambda Function

> Runbook deploy đầy đủ: **`aws/bedrock/DEPLOY-cmd.md`**. File này chỉ mô tả contract.

**Purpose:** Endpoint cho frontend. Nhận chat của user, **tự verify Supabase access_token
IN-LAMBDA** (KHÔNG có JWT authorizer ở API Gateway — token Supabase ký ES256), lấy `userId`
từ token, gọi Bedrock Agent Runtime (`invoke_agent`), trả về text.

## Input (API Gateway HTTP API → Lambda, payload v2)

Header `Authorization: Bearer <supabase access_token>` + JSON body:
```json
{ "sessionId": "t1", "inputText": "Tạo task viết báo cáo tuần" }
```
> userId KHÔNG lấy từ body/claims — mà từ token đã verify (chống confused-deputy).
> sessionId được namespace theo user (`{userId}::{sessionId}`) chống session hijack.

## Output (Lambda → Frontend)

```json
{ "sessionId": "t1", "responseText": "Đã tạo task ..." }
```
Lỗi: 401 (thiếu/token sai), 429 (throttling — quota Bedrock thấp), 503 (chưa set AGENT_ID),
500 (lỗi khác). Chỉ trả `{message}` chung, chi tiết vào CloudWatch.

## Deploy

Chỉ stdlib + boto3 → xem `aws/bedrock/DEPLOY-cmd.md` Bước 3a (zip bằng `tar`), hoặc `deploy.sh`.

## Environment Variables

| Key | Bắt buộc | Ghi chú |
|-----|-----|--------|
| `BEDROCK_AGENT_ID` | ✅ | Bedrock Console → Agent |
| `BEDROCK_AGENT_ALIAS_ID` | ✅ | Bedrock Console → Alias |
| `SUPABASE_URL` | ✅ | để verify token qua PostgREST |
| `SUPABASE_ANON_KEY` | ✅ | apikey cho PostgREST |
| `ALLOWED_ORIGINS` | tùy chọn | CSV domain cho CORS (mặc định `*`) |
