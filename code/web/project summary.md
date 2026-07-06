# Project Summary — FCAJ Worklog Repository (Focus Mode App)

> Bản tóm tắt toàn bộ codebase front-end nằm trong thư mục `web/`.
> Cập nhật: 2026-07-06

---

## 1. Tổng quan

**Tên ứng dụng:** `focus-mode-app` — *"FCAJ Worklog Repository — AI-Powered Focus & Productivity"*

Đây là một ứng dụng web giúp người dùng **tập trung làm việc và quản lý năng suất**, kết hợp:

- **Pomodoro Focus Timer** (đếm ngược 15/25/45 phút) kèm âm thanh nền (ambient).
- **Quản lý công việc (Tasks)** với 2 chế độ: thủ công và *Agentic* (AI agent chia nhỏ công việc).
- **AI Agent Chat** tạo task qua hội thoại (AWS Bedrock Agent).
- **Phát hiện cảm xúc (Emotion Detection)** từ nội dung nhật ký sau mỗi phiên focus.
- **Gợi ý nội dung theo cảm xúc (RAG)** — trích dẫn/sutra/video/audio phù hợp tâm trạng.
- **Báo cáo worklog** (xuất Markdown/PDF) và **lịch sử focus dạng heatmap**.
- **Khu vực Admin**: duyệt người dùng, quản lý thư viện media (nguồn RAG), theo dõi hệ thống.

Ứng dụng **cloud-only** (mọi dữ liệu trên Supabase) và hỗ trợ **dark mode**.

---

## 2. Công nghệ & Stack

| Lớp | Công nghệ |
|-----|-----------|
| Framework | **Nuxt 3** (Vue 3, SPA — hầu hết route bật `ssr: false`) |
| Ngôn ngữ | TypeScript |
| State management | **Pinia** (`@pinia/nuxt`) |
| Styling | **TailwindCSS** (`@nuxtjs/tailwindcss`) + dark mode theo class |
| Backend cloud | **Supabase** (Auth + Postgres + pgvector) |
| Serverless | **AWS API Gateway + Lambda** (BFF) + **AWS Bedrock** (Agent/LLM) |
| Tiện ích | `@vueuse/core`, `dayjs` |
| Test | Vitest (cấu hình script sẵn) |

**Điểm kiến trúc quan trọng — CLOUD-ONLY (Supabase):**
App **chỉ chạy cloud**, không còn mock/local mode. Mọi dữ liệu đọc/ghi trực tiếp Supabase. Toàn bộ code in-memory/IndexedDB/mock auth đã bị gỡ bỏ.

| Dữ liệu | Nguồn lưu trữ | Ghi chú |
|---|---|---|
| User & approval | `public.users` (cột `status`) | Đăng ký → `pending`; admin duyệt → `approved` mới đăng nhập được |
| Tasks | `public.tasks` | Ghi/đọc trực tiếp Supabase, đồng bộ đa thiết bị |
| Focus sessions | `public.focus_sessions` | Ghi/đọc trực tiếp Supabase |
| Media library | `public.media_library` | CRUD trực tiếp Supabase (admin) |
| Agent tạo task, sinh embedding | — | ⛔ Cần backend Lambda/API Gateway (URL còn placeholder) |

> **Đã gỡ bỏ:** `lib/db.ts` (Dexie), `composables/useSyncQueue.ts`, cờ `NUXT_PUBLIC_USE_MOCK_BACKEND`, toàn bộ tài khoản mock/OTP in-memory, các in-memory store. Dependency `dexie` cũng đã gỡ khỏi `package.json`.

---

## 3. Cấu trúc thư mục `web/`

