# Admin CMS — Nuxt 4 Dashboard (Role-Gated)

> Cập nhật 2026-07-19 — Thêm Feedback Management (§12): user gửi phản hồi ở `/profile`, admin đọc/đổi status ở `/admin/feedback` (migration `00017`).
> Cập nhật 2026-07-13 — Embedding trigger (§8) đã deploy & live (trước ghi "backend chưa deploy").

> **Project:** Focus Mode App (Web-Only)  
> **Platform:** Nuxt 4 (same codebase as main app, admin middleware)  
> **Access:** Admin-only (`public.users.role === 'admin'` + Supabase RLS `is_admin()`)  
> **Core Features:** User approval & role management + Media library CRUD + Embedding trigger + Ambient Sound (S3 + CRUD) + Feedback CMS  

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
               │  public.*    │  │  (✅ live)    │
               │  (RLS+pgvec) │  └──────┬───────┘
               └──────────────┘         │
                                 ┌──────▼───────────┐
                                 │  admin-vectorizer │
                                 │  Lambda            │
                                 │  ✅ deploy & live  │
                                 └──────────────────┘
```

Mọi read/write đi thẳng Supabase qua `useDataService` / `useAuth` (cloud-only). Không có Nitro server proxy; AI backend (API Gateway + Lambda) **đã deploy & live** (2026-07-13), nút sinh embedding chạy được thật với `NUXT_PUBLIC_API_GATEWAY_URL` đã cấu hình sẵn.

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

Implemented pages (a shared tab bar links Overview / Users / Media / Ambient / Feedback):

```
/admin                → Admin overview (cards linking to Users / Media / Ambient / Feedback + System Health placeholder)
/admin/users          → User approval + role management + delete
/admin/media          → Media Library list + Add/Edit dialog + embedding triggers
/admin/ambient        → Ambient Sound: S3 file management (upload/list) + CRUD danh sách nhạc nền
/admin/feedback       → Feedback CMS: đọc feedback user gửi từ /profile, đổi status new/read/resolved — thêm 2026-07-19
```

> Note: there are **no** `/admin/media/add`, `/admin/media/[id]`, or `/admin/users/[id]` routes. Add/Edit media happens in a modal on `/admin/media`. Per-user detail pages are not implemented.

## 4. Admin Overview Page

`pages/admin/index.vue` is currently a simple navigation hub, not a stats dashboard. It renders the shared tab bar plus five cards:

- **User Management** → links to `/admin/users`
- **Media Library** → links to `/admin/media`
- **Ambient Sound** → links to `/admin/ambient`
- **Feedback** → links to `/admin/feedback`; shows a red "N new" badge when there are unread (`status='new'`) items (fetched via `useFeedback().listFeedback()` on mount) — thêm 2026-07-19
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

> ✅ **ĐÃ DEPLOY & LIVE (2026-07-13)** — không còn "intended flow", đây là luồng thật đang chạy.

The frontend does **not** generate vectors locally and there is **no** Nitro proxy. It calls the AWS backend directly through `useDataService`, sending the caller's own Supabase access token (Lambda self-verifies, no API Gateway JWT authorizer — token is ES256):

```typescript
// composables/useDataService.ts
const { apiGatewayUrl } = useConfig()  // NUXT_PUBLIC_API_GATEWAY_URL

async function authHeaders(): Promise<Record<string, string>> {
  const { data: { session } } = await getSupabase().auth.getSession()
  return session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {}
}

async function generateEmbedding(mediaId: string): Promise<void> {
  if (!apiGatewayUrl.value)
    throw new Error('Embedding generation requires the AI backend (API Gateway not configured).')
  await $fetch(`${apiGatewayUrl.value}/embed`, { method: 'POST', body: { mediaId }, headers: await authHeaders() })
}

async function generateAllEmbeddings(): Promise<number> {
  if (!apiGatewayUrl.value)
    throw new Error('Embedding generation requires the AI backend (API Gateway not configured).')
  const res = await $fetch<{ count: number }>(`${apiGatewayUrl.value}/embed-all`, { method: 'POST', headers: await authHeaders() })
  return res?.count ?? 0
}
```

End-to-end flow (thật, đã verify):

```
Admin clicks "Embed" / "Generate All Embeddings"
    │
    ▼
useDataService.generateEmbedding(id) / generateAllEmbeddings()
    │   (requires NUXT_PUBLIC_API_GATEWAY_URL — else throws)
    │   Authorization: Bearer <admin access_token>
    ▼
