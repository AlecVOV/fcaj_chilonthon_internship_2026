// composables/useOffline.ts
export function useOffline() {
  const isOnline = ref(true)
  const showOfflineToast = ref(false)

  function updateOnlineStatus() {
    isOnline.value = navigator.onLine
    if (!isOnline.value) { showOfflineToast.value = true }
    else { setTimeout(() => { showOfflineToast.value = false }, 2000) }
  }

  onMounted(() => {
    updateOnlineStatus()
    window.addEventListener('online', updateOnlineStatus)
    window.addEventListener('offline', updateOnlineStatus)
  })
  onUnmounted(() => {
    window.removeEventListener('online', updateOnlineStatus)
    window.removeEventListener('offline', updateOnlineStatus)
  })

  return { isOnline, showOfflineToast }
}
