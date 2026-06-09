# State Management — Pinia Stores (Nuxt 4 / Vue 3)

> **Project:** Focus Mode App (Web-Only)  
> **Framework:** Nuxt 4 + Vue 3  
> **State Library:** Pinia (official Vue 3 store)  
> **Data Fetching:** `useFetch` / `$fetch` (Nuxt built-in) + Supabase SDK  
> **Pattern:** Setup Stores (Composition API style)  

---

## 1. Why Pinia?

| Criterion | Pinia | Vuex 4 | Provide/Inject |
|---|---|---|---|
| **TypeScript support** | ✅ First-class | Partial | Manual |
| **DevTools** | ✅ Vue DevTools | ✅ Vue DevTools | ❌ |
| **Modular stores** | ✅ Multiple stores | Modules | N/A |
| **SSR safety** | ✅ Built-in | Manual | Manual |
| **Bundle size** | ~1.5 KB | ~3 KB | 0 KB |
| **Nuxt integration** | ✅ `@pinia/nuxt` module | ❌ Deprecated | Manual |

✅ Pinia is the official state management for Vue 3. Setup stores (Composition API style) are the recommended pattern.

## 2. Store Architecture

```
┌────────────────────────────────────────────────────┐
│                    Vue Pages                        │
│  const store = useTasksStore()                      │
│  store.tasks  ← reactive                            │
│  store.addTask(...)  ← actions                      │
└───────────────────────┬────────────────────────────┘
                        │
┌───────────────────────▼────────────────────────────┐
│                 Pinia Stores                        │
│                                                     │
│  stores/auth.store.ts     — user, session, role     │
│  stores/tasks.store.ts    — CRUD + sync             │
│  stores/focus.store.ts    — Pomodoro timer state    │
│  stores/dashboard.store.ts— aggregated stats        │
│  stores/sync.store.ts     — sync status, pending    │
│  stores/media.store.ts    — admin media library     │
└───────────────────────┬────────────────────────────┘
                        │
┌───────────────────────▼────────────────────────────┐
│               Services / Composables                 │
│                                                     │
│  services/supabase.service.ts  — DB client          │
│  services/api.service.ts       — Lambda HTTP client │
│  services/sync.service.ts      — Sync queue logic   │
│  database/indexeddb_schema.ts  — Dexie ORM          │
└────────────────────────────────────────────────────┘
```

## 3. Core Store Implementations

### 3.1 Auth Store (`stores/auth.store.ts`)

```typescript
// stores/auth.store.ts
import { defineStore } from 'pinia'
import type { User, Session } from '@supabase/supabase-js'

export const useAuthStore = defineStore('auth', () => {
  const user = ref<User | null>(null)
  const session = ref<Session | null>(null)
  const isAdmin = computed(() => {
    return user.value?.app_metadata?.role === 'admin'
  })
  const isAuthenticated = computed(() => !!user.value)

  async function initialize() {
    const { $supabase } = useNuxtApp()
    const supabase = $supabase as SupabaseClient

    // Restore session from localStorage
    const { data } = await supabase.auth.getSession()
    session.value = data.session
    user.value = data.session?.user ?? null

    // Listen for auth changes
    supabase.auth.onAuthStateChange((_event, newSession) => {
      session.value = newSession
      user.value = newSession?.user ?? null
    })
  }

  async function signIn(email: string, password: string) {
    const { $supabase } = useNuxtApp()
    const supabase = $supabase as SupabaseClient
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) throw error
  }

  async function signUp(email: string, password: string) {
    const { $supabase } = useNuxtApp()
    const supabase = $supabase as SupabaseClient
    const { error } = await supabase.auth.signUp({ email, password })
    if (error) throw error
  }

  async function signOut() {
    const { $supabase } = useNuxtApp()
    const supabase = $supabase as SupabaseClient
    await supabase.auth.signOut()
    user.value = null
    session.value = null
  }

  return {
    user,
    session,
    isAdmin,
    isAuthenticated,
    initialize,
    signIn,
    signUp,
    signOut,
  }
})
```

### 3.2 Tasks Store (`stores/tasks.store.ts`)

