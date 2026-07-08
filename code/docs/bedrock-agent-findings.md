# Bedrock Task Agent — Findings & Lessons Learned

> Nhật ký các phát hiện khi deploy end-to-end **Bedrock Task Agent** (chat tạo/sửa/xóa task)
> cho Focus Mode App, region `ap-southeast-1`, account `677276113002`. Mỗi mục: **triệu chứng →
> chẩn đoán → nguyên nhân → cách sửa**. Viết để (a) không dẫm lại, (b) làm tư liệu báo cáo.
> Cập nhật: 2026-07-08.

**Kiến trúc chuỗi:** Frontend `/agent` → API Gateway `POST /agent/chat` → Lambda **agent-bff**
(verify token in-Lambda) → **Bedrock Agent** (+ Guardrail) → **Action Group** (OpenAPI) →
Lambda **agent-action-handler** → Supabase `tasks`.

**IDs đã deploy:** agent `KKJCF9RAKJ` · alias `prod` `K8YDCGJRW4` · guardrail `9l9zw1sh1tei` v1 ·
action group `80WEPXLIJ8` · model `apac.anthropic.claude-3-5-sonnet-20241022-v2:0`.

---

## ⭐ Finding chính — Bedrock quota cực thấp gây `throttlingException` (multi-turn 500)

**Triệu chứng:** one-shot ("tạo task X, ưu tiên cao, hạn Y") tạo task OK; nhưng multi-turn
(agent hỏi lại → user trả lời) trả **HTTP 500**. Frontend chỉ hiện "Sorry, I encountered an error".

**Chẩn đoán:** đọc CloudWatch `/aws/lambda/agent-bff` → lỗi thật là
`throttlingException: Your request rate is too high ... Check your Bedrock model invocation quotas`.
Không phải bug code. Kiểm Service Quotas:
```
aws service-quotas list-service-quotas --service-code bedrock --region ap-southeast-1 \
  --query "Quotas[?contains(QuotaName,'equests per minute') && contains(QuotaName,'Claude')].[Value,QuotaName]"
```

**Nguyên nhân:** account (sandbox/FCJ) có quota RPM (requests-per-minute) rất thấp. Một **lượt**
agent multi-turn gọi model **2–3 lần trong vài giây** → vượt quota → throttle. One-shot ít lần gọi nên lọt.

| Model (account CÓ access) | RPM |
|---|---|
| Sonnet 3.5 on-demand | 1 |
| Sonnet 3.5 v1 (apac profile) | 2 |
| **Sonnet 3.5 V2 (apac profile) ← đang dùng** | **5** |

RPM cao hơn nhưng KHÔNG dùng được: **Haiku 4.5 global (50 RPM)** — bị account chặn cho **Bedrock Agent**
(`AccessDenied ... using InferenceProfile global.*` dù đã cấp policy InvokeModel `Resource:"*"` → nghi
account-level/SCP chặn global profile cho agent); **Claude 3 Haiku (20 RPM), 3.7 Sonnet (13), Sonnet 4 (10)**
— account **chưa có model access**.

**Cách sửa:**
1. **Đã làm:** đổi agent sang **Sonnet 3.5 V2 apac (5 RPM)** — RPM cao nhất trong các model có access.
   (Dùng inference profile cross-region thay on-demand 1-region để tăng throughput.)
2. **Triệt để:** xin **quota increase** — Console → Service Quotas → Amazon Bedrock (ap-southeast-1) →
   *"Cross-region model inference requests per minute for Anthropic Claude 3.5 Sonnet V2"* → Request increase.
3. **Cho demo:** ưu tiên **one-shot** (nhập đủ chi tiết 1 tin); multi-turn thì giãn ~15-30s giữa tin.

---

## Các finding khác (theo thứ tự đã gặp)

### 1. Supabase access_token ký **ES256**, KHÔNG phải HS256
- **Hệ quả:** JWT authorizer native của API Gateway HTTP API (chỉ RS256) không verify được;
  tự verify HS256 bằng "legacy JWT secret" luôn fail chữ ký.
