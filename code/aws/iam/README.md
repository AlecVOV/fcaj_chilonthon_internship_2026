# IAM — Identity & Access Management

## What this folder contains

`lambda-execution-role.json` — IAM policy for the Lambda execution role.

## Setup

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
| S3 | `s3:PutObject` | Report Generator uploads files |
| SES | `ses:SendRawEmail` | Report Generator sends emails |
| Bedrock | `bedrock:InvokeAgent` | Agent BFF calls Bedrock |
| Secrets Manager | `secretsmanager:GetSecretValue` | Action Handler reads DB creds |
