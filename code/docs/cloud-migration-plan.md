# Cloud Migration Plan — Focus Mode App

> **Current State:** POC Demo Mode (hardcoded credentials, IndexedDB mock data)  
> **Target State:** Cloud Mode (Supabase Auth, AWS Lambda, Amazon SES)  
> **Toggle Flag:** `NUXT_PUBLIC_USE_MOCK_BACKEND` in `.env`

---

## Overview

This document provides **step‑by‑step instructions** for migrating the Focus Mode App from the Proof‑of‑Concept (POC) demo mode to a fully cloud‑native architecture running on **Supabase Cloud** and **AWS Serverless**.

The migration is designed to be **incremental** — each step can be tested independently before moving to the next. The flag `NUXT_PUBLIC_USE_MOCK_BACKEND` controls which mode the app runs in:

| Flag Value | Mode | Auth | Data Storage | API |
|---|---|---|---|---|
| `true` (default) | POC Demo | Hardcoded credentials | IndexedDB (Dexie) | Mock responses |
| `false` | Cloud Production | Supabase Auth | Supabase PostgreSQL | AWS Lambda via API Gateway |

---

## Step 1: Enable Supabase Auth

### 1.1 Create a Supabase Project

1. Go to [supabase.com](https://supabase.com) and sign in.
2. Create a new project. Note the **Project URL** and **anon public key**.
3. Set them in `.env`:
   ```env
   NUXT_PUBLIC_SUPABASE_URL=https://YOUR_PROJECT_ID.supabase.co
   NUXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIs...
   ```

### 1.2 Run the Database Schema

1. Open the Supabase SQL Editor.
2. Paste and run the contents of `docs/database/schema.sql`.
   This creates tables: `users`, `tasks`, `focus_sessions`, `daily_worklogs`, `media_library`.

### 1.3 Create User Profiles Table

Add a trigger to auto‑create a `public.profiles` row when a new user signs up:

```sql
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT,
  display_name TEXT,
  role TEXT DEFAULT 'user' CHECK (role IN ('admin', 'user')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, display_name, role)
  VALUES (NEW.id, NEW.email, NEW.email, 'user');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
```

### 1.4 Set Admin Users

After creating the admin account, set its role:

```sql
UPDATE public.profiles SET role = 'admin' WHERE email = 'admin@focusmode.app';
```

### 1.5 Switch Auth Mode

In `.env`, set:
```env
NUXT_PUBLIC_USE_MOCK_BACKEND=false
```

The `composables/useAuth.ts` will now call Supabase Auth instead of hardcoded credentials. Test login with real Supabase credentials.

---

## Step 2: Replace Mock Data with Supabase Realtime

### 2.1 Uncomment Supabase Calls in `useDataService.ts`

The composable `composables/useDataService.ts` contains `// TODO: Cloud` comments marking where Supabase calls should replace the IndexedDB mock.

Uncomment and implement the Supabase queries. Example for tasks:

```typescript
// In composables/useDataService.ts

import { getSupabase } from '~/lib/supabaseClient'

async function getTasks(): Promise<Task[]> {
  if (useMockBackend.value) {
    // ... existing mock code ...
  }

  // CLOUD: fetch from Supabase
  const supabase = getSupabase()
  const { data, error } = await supabase
    .from('tasks')
    .select('*')
    .order('created_at', { ascending: false })

  if (error) throw error
  return data as Task[]
}
```

### 2.2 Enable Row Level Security (RLS)

In Supabase SQL Editor, create RLS policies:

```sql
-- Tasks: users can only see their own tasks
ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can CRUD own tasks" ON public.tasks
  FOR ALL USING (auth.uid() = user_id);

-- Focus sessions: same
ALTER TABLE public.focus_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can CRUD own sessions" ON public.focus_sessions
  FOR ALL USING (auth.uid() = user_id);

-- Media: admins can CRUD all; users can read
ALTER TABLE public.media_library ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read media" ON public.media_library
  FOR SELECT USING (true);

CREATE POLICY "Admins can manage media" ON public.media_library
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
    )
  );
```

### 2.3 Test Data Flow

1. Sign in with a Supabase auth account.
2. Add a task → verify it appears in the Supabase table editor.
3. Start a focus session → verify `focus_sessions` row created.

---

## Step 3: Deploy AWS Lambda Functions

### 3.1 Emotion Detection Lambda

1. Navigate to `lambdas/focus-emotion-detector/`.
2. Build the deployment package:
   ```bash
   pip install -r requirements.txt -t ./package
   cd package && zip -r ../function.zip . && cd ..
   zip function.zip lambda_function.py
   ```
3. Upload to AWS Lambda (Python 3.12, 512 MB memory, 15s timeout).
4. Attach the ONNX model as a Lambda Layer (see `docs/nlp-emotion.md`).
5. Create an API Gateway trigger: `POST /emotion/detect`.

### 3.2 Report Generator Lambda

1. Navigate to `lambdas/focus-report-generator/`.
2. Build package with Tectonic layer (see `docs/latex-template.tex`).
3. Upload the `.tex` template as part of the package.
4. Set environment variables: `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `S3_BUCKET`, `SES_SENDER_EMAIL`.
5. Create API Gateway trigger: `POST /report`.
6. Set up EventBridge cron for nightly generation (optional).

### 3.3 RAG Recommender + Admin Vectorizer

Follow the same pattern. See `docs/rag-vectorisation.md` for embedding model setup.

---

## Step 4: Update API Gateway Endpoints

### 4.1 Create API Gateway

1. In AWS Console, create a REST API (or HTTP API for lower cost).
2. Create routes:
   - `POST /emotion/detect` → `focus-emotion-detector` Lambda
   - `POST /report` → `focus-report-generator` Lambda
   - `POST /rag/recommend` → `focus-rag-recommender` Lambda
   - `POST /admin/vectorize` → `focus-admin-vectorize` Lambda
3. Configure JWT authorizer using Supabase public key.
4. Deploy to a stage (e.g., `prod`).

### 4.2 Update Environment Variable

```env
NUXT_PUBLIC_API_GATEWAY_URL=https://YOUR_API_ID.execute-api.ap-southeast-1.amazonaws.com/prod
```

### 4.3 Test API Calls

From the browser console:
```javascript
const res = await $fetch('/api/emotion/detect', {
  method: 'POST',
  body: { journal_text: 'I felt very focused today!' }
})
console.log(res) // { label: 'focused', confidence: 0.89 }
```

---

## Step 5: Final Switch & Testing

### 5.1 Switch Off Mock Mode

```env
NUXT_PUBLIC_USE_MOCK_BACKEND=false
```

### 5.2 Verify Everything

| Check | How to test |
|---|---|
| Auth | Sign in with Supabase credentials; session persists |
| Tasks CRUD | Add/edit/delete tasks; verify in Supabase table editor |
| Focus sessions | Start/end a focus timer; verify session row |
| Emotion detection | Submit journal text; verify Lambda returns label |
| Report export | Click "Export Report"; verify PDF email or S3 upload |
| Admin access | Sign in as admin; verify /admin/* routes work |
| RLS | Try to access another user's data via API → should be blocked |

### 5.3 Deploy to Cloudflare Pages

```bash
npm run build
npx wrangler pages deploy .output/public
```

Set environment variables in the Cloudflare Pages dashboard.

---

## Quick Reference: How to Test Both Modes

### POC Demo Mode (default)
```env
NUXT_PUBLIC_USE_MOCK_BACKEND=true
```
- Login: `admin@focusmode.app` / `admin123` (admin) or `user@focusmode.app` / `user123` (user)
- Data is stored in IndexedDB (browser memory)
- API calls return mock data
- No internet required

### Cloud Mode
```env
NUXT_PUBLIC_USE_MOCK_BACKEND=false
```
- Login via Supabase Auth (real credentials)
- Data stored in Supabase PostgreSQL
- API calls go to AWS Lambda via API Gateway
- Requires internet + configured AWS/Supabase accounts

---

## Code Architecture Reference

```
frontend/
├── composables/
│   ├── useConfig.ts        ← Reads NUXT_PUBLIC_USE_MOCK_BACKEND
│   ├── useAuth.ts          ← mock/cloud auth switch
│   └── useDataService.ts   ← mock/cloud data switch
├── middleware/
│   ├── auth.ts             ← Global auth guard
│   └── admin.ts            ← Admin-only route guard
├── pages/
│   └── admin/
│       ├── users.vue       ← Admin user list
│       └── media.vue       ← Admin media CRUD
└── .env.example            ← Environment template
```

*Report generated May 22, 2026*
