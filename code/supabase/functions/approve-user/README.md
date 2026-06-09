# Supabase Edge Function — Approve User

**Purpose:** Triggered when admin clicks "Approve" on a pending user request.
Uses Supabase Admin API to invite the user via email.

## Deploy

```bash
cd supabase/functions
supabase functions deploy approve-user --no-verify-jwt
```

## Environment

The function uses the built-in `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY`
environment variables (available to all Supabase Edge Functions).

## Input

```json
{
  "requestId": "uuid-of-user-request"
}
```

## Output

```json
{
  "success": true
}
```

## Processing

1. Look up `user_requests` table for the request
2. Call `supabase.auth.admin.inviteUserByEmail(email)` — Supabase sends invite email
3. Update `user_requests.status = 'approved'`
4. Set `profiles.requires_password_change = true` for the new user
