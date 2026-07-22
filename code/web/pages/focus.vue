<template>
  <div class="animate-in">
    <h1 class="mb-6 font-display text-display-sm text-ink dark:text-on-dark">{{ t('focus.title') }}</h1>

    <div v-if="focusStore.isIdle" class="grid gap-6 lg:grid-cols-3 lg:items-start">
      <div class="card lg:col-span-2 space-y-6">
        <div>
          <label class="block mb-2 text-xs font-medium uppercase tracking-wider text-ink-muted dark:text-on-dark-soft">{{ t('focus.durationLabel') }}</label>
          <div class="flex gap-2">
            <button v-for="d in durations" :key="d.label" @click="selectedDuration = d.seconds"
              class="flex-1 rounded-md border px-3 py-2 text-sm font-medium transition-colors"
              :class="selectedDuration === d.seconds ? 'border-primary bg-primary/10 text-primary dark:bg-primary/20' : 'border-hairline dark:border-hairline-dark text-ink dark:text-on-dark hover:bg-canvas-card dark:hover:bg-surface-dark-soft'">
              {{ d.label }}
            </button>
          </div>
        </div>
        <div>
          <label class="block mb-2 text-xs font-medium uppercase tracking-wider text-ink-muted dark:text-on-dark-soft">{{ t('focus.linkedTaskLabel') }}</label>
          <select v-model="selectedTaskId" class="input">
            <option :value="null">{{ t('focus.linkedTaskNone') }}</option>
            <option v-for="t2 in taskStore.inProgressTasks" :key="t2.id" :value="t2.id">{{ t2.title }}</option>
          </select>
          <p v-if="taskStore.inProgressTasks.length === 0" class="mt-1.5 text-2xs text-ink-soft dark:text-on-dark-soft/70">
            {{ t('focus.linkedTaskHint') }}
          </p>
        </div>
        <AmbientPlayer v-model="selectedAmbient" />
        <button @click="startSession" class="btn-primary w-full">{{ t('focus.beginSession') }}</button>
      </div>
      <div class="card">
        <h2 class="mb-3 font-display text-lg text-ink dark:text-on-dark">{{ t('focus.recentSessions') }}</h2>
        <div v-if="recentSessions.length === 0" class="py-4 text-center text-xs text-ink-soft dark:text-on-dark-soft/70">{{ t('focus.noRecentSessions') }}</div>
        <div v-else class="space-y-2">
          <div v-for="s in recentSessions.slice(0, 5)" :key="s.id" class="rounded-md border border-hairline dark:border-hairline-dark p-3 text-sm">
            <p class="font-medium text-ink dark:text-on-dark">{{ Math.round((s.durationActual ?? s.durationPlanned) / 60) }}m</p>
            <p class="mt-0.5 text-ink-soft dark:text-on-dark-soft">{{ dayjs(s.startTime).format('MMM D, HH:mm') }}</p>
            <p v-if="s.emotionLabel" class="mt-0.5 text-ink-body dark:text-on-dark-soft">{{ t('emotion.' + s.emotionLabel) }}</p>
          </div>
        </div>
      </div>
    </div>

    <div v-if="focusStore.isRunning || focusStore.isPaused" class="max-w-lg mx-auto space-y-6">
      <div class="h-2 rounded-full bg-hairline dark:bg-hairline-dark overflow-hidden">
        <div class="h-full rounded-full bg-primary transition-all duration-1000" :style="{ width: `${focusStore.progress * 100}%` }" />
      </div>
      <div class="text-center">
        <p class="font-mono text-6xl font-normal tabular-nums text-ink dark:text-on-dark tracking-tight">{{ focusStore.displayTime }}</p>
        <p class="mt-2 text-xs uppercase tracking-wider text-ink-soft dark:text-on-dark-soft">{{ focusStore.isPaused ? t('focus.statusPaused') : t('focus.statusRunning') }}</p>
      </div>
      <div class="flex justify-center gap-3">
        <button v-if="focusStore.isRunning" @click="focusStore.pause()" class="btn-outline">{{ t('focus.pause') }}</button>
        <button v-if="focusStore.isPaused" @click="focusStore.resume()" class="btn-primary">{{ t('focus.resume') }}</button>
        <button @click="confirmEnd" class="btn-danger">{{ t('focus.endSession') }}</button>
      </div>
      <div class="card text-sm space-y-3">
        <p class="text-ink-body dark:text-on-dark-soft"><span class="font-medium text-ink dark:text-on-dark">{{ t('focus.taskLabel') }}</span> {{ focusStore.taskTitle || t('focus.taskNone') }}</p>
        <AmbientPlayer :model-value="focusStore.ambientTrack" @update:model-value="focusStore.ambientTrack = $event" />
      </div>
    </div>

    <div v-if="focusStore.isFinished" class="max-w-lg mx-auto card animate-in space-y-4">
      <h2 class="font-display text-lg text-ink dark:text-on-dark">{{ t('focus.sessionComplete') }}</h2>
      <p class="text-sm text-ink-body dark:text-on-dark-soft">{{ t('focus.focusedForMinutes', { minutes: Math.round((focusStore.initialDuration - focusStore.remaining) / 60) }) }}</p>

      <!-- Step 1: only asked when a task is linked — decides whether we also collect a task review below. -->
      <div v-if="focusStore.taskId && taskDoneAnswer === null" class="space-y-3">
        <p class="text-sm text-ink-body dark:text-on-dark-soft">{{ t('focus.taskDoneQuestion', { title: focusStore.taskTitle || '' }) }}</p>
        <div class="flex gap-2">
          <button @click="taskDoneAnswer = 'no'" class="btn-outline flex-1">{{ t('focus.notYet') }}</button>
          <button @click="taskDoneAnswer = 'yes'" class="btn-primary flex-1">{{ t('focus.yesDone') }}</button>
        </div>
        <div class="text-right">
          <button @click="skipJournal" class="text-xs text-ink-soft dark:text-on-dark-soft/70 hover:underline">{{ t('focus.skipSession') }}</button>
        </div>
      </div>

      <template v-if="!focusStore.taskId || taskDoneAnswer !== null">
        <div v-if="taskDoneAnswer === 'yes'">
          <label class="block mb-1.5 text-xs font-medium text-ink-muted dark:text-on-dark-soft">{{ t('focus.taskFeelingLabel', { title: focusStore.taskTitle || '' }) }}</label>
          <textarea v-model="taskReviewText" class="input" rows="3" :placeholder="t('focus.taskFeelingPlaceholder')" />
        </div>
        <div>
          <label class="block mb-1.5 text-xs font-medium text-ink-muted dark:text-on-dark-soft">{{ taskDoneAnswer === 'yes' ? t('focus.sessionFeelingLabelAfterTask') : t('focus.sessionFeelingLabel') }}</label>
          <textarea v-model="journalText" class="input" rows="4" :placeholder="t('focus.sessionFeelingPlaceholder')" />
        </div>
        <div v-if="journalText.length > 10" class="rounded-md border border-hairline dark:border-hairline-dark p-3 text-sm">
          <p v-if="detecting" class="text-ink-soft dark:text-on-dark-soft">{{ t('focus.analyzing') }}</p>
          <div v-else-if="emotionResult" class="space-y-1">
            <p class="text-ink dark:text-on-dark">{{ t('focus.detectedMood') }} <span class="font-semibold">{{ t('emotion.' + emotionResult.label) }}</span> <span class="text-ink-soft dark:text-on-dark-soft">({{ (emotionResult.confidence * 100).toFixed(0) }}%)</span></p>
          </div>
        </div>
        <div v-if="recommendations.length > 0" class="rounded-md border border-hairline dark:border-hairline-dark p-3 space-y-2">
          <p class="text-xs font-medium uppercase tracking-wider text-ink-muted dark:text-on-dark-soft">{{ t('focus.recommendedContent') }}</p>
          <div v-for="rec in recommendations" :key="rec.id" class="text-sm">
            <p class="font-medium text-ink dark:text-on-dark">{{ rec.title }}</p>
            <p class="text-xs text-ink-soft dark:text-on-dark-soft">{{ rec.source }} &middot; {{ rec.type }}</p>
          </div>
        </div>
        <p v-if="saveError" class="text-sm text-error dark:text-error">{{ saveError }}</p>
        <div class="flex justify-end gap-2">
          <button @click="skipJournal" class="btn-ghost">{{ t('focus.skip') }}</button>
          <button @click="saveJournal" class="btn-primary" :disabled="saveDisabled">{{ saving ? t('focus.saving') : t('focus.saveAndFinish') }}</button>
        </div>
      </template>
    </div>
  </div>
