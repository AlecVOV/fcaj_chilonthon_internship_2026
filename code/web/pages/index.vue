<template>
  <div class="space-y-6 animate-in">
    <div>
      <h1 class="text-xl font-bold text-neutral-950 dark:text-dark-text">Good {{ greeting }}, {{ name }}</h1>
      <p class="mt-1 text-sm text-neutral-950/40 dark:text-white/30">{{ dayjs().format('dddd, MMMM D, YYYY') }}</p>
    </div>

    <div v-if="showOfflineToast" class="flex items-center gap-2 rounded border border-warning/30 bg-warning/10 px-4 py-2.5 text-sm text-warning dark:bg-warning-dark/10 dark:border-warning-dark/30 dark:text-warning-dark">
      <span class="status-dot offline" /> You are offline. Changes will sync when connection is restored.
    </div>

    <div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      <div class="card">
        <p class="text-2xs font-medium uppercase tracking-wider text-neutral-950/40 dark:text-white/25">Today's Focus</p>
        <p class="mt-2 text-2xl font-bold text-neutral-950 dark:text-dark-text">{{ todayMinutes }}m</p>
        <p class="mt-1 text-xs text-success dark:text-success-dark">{{ sessionsToday }} sessions</p>
      </div>
      <div class="card">
        <p class="text-2xs font-medium uppercase tracking-wider text-neutral-950/40 dark:text-white/25">Streak</p>
        <p class="mt-2 text-2xl font-bold text-neutral-950 dark:text-dark-text">{{ streak }}</p>
        <p class="mt-1 text-xs text-neutral-950/30 dark:text-white/20">consecutive days</p>
      </div>
      <div class="card">
        <p class="text-2xs font-medium uppercase tracking-wider text-neutral-950/40 dark:text-white/25">Tasks Done</p>
        <p class="mt-2 text-2xl font-bold text-neutral-950 dark:text-dark-text">{{ taskStore.completedToday.length }}</p>
        <p class="mt-1 text-xs text-neutral-950/30 dark:text-white/20">of {{ taskStore.totalToday.length }} today</p>
      </div>
      <div class="card">
        <p class="text-2xs font-medium uppercase tracking-wider text-neutral-950/40 dark:text-white/25">Mood</p>
        <p class="mt-2 text-2xl font-bold capitalize text-neutral-950 dark:text-dark-text">{{ dominantMood }}</p>
        <p class="mt-1 text-xs text-neutral-950/30 dark:text-white/20">from last session</p>
      </div>
    </div>

    <div class="flex flex-wrap gap-3">
      <NuxtLink to="/focus" class="btn-primary">Start Focus Session</NuxtLink>
      <NuxtLink to="/agent" class="btn-outline">Ask Agent for Tasks</NuxtLink>
      <ExportReportButton />
    </div>

    <div v-if="showAddTask" class="fixed inset-0 z-50 flex items-center justify-center bg-black/20 backdrop-blur-sm" @click.self="showAddTask = false">
      <div class="card w-full max-w-md animate-in" @click.stop>
        <h2 class="mb-4 text-base font-semibold text-neutral-950 dark:text-dark-text">New Task</h2>
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
          <h2 class="text-base font-semibold text-neutral-950 dark:text-dark-text">Today's Tasks</h2>
          <NuxtLink to="/tasks" class="link text-xs">View all</NuxtLink>
        </div>
        <TaskList :tasks="taskStore.pendingTasks.slice(0, 5)" @toggle="taskStore.toggleTask" />
        <p v-if="taskStore.pendingTasks.length === 0" class="py-8 text-center text-sm text-neutral-950/20 dark:text-white/15">No pending tasks.</p>
      </div>
      <div class="card"><FocusTimer /></div>
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
const name = computed(() => currentUser.value?.email?.split('@')[0] ?? 'there')

const todayMinutes = ref(0)
const sessionsToday = ref(0)
const streak = ref(0)
const dominantMood = ref('--')

onMounted(async () => { await taskStore.fetchTasks(); computeStats() })

function computeStats() {
  getSessions().then(sessions => {
    const today = dayjs().format('YYYY-MM-DD')
    const todaySessions = sessions.filter((s: any) => dayjs(s.startTime).format('YYYY-MM-DD') === today)
    sessionsToday.value = todaySessions.length
    todayMinutes.value = Math.round(todaySessions.reduce((sum: number, s: any) => sum + (s.durationActual ?? s.durationPlanned), 0) / 60)
    dominantMood.value = todaySessions[todaySessions.length - 1]?.emotionLabel ?? '--'
    let s = 0; const dates = new Set(sessions.map((s: any) => dayjs(s.startTime).format('YYYY-MM-DD')))
    for (let i = 0; i < 365; i++) { const d = dayjs().subtract(i, 'day').format('YYYY-MM-DD'); if (dates.has(d)) s++; else break }
    streak.value = s
  })
}

async function handleAddTask() { const t = newTaskTitle.value.trim(); if (!t) return; await taskStore.addTask(t); newTaskTitle.value = ''; showAddTask.value = false }
watch(showAddTask, v => { if (v) nextTick(() => taskInput.value?.focus()) })
</script>
