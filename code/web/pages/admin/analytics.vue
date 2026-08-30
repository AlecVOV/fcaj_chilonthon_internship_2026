<template>
  <div class="animate-in">
    <div class="mb-6">
      <h1 class="font-display text-display-sm text-ink dark:text-on-dark">{{ t('admin.overview.adminPanelTitle') }}</h1>
      <p class="mt-1 text-sm text-ink-body dark:text-on-dark-soft">{{ t('admin.overview.adminPanelSubtitle') }}</p>
    </div>

    <div class="mb-6 flex border-b border-hairline dark:border-hairline-dark">
      <NuxtLink to="/admin" class="tab">{{ t('admin.tabOverview') }}</NuxtLink>
      <NuxtLink to="/admin/users" class="tab">{{ t('admin.tabUsers') }}</NuxtLink>
      <NuxtLink to="/admin/media" class="tab">{{ t('admin.tabMedia') }}</NuxtLink>
      <NuxtLink to="/admin/ambient" class="tab">{{ t('admin.tabAmbient') }}</NuxtLink>
      <NuxtLink to="/admin/feedback" class="tab">{{ t('admin.tabFeedback') }}</NuxtLink>
      <NuxtLink to="/admin/announcements" class="tab">{{ t('admin.tabAnnouncements') }}</NuxtLink>
      <NuxtLink to="/admin/analytics" class="tab tab-active">{{ t('admin.tabAnalytics') }}</NuxtLink>
    </div>

    <h2 class="mb-1 font-display text-lg text-ink dark:text-on-dark">{{ t('admin.analytics.title') }}</h2>
    <p class="mb-4 text-sm text-ink-muted dark:text-on-dark-soft">{{ t('admin.analytics.subtitle') }}</p>

    <div v-if="loadError" class="card text-sm text-error dark:text-error">{{ loadError }}</div>

    <template v-else>
      <div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 mb-6">
        <div class="card"><p class="text-2xs font-medium uppercase tracking-wider text-ink-muted dark:text-on-dark-soft">{{ t('admin.analytics.totalFocusTime') }}</p><p class="mt-2 font-display text-2xl text-ink dark:text-on-dark">{{ formatHours(totalFocusMinutes) }}</p></div>
        <div class="card"><p class="text-2xs font-medium uppercase tracking-wider text-ink-muted dark:text-on-dark-soft">{{ t('admin.analytics.totalSessions') }}</p><p class="mt-2 font-display text-2xl text-ink dark:text-on-dark">{{ sessions.length }}</p></div>
        <div class="card"><p class="text-2xs font-medium uppercase tracking-wider text-ink-muted dark:text-on-dark-soft">{{ t('admin.analytics.activeUsers') }}</p><p class="mt-2 font-display text-2xl text-ink dark:text-on-dark">{{ leaderboard.length }}</p></div>
        <div class="card"><p class="text-2xs font-medium uppercase tracking-wider text-ink-muted dark:text-on-dark-soft">{{ t('admin.analytics.avgSessionLength') }}</p><p class="mt-2 font-display text-2xl text-ink dark:text-on-dark">{{ avgSessionMinutes }}m</p></div>
      </div>

      <div class="card !p-0 overflow-hidden">
        <div class="px-5 py-3 border-b border-hairline dark:border-hairline-dark flex items-center justify-between">
          <h3 class="text-sm font-medium text-ink dark:text-on-dark">{{ t('admin.analytics.mostActiveUsers') }}</h3>
          <span class="text-2xs text-ink-soft dark:text-on-dark-soft/70">{{ t('admin.analytics.clickToExpand') }}</span>
        </div>
        <div v-if="leaderboard.length === 0" class="py-8 text-center text-sm text-ink-soft dark:text-on-dark-soft/70">{{ t('admin.analytics.noData') }}</div>
        <div v-else class="overflow-x-auto">
          <table class="table-base">
            <thead><tr><th>{{ t('admin.analytics.tableUser') }}</th><th>{{ t('admin.analytics.tableFocusTime') }}</th><th>{{ t('admin.analytics.tableSessions') }}</th><th>{{ t('admin.analytics.tableTasksDone') }}</th></tr></thead>
            <tbody>
              <template v-for="row in leaderboard" :key="row.userId">
                <tr class="cursor-pointer" @click="toggleExpand(row.userId)">
                  <td class="font-medium text-ink dark:text-on-dark">{{ row.name }}<span class="block text-2xs font-normal text-ink-soft dark:text-on-dark-soft/70">{{ row.email }}</span></td>
                  <td class="whitespace-nowrap">{{ row.totalMinutes }}m</td>
                  <td class="whitespace-nowrap">{{ row.sessionsCount }}</td>
                  <td class="whitespace-nowrap">{{ row.tasksCompleted }}</td>
                </tr>
                <tr v-if="expandedUserId === row.userId">
                  <td colspan="4" class="!border-b !border-hairline dark:!border-hairline-dark bg-canvas-card dark:bg-surface-dark-soft !py-3">
                    <p class="mb-2 text-xs font-medium uppercase tracking-wider text-ink-muted dark:text-on-dark-soft">{{ t('admin.analytics.recentSessionsFor', { name: row.name }) }}</p>
                    <div v-if="row.recentSessions.length === 0" class="text-xs text-ink-soft dark:text-on-dark-soft/70">{{ t('admin.analytics.noRecentSessions') }}</div>
                    <ul v-else class="space-y-1">
                      <li v-for="s in row.recentSessions" :key="s.id" class="flex items-center gap-3 text-xs text-ink-body dark:text-on-dark-soft">
                        <span class="w-32 shrink-0 text-ink-soft dark:text-on-dark-soft/70">{{ dayjs(s.startTime).format('MMM D, HH:mm') }}</span>
                        <span class="w-14 shrink-0">{{ Math.round((s.durationActual ?? s.durationPlanned) / 60) }}m</span>
                        <EmotionBadge v-if="s.emotionLabel" :label="s.emotionLabel" />
                      </li>
                    </ul>
                  </td>
                </tr>
              </template>
            </tbody>
          </table>
        </div>
      </div>
    </template>
  </div>
