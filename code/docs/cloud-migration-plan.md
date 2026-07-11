# Cloud Migration Plan — Focus Mode App

> Cập nhật 2026-06-29 — đồng bộ với bản cài đặt cloud-only hiện tại.

> **Current State:** Cloud-only (Supabase Auth + Supabase PostgreSQL/pgvector). Frontend và Supabase đã hoàn tất.
> **Target State:** Bổ sung tính toán AI trên **AWS Lambda + API Gateway + Amazon Bedrock** (phần lớn CHƯA deploy).
> **AI Toggle:** `NUXT_PUBLIC_API_GATEWAY_URL` trong `.env` — chưa cấu hình thì tính năng AI báo lỗi (không còn mock fallback cho Agent).

---

## Overview

This document provides **step‑by‑step instructions** for the cloud‑native architecture of the Focus Mode App running on **Supabase Cloud** and (planned) **AWS Serverless**.

Toàn bộ luồng offline-first / mock backend ĐÃ BỊ GỠ: không còn IndexedDB/Dexie, sync queue, Last-Write-Wins, hay cờ `NUXT_PUBLIC_USE_MOCK_BACKEND`. Mọi read/write của frontend đi thẳng tới Supabase. Phần còn lại cần làm chủ yếu là tầng tính toán AI trên AWS.

| Tầng | Trạng thái |
|---|---|
| Frontend (Nuxt 4 + Vue 3 + Pinia + Tailwind) | ✅ Cloud-only, hoàn tất |
| Supabase (Postgres + Auth + pgvector) | ✅ Schema + RLS + trigger + seed hoàn tất |
| AWS Lambda (AI) | ⚠️ Mới một phần — chỉ `agent-bff` & `agent-action-handler` có code, còn lại mới README |
| API Gateway / Bedrock | ⚠️ Có spec (`openapi.yaml`, action-group) nhưng CHƯA deploy |
| CI/CD / IaC | ❌ Chưa có (chỉ vài `deploy.sh` lẻ) |

---

## Step 1: Supabase Auth & Database

### 1.1 Create a Supabase Project

