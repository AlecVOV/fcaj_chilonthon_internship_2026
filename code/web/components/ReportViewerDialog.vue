<template>
  <div v-if="visible" class="fixed inset-0 z-50 flex items-center justify-center bg-ink/20 backdrop-blur-sm p-4" @click.self="close">
    <div class="card w-full max-w-lg max-h-[85vh] overflow-y-auto animate-in" @click.stop>
      <div class="mb-3 flex items-center justify-between">
        <h2 class="font-display text-lg text-ink dark:text-on-dark">{{ t('reportViewer.title') }}</h2>
        <button @click="close" class="text-ink-soft hover:text-ink dark:text-on-dark-soft dark:hover:text-on-dark" :aria-label="t('reportViewer.close')">✕</button>
      </div>
      <div v-if="loading" class="py-8 text-center text-sm text-ink-soft dark:text-on-dark-soft/70">{{ t('reportViewer.loading') }}</div>
      <div v-else-if="error" class="py-8 text-center text-sm text-error dark:text-error">{{ error }}</div>
      <div v-else class="report-markdown text-sm text-ink-body dark:text-on-dark-soft" v-html="html" />
    </div>
  </div>
</template>

<script setup lang="ts">
// Xem báo cáo ngày đã có (US-RPT-03) ngay trong app, thay vì chỉ tải file .md xuống
// máy. Dùng CHUNG nội dung với downloadReport (useReportExport.ts::buildReportMarkdown)
// để không lệch dữ liệu, chỉ khác cách hiển thị: render Markdown -> HTML (renderMarkdown,
// cùng tiện ích đã dùng ở notes.vue/AgentChat.vue) thay vì tải file.
import { renderMarkdown } from '~/utils/markdown'
import { useReportExport } from '~/composables/useReportExport'

const { t } = useLocale()
const visible = ref(false)
const loading = ref(false)
const error = ref('')
const html = ref('')

async function open(dateStr: string) {
  visible.value = true
  loading.value = true
  error.value = ''
  html.value = ''
  try {
    const { buildReportMarkdown } = useReportExport()
    const md = await buildReportMarkdown(dateStr)
    html.value = renderMarkdown(md)
  } catch (e: any) {
    error.value = e?.message || t('reportViewer.loadFailed')
  } finally {
    loading.value = false
  }
}

function close() { visible.value = false }

defineExpose({ open })
</script>

<style scoped>
/* v-html bypass scoped styles trừ khi dùng :deep() — cùng convention với notes.vue. */
.report-markdown :deep(h1) { font-size: 1.3em; font-weight: 600; margin: 0 0 0.5em; }
.report-markdown :deep(h2) { font-size: 1.1em; font-weight: 600; margin: 0.9em 0 0.4em; }
.report-markdown :deep(p) { margin: 0 0 0.6em; white-space: pre-wrap; }
.report-markdown :deep(ul),
.report-markdown :deep(ol) { margin: 0 0 0.6em; padding-left: 1.25em; }
.report-markdown :deep(li) { margin: 0.15em 0; }
.report-markdown :deep(strong) { font-weight: 600; }
.report-markdown :deep(blockquote) { border-left: 2px solid currentColor; opacity: 0.85; padding-left: 0.75em; margin: 0 0 0.6em; }
.report-markdown :deep(hr) { border: none; border-top: 1px solid rgb(0 0 0 / 0.1); margin: 1em 0; }
.report-markdown :deep(table) { width: 100%; border-collapse: collapse; margin: 0 0 0.8em; font-size: 0.92em; }
.report-markdown :deep(th),
.report-markdown :deep(td) { border-bottom: 1px solid rgb(0 0 0 / 0.1); padding: 0.4em 0.6em; text-align: left; }
.report-markdown :deep(th) { font-weight: 600; opacity: 0.7; text-transform: uppercase; font-size: 0.85em; }
</style>
