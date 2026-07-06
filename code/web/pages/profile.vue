<template>
  <div class="animate-in space-y-6">
    <div class="mb-6"><h1 class="font-display text-display-sm text-ink dark:text-on-dark">Profile</h1></div>

    <!-- Account Info + Change Password -->
    <div class="card">
      <div class="mb-4 flex items-center justify-between">
        <h2 class="font-display text-lg text-ink dark:text-on-dark">Account Information</h2>
        <button v-if="!editingAccount" @click="startEditAccount" class="link text-sm">Edit</button>
      </div>

      <!-- Read-only view -->
      <div v-if="!editingAccount" class="grid gap-3 sm:grid-cols-2 mb-4">
        <div><p class="text-2xs font-medium uppercase tracking-wider text-ink-muted dark:text-on-dark-soft">Name</p><p class="mt-1 text-sm font-medium text-ink dark:text-on-dark">{{ currentUser?.name || '--' }}</p></div>
        <div><p class="text-2xs font-medium uppercase tracking-wider text-ink-muted dark:text-on-dark-soft">Email</p><p class="mt-1 text-sm text-ink dark:text-on-dark">{{ currentUser?.email || '--' }}</p></div>
        <div><p class="text-2xs font-medium uppercase tracking-wider text-ink-muted dark:text-on-dark-soft">Role</p><p class="mt-1 text-sm text-ink dark:text-on-dark capitalize">{{ currentUser?.role || '--' }}</p></div>
        <div><p class="text-2xs font-medium uppercase tracking-wider text-ink-muted dark:text-on-dark-soft">Status</p><p class="mt-1 text-sm text-ink dark:text-on-dark capitalize">{{ currentUser?.status || '--' }}</p></div>
      </div>

      <!-- Edit form (name + email; role/status stay read-only) -->
      <div v-else class="mb-4 space-y-3">
        <div class="grid gap-3 sm:grid-cols-2">
          <div>
            <label class="block mb-1 text-2xs font-medium uppercase tracking-wider text-ink-muted dark:text-on-dark-soft">Name</label>
            <input v-model="accName" class="input" placeholder="Your name" @keyup.enter="saveAccount" />
          </div>
          <div>
            <label class="block mb-1 text-2xs font-medium uppercase tracking-wider text-ink-muted dark:text-on-dark-soft">Email <span class="normal-case text-ink-soft/60">(used for login)</span></label>
            <input v-model="accEmail" type="email" class="input" placeholder="you@example.com" @keyup.enter="saveAccount" />
          </div>
        </div>
        <p class="text-2xs text-ink-soft dark:text-on-dark-soft/70">Changing your email takes effect immediately and updates your login email (the new email must not already be in use).</p>
        <div class="flex justify-end gap-2">
          <button @click="editingAccount = false" class="btn-ghost">Cancel</button>
          <button @click="saveAccount" class="btn-primary" :disabled="accSaving || !accName.trim() || !accEmail.trim()">{{ accSaving ? 'Saving...' : 'Save' }}</button>
        </div>
      </div>

      <p v-if="accMsg" class="mb-4 text-sm" :class="accSuccess ? 'text-success dark:text-success' : 'text-error dark:text-error'">{{ accMsg }}</p>
      <!-- Change Password -->
      <div class="border-t border-hairline dark:border-hairline-dark pt-4">
        <h3 class="text-sm font-medium text-ink dark:text-on-dark mb-3">Change Password</h3>
        <div class="flex gap-2 flex-wrap">
          <input v-model="cpCurrent" type="password" class="input flex-1 min-w-[140px]" placeholder="Current password" />
          <input v-model="cpNew" type="password" class="input flex-1 min-w-[140px]" placeholder="New password (min 6)" />
          <button @click="handleChangePassword" class="btn-primary" :disabled="!cpCurrent || !cpNew || cpNew.length < 6">Update Password</button>
        </div>
        <p v-if="cpMsg" class="mt-2 text-sm" :class="cpSuccess ? 'text-success dark:text-success' : 'text-error dark:text-error'">{{ cpMsg }}</p>
      </div>
    </div>

    <!-- Stats & Worklog (users only — admins see system-wide stats in /admin instead) -->
    <template v-if="!isAdmin">
      <div class="grid gap-4 sm:grid-cols-3">
        <div class="card"><p class="text-2xs font-medium uppercase tracking-wider text-ink-muted dark:text-on-dark-soft">Total Tasks</p><p class="mt-2 font-display text-2xl text-ink dark:text-on-dark">{{ allTasks.length }}</p></div>
        <div class="card"><p class="text-2xs font-medium uppercase tracking-wider text-ink-muted dark:text-on-dark-soft">Completed</p><p class="mt-2 font-display text-2xl text-ink dark:text-on-dark">{{ completedCount }}</p></div>
        <div class="card"><p class="text-2xs font-medium uppercase tracking-wider text-ink-muted dark:text-on-dark-soft">Total Focus Time</p><p class="mt-2 font-display text-2xl text-ink dark:text-on-dark">{{ totalFocusMinutes }}m</p></div>
      </div>

      <div class="card">
        <h2 class="font-display text-lg text-ink dark:text-on-dark mb-4">Worklog History</h2>
        <div v-if="worklogDays.length === 0" class="py-8 text-center text-sm text-ink-soft dark:text-on-dark-soft/70">No worklog data yet. Complete focus sessions to generate history.</div>
        <div v-else class="space-y-4">
          <div v-for="day in worklogDays" :key="day.date" class="rounded-md border border-hairline dark:border-hairline-dark p-4">
            <h3 class="font-display text-base text-ink dark:text-on-dark mb-2">{{ dayjs(day.date).format('dddd, MMMM D, YYYY') }}</h3>
            <div class="text-ink-body dark:text-on-dark-soft text-sm">
              <p><strong>Focus Time:</strong> {{ day.totalMinutes }} min across {{ day.sessionsCount }} session(s)</p>
              <p v-if="day.tasksCompleted.length"><strong>Tasks Completed:</strong> {{ day.tasksCompleted.join(', ') }}</p>
              <p v-if="day.dominantMood"><strong>Dominant Mood:</strong> {{ day.dominantMood }}</p>
              <div v-if="day.reviews.length" class="mt-2">
                <p class="text-xs font-medium text-ink-muted dark:text-on-dark-soft uppercase tracking-wider mb-1">Task Reviews</p>
                <ul class="list-disc list-inside text-xs space-y-0.5">
                  <li v-for="r in day.reviews" :key="r.taskId"><span class="font-medium">{{ r.title }}:</span> {{ r.review }}</li>
                </ul>
              </div>
              <div v-if="day.journalEntries.length" class="mt-2">
                <p class="text-xs font-medium text-ink-muted dark:text-on-dark-soft uppercase tracking-wider mb-1">Journal Entries</p>
                <div v-for="j in day.journalEntries" :key="j.id" class="text-xs italic border-l-2 border-hairline dark:border-hairline-dark pl-3 py-1 mb-1">
                  "{{ j.text }}" <span v-if="j.emotion" class="text-ink-soft dark:text-on-dark-soft ml-1">({{ j.emotion }})</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </template>
  </div>