```
web/
├── app.vue                  # Root: NuxtLayout > NuxtPage, khởi tạo dark mode + restore auth
├── error.vue                # Trang lỗi
├── nuxt.config.ts           # Cấu hình Nuxt, runtimeConfig, routeRules (ssr:false)
├── tailwind.config.ts
├── tsconfig.json
├── .env / .env.example      # Biến môi trường (Supabase, API Gateway)
│
├── assets/css/main.css
├── public/favicon.svg
│
├── layouts/
│   ├── default.vue          # Layout cho user đã đăng nhập (header + nav + mobile bottom-nav)
│   └── landing.vue          # Layout trang public (Features / How it works / Author)
│
├── middleware/
│   ├── auth.ts              # Guard đăng nhập + điều hướng user/admin
│   └── admin.ts             # Guard chỉ cho admin vào /admin/*
│
├── pages/                   # Routing theo file
│   ├── index.vue            # Landing page (public)
│   ├── login.vue            # Đăng nhập / đăng ký / quên mật khẩu
│   ├── author.vue           # Trang giới thiệu tác giả (public)
│   ├── dashboard.vue        # Trang chủ user
│   ├── focus.vue            # Pomodoro timer + journaling + emotion
│   ├── tasks.vue            # Quản lý task: 3 tab Pending/In Progress/Completed + review + khóa focus
│   ├── calendar.vue         # Lịch sử focus + heatmap
│   ├── agent.vue            # Trang chat với AI agent
│   ├── profile.vue          # Hồ sơ + đổi mật khẩu + worklog history
│   └── admin/
│       ├── index.vue        # Tổng quan admin
│       ├── users.vue        # Duyệt & quản lý người dùng
│       └── media.vue        # Thư viện media (nguồn RAG) + embeddings
│
├── components/
│   ├── AgentChat.vue        # Giao diện chat tạo task
│   ├── AmbientPlayer.vue    # Chọn preset ambient (Rain/Cafe/Waves) → phát nhạc thật qua useAmbientSound
│   ├── ColorModeToggle.vue  # Nút Light/Dark
│   ├── EmotionBadge.vue     # Badge nhãn cảm xúc
│   ├── ExportReportButton.vue # Nút xuất báo cáo worklog
│   ├── FocusTimer.vue       # Widget timer mini cho dashboard
│   ├── SyncStatus.vue       # Chỉ báo online/offline
│   ├── TaskList.vue         # Danh sách task tái sử dụng
│   └── TaskReviewDialog.vue # Dialog review-on-complete dùng chung (đặt trong layout default)
│
├── composables/             # Logic nghiệp vụ (auto-import)
│   ├── useAuth.ts           # Xác thực (Supabase, cloud-only)
│   ├── useConfig.ts         # Đọc endpoint từ env (apiGatewayUrl/supabase*)
│   ├── useDataService.ts    # Đọc tasks/sessions/media/users từ Supabase
│   ├── useAgentChat.ts      # Gọi AWS Bedrock Agent tạo task
│   ├── useEmotionDetector.ts# Phát hiện cảm xúc từ text
│   ├── useRAG.ts            # Gợi ý nội dung theo cảm xúc
│   ├── useReportExport.ts   # Sinh & xuất báo cáo worklog (Markdown/PDF)
│   ├── useAmbientSound.ts   # Tổng hợp ambient (Rain/Cafe/Waves) bằng WebAudio, không cần file nhạc
│   ├── useOffline.ts        # Chỉ báo trạng thái mạng (online/offline)
│   └── useScrollZoom.ts     # Hiệu ứng scroll-zoom cho landing page
│
├── stores/                  # Pinia stores
│   ├── user.store.ts        # (DEPRECATED) wrapper quanh useAuth (chỉ còn userId)
│   ├── task.store.ts        # State + CRUD task (Supabase public.tasks) + review flow + isLockedByFocus + loadError
│   └── focus.store.ts       # State phiên focus (neo endAt + persist qua reload + chuông/Notification; lưu qua useDataService → Supabase)
│
└── lib/
    └── supabaseClient.ts    # Singleton Supabase client
```

---

## 4. Các trang (Pages) & luồng người dùng

