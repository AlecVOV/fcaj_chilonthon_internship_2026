<template>
  <div class="animate-in">
    <div class="mb-6 flex items-center justify-between">
      <h1 class="font-display text-display-sm text-ink dark:text-on-dark">{{ t('admin.media.title') }}</h1>
      <div class="flex gap-2">
        <button @click="handleGenerateAll" class="btn-outline text-sm" :disabled="generatingAll">{{ generatingAll ? t('admin.media.generating') : t('admin.media.generateAllEmbeddings') }}</button>
        <button @click="openAdd" class="btn-primary">{{ t('admin.media.addMedia') }}</button>
      </div>
    </div>

    <div class="mb-6 flex border-b border-hairline dark:border-hairline-dark">
      <NuxtLink to="/admin" class="tab">{{ t('admin.tabOverview') }}</NuxtLink>
      <NuxtLink to="/admin/users" class="tab">{{ t('admin.tabUsers') }}</NuxtLink>
      <NuxtLink to="/admin/media" class="tab tab-active">{{ t('admin.tabMedia') }}</NuxtLink>
      <NuxtLink to="/admin/ambient" class="tab">{{ t('admin.tabAmbient') }}</NuxtLink>
      <NuxtLink to="/admin/feedback" class="tab">{{ t('admin.tabFeedback') }}</NuxtLink>
    </div>

    <div class="grid gap-4 sm:grid-cols-2 mb-6">
      <div class="card"><p class="text-2xs font-medium uppercase tracking-wider text-ink-muted dark:text-on-dark-soft">{{ t('admin.media.totalItems') }}</p><p class="mt-2 font-display text-2xl text-ink dark:text-on-dark">{{ media.length }}</p></div>
      <div class="card"><p class="text-2xs font-medium uppercase tracking-wider text-ink-muted dark:text-on-dark-soft">{{ t('admin.media.embedded') }}</p><p class="mt-2 font-display text-2xl text-ink dark:text-on-dark">{{ embeddedCount }} / {{ media.length }}</p></div>
    </div>

    <div class="card !p-0 overflow-hidden">
      <div class="px-5 py-3 border-b border-hairline dark:border-hairline-dark flex items-center justify-between">
        <h2 class="text-sm font-medium text-ink dark:text-on-dark">{{ t('admin.media.mediaLibrary') }}</h2>
        <input v-model="search" class="input w-64" :placeholder="t('admin.media.search')" />
      </div>
      <div v-if="media.length === 0" class="py-12 text-center text-sm text-ink-soft dark:text-on-dark-soft/70">{{ t('admin.media.noMediaYet') }}</div>
      <div v-else class="overflow-x-auto">
        <table class="table-base">
          <thead><tr><th>{{ t('admin.media.tableTitle') }}</th><th>{{ t('admin.media.tableType') }}</th><th>{{ t('admin.media.tableContent') }}</th><th>{{ t('admin.media.tableSource') }}</th><th>{{ t('admin.media.tableEmbedded') }}</th><th>{{ t('admin.media.tableActions') }}</th></tr></thead>
          <tbody>
            <tr v-for="m in filteredMedia" :key="m.id">
              <td class="font-medium text-ink dark:text-on-dark">{{ m.title }}</td>
              <td class="text-ink-body dark:text-on-dark-soft">{{ m.media_type }}</td>
              <td class="text-ink-body dark:text-on-dark-soft max-w-[200px] truncate">
                <a v-if="m.content_url" :href="m.content_url" target="_blank" class="link text-sm">{{ m.content_url }}</a>
                <span v-else>{{ m.content_text || '--' }}</span>
              </td>
              <td class="text-ink-body dark:text-on-dark-soft max-w-[150px] truncate">{{ m.source || '--' }}</td>
              <td><span class="badge" :class="m.has_embedding ? 'badge-success' : 'badge-warning'">{{ m.has_embedding ? t('common.yes') : t('common.no') }}</span></td>
              <td>
                <div class="flex gap-1">
                  <button v-if="!m.has_embedding && !generatingId[m.id]" @click="handleGenerateOne(m.id)" class="rounded-md px-1.5 py-0.5 text-sm text-primary hover:bg-primary/10">{{ t('admin.media.embed') }}</button>
                  <span v-if="generatingId[m.id]" class="text-sm text-ink-soft dark:text-on-dark-soft">{{ t('admin.media.generating') }}</span>
                  <button @click="openEdit(m)" class="rounded-md px-1.5 py-0.5 text-sm text-ink-muted dark:text-on-dark-soft hover:text-primary">{{ t('admin.media.edit') }}</button>
                  <button @click="confirmDelete(m)" class="rounded-md px-1.5 py-0.5 text-sm text-error dark:text-error hover:bg-error/10">{{ t('admin.media.del') }}</button>
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <!-- Add / Edit Dialog -->
    <div v-if="showForm" class="fixed inset-0 z-50 flex items-center justify-center bg-ink/20 backdrop-blur-sm" @click.self="closeForm">
      <div class="card w-full max-w-lg animate-in" @click.stop>
        <h2 class="mb-4 font-display text-lg text-ink dark:text-on-dark">{{ editingId ? t('admin.media.editMedia') : t('admin.media.addMediaTitle') }}</h2>
        <div class="space-y-3">
          <div><label class="block mb-1 text-xs font-medium text-ink-muted dark:text-on-dark-soft">{{ t('admin.media.titleLabel') }}</label><input v-model="form.title" class="input" :placeholder="t('admin.media.titlePlaceholder')" /></div>
          <div><label class="block mb-1 text-xs font-medium text-ink-muted dark:text-on-dark-soft">{{ t('admin.media.typeLabel') }}</label><select v-model="form.type" class="input"><option value="quote">{{ t('admin.media.typeQuote') }}</option><option value="sutra">{{ t('admin.media.typeSutra') }}</option><option value="article">{{ t('admin.media.typeArticle') }}</option><option value="video">{{ t('admin.media.typeVideo') }}</option><option value="audio">{{ t('admin.media.typeAudio') }}</option></select></div>
          <div v-if="form.type === 'video'"><label class="block mb-1 text-xs font-medium text-ink-muted dark:text-on-dark-soft">{{ t('admin.media.videoUrlLabel') }}</label><input v-model="form.contentUrl" class="input" :placeholder="t('admin.media.videoUrlPlaceholder')" /></div>
          <div v-else><label class="block mb-1 text-xs font-medium text-ink-muted dark:text-on-dark-soft">{{ t('admin.media.contentTextLabel') }}</label><textarea v-model="form.contentText" class="input" rows="3" :placeholder="t('admin.media.contentTextPlaceholder')" /></div>
          <div><label class="block mb-1 text-xs font-medium text-ink-muted dark:text-on-dark-soft">{{ t('admin.media.sourceLabel') }}</label><input v-model="form.source" class="input" :placeholder="t('admin.media.sourcePlaceholder')" /></div>
          <div><label class="block mb-1 text-xs font-medium text-ink-muted dark:text-on-dark-soft">{{ t('admin.media.tagsLabel') }}</label><input v-model="form.tagsInput" class="input" :placeholder="t('admin.media.tagsPlaceholder')" /></div>
        </div>
        <div class="mt-4 flex justify-end gap-2">
          <button @click="closeForm" class="btn-ghost">{{ t('admin.media.cancel') }}</button>
          <button @click="handleSave" class="btn-primary" :disabled="!form.title.trim()">{{ editingId ? t('admin.media.save') : t('admin.media.addAction') }}</button>
        </div>
      </div>
    </div>

    <!-- Delete Confirm -->
    <div v-if="deleteTarget" class="fixed inset-0 z-50 flex items-center justify-center bg-ink/20 backdrop-blur-sm" @click.self="deleteTarget = null">
      <div class="card w-full max-w-sm animate-in" @click.stop>
        <h2 class="mb-2 font-display text-lg text-ink dark:text-on-dark">{{ t('admin.media.confirmDeleteTitle') }}</h2>
        <p class="text-sm text-ink-body dark:text-on-dark-soft mb-4">{{ t('admin.media.confirmDeleteText', { title: deleteTarget.title }) }}</p>
        <div class="flex justify-end gap-2">
          <button @click="deleteTarget = null" class="btn-ghost">{{ t('admin.media.cancel') }}</button>
          <button @click="handleDelete" class="btn-danger">{{ t('admin.media.delete') }}</button>
        </div>
      </div>
    </div>

    <!-- Toast -->
    <Teleport to="body">
      <div v-if="toast" class="fixed bottom-6 right-6 z-[9999] max-w-sm animate-in rounded-lg border bg-canvas dark:bg-surface-dark-elevated p-4" :class="toastType === 'success' ? 'border-success/30' : 'border-warning/30'">
        <p class="text-sm" :class="toastType === 'success' ? 'text-success dark:text-success' : 'text-warning dark:text-warning'">{{ toast }}</p>
      </div>
    </Teleport>
  </div>
