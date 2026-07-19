# State Management — Pinia Stores (Nuxt 4 / Vue 3)

> Cập nhật 2026-07-13 — §3.3 Ambient audio viết lại đúng kiến trúc thật (file MP3 + watcher ở `app.vue` + preview 15s), thay bản cũ nói "WebAudio synth" đã lỗi thời.

> **Project:** Focus Mode App (Web-Only)  
> **Framework:** Nuxt 4 + Vue 3  
> **State Library:** Pinia (official Vue 3 store)  
> **Data Fetching:** Supabase SDK (cloud-only — mọi read/write đi thẳng Supabase)  
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

> Kiến trúc hiện tại là **cloud-only**: không còn IndexedDB/Dexie, không sync queue, không Last-Write-Wins. Mọi read/write đi thẳng Supabase. Auth là một composable (`useAuth.ts`), **không** phải một Pinia store.

```
┌────────────────────────────────────────────────────┐
│                    Vue Pages                        │
│  const store = useTaskStore()                       │
│  store.tasks  ← reactive                            │
│  store.addTask(...)  ← actions                      │
└───────────────────────┬────────────────────────────┘
                        │
┌───────────────────────▼────────────────────────────┐
│                 Pinia Stores                        │
│                                                     │
│  stores/task.store.ts   — id 'task'; CRUD tasks +   │
│                           luồng review + khóa focus  │
│  stores/focus.store.ts  — Pomodoro timer (real-time │
│                           anchor, chime, notify)    │
│  stores/user.store.ts   — wrapper mỏng quanh useAuth│
└───────────────────────┬────────────────────────────┘
                        │
┌───────────────────────▼────────────────────────────┐
│               Composables / Client                   │
│                                                     │
│  composables/useAuth.ts        — Supabase Auth +    │
│                                  public.users (role,│
│                                  approval status)    │
│  composables/useDataService.ts — read/write chung   │
│                                  (sessions, media,   │
│                                  admin users) +      │
│                                  map snake↔camel     │
│  lib/supabaseClient.ts         — getSupabase() client│
└────────────────────────────────────────────────────┘
```

**Những store/dịch vụ KHÔNG còn tồn tại** (đừng tham chiếu):

- `stores/auth.store.ts` — auth giờ là composable `useAuth.ts`; UI lấy trạng thái qua `useAuth()` (hoặc wrapper `user.store.ts`).
- `stores/sync.store.ts`, `services/sync.service.ts` — đã gỡ toàn bộ sync queue.
- `stores/dashboard.store.ts` — dashboard tính stats **inline** trong `pages/dashboard.vue`.
- `stores/media.store.ts` — màn admin media dùng trực tiếp `useDataService` (getMedia/createMedia/...).
- `database/indexeddb_schema.ts` (Dexie), `lib/db.ts`, `composables/useSyncQueue.ts` — đã xóa.

## 3. Core Store Implementations

### 3.1 Auth — composable `composables/useAuth.ts` (KHÔNG phải store)

Đăng nhập/đăng ký dùng Supabase Auth; phân quyền + duyệt user đọc từ `public.users` (`role`, `status`). State được chia sẻ ở module scope và khôi phục nhanh từ một snapshot `localStorage` (`focus_auth_user`).

