# Admin CMS — Nuxt 4 Dashboard (Role-Gated)

> Cập nhật 2026-07-06 — đồng bộ với bản cài đặt cloud-only hiện tại (thêm nhóm Rejected users).

> **Project:** Focus Mode App (Web-Only)  
> **Platform:** Nuxt 4 (same codebase as main app, admin middleware)  
> **Access:** Admin-only (`public.users.role === 'admin'` + Supabase RLS `is_admin()`)  
> **Core Features:** User approval & role management + Media library CRUD + Embedding trigger  

---

## 1. Architecture

```
┌──────────────────────────────────────────────────┐
│           Nuxt 4 Web App (Single Codebase)         │
│                                                    │
│  /dashboard, /focus, /tasks, ...     ← User routes │
│  /admin/*                            ← Admin routes │
│                                                    │
│  ┌──────────────────────────────────┐            │
│  │  middleware/admin.ts              │            │
│  │  Checks useAuth().isAdmin         │            │
│  │  Redirects non-admin to /dashboard│            │
│  └──────────────────────────────────┘            │
│                                                    │
│  Admin Pages:                                      │
│  ┌──────────┐ ┌────────────┐ ┌──────────────┐   │
│  │ Overview  │ │ Users       │ │ Media Library │   │
│  │ (links)   │ │ (approve/   │ │ Manager       │   │
│  │           │ │  role/del)  │ │ (CRUD+embed)  │   │
│  └──────────┘ └─────┬──────┘ └──────┬───────┘   │
│                     │                │             │
│        Supabase JS  │   generateEmbedding()        │
│        (RLS-gated)  │   → API Gateway              │
└─────────────────────┼────────────────┼────────────┘
                      │                │
               ┌──────▼──────┐  ┌──────▼───────┐
               │  Supabase    │  │  API Gateway  │
               │  public.*    │  │  (chưa deploy)│
               │  (RLS+pgvec) │  └──────┬───────┘
               └──────────────┘         │
                                 ┌──────▼───────────┐
                                 │  admin-vectorizer │
                                 │  Lambda (README   │
                                 │  only — no code)  │
                                 └──────────────────┘
```

Mọi read/write đi thẳng Supabase qua `useDataService` / `useAuth` (cloud-only). Không có Nitro server proxy; AI backend (API Gateway + Lambda) hiện CHƯA deploy nên nút sinh embedding sẽ báo lỗi cho tới khi cấu hình `NUXT_PUBLIC_API_GATEWAY_URL`.

## 2. Admin Middleware

`middleware/admin.ts` uses the `useAuth()` composable (not a Pinia auth store).

```typescript
// middleware/admin.ts
import { useAuth } from '~/composables/useAuth'

export default defineNuxtRouteMiddleware((to) => {
  const { isAuthenticated, isAdmin } = useAuth()

  if (!isAuthenticated.value) {
    return navigateTo(`/login?redirect=${encodeURIComponent(to.fullPath)}`)
  }

  if (!isAdmin.value) {
    // Non-admin users trying to access admin routes → redirect to dashboard
    return navigateTo('/dashboard')
  }
})
```

`isAdmin` is derived from `currentUser.role === 'admin'` (read from `public.users.role` at login). It does **not** use `app_metadata.role` or any email allowlist — the old `ADMIN_EMAILS` env override has been removed, so admin status comes **only** from `public.users.role` (mirrored by RLS `is_admin()`).

Applied to every admin route:

```vue
<!-- pages/admin/index.vue, users.vue, media.vue -->
<script setup lang="ts">
definePageMeta({ middleware: ['auth', 'admin'] })  // global auth + admin guard
</script>
```

### Making a user an admin

Admins are defined by `public.users.role`. Promote/demote is done from the Users page (see §4), or directly in SQL:

```sql
-- Mark a specific user as admin
UPDATE public.users
SET role = 'admin'
WHERE email = '{{ADMIN_EMAIL}}';
```

The seeded demo admin (`admin@focusmode.app`) is created with `role='admin'` and `status='approved'` by the migrations. New sign-ups become admin **only** if their email is in the hardcoded list inside the `handle_new_user()` trigger (migration `00008`); everyone else registers as a normal `status='pending'` user. Database-level protection for writes is enforced by RLS using the `is_admin()` function.

## 3. Routes & Navigation

Implemented pages (a shared tab bar links Overview / Users / Media):

```
/admin                → Admin overview (cards linking to Users / Media + System Health placeholder)
/admin/users          → User approval + role management + delete
/admin/media          → Media Library list + Add/Edit dialog + embedding triggers
```

