<template>
  <div v-if="total === 0" class="flex items-center justify-center py-6 text-xs text-ink-soft dark:text-on-dark-soft/60">
    {{ emptyText || 'Chưa có task' }}
  </div>
  <div v-else class="flex items-center gap-4">
    <div class="relative h-24 w-24 shrink-0">
      <!-- circumference of r=15.915 ≈ 100, so dasharray units are percentages -->
      <svg viewBox="0 0 42 42" class="h-full w-full" role="img" aria-label="Task status distribution">
        <circle cx="21" cy="21" r="15.915" fill="none" stroke-width="4.5" class="stroke-hairline dark:stroke-hairline-dark" />
        <circle
          v-for="seg in arcs"
          :key="seg.label"
          cx="21"
          cy="21"
          r="15.915"
          fill="none"
          stroke-width="4.5"
          :stroke="seg.color"
          :stroke-dasharray="seg.dash"
          :stroke-dashoffset="seg.offset"
        />
      </svg>
      <div class="absolute inset-0 flex flex-col items-center justify-center">
        <span class="font-display text-xl leading-none tabular-nums text-ink dark:text-on-dark">{{ total }}</span>
        <span class="mt-0.5 text-2xs text-ink-soft dark:text-on-dark-soft/60">tasks</span>
      </div>
    </div>
    <!-- Legend carries identity (label + count) so it never relies on colour alone. -->
    <div class="flex-1 space-y-1.5 text-xs">
      <div v-for="seg in data" :key="seg.label" class="flex items-center gap-2" :title="`${seg.label}: ${seg.value}`">
        <span class="h-2.5 w-2.5 shrink-0 rounded-sm" :style="{ background: seg.color }" />
        <span class="text-ink-body dark:text-on-dark-soft">{{ seg.label }}</span>
        <span class="ml-auto tabular-nums text-ink dark:text-on-dark">{{ seg.value }}</span>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
// Lightweight SVG donut via stroke-dasharray (no chart lib).
const props = defineProps<{
  data: { label: string; value: number; color: string }[]
  emptyText?: string
}>()

const total = computed(() => props.data.reduce((s, d) => s + d.value, 0))

const arcs = computed(() => {
  if (total.value === 0) return []
  let acc = 0
  const gap = 1.5 // small surface gap between segments (in circumference %)
  return props.data.filter(d => d.value > 0).map((d) => {
    const pct = (d.value / total.value) * 100
    const len = Math.max(0, pct - gap)
    const seg = { label: d.label, color: d.color, dash: `${len} ${100 - len}`, offset: 25 - acc }
    acc += pct
    return seg
  })
})
</script>
