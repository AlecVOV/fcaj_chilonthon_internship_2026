<template>
  <div ref="root" class="relative">
    <button
      @click="toggle"
      class="relative flex h-8 w-8 items-center justify-center rounded-md text-ink-muted hover:bg-canvas-card hover:text-ink dark:text-on-dark-soft dark:hover:bg-surface-dark-elevated dark:hover:text-on-dark transition-colors"
      :title="t('announcements.title')"
    >
      <span aria-hidden="true">&#128276;</span>
      <span v-if="unseenCount > 0" class="absolute -top-0.5 -right-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-error px-1 text-[10px] font-medium text-white">
        {{ unseenCount > 9 ? '9+' : unseenCount }}
      </span>
    </button>
    <div
      v-if="open"
      class="absolute right-0 top-10 z-50 max-h-96 w-80 overflow-y-auto rounded-lg border border-hairline bg-canvas-card shadow-lg dark:border-hairline-dark dark:bg-surface-dark-elevated animate-in"
    >
      <p class="border-b border-hairline px-3 py-2 text-xs font-medium uppercase tracking-wider text-ink-muted dark:border-hairline-dark dark:text-on-dark-soft">
        {{ t('announcements.title') }}
      </p>
      <div v-if="loading" class="px-3 py-4 text-center text-sm text-ink-soft dark:text-on-dark-soft">{{ t('common.loading') }}</div>
      <div v-else-if="items.length === 0" class="px-3 py-4 text-center text-sm text-ink-soft dark:text-on-dark-soft/70">{{ t('announcements.empty') }}</div>
      <div v-else class="divide-y divide-hairline dark:divide-hairline-dark">
        <div v-for="a in items" :key="a.id" class="px-3 py-2.5">
          <p class="text-sm font-medium text-ink dark:text-on-dark">{{ a.title }}</p>
          <p class="mt-0.5 text-xs text-ink-body dark:text-on-dark-soft whitespace-pre-wrap">{{ a.message }}</p>
          <p class="mt-1 text-2xs text-ink-soft dark:text-on-dark-soft/70">{{ dayjs(a.createdAt).format('MMM D, YYYY') }}</p>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { onClickOutside } from '@vueuse/core'
import dayjs from 'dayjs'
import { useAnnouncements, type Announcement } from '~/composables/useAnnouncements'

const { listAnnouncements, isSeen, markSeen } = useAnnouncements()
const { t } = useLocale()

const open = ref(false)
const root = ref<HTMLElement>()
onClickOutside(root, () => { open.value = false })

const items = ref<Announcement[]>([])
const loading = ref(false)
const unseenCount = ref(0)

async function load() {
  loading.value = true
  try {
    items.value = await listAnnouncements()
    unseenCount.value = items.value.filter(a => !isSeen(a.id)).length
  } catch { /* fail silent — non-critical UI */ }
  finally { loading.value = false }
}

function toggle() {
  open.value = !open.value
  if (open.value && items.value.length > 0) {
    // Mark seen once opened — badge clears, list stays visible for this viewing.
    markSeen(items.value.map(a => a.id))
    unseenCount.value = 0
  }
}

onMounted(load)
</script>
