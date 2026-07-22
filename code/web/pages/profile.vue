<template>
  <div class="animate-in space-y-6">
    <div class="mb-6"><h1 class="font-display text-display-sm text-ink dark:text-on-dark">{{ t('profile.title') }}</h1></div>

    <!-- Account Info + Change Password -->
    <div class="card">
      <div class="mb-4 flex items-center justify-between">
        <h2 class="font-display text-lg text-ink dark:text-on-dark">{{ t('profile.accountInfo') }}</h2>
        <button v-if="!editingAccount" @click="startEditAccount" class="link text-sm">{{ t('profile.edit') }}</button>
      </div>

      <!-- Read-only view -->
      <div v-if="!editingAccount" class="grid gap-3 sm:grid-cols-2 mb-4">
        <div><p class="text-2xs font-medium uppercase tracking-wider text-ink-muted dark:text-on-dark-soft">{{ t('profile.name') }}</p><p class="mt-1 text-sm font-medium text-ink dark:text-on-dark">{{ currentUser?.name || '--' }}</p></div>
        <div><p class="text-2xs font-medium uppercase tracking-wider text-ink-muted dark:text-on-dark-soft">{{ t('profile.email') }}</p><p class="mt-1 text-sm text-ink dark:text-on-dark">{{ currentUser?.email || '--' }}</p></div>
        <div><p class="text-2xs font-medium uppercase tracking-wider text-ink-muted dark:text-on-dark-soft">{{ t('profile.role') }}</p><p class="mt-1 text-sm text-ink dark:text-on-dark capitalize">{{ currentUser?.role || '--' }}</p></div>
        <div><p class="text-2xs font-medium uppercase tracking-wider text-ink-muted dark:text-on-dark-soft">{{ t('profile.status') }}</p><p class="mt-1 text-sm text-ink dark:text-on-dark capitalize">{{ currentUser?.status || '--' }}</p></div>
      </div>

      <!-- Edit form (name + email; role/status stay read-only) -->
      <div v-else class="mb-4 space-y-3">
        <div class="grid gap-3 sm:grid-cols-2">
          <div>
            <label class="block mb-1 text-2xs font-medium uppercase tracking-wider text-ink-muted dark:text-on-dark-soft">{{ t('profile.name') }}</label>
            <input v-model="accName" class="input" :placeholder="t('profile.name')" @keyup.enter="saveAccount" />
          </div>
          <div>
            <label class="block mb-1 text-2xs font-medium uppercase tracking-wider text-ink-muted dark:text-on-dark-soft">{{ t('profile.email') }} <span class="normal-case text-ink-soft/60">{{ t('profile.usedForLogin') }}</span></label>
            <input v-model="accEmail" type="email" class="input" placeholder="you@example.com" @keyup.enter="saveAccount" />
          </div>
        </div>
        <p class="text-2xs text-ink-soft dark:text-on-dark-soft/70">{{ t('profile.emailChangeNote') }}</p>
        <div class="flex justify-end gap-2">
          <button @click="editingAccount = false" class="btn-ghost">{{ t('profile.cancel') }}</button>
          <button @click="saveAccount" class="btn-primary" :disabled="accSaving || !accName.trim() || !accEmail.trim()">{{ accSaving ? t('profile.saving') : t('profile.save') }}</button>
        </div>
      </div>

      <p v-if="accMsg" class="mb-4 text-sm" :class="accSuccess ? 'text-success dark:text-success' : 'text-error dark:text-error'">{{ accMsg }}</p>
      <!-- Change Password -->
      <div class="border-t border-hairline dark:border-hairline-dark pt-4">
        <h3 class="text-sm font-medium text-ink dark:text-on-dark mb-3">{{ t('profile.changePassword') }}</h3>
        <div class="flex gap-2 flex-wrap">
          <input v-model="cpCurrent" type="password" class="input flex-1 min-w-[140px]" :placeholder="t('profile.currentPasswordPlaceholder')" />
          <input v-model="cpNew" type="password" class="input flex-1 min-w-[140px]" :placeholder="t('profile.newPasswordPlaceholder')" />
          <button @click="handleChangePassword" class="btn-primary" :disabled="!cpCurrent || !cpNew || cpNew.length < 6">{{ t('profile.updatePassword') }}</button>
        </div>
        <p v-if="cpMsg" class="mt-2 text-sm" :class="cpSuccess ? 'text-success dark:text-success' : 'text-error dark:text-error'">{{ cpMsg }}</p>
      </div>
    </div>

    <!-- Feedback (users only — admins read feedback in /admin/feedback instead) -->
    <div v-if="!isAdmin" class="card">
      <h2 class="font-display text-lg text-ink dark:text-on-dark mb-1">{{ t('profile.sendFeedback') }}</h2>
      <p class="text-sm text-ink-muted dark:text-on-dark-soft mb-3">{{ t('profile.sendFeedbackDesc') }}</p>
      <textarea
        v-model="fbMessage"
        rows="3"
        class="input w-full resize-none"
        :placeholder="t('profile.feedbackPlaceholder')"
        :disabled="fbSubmitting"
      />
      <div class="mt-2 flex items-center justify-between">
        <p v-if="fbSuccess" class="text-sm text-success dark:text-success">{{ t('profile.feedbackSent') }}</p>
        <p v-else-if="fbError" class="text-sm text-error dark:text-error">{{ fbError }}</p>
        <span v-else />
        <button @click="handleSendFeedback" class="btn-primary" :disabled="fbSubmitting || !fbMessage.trim()">{{ fbSubmitting ? t('profile.sending') : t('profile.send') }}</button>
      </div>
    </div>

    <!-- Stats & Worklog (users only — admins see system-wide stats in /admin instead) -->
    <template v-if="!isAdmin">
      <div class="grid gap-4 sm:grid-cols-3">
        <div class="card"><p class="text-2xs font-medium uppercase tracking-wider text-ink-muted dark:text-on-dark-soft">{{ t('profile.totalTasks') }}</p><p class="mt-2 font-display text-2xl text-ink dark:text-on-dark">{{ allTasks.length }}</p></div>
        <div class="card"><p class="text-2xs font-medium uppercase tracking-wider text-ink-muted dark:text-on-dark-soft">{{ t('profile.completed') }}</p><p class="mt-2 font-display text-2xl text-ink dark:text-on-dark">{{ completedCount }}</p></div>
        <div class="card"><p class="text-2xs font-medium uppercase tracking-wider text-ink-muted dark:text-on-dark-soft">{{ t('profile.totalFocusTime') }}</p><p class="mt-2 font-display text-2xl text-ink dark:text-on-dark">{{ totalFocusMinutes }}m</p></div>
      </div>

      <div class="card">
        <h2 class="font-display text-lg text-ink dark:text-on-dark mb-4">{{ t('profile.worklogHistory') }}</h2>
        <div v-if="worklogDays.length === 0" class="py-8 text-center text-sm text-ink-soft dark:text-on-dark-soft/70">{{ t('profile.noWorklogData') }}</div>
        <div v-else class="space-y-4">
          <div v-for="day in worklogDays" :key="day.date" class="rounded-md border border-hairline dark:border-hairline-dark p-4">
            <div class="mb-2 flex items-center justify-between gap-2">
              <h3 class="font-display text-base text-ink dark:text-on-dark">{{ dayjs(day.date).format('dddd, MMMM D, YYYY') }}</h3>
              <button
                @click="downloadReport(day.date)"
                :disabled="isExporting"
                class="shrink-0 rounded-md border border-hairline dark:border-hairline-dark px-2.5 py-1 text-xs text-ink-muted dark:text-on-dark-soft hover:bg-canvas-card dark:hover:bg-surface-dark-soft disabled:opacity-50"
                :title="t('profile.reportTooltip')"
              >
                {{ t('profile.reportButton') }}
              </button>
            </div>
            <div class="text-ink-body dark:text-on-dark-soft text-sm">
              <p>{{ t('profile.focusTimeLine', { min: day.totalMinutes, count: day.sessionsCount }) }}</p>
              <p v-if="day.tasksCompleted.length">{{ t('profile.tasksCompletedLine', { list: day.tasksCompleted.join(', ') }) }}</p>
              <p v-if="day.dominantMood">{{ t('profile.dominantMoodLine', { mood: t('emotion.' + day.dominantMood) }) }}</p>
              <div v-if="day.reviews.length" class="mt-2">
                <p class="text-xs font-medium text-ink-muted dark:text-on-dark-soft uppercase tracking-wider mb-1">{{ t('profile.taskReviews') }}</p>
                <ul class="list-disc list-inside text-xs space-y-0.5">
                  <li v-for="r in day.reviews" :key="r.taskId"><span class="font-medium">{{ r.title }}:</span> {{ r.review }}</li>
                </ul>
              </div>
              <div v-if="day.journalEntries.length" class="mt-2">
                <p class="text-xs font-medium text-ink-muted dark:text-on-dark-soft uppercase tracking-wider mb-1">{{ t('profile.journalEntries') }}</p>
                <div v-for="j in day.journalEntries" :key="j.id" class="text-xs italic border-l-2 border-hairline dark:border-hairline-dark pl-3 py-1 mb-1">
                  "{{ j.text }}" <span v-if="j.emotion" class="text-ink-soft dark:text-on-dark-soft ml-1">({{ t('emotion.' + j.emotion) }})</span>
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
import { useReportExport } from '~/composables/useReportExport'
import { useFeedback } from '~/composables/useFeedback'
import dayjs from 'dayjs'