```typescript
// stores/tasks.store.ts
import { defineStore } from 'pinia'
import { getDB, type LocalTask } from '~/database/indexeddb_schema'

export const useTasksStore = defineStore('tasks', () => {
  const tasks = ref<LocalTask[]>([])
  const isLoading = ref(false)
  const error = ref<string | null>(null)

  // Getter: filter by status
  const pendingTasks = computed(() =>
    tasks.value.filter((t) => t.status === 'pending')
  )
  const completedTasks = computed(() =>
    tasks.value.filter((t) => t.status === 'completed')
  )
  const inProgressTasks = computed(() =>
    tasks.value.filter((t) => t.status === 'in_progress')
  )

  /** Fetch all tasks for current user from local Dexie DB. */
  async function fetchTasks() {
    const authStore = useAuthStore()
    if (!authStore.user) return

    isLoading.value = true
    try {
      const db = getDB()
      tasks.value = await db.getTasksForUser(authStore.user.id)
    } catch (e: any) {
      error.value = e.message
    } finally {
      isLoading.value = false
    }
  }

  /** Add a new task (optimistic update). */
  async function addTask(title: string, description?: string, priority = 0) {
    const authStore = useAuthStore()
    if (!authStore.user) return

    const newTask: LocalTask = {
      id: crypto.randomUUID(),
      userId: authStore.user.id,
      title,
      description,
      status: 'pending',
      priority,
      durationSpent: 0,
      createdAt: new Date(),
      updatedAt: new Date(),
      isSynced: false,
      syncOperation: 'INSERT',
    }

    // Optimistic update
    tasks.value.unshift(newTask)

    // Persist to Dexie (hooks auto-set sync metadata)
    const db = getDB()
    await db.upsertTask(newTask)

    // Trigger sync if online
    if (navigator.onLine) {
      const { $syncService } = useNuxtApp()
      await ($syncService as any).processQueue()
    }
  }

  /** Toggle task completion. */
  async function toggleTask(taskId: string) {
    const task = tasks.value.find((t) => t.id === taskId)
    if (!task) return

    const newStatus: LocalTask['status'] =
      task.status === 'completed' ? 'pending' : 'completed'

    // Optimistic update
    task.status = newStatus
    task.updatedAt = new Date()
    task.isSynced = false
    task.syncOperation = 'UPDATE'

    // Persist
    const db = getDB()
    await db.upsertTask({ ...task })
  }

  /** Update task fields. */
  async function updateTask(
    taskId: string,
    updates: Partial<Pick<LocalTask, 'title' | 'description' | 'priority' | 'dueDate'>>
  ) {
    const index = tasks.value.findIndex((t) => t.id === taskId)
    if (index === -1) return

    Object.assign(tasks.value[index], updates, {
      updatedAt: new Date(),
      isSynced: false,
      syncOperation: 'UPDATE' as const,
    })

    const db = getDB()
    await db.upsertTask({ ...tasks.value[index] })
  }

  /** Delete a task. */
  async function deleteTask(taskId: string) {
    tasks.value = tasks.value.filter((t) => t.id !== taskId)

    const db = getDB()
    // Enqueue DELETE before removing from local DB
    const task = tasks.value.find((t) => t.id === taskId)
    if (task) {
      await db.enqueueSync('tasks', taskId, 'DELETE', task)
    }
    await db.deleteTask(taskId) // soft-delete
  }

  return {
    tasks,
    isLoading,
    error,
    pendingTasks,
    completedTasks,
    inProgressTasks,
    fetchTasks,
    addTask,
    toggleTask,
    updateTask,
    deleteTask,
  }
})
```

### 3.3 Focus Timer Store (`stores/focus.store.ts`)

```typescript
// stores/focus.store.ts
import { defineStore } from 'pinia'

export type TimerStatus = 'idle' | 'running' | 'paused' | 'finished'

interface FocusState {
  status: TimerStatus
  remaining: number       // seconds
  initialDuration: number // seconds
  sessionStartTime: Date | null
  sessionEndTime: Date | null
  taskId: string | null
  ambientTrack: string | null
}

export const useFocusStore = defineStore('focus', () => {
  const state = reactive<FocusState>({
    status: 'idle',
    remaining: 0,
    initialDuration: 0,
    sessionStartTime: null,
    sessionEndTime: null,
    taskId: null,
    ambientTrack: null,
  })

  let timerInterval: ReturnType<typeof setInterval> | null = null

  // Computed
  const isRunning = computed(() => state.status === 'running')
  const isPaused = computed(() => state.status === 'paused')
  const isFinished = computed(() => state.status === 'finished')
  const progress = computed(() => {
    if (state.initialDuration === 0) return 0
    return 1 - state.remaining / state.initialDuration
  })
  const displayTime = computed(() => {
    const mins = Math.floor(state.remaining / 60)
    const secs = state.remaining % 60
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
  })

  function start(durationSeconds: number, taskId?: string, ambientTrack?: string) {
    stopTimer()
    state.status = 'running'
    state.remaining = durationSeconds
    state.initialDuration = durationSeconds
    state.sessionStartTime = new Date()
    state.sessionEndTime = null
    state.taskId = taskId ?? null
    state.ambientTrack = ambientTrack ?? null

    timerInterval = setInterval(() => tick(), 1000)
  }

  function tick() {
    if (state.remaining <= 1) {
      stopTimer()
      state.status = 'finished'
      state.remaining = 0
      state.sessionEndTime = new Date()
      return
    }
    state.remaining--
  }

  function pause() {
    stopTimer()
    state.status = 'paused'
  }

  function resume() {
    if (state.status !== 'paused') return
    state.status = 'running'
    timerInterval = setInterval(() => tick(), 1000)
  }

  function reset() {
    stopTimer()
    state.status = 'idle'
    state.remaining = 0
    state.initialDuration = 0
    state.sessionStartTime = null
    state.sessionEndTime = null
    state.taskId = null
    state.ambientTrack = null
  }

  function stopTimer() {
    if (timerInterval) {
      clearInterval(timerInterval)
      timerInterval = null
    }
  }

  return {
    state,
    isRunning,
    isPaused,
    isFinished,
    progress,
    displayTime,
    start,
    pause,
    resume,
    reset,
  }
})
```

