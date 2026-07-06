// stores/focus.store.ts
import { defineStore } from 'pinia'
import { useUserStore } from '~/stores/user.store'
import { useDataService } from '~/composables/useDataService'

export type TimerStatus = 'idle' | 'running' | 'paused' | 'finished'

export const useFocusStore = defineStore('focus', () => {
  const status = ref<TimerStatus>('idle')
  const remaining = ref(0)
  const initialDuration = ref(0)
  const sessionStartTime = ref<string | null>(null)
  const sessionEndTime = ref<string | null>(null)
  const taskId = ref<string | null>(null)
  // Snapshot of the linked task's title taken at start time, so the session
  // keeps showing it even after the task is completed, deleted, or we navigate away.
  const taskTitle = ref<string | null>(null)
  const ambientTrack = ref<string | null>(null)
  const journalText = ref('')
  const emotionLabel = ref<string | null>(null)
  const emotionConfidence = ref<number | null>(null)
  const recommendations = ref<any[]>([])

  let timerInterval: ReturnType<typeof setInterval> | null = null
  // Wall-clock timestamp (ms) at which the running timer should reach 0.
  // The countdown is derived from this anchor — NOT from counting ticks — so it
  // stays accurate even when the browser throttles background-tab timers.
  let endAt: number | null = null
  let visibilityHandler: (() => void) | null = null

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

  function start(durationSeconds: number, selectedTaskId?: string, track?: string, selectedTaskTitle?: string) {
    stopTimer()
    status.value = 'running'; remaining.value = durationSeconds; initialDuration.value = durationSeconds
    sessionStartTime.value = new Date().toISOString(); sessionEndTime.value = null
    taskId.value = selectedTaskId ?? null; taskTitle.value = selectedTaskTitle ?? null
    ambientTrack.value = track ?? null
    journalText.value = ''; emotionLabel.value = null; emotionConfidence.value = null
    recommendations.value = []
    endAt = Date.now() + durationSeconds * 1000
    requestNotificationPermission()
    runTimer()
  }

  // Re-compute the remaining seconds from the real clock. Self-correcting:
  // even if the interval fired late (throttled tab), this returns the true value.
  function tick() {
    if (status.value !== 'running' || endAt === null) return
    const left = Math.max(0, Math.ceil((endAt - Date.now()) / 1000))
    remaining.value = left
    if (left <= 0) finish()
  }

  function runTimer() {
    if (import.meta.server) return
    timerInterval = setInterval(() => tick(), 250)
    // Snap back to the correct time the instant the user returns to the tab.
    visibilityHandler = () => { if (!document.hidden) tick() }
    document.addEventListener('visibilitychange', visibilityHandler)
    tick()
  }

  function pause() {
    // Freeze at the precise current value before discarding the anchor.
    if (endAt !== null) remaining.value = Math.max(0, Math.ceil((endAt - Date.now()) / 1000))
    status.value = 'paused'; stopTimer(); endAt = null
  }

  function resume() {
    status.value = 'running'
    endAt = Date.now() + remaining.value * 1000
    runTimer()
  }

  function finish() {
    stopTimer(); endAt = null
    status.value = 'finished'; remaining.value = 0
    sessionEndTime.value = new Date().toISOString()
    notifyComplete()
  }

  // Manual "End Session" — counts as finished (so the journal shows) but does
  // NOT fire the chime/notification, since the user is already here.
  function endEarly() {
    if (endAt !== null) remaining.value = Math.max(0, Math.ceil((endAt - Date.now()) / 1000))
    stopTimer(); endAt = null
    status.value = 'finished'
    sessionEndTime.value = new Date().toISOString()
  }

  function reset() {
    stopTimer(); endAt = null
    status.value = 'idle'; remaining.value = 0; initialDuration.value = 0
    sessionStartTime.value = null; sessionEndTime.value = null; taskId.value = null
    taskTitle.value = null
    ambientTrack.value = null; journalText.value = ''; emotionLabel.value = null
    emotionConfidence.value = null; recommendations.value = []
  }

  function stopTimer() {
    if (timerInterval) { clearInterval(timerInterval); timerInterval = null }
    if (visibilityHandler && !import.meta.server) {
      document.removeEventListener('visibilitychange', visibilityHandler)
      visibilityHandler = null
    }
  }

  // --- End-of-session alerting -------------------------------------------

  function requestNotificationPermission() {
    if (import.meta.server) return
    try {
      if ('Notification' in window && Notification.permission === 'default') {
        Notification.requestPermission()
      }
    } catch { /* unsupported / blocked — fall back to the on-page chime */ }
  }

  function notifyComplete() {
    if (import.meta.server) return
    playChime()
    try {
      if ('Notification' in window && Notification.permission === 'granted') {
        const n = new Notification('Focus session complete 🎉', {
          body: 'Time is up — click to head back and log how it went.',
          icon: '/favicon.ico',
          tag: 'focus-timer',
          requireInteraction: true,
        })
        n.onclick = () => { window.focus(); n.close() }
      }
    } catch { /* notification blocked — the chime still plays */ }
  }

  // Short ascending chime via WebAudio — no audio asset needed.
  function playChime() {
    try {
      const Ctx = window.AudioContext || (window as any).webkitAudioContext
      if (!Ctx) return
      const ctx = new Ctx()
      if (ctx.state === 'suspended') ctx.resume().catch(() => {})
      const notes = [880, 1108.73, 1318.51] // A5 · C#6 · E6
      notes.forEach((freq, i) => {
        const osc = ctx.createOscillator()
        const gain = ctx.createGain()
        osc.type = 'sine'; osc.frequency.value = freq
        osc.connect(gain); gain.connect(ctx.destination)
        const t = ctx.currentTime + i * 0.18
        gain.gain.setValueAtTime(0, t)
        gain.gain.linearRampToValueAtTime(0.25, t + 0.02)
        gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.5)
        osc.start(t); osc.stop(t + 0.5)
      })
      setTimeout(() => ctx.close().catch(() => {}), 1600)
    } catch { /* audio unavailable */ }
  }

  async function saveSession() {
    const userStore = useUserStore()
    if (!userStore.userId) { reset(); return }
    const now = new Date().toISOString()
    // Persists via useDataService → Supabase. Let errors THROW so the caller keeps
    // the completion screen (don't lose the journal/emotion on a failed save).
    const { createSession } = useDataService()
    await createSession({
      userId: userStore.userId,
      taskId: taskId.value ?? undefined,
      startTime: sessionStartTime.value ?? now,
      endTime: sessionEndTime.value ?? now,
      durationPlanned: initialDuration.value,
      durationActual: Math.max(0, initialDuration.value - remaining.value),
      journalText: journalText.value || undefined,
      emotionLabel: emotionLabel.value ?? undefined,
      emotionConfidence: emotionConfidence.value ?? undefined,
      ambientTrack: ambientTrack.value ?? undefined,
    })
    reset()
  }

  // --- Persist across reloads (so an in-progress session survives F5 / tab discard) ---
  const STORAGE_KEY = 'focus_session'

  function persist() {
    if (import.meta.server) return
    try {
      if (status.value === 'idle') { localStorage.removeItem(STORAGE_KEY); return }
      localStorage.setItem(STORAGE_KEY, JSON.stringify({
        status: status.value, endAt, remaining: remaining.value,
        initialDuration: initialDuration.value, sessionStartTime: sessionStartTime.value,
        sessionEndTime: sessionEndTime.value,
        taskId: taskId.value, taskTitle: taskTitle.value, ambientTrack: ambientTrack.value,
      }))
    } catch { /* ignore quota / serialization */ }
  }

  function restore() {
    if (import.meta.server) return
    let s: any
    try { const raw = localStorage.getItem(STORAGE_KEY); if (!raw) return; s = JSON.parse(raw) } catch { return }
    if (!s || !s.status || s.status === 'idle') return
    initialDuration.value = s.initialDuration || 0
    sessionStartTime.value = s.sessionStartTime || null
    taskId.value = s.taskId || null; taskTitle.value = s.taskTitle || null
    ambientTrack.value = s.ambientTrack || null
    if (s.status === 'running' && s.endAt) {
      const left = Math.max(0, Math.ceil((s.endAt - Date.now()) / 1000))
      if (left <= 0) {
        // Ended while the tab was closed → jump to the completion screen (skip late chime).
        status.value = 'finished'; remaining.value = 0
        sessionEndTime.value = s.sessionEndTime || new Date().toISOString()
      } else {
        endAt = s.endAt; status.value = 'running'; remaining.value = left; runTimer()
      }
    } else if (s.status === 'paused') {
      status.value = 'paused'; remaining.value = s.remaining || 0
    } else if (s.status === 'finished') {
      status.value = 'finished'; remaining.value = 0
      sessionEndTime.value = s.sessionEndTime || new Date().toISOString()
    }
  }

  // Restore any prior session on first load, then keep localStorage in sync.
  restore()
  watch(status, () => persist())

  return {
    status, remaining, initialDuration, sessionStartTime, sessionEndTime,
    taskId, taskTitle, ambientTrack, journalText, emotionLabel, emotionConfidence, recommendations,
    isRunning, isPaused, isFinished, isIdle, progress, displayTime,
    start, pause, resume, finish, endEarly, reset, saveSession,
  }
})
