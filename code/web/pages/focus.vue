<template>
  <div class="animate-in">
    <h1 class="mb-6 font-display text-display-sm text-ink dark:text-on-dark">Focus Session</h1>

    <div v-if="focusStore.isIdle" class="grid gap-6 lg:grid-cols-3">
      <div class="card lg:col-span-2 space-y-6">
        <div>
          <label class="block mb-2 text-xs font-medium uppercase tracking-wider text-ink-muted dark:text-on-dark-soft">Duration</label>
          <div class="flex gap-2">
            <button v-for="d in durations" :key="d.label" @click="selectedDuration = d.seconds"
              class="flex-1 rounded-md border px-3 py-2 text-sm font-medium transition-colors"
              :class="selectedDuration === d.seconds ? 'border-primary bg-primary/10 text-primary dark:bg-primary/20' : 'border-hairline dark:border-hairline-dark text-ink dark:text-on-dark hover:bg-canvas-card dark:hover:bg-surface-dark-soft'">
              {{ d.label }}
            </button>
          </div>
        </div>
        <div>
          <label class="block mb-2 text-xs font-medium uppercase tracking-wider text-ink-muted dark:text-on-dark-soft">Linked Task (optional)</label>
          <select v-model="selectedTaskId" class="input">
            <option :value="null">None</option>
            <option v-for="t in taskStore.inProgressTasks" :key="t.id" :value="t.id">{{ t.title }}</option>
          </select>
          <p v-if="taskStore.inProgressTasks.length === 0" class="mt-1.5 text-2xs text-ink-soft dark:text-on-dark-soft/70">
            Only in-progress tasks can be linked. Set a task to “In Progress” on the Tasks page first.
          </p>
        </div>
        <AmbientPlayer v-model="selectedAmbient" />
        <button @click="startSession" class="btn-primary w-full">Begin Focus Session</button>
      </div>
      <div class="card">
        <h2 class="mb-3 font-display text-lg text-ink dark:text-on-dark">Recent Sessions</h2>
        <div v-if="recentSessions.length === 0" class="py-4 text-center text-xs text-ink-soft dark:text-on-dark-soft/70">No recent sessions</div>
        <div v-else class="space-y-2">
          <div v-for="s in recentSessions.slice(0, 5)" :key="s.id" class="rounded-md border border-hairline dark:border-hairline-dark p-3 text-sm">
            <p class="font-medium text-ink dark:text-on-dark">{{ Math.round((s.durationActual ?? s.durationPlanned) / 60) }}m</p>
            <p class="mt-0.5 text-ink-soft dark:text-on-dark-soft">{{ dayjs(s.startTime).format('MMM D, HH:mm') }}</p>
            <p v-if="s.emotionLabel" class="mt-0.5 capitalize text-ink-body dark:text-on-dark-soft">{{ s.emotionLabel }}</p>
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
        <p class="mt-2 text-xs uppercase tracking-wider text-ink-soft dark:text-on-dark-soft">{{ focusStore.status }}</p>
      </div>
      <div class="flex justify-center gap-3">
        <button v-if="focusStore.isRunning" @click="focusStore.pause()" class="btn-outline">Pause</button>
        <button v-if="focusStore.isPaused" @click="focusStore.resume()" class="btn-primary">Resume</button>
        <button @click="confirmEnd" class="btn-danger">End Session</button>
      </div>
      <div class="card text-sm space-y-1">
        <p class="text-ink-body dark:text-on-dark-soft"><span class="font-medium text-ink dark:text-on-dark">Task:</span> {{ focusStore.taskTitle || 'None' }}</p>
        <p class="text-ink-body dark:text-on-dark-soft"><span class="font-medium text-ink dark:text-on-dark">Ambient:</span> {{ selectedAmbientLabel || 'Silence' }}</p>
      </div>
    </div>

    <div v-if="focusStore.isFinished" class="max-w-lg mx-auto card animate-in space-y-4">
      <h2 class="font-display text-lg text-ink dark:text-on-dark">Session Complete</h2>
      <p class="text-sm text-ink-body dark:text-on-dark-soft">You focused for {{ Math.round((focusStore.initialDuration - focusStore.remaining) / 60) }} minutes.</p>
      <div>
        <label class="block mb-1.5 text-xs font-medium text-ink-muted dark:text-on-dark-soft">How are you feeling?</label>
        <textarea v-model="journalText" class="input" rows="4" placeholder="I feel..." />
      </div>
      <div v-if="journalText.length > 10" class="rounded-md border border-hairline dark:border-hairline-dark p-3 text-sm">
        <p v-if="detecting" class="text-ink-soft dark:text-on-dark-soft">Analyzing...</p>
        <div v-else-if="emotionResult" class="space-y-1">
          <p class="text-ink dark:text-on-dark">Detected mood: <span class="font-semibold capitalize">{{ emotionResult.label }}</span> <span class="text-ink-soft dark:text-on-dark-soft">({{ (emotionResult.confidence * 100).toFixed(0) }}%)</span></p>
        </div>
      </div>
      <div v-if="recommendations.length > 0" class="rounded-md border border-hairline dark:border-hairline-dark p-3 space-y-2">
        <p class="text-xs font-medium uppercase tracking-wider text-ink-muted dark:text-on-dark-soft">Recommended Content</p>
        <div v-for="rec in recommendations" :key="rec.id" class="text-sm">
          <p class="font-medium text-ink dark:text-on-dark">{{ rec.title }}</p>
          <p class="text-xs text-ink-soft dark:text-on-dark-soft">{{ rec.source }} &middot; {{ rec.type }}</p>
        </div>
      </div>
      <p v-if="saveError" class="text-sm text-error dark:text-error">{{ saveError }}</p>
      <div class="flex justify-end gap-2">
        <button @click="skipJournal" class="btn-ghost">Skip</button>
        <button @click="saveJournal" class="btn-primary" :disabled="!journalText.trim() || saving">{{ saving ? 'Saving...' : 'Save & Finish' }}</button>
      </div>
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

