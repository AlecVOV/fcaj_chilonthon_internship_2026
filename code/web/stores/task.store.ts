// stores/task.store.ts
import { defineStore } from 'pinia'
import dayjs from 'dayjs'
import type { LocalTask } from '~/lib/db'
import { getDB } from '~/lib/db'
import { useUserStore } from '~/stores/user.store'

export const useTaskStore = defineStore('task', () => {
  const tasks = ref<LocalTask[]>([])
  const isLoading = ref(false)

  const pendingTasks = computed(() => tasks.value.filter(t => t.status === 'pending'))
  const inProgressTasks = computed(() => tasks.value.filter(t => t.status === 'in_progress'))
  const completedTasks = computed(() => tasks.value.filter(t => t.status === 'completed'))
  const completedToday = computed(() =>
    completedTasks.value.filter(t => dayjs(t.updatedAt).format('YYYY-MM-DD') === dayjs().format('YYYY-MM-DD')),
  )
  const totalToday = computed(() =>
    tasks.value.filter(t => dayjs(t.createdAt).format('YYYY-MM-DD') === dayjs().format('YYYY-MM-DD')),
  )

  async function fetchTasks() {
    const userStore = useUserStore()
    if (!userStore.userId) return
    isLoading.value = true
    try {
      const db = getDB()
      tasks.value = await db.getTasksForUser(userStore.userId)
      const order: Record<string, number> = { pending: 0, in_progress: 1, completed: 2, cancelled: 3 }
      tasks.value.sort((a, b) => (order[a.status] ?? 0) - (order[b.status] ?? 0))
    } finally { isLoading.value = false }
  }

  async function addTask(title: string, description?: string) {
    const userStore = useUserStore()
    if (!userStore.userId) return
    const now = new Date().toISOString()
    const task: LocalTask = {
      id: crypto.randomUUID(), userId: userStore.userId, title, description,
      status: 'pending', priority: 0, durationSpent: 0,
      createdAt: now, updatedAt: now, isSynced: false, syncOperation: 'INSERT',
    }
    const db = getDB()
    await db.upsertTask(task)
    tasks.value.unshift(task)
  }

  async function toggleTask(taskId: string) {
    const task = tasks.value.find(t => t.id === taskId)
    if (!task) return
    const newStatus = task.status === 'completed' ? 'pending' : 'completed'
    const updated = { ...task, status: newStatus as any, updatedAt: new Date().toISOString(), isSynced: false, syncOperation: 'UPDATE' as const }
    const db = getDB()
    await db.upsertTask(updated)
    const idx = tasks.value.findIndex(t => t.id === taskId)
    if (idx >= 0) tasks.value[idx] = updated
  }

  async function updateTask(taskId: string, changes: Partial<LocalTask>) {
    const task = tasks.value.find(t => t.id === taskId)
    if (!task) return
    const updated = { ...task, ...changes, updatedAt: new Date().toISOString(), isSynced: false, syncOperation: 'UPDATE' as const }
    const db = getDB()
    await db.upsertTask(updated)
    const idx = tasks.value.findIndex(t => t.id === taskId)
    if (idx >= 0) tasks.value[idx] = updated
  }

  async function deleteTask(taskId: string) {
    const db = getDB()
    await db.deleteTask(taskId)
    tasks.value = tasks.value.filter(t => t.id !== taskId)
  }

  return {
    tasks, isLoading,
    pendingTasks, inProgressTasks, completedTasks, completedToday, totalToday,
    fetchTasks, addTask, toggleTask, updateTask, deleteTask,
  }
})
