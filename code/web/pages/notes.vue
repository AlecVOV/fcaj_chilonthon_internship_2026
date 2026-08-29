<template>
  <div class="animate-in">
    <div class="mb-6 flex items-center justify-between">
      <div>
        <h1 class="font-display text-display-sm text-ink dark:text-on-dark">{{ t('notes.title') }}</h1>
        <p v-if="lastSaved" class="mt-1 text-xs text-ink-muted dark:text-on-dark-soft">{{ t('notes.lastSaved', { date: dayjs(lastSaved).format('MMM D, YYYY HH:mm') }) }}</p>
      </div>
      <div class="flex gap-2">
        <button @click="mode = mode === 'edit' ? 'preview' : 'edit'" class="btn-outline text-sm">
          {{ mode === 'edit' ? t('notes.previewBtn') : t('notes.editBtn') }}
        </button>
        <button @click="handleSave" class="btn-primary text-sm" :disabled="saving || isLoading">{{ saving ? t('common.saving') : t('common.save') }}</button>
      </div>
    </div>

    <p v-if="saveError" class="mb-4 text-sm text-error dark:text-error">{{ saveError }}</p>
    <div v-if="isLoading" class="py-12 text-center text-sm text-ink-soft dark:text-on-dark-soft">{{ t('common.loading') }}</div>

    <div v-else class="card">
      <textarea
        v-if="mode === 'edit'"
        v-model="content"
        class="input min-h-[60vh] resize-y font-mono text-sm"
        :placeholder="t('notes.placeholder')"
      />
      <div v-else class="notes-markdown min-h-[60vh] text-sm text-ink-body dark:text-on-dark-soft" v-html="renderedHtml" />
    </div>
  </div>
</template>

<script setup lang="ts">
import { useNotes } from '~/composables/useNotes'
import { renderMarkdown } from '~/utils/markdown'
import dayjs from 'dayjs'

definePageMeta({ middleware: ['auth'] })

const { loadNote, saveNote } = useNotes()
const { t } = useLocale()

const content = ref('')
const lastSaved = ref<string | null>(null)
const mode = ref<'edit' | 'preview'>('edit')
const isLoading = ref(true)
const saving = ref(false)
const saveError = ref('')

const renderedHtml = computed(() => renderMarkdown(content.value))

onMounted(async () => {
  try {
    const note = await loadNote()
    content.value = note.content
    lastSaved.value = note.updatedAt
  } catch (e: any) {
    saveError.value = e?.message || t('notes.loadFailed')
  } finally {
    isLoading.value = false
  }
})

async function handleSave() {
  if (saving.value) return
  saving.value = true; saveError.value = ''
  try {
    lastSaved.value = await saveNote(content.value)
    mode.value = 'preview'
  } catch (e: any) {
    saveError.value = e?.message || t('notes.saveFailed')
  } finally {
    saving.value = false
  }
}
</script>

<style scoped>
/* v-html bypass scoped styles trừ khi dùng :deep() — cùng convention với AgentChat.vue. */
.notes-markdown :deep(h1) { font-size: 1.4em; font-weight: 600; margin: 0.6em 0 0.4em; }
.notes-markdown :deep(h2) { font-size: 1.2em; font-weight: 600; margin: 0.6em 0 0.4em; }
.notes-markdown :deep(h3) { font-size: 1.05em; font-weight: 600; margin: 0.5em 0 0.3em; }
.notes-markdown :deep(p) { margin: 0 0 0.6em; white-space: pre-wrap; }
.notes-markdown :deep(ul),
.notes-markdown :deep(ol) { margin: 0 0 0.6em; padding-left: 1.25em; }
.notes-markdown :deep(li) { margin: 0.15em 0; }
.notes-markdown :deep(strong) { font-weight: 600; }
.notes-markdown :deep(a) { text-decoration: underline; }
.notes-markdown :deep(code) { background: rgb(0 0 0 / 0.08); border-radius: 0.25em; padding: 0.1em 0.35em; font-size: 0.9em; }
.notes-markdown :deep(pre) { background: rgb(0 0 0 / 0.08); border-radius: 0.375em; padding: 0.6em 0.75em; overflow-x: auto; margin: 0 0 0.6em; }
.notes-markdown :deep(pre code) { background: none; padding: 0; }
.notes-markdown :deep(blockquote) { border-left: 2px solid currentColor; opacity: 0.85; padding-left: 0.75em; margin: 0 0 0.6em; }
</style>
