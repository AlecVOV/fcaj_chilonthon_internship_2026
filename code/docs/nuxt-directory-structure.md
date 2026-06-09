# Nuxt 4 — Recommended Directory Structure

> **Project:** Focus Mode App (Web-Only)  
> **Framework:** Nuxt 4 (Vue 3, Nitro server, auto-imports)  
> **Deploy:** Cloudflare Pages (static + serverless functions)

---

## 1. Full Directory Layout

```
focus-mode-web/
├── .env                          # Environment variables (NUXT_PUBLIC_*)
├── .env.example                  # Template for .env (see environment.example)
├── .gitignore
├── nuxt.config.ts                # Nuxt configuration
├── package.json
├── tsconfig.json
├── vitest.config.ts
├── playwright.config.ts
│
├── pages/                        # File-based routing (Nuxt 4)
│   ├── index.vue                 # Landing / Login page
│   ├── dashboard.vue             # Main user dashboard (requires auth)
│   ├── focus.vue                 # Focus mode (Pomodoro timer)
│   ├── tasks.vue                 # To-do list management
│   ├── reports.vue               # View past daily reports
│   ├── insights.vue              # AI suggestions & emotion trends
│   ├── settings.vue              # User settings
│   │
│   └── admin/                    # Admin CMS (role-gated)
│       ├── index.vue             # Admin dashboard (aggregate stats)
│       ├── media.vue             # Media library management
│       ├── media/[id].vue        # Edit media item
│       └── users.vue             # User overview
│
├── layouts/                      # Shared layouts
│   ├── default.vue               # Main layout (sidebar + header)
│   └── focus.vue                 # Fullscreen dark layout for focus mode
│
├── components/                   # Auto-imported Vue components
│   ├── auth/
│   │   └── LoginForm.vue
│   ├── task/
│   │   ├── TaskCard.vue
│   │   ├── TaskList.vue
│   │   └── TaskForm.vue
│   ├── focus/
│   │   ├── FocusTimer.vue
│   │   ├── FocusControls.vue
│   │   ├── AmbientPlayer.vue
│   │   └── JournalForm.vue
│   ├── dashboard/
│   │   ├── StatsCard.vue
│   │   ├── EmotionChart.vue
│   │   ├── FocusHeatmap.vue
│   │   └── StreakCounter.vue
│   ├── rag/
│   │   └── RecommendationCard.vue
│   └── ui/
│       ├── AppHeader.vue
│       ├── AppSidebar.vue
│       ├── SyncStatusBadge.vue
│       └── LoadingSpinner.vue
│
├── composables/                  # Auto-imported composables (Vue 3 hooks)
│   ├── useAuth.ts                # Supabase auth wrapper
│   ├── useDB.ts                  # Dexie instance accessor
│   ├── useSupabase.ts            # Supabase client composable
│   ├── useSyncQueue.ts           # Sync queue manager
│   ├── useEmotionDetector.ts     # Call NLP Lambda
│   ├── useRAG.ts                 # RAG recommendation queries
│   ├── useReport.ts              # Report generation triggers
│   └── useAmbientPlayer.ts       # Audio streaming from S3
│
├── stores/                       # Pinia stores
│   ├── auth.store.ts             # Auth state (user, session, role)
│   ├── tasks.store.ts            # Task CRUD + sync
│   ├── focus.store.ts            # Pomodoro timer state
│   ├── dashboard.store.ts        # Aggregated stats
│   ├── media.store.ts            # Media library (admin)
│   └── sync.store.ts             # Sync status (pending count, last sync)
│
├── server/                       # Nitro server (API proxies + SSR)
│   ├── api/                      # Server API routes (optional proxy layer)
│   │   ├── emotion.post.ts       # Proxy to Emotion Lambda
│   │   ├── reports.post.ts       # Proxy to Report Lambda
│   │   ├── rag.post.ts           # Proxy to RAG Lambda
│   │   └── admin/
│   │       └── vectorize.post.ts # Proxy to Admin Vectorize Lambda
│   │
│   ├── middleware/
│   │   └── auth.ts               # Server-side auth guard
│   └── utils/
│       └── supabase.ts           # Server-side Supabase client (service_role)
│
├── services/                     # Plain TypeScript service layer
│   ├── supabase.service.ts       # Supabase client init + helpers
│   ├── api.service.ts            # HTTP client to Lambda endpoints
│   ├── sync.service.ts           # Sync queue push/pull logic
│   └── notification.service.ts   # Browser notification (Web Push / toast)
│
├── utils/                        # Pure utility functions
│   ├── uuid.ts                   # UUID v4 generator
│   ├── datetime.ts               # Date formatting helpers
│   ├── timer.ts                  # Timer calculations
│   └── debounce.ts               # Debounce/throttle helpers
│
├── middleware/                   # Nuxt route middleware (client-side guards)
│   ├── auth.global.ts            # Global auth check
│   └── admin.ts                  # Admin role guard
│
├── plugins/                      # Nuxt plugins
│   ├── supabase.client.ts        # Provide Supabase client
│   ├── dexie.client.ts           # Provide Dexie DB instance
│   └── pwa.ts                    # PWA / service worker registration
│
├── public/                       # Static assets
│   ├── favicon.ico
│   ├── audio/                    # Default ambient tracks (bundled)
│   │   └── minecraft-default.mp3
│   └── robots.txt
│
├── assets/                       # Build-processed assets
│   └── css/
│       └── main.css              # Global styles (Tailwind or custom)
│
└── tests/                        # Vitest + Playwright tests
    ├── unit/
    │   ├── stores/
    │   │   ├── tasks.store.test.ts
    │   │   ├── focus.store.test.ts
    │   │   └── sync.store.test.ts
    │   ├── services/
    │   │   └── sync.service.test.ts
    │   ├── composables/
    │   │   └── useEmotionDetector.test.ts
    │   └── database/
    │       └── indexeddb.test.ts
    └── e2e/                      # Playwright (optional for MVP)
        └── focus-flow.spec.ts
```

