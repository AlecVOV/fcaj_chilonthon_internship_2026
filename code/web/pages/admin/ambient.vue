<template>
  <div class="animate-in">
    <div class="mb-6 flex items-center justify-between">
      <h1 class="font-display text-display-sm text-ink dark:text-on-dark">{{ t('admin.ambient.title') }}</h1>
    </div>

    <div class="mb-6 flex border-b border-hairline dark:border-hairline-dark">
      <NuxtLink to="/admin" class="tab">{{ t('admin.tabOverview') }}</NuxtLink>
      <NuxtLink to="/admin/users" class="tab">{{ t('admin.tabUsers') }}</NuxtLink>
      <NuxtLink to="/admin/media" class="tab">{{ t('admin.tabMedia') }}</NuxtLink>
      <NuxtLink to="/admin/ambient" class="tab tab-active">{{ t('admin.tabAmbient') }}</NuxtLink>
      <NuxtLink to="/admin/feedback" class="tab">{{ t('admin.tabFeedback') }}</NuxtLink>
    </div>

    <!-- ════════════ PHẦN 1: S3 FILE MANAGEMENT ════════════ -->
    <div class="card !p-0 overflow-hidden mb-8">
      <div class="px-5 py-3 border-b border-hairline dark:border-hairline-dark">
        <h2 class="text-sm font-medium text-ink dark:text-on-dark">{{ t('admin.ambient.section1Title') }}</h2>
        <p class="mt-0.5 text-2xs text-ink-muted dark:text-on-dark-soft">
          {{ t('admin.ambient.section1Desc', { bucket: bucketLabel }) }}
        </p>
      </div>

      <div class="p-5 space-y-4">
        <div v-if="!apiConfigured" class="rounded-lg border border-warning/30 bg-warning/10 p-3 text-sm text-warning dark:text-warning" v-html="t('admin.ambient.notConfiguredWarning')" />

        <!-- Upload -->
        <div class="flex flex-wrap items-center gap-3">
          <input
            ref="fileInput" type="file" accept="audio/*"
            class="block text-sm text-ink-body dark:text-on-dark-soft file:mr-3 file:rounded-md file:border-0 file:bg-primary/10 file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-primary hover:file:bg-primary/20"
            @change="onFilePick"
          />
          <button class="btn-primary" :disabled="!pickedFile || uploading || !apiConfigured" @click="handleUpload">
            {{ uploading ? t('admin.ambient.uploading', { progress: uploadProgress }) : t('admin.ambient.uploadToS3') }}
          </button>
          <button class="btn-ghost text-sm" :disabled="loadingFiles || !apiConfigured" @click="refreshFiles">
            {{ loadingFiles ? t('admin.ambient.loadingFiles') : t('admin.ambient.refresh') }}
          </button>
        </div>
        <div v-if="uploading" class="h-1.5 w-full overflow-hidden rounded-full bg-hairline dark:bg-hairline-dark">
          <div class="h-full rounded-full bg-primary transition-all" :style="{ width: uploadProgress + '%' }" />
        </div>

        <!-- File list -->
        <div v-if="s3Files.length === 0" class="py-6 text-center text-sm text-ink-soft dark:text-on-dark-soft/70">
          {{ apiConfigured ? t('admin.ambient.noFilesInBucket') : t('admin.ambient.configureToSeeFiles') }}
        </div>
        <div v-else class="overflow-x-auto">
          <table class="table-base">
            <thead><tr><th>{{ t('admin.ambient.tableFileName') }}</th><th>{{ t('admin.ambient.tableS3Link') }}</th><th>{{ t('admin.ambient.tableSize') }}</th><th>{{ t('admin.ambient.tableActions') }}</th></tr></thead>
            <tbody>
              <tr v-for="f in s3Files" :key="f.url">
                <td class="font-medium text-ink dark:text-on-dark">{{ f.name }}</td>
                <td class="max-w-[280px] truncate"><a :href="f.url" target="_blank" class="link text-sm">{{ f.url }}</a></td>
                <td class="text-xs text-ink-muted dark:text-on-dark-soft whitespace-nowrap">{{ prettySize(f.size) }}</td>
                <td>
                  <div class="flex gap-1">
                    <button class="rounded-md px-1.5 py-0.5 text-sm text-primary hover:bg-primary/10" @click="copyLink(f.url)">{{ t('admin.ambient.copyLink') }}</button>
                    <button class="rounded-md px-1.5 py-0.5 text-sm text-success dark:text-success hover:bg-success/10" @click="useInList(f)">{{ t('admin.ambient.useThis') }}</button>
                  </div>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>

    <!-- ════════════ PHẦN 2: USER DISPLAY MANAGEMENT ════════════ -->
    <div class="card !p-0 overflow-hidden">
      <div class="px-5 py-3 border-b border-hairline dark:border-hairline-dark flex items-center justify-between">
        <div>
          <h2 class="text-sm font-medium text-ink dark:text-on-dark">{{ t('admin.ambient.section2Title') }}</h2>
          <p class="mt-0.5 text-2xs text-ink-muted dark:text-on-dark-soft">{{ t('admin.ambient.section2Desc') }}</p>
        </div>
        <button class="btn-primary" @click="openAdd">{{ t('admin.ambient.addSound') }}</button>
      </div>

      <div v-if="loadingSounds" class="py-8 text-center text-sm text-ink-soft dark:text-on-dark-soft/70">{{ t('admin.ambient.loadingSounds') }}</div>
      <div v-else-if="sounds.length === 0" class="py-8 text-center text-sm text-ink-soft dark:text-on-dark-soft/70">{{ t('admin.ambient.noSoundsYet') }}</div>
      <div v-else class="overflow-x-auto">
        <table class="table-base">
          <thead><tr><th>{{ t('admin.ambient.tableAudioName') }}</th><th>{{ t('admin.ambient.tableS3Link') }}</th><th>{{ t('admin.ambient.tableActive') }}</th><th>{{ t('admin.ambient.tableActions') }}</th></tr></thead>
          <tbody>
            <tr v-for="s in sounds" :key="s.id">
              <td class="font-medium text-ink dark:text-on-dark">{{ s.name }}</td>
              <td class="max-w-[280px] truncate"><a :href="s.url" target="_blank" class="link text-sm">{{ s.url }}</a></td>
              <td>
                <button
                  class="badge" :class="s.isActive ? 'badge-success' : 'badge-warning'"
                  :title="s.isActive ? t('admin.ambient.hideTooltip') : t('admin.ambient.showTooltip')"
                  @click="toggleActive(s)"
                >{{ s.isActive ? t('admin.ambient.show') : t('admin.ambient.hide') }}</button>
              </td>
              <td>
                <div class="flex gap-1">
                  <button class="rounded-md px-1.5 py-0.5 text-sm text-ink-muted dark:text-on-dark-soft hover:text-primary" @click="openEdit(s)">{{ t('admin.ambient.edit') }}</button>
                  <button class="rounded-md px-1.5 py-0.5 text-sm text-error dark:text-error hover:bg-error/10" @click="deleteTarget = s">{{ t('admin.ambient.del') }}</button>
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <!-- Add / Edit dialog -->
    <div v-if="showForm" class="fixed inset-0 z-50 flex items-center justify-center bg-ink/20 backdrop-blur-sm" @click.self="closeForm">
      <div class="card w-full max-w-lg animate-in" @click.stop>
        <h2 class="mb-4 font-display text-lg text-ink dark:text-on-dark">{{ editingId ? t('admin.ambient.editSound') : t('admin.ambient.addSoundTitle') }}</h2>
        <div class="space-y-3">
          <div>
            <label class="block mb-1 text-xs font-medium text-ink-muted dark:text-on-dark-soft">{{ t('admin.ambient.audioNameLabel') }}</label>
            <input v-model="form.name" class="input" :placeholder="t('admin.ambient.audioNamePlaceholder')" />
          </div>
          <div>
            <label class="block mb-1 text-xs font-medium text-ink-muted dark:text-on-dark-soft">{{ t('admin.ambient.s3LinkLabel') }}</label>
            <input v-model="form.url" class="input" :placeholder="t('admin.ambient.s3LinkPlaceholder')" />
          </div>
          <audio v-if="form.url.trim()" :src="form.url" controls class="w-full mt-1" />
        </div>
        <div class="mt-4 flex justify-end gap-2">
          <button class="btn-ghost" @click="closeForm">{{ t('admin.ambient.cancel') }}</button>
          <button class="btn-primary" :disabled="!form.name.trim() || !form.url.trim() || saving" @click="handleSave">
            {{ saving ? t('admin.ambient.saving') : (editingId ? t('admin.ambient.save') : t('admin.ambient.add')) }}
          </button>
        </div>
      </div>
    </div>

    <!-- Delete confirm -->
    <div v-if="deleteTarget" class="fixed inset-0 z-50 flex items-center justify-center bg-ink/20 backdrop-blur-sm" @click.self="deleteTarget = null">
      <div class="card w-full max-w-sm animate-in" @click.stop>
        <h2 class="mb-2 font-display text-lg text-ink dark:text-on-dark">{{ t('admin.ambient.confirmDeleteTitle') }}</h2>
        <p class="text-sm text-ink-body dark:text-on-dark-soft mb-4">{{ t('admin.ambient.confirmDeleteText', { name: deleteTarget.name }) }}</p>
        <div class="flex justify-end gap-2">
          <button class="btn-ghost" @click="deleteTarget = null">{{ t('admin.ambient.cancel') }}</button>
          <button class="btn-danger" @click="handleDelete">{{ t('admin.ambient.delete') }}</button>
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
import { useAmbientSounds, type AmbientSound, type S3File } from '~/composables/useAmbientSounds'
import { useConfig } from '~/composables/useConfig'

