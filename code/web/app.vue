<template>
  <NuxtLayout>
    <NuxtPage />
  </NuxtLayout>
</template>

<script setup lang="ts">
import { useAuth } from '~/composables/useAuth'

// Auth is restored instantly from localStorage; re-validate against Supabase on
// load so a demoted/revoked/expired session doesn't keep stale access.
const { syncSession } = useAuth()
onMounted(() => { syncSession() })

// Color mode: sync cookie → html[class] via direct DOM (client‑only, SSR‑safe)
// Claude default is light (cream canvas)
const colorMode = useCookie<string>('color-mode', { default: () => 'light' })
watchEffect(() => {
  if (typeof document !== 'undefined') {
    document.documentElement.classList.toggle('dark', colorMode.value === 'dark')
  }
})
</script>