1. Go to [supabase.com](https://supabase.com) and sign in.
2. Create a new project. Note the **Project URL** and **anon public key**.
3. Set them in `.env` (xem `web/.env.example`):
   ```env
   NUXT_PUBLIC_SUPABASE_URL=https://YOUR_PROJECT_ID.supabase.co
   NUXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIs...
   ```

### 1.2 Run the Database Migrations (theo đúng thứ tự)

Mở Supabase SQL Editor và chạy lần lượt các migration trong `supabase/migrations/`:

| # | File | Nội dung |
|---|---|---|
| 00001 | `00001_initial_schema.sql` | Extensions (uuid-ossp, pgcrypto, vector); các bảng `users`, `tasks`, `focus_sessions`, `daily_worklogs`, `daily_stats`, `media_library`, `sync_log`; functions `update_modified_column`, `search_similar_content`, `get_user_streak`; RLS cơ sở. |
| 00002 | `00002_seed_admin_users.sql` | Seed tài khoản admin. |
| 00003 | `00003_auth_trigger.sql` | Trigger `handle_new_user()` đồng bộ `auth.users` → `public.users`. |
| 00004 | `00004_seed_admin_users.sql` | Seed admin (bổ sung). |
| 00005 | `00005_seed_demo_accounts.sql` | Seed 2 tài khoản demo vào `auth.users` + `public.users`: admin `admin@focusmode.app` / `admin123`, user `user@focusmode.app` / `user123` (pre-approved, bypass duyệt). |
| 00006 | `00006_user_approval_status.sql` | Thêm cột `users.status` (pending\|approved\|rejected); function `is_admin()` (SECURITY DEFINER, chống đệ quy RLS); cập nhật trigger set role + status; RLS trên `public.users`. |
| 00007 | `00007_drop_legacy_approval.sql` | Drop bảng legacy `public.user_requests` (luồng duyệt cũ không còn dùng). |

> RLS bổ sung cũng nằm trong `supabase/rls_policies.sql` — áp dụng sau `00001`.

### 1.3 User Table & Auto-Provision Trigger

App KHÔNG dùng bảng `public.profiles`. Bảng người dùng cấp ứng dụng là `public.users` (định nghĩa ở `00001`):

```sql
CREATE TABLE IF NOT EXISTS public.users (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  email           TEXT NOT NULL UNIQUE,
  display_name    TEXT,
  role            TEXT NOT NULL DEFAULT 'user' CHECK (role IN ('user', 'admin')),
  status          TEXT NOT NULL DEFAULT 'pending'
                  CHECK (status IN ('pending', 'approved', 'rejected')),  -- thêm ở 00006
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

Mỗi lần có sign-up (INSERT vào `auth.users`), trigger tự tạo một dòng `public.users` tương ứng, đặt `role` + `status` (phiên bản ở `00006`):

```sql
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
  v_is_admin boolean;
BEGIN
  v_is_admin := NEW.email = ANY(ARRAY[
    'lehoangtrietthong@gmail.com',
    'lehoangtrietthong2102004@gmail.com',
    'lhtthong.forwork@outlook.com',
    'lhtthong.forwork@gmail.com',
    'admin@focusmode.app'
  ]);

  INSERT INTO public.users (id, email, display_name, role, status)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data ->> 'display_name', split_part(NEW.email, '@', 1)),
    CASE WHEN v_is_admin THEN 'admin' ELSE 'user' END,
    CASE WHEN v_is_admin THEN 'approved' ELSE 'pending' END
  )
  ON CONFLICT (id) DO NOTHING;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = '';

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
```

### 1.4 User Approval Workflow (qua `users.status`, KHÔNG còn user_requests/edge function)

Luồng duyệt user hiện tại hoàn toàn dựa trên cột `public.users.status` và chạy từ frontend:

- Sign-up → `handle_new_user()` đặt `status = 'pending'` (admin tự `'approved'`).
- Đăng nhập (`composables/useAuth.ts` → `login()`) chặn user `pending`/`rejected`; admin luôn được vào.
- Admin duyệt/từ chối bằng cách `UPDATE public.users.status`:
  - `getPendingUsers()` → liệt kê user `status='pending'`.
  - `approveUser(id)` → `UPDATE users SET status='approved'`.
  - `rejectUser(id)` → `UPDATE users SET status='rejected'`.
  - UI: trang `pages/admin/users.vue`.
- Bảo mật bằng RLS function `is_admin()` (xem 1.5).

> ĐÃ GỠ (migration 00007): bảng `public.user_requests`, Edge Function `supabase/functions/approve-user`, và bảng `public.profiles` (chưa từng tồn tại). Tuyệt đối không cấu hình lại các thành phần này.

Function chống đệ quy RLS (`00006`):

```sql
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE sql SECURITY DEFINER STABLE
SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin'
  );
$$;
```

### 1.5 Admin & Demo Accounts

- Admin theo email: các email trong `handle_new_user()` (ví dụ `admin@focusmode.app`) tự nhận `role='admin'`, `status='approved'` khi sign-up. (Đã BỎ override `ADMIN_EMAILS` phía frontend — admin chỉ xác định bằng `public.users.role='admin'`, khớp RLS `is_admin()`.)
- Demo accounts (`00005`, đã pre-approved, bypass duyệt):
  - Admin: `admin@focusmode.app` / `admin123`
  - User: `user@focusmode.app` / `user123`

### 1.6 Auth ở Frontend

`composables/useAuth.ts` là cloud-only:
- `signUp()` → `supabase.auth.signUp` (dòng `public.users` do trigger tạo, `status='pending'`).
- `login()` → `supabase.auth.signInWithPassword`, rồi đọc `users.role`/`users.status` để gate đăng nhập.
- Client Supabase khởi tạo trong `lib/supabaseClient.ts` (`getSupabase()`), đọc URL/anon key từ `useRuntimeConfig().public` (`useConfig.ts`).

---

## Step 2: Row Level Security (RLS)

RLS đã bật trên tất cả bảng. Các policy thực tế nằm trong `supabase/rls_policies.sql` + `00006`. Ví dụ khớp với code:

```sql
-- Tasks: chủ sở hữu CRUD dòng của mình
ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users CRUD own tasks" ON public.tasks
  FOR ALL USING (auth.uid() = user_id);

