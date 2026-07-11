# Agent BFF — Lambda Function

> ✅ **DEPLOYED**. Runbook deploy từ đầu: **`aws/bedrock/DEPLOY-cmd.md`**; sửa hệ thống đang
> chạy: **`aws/UPDATE-guide.md`**. File này chỉ mô tả contract.

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
Lỗi: 401 (thiếu/token sai), 429 (throttling — quota Bedrock thấp, **hoặc** đã dùng hết
`AGENT_DAILY_LIMIT` lượt/ngày), 503 (chưa set AGENT_ID), 500 (lỗi khác). Chỉ trả `{message}`
chung, chi tiết vào CloudWatch.

Trước khi gọi Bedrock, Lambda gọi RPC Supabase `bump_agent_usage(p_limit)` (migration `00014`,
SECURITY DEFINER) để tăng đếm lượt/ngày của user — vượt hạn thì trả 429 luôn, không tốn quota
Bedrock. **Fail-open**: nếu RPC lỗi (vd chưa chạy migration 00014) thì không chặn, coi như 0 lượt.

## Deploy

Chỉ stdlib + boto3 → zip bằng PowerShell `Compress-Archive` (xem `aws/UPDATE-guide.md` mục 1 —
**KHÔNG dùng `tar -a` trong Git Bash**, tạo file zip sai định dạng), hoặc `deploy.sh`.

## Environment Variables

| Key | Bắt buộc | Ghi chú |
|-----|-----|--------|
| `BEDROCK_AGENT_ID` | ✅ | Bedrock Console → Agent (`KKJCF9RAKJ`) |
| `BEDROCK_AGENT_ALIAS_ID` | ✅ | Bedrock Console → Alias (`K8YDCGJRW4`, tên `prod`) |
| `SUPABASE_URL` | ✅ | để verify token qua PostgREST + gọi RPC `bump_agent_usage` |
| `SUPABASE_ANON_KEY` | ✅ | apikey cho PostgREST |
| `ALLOWED_ORIGINS` | tùy chọn | CSV domain cho CORS (mặc định `*`) |
| `AGENT_DAILY_LIMIT` | tùy chọn | Số lượt AI/user/ngày (mặc định `20` nếu không set) |