</template>

<script setup lang="ts">
import { useAuth } from '~/composables/useAuth'
import { useFocusStore } from '~/stores/focus.store'
import { useTaskStore } from '~/stores/task.store'
import { useDataService } from '~/composables/useDataService'
import { useEmotionDetector } from '~/composables/useEmotionDetector'
import { useRAG } from '~/composables/useRAG'
import { useAmbientSound } from '~/composables/useAmbientSound'
import dayjs from 'dayjs'

definePageMeta({ middleware: ['auth'] })

const { currentUser } = useAuth()
const focusStore = useFocusStore()
const taskStore = useTaskStore()
const { getSessions } = useDataService()
const { detect, detecting, result: emotionResult } = useEmotionDetector()
const { getRecommendations } = useRAG()
const { t } = useLocale()

const selectedDuration = ref(25 * 60)
const selectedTaskId = ref<string | null>(null)
const selectedAmbient = ref<string | null>(null)
const journalText = ref('')
const recommendations = ref<any[]>([])
const recentSessions = ref<any[]>([])
const saveError = ref('')
const saving = ref(false)

// null = not answered yet (only relevant when a task is linked); 'no' = still working on
// it, only the session gets a feelings prompt; 'yes' = also collect a task review and mark
// the task completed on save.
const taskDoneAnswer = ref<'yes' | 'no' | null>(null)
const taskReviewText = ref('')
const saveDisabled = computed(() => {
  if (saving.value || !journalText.value.trim()) return true
  if (taskDoneAnswer.value === 'yes' && !taskReviewText.value.trim()) return true
  return false
})

