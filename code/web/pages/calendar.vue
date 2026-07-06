<template>
  <div class="animate-in">
    <h1 class="mb-6 font-display text-display-sm text-ink dark:text-on-dark">History</h1>

    <div class="mb-6 flex items-center gap-4">
      <button @click="prevMonth" class="btn-ghost text-sm">Prev</button>
      <h2 class="font-display text-lg text-ink dark:text-on-dark">{{ monthLabel }}</h2>
      <button @click="nextMonth" class="btn-ghost text-sm">Next</button>
    </div>

    <div class="card mb-6 overflow-x-auto">
      <div class="grid grid-cols-7 gap-1 min-w-[600px]">
        <div v-for="d in dayHeaders" :key="d" class="p-1 text-center text-2xs font-medium text-ink-soft dark:text-on-dark-soft">{{ d }}</div>
        <div v-for="i in firstDayOffset" :key="'e' + i" />
        <div v-for="day in daysInMonth" :key="day" class="aspect-square rounded-md p-1 text-center text-2xs transition-all hover:ring-2 hover:ring-primary/50" :class="getDayClass(day)" :title="getDayTitle(day)">{{ day }}</div>
      </div>
      <div class="mt-3 flex items-center justify-end gap-1 text-2xs text-ink-soft dark:text-on-dark-soft/70">
        Less <div class="flex gap-0.5"><div v-for="l in 5" :key="l" class="h-3 w-3 rounded-sm" :class="levelClass(l)" /></div> More
      </div>
    </div>

    <div class="card !p-0 overflow-hidden">
      <div class="px-5 py-3 border-b border-hairline dark:border-hairline-dark"><h2 class="text-sm font-medium text-ink dark:text-on-dark">Sessions This Month</h2></div>
      <div v-if="monthSessions.length === 0" class="py-8 text-center text-sm text-ink-soft dark:text-on-dark-soft/70">No sessions recorded this month.</div>
      <div v-else class="overflow-x-auto">
        <table class="table-base">
          <thead><tr><th>Date</th><th>Planned</th><th>Actual</th><th>Mood</th><th>Journal</th></tr></thead>
          <tbody>
            <tr v-for="s in monthSessions" :key="s.id">
              <td class="whitespace-nowrap">{{ dayjs(s.startTime).format('MMM D, HH:mm') }}</td>
              <td class="whitespace-nowrap text-ink-muted dark:text-on-dark-soft">{{ Math.round(s.durationPlanned / 60) }}m</td>
              <td class="whitespace-nowrap font-medium text-ink dark:text-on-dark">{{ Math.round((s.durationActual ?? s.durationPlanned) / 60) }}m</td>
              <td class="whitespace-nowrap"><EmotionBadge v-if="s.emotionLabel" :label="s.emotionLabel" /><span v-else class="text-ink-soft/30 dark:text-on-dark-soft/30">--</span></td>
              <td class="max-w-[200px] truncate text-ink-soft dark:text-on-dark-soft">{{ s.journalText || '--' }}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { useAuth } from '~/composables/useAuth'
import { useDataService } from '~/composables/useDataService'
import dayjs from 'dayjs'

definePageMeta({ middleware: ['auth'] })

const { currentUser } = useAuth()
const { getSessions } = useDataService()
const currentMonth = ref(dayjs())
const sessions = ref<any[]>([])

const monthSessions = computed(() => {
  const start = currentMonth.value.startOf('month'); const end = currentMonth.value.endOf('month')
  return sessions.value.filter((s: any) => { const d = dayjs(s.startTime); return d.isAfter(start) && d.isBefore(end) }).sort((a: any, b: any) => new Date(b.startTime).getTime() - new Date(a.startTime).getTime())
})
const dayHeaders = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
const firstDayOffset = computed(() => { const f = currentMonth.value.startOf('month').day(); return f === 0 ? 6 : f - 1 })
const daysInMonth = computed(() => currentMonth.value.daysInMonth())
const monthLabel = computed(() => currentMonth.value.format('MMMM YYYY'))

const dailyMinutes = computed(() => {
  const map: Record<number, number> = {}
  for (const s of monthSessions.value) { const d = dayjs(s.startTime).date(); map[d] = (map[d] || 0) + Math.round((s.durationActual ?? s.durationPlanned) / 60) }
  return map
})

function getDayClass(day: number) { const m = dailyMinutes.value[day] || 0; if (m === 0) return 'bg-canvas-card dark:bg-surface-dark-soft text-ink-soft/30 dark:text-on-dark-soft/30'; return `${levelClass(getLevel(m))} text-white font-medium` }
function getLevel(m: number) { if (m >= 120) return 5; if (m >= 60) return 4; if (m >= 30) return 3; if (m >= 10) return 2; return 1 }
function levelClass(l: number) { const c = ['bg-success/20', 'bg-success/35', 'bg-success/50', 'bg-success/65', 'bg-success/80']; return c[l - 1] ?? c[4] }
function getDayTitle(day: number) { const m = dailyMinutes.value[day] || 0; return m > 0 ? `${m} min on ${currentMonth.value.format('MMM')} ${day}` : 'No focus sessions' }
function prevMonth() { currentMonth.value = currentMonth.value.subtract(1, 'month') }
function nextMonth() { currentMonth.value = currentMonth.value.add(1, 'month') }

onMounted(async () => { sessions.value = await getSessions() })
</script>