```typescript
// composables/useAuth.ts (rút gọn)
import { ref, computed } from 'vue'
import { getSupabase } from '~/lib/supabaseClient'

export interface AuthUser {
  id: string
  email: string
  role: 'admin' | 'user'
  name: string
  status: 'pending' | 'approved' | 'rejected'
}

const currentUser = ref<AuthUser | null>(null)
const isLoading = ref(false)
const authError = ref<string | null>(null)

export function useAuth() {
  if (!import.meta.server && !currentUser.value) restoreSession()

  const isAuthenticated = computed(() => currentUser.value !== null)
  const isAdmin = computed(() => currentUser.value?.role === 'admin')

  async function login(email: string, password: string): Promise<AuthUser> {
    const sb = getSupabase()
    const { data, error } = await sb.auth.signInWithPassword({ email, password })
    if (error) throw error

    // Gate đăng nhập theo public.users.status (admin luôn được phép).
    const { data: profile } = await sb
      .from('users')
      .select('role, status, display_name')
      .eq('id', data.user!.id)
      .single()

    const admin = profile?.role === 'admin'
    const status = (profile?.status as AuthUser['status']) || 'pending'
    if (!admin) {
      if (status === 'pending')  { await sb.auth.signOut(); throw new Error('Your account is pending admin approval.') }
      if (status === 'rejected') { await sb.auth.signOut(); throw new Error('Your account request was rejected.') }
    }

    currentUser.value = {
      id: data.user!.id, email: data.user!.email!,
      role: admin ? 'admin' : 'user',
      name: (profile?.display_name as string) || data.user!.email!.split('@')[0],
      status: admin ? 'approved' : status,
    }
    persistSession()
    return currentUser.value
  }

  async function signUp(name: string, email: string, password?: string) {
    const sb = getSupabase()
    // public.users row được trigger DB tạo với status='pending'.
    const { data, error } = await sb.auth.signUp({
      email, password: password || '', options: { data: { display_name: name } },
    })
    if (error) throw error
    return data
  }

  async function logout() {
    await getSupabase().auth.signOut()
    currentUser.value = null
    navigateTo('/login')
  }

  // Duyệt user (chỉ admin, bảo vệ bởi RLS is_admin()): UPDATE public.users.status.
  async function approveUser(userId: string) {
    const { error } = await getSupabase().from('users').update({ status: 'approved' }).eq('id', userId)
    if (error) throw error
  }
  async function rejectUser(userId: string) {
    const { error } = await getSupabase().from('users').update({ status: 'rejected' }).eq('id', userId)
    if (error) throw error
  }

  return {
    currentUser, isAuthenticated, isAdmin, isLoading, authError,
    signUp, login, logout, approveUser, rejectUser, /* ... */
  }
}
```

`stores/user.store.ts` chỉ là **wrapper mỏng** (DEPRECATED) bọc quanh `useAuth()` để tương thích ngược; nó expose `userId`, `isAuthenticated`, `isAdmin`, `signIn/signUp/signOut`. Code mới nên dùng thẳng `useAuth()`.

### 3.2 Task Store (`stores/task.store.ts`)

`defineStore('task', ...)` — **cloud Supabase trực tiếp** (bảng `public.tasks`), KHÔNG Dexie, KHÔNG optimistic-sync queue. Store map snake_case ↔ camelCase, cung cấp CRUD (`addTask`/`updateTask`/`deleteTask`), một **luồng review dùng chung** (`requestToggle`/`saveReview`/`skipReview`/`cancelReview`) khi đánh dấu hoàn thành, và khóa `isLockedByFocus` + `TaskLockedError` **cả khi hoàn thành lẫn khi xóa** task đang gắn với phiên focus đang chạy/tạm dừng. `fetchTasks` bắt lỗi vào `loadError` (chuỗi thông báo) để trang Tasks hiện banner lỗi + nút **Retry** thay vì fail lặng.

