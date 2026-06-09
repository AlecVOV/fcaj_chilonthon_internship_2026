<template>
  <div class="animate-in space-y-6">
    <div class="mb-6"><h1 class="text-xl font-bold text-neutral-950 dark:text-dark-text">Profile</h1></div>

    <!-- Account Info + Change Password -->
    <div class="card">
      <h2 class="text-base font-semibold text-neutral-950 dark:text-dark-text mb-4">Account Information</h2>
      <div class="grid gap-3 sm:grid-cols-2 mb-4">
        <div><p class="text-2xs font-medium uppercase tracking-wider text-neutral-950/40 dark:text-white/25">Name</p><p class="mt-1 text-sm font-medium text-neutral-950 dark:text-dark-text">{{ currentUser?.name || '--' }}</p></div>
        <div><p class="text-2xs font-medium uppercase tracking-wider text-neutral-950/40 dark:text-white/25">Email</p><p class="mt-1 text-sm text-neutral-950 dark:text-dark-text">{{ currentUser?.email || '--' }}</p></div>
        <div><p class="text-2xs font-medium uppercase tracking-wider text-neutral-950/40 dark:text-white/25">Role</p><p class="mt-1 text-sm text-neutral-950 dark:text-dark-text capitalize">{{ currentUser?.role || '--' }}</p></div>
        <div><p class="text-2xs font-medium uppercase tracking-wider text-neutral-950/40 dark:text-white/25">Status</p><p class="mt-1 text-sm text-neutral-950 dark:text-dark-text capitalize">{{ currentUser?.status || '--' }}</p></div>
      </div>
      <!-- Change Password -->
      <div class="border-t border-neutral-200 dark:border-dark-border pt-4">
        <h3 class="text-sm font-semibold text-neutral-950 dark:text-dark-text mb-3">Change Password</h3>
        <div class="flex gap-2 flex-wrap">
          <input v-model="cpCurrent" type="password" class="input text-xs flex-1 min-w-[140px]" placeholder="Current password" />
          <input v-model="cpNew" type="password" class="input text-xs flex-1 min-w-[140px]" placeholder="New password (min 6)" />
          <button @click="handleChangePassword" class="btn-primary text-xs" :disabled="!cpCurrent || !cpNew || cpNew.length < 6">Update Password</button>
        </div>
        <p v-if="cpMsg" class="mt-2 text-xs" :class="cpSuccess ? 'text-success dark:text-success-dark' : 'text-critical dark:text-critical-dark'">{{ cpMsg }}</p>
      </div>
    </div>

    <!-- Stats -->
    <div class="grid gap-4 sm:grid-cols-3">
      <div class="card"><p class="text-2xs font-medium uppercase tracking-wider text-neutral-950/40 dark:text-white/25">Total Tasks</p><p class="mt-2 text-2xl font-bold text-neutral-950 dark:text-dark-text">{{ allTasks.length }}</p></div>
      <div class="card"><p class="text-2xs font-medium uppercase tracking-wider text-neutral-950/40 dark:text-white/25">Completed</p><p class="mt-2 text-2xl font-bold text-neutral-950 dark:text-dark-text">{{ completedCount }}</p></div>
      <div class="card"><p class="text-2xs font-medium uppercase tracking-wider text-neutral-950/40 dark:text-white/25">Total Focus Time</p><p class="mt-2 text-2xl font-bold text-neutral-950 dark:text-dark-text">{{ totalFocusMinutes }}m</p></div>
    </div>

    <!-- Worklog History -->
    <div class="card">
      <h2 class="text-base font-semibold text-neutral-950 dark:text-dark-text mb-4">Worklog History</h2>
      <div v-if="worklogDays.length === 0" class="py-8 text-center text-sm text-neutral-950/20 dark:text-white/15">No worklog data yet. Complete focus sessions to generate history.</div>
      <div v-else class="space-y-4">
        <div v-for="day in worklogDays" :key="day.date" class="rounded border border-neutral-200 dark:border-dark-border p-4">
          <h3 class="text-sm font-semibold text-neutral-950 dark:text-dark-text mb-2">{{ dayjs(day.date).format('dddd, MMMM D, YYYY') }}</h3>
          <div class="text-neutral-950/70 dark:text-white/40 text-sm">
            <p><strong>Focus Time:</strong> {{ day.totalMinutes }} min across {{ day.sessionsCount }} session(s)</p>
            <p v-if="day.tasksCompleted.length"><strong>Tasks Completed:</strong> {{ day.tasksCompleted.join(', ') }}</p>
            <p v-if="day.dominantMood"><strong>Dominant Mood:</strong> {{ day.dominantMood }}</p>
            <div v-if="day.reviews.length" class="mt-2">
              <p class="text-xs font-medium text-neutral-950/40 dark:text-white/25 uppercase tracking-wider mb-1">Task Reviews</p>
              <ul class="list-disc list-inside text-xs space-y-0.5">
                <li v-for="r in day.reviews" :key="r.taskId"><span class="font-medium">{{ r.title }}:</span> {{ r.review }}</li>
              </ul>
            </div>
            <div v-if="day.journalEntries.length" class="mt-2">
              <p class="text-xs font-medium text-neutral-950/40 dark:text-white/25 uppercase tracking-wider mb-1">Journal Entries</p>
              <div v-for="j in day.journalEntries" :key="j.id" class="text-xs italic border-l-2 border-neutral-200 dark:border-dark-border pl-3 py-1 mb-1">
                "{{ j.text }}" <span v-if="j.emotion" class="text-neutral-950/30 dark:text-white/15 ml-1">({{ j.emotion }})</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { useAuth } from '~/composables/useAuth'