definePageMeta({ middleware: ['auth', 'admin'] })

const { listSounds, createSound, updateSound, deleteSound, listS3Files, uploadS3File } = useAmbientSounds()
const { ambientApiUrl } = useConfig()
const { t } = useLocale()
const apiConfigured = computed(() => !!ambientApiUrl.value)
const bucketLabel = 'ambient audio'

// ── Phần 1: S3 ──────────────────────────────────────────────────────────────
const s3Files = ref<S3File[]>([])
const loadingFiles = ref(false)
const fileInput = ref<HTMLInputElement>()
const pickedFile = ref<File | null>(null)
const uploading = ref(false)
const uploadProgress = ref(0)

// ── Phần 2: CRUD ──────────────────────────────────────────────────────────
const sounds = ref<AmbientSound[]>([])
const loadingSounds = ref(false)
const showForm = ref(false)
const editingId = ref<string | null>(null)
const saving = ref(false)
const deleteTarget = ref<AmbientSound | null>(null)
const form = reactive({ name: '', url: '' })

const toast = ref('')
const toastType = ref<'success' | 'warning'>('success')
let toastTimer: ReturnType<typeof setTimeout>
function flash(msg: string, type: 'success' | 'warning' = 'success') { toast.value = msg; toastType.value = type; clearTimeout(toastTimer); toastTimer = setTimeout(() => { toast.value = '' }, 3000) }