```typescript
// stores/task.store.ts (rút gọn)
import { defineStore } from 'pinia'
import dayjs from 'dayjs'
import type { Task } from '~/composables/useDataService'
import { getSupabase } from '~/lib/supabaseClient'
import { useUserStore } from '~/stores/user.store'
import { useFocusStore } from '~/stores/focus.store'

export class TaskLockedError extends Error {
  constructor() { super('This task is locked during its focus session.'); this.name = 'TaskLockedError' }
}

// Supabase row ↔ Task (snake_case ↔ camelCase)
function rowToTask(r: any): Task {
  return {
    id: r.id, userId: r.user_id, title: r.title, description: r.description ?? undefined,
    status: r.status, priority: r.priority ?? 0, durationSpent: r.duration_spent ?? 0,
    dueDate: r.due_date ?? undefined, review: r.review ?? undefined,
    createdAt: r.created_at, updatedAt: r.updated_at, isSynced: true,
  }
}
function taskToRow(t: Partial<Task>): Record<string, unknown> {
  const row: Record<string, unknown> = {}
  if (t.id !== undefined) row.id = t.id
  if (t.userId !== undefined) row.user_id = t.userId
  if (t.title !== undefined) row.title = t.title
  if (t.description !== undefined) row.description = t.description ?? null
  if (t.status !== undefined) row.status = t.status
  if (t.priority !== undefined) row.priority = t.priority
  if (t.durationSpent !== undefined) row.duration_spent = t.durationSpent
  if (t.dueDate !== undefined) row.due_date = t.dueDate ?? null
  if (t.review !== undefined) row.review = t.review ?? null
  return row
}

export const useTaskStore = defineStore('task', () => {
  const tasks = ref<Task[]>([])
  const isLoading = ref(false)
  const loadError = ref<string | null>(null)  // thông báo lỗi khi tải → banner + Retry

  // Review prompt dùng chung — bật bất cứ khi nào một task được đánh dấu hoàn
  // thành từ bất kỳ màn nào (trang Tasks, widget "Today's Tasks" của dashboard...).
  const reviewTarget = ref<Task | null>(null)
  const reviewText = ref('')
  const reviewSaving = ref(false)

  const pendingTasks    = computed(() => tasks.value.filter(t => t.status === 'pending'))
  const inProgressTasks = computed(() => tasks.value.filter(t => t.status === 'in_progress'))
  const completedTasks  = computed(() => tasks.value.filter(t => t.status === 'completed'))

  /** True khi task đang gắn với phiên focus đang chạy hoặc tạm dừng. */
  function isLockedByFocus(taskId: string) {
    const focusStore = useFocusStore()
    return focusStore.taskId === taskId && (focusStore.isRunning || focusStore.isPaused)
  }

  async function fetchTasks() {
    const userStore = useUserStore()
    if (!userStore.userId) return
    isLoading.value = true
    loadError.value = null
    try {
      const sb = getSupabase()
      const { data, error } = await sb
        .from('tasks').select('*')
        .eq('user_id', userStore.userId)
        .order('created_at', { ascending: false })
      if (error) throw error
      tasks.value = (data || []).map(rowToTask)
    } catch (e: any) {
      loadError.value = e?.message || 'Không tải được danh sách task. Kiểm tra kết nối rồi thử lại.'
      console.error('fetchTasks failed:', e?.message || e)
    } finally { isLoading.value = false }
  }

  /** Tạo task mới — luôn status='pending', insert thẳng Supabase. */
  async function addTask(title: string, description?: string, opts?: { priority?: number; dueDate?: string }) {
    const userStore = useUserStore()
    if (!userStore.userId) return
    const now = new Date().toISOString()
    const task: Task = {
      id: crypto.randomUUID(), userId: userStore.userId, title, description,
      status: 'pending', priority: opts?.priority ?? 0, durationSpent: 0,
      dueDate: opts?.dueDate || undefined,
      createdAt: now, updatedAt: now, isSynced: true,
    }
    const sb = getSupabase()
    const { data, error } = await sb.from('tasks').insert(taskToRow(task)).select().single()
    if (error) throw error
    tasks.value.unshift(data ? rowToTask(data) : task)
  }

  async function toggleTask(taskId: string) {
    const task = tasks.value.find(t => t.id === taskId)
    if (!task) return
    // Không thể đánh dấu hoàn thành khi phiên focus của task còn đang chạy.
    if (task.status !== 'completed' && isLockedByFocus(taskId)) throw new TaskLockedError()
    const newStatus = task.status === 'completed' ? 'pending' : 'completed'
    await applyUpdate(taskId, { status: newStatus as Task['status'] })
  }

  async function updateTask(taskId: string, changes: Partial<Task>) {
    await applyUpdate(taskId, changes)
  }

  // ── Luồng review dùng chung ──────────────────────────────────────────────
  /** "User bấm checkbox" từ bất kỳ màn nào: hoàn thành → mở review trước; bỏ tick → ngay lập tức. */
  function requestToggle(taskId: string) {
    const task = tasks.value.find(t => t.id === taskId)
    if (!task || isLockedByFocus(taskId)) return
    if (task.status === 'completed') { toggleTask(taskId).catch(() => {}); return }
    reviewTarget.value = task
    reviewText.value = task.review || ''
  }
  async function saveReview() {
    const target = reviewTarget.value
    if (!target || !reviewText.value.trim() || reviewSaving.value) return
    reviewSaving.value = true
    try {
      await updateTask(target.id, { review: reviewText.value.trim() })
      await toggleTask(target.id)
    } catch { /* locked / failed — không lật trạng thái */ }
    finally { reviewSaving.value = false }
    reviewTarget.value = null; reviewText.value = ''
  }
  function skipReview() {
    const target = reviewTarget.value
    reviewTarget.value = null; reviewText.value = ''
    if (target) toggleTask(target.id).catch(() => {})
  }
  function cancelReview() { reviewTarget.value = null; reviewText.value = '' }

  async function applyUpdate(taskId: string, changes: Partial<Task>) {
    const task = tasks.value.find(t => t.id === taskId)
    if (!task) return
    const sb = getSupabase()
    const { error } = await sb.from('tasks').update(taskToRow(changes)).eq('id', taskId)
    if (error) throw error
    const idx = tasks.value.findIndex(t => t.id === taskId)
    if (idx >= 0) tasks.value[idx] = { ...task, ...changes, updatedAt: new Date().toISOString() }
  }

  async function deleteTask(taskId: string) {
    // Không xóa được khi phiên focus của task còn đang chạy (tránh vỡ task_id ref khi lưu).
    if (isLockedByFocus(taskId)) throw new TaskLockedError()
    const sb = getSupabase()
    const { error } = await sb.from('tasks').delete().eq('id', taskId)
    if (error) throw error
    tasks.value = tasks.value.filter(t => t.id !== taskId)
  }

  return {
    tasks, isLoading, loadError,
    reviewTarget, reviewText, reviewSaving,
    pendingTasks, inProgressTasks, completedTasks,
    isLockedByFocus,
    fetchTasks, addTask, toggleTask, updateTask, deleteTask,
    requestToggle, saveReview, skipReview, cancelReview,
  }
})
```