> Note: there are **no** `/admin/media/add`, `/admin/media/[id]`, or `/admin/users/[id]` routes. Add/Edit media happens in a modal on `/admin/media`. Per-user detail pages are not implemented.

## 4. Admin Overview Page

`pages/admin/index.vue` is currently a simple navigation hub, not a stats dashboard. It renders the shared tab bar plus three cards:

- **User Management** → links to `/admin/users`
- **Media Library** → links to `/admin/media`
- **System Health** → placeholder card (API Gateway / Lambda / Supabase monitor — **not implemented**)

> TODO (backend pending): aggregate stats (total users, total focus hours, active today, leaderboard, media-by-type) are **not** built. There is no `useAdminStats` composable and no `get_total_focus_hours` RPC. Live numeric counters currently exist only on the Users and Media pages.

## 5. User Management Page

`pages/admin/users.vue` (script: `useAuth` + `useDataService`). Approval is driven entirely by the `public.users.status` column (`pending` / `approved` / `rejected`); RLS `is_admin()` gates which rows an admin can read/update.

On sign-up, the DB trigger `handle_new_user()` inserts a `public.users` row with `status='pending'` (whitelisted admin emails are auto-`approved`); the admin then moves users between the three statuses from this page. ⚠️ Supabase **"Confirm email" must be OFF** (Authentication → Providers → Email) — the only gate is admin approval, so with Confirm email on an approved user still hits *"Email not confirmed"* at login.

Features — three status-grouped tables (Pending / Approved / Rejected):

- **Counters:** Approved Users count + Pending Requests count (no counter for rejected).
- **Pending Approval table** — for each `status='pending'` user: **Approve** (`approveUser` → `UPDATE users SET status='approved'`) or **Reject** (`rejectUser` → `UPDATE users SET status='rejected'`).
- **Approved Users table** — shows role badge; per row: **Promote/Demote** (`updateUserRole` toggles `role` between `admin`/`user`) and **Delete** (`deleteUser`).
- **Self-protection:** the current admin cannot delete or promote/demote their own row — actions are hidden and the cell shows "You".
- **Rejected table** — only rendered when at least one `status='rejected'` user exists (`v-if="rejectedUsers.length"`); per row: **Approve** (`reApprove` → `approveUser`, re-approve to `status='approved'`) or **Set pending** (`setUserStatus(id, 'pending')`). Lets an admin reverse a rejection.
- **Error hint:** if the load fails, the page suggests checking that migration `00006_user_approval_status.sql` ran and that the admin account actually has `role='admin'` (otherwise RLS blocks reading other users).

Data loading:

```typescript
const { currentUser, approveUser, rejectUser, getPendingUsers, getRejectedUsers, setUserStatus } = useAuth()
const { getUsers, updateUserRole, deleteUser } = useDataService()

async function refresh() {
  const [pending, approved, rejected] = await Promise.all([getPendingUsers(), getUsers(), getRejectedUsers()])
  pendingUsers.value = pending.filter(u => u.status === 'pending')
  approvedUsers.value = approved     // getUsers() returns status='approved' only
  rejectedUsers.value = rejected     // getRejectedUsers() → status='rejected'
}
```

> Removed (do **not** document as current): the legacy `public.user_requests` table, the `approve-user` edge function, and any `public.profiles` table. These were dropped in migration `00007_drop_legacy_approval.sql`. Approval now lives only on `public.users.status`.

## 6. Media Library Page

`pages/admin/media.vue` (script: `useDataService`). All CRUD goes straight to `public.media_library` via Supabase.

Features:

- **Counters:** Total Items + Embedded (`embeddedCount / total`).
- **Table:** Title, Type, Content (URL link or text), Source, Embedded badge (Yes/No), Actions.
- **Search:** client-side filter over title + source.
- **Add / Edit dialog** (modal): Title, Type, Content Text *or* Video URL (URL field shown only when `type === 'video'`), Source, comma-separated Tags.
- **Delete:** hard delete via `deleteMedia` (`DELETE FROM media_library`). There is **no** `is_active` soft-delete / deactivate.
- **Embedding triggers:** per-row **Embed** button (`generateEmbedding(id)`) shown only when an item has no embedding, plus a **Generate All Embeddings** button (`generateAllEmbeddings()`).

### Media types

The DB `CHECK` on `media_library.type` allows **5 values**: `quote`, `sutra`, `video`, `article`, `audio`. Both the type filter/selectors and the `MediaType` union in `useDataService` mirror this:

```typescript
export type MediaType = 'quote' | 'sutra' | 'video' | 'article' | 'audio'
```

## 7. Media CRUD via useDataService

