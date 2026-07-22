<template>
  <div>
    <div v-if="max === 0" class="flex items-center justify-center text-xs text-ink-soft dark:text-on-dark-soft/60" style="height: 120px">
      {{ emptyText || t('chart.noData') }}
    </div>
    <template v-else>
      <div class="flex items-end gap-1.5 border-b border-hairline dark:border-hairline-dark" style="height: 120px">
        <div
          v-for="(d, i) in data"
          :key="i"
          class="flex flex-1 flex-col items-center justify-end gap-1"
          :title="d.title || `${d.label}: ${d.value}${unit}`"
        >
          <span class="text-2xs leading-none tabular-nums text-ink-soft dark:text-on-dark-soft/70" :class="{ 'opacity-0': d.value === 0 }">{{ d.value }}</span>
          <div class="w-full max-w-[26px] rounded-t-[4px] transition-[height] duration-500" :style="{ height: barPx(d.value) + 'px', background: color }" />
        </div>
      </div>
      <div class="mt-1 flex gap-1.5">
        <span v-for="(d, i) in data" :key="i" class="flex-1 text-center text-2xs text-ink-soft/70 dark:text-on-dark-soft/60">{{ d.label }}</span>
      </div>
    </template>
  </div>
</template>

<script setup lang="ts">
// Lightweight single-series vertical bar chart (CSS, no chart lib).
const props = withDefaults(defineProps<{
  data: { label: string; value: number; title?: string }[]
  color?: string
  unit?: string
  emptyText?: string
}>(), { color: '#cc785c', unit: '' })
const { t } = useLocale()

const max = computed(() => Math.max(0, ...props.data.map(d => d.value)))
// Plot area ~96px; leaves room above the tallest bar for its value label.
function barPx(v: number) {
  return max.value === 0 ? 0 : Math.max(2, Math.round((v / max.value) * 96))
}
</script>
