# Supabase — Backend-as-a-Service

This folder contains everything needed to set up the Focus Mode App's
Supabase backend: database schema, RLS policies, and Edge Functions.

## What's Inside

| Path | Purpose |
|------|---------|
| `migrations/00001_initial_schema.sql` | Full PostgreSQL + pgvector database schema — all tables, indexes, triggers |
| `rls_policies.sql` | Row Level Security policies for all tables |
| `functions/approve-user/` | Edge Function — admin approves pending user → sends invite email |

## Quick Start

1. Create a Supabase project at [supabase.com](https://supabase.com)
2. Go to **SQL Editor** → paste and run `migrations/00001_initial_schema.sql`
3. Run `rls_policies.sql` to enable RLS
4. Deploy the Edge Function:
   ```bash
   supabase functions deploy approve-user --no-verify-jwt
   ```
5. Get API keys from Settings → API and add to `web/.env`

## Database Tables

| Table | Purpose |
|-------|---------|
| `users` | Mirrors `auth.users` |
| `profiles` | User display name, role, password change flag |
| `user_requests` | Pending user registration requests (admin approval flow) |
| `tasks` | To-do list items with review column |
| `focus_sessions` | Pomodoro/focus session records with emotion labels |
| `daily_worklogs` | Nightly aggregated stats (Lambda writes, user reads) |
| `media_library` | RAG content: sutras, quotes, videos with pgvector embeddings |

## Post-Deploy Check

- [ ] Run `SELECT * FROM auth.users;` — should be empty (no users yet)
- [ ] Run `SELECT * FROM public.media_library;` — should be empty
- [ ] Test Edge Function: `curl -X POST https://xxxx.supabase.co/functions/v1/approve-user`
