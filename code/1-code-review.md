# Focus Mode App — Code Review & Improvement Recommendations

**Date:** June 8, 2026  
**Scope:** Full project review of `web/` folder (Nuxt 4 + Vue 3 + Pinia + Tailwind)

---

## 1. CRITICAL: Stale `app.vue` Uses Deprecated `useUserStore`

`web/app.vue` still imports from `~/stores/user.store` and calls `userStore.initialize()`, but the entire auth system now lives in `composables/useAuth.ts` and `composables/useConfig.ts`. The old Pinia store (`user.store.ts`) is a **dead code** stub with a hardcoded mock that always returns `isAuthenticated = true`. This works by accident — but any future change will break.

**Fix:** Replace `app.vue` script with:

```ts
// No imports needed — useAuth() auto-restores session from localStorage
// Color mode handled by ColorModeToggle component
```

---

## 2. CRITICAL: Dual Auth Systems in Conflict

Two auth systems exist simultaneously:
| System | Location | State |
|--------|----------|-------|
| Pinia `useUserStore` | `stores/user.store.ts` | Always-authenticated stub |
| Composable `useAuth` | `composables/useAuth.ts` | Full auth with localStorage persistence |

**Problem:** `pages/index.vue`, `pages/focus.vue`, `pages/calendar.vue` all import `useUserStore` for `userId` queries. But `useUserStore.userId` returns the hardcoded mock UUID `00000000-...` which never matches data from `useDataService` (which uses real user IDs like `aaaaaaaa-...`).

**Result:** Dashboard stats (`todayMinutes`, `sessionsToday`) will always be `0` because `getSessionsForUser('00000000-...')` finds no matching sessions.

**Fix:** Migrate these three pages from `useUserStore` to `useAuth`:
- `pages/index.vue` → `const { currentUser } = useAuth()` + `currentUser.value?.id`
- `pages/focus.vue` → same pattern
- `pages/calendar.vue` → same pattern

---

## 3. HIGH: Orphaned `user.store.ts` / `task.store.ts` / `focus.store.ts`

These three Pinia stores use `getDB()` from Dexie.js (IndexedDB), while ALL admin and media functionality now uses `useDataService` (in-memory arrays). This means:

- Tasks created via the **Dashboard** go to IndexedDB (via `task.store.ts`)
- Tasks created via **Admin Panel** go to in-memory arrays (via `useDataService.ts`)
- They are **two separate data silos** that will never show the same data

**Fix:** Pick ONE data layer:
1. **Option A (recommended):** Complete the migration to `useDataService`. Remove `lib/db.ts` (Dexie) and the three Pinia stores. Update dashboard pages to call `useDataService` instead.
2. **Option B:** Wire `useDataService` to use Dexie/IndexedDB as its backing store (more work but better offline support).

---

## 4. MEDIUM: `imports.dirs` Contains `lib` but No `lib` Files Are Auto-Imported

```ts
imports: {
  dirs: ['composables', 'lib'],
},
```

All files that use `getDB()` or `getSupabase()` have **explicit** imports. The `lib` entry in `imports.dirs` is unused. While harmless, it signals confusion about Nuxt's auto-import behavior.

**Recommendation:** Remove `lib` from `imports.dirs` since all lib imports are already explicit.

---

## 5. MEDIUM: Missing `favicon.svg`

`nuxt.config.ts` references `href: '/favicon.svg'` but no such file exists in `public/`. This produces a 404 on every page load.

**Fix:** Create `public/favicon.svg` with a simple SVG, or remove the link tag.

---

## 6. MEDIUM: `useSyncQueue.ts` — Unused but Imports Heavy Dependencies

```ts
import { getDB } from '~/lib/db'
import { getSupabase } from '~/lib/supabaseClient'
```

If the app migrates fully to `useDataService`, this composable becomes dead code. Currently it triggers periodic sync every 30 seconds via `setInterval` in `onMounted`, but no component calls `useSyncQueue()`.

**Fix:** Either wire it into the app or remove it to clean up.

---

## 7. LOW: `handleSubmit` Not Defined in `login.vue`

The `login.vue` template has:
```html
<form @submit.prevent="handleSubmit">
```

And the `quickLogin()` function calls `handleSubmit()`, but there is no `async function handleSubmit()` defined in the script. The code after `quickLogin` just ends.

**Fix:** Add the missing function:
```ts
async function handleSubmit() {
  successMsg.value = ''
  try {
    if (activeTab.value === 'Sign In') await login(email.value, password.value)
    else { await signUp(email.value, password.value); successMsg.value = 'Account created! (Mock mode)' }
    await navigateTo((route.query.redirect as string) || '/')
  } catch {}
}
```

---

## 8. LOW: `ColorModeToggle.vue` References Cookie But `app.vue` Also Toggles Class

Two systems manage dark mode:
- `app.vue`: `watchEffect` syncing `color-mode` cookie → `html.classList`
- `ColorModeToggle.vue`: Also syncing cookie → `html.classList`

Both work, but they **duplicate** the same logic. On a race condition, they could toggle against each other.

**Fix:** Remove the `watchEffect` from `app.vue` and let `ColorModeToggle.vue` be the single source of truth.

---

## 9. LOW: Inconsistent "Date" in Seed Data

All seed data uses `2026-05-22` (hardcoded). The app will always show "0 sessions today" unless it happens to be run on May 22, 2026.

**Recommendation:** Use `dayjs().format('YYYY-MM-DD')` for today's date in seed data, or document that seed data is date-anchored for demo purposes.

---

## 10. LOW: No Error Boundaries / `error.vue`

Nuxt requires an `error.vue` at the project root for proper error handling. Without it, uncaught errors render a blank white page.

**Fix:** Create `error.vue` with a user-friendly error message.

---

## Priority Action Checklist

| Priority | Action | Effort |
|----------|--------|--------|
| 🔴 P0 | Fix `app.vue` to stop using deprecated `useUserStore` | 5 min |
| 🔴 P0 | Unify data layer — pick `useDataService` or Dexie, not both | 1-2 hr |
| 🔴 P0 | Fix auth ID mismatch — migrate dashboard pages from `useUserStore` to `useAuth` | 30 min |
| 🟡 P1 | Add missing `handleSubmit` to `login.vue` | 2 min |
| 🟡 P1 | Create `public/favicon.svg` | 2 min |
| 🟡 P1 | Remove duplicate dark mode logic from `app.vue` | 2 min |
| 🟢 P2 | Remove `lib` from `imports.dirs` | 1 min |
| 🟢 P2 | Remove unused `useSyncQueue.ts` or wire it in | 5 min |
| 🟢 P2 | Make seed data dates relative to `dayjs()` | 10 min |
| 🟢 P2 | Create `error.vue` | 5 min |