Component dùng chung `components/TaskReviewDialog.vue` được đặt trong `layouts/default.vue`, nên hộp review "Task Complete — Review" hoạt động ở mọi trang (trang Tasks lẫn widget "Today's Tasks" của dashboard). Nó bind trực tiếp `taskStore.reviewTarget / reviewText` và gọi `saveReview()` / `skipReview()` / `cancelReview()`.

### 3.3 Focus Timer Store (`stores/focus.store.ts`)

`defineStore('focus', ...)` — Pomodoro timer. Điểm khác biệt cốt lõi so với một bộ đếm "trừ dần mỗi tick":

- **Neo theo mốc thời gian thực (`endAt`)**: thời gian còn lại được suy ra từ `endAt = Date.now() + duration` thay vì đếm tick, nên vẫn chính xác kể cả khi trình duyệt bóp ga timer ở tab nền (interval 250ms tự hiệu chỉnh + listener `visibilitychange` snap lại khi quay về tab).
- **Pause/Resume**: pause "đóng băng" giá trị chính xác rồi bỏ `endAt`; resume tính lại `endAt` từ `remaining`.
- **Hết giờ → chuông + Notification**: `finish()` phát chuông WebAudio (không cần asset) và bắn **Notification trình duyệt** (xin quyền lúc `start()`; bấm thông báo để focus lại tab). `endEarly()` ("End Session" thủ công) cũng coi như finished nhưng KHÔNG kêu chuông.
- **Snapshot `taskTitle`** được lưu lúc start để hiển thị bền vững dù task bị hoàn thành/xóa.
- **Persist/restore phiên qua reload**: mọi thay đổi `status` được ghi vào `localStorage` (key `focus_session`) qua `watch`; lúc khởi tạo store gọi `restore()` để dựng lại phiên đang chạy/tạm dừng/đã xong sau F5 hoặc tab bị discard (running thì tính lại từ `endAt`; nếu đã hết giờ trong lúc đóng tab thì nhảy thẳng màn hoàn thành, bỏ chuông trễ).
- **Lưu phiên** qua `useDataService().createSession()` (→ Supabase `focus_sessions`). `saveSession()` **để lỗi NÉM ra** (không nuốt) để caller giữ màn completion — không mất journal/emotion khi save lỗi.
- **Ambient audio** KHÔNG nằm trong store: composable `composables/useAmbientSound.ts` phát file
  MP3 thật (host S3, chọn từ bảng `ambient_sounds` do admin quản lý — không còn synth WebAudio
  như bản cũ). Watcher play/stop đặt ở **`app.vue`** (root layout, luôn mount) theo dõi
  `focusStore.status`, **KHÔNG** ở `pages/focus.vue` — cố ý, vì `focus.vue` bị Vue hủy mỗi khi
  điều hướng rời trang `/focus` (kể cả khi phiên vẫn `running`), nên nếu đặt watcher ở đó nhạc sẽ
  dừng oan khi qua trang khác. `app.vue` còn theo dõi thêm `focusStore.ambientTrack` (watcher thứ
  2) để **đổi bài ngay khi đang running** mà không cần pause/resume. Store chỉ giữ tên track
  (`ambientTrack`, thực chất là URL file) để lưu vào phiên — không tự phát nhạc.
  Composable còn có `preview(url)`/`stopPreview()`/`previewingUrl` (thêm 2026-07-13) — nghe thử
  15s 1 track bằng `Audio` element RIÊNG, tạm pause track chính trong lúc preview rồi resume lại,
  dùng trong `AmbientPlayer.vue` (cả màn chọn trước khi bắt đầu lẫn màn đang running).