POST {API_GATEWAY_URL}/embed   |  POST {API_GATEWAY_URL}/embed-all
    │
    ▼
Lambda: admin-vectorizer   ← route /embed + /embed-all (đổi từ /admin/vectorize ban đầu)
    │   ✅ DEPLOYED & LIVE — verify admin token in-Lambda, KHÔNG dùng service_role
    │      (dùng chính token caller để đọc/ghi qua PostgREST — RLS là lớp kiểm tra thứ 2)
    ├── Bedrock Cohere Embed Multilingual v3 (1024-dim, KHÔNG đóng gói ML, không cross-region)
    ├── /embed-all: 1 lệnh gọi Bedrock cho cả batch (tới 50 item), không lặp từng item
    └── PATCH media_library SET embedding_vector = ... (qua PostgREST, token admin)
    │
    ▼
Supabase pgvector (VECTOR(1024), ivfflat cosine index — đổi từ 384 ở migration 00015) updated
    │
    ▼
Content becomes available to RAG similarity search (search_similar_content(), fix bug type
mismatch ở migration 00016)
```

> Backend status: `admin-vectorizer` Lambda **đã deploy & live**, đã embed dữ liệu thật qua UI này.
> Chi tiết model/kiến trúc: `docs/rag-vectorisation.md`. ⚠️ Nội dung dài (bài giảng nhiều đoạn)
> chỉ có ~2000 ký tự đầu thực sự được embed — xem `docs/rag-vectorisation.md` §5.

## 9. Deployment

Admin CMS is part of the main Nuxt app — no separate deploy needed:

```bash
# Build (includes admin routes)
npm run build
```

Access the admin section at `/admin` (behind the `auth` + `admin` middleware).

> The AWS embedding backend (API Gateway + `admin-vectorizer` Lambda) **đã deploy & live**
> (2026-07-13) — xem `aws/lambdas/admin-vectorizer/DEPLOY-cmd.md`; vẫn chưa có CI/CD/IaC tự động
> (deploy thủ công qua AWS CLI theo runbook).

## 10. Security Considerations

| Concern                 | Mitigation                                                                              |
| ----------------------- | --------------------------------------------------------------------------------------- |
| **Unauthorized access** | `middleware/admin.ts` checks `useAuth().isAdmin` (from `users.role`) on every admin route |
| **Database writes**     | Supabase RLS `is_admin()` gates INSERT/UPDATE/DELETE on `users` and `media_library`     |
| **Self-lockout**        | Users page hides delete/role actions on the current admin's own row                      |
| **Vectorization cost**  | Admin-only trigger (Lambda tự check `role='admin'` in-Lambda, không dùng `service_role`); backend đã deploy & live |
| **Data exposure**       | RLS: admins manage `media_library`; all authenticated users can `SELECT` it             |
| **JWT expiry**          | Auto-refresh via Supabase SDK; failed loads surface an inline error with a fix hint     |

## 11. Ambient Sound Management (`/admin/ambient`)

`pages/admin/ambient.vue` (script: `useAmbientSounds` + `useConfig`). Hai phần tách bạch trên cùng một trang:

### Phần 1 — S3 File Management (file vật lý trên AWS S3)
Trình duyệt không ghi thẳng S3 được, nên đi qua Lambda `ambient-audio-manager` (API Gateway):

- **Upload**: chọn file audio → xin **presigned PUT URL** (`POST /ambient/upload-url`) → `PUT` thẳng file lên S3 bằng `XMLHttpRequest` (có thanh progress). Content-Type phải khớp lúc ký, nếu không S3 báo `SignatureDoesNotMatch`.
- **List**: `GET /ambient/files` → `ListObjectsV2` → bảng **File name · S3 Link · Size**, kèm **Copy link** và **Dùng ↓** (prefill sang Phần 2).
- Cả 2 route gửi kèm `Authorization: Bearer <supabase access_token>` để qua JWT authorizer. Nếu chưa cấu hình `NUXT_PUBLIC_API_GATEWAY_URL` → hiện cảnh báo, vẫn cho dán link thủ công ở Phần 2.
- Backend + hướng dẫn deploy (bucket, CORS, public-read policy, IAM `s3:ListBucket`): `aws/lambdas/ambient-audio-manager/README.md`. **Lưu ý tên bucket**: S3 không cho gạch dưới → dùng `focus-mode-ambient-audio` (khớp IAM `focus-mode-*`), KHÔNG dùng `ambient_web_audio`.

### Phần 2 — User Display Management (CRUD bảng `public.ambient_sounds`)
Đây chính là danh sách nhạc user thấy ở trang **Focus** — mọi thao tác CRUD đổi trực tiếp cái user thấy (cùng bảng, RLS đọc-all).

- **Bảng**: `id`, `name` (Audio Name), `url` (S3 Link), `is_active`, `sort_order`, `created_by`, timestamps. Migration `00013_ambient_sounds.sql`.
- **CRUD**: Add/Edit (dialog Name + URL, có `<audio>` preview), toggle **Hiện/Ẩn** (`is_active`), Delete (chỉ xóa dòng DB, **không** xóa file S3).
- **RLS**: `ambient_read_all` (mọi user đã đăng nhập `SELECT`) + `ambient_write_admin` (`is_admin()` cho INSERT/UPDATE/DELETE).

### Tích hợp phía user (trang Focus)
- `components/AmbientPlayer.vue` nạp `listSounds(true)` (active) → render nút **Silence** + từng bài; `v-model` giờ là **URL** của track.
- `composables/useAmbientSound.ts` phát **file MP3 thật** từ URL bằng `HTMLAudioElement` (loop + fade in/out) — thay cho nhạc synth WebAudio trước đây.
- `focus_sessions.ambient_track` lưu URL của track đã chọn; `pages/focus.vue` tra URL → tên để hiển thị nhãn "Ambient:".

## 12. Feedback Management (`/admin/feedback`) — thêm 2026-07-19

Người dùng gửi phản hồi ngay trong account của họ; admin đọc tập trung qua CMS. Không cần Lambda/API Gateway — đi thẳng Supabase như Ambient Sound Phần 2.

### Phía user — `pages/profile.vue`
- Card **"Send Feedback"** (textarea + nút Send), nằm ngay dưới "Account Information". **Chỉ hiện cho user thường** (`v-if="!isAdmin"`) — admin là người đọc feedback, không cần gửi.
- Gọi `useFeedback().submitFeedback(message)` → `INSERT` 1 dòng vào `public.feedback` với `user_id = auth.uid()`.

### Phía admin — `pages/admin/feedback.vue`
- Bảng liệt kê **tất cả** feedback (mọi user), cột: From (tên + email), Message, Status (badge), Sent (ngày), Actions.
- Vì project không dùng cú pháp embedded-select của Supabase (`select('*, users(...)')`), trang gọi 2 query riêng rồi merge ở client: `SELECT` bảng `feedback`, sau đó `SELECT id, email, display_name FROM users WHERE id IN (...)` theo danh sách `user_id` duy nhất — xem `useFeedback().listFeedback()`.
- Actions: **Mark read** / **Resolve** → `useFeedback().updateFeedbackStatus(id, status)` → `UPDATE feedback SET status = ...`.
- 3 stat card ở đầu trang: Total, New, Resolved (đếm client-side từ danh sách đã tải, không phải RPC riêng).
- Overview panel (`/admin` — mục 4 phía trên) có thêm 1 box "Feedback" link sang trang này, kèm badge đỏ "N new" nếu có dòng `status='new'`.

### Bảng & RLS — `public.feedback` (migration `00017_feedback.sql`)
| Cột | Ghi chú |
|---|---|
| `id`, `user_id`, `message`, `status` (`new`/`read`/`resolved`, default `new`), `created_at`, `updated_at` | `updated_at` tự cập nhật qua trigger `update_modified_column()` (dùng lại hàm chung từ `00001`) |

RLS: `feedback_insert_own` (user chỉ insert được `user_id = auth.uid()`), `feedback_select_own_or_admin` (user thấy dòng của mình; admin `is_admin()` thấy tất cả), `feedback_update_admin` + `feedback_delete_admin` (chỉ admin). User **không sửa/xóa được** feedback đã gửi — tránh chỉnh sửa lại nội dung đã gửi cho admin.

### Composable — `composables/useFeedback.ts`
`submitFeedback(message)` (user), `listFeedback()` + `updateFeedbackStatus(id, status)` (admin, gated bởi RLS chứ không phải check role phía client). Export type `FeedbackItem`/`FeedbackStatus` dùng chung giữa `profile.vue` và `admin/feedback.vue`.