</template>

<script setup lang="ts">
import { useDataService } from '~/composables/useDataService'

definePageMeta({ middleware: ['auth', 'admin'] })

const { getMedia, createMedia, updateMedia, deleteMedia, generateEmbedding, generateAllEmbeddings } = useDataService()
const { t } = useLocale()

const media = ref<any[]>([])
const search = ref('')
const showForm = ref(false)
const editingId = ref<string | null>(null)
const deleteTarget = ref<any>(null)
const generatingId = reactive<Record<string, boolean>>({})
const generatingAll = ref(false)
const toast = ref('')
const toastType = ref<'success' | 'warning'>('success')

const form = reactive({ title: '', type: 'sutra', contentText: '', contentUrl: '', source: '', tagsInput: '' })

const filteredMedia = computed(() => {
  if (!search.value.trim()) return media.value
  const q = search.value.toLowerCase()
  return media.value.filter((m: any) => m.title?.toLowerCase().includes(q) || m.source?.toLowerCase().includes(q))
})
const embeddedCount = computed(() => media.value.filter((m: any) => m.has_embedding).length)

onMounted(async () => { media.value = await getMedia() })

function flash(msg: string, type: 'success' | 'warning' = 'success') { toast.value = msg; toastType.value = type; setTimeout(() => { toast.value = '' }, 2500) }

