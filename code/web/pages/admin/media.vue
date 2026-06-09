<template>
  <div class="animate-in">
    <div class="mb-6 flex items-center justify-between">
      <h1 class="text-xl font-bold text-neutral-950 dark:text-dark-text">Admin Media</h1>
      <div class="flex gap-2">
        <button @click="handleGenerateAll" class="btn-outline text-xs" :disabled="generatingAll">{{ generatingAll ? 'Generating...' : 'Generate All Embeddings' }}</button>
        <button @click="openAdd" class="btn-primary">Add Media</button>
      </div>
    </div>

    <div class="mb-6 flex border-b border-neutral-200 dark:border-dark-border">
      <NuxtLink to="/admin" class="tab">Overview</NuxtLink>
      <NuxtLink to="/admin/users" class="tab">Users</NuxtLink>
      <NuxtLink to="/admin/media" class="tab tab-active">Media</NuxtLink>
    </div>

    <div class="grid gap-4 sm:grid-cols-2 mb-6">
      <div class="card"><p class="text-2xs font-medium uppercase tracking-wider text-neutral-950/40 dark:text-white/25">Total Items</p><p class="mt-2 text-2xl font-bold text-neutral-950 dark:text-dark-text">{{ media.length }}</p></div>
      <div class="card"><p class="text-2xs font-medium uppercase tracking-wider text-neutral-950/40 dark:text-white/25">Embedded</p><p class="mt-2 text-2xl font-bold text-neutral-950 dark:text-dark-text">{{ embeddedCount }} / {{ media.length }}</p></div>
    </div>

    <div class="card !p-0 overflow-hidden">
      <div class="px-5 py-3 border-b border-neutral-200 dark:border-dark-border flex items-center justify-between">
        <h2 class="text-sm font-semibold text-neutral-950 dark:text-dark-text">Media Library</h2>
        <input v-model="search" class="input w-64 text-xs" placeholder="Search..." />
      </div>
      <div v-if="media.length === 0" class="py-12 text-center text-sm text-neutral-950/20 dark:text-white/15">No media yet. Click "Add Media" to create one.</div>
      <div v-else class="overflow-x-auto">
        <table class="table-base">
          <thead><tr><th>Title</th><th>Type</th><th>Content</th><th>Source</th><th>Embedded</th><th>Actions</th></tr></thead>
          <tbody>
            <tr v-for="m in filteredMedia" :key="m.id">
              <td class="font-medium text-neutral-950 dark:text-dark-text">{{ m.title }}</td>
              <td class="text-neutral-950/50 dark:text-white/30">{{ m.media_type }}</td>
              <td class="text-neutral-950/50 dark:text-white/30 max-w-[200px] truncate">
                <a v-if="m.content_url" :href="m.content_url" target="_blank" class="link text-xs">{{ m.content_url }}</a>
                <span v-else>{{ m.content_text || '--' }}</span>
              </td>
              <td class="text-neutral-950/50 dark:text-white/30 max-w-[150px] truncate">{{ m.source || '--' }}</td>
              <td><span class="badge" :class="m.has_embedding ? 'badge-success' : 'badge-warning'">{{ m.has_embedding ? 'Yes' : 'No' }}</span></td>
              <td>
                <div class="flex gap-1">
                  <button v-if="!m.has_embedding && !generatingId[m.id]" @click="handleGenerateOne(m.id)" class="rounded px-1.5 py-0.5 text-xs text-interactive-blue hover:bg-interactive-blue/10">Embed</button>
                  <span v-if="generatingId[m.id]" class="text-xs text-neutral-950/30 dark:text-white/20">Generating...</span>
                  <button @click="openEdit(m)" class="rounded px-1.5 py-0.5 text-xs text-neutral-950/30 dark:text-white/20 hover:text-interactive-blue">Edit</button>
                  <button @click="confirmDelete(m)" class="rounded px-1.5 py-0.5 text-xs text-critical dark:text-critical-dark hover:bg-critical/10">Del</button>
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <!-- Add / Edit Dialog -->
    <div v-if="showForm" class="fixed inset-0 z-50 flex items-center justify-center bg-black/20 backdrop-blur-sm" @click.self="closeForm">
      <div class="card w-full max-w-lg animate-in" @click.stop>
        <h2 class="mb-4 text-base font-semibold text-neutral-950 dark:text-dark-text">{{ editingId ? 'Edit Media' : 'Add Media' }}</h2>
        <div class="space-y-3">
          <div><label class="block mb-1 text-xs font-medium text-neutral-950/50 dark:text-white/30">Title</label><input v-model="form.title" class="input" placeholder="Media title" /></div>
          <div><label class="block mb-1 text-xs font-medium text-neutral-950/50 dark:text-white/30">Type</label><select v-model="form.type" class="input"><option value="sutra">Sutra / Text</option><option value="audio">Audio</option><option value="video">Video</option></select></div>
          <div v-if="form.type === 'video'"><label class="block mb-1 text-xs font-medium text-neutral-950/50 dark:text-white/30">Video URL</label><input v-model="form.contentUrl" class="input" placeholder="https://youtu.be/..." /></div>
          <div v-else><label class="block mb-1 text-xs font-medium text-neutral-950/50 dark:text-white/30">Content Text</label><textarea v-model="form.contentText" class="input" rows="3" placeholder="Paste full text..." /></div>
          <div><label class="block mb-1 text-xs font-medium text-neutral-950/50 dark:text-white/30">Source</label><input v-model="form.source" class="input" placeholder="Source name" /></div>
          <div><label class="block mb-1 text-xs font-medium text-neutral-950/50 dark:text-white/30">Tags (comma)</label><input v-model="form.tagsInput" class="input" placeholder="tag1, tag2" /></div>
        </div>
        <div class="mt-4 flex justify-end gap-2">
          <button @click="closeForm" class="btn-ghost">Cancel</button>
          <button @click="handleSave" class="btn-primary" :disabled="!form.title.trim()">{{ editingId ? 'Save' : 'Add' }}</button>
        </div>
      </div>
    </div>

    <!-- Delete Confirm -->
    <div v-if="deleteTarget" class="fixed inset-0 z-50 flex items-center justify-center bg-black/20 backdrop-blur-sm" @click.self="deleteTarget = null">
      <div class="card w-full max-w-sm animate-in" @click.stop>
        <h2 class="mb-2 text-base font-semibold text-neutral-950 dark:text-dark-text">Confirm Delete</h2>
        <p class="text-sm text-neutral-950/50 dark:text-white/30 mb-4">Remove "{{ deleteTarget.title }}"?</p>
        <div class="flex justify-end gap-2">
          <button @click="deleteTarget = null" class="btn-ghost">Cancel</button>
          <button @click="handleDelete" class="btn-danger">Delete</button>
        </div>
      </div>
    </div>

    <!-- Toast -->
    <Teleport to="body">
      <div v-if="toast" class="fixed bottom-6 right-6 z-[9999] max-w-sm animate-in rounded border bg-white dark:bg-dark-card shadow-subtle-lg p-3" :class="toastType === 'success' ? 'border-success/30' : 'border-warning/30'">
        <p class="text-sm" :class="toastType === 'success' ? 'text-success dark:text-success-dark' : 'text-warning dark:text-warning-dark'">{{ toast }}</p>
      </div>
    </Teleport>
  </div>
