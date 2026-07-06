# Nuxt 4 — Recommended Directory Structure

> Cập nhật 2026-07-06 — đồng bộ với bản cài đặt cloud-only hiện tại.

> **Project:** Focus Mode App (Web-Only)  
> **Framework:** Nuxt 4 (Vue 3, Nitro server, auto-imports)  
> **Backend:** Cloud-only trên Supabase (Postgres + Auth + pgvector)

---

## 1. Full Directory Layout

```
web/
├── .env                          # Environment variables (NUXT_PUBLIC_*)
├── .env.example                  # Template for .env
├── nuxt.config.ts                # Nuxt configuration
├── tailwind.config.ts            # Tailwind CSS configuration
├── tsconfig.json
├── package.json
├── package-lock.json
│
├── app.vue                       # Root app component
├── error.vue                     # Global error page
│
├── pages/                        # File-based routing (Nuxt 4)
│   ├── index.vue                 # Landing page (cloud-only, có "Cloud Sync")
│   ├── login.vue                 # Login (3 tab: Sign In / Request Access / Forgot)
│   ├── dashboard.vue             # Main user dashboard (requires auth)
│   ├── tasks.vue                 # To-do list management
│   ├── focus.vue                 # Focus mode (Pomodoro timer)
│   ├── agent.vue                 # AI agent chat
│   ├── calendar.vue              # History heatmap (lịch sử focus)
│   ├── profile.vue               # User profile / settings
│   ├── author.vue                # About the author
│   │
│   └── admin/                    # Admin CMS (role-gated)
│       ├── index.vue             # Admin dashboard (aggregate stats)
│       ├── users.vue             # User overview + approve/reject
│       └── media.vue             # Media library management
│
├── layouts/                      # Shared layouts
│   ├── default.vue               # Main layout (sidebar + header, app pages)
│   └── landing.vue               # Layout cho trang landing/marketing
│
├── components/                   # Auto-imported Vue components (flat)
│   ├── AgentChat.vue             # Khung chat với AI agent
│   ├── AmbientPlayer.vue         # Trình phát nhạc nền cho focus
│   ├── ColorModeToggle.vue       # Chuyển light/dark mode
│   ├── EmotionBadge.vue          # Hiển thị nhãn cảm xúc
│   ├── ExportReportButton.vue    # Nút xuất báo cáo
│   ├── FocusTimer.vue            # Đồng hồ đếm ngược Pomodoro
│   ├── SyncStatus.vue            # Chỉ báo Online/Offline (connectivity only)
│   ├── TaskList.vue              # Danh sách task theo section
│   └── TaskReviewDialog.vue      # Hộp review "How was this task?" (dùng chung)
│
├── composables/                  # Auto-imported composables (Vue 3 hooks)
│   ├── useAuth.ts                # Supabase Auth wrapper + approve/reject user
│   ├── useDataService.ts         # Truy cập dữ liệu Supabase (map snake_case↔camelCase)
│   ├── useConfig.ts              # Đọc runtime config (Supabase URL, API Gateway URL...)
│   ├── useAgentChat.ts           # Gọi AI agent (POST {API}/agent/chat)
│   ├── useEmotionDetector.ts     # Nhận diện cảm xúc (API hoặc fallback regex)
│   ├── useRAG.ts                 # Gợi ý nội dung (RAG; API hoặc fallback)
│   ├── useReportExport.ts        # Xuất báo cáo (API hoặc tải .md ở client)
│   ├── useAmbientSound.ts        # Sinh nhạc nền procedural bằng WebAudio (rain/cafe/waves)
│   ├── useOffline.ts             # CHỈ báo kết nối (navigator.onLine), KHÔNG queue/sync
│   └── useScrollZoom.ts          # Hiệu ứng zoom theo scroll
│
├── stores/                       # Pinia stores
│   ├── task.store.ts             # Task CRUD + luồng review (cloud Supabase trực tiếp)
│   ├── focus.store.ts            # Pomodoro timer state
│   └── user.store.ts             # User state (profile, role, status)
│
├── lib/                          # Thư viện client dùng chung
│   └── supabaseClient.ts         # Khởi tạo Supabase client (singleton)
│
├── middleware/                   # Nuxt route middleware (client-side guards)
│   ├── auth.ts                   # Yêu cầu đăng nhập
│   └── admin.ts                  # Yêu cầu quyền admin
│
├── assets/                       # Build-processed assets
│   └── css/
│       └── main.css              # Global styles (Tailwind)
│
└── public/                       # Static assets
    └── favicon.svg
```

> **Lưu ý:** KHÔNG còn store `auth.store` / `dashboard.store` / `media.store` / `sync.store`.
> Auth là composable `useAuth.ts` + Supabase Auth + `user.store.ts`; dashboard tính stats
> inline trong `dashboard.vue`; admin/media dùng `useDataService`.

