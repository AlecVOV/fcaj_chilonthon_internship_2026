<template>
  <button
    @click="toggle"
    class="rounded-md border px-2.5 py-1 text-sm font-medium transition-colors"
    :class="isDark
      ? 'border-hairline-dark bg-surface-dark-elevated text-on-dark hover:bg-surface-dark-soft'
      : 'border-hairline bg-canvas text-ink hover:bg-canvas-card dark:border-hairline-dark dark:bg-surface-dark-elevated dark:text-on-dark dark:hover:bg-surface-dark-soft'"
    :title="isDark ? t('colorMode.toLight') : t('colorMode.toDark')"
  >
    {{ isDark ? t('colorMode.dark') : t('colorMode.light') }}
  </button>
</template>

<script setup lang="ts">
const colorMode = useCookie<string>('color-mode', { default: () => 'light' })
const isDark = computed(() => colorMode.value === 'dark')
const { t } = useLocale()


function toggle() {
  colorMode.value = isDark.value ? 'light' : 'dark'
}
</script>