</template>

<script setup lang="ts">
import { useDataService } from '~/composables/useDataService'

definePageMeta({ middleware: ['auth', 'admin'] })

const { getMedia, createMedia, updateMedia, deleteMedia, generateEmbedding, generateAllEmbeddings } = useDataService()

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
  const tags = form.tagsInput.split(',').map(t => t.trim()).filter(Boolean)
  const payload = {
    title: form.title.trim(), media_type: form.type as any,
    content_text: form.type !== 'video' ? (form.contentText || undefined) : undefined,
    content_url: form.type === 'video' ? (form.contentUrl || undefined) : undefined,
    source: form.source.trim() || undefined, tags,
  }
  if (editingId.value) { await updateMedia(editingId.value, payload); flash('Media updated') }
  else { await createMedia(payload); flash('Media added') }
  closeForm(); media.value = await getMedia()
}

function confirmDelete(m: any) { deleteTarget.value = m }
async function handleDelete() { if (!deleteTarget.value) return; await deleteMedia(deleteTarget.value.id); flash('Media deleted'); deleteTarget.value = null; media.value = await getMedia() }

async function handleGenerateOne(id: string) {
  generatingId[id] = true
  try { await generateEmbedding(id); flash('Embedding generated'); media.value = await getMedia() } catch { flash('Embedding failed', 'warning') }
  finally { generatingId[id] = false }
}

async function handleGenerateAll() {
  generatingAll.value = true
  try { const count = await generateAllEmbeddings(); flash(`Generated ${count} embedding(s)`) } catch { flash('Batch failed', 'warning') }
  finally { generatingAll.value = false; media.value = await getMedia() }
}
</script>
