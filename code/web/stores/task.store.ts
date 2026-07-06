// stores/task.store.ts — cloud-only (Supabase public.tasks)
import { defineStore } from 'pinia'
import dayjs from 'dayjs'
import type { Task } from '~/composables/useDataService'
import { getSupabase } from '~/lib/supabaseClient'
import { useUserStore } from '~/stores/user.store'
import { useFocusStore } from '~/stores/focus.store'

/** A task is locked while it is the subject of an active (running/paused) focus session. */
export class TaskLockedError extends Error {
  constructor() { super('This task is locked during its focus session.'); this.name = 'TaskLockedError' }
}

// ── Supabase row ↔ Task mapping (snake_case ↔ camelCase) ───────────────────
function rowToTask(r: any): Task {
  return {
    id: r.id, userId: r.user_id, title: r.title, description: r.description ?? undefined,
    status: r.status, priority: r.priority ?? 0, durationSpent: r.duration_spent ?? 0,
    dueDate: r.due_date ?? undefined, review: r.review ?? undefined,
    completedAt: r.completed_at ?? undefined,
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
  if (t.completedAt !== undefined) row.completed_at = t.completedAt ?? null
  return row
}

export const useTaskStore = defineStore('task', () => {
  const tasks = ref<Task[]>([])
  const isLoading = ref(false)
  const loadError = ref<string | null>(null)

  // Shared "how did that task go?" review prompt, triggered whenever a task is
  // marked complete from any surface (tasks page, dashboard's Today's Tasks, etc.).
  const reviewTarget = ref<Task | null>(null)
  const reviewText = ref('')
  const reviewSaving = ref(false)

  const pendingTasks = computed(() => tasks.value.filter(t => t.status === 'pending'))
  const inProgressTasks = computed(() => tasks.value.filter(t => t.status === 'in_progress'))
  const completedTasks = computed(() => tasks.value.filter(t => t.status === 'completed'))
  const completedToday = computed(() =>
    completedTasks.value.filter(t => t.completedAt && dayjs(t.completedAt).format('YYYY-MM-DD') === dayjs().format('YYYY-MM-DD')),
  )

  /** True when the task is bound to a focus session that is currently running or paused. */
  function isLockedByFocus(taskId: string) {
    const focusStore = useFocusStore()
    return focusStore.taskId === taskId && (focusStore.isRunning || focusStore.isPaused)
  }
  // Tasks that "count" for today = created today OR completed today, so the
  // dashboard's "X of Y today" never shows a done-count larger than the total.
  const totalToday = computed(() => {
    const today = dayjs().format('YYYY-MM-DD')
    return tasks.value.filter(t =>
      dayjs(t.createdAt).format('YYYY-MM-DD') === today
      || (t.status === 'completed' && !!t.completedAt && dayjs(t.completedAt).format('YYYY-MM-DD') === today),
    )
  })

  function sortTasks() {
    const order: Record<string, number> = { pending: 0, in_progress: 1, completed: 2, cancelled: 3 }
    tasks.value.sort((a, b) => (order[a.status] ?? 0) - (order[b.status] ?? 0))
  }

  async function fetchTasks() {
    const userStore = useUserStore()
    if (!userStore.userId) return
    isLoading.value = true
    loadError.value = null
    try {
      const sb = getSupabase()
      const { data, error } = await sb
        .from('tasks')
        .select('*')
        .eq('user_id', userStore.userId)
        .order('created_at', { ascending: false })
      if (error) throw error
      tasks.value = (data || []).map(rowToTask)
      sortTasks()
    } catch (e: any) {
      loadError.value = e?.message || 'Không tải được danh sách task. Kiểm tra kết nối rồi thử lại.'
      console.error('fetchTasks failed:', e?.message || e)
    } finally { isLoading.value = false }
  }

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
    // Can't mark a task complete while its focus session is still active.
    if (task.status !== 'completed' && isLockedByFocus(taskId)) throw new TaskLockedError()
    const newStatus = task.status === 'completed' ? 'pending' : 'completed'
    await applyUpdate(taskId, {
      status: newStatus as Task['status'],
      // Stable completion date for daily mapping (unchanged by later review edits).
      completedAt: newStatus === 'completed' ? new Date().toISOString() : undefined,
    })
  }

  async function updateTask(taskId: string, changes: Partial<Task>) {
    await applyUpdate(taskId, changes)
  }

  /**
   * Entry point for "the user clicked the checkbox" from any UI surface.
   * Completing a task opens the review prompt first; un-completing is immediate.
   */
  function requestToggle(taskId: string) {
    const task = tasks.value.find(t => t.id === taskId)
    if (!task || isLockedByFocus(taskId)) return
    if (task.status === 'completed') {
      toggleTask(taskId).catch(() => {})
      return
    }
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
    } catch { /* locked / failed — don't flip state */ }
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
    // Can't delete a task while its focus session is still active (would break the
    // session's task_id reference and lose the session on save).
    if (isLockedByFocus(taskId)) throw new TaskLockedError()
    const sb = getSupabase()
    const { error } = await sb.from('tasks').delete().eq('id', taskId)
    if (error) throw error
    tasks.value = tasks.value.filter(t => t.id !== taskId)
  }

  return {
    tasks, isLoading, loadError,
    reviewTarget, reviewText, reviewSaving,
    pendingTasks, inProgressTasks, completedTasks, completedToday, totalToday,
    isLockedByFocus,
    fetchTasks, addTask, toggleTask, updateTask, deleteTask,
    requestToggle, saveReview, skipReview, cancelReview,
  }
})