### 3.4 Sync Status Store (`stores/sync.store.ts`)

```typescript
// stores/sync.store.ts
import { defineStore } from 'pinia'

export const useSyncStore = defineStore('sync', () => {
  const pendingCount = ref(0)
  const lastSyncedAt = ref<Date | null>(null)
  const isSyncing = ref(false)
  const lastError = ref<string | null>(null)

  async function syncNow() {
    isSyncing.value = true
    lastError.value = null

    try {
      const { $syncService } = useNuxtApp()
      const result = await ($syncService as any).processQueue()
      pendingCount.value = await ($syncService as any).pendingCount()
      lastSyncedAt.value = new Date()
    } catch (e: any) {
      lastError.value = e.message
    } finally {
      isSyncing.value = false
    }
  }

  async function refreshPendingCount() {
    const { $syncService } = useNuxtApp()
    pendingCount.value = await ($syncService as any).pendingCount()
  }

  return {
    pendingCount,
    lastSyncedAt,
    isSyncing,
    lastError,
    syncNow,
    refreshPendingCount,
  }
})
```

### 3.5 Dashboard Store (`stores/dashboard.store.ts`)

```typescript
// stores/dashboard.store.ts
import { defineStore } from 'pinia'
import type { LocalDailyWorklog } from '~/database/indexeddb_schema'

export const useDashboardStore = defineStore('dashboard', () => {
  const worklogs = ref<LocalDailyWorklog[]>([])
  const currentStreak = ref(0)
  const weeklyTotalMinutes = ref(0)
  const isLoading = ref(false)

  async function fetchWorklogs(days = 30) {
    const authStore = useAuthStore()
    if (!authStore.user) return

    isLoading.value = true
    try {
      const db = getDB()
      const from = new Date()
      from.setDate(from.getDate() - days)

      worklogs.value = await db.getWorklogsForUser(
        authStore.user.id,
        from.toISOString().split('T')[0]
      )
      computeStats()
    } finally {
      isLoading.value = false
    }
  }

  function computeStats() {
    // Streak: count consecutive days from today backwards
    let streak = 0
    const today = new Date().toISOString().split('T')[0]
    const dates = new Set(worklogs.value.map((w) => w.date))

    for (let i = 0; i < 365; i++) {
      const d = new Date()
      d.setDate(d.getDate() - i)
      if (dates.has(d.toISOString().split('T')[0])) {
        streak++
      } else {
        break
      }
    }
    currentStreak.value = streak

    // Weekly total (last 7 days)
    const weekAgo = new Date()
    weekAgo.setDate(weekAgo.getDate() - 7)
    weeklyTotalMinutes.value = worklogs.value
      .filter((w) => new Date(w.date) >= weekAgo)
      .reduce((sum, w) => sum + w.totalFocusTime, 0) / 60
  }

  return {
    worklogs,
    currentStreak,
    weeklyTotalMinutes,
    isLoading,
    fetchWorklogs,
  }
})
```

## 4. Pinia Setup in Nuxt

```typescript
// nuxt.config.ts
export default defineNuxtConfig({
  modules: ['@pinia/nuxt'],

  pinia: {
    storesDirs: ['./stores/**'],
  },

  imports: {
    dirs: ['stores'], // Auto-import stores
  },
})
```

```json
// package.json (relevant deps)
{
  "dependencies": {
    "pinia": "^2.2.0",
    "@pinia/nuxt": "^0.9.0"
  }
}
```

## 5. Store Testing Pattern (Vitest)

```typescript
// tests/unit/stores/tasks.store.test.ts
import { describe, it, expect, beforeEach } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { useTasksStore } from '~/stores/tasks.store'

// Mock Dexie
vi.mock('~/database/indexeddb_schema', () => ({
  getDB: () => ({
    getTasksForUser: vi.fn().mockResolvedValue([
      { id: '1', title: 'Test Task', status: 'pending', /* ... */ },
    ]),
    upsertTask: vi.fn(),
    deleteTask: vi.fn(),
    enqueueSync: vi.fn(),
  }),
}))

describe('Tasks Store', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  it('fetchTasks populates tasks array', async () => {
    const store = useTasksStore()
    await store.fetchTasks()
    expect(store.tasks).toHaveLength(1)
    expect(store.tasks[0].title).toBe('Test Task')
  })

  it('addTask optimistically adds to tasks array', async () => {
    const store = useTasksStore()
    await store.addTask('New Task')
    expect(store.tasks[0].title).toBe('New Task')
    expect(store.tasks[0].status).toBe('pending')
  })

  it('toggleTask switches status', async () => {
    const store = useTasksStore()
    await store.fetchTasks()
    await store.toggleTask('1')
    expect(store.tasks[0].status).toBe('completed')
  })
})
```
