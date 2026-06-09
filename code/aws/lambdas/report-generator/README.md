# Report Generator — Lambda Function

**Purpose:** Generate Markdown daily report, optionally compile to PDF via Pandoc,
upload to S3, and email via Amazon SES.

## Triggers

| Trigger | Type |
|---------|------|
| API Gateway `POST /report` | On-demand (user clicks "Export Report") |
| EventBridge `cron(59 16 * * ? *)` | Nightly (23:59 UTC+7) — all users with sessions |

## Flow

1. Query Supabase for user's focus sessions + tasks for the given date
2. Render Markdown template with `{{PLACEHOLDER}}` substitution
3. Upload `.md` file to S3
4. (Optional) Compile `.md` → `.pdf` via Pandoc
5. Send email via SES with PDF attachment

## Deploy

```bash
chmod +x deploy.sh
./deploy.sh focus-report-generator
```

## Environment Variables

| Key | Value |
|-----|-------|
| `SUPABASE_URL` | `https://xxxx.supabase.co` |
| `SUPABASE_SERVICE_ROLE_KEY` | `eyJhbGciOi...` |
| `S3_BUCKET` | `focus-mode-reports` |
| `SES_SENDER_EMAIL` | `reports@focusmode.app` |

## Lambda Config

| Setting | Value |
|---------|-------|
| Runtime | Python 3.12 |
| Memory | 1024 MB |
| Timeout | 60 seconds |