- **Bẫy:** anon key vẫn là HS256 → verify anon key PASS làm tưởng secret đúng, nhưng token user khác khóa.
- **Fix:** KHÔNG tự verify chữ ký. **Để Supabase validate token**: lambda lấy `Bearer`, decode `sub`,
  gọi `GET {SUPABASE_URL}/rest/v1/users?id=eq.{sub}` kèm chính token → PostgREST verify (mọi thuật toán)
  + RLS. Pattern dùng cho cả `ambient-audio-manager` và `agent-bff`.

### 2. Action-handler mất `title`/`description` — Bedrock để requestBody ở chỗ khác `parameters`
- **Nguyên nhân:** Bedrock Agent đặt query/path params ở `event['parameters']`, NHƯNG các field của
  requestBody ở `event['requestBody']['content']['application/json']['properties']` (list `{name,value}`).
  Code cũ chỉ đọc `parameters` → `params['title']` KeyError.
- **Fix:** hàm `_params()` gộp cả hai nguồn.

### 3. RLS trả **nhiều dòng** cho admin → check role sai (`rows[0]`)
- **Triệu chứng:** admin thật vẫn 403.
- **Nguyên nhân:** admin đọc được TẤT CẢ dòng `users` (để list user) → query `?select=id,role` trả 6 dòng,
  `rows[0]` là user bất kỳ ≠ admin.
- **Fix:** lọc `?id=eq.{sub}` (sub decode từ token) → đúng dòng của caller.

### 4. Action-group OpenAPI schema BẮT BUỘC `description`
- **Lỗi:** `Failed to create OpenAPI 3 model ... 'description' is missing for path: /create-task`.
- **Fix:** thêm `description` ở **mỗi operation** (không chỉ `summary`) và ở **cấp parameter** (không phải
  trong `schema`). Dùng `--cli-error-format json` để xem fieldList chi tiết.

### 5. Agent service role cần `s3:GetObject` đọc action schema
- Action group tham chiếu schema qua S3 (`s3://.../schemas/action-group-openapi.yaml`); agent role phải có
  `s3:GetObject` mới đọc được lúc runtime (đã thêm Sid `ReadActionGroupSchemaFromS3`).

### 6. Model access — "Granted" trên Console ≠ dùng được ngay
- **Lỗi:** `accessDeniedException ... AWS Marketplace actions ... to enable access to this model`.
- Account chưa cấp access **Claude 3 Haiku** (model runbook ban đầu chọn) → agent 500.
- **Fix:** LUÔN test `aws bedrock-runtime invoke-model` cho model TRƯỚC khi tạo agent; chọn model có access.

### 7. Mojibake `ΓÇö` trong agent instructions
- File `agent-instructions.txt` có ký tự non-ASCII (dấu `—`) → AWS CLI Windows đọc `file://` bằng cp1252
  thành mojibake. **Fix:** giữ file thuần ASCII.

### 8. Bedrock versioning — phải `prepare-agent` + `update-agent-alias`
- Sửa agent chỉ đổi **DRAFT**; alias `prod` trỏ **version cố định**. Không `prepare` + `update-alias` thì
  prod vẫn chạy bản CŨ (đã dính khi fix mojibake — alias vẫn trỏ version mojibake tới khi update-alias).

### 9. IAM/permission khác
- `bedrock:InvokeAgent` (agent-bff role) authorize trên **agent-alias** ARN → scope `agent-alias/*`
  (không phải `agent/*`).
- Lambda `agent-action-handler` cần resource-based policy cho `bedrock.amazonaws.com` invoke.

---

## Bài học vận hành (tóm tắt)
1. **Đọc CloudWatch trước khi đoán** — "500" ở frontend che mất lỗi thật (throttling/accessDenied/FK).
2. **Bedrock quota là ràng buộc thật** trên account sandbox — kiểm Service Quotas; ưu tiên inference profile;
   xin tăng quota cho production.
3. **Auth để Supabase validate** (algorithm-agnostic) thay vì tự verify chữ ký.
4. **Identity out-of-band** (sessionAttributes) + fail-closed + whitelist field = chống confused-deputy/injection.
5. Mọi thay đổi agent → **prepare + update-alias**. File `file://` giữ ASCII. Env Lambda ghi đè cả map.

> Vận hành/cập nhật sau này: xem `aws/UPDATE-guide.md`. Deploy lại từ đầu: `aws/bedrock/DEPLOY-cmd.md`.