</template>

<script setup lang="ts">
import { useAuth } from '~/composables/useAuth'
import { useDataService } from '~/composables/useDataService'
import dayjs from 'dayjs'

definePageMeta({ middleware: ['auth'] })

const { currentUser, isAdmin, changePassword, updateAccount } = useAuth()
const { getTasks, getSessions } = useDataService()

const allTasks = ref<any[]>([]); const allSessions = ref<any[]>([])
const cpCurrent = ref(''); const cpNew = ref(''); const cpMsg = ref(''); const cpSuccess = ref(false)
const editingAccount = ref(false)
const accName = ref(''); const accEmail = ref('')
const accMsg = ref(''); const accSuccess = ref(false); const accSaving = ref(false)

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
    const date = dayjs(t.completedAt || t.updatedAt).format('YYYY-MM-DD')
    // Include days that only have completed tasks (no focus session).
    if (!map.has(date)) map.set(date, { date, totalMinutes: 0, sessionsCount: 0, tasksCompleted: [] as string[], dominantMood: '', reviews: [] as any[], journalEntries: [] as any[] })
    const day = map.get(date)!
    day.tasksCompleted.push(t.title)
    if (t.review) day.reviews.push({ taskId: t.id, title: t.title, review: t.review })
  }
  return Array.from(map.values()).sort((a, b) => b.date.localeCompare(a.date)).slice(0, 14)
})

onMounted(async () => { allTasks.value = await getTasks(); allSessions.value = await getSessions() })

function startEditAccount() {
  accName.value = currentUser.value?.name || ''
  accEmail.value = currentUser.value?.email || ''
  accMsg.value = ''; editingAccount.value = true
}

async function saveAccount() {
  if (accSaving.value) return
  const name = accName.value.trim(); const email = accEmail.value.trim()
  if (!name || !email) { accSuccess.value = false; accMsg.value = 'Name and email cannot be empty.'; return }
  accSaving.value = true; accMsg.value = ''
  try {
    const { emailPending } = await updateAccount({ name, email })
    accSuccess.value = true
    accMsg.value = emailPending
      ? 'Saved. New Email Needs Confirmation via link sent to that address before logging in with the new email.'
      : 'Updated Account Information.'
    editingAccount.value = false
  } catch (e: any) {
    accSuccess.value = false
    accMsg.value = e?.message || 'Failed to update account information.'
  } finally {
    accSaving.value = false
  }
}

async function handleChangePassword() {
  cpMsg.value = ''; cpSuccess.value = false
  try {
    if (!cpCurrent.value) { cpMsg.value = 'Please enter your current password'; return }
    if (!cpNew.value || cpNew.value.length < 6) { cpMsg.value = 'New password must be at least 6 characters'; return }
    await changePassword(cpNew.value, cpCurrent.value)
    cpSuccess.value = true; cpMsg.value = 'Password updated successfully.'; cpCurrent.value = ''; cpNew.value = ''
  } catch (e: any) { cpMsg.value = e?.message || 'Failed to update password' }
}
</script>
