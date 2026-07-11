<template>
  <NuxtLayout>
    <NuxtPage />
  </NuxtLayout>
</template>

<script setup lang="ts">
import { useAuth } from '~/composables/useAuth'
import { useAmbientSound } from '~/composables/useAmbientSound'
import { useFocusStore } from '~/stores/focus.store'

// Auth is restored instantly from localStorage; re-validate against Supabase on
// load so a demoted/revoked/expired session doesn't keep stale access.
const { syncSession } = useAuth()
onMounted(() => { syncSession() })

// Ambient audio theo trạng thái phiên Focus -- đặt Ở ĐÂY (app.vue luôn mount, không
// bị hủy khi điều hướng trang) thay vì trong pages/focus.vue, để nhạc KHÔNG dừng khi
// người dùng rời trang Focus sang dashboard/tasks/agent giữa lúc phiên đang chạy.
// `focusStore.status` không đổi giá trị chỉ vì đổi trang -> watcher không fire lại,
// nhạc tiếp tục phát liên tục, không bị restart khi quay lại trang Focus.
const focusStore = useFocusStore()
const ambient = useAmbientSound()
watch(() => focusStore.status, (s) => {
  if (s === 'running') ambient.play(focusStore.ambientTrack)
  else ambient.stop()
}, { immediate: true })

// Color mode: sync cookie → html[class] via direct DOM (client‑only, SSR‑safe)
// Claude default is light (cream canvas)
const colorMode = useCookie<string>('color-mode', { default: () => 'light' })
watchEffect(() => {
  if (typeof document !== 'undefined') {
    document.documentElement.classList.toggle('dark', colorMode.value === 'dark')
  }
})
</script>