definePageMeta({ middleware: ['auth'] })

const { currentUser, isAdmin, changePassword, updateAccount } = useAuth()
const { getTasks, getSessions } = useDataService()
const { downloadReport, isExporting } = useReportExport()
const { isSubmitting: fbSubmitting, submitError: fbError, submitSuccess: fbSuccess, submitFeedback } = useFeedback()
const { t } = useLocale()
const fbMessage = ref('')

const allTasks = ref<any[]>([]); const allSessions = ref<any[]>([])
const cpCurrent = ref(''); const cpNew = ref(''); const cpMsg = ref(''); const cpSuccess = ref(false)
const editingAccount = ref(false)
const accName = ref(''); const accEmail = ref('')
const accMsg = ref(''); const accSuccess = ref(false); const accSaving = ref(false)

const completedCount = computed(() => allTasks.value.filter(t2 => t2.status === 'completed').length)
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
  for (const t2 of allTasks.value) {
    if (t2.status !== 'completed') continue
    const date = dayjs(t2.completedAt || t2.updatedAt).format('YYYY-MM-DD')
    // Include days that only have completed tasks (no focus session).
    if (!map.has(date)) map.set(date, { date, totalMinutes: 0, sessionsCount: 0, tasksCompleted: [] as string[], dominantMood: '', reviews: [] as any[], journalEntries: [] as any[] })
    const day = map.get(date)!
    day.tasksCompleted.push(t2.title)
    if (t2.review) day.reviews.push({ taskId: t2.id, title: t2.title, review: t2.review })
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
  if (!name || !email) { accSuccess.value = false; accMsg.value = t('profile.nameEmailRequired'); return }
  accSaving.value = true; accMsg.value = ''
  try {
    const { emailPending } = await updateAccount({ name, email })
    accSuccess.value = true
    accMsg.value = emailPending ? t('profile.emailPendingMsg') : t('profile.accountUpdated')
    editingAccount.value = false
  } catch (e: any) {
    accSuccess.value = false
    accMsg.value = e?.message || t('profile.accountUpdateFailed')
  } finally {
    accSaving.value = false
  }
}

async function handleSendFeedback() {
  await submitFeedback(fbMessage.value)
  if (fbSuccess.value) fbMessage.value = ''
}

async function handleChangePassword() {
  cpMsg.value = ''; cpSuccess.value = false
  try {
    if (!cpCurrent.value) { cpMsg.value = t('profile.enterCurrentPassword'); return }
    if (!cpNew.value || cpNew.value.length < 6) { cpMsg.value = t('profile.passwordMinLength'); return }
    await changePassword(cpNew.value, cpCurrent.value)
    cpSuccess.value = true; cpMsg.value = t('profile.passwordUpdated'); cpCurrent.value = ''; cpNew.value = ''
  } catch (e: any) { cpMsg.value = e?.message || t('profile.passwordUpdateFailed') }
}
</script>
