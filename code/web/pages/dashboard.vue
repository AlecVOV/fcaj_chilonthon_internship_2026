<template>
  <div class="space-y-8 animate-in">
    <div>
      <h1 class="font-display text-display-sm text-ink dark:text-on-dark">{{ t('dashboard.greeting', { period: t('dashboard.' + greeting), name }) }}</h1>
      <p class="mt-1.5 text-sm text-ink-muted dark:text-on-dark-soft">{{ dayjs().format('dddd, MMMM D, YYYY') }}</p>
    </div>

    <div v-if="showOfflineToast" class="flex items-center gap-2 rounded-lg border border-warning/30 bg-warning/10 px-4 py-3 text-sm text-warning dark:bg-warning-muted/10 dark:border-warning-muted/30 dark:text-warning">
      <span class="status-dot offline" /> {{ t('dashboard.offlineWarning') }}
    </div>

    <div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      <div class="card">
        <p class="text-2xs font-medium uppercase tracking-wider text-ink-muted dark:text-on-dark-soft">{{ t('dashboard.todaysFocus') }}</p>
        <p class="mt-2 font-display text-2xl text-ink dark:text-on-dark">{{ todayMinutes }}m</p>
        <p class="mt-1 text-xs text-success dark:text-success">{{ t('dashboard.sessionsCount', { n: sessionsToday }) }}</p>
      </div>
      <div class="card">
        <p class="text-2xs font-medium uppercase tracking-wider text-ink-muted dark:text-on-dark-soft">{{ t('dashboard.streak') }}</p>
        <p class="mt-2 font-display text-2xl text-ink dark:text-on-dark">{{ streak }}</p>
        <p class="mt-1 text-xs text-ink-soft dark:text-on-dark-soft">{{ t('dashboard.consecutiveDays') }}</p>
      </div>
      <div class="card">
        <p class="text-2xs font-medium uppercase tracking-wider text-ink-muted dark:text-on-dark-soft">{{ t('dashboard.tasksDone') }}</p>
        <p class="mt-2 font-display text-2xl text-ink dark:text-on-dark">{{ taskStore.completedToday.length }}</p>
        <p class="mt-1 text-xs text-ink-soft dark:text-on-dark-soft">{{ t('dashboard.ofToday', { total: taskStore.totalToday.length }) }}</p>
      </div>
      <div class="card">
        <p class="text-2xs font-medium uppercase tracking-wider text-ink-muted dark:text-on-dark-soft">{{ t('dashboard.mood') }}</p>
        <p class="mt-2 font-display text-2xl text-ink dark:text-on-dark">{{ dominantMood === '--' ? '--' : t('emotion.' + dominantMood) }}</p>
        <p class="mt-1 text-xs text-ink-soft dark:text-on-dark-soft">{{ t('dashboard.fromLastSession') }}</p>
      </div>
    </div>

    <div class="flex flex-wrap gap-3">
      <NuxtLink to="/focus" class="btn-primary">{{ t('dashboard.startFocusSession') }}</NuxtLink>
      <NuxtLink to="/agent" class="btn-outline">{{ t('dashboard.askAgentForTasks') }}</NuxtLink>
      <ExportReportButton />
    </div>

    <div v-if="showAddTask" class="fixed inset-0 z-50 flex items-center justify-center bg-ink/20 backdrop-blur-sm" @click.self="showAddTask = false">
      <div class="card w-full max-w-md animate-in" @click.stop>
        <h2 class="mb-4 font-display text-lg text-ink dark:text-on-dark">{{ t('dashboard.newTask') }}</h2>
        <input ref="taskInput" v-model="newTaskTitle" class="input mb-3" :placeholder="t('dashboard.newTaskPlaceholder')" @keyup.enter="handleAddTask" />
        <div class="flex justify-end gap-2">
          <button @click="showAddTask = false" class="btn-ghost">{{ t('tasks.cancel') }}</button>
          <button @click="handleAddTask" class="btn-primary" :disabled="!newTaskTitle.trim()">{{ t('dashboard.addTask') }}</button>
        </div>
      </div>
    </div>

    <div class="grid gap-6 lg:grid-cols-3">
      <div class="card lg:col-span-2">
        <div class="mb-4 flex items-center justify-between">
          <h2 class="font-display text-lg text-ink dark:text-on-dark">{{ t('dashboard.todaysTasks') }}</h2>
          <NuxtLink to="/tasks" class="link text-sm">{{ t('dashboard.viewAll') }}</NuxtLink>
        </div>
        <TaskList :tasks="taskStore.inProgressTasks.slice(0, 5)" @toggle="taskStore.requestToggle" />
        <p v-if="taskStore.inProgressTasks.length === 0" class="py-8 text-center text-sm text-ink-soft dark:text-on-dark-soft/70">{{ t('dashboard.noInProgressTasks') }}</p>
      </div>
      <div class="card"><FocusTimer /></div>
    </div>

    <!-- Weekly activity — navigable week by week -->
    <div>
      <div class="mb-3 flex items-center justify-between">
        <h2 class="font-display text-lg text-ink dark:text-on-dark">{{ t('dashboard.weeklyActivity') }}</h2>
        <div class="flex items-center gap-1 text-sm">
          <button @click="weekOffset++" class="btn-ghost px-2 py-1" :title="t('dashboard.previousWeek')">←</button>
          <span class="min-w-[150px] text-center text-xs text-ink-body dark:text-on-dark-soft">{{ weekRangeLabel }}</span>
          <button @click="weekOffset = Math.max(0, weekOffset - 1)" :disabled="weekOffset === 0" class="btn-ghost px-2 py-1 disabled:cursor-not-allowed disabled:opacity-30" :title="t('dashboard.nextWeek')">→</button>
        </div>
      </div>
      <div class="grid gap-4 sm:grid-cols-2">
        <div class="card">
          <h3 class="mb-3 text-2xs font-medium uppercase tracking-wider text-ink-muted dark:text-on-dark-soft">{{ t('dashboard.focusTimeChartTitle') }}</h3>
          <ChartBars :data="focusWeek" color="#cc785c" unit="m" />
        </div>
        <div class="card">
          <h3 class="mb-3 text-2xs font-medium uppercase tracking-wider text-ink-muted dark:text-on-dark-soft">{{ t('dashboard.tasksCompletedChartTitle') }}</h3>
          <ChartBars :data="completedWeek" color="#5db872" />
        </div>
      </div>
    </div>

    <!-- Snapshots (current state, not week-based) -->
    <div class="grid gap-4 sm:grid-cols-2">
      <div class="card">
        <h3 class="mb-3 text-2xs font-medium uppercase tracking-wider text-ink-muted dark:text-on-dark-soft">{{ t('dashboard.taskStatusChartTitle') }}</h3>
        <ChartDonut :data="statusData" />
      </div>
      <div class="card">
        <h3 class="mb-3 text-2xs font-medium uppercase tracking-wider text-ink-muted dark:text-on-dark-soft">{{ t('dashboard.openTasksByPriorityChartTitle') }}</h3>
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
const { t } = useLocale()

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
const weekOffset = ref(0) // 0 = last 7 days ending today; +1 = previous week, etc.

