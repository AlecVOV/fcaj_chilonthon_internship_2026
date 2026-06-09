<template>
  <div class="animate-in">
    <h1 class="mb-6 text-xl font-bold text-neutral-950 dark:text-dark-text">Focus Session</h1>

    <div v-if="focusStore.isIdle || focusStore.isFinished" class="grid gap-6 lg:grid-cols-3">
      <div class="card lg:col-span-2 space-y-6">
        <div>
          <label class="block mb-2 text-xs font-medium uppercase tracking-wider text-neutral-950/40 dark:text-white/25">Duration</label>
          <div class="flex gap-2">
            <button v-for="d in durations" :key="d.label" @click="selectedDuration = d.seconds"
              class="flex-1 rounded border px-3 py-2 text-sm font-medium transition-colors"
              :class="selectedDuration === d.seconds ? 'border-interactive-blue bg-interactive-blue/10 text-interactive-blue dark:bg-interactive-blue/20' : 'border-neutral-200 dark:border-dark-border text-neutral-950 dark:text-dark-text hover:bg-neutral-150 dark:hover:bg-dark-surface'">
              {{ d.label }}
            </button>
          </div>
        </div>
        <div>
          <label class="block mb-2 text-xs font-medium uppercase tracking-wider text-neutral-950/40 dark:text-white/25">Linked Task (optional)</label>
          <select v-model="selectedTaskId" class="input">
            <option :value="null">None</option>
            <option v-for="t in taskStore.pendingTasks" :key="t.id" :value="t.id">{{ t.title }}</option>
          </select>
        </div>
        <AmbientPlayer v-model="selectedAmbient" />
        <button @click="startSession" class="btn-primary w-full">Begin Focus Session</button>
      </div>
      <div class="card">
        <h2 class="mb-3 text-sm font-semibold text-neutral-950 dark:text-dark-text">Recent Sessions</h2>
        <div v-if="recentSessions.length === 0" class="py-4 text-center text-xs text-neutral-950/20 dark:text-white/15">No recent sessions</div>
        <div v-else class="space-y-2">
          <div v-for="s in recentSessions.slice(0, 5)" :key="s.id" class="rounded border border-neutral-200 dark:border-dark-border p-2.5 text-xs">
            <p class="font-medium text-neutral-950 dark:text-dark-text">{{ Math.round((s.durationActual ?? s.durationPlanned) / 60) }}m</p>
            <p class="mt-0.5 text-neutral-950/30 dark:text-white/20">{{ dayjs(s.startTime).format('MMM D, HH:mm') }}</p>
            <p v-if="s.emotionLabel" class="mt-0.5 capitalize text-neutral-950/50 dark:text-white/30">{{ s.emotionLabel }}</p>
          </div>
        </div>
      </div>
    </div>

    <div v-else class="max-w-lg mx-auto space-y-6">
      <div class="h-2 rounded bg-neutral-200 dark:bg-dark-border overflow-hidden">
        <div class="h-full rounded bg-interactive-blue transition-all duration-1000" :style="{ width: `${focusStore.progress * 100}%` }" />
      </div>
      <div class="text-center">
        <p class="text-6xl font-bold tabular-nums text-neutral-950 dark:text-dark-text tracking-tight">{{ focusStore.displayTime }}</p>
        <p class="mt-2 text-xs uppercase tracking-wider text-neutral-950/30 dark:text-white/20">{{ focusStore.status }}</p>
      </div>
      <div class="flex justify-center gap-3">
        <button v-if="focusStore.isRunning" @click="focusStore.pause()" class="btn-outline">Pause</button>
        <button v-if="focusStore.isPaused" @click="focusStore.resume()" class="btn-primary">Resume</button>
        <button @click="confirmEnd" class="btn-danger">End Session</button>
      </div>
      <div class="card text-sm space-y-1">
        <p class="text-neutral-950/50 dark:text-white/30"><span class="font-medium text-neutral-950 dark:text-dark-text">Task:</span> {{ selectedTaskTitle || 'None' }}</p>
        <p class="text-neutral-950/50 dark:text-white/30"><span class="font-medium text-neutral-950 dark:text-dark-text">Ambient:</span> {{ selectedAmbientLabel || 'Silence' }}</p>
      </div>
    </div>

    <div v-if="showJournal" class="max-w-lg mx-auto card animate-in space-y-4">
      <h2 class="text-base font-semibold text-neutral-950 dark:text-dark-text">Session Complete</h2>
      <p class="text-sm text-neutral-950/50 dark:text-white/30">You focused for {{ Math.round((focusStore.initialDuration - focusStore.remaining) / 60) }} minutes.</p>
      <div>
        <label class="block mb-1.5 text-xs font-medium text-neutral-950/50 dark:text-white/30">How are you feeling?</label>
        <textarea v-model="journalText" class="input" rows="4" placeholder="I feel..." />
      </div>
      <div v-if="journalText.length > 10" class="rounded border border-neutral-200 dark:border-dark-border p-3 text-sm">
        <p v-if="detecting" class="text-neutral-950/30 dark:text-white/20">Analyzing...</p>
        <div v-else-if="emotionResult" class="space-y-1">
          <p class="text-neutral-950 dark:text-dark-text">Detected mood: <span class="font-semibold capitalize">{{ emotionResult.label }}</span> <span class="text-neutral-950/30 dark:text-white/20">({{ (emotionResult.confidence * 100).toFixed(0) }}%)</span></p>
        </div>
      </div>
      <div v-if="recommendations.length > 0" class="rounded border border-neutral-200 dark:border-dark-border p-3 space-y-2">
        <p class="text-xs font-medium uppercase tracking-wider text-neutral-950/40 dark:text-white/25">Recommended Content</p>
        <div v-for="rec in recommendations" :key="rec.id" class="text-sm">
          <p class="font-medium text-neutral-950 dark:text-dark-text">{{ rec.title }}</p>
          <p class="text-xs text-neutral-950/30 dark:text-white/20">{{ rec.source }} &middot; {{ rec.type }}</p>
        </div>
      </div>
      <div class="flex justify-end gap-2">
        <button @click="skipJournal" class="btn-ghost">Skip</button>
        <button @click="saveJournal" class="btn-primary" :disabled="!journalText.trim()">Save & Finish</button>
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
const showJournal = ref(false)
const journalText = ref('')
const recommendations = ref<any[]>([])
const recentSessions = ref<any[]>([])

