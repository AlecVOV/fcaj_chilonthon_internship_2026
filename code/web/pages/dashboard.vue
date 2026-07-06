<template>
  <div class="space-y-8 animate-in">
    <div>
      <h1 class="font-display text-display-sm text-ink dark:text-on-dark">Good {{ greeting }}, {{ name }}</h1>
      <p class="mt-1.5 text-sm text-ink-muted dark:text-on-dark-soft">{{ dayjs().format('dddd, MMMM D, YYYY') }}</p>
    </div>

    <div v-if="showOfflineToast" class="flex items-center gap-2 rounded-lg border border-warning/30 bg-warning/10 px-4 py-3 text-sm text-warning dark:bg-warning-muted/10 dark:border-warning-muted/30 dark:text-warning">
      <span class="status-dot offline" /> You are offline. Changes may not be saved until your connection is restored.
    </div>

    <div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      <div class="card">
        <p class="text-2xs font-medium uppercase tracking-wider text-ink-muted dark:text-on-dark-soft">Today's Focus</p>
        <p class="mt-2 font-display text-2xl text-ink dark:text-on-dark">{{ todayMinutes }}m</p>
        <p class="mt-1 text-xs text-success dark:text-success">{{ sessionsToday }} sessions</p>
      </div>
      <div class="card">
        <p class="text-2xs font-medium uppercase tracking-wider text-ink-muted dark:text-on-dark-soft">Streak</p>
        <p class="mt-2 font-display text-2xl text-ink dark:text-on-dark">{{ streak }}</p>
        <p class="mt-1 text-xs text-ink-soft dark:text-on-dark-soft">consecutive days</p>
      </div>
      <div class="card">
        <p class="text-2xs font-medium uppercase tracking-wider text-ink-muted dark:text-on-dark-soft">Tasks Done</p>
        <p class="mt-2 font-display text-2xl text-ink dark:text-on-dark">{{ taskStore.completedToday.length }}</p>
        <p class="mt-1 text-xs text-ink-soft dark:text-on-dark-soft">of {{ taskStore.totalToday.length }} today</p>
      </div>
      <div class="card">
        <p class="text-2xs font-medium uppercase tracking-wider text-ink-muted dark:text-on-dark-soft">Mood</p>
        <p class="mt-2 font-display text-2xl capitalize text-ink dark:text-on-dark">{{ dominantMood }}</p>
        <p class="mt-1 text-xs text-ink-soft dark:text-on-dark-soft">from last session</p>
      </div>
    </div>

    <div class="flex flex-wrap gap-3">
      <NuxtLink to="/focus" class="btn-primary">Start Focus Session</NuxtLink>
      <NuxtLink to="/agent" class="btn-outline">Ask Agent for Tasks</NuxtLink>
      <ExportReportButton />
    </div>

    <div v-if="showAddTask" class="fixed inset-0 z-50 flex items-center justify-center bg-ink/20 backdrop-blur-sm" @click.self="showAddTask = false">
      <div class="card w-full max-w-md animate-in" @click.stop>
        <h2 class="mb-4 font-display text-lg text-ink dark:text-on-dark">New Task</h2>
        <input ref="taskInput" v-model="newTaskTitle" class="input mb-3" placeholder="What do you need to focus on?" @keyup.enter="handleAddTask" />
        <div class="flex justify-end gap-2">
          <button @click="showAddTask = false" class="btn-ghost">Cancel</button>
          <button @click="handleAddTask" class="btn-primary" :disabled="!newTaskTitle.trim()">Add Task</button>
        </div>
      </div>
    </div>

    <div class="grid gap-6 lg:grid-cols-3">
      <div class="card lg:col-span-2">
        <div class="mb-4 flex items-center justify-between">
          <h2 class="font-display text-lg text-ink dark:text-on-dark">Today's Tasks</h2>
          <NuxtLink to="/tasks" class="link text-sm">View all</NuxtLink>
        </div>
        <TaskList :tasks="taskStore.inProgressTasks.slice(0, 5)" @toggle="taskStore.requestToggle" />
        <p v-if="taskStore.inProgressTasks.length === 0" class="py-8 text-center text-sm text-ink-soft dark:text-on-dark-soft/70">No in-progress tasks.</p>
      </div>
      <div class="card"><FocusTimer /></div>
    </div>

    <!-- Analytics charts — computed client-side from tasks + focus sessions -->
    <div class="grid gap-4 sm:grid-cols-2">
      <div class="card">
        <h3 class="mb-3 text-2xs font-medium uppercase tracking-wider text-ink-muted dark:text-on-dark-soft">Focus time · 7 day (minute)</h3>
        <ChartBars :data="focus7d" color="#cc785c" unit="m" />
      </div>
      <div class="card">
        <h3 class="mb-3 text-2xs font-medium uppercase tracking-wider text-ink-muted dark:text-on-dark-soft">Tasks completed · 7 day</h3>
        <ChartBars :data="completed7d" color="#5db872" />
      </div>
      <div class="card">
        <h3 class="mb-3 text-2xs font-medium uppercase tracking-wider text-ink-muted dark:text-on-dark-soft">Task status</h3>
        <ChartDonut :data="statusData" />
      </div>
      <div class="card">
        <h3 class="mb-3 text-2xs font-medium uppercase tracking-wider text-ink-muted dark:text-on-dark-soft">Task open with priority</h3>
        <ChartHBars :data="priorityData" />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { useAuth } from '~/composables/useAuth'
