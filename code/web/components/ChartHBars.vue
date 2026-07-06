<template>
  <div v-if="max === 0" class="flex items-center justify-center py-6 text-xs text-ink-soft dark:text-on-dark-soft/60">
    {{ emptyText || 'No data available' }}
  </div>
  <div v-else class="space-y-2">
    <div v-for="(d, i) in data" :key="i" class="flex items-center gap-2 text-xs" :title="`${d.label}: ${d.value}`">
      <span class="w-24 shrink-0 text-ink-soft dark:text-on-dark-soft/70">{{ d.label }}</span>
      <div class="h-2.5 flex-1 overflow-hidden rounded-full bg-hairline dark:bg-hairline-dark">
        <div class="h-full rounded-full transition-[width] duration-500" :style="{ width: barW(d.value), background: d.color || color }" />
      </div>
      <span class="w-5 text-right tabular-nums text-ink dark:text-on-dark">{{ d.value }}</span>
    </div>
  </div>
</template>

<script setup lang="ts">
// Lightweight horizontal bar list (CSS, no chart lib). For ordinal magnitude (priority).
const props = withDefaults(defineProps<{
  data: { label: string; value: number; color?: string }[]
  color?: string
  emptyText?: string
}>(), { color: '#cc785c' })

const max = computed(() => Math.max(0, ...props.data.map(d => d.value)))
function barW(v: number) {
  return max.value === 0 ? '0%' : `${Math.max(3, (v / max.value) * 100)}%`
}
</script>