const durations = [{ label: '15m', seconds: 15 * 60 }, { label: '25m', seconds: 25 * 60 }, { label: '45m', seconds: 45 * 60 }]
const selectedTaskTitle = computed(() => { if (!selectedTaskId.value) return null; return taskStore.tasks.find(t => t.id === selectedTaskId.value)?.title ?? null })
const selectedAmbientLabel = computed(() => 'Silence')

onMounted(async () => { await taskStore.fetchTasks(); recentSessions.value = await getSessions(); recentSessions.value.sort((a: any, b: any) => new Date(b.startTime).getTime() - new Date(a.startTime).getTime()) })

function startSession() { focusStore.start(selectedDuration.value, selectedTaskId.value ?? undefined, selectedAmbient.value ?? undefined) }
function confirmEnd() { focusStore.reset(); showJournal.value = true }

let timer: ReturnType<typeof setTimeout>
watch(journalText, val => { clearTimeout(timer); if (val.length > 10) { timer = setTimeout(async () => { await detect(val); if (emotionResult.value) { focusStore.emotionLabel = emotionResult.value.label; focusStore.emotionConfidence = emotionResult.value.confidence; const recs = await getRecommendations(emotionResult.value.label); recommendations.value = recs.slice(0, 3) } }, 800) } })

async function saveJournal() { focusStore.journalText = journalText.value; await focusStore.saveSession(); showJournal.value = false; navigateTo('/') }
function skipJournal() { showJournal.value = false; navigateTo('/') }
</script>