import { useTaskStore } from '~/stores/task.store'
import { useOffline } from '~/composables/useOffline'
import { useDataService } from '~/composables/useDataService'
import dayjs from 'dayjs'

definePageMeta({ middleware: ['auth'] })

const { currentUser } = useAuth()
const taskStore = useTaskStore()
const { getSessions } = useDataService()
const { showOfflineToast } = useOffline()

const showAddTask = ref(false)
const newTaskTitle = ref('')
const taskInput = ref<HTMLInputElement>()

const greeting = computed(() => { const h = new Date().getHours(); if (h < 12) return 'morning'; if (h < 17) return 'afternoon'; return 'evening' })
const name = computed(() => currentUser.value?.name || currentUser.value?.email?.split('@')[0] || 'there')

const todayMinutes = ref(0)
const sessionsToday = ref(0)
const streak = ref(0)
const dominantMood = ref('--')
const allSessions = ref<any[]>([])

// ── Chart data (client-side from tasks + sessions) ────────────────────────
function last7() { return Array.from({ length: 7 }, (_, i) => dayjs().subtract(6 - i, 'day')) }
const focus7d = computed(() => last7().map((d) => {
  const key = d.format('YYYY-MM-DD')
  const mins = Math.round(allSessions.value
    .filter(s => dayjs(s.startTime).format('YYYY-MM-DD') === key)
    .reduce((sum, s) => sum + (s.durationActual ?? s.durationPlanned ?? 0), 0) / 60)
  return { label: d.format('dd'), value: mins }
}))
const completed7d = computed(() => last7().map((d) => {
  const key = d.format('YYYY-MM-DD')
  const n = taskStore.tasks.filter(t => t.status === 'completed' && t.completedAt && dayjs(t.completedAt).format('YYYY-MM-DD') === key).length
  return { label: d.format('dd'), value: n }
}))
const statusData = computed(() => [
  { label: 'Pending', value: taskStore.pendingTasks.length, color: '#8e8b82' },
  { label: 'In Progress', value: taskStore.inProgressTasks.length, color: '#d4a017' },
  { label: 'Completed', value: taskStore.completedTasks.length, color: '#5db872' },
])
const priorityData = computed(() => {
  const open = taskStore.tasks.filter(t => t.status === 'pending' || t.status === 'in_progress')
  const n = (p: number) => open.filter(t => (t.priority || 0) === p).length
  return [
    { label: 'High (P3)', value: n(3), color: '#cc785c' },
    { label: 'Medium (P2)', value: n(2), color: '#cc785c' },
    { label: 'Low (P1)', value: n(1), color: '#cc785c' },
    { label: 'None', value: n(0), color: '#8e8b82' },
  ]
})

onMounted(async () => { await taskStore.fetchTasks(); computeStats() })

function computeStats() {
  getSessions().then((sess: any[]) => {
    allSessions.value = sess
    const today = dayjs().format('YYYY-MM-DD')
    const todaySessions = sess.filter((s: any) => dayjs(s.startTime).format('YYYY-MM-DD') === today)
    sessionsToday.value = todaySessions.length
    todayMinutes.value = Math.round(todaySessions.reduce((sum: number, s: any) => sum + (s.durationActual ?? s.durationPlanned), 0) / 60)
    // Sessions come back newest-first → [0] is the latest session today.
    dominantMood.value = todaySessions[0]?.emotionLabel ?? '--'
    let s = 0; const dates = new Set(sess.map((x: any) => dayjs(x.startTime).format('YYYY-MM-DD')))
    for (let i = 0; i < 365; i++) {
      const d = dayjs().subtract(i, 'day').format('YYYY-MM-DD')
      if (dates.has(d)) s++
      else if (i === 0) continue // today not focused yet — don't zero out a real streak
      else break
    }
    streak.value = s
  }).catch(() => { /* stats stay at defaults — not fatal for the dashboard */ })
}

async function handleAddTask() { const t = newTaskTitle.value.trim(); if (!t) return; await taskStore.addTask(t); newTaskTitle.value = ''; showAddTask.value = false }
watch(showAddTask, v => { if (v) nextTick(() => taskInput.value?.focus()) })
</script>