</template>

<script setup lang="ts">
import { useDataService } from '~/composables/useDataService'
import dayjs from 'dayjs'

definePageMeta({ middleware: ['auth', 'admin'] })

const { t } = useLocale()
const { getUsers, getSessions, getTasks } = useDataService()

const users = ref<any[]>([])
const sessions = ref<any[]>([])
const tasks = ref<any[]>([])
const loadError = ref('')
const expandedUserId = ref<string | null>(null)

const totalFocusMinutes = computed(() => Math.round(sessions.value.reduce((sum, s) => sum + (s.durationActual ?? s.durationPlanned ?? 0), 0) / 60))
const avgSessionMinutes = computed(() => sessions.value.length === 0 ? 0 : Math.round(totalFocusMinutes.value / sessions.value.length))

const leaderboard = computed(() => {
  const map = new Map<string, { userId: string; name: string; email: string; totalMinutes: number; sessionsCount: number; tasksCompleted: number; recentSessions: any[] }>()
  for (const s of sessions.value) {
    if (!map.has(s.userId)) {
      const u = users.value.find(u2 => u2.id === s.userId)
      map.set(s.userId, { userId: s.userId, name: u?.name ?? 'Unknown', email: u?.email ?? '--', totalMinutes: 0, sessionsCount: 0, tasksCompleted: 0, recentSessions: [] })
    }
    const row = map.get(s.userId)!
    row.totalMinutes += Math.round((s.durationActual ?? s.durationPlanned ?? 0) / 60)
    row.sessionsCount++
    row.recentSessions.push(s)
  }
  for (const row of map.values()) {
    row.recentSessions = row.recentSessions.sort((a, b) => new Date(b.startTime).getTime() - new Date(a.startTime).getTime()).slice(0, 5)
    row.tasksCompleted = tasks.value.filter(t2 => t2.userId === row.userId && t2.status === 'completed').length
  }
  return Array.from(map.values()).sort((a, b) => b.totalMinutes - a.totalMinutes)
})

function formatHours(min: number) { const h = Math.floor(min / 60); const m = min % 60; return h > 0 ? `${h}h ${m}m` : `${m}m` }
function toggleExpand(userId: string) { expandedUserId.value = expandedUserId.value === userId ? null : userId }

onMounted(async () => {
  try {
    const [u, s, t2] = await Promise.all([getUsers(), getSessions(), getTasks()])
    users.value = u; sessions.value = s; tasks.value = t2
  } catch (e: any) {
    loadError.value = e?.message || t('admin.analytics.loadFailed')
  }
})
</script>
