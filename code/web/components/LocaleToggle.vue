<template>
  <button
    @click="toggle"
    class="rounded-md border px-2.5 py-1 text-sm font-medium transition-colors border-hairline bg-canvas text-ink hover:bg-canvas-card dark:border-hairline-dark dark:bg-surface-dark-elevated dark:text-on-dark dark:hover:bg-surface-dark-soft"
    :title="locale === 'en' ? 'Chuyển sang Tiếng Việt' : 'Switch to English'"
  >
    {{ locale === 'en' ? 'EN' : 'VI' }}
  </button>
</template>

<script setup lang="ts">
const { locale, setLocale } = useLocale()

function toggle() {
  setLocale(locale.value === 'en' ? 'vi' : 'en')
}
</script>