const durations = [{ label: '15m', seconds: 15 * 60 }, { label: '25m', seconds: 25 * 60 }, { label: '45m', seconds: 45 * 60 }]

// Ambient audio follows the timer lifecycle -- xử lý ở app.vue (luôn mount, sống qua
// điều hướng trang) chứ KHÔNG ở đây, để nhạc không bị dừng khi rời trang Focus sang
// dashboard/tasks/agent giữa phiên đang chạy. app.vue cũng theo dõi luôn
// focusStore.ambientTrack để đổi bài ngay khi user chọn track khác lúc đang running.
const ambient = useAmbientSound()

onMounted(async () => {
  await taskStore.fetchTasks()
  recentSessions.value = await getSessions()
  recentSessions.value.sort((a: any, b: any) => new Date(b.startTime).getTime() - new Date(a.startTime).getTime())
})

function startSession() {
  ambient.stopPreview() // tránh preview + nhạc phiên phát chồng khi bấm Begin ngay sau khi nghe thử
  const title = selectedTaskId.value ? (taskStore.tasks.find(t2 => t2.id === selectedTaskId.value)?.title ?? undefined) : undefined
  taskDoneAnswer.value = null; taskReviewText.value = '' // clear any leftover state from a previous session
  focusStore.start(selectedDuration.value, selectedTaskId.value ?? undefined, selectedAmbient.value ?? undefined, title)
}
function confirmEnd() { focusStore.endEarly() }

let timer: ReturnType<typeof setTimeout>
watch(journalText, val => { clearTimeout(timer); if (val.length > 10) { timer = setTimeout(async () => { await detect(val); if (emotionResult.value) { focusStore.emotionLabel = emotionResult.value.label; focusStore.emotionConfidence = emotionResult.value.confidence; const recs = await getRecommendations(emotionResult.value.label); recommendations.value = recs.slice(0, 3) } }, 800) } })

async function saveJournal() {
  if (saving.value) return
  saving.value = true; saveError.value = ''
  focusStore.journalText = journalText.value
  try {
    // Mark the linked task completed (with its own review) before the session write —
    // if this fails, the Session Complete screen stays up so the user can retry both.
    if (taskDoneAnswer.value === 'yes' && focusStore.taskId) {
      await taskStore.updateTask(focusStore.taskId, { review: taskReviewText.value.trim() })
      await taskStore.toggleTask(focusStore.taskId)
    }
    await focusStore.saveSession()
  } catch (e: any) {
    // Keep the Session Complete screen so the journal/emotion aren't lost.
    saveError.value = e?.message || t('focus.saveFailedFallback')
    saving.value = false
    return
  }
  navigateTo('/dashboard')
}
function skipJournal() { taskDoneAnswer.value = null; taskReviewText.value = ''; focusStore.reset(); navigateTo('/dashboard') }
</script>