import { useDataService } from '~/composables/useDataService'
import dayjs from 'dayjs'

definePageMeta({ middleware: ['auth'] })

const { currentUser, changePassword } = useAuth()
const { getTasks, getSessions } = useDataService()

const allTasks = ref<any[]>([]); const allSessions = ref<any[]>([])
const cpCurrent = ref(''); const cpNew = ref(''); const cpMsg = ref(''); const cpSuccess = ref(false)

const completedCount = computed(() => allTasks.value.filter(t => t.status === 'completed').length)
const totalFocusMinutes = computed(() => Math.round(allSessions.value.reduce((s, x) => s + (x.durationActual ?? x.durationPlanned ?? 0), 0) / 60))

const worklogDays = computed(() => {
  const map = new Map<string, any>()
  for (const s of allSessions.value) {
    const date = dayjs(s.startTime).format('YYYY-MM-DD')
    if (!map.has(date)) map.set(date, { date, totalMinutes: 0, sessionsCount: 0, tasksCompleted: [] as string[], dominantMood: '', reviews: [] as any[], journalEntries: [] as any[] })
    const day = map.get(date)!
    day.totalMinutes += Math.round((s.durationActual ?? s.durationPlanned ?? 0) / 60); day.sessionsCount++
    if (s.emotionLabel) day.dominantMood = s.emotionLabel
    if (s.journalText) day.journalEntries.push({ id: s.id, text: s.journalText, emotion: s.emotionLabel })
  }
  for (const t of allTasks.value) {
    if (t.status !== 'completed') continue
    const date = dayjs(t.updatedAt).format('YYYY-MM-DD')
    if (!map.has(date)) continue
    const day = map.get(date)!
    day.tasksCompleted.push(t.title)
    if (t.review) day.reviews.push({ taskId: t.id, title: t.title, review: t.review })
  }
  return Array.from(map.values()).sort((a, b) => b.date.localeCompare(a.date)).slice(0, 14)
})

onMounted(async () => { allTasks.value = await getTasks(); allSessions.value = await getSessions() })

async function handleChangePassword() {
  cpMsg.value = ''; cpSuccess.value = false
  try { changePassword(cpNew.value); cpSuccess.value = true; cpMsg.value = 'Password updated successfully.'; cpCurrent.value = ''; cpNew.value = '' }
  catch (e: any) { cpMsg.value = e?.message || 'Failed to update password' }
}
</script>
