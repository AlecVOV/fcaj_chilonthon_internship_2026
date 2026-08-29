<template>
  <div>
    <div v-if="series.every(s => s.points.every(p => p.value === 0))" class="flex items-center justify-center text-xs text-ink-soft dark:text-on-dark-soft/60" style="height: 120px">
      {{ emptyText || t('chart.noData') }}
    </div>
    <template v-else>
      <svg viewBox="0 0 300 120" preserveAspectRatio="none" class="w-full" style="height: 120px">
        <!-- baseline -->
        <line x1="0" y1="118" x2="300" y2="118" stroke="currentColor" class="text-hairline dark:text-hairline-dark" stroke-width="1" />
        <g v-for="s in series" :key="s.label">
          <polyline :points="linePoints(s)" fill="none" :stroke="s.color" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
          <circle v-for="(p, i) in s.points" :key="i" :cx="x(i)" :cy="y(p.value, s)" r="2.5" :fill="s.color">
            <title>{{ p.title || `${p.label}: ${p.value}` }}</title>
          </circle>
        </g>
      </svg>
      <div class="mt-1 flex gap-1.5">
        <span v-for="(p, i) in series[0]?.points" :key="i" class="flex-1 text-center text-2xs text-ink-soft/70 dark:text-on-dark-soft/60">{{ p.label }}</span>
      </div>
      <div class="mt-2 flex items-center gap-4 text-2xs">
        <div v-for="s in series" :key="s.label" class="flex items-center gap-1.5">
          <span class="h-2 w-2 rounded-full" :style="{ background: s.color }" />
          <span class="text-ink-body dark:text-on-dark-soft">{{ s.label }}</span>
        </div>
      </div>
    </template>
  </div>
</template>

<script setup lang="ts">
// Lightweight multi-series SVG line chart (no chart lib). Each series is normalised
// to its OWN max, since the two series plotted on the dashboard use different units
// (focus minutes vs. tasks completed) — this keeps both lines visually readable on
// one chart instead of one flattening near zero.
export interface ChartLineSeries {
  label: string
  color: string
  points: { label: string; value: number; title?: string }[]
}
const props = defineProps<{ series: ChartLineSeries[]; emptyText?: string }>()
const { t } = useLocale()

const n = computed(() => props.series[0]?.points.length || 1)
function x(i: number) { return n.value <= 1 ? 150 : (i / (n.value - 1)) * 300 }
function y(value: number, s: ChartLineSeries) {
  const max = Math.max(1, ...s.points.map(p => p.value))
  return 118 - (value / max) * 100
}
function linePoints(s: ChartLineSeries) {
  return s.points.map((p, i) => `${x(i)},${y(p.value, s)}`).join(' ')
}
</script>
