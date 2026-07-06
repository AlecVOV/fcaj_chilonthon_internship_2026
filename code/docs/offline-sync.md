# Offline Behavior — Connectivity Indicator (Cloud-Only) (Nuxt 4 / TypeScript)

> Cập nhật 2026-06-29 — đồng bộ với bản cài đặt cloud-only hiện tại.

> **Project:** Focus Mode App (Web-Only)
> **Strategy:** Cloud-only — every read/write goes straight to Supabase
> **Local DB:** None (no IndexedDB / Dexie)
> **Remote DB:** Supabase PostgreSQL
> **Offline support:** Connectivity *indicator* only — no offline writes, no queue, no auto-resync

---

## 1. Architecture Overview

The app is **cloud-only**. There is no local database and no synchronization layer.
All reads and writes are issued directly against Supabase. The browser's online/offline
state is surfaced purely as a UI hint so the user knows when a save might fail.

```
┌──────────────────────────────────────────────────┐
│                Nuxt 4 Web App (Browser)            │
│                                                    │
│  ┌──────────┐    ┌──────────────┐                 │
│  │  Vue      │◄──►│  Pinia        │                │
│  │  Pages    │    │  Stores       │                 │
│  └──────────┘    └──────┬───────┘                 │
│                         │                          │
│                  ┌──────▼───────┐                 │
│                  │  Composables  │                 │
│                  │  (useXxx)     │                 │
│                  └──────┬───────┘                 │
│                         │                          │
│              ┌──────────▼──────────┐              │
│              │  Supabase Client     │              │
│              │  (direct read/write) │              │
│              └──────────┬──────────┘              │
│                         │                          │
│              ┌──────────▼──────────┐              │
│              │  useOffline          │              │
│              │  navigator.onLine +  │              │
│              │  'online'/'offline'  │              │
│              │  → UI indicator only │              │
│              └─────────────────────┘              │
└──────────────────────────────────────────────────┘
```

## 2. Write Path (Always Remote)

There is **no "local first"** anymore. Every action talks to Supabase directly.

```
User Action (Create/Update/Delete Task or Session)
    │
    ▼
1. Pinia store / composable calls Supabase (insert / update / delete)
    │
    ▼
2. On success → store state refreshed from the returned/refetched rows
    │
    ▼
3. On failure (e.g. offline / network error) → the operation simply errors;
   nothing is queued and nothing is retried automatically
```

Data access lives in:

- **`web/composables/useDataService.ts`** — shared reads/writes, maps Supabase
  `snake_case` ↔ app `camelCase`, calls `getSupabase()` directly.
- **`web/stores/task.store.ts`** — task CRUD against Supabase.
- **`web/stores/focus.store.ts`** — focus/Pomodoro session state.

> Note: a few interfaces (e.g. `Task`, `FocusSession`) still carry an `isSynced`
> field for backward compatibility, but it is always set to `true` and is no
> longer used for any sync logic.

## 3. Connectivity Indicator — `useOffline`

The only "offline" feature left is a connectivity indicator. It reads
`navigator.onLine`, listens for the browser `online` / `offline` events, and
exposes two reactive flags. It does **not** queue, store, or replay anything.

```typescript
// web/composables/useOffline.ts
export function useOffline() {
  const isOnline = ref(true)
  const showOfflineToast = ref(false)

  function updateOnlineStatus() {
    isOnline.value = navigator.onLine
    if (!isOnline.value) { showOfflineToast.value = true }
    else { setTimeout(() => { showOfflineToast.value = false }, 2000) }
  }

  onMounted(() => {
    updateOnlineStatus()
    window.addEventListener('online', updateOnlineStatus)
    window.addEventListener('offline', updateOnlineStatus)
  })
  onUnmounted(() => {
    window.removeEventListener('online', updateOnlineStatus)
    window.removeEventListener('offline', updateOnlineStatus)
  })

  return { isOnline, showOfflineToast }
}
```

## 4. Where the Indicator Is Used

| Consumer | Behavior |
|---|---|
| **`web/components/SyncStatus.vue`** | Renders a colored dot + the text `Online` / `Offline` based on `isOnline`. Nothing else — no "Sync Now", no pending count. |
| **`web/pages/dashboard.vue`** | Shows a single warning toast when `showOfflineToast` is true: *"You are offline. Changes may not be saved until your connection is restored."* The toast auto-hides ~2s after connectivity returns. |

`SyncStatus.vue` (full component):

```vue
<template>
  <div class="flex items-center gap-1.5">
    <span class="status-dot" :class="isOnline ? 'online' : 'offline'" />
    <span class="text-sm" :class="isOnline ? 'text-success dark:text-success' : 'text-error dark:text-error'">
      {{ isOnline ? 'Online' : 'Offline' }}
    </span>
  </div>
</template>

<script setup lang="ts">
import { useOffline } from '~/composables/useOffline'

const { isOnline } = useOffline()
</script>
```

## 5. What Happens When You Go Offline

- The status dot flips to **Offline** and the dashboard shows the warning toast.
- Any write you attempt while offline (or that hits a network error) **fails**;
  the error surfaces to the caller. The change is **not** saved locally and is
  **not** retried when you come back online.
- When connectivity returns, the indicator flips back to **Online** and the toast
  fades. There is **no automatic re-sync** — reopen/refresh the page (or repeat the
  action) to pick up the latest server state.

## 6. Previous Design Removed (Historical)

The app used to be **offline-first** with an IndexedDB cache and a background sync
layer. That entire design has been **removed** in favor of the simpler cloud-only
model documented above. None of the pieces below exist in the codebase anymore.

What was removed:

- **Dexie.js / IndexedDB local store** — local mirror of `tasks` / `focus_sessions`.
- **`web/lib/db.ts`** — Dexie schema + local table helpers. **Deleted.**
- **`web/composables/useSyncQueue.ts`** — the `SyncQueueManager` (`processQueue`,
  `pushToServer`, `pullFromServer`, retry/backoff). **Deleted.**
- **Sync queue table** — pending `INSERT/UPDATE/DELETE` operations persisted in
  IndexedDB and replayed when online.
- **Last-Write-Wins (LWW) conflict resolution** — comparing `updated_at` between
  local and server records on pull.
- **Sync triggers** — the old network-`online` listener, periodic polling
  (`setInterval`), `visibilitychange` re-sync, and the "Sync Now" button.
- **Mock backend** — the `NUXT_PUBLIC_USE_MOCK_BACKEND` flag and in-memory mock /
  OTP stores.

**Why it was removed:** for a single-user productivity app talking to a managed
Postgres (Supabase) backend, the offline-first machinery added significant
complexity (a second source of truth, conflict resolution, queue retries, quota
handling) for little real-world benefit. Going **cloud-only** makes Supabase the
single source of truth, removes whole classes of sync bugs, and keeps the data
layer easy to reason about. The lightweight connectivity indicator (Section 3)
covers the one piece of offline UX that's still worth keeping: telling the user
when their changes might not save.

## 7. Testing

Because there is no sync queue or conflict resolution, the historical sync test
cases (offline insert → online push, LWW resolution, retry/backoff, etc.) no
longer apply. The remaining surface to test is small:

- Toggle network off → `SyncStatus.vue` shows **Offline** and the dashboard toast
  appears.
- Toggle network on → indicator returns to **Online** and the toast auto-hides.
- Attempting a write while offline surfaces an error (no silent local save).
