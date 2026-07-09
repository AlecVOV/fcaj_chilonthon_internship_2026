<template>
  <button
    @click="handleExport"
    class="btn-outline text-sm"
    :disabled="isExporting"
  >
    {{ isExporting ? 'Exporting...' : 'Export Report' }}
  </button>
  <Teleport to="body">
    <div
      v-if="showToast"
      class="fixed bottom-6 right-6 z-[9999] max-w-sm animate-in rounded-lg border bg-canvas dark:bg-surface-dark-elevated p-4"
      :class="toastType === 'loading'
        ? 'border-primary/30'
        : toastType === 'success'
          ? 'border-success/30'
          : 'border-error/30'"
    >
      <p class="text-sm font-medium" :class="{
        'text-primary': toastType === 'loading',
        'text-success dark:text-success': toastType === 'success',
        'text-error dark:text-error': toastType === 'error',
      }">
        {{ toastMessage }}
      </p>
      <p v-if="toastDetail" class="mt-1 text-xs text-ink-muted dark:text-on-dark-soft">{{ toastDetail }}</p>
    </div>
  </Teleport>
</template>

<script setup lang="ts">
import { useReportExport } from '~/composables/useReportExport'

const emit = defineEmits<{
  done: []
}>()

const { isExporting, exportError, lastMessage, downloadReport } = useReportExport()

const showToast = ref(false)
const toastType = ref<'loading' | 'success' | 'error'>('loading')
const toastMessage = ref('')
const toastDetail = ref('')
let toastTimer: ReturnType<typeof setTimeout>

async function handleExport() {
  showToast.value = true; toastType.value = 'loading'
  toastMessage.value = 'Generating report...'; toastDetail.value = ''

  await downloadReport() // hôm nay
  if (exportError.value) {
    toastType.value = 'error'; toastMessage.value = 'Export failed'; toastDetail.value = exportError.value
  } else {
    toastType.value = 'success'; toastMessage.value = lastMessage.value || 'Report ready'; toastDetail.value = ''
  }
  clearTimeout(toastTimer)
  toastTimer = setTimeout(() => { showToast.value = false }, 4000)
  emit('done')
}

onUnmounted(() => clearTimeout(toastTimer))
</script>
