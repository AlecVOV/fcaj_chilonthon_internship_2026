<template>
  <div class="space-y-2">
    <p class="text-2xs font-medium uppercase tracking-wider text-ink-muted dark:text-on-dark-soft">Ambient Sound</p>
    <div class="flex gap-1.5 flex-wrap">
      <button
        type="button"
        @click="$emit('update:modelValue', null)"
        class="rounded-md border px-2.5 py-1 text-sm transition-colors"
        :class="!modelValue
          ? 'border-primary bg-primary/10 text-primary dark:bg-primary/20'
          : 'border-hairline dark:border-hairline-dark text-ink dark:text-on-dark hover:bg-canvas-card dark:hover:bg-surface-dark-soft'"
      >
        Silence
      </button>
      <button
        v-for="s in sounds"
        :key="s.id"
        type="button"
        @click="$emit('update:modelValue', s.url)"
        class="rounded-md border px-2.5 py-1 text-sm transition-colors"
        :class="modelValue === s.url
          ? 'border-primary bg-primary/10 text-primary dark:bg-primary/20'
          : 'border-hairline dark:border-hairline-dark text-ink dark:text-on-dark hover:bg-canvas-card dark:hover:bg-surface-dark-soft'"
      >
        {{ s.name }}
      </button>
    </div>
    <p v-if="loading" class="text-2xs text-ink-soft dark:text-on-dark-soft/70">Đang tải nhạc nền…</p>
    <p v-else-if="sounds.length === 0" class="text-2xs text-ink-soft dark:text-on-dark-soft/70">
      Haven't gone through any ambient sounds yet. Admin can add some in Admin → Ambient.
    </p>
    <p v-else class="text-2xs text-ink-soft dark:text-on-dark-soft/70">Playing while you focus.</p>
  </div>
</template>

<script setup lang="ts">
import { useAmbientSounds, type AmbientSound } from '~/composables/useAmbientSounds'

// modelValue = URL của track đang chọn (null = Silence).
defineProps<{ modelValue: string | null }>()
defineEmits<{ 'update:modelValue': [url: string | null] }>()

const { listSounds } = useAmbientSounds()
const sounds = ref<AmbientSound[]>([])
const loading = ref(true)

onMounted(async () => {
  try { sounds.value = await listSounds(true) }
  catch { /* để trống — trang Focus vẫn dùng được với Silence */ }
  finally { loading.value = false }
})
</script>