`composables/useDataService.ts` maps snake_case DB rows ↔ app objects. Relevant functions:

```typescript
const {
  getMedia, createMedia, updateMedia, deleteMedia,
  generateEmbedding, generateAllEmbeddings,
} = useDataService()

// Read — newest first
async function getMedia(): Promise<MediaItem[]> {
  const { data, error } = await getSupabase()
    .from('media_library').select('*')
    .order('created_at', { ascending: false })
  if (error) throw new Error(`Cannot load media: ${error.message}`)
  return (data || []).map(rowToMedia)
}

// has_embedding is derived: embedding_vector != null
function rowToMedia(r: any): MediaItem {
  return {
    id: r.id, title: r.title, media_type: r.type,
    content_text: r.content_text ?? undefined, content_url: r.content_url ?? undefined,
    source: r.source ?? undefined, tags: r.tags ?? [],
    has_embedding: r.embedding_vector != null, created_at: r.created_at,
  }
}
```

`createMedia` writes `created_by = currentUser.id`; `updateMedia` only patches provided fields. RLS lets all authenticated users `SELECT` media but restricts INSERT/UPDATE/DELETE to admins (`is_admin()`).

## 8. Embedding Trigger Flow

The frontend does **not** generate vectors locally and there is **no** Nitro proxy. It calls the AWS backend directly through `useDataService`:

```typescript
// composables/useDataService.ts
const { apiGatewayUrl } = useConfig()  // NUXT_PUBLIC_API_GATEWAY_URL

async function generateEmbedding(mediaId: string): Promise<void> {
  if (!apiGatewayUrl.value)
    throw new Error('Embedding generation requires the AI backend (API Gateway not configured).')
  await $fetch(`${apiGatewayUrl.value}/embed`, { method: 'POST', body: { mediaId } })
}

async function generateAllEmbeddings(): Promise<number> {
  if (!apiGatewayUrl.value)
    throw new Error('Embedding generation requires the AI backend (API Gateway not configured).')
  const res = await $fetch<{ count: number }>(`${apiGatewayUrl.value}/embed-all`, { method: 'POST' })
  return res?.count ?? 0
}
```

Intended end-to-end flow once the backend is deployed:

```
Admin clicks "Embed" / "Generate All Embeddings"
    │
    ▼
useDataService.generateEmbedding(id) / generateAllEmbeddings()
    │   (requires NUXT_PUBLIC_API_GATEWAY_URL — else throws)
    ▼
POST {API_GATEWAY_URL}/embed   |  POST {API_GATEWAY_URL}/embed-all
    │
    ▼
Lambda: admin-vectorizer   ← spec maps to API Gateway POST /admin/vectorize
    │   ⚠️ STATUS: README only — Lambda NOT implemented yet
    ├── Load all-MiniLM-L6-v2 (384-dim)
    ├── model.encode(content_text) → vector
    └── UPDATE media_library SET embedding_vector = ...
    │
    ▼
Supabase pgvector (VECTOR(384), ivfflat cosine index) updated
    │
    ▼
Content becomes available to RAG similarity search (search_similar_content())
```

> Backend status: the `admin-vectorizer` Lambda currently has a **README only — no code** (see `aws/README.md`). API Gateway is **not deployed**. Until `NUXT_PUBLIC_API_GATEWAY_URL` is set and the Lambda exists, both embedding buttons surface an error toast. There is no client-side fallback for embeddings.

## 9. Deployment

Admin CMS is part of the main Nuxt app — no separate deploy needed:

```bash
# Build (includes admin routes)
npm run build
```

Access the admin section at `/admin` (behind the `auth` + `admin` middleware).

> The AWS embedding backend (API Gateway + `admin-vectorizer` Lambda) is a separate, **not-yet-deployed** deliverable; there is currently no CI/CD or IaC for it.

## 10. Security Considerations

| Concern                 | Mitigation                                                                              |
| ----------------------- | --------------------------------------------------------------------------------------- |
| **Unauthorized access** | `middleware/admin.ts` checks `useAuth().isAdmin` (from `users.role`) on every admin route |
| **Database writes**     | Supabase RLS `is_admin()` gates INSERT/UPDATE/DELETE on `users` and `media_library`     |
| **Self-lockout**        | Users page hides delete/role actions on the current admin's own row                      |
| **Vectorization cost**  | Admin-only trigger; backend (API Gateway + Lambda) gated separately — not yet deployed   |
| **Data exposure**       | RLS: admins manage `media_library`; all authenticated users can `SELECT` it             |
| **JWT expiry**          | Auto-refresh via Supabase SDK; failed loads surface an inline error with a fix hint     |