const selectedDuration = ref(25 * 60)
const selectedTaskId = ref<string | null>(null)
const selectedAmbient = ref<string | null>(null)
const journalText = ref('')
const recommendations = ref<any[]>([])
const recentSessions = ref<any[]>([])
const saveError = ref('')
const saving = ref(false)

const ambient = useAmbientSound()
const durations = [{ label: '15m', seconds: 15 * 60 }, { label: '25m', seconds: 25 * 60 }, { label: '45m', seconds: 45 * 60 }]
const ambientLabels: Record<string, string> = { rain: 'Rain', cafe: 'Cafe', waves: 'Waves' }
const selectedAmbientLabel = computed(() => focusStore.ambientTrack ? (ambientLabels[focusStore.ambientTrack] || focusStore.ambientTrack) : 'Silence')

// Ambient audio follows the timer lifecycle (also covers a session restored after reload).
watch(() => focusStore.status, (s) => {
  if (s === 'running') ambient.play(focusStore.ambientTrack)
  else ambient.stop()
}, { immediate: true })
onBeforeUnmount(() => ambient.stop())

onMounted(async () => { await taskStore.fetchTasks(); recentSessions.value = await getSessions(); recentSessions.value.sort((a: any, b: any) => new Date(b.startTime).getTime() - new Date(a.startTime).getTime()) })

function startSession() {
  const title = selectedTaskId.value ? (taskStore.tasks.find(t => t.id === selectedTaskId.value)?.title ?? undefined) : undefined
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
    await focusStore.saveSession()
  } catch (e: any) {
    // Keep the Session Complete screen so the journal/emotion aren't lost.
    saveError.value = e?.message || 'Không lưu được phiên. Kiểm tra kết nối rồi thử lại.'
    saving.value = false
    return
  }
  ambient.stop()
  navigateTo('/dashboard')
}
function skipJournal() { ambient.stop(); focusStore.reset(); navigateTo('/dashboard') }
</script>