-- Focus sessions: tương tự
ALTER TABLE public.focus_sessions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users CRUD own sessions" ON public.focus_sessions
  FOR ALL USING (auth.uid() = user_id);

-- Media: user đã đăng nhập đọc được; admin quản lý
ALTER TABLE public.media_library ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone authenticated can read media" ON public.media_library
  FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Admins manage media" ON public.media_library
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin')
  );

-- Users: tự đọc/cập nhật dòng mình; admin đọc + quản lý tất cả (qua is_admin())
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users read own profile" ON public.users
  FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Users update own profile" ON public.users
  FOR UPDATE USING (auth.uid() = id);
CREATE POLICY "Admins read all users" ON public.users
  FOR SELECT USING (public.is_admin());
CREATE POLICY "Admins manage all users" ON public.users
  FOR ALL USING (public.is_admin()) WITH CHECK (public.is_admin());
```

> Lưu ý: policy admin trên `public.users` dùng `is_admin()` (chống đệ quy). Các bảng khác dùng kiểm tra `EXISTS (... role = 'admin')` trực tiếp.

### 2.1 Data Service ở Frontend

`composables/useDataService.ts` gọi thẳng Supabase (map snake_case ↔ camelCase). Pinia stores thực sự tồn tại: `task.store.ts`, `focus.store.ts`, `user.store.ts`. Không còn `sync.store`/`useSyncQueue`.

### 2.2 Test Data Flow

1. Đăng nhập bằng tài khoản Supabase.
2. Thêm task → kiểm tra dòng trong table editor của Supabase.
3. Bắt đầu một phiên focus → kiểm tra dòng `focus_sessions`.

---

## Step 3: AWS Lambda Functions (AI — phần lớn CHƯA xong)

Tầng AI dự kiến gồm các Lambda sau. Trạng thái hiện tại:

| Lambda | Trạng thái | Vai trò |
|---|---|---|
| `agent-bff` | ✅ Có code (Python) | BFF nhận `POST /agent/chat` từ frontend, gọi Bedrock Agent |
| `agent-action-handler` | ✅ Có code (Python) | Action group cho Bedrock Agent: create/update/delete task trong Supabase |
| `emotion-detector` | ⚠️ Chỉ README | Nhận diện cảm xúc journal (focused/stressed/exhausted/relaxed/unmotivated) |
| `rag-recommender` | ⚠️ Chỉ README | Gợi ý nội dung qua pgvector (`search_similar_content`, model all-MiniLM-L6-v2, 384 chiều) |
| `admin-vectorizer` | ⚠️ Chỉ README | Tạo embedding cho media_library |

> `report-generator` đã bị bỏ khỏi kế hoạch (2026-07-10) — xuất report giờ chạy thuần
> client-side, không qua Lambda. Xem `docs/PROJECT_STATE.md` mục 23.

Layers (`onnx-transformers`, `sentence-transformers`): mới chỉ có spec.

Frontend đã sẵn sàng tích hợp:
- Agent chat: `useAgentChat` → `POST {API}/agent/chat`. Chưa cấu hình URL → báo lỗi (không có mock).
- Emotion: `useEmotionDetector` gọi `/emotion` nếu có API, nếu không fallback regex client-side.
- RAG: `useRAG` gọi `/rag` nếu có, nếu không fallback hardcode.
- Report: `useReportExport` **luôn** render + tải `.md` ngay tại client (đổi 2026-07-10, không còn gọi API nào).

Quy trình build/deploy một Lambda đã có code (ví dụ `agent-bff`): cài requirements, đóng gói zip, upload (Python 3.12), gắn biến môi trường (`SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, ...). Chỉ có vài `deploy.sh` lẻ cho 2 Lambda đã có code; CHƯA có IaC chung.

---

## Step 4: API Gateway & Bedrock (có spec — CHƯA deploy)