function openAdd() { editingId.value = null; form.title = ''; form.type = 'sutra'; form.contentText = ''; form.contentUrl = ''; form.source = ''; form.tagsInput = ''; showForm.value = true }
function openEdit(m: any) {
  editingId.value = m.id; showForm.value = true
  form.title = m.title || ''; form.type = m.media_type || 'sutra'; form.contentText = m.content_text || ''; form.contentUrl = m.content_url || ''; form.source = m.source || ''; form.tagsInput = (m.tags || []).join(', ')
}
function closeForm() { showForm.value = false; editingId.value = null }

async function handleSave() {
  if (!form.title.trim()) return
  const tags = form.tagsInput.split(',').map(t2 => t2.trim()).filter(Boolean)
  const payload = {
    title: form.title.trim(), media_type: form.type as any,
    content_text: form.type !== 'video' ? (form.contentText || undefined) : undefined,
    content_url: form.type === 'video' ? (form.contentUrl || undefined) : undefined,
    source: form.source.trim() || undefined, tags,
  }
  if (editingId.value) { await updateMedia(editingId.value, payload); flash(t('admin.media.mediaUpdated')) }
  else { await createMedia(payload); flash(t('admin.media.mediaAdded')) }
  closeForm(); media.value = await getMedia()
}

function confirmDelete(m: any) { deleteTarget.value = m }
async function handleDelete() { if (!deleteTarget.value) return; await deleteMedia(deleteTarget.value.id); flash(t('admin.media.mediaDeleted')); deleteTarget.value = null; media.value = await getMedia() }

async function handleGenerateOne(id: string) {
  generatingId[id] = true
  try { await generateEmbedding(id); flash(t('admin.media.embeddingGenerated')); media.value = await getMedia() } catch { flash(t('admin.media.embeddingFailed'), 'warning') }
  finally { generatingId[id] = false }
}

async function handleGenerateAll() {
  generatingAll.value = true
  try { const count = await generateAllEmbeddings(); flash(t('admin.media.generatedCount', { count })) } catch { flash(t('admin.media.batchFailed'), 'warning') }
  finally { generatingAll.value = false; media.value = await getMedia() }
}
</script>