## 2. File Naming Conventions

| Convention | Example |
|---|---|
| **PascalCase** for components | `TaskCard.vue`, `FocusTimer.vue` |
| **camelCase** for composables | `useAuth.ts`, `useSyncQueue.ts` |
| **dot notation** for stores | `tasks.store.ts`, `auth.store.ts` |
| **kebab-case** for pages | `settings.vue`, `media/[id].vue` |
| **dot notation** for services | `supabase.service.ts` |

## 3. `nuxt.config.ts` Reference

```typescript
// nuxt.config.ts
export default defineNuxtConfig({
  devtools: { enabled: true },

  modules: [
    '@pinia/nuxt',           // Pinia state management
    '@vite-pwa/nuxt',        // PWA (optional)
    '@nuxtjs/tailwindcss',   // Styling (optional)
  ],

  runtimeConfig: {
    // Server-only (not exposed to client)
    supabaseServiceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY,
    apiGatewayKey: process.env.API_GATEWAY_KEY,
    awsSecretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,

    // Public (exposed to client via NUXT_PUBLIC_*)
    public: {
      supabaseUrl: process.env.NUXT_PUBLIC_SUPABASE_URL,
      supabaseAnonKey: process.env.NUXT_PUBLIC_SUPABASE_ANON_KEY,
      apiGatewayUrl: process.env.NUXT_PUBLIC_API_GATEWAY_URL,
      appUrl: process.env.NUXT_PUBLIC_APP_URL,
    },
  },

  nitro: {
    preset: 'cloudflare-pages',
    // Optional: route rules for cache
    routeRules: {
      '/admin/**': { ssr: false },     // Admin is SPA
      '/dashboard/**': { ssr: false }, // Dashboard requires auth
    },
  },

  // Auto-import dirs
  imports: {
    dirs: ['stores', 'composables', 'services', 'utils'],
  },
});
```

## 4. Key Architectural Decisions

| Area | Decision | Rationale |
|---|---|---|
| **Rendering mode** | SPA with SSR for landing page | Dashboard/focus are interactive; SSR not needed |
| **Server API** | `server/api/` proxies Lambda | Hides Lambda URLs from client; adds server-side validation |
| **Auth** | Supabase Auth + Pinia store | Pinia holds `user` reactive state; middleware guards routes |
| **Offline** | Dexie.js + Sync Queue | IndexedDB for structured data; sync queue for push |
| **State** | Pinia (not Vuex) | Official Vue 3 store; TypeScript-first; devtools support |
| **Data fetching** | `$fetch` / `useFetch` in composables | Native Nuxt utilities; no extra dependency |
| **Notifications** | Web Notifications API | Simple browser alerts for health breaks; no Firebase/FCM |
| **Styling** | Tailwind CSS v4 | Utility-first; fast to build immersive dark UI |

## 5. Plugins Initialization Order

```typescript
// plugins/supabase.client.ts
export default defineNuxtPlugin(() => {
  const config = useRuntimeConfig()
  const supabase = createClient(
    config.public.supabaseUrl,
    config.public.supabaseAnonKey,
    {
      auth: {
        storage: localStorage,     // Persist session in browser
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: true,
      },
    }
  )
  return { provide: { supabase } }
})

// plugins/dexie.client.ts
export default defineNuxtPlugin(() => {
  const db = getDB()  // Singleton from indexeddb_schema.ts
  return { provide: { db } }
})
```
