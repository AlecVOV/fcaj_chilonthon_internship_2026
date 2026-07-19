# IAM — Identity & Access Management

> ⚠️ **Role names thực tế KHÁC ví dụ generic dưới đây** (đã tạo theo `bedrock/DEPLOY-cmd.md`):
> - `focus-ai-lambda-role` — execution role dùng chung cho **5/6 lambda**: `agent-bff`,
>   `agent-action-handler`, `emotion-detector`, `admin-vectorizer`, `rag-recommender` (policy =
>   `lambda-execution-role.json` trong folder này — **đã cập nhật 2026-07-13** thêm statement
>   `bedrock:InvokeModel` scope về `cohere.embed-multilingual-v3` ở `ap-southeast-1`, cần cho
>   2 lambda cuối gọi Bedrock Cohere Embed). File JSON này khớp đúng policy live thật (đã verify
>   qua `aws iam get-role-policy` lúc soạn).
> - `ambient-audio-manager-role` — execution role riêng cho `ambient-audio-manager`.
> - `AmazonBedrockExecutionRoleForAgents_task` — **agent service role** (Bedrock assume để gọi
>   model + guardrail), policy nằm ở `../bedrock/agent-permissions-policy.json`, KHÔNG phải
>   file trong folder này. Sửa policy này thì dùng `aws/UPDATE-guide.md` mục 8.

## What this folder contains

`lambda-execution-role.json` — IAM policy cho Lambda execution role (`focus-ai-lambda-role`).

## Setup (ví dụ generic — xem role thật ở cảnh báo trên)

### 1. Create IAM Role
```bash
aws iam create-role \
  --role-name lambda-exec-focus-mode \
  --assume-role-policy-document '{
    "Version": "2012-10-17",
    "Statement": [{
      "Effect": "Allow",
      "Principal": { "Service": "lambda.amazonaws.com" },
      "Action": "sts:AssumeRole"
    }]
  }' \
  --region ap-southeast-1
```

### 2. Attach Policy
```bash
aws iam put-role-policy \
  --role-name lambda-exec-focus-mode \
  --policy-name lambda-focus-mode-policy \
  --policy-document fileb://lambda-execution-role.json \
  --region ap-southeast-1
```

### 3. Attach to Each Lambda
In the Lambda console or via CLI:
```bash
aws lambda update-function-configuration \
  --function-name agent-bff \
  --role arn:aws:iam::${ACCOUNT}:role/lambda-exec-focus-mode \
  --region ap-southeast-1
```

## Permissions Granted

| Service | Action | Purpose |
|---------|--------|---------|
| CloudWatch Logs | `logs:*` | All Lambda logs |
| S3 | `s3:PutObject`/`GetObject`/`ListBucket` trên `focus-mode-*` | Legacy từ `report-generator` (đã bỏ) — không còn lambda nào dùng thật, giữ lại vô hại |
| SES | `ses:SendEmail`/`SendRawEmail` | Legacy từ `report-generator` (đã bỏ) — không còn dùng thật |
| Bedrock | `bedrock:InvokeAgent` (scope `agent-alias/*`) | `agent-bff` gọi Bedrock Agent |
| Bedrock | `bedrock:InvokeModel` (scope `cohere.embed-multilingual-v3`) | `admin-vectorizer`/`rag-recommender` gọi Bedrock Cohere Embed — **thêm 2026-07-13** |
| Secrets Manager | `secretsmanager:GetSecretValue` | Chưa lambda nào thật sự dùng (service_role vẫn để plaintext env — quyết định chủ đích, xem `docs/PROJECT_STATE.md` mục 23) |