```typescript
// stores/focus.store.ts (rút gọn)
import { defineStore } from 'pinia'
import { useUserStore } from '~/stores/user.store'
import { useDataService } from '~/composables/useDataService'

export type TimerStatus = 'idle' | 'running' | 'paused' | 'finished'

export const useFocusStore = defineStore('focus', () => {
  const status = ref<TimerStatus>('idle')
  const remaining = ref(0)
  const initialDuration = ref(0)
  const sessionStartTime = ref<string | null>(null)
  const sessionEndTime = ref<string | null>(null)
  const taskId = ref<string | null>(null)
  // Snapshot tiêu đề task tại thời điểm start, để phiên vẫn hiện đúng dù task
  // đã hoàn thành / bị xóa / ta điều hướng đi nơi khác.
  const taskTitle = ref<string | null>(null)
  const ambientTrack = ref<string | null>(null)
  const journalText = ref('')
  const emotionLabel = ref<string | null>(null)
  const emotionConfidence = ref<number | null>(null)

  let timerInterval: ReturnType<typeof setInterval> | null = null
  // Mốc wall-clock (ms) mà timer chạm 0. Countdown suy ra từ mốc này — KHÔNG
  // đếm tick — nên vẫn đúng khi tab nền bị bóp ga.
  let endAt: number | null = null
  let visibilityHandler: (() => void) | null = null

  const isRunning  = computed(() => status.value === 'running')
  const isPaused   = computed(() => status.value === 'paused')
  const isFinished = computed(() => status.value === 'finished')
  const isIdle     = computed(() => status.value === 'idle')
  const progress   = computed(() => initialDuration.value === 0 ? 0 : 1 - remaining.value / initialDuration.value)
  const displayTime = computed(() => {
    const mins = Math.floor(remaining.value / 60)
    const secs = remaining.value % 60
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
  })

  function start(durationSeconds: number, selectedTaskId?: string, track?: string, selectedTaskTitle?: string) {
    stopTimer()
    status.value = 'running'; remaining.value = durationSeconds; initialDuration.value = durationSeconds
    sessionStartTime.value = new Date().toISOString(); sessionEndTime.value = null
    taskId.value = selectedTaskId ?? null; taskTitle.value = selectedTaskTitle ?? null
    ambientTrack.value = track ?? null
    journalText.value = ''; emotionLabel.value = null; emotionConfidence.value = null
    endAt = Date.now() + durationSeconds * 1000
    requestNotificationPermission()  // xin quyền Notification ngay lúc Start
    runTimer()
  }

  // Tính lại số giây còn lại từ đồng hồ thực — tự sửa sai kể cả khi interval trễ.
  function tick() {
    if (status.value !== 'running' || endAt === null) return
    const left = Math.max(0, Math.ceil((endAt - Date.now()) / 1000))
    remaining.value = left
    if (left <= 0) finish()
  }

  function runTimer() {
    if (import.meta.server) return
    timerInterval = setInterval(() => tick(), 250)
    // Snap về đúng giờ ngay khi user quay lại tab.
    visibilityHandler = () => { if (!document.hidden) tick() }
    document.addEventListener('visibilitychange', visibilityHandler)
    tick()
  }

  function pause() {
    if (endAt !== null) remaining.value = Math.max(0, Math.ceil((endAt - Date.now()) / 1000))
    status.value = 'paused'; stopTimer(); endAt = null
  }
  function resume() {
    status.value = 'running'
    endAt = Date.now() + remaining.value * 1000
    runTimer()
  }

  function finish() {
    stopTimer(); endAt = null
    status.value = 'finished'; remaining.value = 0
    sessionEndTime.value = new Date().toISOString()
    notifyComplete()  // chuông WebAudio + Notification
  }
  // "End Session" thủ công — coi như finished (journal hiện) nhưng KHÔNG kêu chuông.
  function endEarly() {
    if (endAt !== null) remaining.value = Math.max(0, Math.ceil((endAt - Date.now()) / 1000))
    stopTimer(); endAt = null
    status.value = 'finished'
    sessionEndTime.value = new Date().toISOString()
  }

  function stopTimer() {
    if (timerInterval) { clearInterval(timerInterval); timerInterval = null }
    if (visibilityHandler && !import.meta.server) {
      document.removeEventListener('visibilitychange', visibilityHandler)
      visibilityHandler = null
    }
  }

  // Hết giờ: chuông WebAudio (không cần asset) + Notification trình duyệt.
  function notifyComplete() {
    if (import.meta.server) return
    playChime()
    try {
      if ('Notification' in window && Notification.permission === 'granted') {
        const n = new Notification('Focus session complete 🎉', {
          body: 'Time is up — click to head back and log how it went.',
          icon: '/favicon.ico', tag: 'focus-timer', requireInteraction: true,
        })
        n.onclick = () => { window.focus(); n.close() }
      }
    } catch { /* bị chặn — chuông vẫn kêu */ }
  }

  async function saveSession() {
    const userStore = useUserStore()
    if (!userStore.userId) { reset(); return }
    const now = new Date().toISOString()
    const { createSession } = useDataService()  // → Supabase public.focus_sessions
    // KHÔNG bọc try/catch nuốt lỗi: để createSession NÉM ra, caller giữ màn
    // completion và không mất journal/emotion khi lưu lỗi.
    await createSession({
      userId: userStore.userId,
      taskId: taskId.value ?? undefined,
      startTime: sessionStartTime.value ?? now,
      endTime: sessionEndTime.value ?? now,
      durationPlanned: initialDuration.value,
      durationActual: Math.max(0, initialDuration.value - remaining.value),
      journalText: journalText.value || undefined,
      emotionLabel: emotionLabel.value ?? undefined,
      emotionConfidence: emotionConfidence.value ?? undefined,
      ambientTrack: ambientTrack.value ?? undefined,
    })
    reset()
  }

  // --- Persist across reloads (F5 / tab discard) → localStorage 'focus_session' ---
  const STORAGE_KEY = 'focus_session'

  function persist() {
    if (import.meta.server) return
    if (status.value === 'idle') { localStorage.removeItem(STORAGE_KEY); return }
    localStorage.setItem(STORAGE_KEY, JSON.stringify({
      status: status.value, endAt, remaining: remaining.value,
      initialDuration: initialDuration.value, sessionStartTime: sessionStartTime.value,
      sessionEndTime: sessionEndTime.value,
      taskId: taskId.value, taskTitle: taskTitle.value, ambientTrack: ambientTrack.value,
    }))
  }

  function restore() {
    if (import.meta.server) return
    const raw = localStorage.getItem(STORAGE_KEY); if (!raw) return
    const s = JSON.parse(raw); if (!s?.status || s.status === 'idle') return
    initialDuration.value = s.initialDuration || 0
    sessionStartTime.value = s.sessionStartTime || null
    taskId.value = s.taskId || null; taskTitle.value = s.taskTitle || null
    ambientTrack.value = s.ambientTrack || null
    if (s.status === 'running' && s.endAt) {
      const left = Math.max(0, Math.ceil((s.endAt - Date.now()) / 1000))
      if (left <= 0) {           // hết giờ khi tab đóng → nhảy màn hoàn thành (bỏ chuông trễ)
        status.value = 'finished'; remaining.value = 0
        sessionEndTime.value = s.sessionEndTime || new Date().toISOString()
      } else {
        endAt = s.endAt; status.value = 'running'; remaining.value = left; runTimer()
      }
    } else if (s.status === 'paused') {
      status.value = 'paused'; remaining.value = s.remaining || 0
    } else if (s.status === 'finished') {
      status.value = 'finished'; remaining.value = 0
      sessionEndTime.value = s.sessionEndTime || new Date().toISOString()
    }
  }

  // Dựng lại phiên cũ ngay lần đầu load, rồi giữ localStorage đồng bộ theo status.
  restore()
  watch(status, () => persist())

  // ... playChime(), requestNotificationPermission(), reset() ...

  return {
    status, remaining, initialDuration, sessionStartTime, sessionEndTime,
    taskId, taskTitle, ambientTrack, journalText, emotionLabel, emotionConfidence,
    isRunning, isPaused, isFinished, isIdle, progress, displayTime,
    start, pause, resume, finish, endEarly, reset, saveSession,
  }
})
```

