<template>
  <div class="space-y-2">
    <p class="text-2xs font-medium uppercase tracking-wider text-ink-muted dark:text-on-dark-soft">Ambient Sound</p>
    <div class="flex gap-1.5 flex-wrap">
      <button
        v-for="track in tracks"
        :key="track.id"
        type="button"
        @click="$emit('update:modelValue', track.id === 'none' ? null : track.id)"
        class="rounded-md border px-2.5 py-1 text-sm transition-colors"
        :class="(modelValue === track.id || (track.id === 'none' && !modelValue))
          ? 'border-primary bg-primary/10 text-primary dark:bg-primary/20'
          : 'border-hairline dark:border-hairline-dark text-ink dark:text-on-dark hover:bg-canvas-card dark:hover:bg-surface-dark-soft'"
      >
        {{ track.label }}
      </button>
    </div>
    <p class="text-2xs text-ink-soft dark:text-on-dark-soft/70">Plays during your focus session (synthesized, no download).</p>
  </div>
</template>

<script setup lang="ts">
defineProps<{
  modelValue: string | null
}>()

defineEmits<{
  'update:modelValue': [trackId: string | null]
}>()

// Ids must match the presets synthesized in composables/useAmbientSound.ts
const tracks = [
  { id: 'none', label: 'Silence' },
  { id: 'rain', label: 'Rain' },
  { id: 'cafe', label: 'Cafe' },
  { id: 'waves', label: 'Waves' },
]
</script>