| Route | Mô tả | Quyền |
|-------|-------|-------|
| `/` | Landing page: hero, stats, 6 feature card, workflow, CTA; tự chuyển hướng nếu đã đăng nhập | Public |
| `/login` | 3 tab: Đăng nhập / Yêu cầu truy cập (signup, có password) / Quên mật khẩu (gửi link reset Supabase). Password đặt lúc đăng ký = mật khẩu đăng nhập (không có OTP) | Public |
| `/author` | Trang giới thiệu tác giả, lý do làm app, social link, Buy Me a Coffee | Public |
| `/dashboard` | Lời chào, stats trong ngày (focus time, streak, task xong, mood), quick actions, **"Today's Tasks"** (5 task `in_progress`), widget timer | User |
| `/focus` | Chọn thời lượng + task + âm thanh → đếm ngược (neo thời gian thực, pause/resume/end, **persist qua reload**, phát **ambient thật** theo phiên) → journaling + phát hiện cảm xúc + gợi ý RAG | User |
| `/tasks` | 3 tab màu **Pending / In Progress / Completed** (bỏ tab All), dialog thêm/sửa/xóa task, **review-on-complete**; tick & Delete bị **khóa 🔒** khi task đang trong phiên focus | User |
| `/calendar` | Heatmap focus theo tháng + bảng các phiên (ngày, thời lượng, mood, journal) | User |
| `/agent` | Wrapper chứa `AgentChat` — chat để AI tạo task | User |
| `/profile` | Thông tin tài khoản, đổi mật khẩu, stats + worklog 14 ngày gần nhất | User |
| `/admin` | Tổng quan admin (tab Overview/Users/Media), điều hướng & system health | Admin |
| `/admin/users` | Duyệt đăng ký theo mục **Pending / Approved / Rejected** (approve/reject/re-approve/set-pending → đổi `status` trong Supabase), nâng/hạ quyền, xóa user (không tự xóa) | Admin |
| `/admin/media` | CRUD media (sutra/audio/video), trạng thái embedding, sinh embedding lẻ/hàng loạt, tìm kiếm | Admin |

**Điều hướng (middleware):**
- `auth.ts`: route public = `/`, `/login`, `/author`. Chưa đăng nhập → `/login?redirect=`. Admin truy cập trang user → chuyển `/admin`; user thường truy cập `/admin/*` → chuyển `/dashboard`.
- `admin.ts`: bảo vệ `/admin/*`, không phải admin → `/dashboard`.

---

## 5. Lớp logic (Composables)

- **useAuth** — Xác thực **cloud-only** (Supabase Auth). Session lưu localStorage (snapshot `focus_auth_user`). **Admin = CHỈ `public.users.role='admin'`** (khớp RLS `is_admin()`) — đã gỡ env `ADMIN_EMAILS`, frontend không còn override quyền qua email. Có `login/signUp/logout/changePassword/forgotPassword/syncSession`; `changePassword` **verify mật khẩu hiện tại** (re-auth) trước khi đổi; `syncSession()` re-validate role/status với DB lúc mở app (bị demote/reject/hết session → tự logout). **Approval gate:** `login` đọc `status` từ `public.users`; nếu `pending`/`rejected` thì signOut + báo lỗi (admin luôn được vào). Quản trị user: `getPendingUsers/getRejectedUsers/approveUser/rejectUser/setUserStatus` ghi/đọc trực tiếp Supabase (cột `status`).
- **useConfig** — Đọc endpoint từ env: `apiGatewayUrl`, `supabaseUrl`, `supabaseAnonKey` (đã bỏ `useMockBackend`).
- **useDataService** — Đọc/ghi Supabase: tasks (`getTasks`), focus sessions (`getSessions/createSession`), media (`getMedia/createMedia/updateMedia/deleteMedia`), users (`getUsers/updateUserRole/deleteUser`). Map snake_case ↔ camelCase + guard ràng buộc DB. `generateEmbedding/generateAllEmbeddings` gọi API Gateway, báo lỗi rõ nếu chưa cấu hình.
- **useAgentChat** — Gửi tin nhắn tới AWS Bedrock Task Manager Agent (qua API Gateway → Lambda BFF). Báo lỗi rõ nếu API Gateway chưa cấu hình.
- **useEmotionDetector** — Phát hiện cảm xúc từ text qua endpoint `/emotion`, fallback bằng regex (focused/stressed/exhausted/relaxed).
- **useRAG** — Lấy gợi ý nội dung theo cảm xúc qua `/rag`, fallback nội dung hardcode (sutra, bài tập thở).
- **useReportExport** — Sinh báo cáo Markdown hằng ngày (focus time, mood, task, streak), upload qua `/report` hoặc tải `.md` ở client. Dùng `dayjs`.
- **useAmbientSound** — Tổng hợp âm thanh nền (Rain/Cafe/Waves) trực tiếp bằng WebAudio (noise + filter, không tải file); graph singleton chỉ phát một track tại một thời điểm. `AmbientPlayer` chọn preset, trang `/focus` gọi `play/stop` theo vòng đời timer.
- **useOffline** — Chỉ báo `navigator.onLine`, hiển thị toast khi mất/khôi phục mạng (không còn liên quan sync/offline-first).
- **useScrollZoom** — Hiệu ứng sticky scroll-zoom cho các section landing page (CSS var `--zoom-progress`, requestAnimationFrame).