### 3.4 Dữ liệu chung — `composables/useDataService.ts`

Mọi dữ liệu không thuộc CRUD task (focus sessions, media library, admin users) đi qua `useDataService()`. Nó dùng `getSupabase()`, map snake_case ↔ camelCase, và gate theo `isAdmin` (user thường chỉ thấy hàng của mình). Đây là lý do **không cần** `sync.store` / `dashboard.store` / `media.store`:

```typescript
// composables/useDataService.ts (rút gọn)
export function useDataService() {
  const { currentUser, isAdmin } = useAuth()
  const { apiGatewayUrl } = useConfig()
  function uid() { return currentUser.value?.id ?? '' }

  async function getSessions(): Promise<FocusSession[]> {
    const sb = getSupabase()
    let q = sb.from('focus_sessions').select('*').order('start_time', { ascending: false })
    if (!isAdmin.value) q = q.eq('user_id', uid())
    const { data, error } = await q
    if (error) throw new Error(`Cannot load sessions: ${error.message}`)
    return (data || []).map(rowToSession)
  }
  async function createSession(s: Omit<FocusSession, 'id' | 'createdAt' | 'updatedAt' | 'isSynced'>) {
    const sb = getSupabase()
    const { data, error } = await sb.from('focus_sessions')
      .insert(sessionToRow({ ...s, userId: uid() })).select().single()
    if (error) throw error
    return rowToSession(data)
  }

  // Media library: getMedia / createMedia / updateMedia / deleteMedia
  // (admin/media.vue gọi thẳng các hàm này — không có media.store).
  // Embeddings cần AI backend (API Gateway); thiếu URL thì generate* sẽ throw.

  // Admin users: getUsers / updateUserRole / deleteUser.

  return { getTasks, getSessions, createSession, getMedia, createMedia,
           updateMedia, deleteMedia, getUsers, updateUserRole, deleteUser, /* ... */ }
}
```

