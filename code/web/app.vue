<template>
  <NuxtLayout>
    <NuxtPage />
  </NuxtLayout>
</template>

<script setup lang="ts">
// Auth is handled by useAuth() composable — session restored from localStorage.

// Dark mode: sync cookie → html[class] via direct DOM (client‑only, SSR‑safe)
const colorMode = useCookie<string>('color-mode', { default: () => 'light' })
watchEffect(() => {
  if (typeof document !== 'undefined') {
    document.documentElement.classList.toggle('dark', colorMode.value === 'dark')
  }
})
</script>