Spec đã được phác:
- `aws/api-gateway/openapi.yaml` — định nghĩa route.
- `aws/bedrock/action-group-openapi.yaml` — action group cho Bedrock Agent.

Khi deploy:

### 4.1 Create API Gateway

1. Tạo REST/HTTP API.
2. Tạo route trỏ tới Lambda tương ứng, ví dụ:
   - `POST /agent/chat` → `agent-bff`
   - `POST /emotion` → `emotion-detector`
   - `POST /rag` → `rag-recommender`
3. Cấu hình JWT authorizer dùng Supabase public key.
4. Deploy lên một stage (ví dụ `prod`).

### 4.2 Update Environment Variable

```env
NUXT_PUBLIC_API_GATEWAY_URL=https://YOUR_API_ID.execute-api.ap-southeast-1.amazonaws.com/prod
```

### 4.3 Test API Calls

Sau khi cấu hình URL, mở trang `/agent` và gửi tin nhắn để xác nhận luồng `agent-bff` → Bedrock Agent → `agent-action-handler`.

---

## Step 5: Verification & Deploy

### 5.1 Verify Everything

| Check | How to test | Trạng thái |
|---|---|---|
| Auth | Đăng nhập bằng Supabase; session persist | ✅ Sẵn sàng |
| Approval gate | User mới `pending` bị chặn; admin duyệt qua `admin/users` | ✅ Sẵn sàng |
| Tasks CRUD | Thêm/sửa/xóa task; kiểm tra trong Supabase | ✅ Sẵn sàng |
| Focus sessions | Bắt đầu/kết thúc timer; kiểm tra dòng session | ✅ Sẵn sàng |
| RLS | Thử truy cập dữ liệu user khác → bị chặn | ✅ Sẵn sàng |
| Admin access | Đăng nhập admin; vào được `/admin/*` | ✅ Sẵn sàng |
| Agent chat | Gửi tin ở `/agent` (cần API Gateway URL) | ⚠️ Cần deploy AWS |
| Emotion detection | Submit journal; nhận label | ⚠️ Fallback client-side; Lambda chưa code |
| Report export | "Export Report" | ⚠️ Hiện tải `.md` ở client; Lambda chưa code |

### 5.2 Deploy Frontend

```bash
npm run build
```

Triển khai thư mục `.output` (ví dụ Cloudflare Pages / Netlify / host tĩnh), đặt biến môi trường trên dashboard của nền tảng. CHƯA có pipeline CI/CD — build và deploy thủ công.

---

## Code Architecture Reference

```
web/
├── composables/
│   ├── useConfig.ts          ← Đọc Supabase + API Gateway URL
│   ├── useAuth.ts            ← Cloud-only auth + approval gate (users.status)
│   ├── useDataService.ts     ← Gọi thẳng Supabase (map snake_case↔camelCase)
│   ├── useAgentChat.ts       ← Agent chat → POST {API}/agent/chat
│   ├── useEmotionDetector.ts ← /emotion hoặc fallback regex
│   ├── useRAG.ts             ← /rag hoặc fallback hardcode
│   └── useReportExport.ts    ← /report hoặc tải .md ở client
├── lib/
│   └── supabaseClient.ts     ← getSupabase()
├── stores/
│   ├── task.store.ts
│   ├── focus.store.ts
│   └── user.store.ts
├── middleware/
│   ├── auth.ts               ← Global auth guard
│   └── admin.ts              ← Admin-only route guard
├── pages/
│   └── admin/
│       ├── users.vue         ← Duyệt user (approve/reject qua users.status)
│       └── media.vue         ← Admin media CRUD
└── .env.example              ← Mẫu biến môi trường (Supabase + API Gateway)

supabase/
├── migrations/00001..00007*.sql  ← Schema, seed, trigger, status, drop legacy
└── rls_policies.sql              ← RLS bổ sung

aws/
├── api-gateway/openapi.yaml          ← Spec (chưa deploy)
└── bedrock/action-group-openapi.yaml ← Spec (chưa deploy)
```

*Cập nhật June 29, 2026 — đồng bộ với bản cài đặt cloud-only hiện tại.*