> **Dashboard:** các thống kê (streak, tổng phút focus, "Today's Tasks"...) được tính **inline** trong `pages/dashboard.vue` từ dữ liệu của `useDataService()` + `useTaskStore`, không qua một store riêng.

## 4. Pinia Setup in Nuxt

```typescript
// nuxt.config.ts (trích phần liên quan)
export default defineNuxtConfig({
  modules: ['@pinia/nuxt', '@nuxtjs/tailwindcss'],

  pinia: {
    storesDirs: ['./stores'],
  },

  imports: {
    dirs: ['composables'], // auto-import composables (useAuth, useDataService, ...)
  },
})
```

Pinia stores trong `stores/**` được auto-import theo tên `defineStore`: `useTaskStore` (`'task'`), `useFocusStore` (`'focus'`), `useUserStore` (`'user'`).

## 5. Store Testing Pattern (Vitest)

> Không còn mock Dexie/IndexedDB. Vì store gọi thẳng Supabase qua `getSupabase()`, hãy mock `~/lib/supabaseClient` (và `~/stores/user.store` để cấp `userId`). Dưới đây là ví dụ cho `task.store`.

```typescript
// tests/unit/stores/task.store.test.ts
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { useTaskStore } from '~/stores/task.store'

// Mock Supabase client (query builder trả về Promise giả).
const rows = [
  { id: '1', user_id: 'u1', title: 'Test Task', status: 'pending', priority: 0,
    duration_spent: 0, created_at: '2026-06-29T00:00:00Z', updated_at: '2026-06-29T00:00:00Z' },
]
vi.mock('~/lib/supabaseClient', () => ({
  getSupabase: () => ({
    from: () => ({
      select: () => ({ eq: () => ({ order: () => Promise.resolve({ data: rows, error: null }) }) }),
      insert: () => ({ select: () => ({ single: () => Promise.resolve({ data: rows[0], error: null }) }) }),
      update: () => ({ eq: () => Promise.resolve({ error: null }) }),
      delete: () => ({ eq: () => Promise.resolve({ error: null }) }),
    }),
  }),
}))

// userId để store biết user hiện tại.
vi.mock('~/stores/user.store', () => ({
  useUserStore: () => ({ userId: 'u1' }),
}))

describe('Task Store', () => {
  beforeEach(() => { setActivePinia(createPinia()) })

  it('fetchTasks nạp mảng tasks từ Supabase', async () => {
    const store = useTaskStore()
    await store.fetchTasks()
    expect(store.tasks).toHaveLength(1)
    expect(store.tasks[0].title).toBe('Test Task')
  })

  it('requestToggle mở review prompt khi hoàn thành task', async () => {
    const store = useTaskStore()
    await store.fetchTasks()
    store.requestToggle('1')
    expect(store.reviewTarget?.id).toBe('1')
  })
})
```
