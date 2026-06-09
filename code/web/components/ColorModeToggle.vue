<template>
  <button
    @click="toggle"
    class="rounded border px-2.5 py-1 text-xs transition-colors"
    :class="isDark
      ? 'border-neutral-400 bg-neutral-950 text-white hover:bg-neutral-800 dark:border-dark-border dark:bg-dark-card dark:hover:bg-dark-surface'
      : 'border-neutral-400 bg-white text-neutral-950 hover:bg-neutral-150 dark:bg-dark-card dark:text-dark-text dark:hover:bg-dark-surface'"
    :title="isDark ? 'Switch to light mode' : 'Switch to dark mode'"
  >
    {{ isDark ? 'Dark' : 'Light' }}
  </button>
</template>

<script setup lang="ts">
const colorMode = useCookie<string>('color-mode', { default: () => 'dark' })
const isDark = computed(() => colorMode.value === 'dark')


function toggle() {
  colorMode.value = isDark.value ? 'light' : 'dark'
}
</script>
