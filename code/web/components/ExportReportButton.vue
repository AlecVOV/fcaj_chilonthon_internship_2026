<template>
  <button
    @click="handleExport"
    class="btn-outline text-xs"
    :disabled="isExporting"
  >
    {{ isExporting ? 'Exporting...' : 'Export Report' }}
  </button>
  <Teleport to="body">
    <div
      v-if="showToast"
      class="fixed bottom-6 right-6 z-[9999] max-w-sm animate-in rounded border bg-white dark:bg-dark-card shadow-subtle-lg p-4"
      :class="toastType === 'loading'
        ? 'border-interactive-blue/30'
        : toastType === 'success'
          ? 'border-success/30'
          : 'border-critical/30'"
    >
      <p class="text-sm font-medium" :class="{
        'text-interactive-blue': toastType === 'loading',
        'text-success dark:text-success-dark': toastType === 'success',
        'text-critical dark:text-critical-dark': toastType === 'error',
      }">
        {{ toastMessage }}
      </p>
      <p v-if="toastDetail" class="mt-1 text-xs text-neutral-950/40 dark:text-white/30">{{ toastDetail }}</p>
    </div>
  </Teleport>
</template>

<script setup lang="ts">
import { useReportExport } from '~/composables/useReportExport'

const emit = defineEmits<{
  done: []
}>()

const { isExporting, exportError, exportResult, exportReport } = useReportExport()

const showToast = ref(false)
const toastType = ref<'loading' | 'success' | 'error'>('loading')
const toastMessage = ref('')
const toastDetail = ref('')
let toastTimer: ReturnType<typeof setTimeout>

async function handleExport() {
  showToast.value = true; toastType.value = 'loading'
  toastMessage.value = 'Generating report...'; toastDetail.value = ''

  await exportReport()
  if (exportError.value) {
    toastType.value = 'error'; toastMessage.value = 'Export failed'; toastDetail.value = exportError.value
  } else {
    toastType.value = 'success'; toastMessage.value = exportResult.value?.message || 'Report ready'
    toastDetail.value = exportResult.value?.pdfUrl ? 'PDF opened in new tab' : '.tex file downloaded'
  }
  clearTimeout(toastTimer)
  toastTimer = setTimeout(() => { showToast.value = false }, 4000)
  emit('done')
}

onUnmounted(() => clearTimeout(toastTimer))
</script>