// ── Weekly charts (navigable week by week) ─────────────────────────────────
const weekDays = computed(() => Array.from({ length: 7 }, (_, i) => dayjs().subtract(weekOffset.value * 7 + (6 - i), 'day')))
const weekRangeLabel = computed(() => {
  const range = `${weekDays.value[0].format('MMM D')} – ${weekDays.value[6].format('MMM D')}`
  return weekOffset.value === 0 ? `${range} · this week` : range
})
const focusWeek = computed(() => weekDays.value.map((d) => {
  const key = d.format('YYYY-MM-DD')
  const day = allSessions.value.filter(s => dayjs(s.startTime).format('YYYY-MM-DD') === key)
  const mins = Math.round(day.reduce((sum, s) => sum + (s.durationActual ?? s.durationPlanned ?? 0), 0) / 60)
  const parts = day.map(s => Math.round((s.durationActual ?? s.durationPlanned ?? 0) / 60) + 'm')
  const title = day.length
    ? `${d.format('ddd, MMM D')} · ${mins}m · ${day.length} session${day.length > 1 ? 's' : ''} (${parts.join(', ')})`
    : `${d.format('ddd, MMM D')} · 0m`
  return { label: d.format('dd'), value: mins, title }
}))
const completedWeek = computed(() => weekDays.value.map((d) => {
  const key = d.format('YYYY-MM-DD')
  const done = taskStore.tasks.filter(t => t.status === 'completed' && t.completedAt && dayjs(t.completedAt).format('YYYY-MM-DD') === key)
  const names = done.map(t => t.title).slice(0, 6)
  const title = done.length
    ? `${d.format('ddd, MMM D')} · ${done.length} done (${names.join(', ')}${done.length > 6 ? '…' : ''})`
    : `${d.format('ddd, MMM D')} · 0`
  return { label: d.format('dd'), value: done.length, title }
}))
const statusData = computed(() => [
  { label: t('dashboard.statusPending'), value: taskStore.pendingTasks.length, color: '#8e8b82' },
  { label: t('dashboard.statusInProgress'), value: taskStore.inProgressTasks.length, color: '#d4a017' },
  { label: t('dashboard.statusCompleted'), value: taskStore.completedTasks.length, color: '#5db872' },
])
const priorityData = computed(() => {
  const open = taskStore.tasks.filter(x => x.status === 'pending' || x.status === 'in_progress')
  const n = (p: number) => open.filter(x => (x.priority || 0) === p).length
  return [
    { label: t('dashboard.priorityHigh'), value: n(3), color: '#cc785c' },
    { label: t('dashboard.priorityMedium'), value: n(2), color: '#cc785c' },
    { label: t('dashboard.priorityLow'), value: n(1), color: '#cc785c' },
    { label: t('dashboard.priorityNone'), value: n(0), color: '#8e8b82' },
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
