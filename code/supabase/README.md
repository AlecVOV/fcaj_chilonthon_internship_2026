# Supabase — Backend-as-a-Service

This folder contains everything needed to set up the Focus Mode App's
Supabase backend: database schema, RLS policies, and Edge Functions.

## What's Inside

| Path | Purpose |
|------|---------|
| `migrations/` | Sequential SQL migrations (`00001`–`00007`): schema, triggers, demo accounts, user-approval flow |
| `rls_policies.sql` | Row Level Security policies for all tables |

## Quick Start

1. Create a Supabase project at [supabase.com](https://supabase.com)
2. Go to **SQL Editor** → run the files in `migrations/` in order (`00001` → `00007`)
3. Run `rls_policies.sql` to enable RLS
4. Get API keys from Settings → API and add to `web/.env`

## Database Tables

| Table | Purpose |
|-------|---------|
| `users` | Mirrors `auth.users`; holds role + approval `status` (pending/approved/rejected) |
| `tasks` | To-do list items with review column |
| `focus_sessions` | Pomodoro/focus session records with emotion labels |
| `daily_worklogs` | Nightly aggregated stats (Lambda writes, user reads) |
| `media_library` | RAG content: sutras, quotes, videos with pgvector embeddings |

## Post-Deploy Check

- [ ] Run `SELECT * FROM auth.users;` — should be empty (no users yet)
- [ ] Run `SELECT * FROM public.media_library;` — should be empty
- [ ] Run `SELECT id, email, role, status FROM public.users;` — admin rows should be `approved`
