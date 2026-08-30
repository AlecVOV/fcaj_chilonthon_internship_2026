<template>
  <div v-if="show" class="fixed bottom-4 right-4 z-40 w-full max-w-xs animate-in">
    <div class="card !p-4 shadow-lg border-accent-amber/40 dark:border-accent-amber/30">
      <div class="flex items-start gap-3">
        <div class="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-accent-amber/20 text-accent-amber dark:bg-accent-amber/30">
          <svg class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5"><path stroke-linecap="round" stroke-linejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" /></svg>
        </div>
        <div class="min-w-0 flex-1">
          <p class="text-sm font-medium text-ink dark:text-on-dark">{{ t('health.reminderTitle') }}</p>
          <p class="mt-0.5 text-xs text-ink-muted dark:text-on-dark-soft">{{ t('health.reminderBody', { min: todayMinutes }) }}</p>
        </div>
        <button @click="dismiss" class="shrink-0 text-ink-soft hover:text-ink dark:text-on-dark-soft dark:hover:text-on-dark" :aria-label="t('health.dismiss')">✕</button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
// Nhắc nghỉ khi tổng thời lượng focus TÍCH LŨY TRONG NGÀY vượt ngưỡng — khác với
// break ở focus.vue (đó là nghỉ giữa 2 phiên Pomodoro liên tiếp, cái này cảnh báo
// tổng thời gian màn hình cả ngày). Chỉ đọc dữ liệu đã có (focus_sessions), không
// cần bảng mới. Hiện 1 lần/ngày (dismiss lưu ngày hôm đó vào localStorage).
import { useDataService } from '~/composables/useDataService'
import dayjs from 'dayjs'

const THRESHOLD_MINUTES = 120
const STORAGE_KEY = 'focus_health_reminder_dismissed_date'

const { t } = useLocale()
const show = ref(false)
const todayMinutes = ref(0)

onMounted(async () => {
  try {
    const { getSessions } = useDataService()
    const sessions = await getSessions()
    const today = dayjs().format('YYYY-MM-DD')
    const total = sessions
      .filter((s: any) => dayjs(s.startTime).format('YYYY-MM-DD') === today)
      .reduce((sum: number, s: any) => sum + (s.durationActual ?? s.durationPlanned ?? 0), 0)
    todayMinutes.value = Math.round(total / 60)
    if (todayMinutes.value < THRESHOLD_MINUTES) return
    const dismissedDate = localStorage.getItem(STORAGE_KEY)
    if (dismissedDate === today) return
    show.value = true
  } catch { /* best-effort — banner just doesn't show */ }
})

function dismiss() {
  show.value = false
  try { localStorage.setItem(STORAGE_KEY, dayjs().format('YYYY-MM-DD')) } catch { /* ignore */ }
}
</script>
