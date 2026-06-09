<template>
  <div class="space-y-2">
    <p class="text-2xs font-medium uppercase tracking-wider text-neutral-950/40 dark:text-white/25">Ambient Sound</p>
    <div class="flex gap-1.5 flex-wrap">
      <button
        v-for="track in tracks"
        :key="track.id"
        @click="$emit('select', track.id === 'none' ? null : track.id)"
        class="rounded border px-2.5 py-1 text-xs transition-colors"
        :class="(modelValue === track.id || (track.id === 'none' && !modelValue))
          ? 'border-interactive-blue bg-interactive-blue/10 text-interactive-blue dark:bg-interactive-blue/20'
          : 'border-neutral-200 dark:border-dark-border text-neutral-950 dark:text-dark-text hover:bg-neutral-150 dark:hover:bg-dark-surface'"
      >
        {{ track.label }}
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
defineProps<{
  modelValue: string | null
}>()

defineEmits<{
  select: [trackId: string | null]
}>()

const tracks = [
  { id: 'none', label: 'Silence' },
  { id: 'minecraft', label: 'Minecraft' },
  { id: 'rain', label: 'Rain' },
  { id: 'cafe', label: 'Cafe' },
]
</script>
