<template>
  <div class="space-y-2">
    <p class="text-2xs font-medium uppercase tracking-wider text-ink-muted dark:text-on-dark-soft">{{ t('ambientPlayer.heading') }}</p>
    <div class="flex gap-1.5 flex-wrap">
      <button
        type="button"
        @click="selectTrack(null)"
        class="rounded-md border px-2.5 py-1 text-sm transition-colors"
        :class="!modelValue
          ? 'border-primary bg-primary/10 text-primary dark:bg-primary/20'
          : 'border-hairline dark:border-hairline-dark text-ink dark:text-on-dark hover:bg-canvas-card dark:hover:bg-surface-dark-soft'"
      >
        {{ t('ambientPlayer.silence') }}
      </button>
      <div
        v-for="s in sounds"
        :key="s.id"
        class="flex items-center gap-0.5 rounded-md border pl-2.5 pr-1 py-1 text-sm transition-colors"
        :class="modelValue === s.url
          ? 'border-primary bg-primary/10 text-primary dark:bg-primary/20'
          : 'border-hairline dark:border-hairline-dark text-ink dark:text-on-dark hover:bg-canvas-card dark:hover:bg-surface-dark-soft'"
      >
        <button type="button" @click="selectTrack(s.url)" class="leading-none">{{ s.name }}</button>
        <button
          type="button"
          @click.stop="ambient.preview(s.url)"
          class="grid h-5 w-5 shrink-0 place-items-center rounded hover:bg-black/10 dark:hover:bg-white/10"
          :title="ambient.previewingUrl.value === s.url ? t('ambientPlayer.stopPreview') : t('ambientPlayer.previewFor15s')"
        >
          <span class="text-2xs leading-none">{{ ambient.previewingUrl.value === s.url ? '■' : '▶' }}</span>
        </button>
      </div>
    </div>
    <p v-if="loading" class="text-2xs text-ink-soft dark:text-on-dark-soft/70">{{ t('ambientPlayer.loading') }}</p>
    <p v-else-if="sounds.length === 0" class="text-2xs text-ink-soft dark:text-on-dark-soft/70">
      {{ t('ambientPlayer.noneYet') }}
    </p>
    <p v-else class="text-2xs text-ink-soft dark:text-on-dark-soft/70">{{ t('ambientPlayer.playingHint') }}</p>
  </div>
</template>

<script setup lang="ts">
import { useAmbientSounds, type AmbientSound } from '~/composables/useAmbientSounds'
import { useAmbientSound } from '~/composables/useAmbientSound'

// modelValue = URL của track đang chọn (null = Silence).
defineProps<{ modelValue: string | null }>()
const emit = defineEmits<{ 'update:modelValue': [url: string | null] }>()

const { listSounds } = useAmbientSounds()
const ambient = useAmbientSound()
const { t } = useLocale()
const sounds = ref<AmbientSound[]>([])
const loading = ref(true)

// Chọn track (kể cả Silence) -> dừng preview đang phát nếu có, tránh chồng tiếng
// giữa bản đang nghe thử và track chính vừa được chọn.
function selectTrack(url: string | null) {
  ambient.stopPreview()
  emit('update:modelValue', url)
}

onMounted(async () => {
  try { sounds.value = await listSounds(true) }
  catch { /* để trống — trang Focus vẫn dùng được với Silence */ }
  finally { loading.value = false }
})

// Rời trang/đóng component giữa lúc đang preview -> dọn dẹp, tránh phát mãi.
onUnmounted(() => ambient.stopPreview())
</script>