## 2. File Naming Conventions

| Convention | Example |
|---|---|
| **PascalCase** for components | `TaskList.vue`, `FocusTimer.vue` |
| **camelCase** for composables | `useAuth.ts`, `useDataService.ts` |
| **dot notation** for stores | `task.store.ts`, `focus.store.ts` |
| **kebab-case / lowercase** for pages | `dashboard.vue`, `admin/users.vue` |

## 3. `nuxt.config.ts` Reference

```typescript
// nuxt.config.ts
export default defineNuxtConfig({
  devtools: { enabled: true },

  modules: [
    '@pinia/nuxt',           // Pinia state management
    '@nuxtjs/tailwindcss',   // Styling
  ],

  css: ['~/assets/css/main.css'],

  runtimeConfig: {
    // Public (exposed to client via NUXT_PUBLIC_*)
    public: {
      supabaseUrl: process.env.NUXT_PUBLIC_SUPABASE_URL || 'http://localhost:54321',
      supabaseAnonKey: process.env.NUXT_PUBLIC_SUPABASE_ANON_KEY || '',
      apiGatewayUrl: process.env.NUXT_PUBLIC_API_GATEWAY_URL || '',
      appUrl: process.env.NUXT_PUBLIC_APP_URL || 'http://localhost:3000',
    },
  },

  pinia: {
    storesDirs: ['./stores'],
  },

  // Các route tương tác chạy ở chế độ SPA (ssr: false)
  routeRules: {
    '/': { ssr: false },
    '/dashboard': { ssr: false },
    '/focus': { ssr: false },
    '/tasks': { ssr: false },
    '/calendar': { ssr: false },
    '/agent': { ssr: false },
    '/profile': { ssr: false },
    '/author': { ssr: false },
    '/admin': { ssr: false },
    '/admin/**': { ssr: false },
  },

  // Auto-import dirs
  imports: {
    dirs: ['composables'],
  },

  compatibilityDate: '2025-05-22',
})
```

## 4. Key Architectural Decisions

| Area | Decision | Rationale |
|---|---|---|
| **Rendering mode** | SPA (`ssr: false`) cho các route tương tác | Dashboard/focus/tasks cần phản hồi tức thời phía client |
| **Data layer** | **Cloud-only trên Supabase** | Mọi read/write đi thẳng Supabase (Postgres + Auth + pgvector); KHÔNG offline/IndexedDB |
| **Truy cập dữ liệu** | `useDataService.ts` + `lib/supabaseClient.ts` | Một client Supabase dùng chung; composable map snake_case↔camelCase |
| **Auth** | Supabase Auth + composable + Pinia | `useAuth.ts` bao Supabase Auth; `user.store.ts` giữ state; middleware `auth`/`admin` chặn route |
| **State** | Pinia (not Vuex) | Store chính thức của Vue 3; TypeScript-first; hỗ trợ devtools |
| **AI features** | Gọi AWS Lambda + API Gateway + Bedrock | `useAgentChat`/`useEmotionDetector`/`useRAG`/`useReportExport` gọi API khi có `NUXT_PUBLIC_API_GATEWAY_URL`; một số có fallback client-side |
| **Connectivity** | `useOffline.ts` + `SyncStatus.vue` | CHỈ là chỉ báo Online/Offline (`navigator.onLine`); KHÔNG có sync queue |
| **Notifications** | Web Notifications API | Thông báo trình duyệt khi hết giờ focus; không Firebase/FCM |
| **Styling** | Tailwind CSS v4 | Utility-first; dựng nhanh UI tối, đắm chìm |

## 5. Tầng dữ liệu cloud-only

- Toàn bộ dữ liệu (users, tasks, focus_sessions, daily_worklogs, daily_stats, media_library...)
  nằm trên **Supabase Postgres**; client đọc/ghi trực tiếp qua `lib/supabaseClient.ts`.
- Bảo mật bằng **Row Level Security (RLS)**; quyền admin xác định qua hàm `is_admin()`.
- Tìm kiếm ngữ nghĩa (RAG) dùng **pgvector** với `search_similar_content()` (embedding 384 chiều).
- KHÔNG có IndexedDB / Dexie / sync queue / Last-Write-Wins / mock backend — các thành phần
  này đã bị gỡ khỏi codebase (ví dụ `web/lib/db.ts`, `web/composables/useSyncQueue.ts`).

```typescript
// lib/supabaseClient.ts (ý tưởng)
import { createClient } from '@supabase/supabase-js'

// Một client dùng chung cho toàn app, đọc URL/anon key từ runtimeConfig.public
export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true,
  },
})
```