function prettySize(bytes: number) {
  if (!bytes) return '--'
  const mb = bytes / (1024 * 1024)
  return mb >= 1 ? `${mb.toFixed(1)} MB` : `${Math.round(bytes / 1024)} KB`
}
// "rain_sound_playlist.mp3" → "Rain Sound Playlist"
function prettyName(filename: string) {
  return filename.replace(/\.[^.]+$/, '').replace(/[_-]+/g, ' ').replace(/\b\w/g, c => c.toUpperCase()).trim()
}

async function refreshFiles() {
  if (!apiConfigured.value) return
  loadingFiles.value = true
  try { s3Files.value = await listS3Files() }
  catch (e: any) { flash(e?.message || t('admin.ambient.listFilesFailedFlash'), 'warning') }
  finally { loadingFiles.value = false }
}

function onFilePick() { pickedFile.value = fileInput.value?.files?.[0] ?? null }

async function handleUpload() {
  const file = pickedFile.value
  if (!file) return
  uploading.value = true; uploadProgress.value = 0
  try {
    await uploadS3File(file, p => { uploadProgress.value = p })
    flash(t('admin.ambient.uploadDoneFlash'))
    pickedFile.value = null
    if (fileInput.value) fileInput.value.value = ''
    await refreshFiles()
  } catch (e: any) {
    flash(e?.message || t('admin.ambient.uploadFailedFlash'), 'warning')
  } finally {
    uploading.value = false
  }
}

async function copyLink(url: string) {
  try { await navigator.clipboard.writeText(url); flash(t('admin.ambient.copiedFlash')) }
  catch { flash(t('admin.ambient.copyFailedFlash'), 'warning') }
}

// Prefill form Phần 2 từ 1 file S3 (thay cho copy-paste thủ công).
function useInList(f: S3File) {
  editingId.value = null
  form.name = prettyName(f.name)
  form.url = f.url
  showForm.value = true
}

// ── Phần 2 CRUD ─────────────────────────────────────────────────────────────
async function refreshSounds() {
  loadingSounds.value = true
  try { sounds.value = await listSounds(false) }
  catch (e: any) { flash(e?.message || t('admin.ambient.loadSoundsFailedFlash'), 'warning') }
  finally { loadingSounds.value = false }
}

function openAdd() { editingId.value = null; form.name = ''; form.url = ''; showForm.value = true }
function openEdit(s: AmbientSound) { editingId.value = s.id; form.name = s.name; form.url = s.url; showForm.value = true }
function closeForm() { showForm.value = false; editingId.value = null }

async function handleSave() {
  if (!form.name.trim() || !form.url.trim()) return
  saving.value = true
  try {
    if (editingId.value) { await updateSound(editingId.value, { name: form.name.trim(), url: form.url.trim() }); flash(t('admin.ambient.updatedFlash')) }
    else { await createSound({ name: form.name.trim(), url: form.url.trim(), sortOrder: sounds.value.length }); flash(t('admin.ambient.addedFlash')) }
    closeForm()
    await refreshSounds()
  } catch (e: any) { flash(e?.message || t('admin.ambient.saveFailedFlash'), 'warning') }
  finally { saving.value = false }
}

async function toggleActive(s: AmbientSound) {
  try { await updateSound(s.id, { isActive: !s.isActive }); await refreshSounds() }
  catch (e: any) { flash(e?.message || t('admin.ambient.updateFailedFlash'), 'warning') }
}

async function handleDelete() {
  if (!deleteTarget.value) return
  const t2 = deleteTarget.value
  try { await deleteSound(t2.id); flash(t('admin.ambient.deletedFlash', { name: t2.name })) }
  catch (e: any) { flash(e?.message || t('admin.ambient.deleteFailedFlash'), 'warning') }
  deleteTarget.value = null
  await refreshSounds()
}

onMounted(async () => { await Promise.all([refreshSounds(), refreshFiles()]) })
</script>
