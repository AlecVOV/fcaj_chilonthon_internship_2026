// stores/focus.store.ts
import { defineStore } from 'pinia'
import { getDB } from '~/lib/db'
import { useUserStore } from '~/stores/user.store'

export type TimerStatus = 'idle' | 'running' | 'paused' | 'finished'

export const useFocusStore = defineStore('focus', () => {
  const status = ref<TimerStatus>('idle')
  const remaining = ref(0)
  const initialDuration = ref(0)
  const sessionStartTime = ref<string | null>(null)
  const sessionEndTime = ref<string | null>(null)
  const taskId = ref<string | null>(null)
  const ambientTrack = ref<string | null>(null)
  const journalText = ref('')
  const emotionLabel = ref<string | null>(null)
  const emotionConfidence = ref<number | null>(null)
  const recommendations = ref<any[]>([])

  let timerInterval: ReturnType<typeof setInterval> | null = null

  const isRunning = computed(() => status.value === 'running')
  const isPaused = computed(() => status.value === 'paused')
  const isFinished = computed(() => status.value === 'finished')
  const isIdle = computed(() => status.value === 'idle')
  const progress = computed(() => initialDuration.value === 0 ? 0 : 1 - remaining.value / initialDuration.value)
  const displayTime = computed(() => {
    const mins = Math.floor(remaining.value / 60)
    const secs = remaining.value % 60
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
  })

  function start(durationSeconds: number, selectedTaskId?: string, track?: string) {
    stopTimer()
    status.value = 'running'; remaining.value = durationSeconds; initialDuration.value = durationSeconds
    sessionStartTime.value = new Date().toISOString(); sessionEndTime.value = null
    taskId.value = selectedTaskId ?? null; ambientTrack.value = track ?? null
    journalText.value = ''; emotionLabel.value = null; emotionConfidence.value = null
    recommendations.value = []
    timerInterval = setInterval(() => tick(), 1000)
  }

  function tick() { if (remaining.value <= 0) { finish(); return } remaining.value-- }
  function pause() { status.value = 'paused'; stopTimer() }
  function resume() { status.value = 'running'; timerInterval = setInterval(() => tick(), 1000) }
  function finish() { stopTimer(); status.value = 'finished'; sessionEndTime.value = new Date().toISOString() }
  function reset() { stopTimer() }

  function stopTimer() { if (timerInterval) { clearInterval(timerInterval); timerInterval = null } }

  async function saveSession() {
    const userStore = useUserStore()
    if (!userStore.userId) return
    const now = new Date().toISOString()
    const session: any = {
      id: crypto.randomUUID(), userId: userStore.userId, taskId: taskId.value,
      startTime: sessionStartTime.value ?? now, endTime: sessionEndTime.value ?? now,
      durationPlanned: initialDuration.value,
      durationActual: Math.max(0, initialDuration.value - remaining.value),
      journalText: journalText.value, emotionLabel: emotionLabel.value,
      emotionConfidence: emotionConfidence.value, ambientTrack: ambientTrack.value,
      createdAt: now, updatedAt: now, isSynced: false, syncOperation: 'INSERT',
    }
    const db = getDB(); await db.upsertFocusSession(session)
    status.value = 'idle'; remaining.value = 0; initialDuration.value = 0
    sessionStartTime.value = null; sessionEndTime.value = null; taskId.value = null
    ambientTrack.value = null; journalText.value = ''; emotionLabel.value = null
    emotionConfidence.value = null; recommendations.value = []
  }

  return {
    status, remaining, initialDuration, sessionStartTime, sessionEndTime,
    taskId, ambientTrack, journalText, emotionLabel, emotionConfidence, recommendations,
    isRunning, isPaused, isFinished, isIdle, progress, displayTime,
    start, pause, resume, finish, reset, saveSession,
  }
})