---

## 6. State (Pinia stores)

- **focus.store** — Trạng thái phiên focus: `status`, `remaining`, `taskId` + snapshot `taskTitle`, `ambientTrack`, `journalText`, `emotionLabel/confidence`, `recommendations`. Đếm ngược **neo theo mốc thời gian thực** (`endAt = Date.now()+duration`) nên chính xác cả khi tab chạy nền; **persist qua reload** (localStorage `focus_session`, tự khôi phục/hoàn tất khi mở lại). Hết giờ → phát **chuông WebAudio + Notification** trình duyệt. `saveSession()` lưu qua `useDataService.createSession` → **Supabase `focus_sessions`**, và **ném lỗi** khi lưu thất bại (giữ nguyên màn hình hoàn tất, không mất journal/cảm xúc).
- **task.store** — Danh sách task + CRUD **ghi/đọc trực tiếp Supabase `tasks`** (map snake↔camel). Computed: `pendingTasks/inProgressTasks/completedTasks/completedToday/totalToday`. **Review flow** dùng chung: `requestToggle` mở `TaskReviewDialog` khi hoàn thành (`reviewTarget/reviewText/reviewSaving`, `saveReview/skipReview/cancelReview`). `isLockedByFocus(taskId)` khóa complete/Delete khi task đang gắn phiên focus chạy/tạm dừng (ném `TaskLockedError`). `loadError` chứa thông báo lỗi tải để trang Tasks hiện banner + Retry.
- **user.store** — *DEPRECATED*, lớp mỏng bọc `useAuth` để tương thích ngược (chỉ còn cung cấp `userId` cho các store).

---

## 7. Thư viện (lib)

- **lib/supabaseClient.ts** — Khởi tạo & cache singleton Supabase client (auth lưu localStorage, auto refresh). Là client DB/Auth duy nhất của app.

---

## 8. Backend / Cơ sở dữ liệu (Supabase Postgres + pgvector)

Schema chính (`supabase/migrations/00001_initial_schema.sql`), kèm các migration bổ sung (`00003` trigger auth, `00005` seed demo, **`00006` approval status**):

| Bảng | Vai trò |
|------|---------|
| `users` | Mirror của Supabase Auth; có `role` (user/admin) **và `status` (pending/approved/rejected)** |
| `tasks` | Công việc: status, priority (0–3), `duration_spent`, `review` (đánh giá sau hoàn thành) |
| `focus_sessions` | Mỗi phiên Pomodoro: thời lượng planned/actual, `journal_text`, `emotion_label` + confidence, `ambient_track` |
| `daily_worklogs` | Tổng hợp theo ngày (Lambda chạy nhắm tối): focus time, mood, link `.tex`/`.pdf` (S3) |
| `media_library` | Nguồn RAG: text/url, type (quote/sutra/video/article/audio), `embedding_vector VECTOR(384)` (all-MiniLM-L6-v2) |
| `daily_stats` | Analytics tính sẵn: focus seconds, streak, avg session |
| `sync_log` | Đối soát đồng bộ client ↔ server |

**Hàm hỗ trợ:** `search_similar_content()` (RAG cosine similarity qua pgvector ivfflat), `get_user_streak()` (đếm chuỗi ngày focus liên tiếp), **`is_admin()`** (SECURITY DEFINER — kiểm tra admin trong RLS mà không gây đệ quy vô hạn).

**Bảo mật RLS:** mỗi user chỉ truy cập dữ liệu của mình (`auth.uid() = user_id`); admin đọc/quản lý toàn bộ user (qua `is_admin()`); `media_library` đọc cho mọi user đã xác thực, ghi chỉ admin; worklogs/stats insert bởi service_role (Lambda).

**Luồng đăng ký & duyệt (Cloud):** đăng ký → trigger `handle_new_user()` tạo dòng `public.users` với `status='pending'` (email admin trong `handle_new_user()` → `role='admin'`, `approved`). User `pending` không đăng nhập được cho tới khi admin bấm **Approve** (cập nhật `status='approved'`). Cấu hình trong `00006_user_approval_status.sql` — **phải chạy file này trong Supabase SQL Editor**. ⚠️ **Bắt buộc TẮT "Confirm email"** (Authentication → Providers → Email): cổng chặn duy nhất là admin-approval (`users.status`); nếu bật Confirm email, user đã duyệt vẫn kẹt lỗi *"Email not confirmed"*.

---

## 9. Cấu hình & biến môi trường

`.env.example`:
```
NUXT_PUBLIC_SUPABASE_URL=https://YOUR_PROJECT_ID.supabase.co
NUXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key-here
NUXT_PUBLIC_API_GATEWAY_URL=https://YOUR_API_ID.execute-api.ap-southeast-1.amazonaws.com/prod
NUXT_PUBLIC_APP_URL=http://localhost:3000
```

**Scripts (`package.json`):** `dev`, `build`, `generate`, `preview`, `typecheck`, `lint`, `test`, `test:coverage`.

---

## 10. Sơ đồ phụ thuộc tổng quát

```
              ┌──────────────────────────────┐
   UI Pages → │ Components (AgentChat, Timer…)│
              └──────────────┬───────────────┘
                             ▼
        Pinia stores (focus, task)  +  Composables (useAuth, useDataService, …)
                             │                          │
                             ▼                          ▼
                 Supabase (Auth + Postgres)   AWS API Gateway → Lambda → Bedrock
                 nguồn dữ liệu duy nhất       (Agent / Emotion / RAG / Report — chưa cấu hình)
```

---

## 11. Tính năng nổi bật (tóm gọn)

- **Cloud-only**: user/tasks/focus sessions/media ghi/đọc trực tiếp Supabase (đồng bộ đa thiết bị). Không còn mock/local.
- **Approval workflow**: đăng ký → chờ admin duyệt (cột `status` trong DB) → mới đăng nhập được.
- **AI tích hợp**: tạo task qua hội thoại (Bedrock Agent), phát hiện cảm xúc, gợi ý nội dung RAG bằng pgvector (cần backend API Gateway).
- **Dark mode** dựa trên cookie, đồng bộ vào class `html`.
- **Responsive**: nav trên cùng cho desktop, bottom-nav cho mobile.
- **Báo cáo & analytics**: heatmap lịch sử focus, worklog 14 ngày, xuất báo cáo Markdown/PDF, streak.
- **Phân quyền**: middleware tách rõ luồng user vs admin; RLS ở tầng database.
