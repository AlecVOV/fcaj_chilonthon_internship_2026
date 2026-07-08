<template>
  <div class="animate-in">
    <div class="mb-6 flex items-center justify-between">
      <h1 class="font-display text-display-sm text-ink dark:text-on-dark">Admin Ambient Sound</h1>
    </div>

    <div class="mb-6 flex border-b border-hairline dark:border-hairline-dark">
      <NuxtLink to="/admin" class="tab">Overview</NuxtLink>
      <NuxtLink to="/admin/users" class="tab">Users</NuxtLink>
      <NuxtLink to="/admin/media" class="tab">Media</NuxtLink>
      <NuxtLink to="/admin/ambient" class="tab tab-active">Ambient</NuxtLink>
    </div>

    <!-- ════════════ PHẦN 1: S3 FILE MANAGEMENT ════════════ -->
    <div class="card !p-0 overflow-hidden mb-8">
      <div class="px-5 py-3 border-b border-hairline dark:border-hairline-dark">
        <h2 class="text-sm font-medium text-ink dark:text-on-dark">1 · S3 File Management</h2>
        <p class="mt-0.5 text-2xs text-ink-muted dark:text-on-dark-soft">
          Upload file MP3 into S3 bucket <code>{{ bucketLabel }}</code>, then copy the link to add into the list below.
        </p>
      </div>

      <div class="p-5 space-y-4">
        <div v-if="!apiConfigured" class="rounded-lg border border-warning/30 bg-warning/10 p-3 text-sm text-warning dark:text-warning">
          ⚠️ Chưa cấu hình <code>NUXT_PUBLIC_API_GATEWAY_URL</code> + Lambda <code>ambient-audio-manager</code>.
          Upload/list S3 will not work. See <code>aws/lambdas/ambient-audio-manager/README.md</code>.
          In the meantime, you can still manually paste S3 links in Section 2.
        </div>

        <!-- Upload -->
        <div class="flex flex-wrap items-center gap-3">
          <input
            ref="fileInput" type="file" accept="audio/*"
            class="block text-sm text-ink-body dark:text-on-dark-soft file:mr-3 file:rounded-md file:border-0 file:bg-primary/10 file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-primary hover:file:bg-primary/20"
            @change="onFilePick"
          />
          <button class="btn-primary" :disabled="!pickedFile || uploading || !apiConfigured" @click="handleUpload">
            {{ uploading ? `Uploading ${uploadProgress}%` : 'Upload lên S3' }}
          </button>
          <button class="btn-ghost text-sm" :disabled="loadingFiles || !apiConfigured" @click="refreshFiles">
            {{ loadingFiles ? 'Đang tải…' : 'Refresh' }}
          </button>
        </div>
        <div v-if="uploading" class="h-1.5 w-full overflow-hidden rounded-full bg-hairline dark:bg-hairline-dark">
          <div class="h-full rounded-full bg-primary transition-all" :style="{ width: uploadProgress + '%' }" />
        </div>

        <!-- File list -->
        <div v-if="s3Files.length === 0" class="py-6 text-center text-sm text-ink-soft dark:text-on-dark-soft/70">
          {{ apiConfigured ? 'Chưa có file nào trong bucket.' : 'Cấu hình backend để xem file trong bucket.' }}
        </div>
        <div v-else class="overflow-x-auto">
          <table class="table-base">
            <thead><tr><th>File name</th><th>S3 Link</th><th>Size</th><th>Actions</th></tr></thead>
            <tbody>
              <tr v-for="f in s3Files" :key="f.url">
                <td class="font-medium text-ink dark:text-on-dark">{{ f.name }}</td>
                <td class="max-w-[280px] truncate"><a :href="f.url" target="_blank" class="link text-sm">{{ f.url }}</a></td>
                <td class="text-xs text-ink-muted dark:text-on-dark-soft whitespace-nowrap">{{ prettySize(f.size) }}</td>
                <td>
                  <div class="flex gap-1">
                    <button class="rounded-md px-1.5 py-0.5 text-sm text-primary hover:bg-primary/10" @click="copyLink(f.url)">Copy link</button>
                    <button class="rounded-md px-1.5 py-0.5 text-sm text-success dark:text-success hover:bg-success/10" @click="useInList(f)">Dùng ↓</button>
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
          <h2 class="text-sm font-medium text-ink dark:text-on-dark">2 · User Display Management</h2>
          <p class="mt-0.5 text-2xs text-ink-muted dark:text-on-dark-soft">Danh sách nhạc user thấy ở trang Focus. Mọi thay đổi áp dụng ngay cho user.</p>
        </div>
        <button class="btn-primary" @click="openAdd">Add sound</button>
      </div>

      <div v-if="loadingSounds" class="py-8 text-center text-sm text-ink-soft dark:text-on-dark-soft/70">Đang tải…</div>
      <div v-else-if="sounds.length === 0" class="py-8 text-center text-sm text-ink-soft dark:text-on-dark-soft/70">Chưa có nhạc nào. Bấm "Add sound".</div>
      <div v-else class="overflow-x-auto">
        <table class="table-base">
          <thead><tr><th>Audio Name</th><th>S3 Link</th><th>Active</th><th>Actions</th></tr></thead>
          <tbody>
            <tr v-for="s in sounds" :key="s.id">
              <td class="font-medium text-ink dark:text-on-dark">{{ s.name }}</td>
              <td class="max-w-[280px] truncate"><a :href="s.url" target="_blank" class="link text-sm">{{ s.url }}</a></td>
              <td>
                <button
                  class="badge" :class="s.isActive ? 'badge-success' : 'badge-warning'"
                  :title="s.isActive ? 'Đang hiển thị cho user — bấm để ẩn' : 'Đang ẩn — bấm để hiện'"
                  @click="toggleActive(s)"
                >{{ s.isActive ? 'Hiện' : 'Ẩn' }}</button>
              </td>
              <td>
                <div class="flex gap-1">
                  <button class="rounded-md px-1.5 py-0.5 text-sm text-ink-muted dark:text-on-dark-soft hover:text-primary" @click="openEdit(s)">Edit</button>
                  <button class="rounded-md px-1.5 py-0.5 text-sm text-error dark:text-error hover:bg-error/10" @click="deleteTarget = s">Del</button>
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
        <h2 class="mb-4 font-display text-lg text-ink dark:text-on-dark">{{ editingId ? 'Edit sound' : 'Add sound' }}</h2>
        <div class="space-y-3">
          <div>
            <label class="block mb-1 text-xs font-medium text-ink-muted dark:text-on-dark-soft">Audio Name</label>
            <input v-model="form.name" class="input" placeholder="VD: Rain, Lo-fi Jazz…" />
          </div>
          <div>
            <label class="block mb-1 text-xs font-medium text-ink-muted dark:text-on-dark-soft">S3 Link (URL)</label>
            <input v-model="form.url" class="input" placeholder="https://…s3….amazonaws.com/…mp3" />
          </div>
          <audio v-if="form.url.trim()" :src="form.url" controls class="w-full mt-1" />
        </div>
        <div class="mt-4 flex justify-end gap-2">
          <button class="btn-ghost" @click="closeForm">Cancel</button>
          <button class="btn-primary" :disabled="!form.name.trim() || !form.url.trim() || saving" @click="handleSave">
            {{ saving ? 'Saving…' : (editingId ? 'Save' : 'Add') }}
          </button>
        </div>
      </div>
    </div>

    <!-- Delete confirm -->
    <div v-if="deleteTarget" class="fixed inset-0 z-50 flex items-center justify-center bg-ink/20 backdrop-blur-sm" @click.self="deleteTarget = null">
      <div class="card w-full max-w-sm animate-in" @click.stop>
        <h2 class="mb-2 font-display text-lg text-ink dark:text-on-dark">Confirm Delete</h2>
        <p class="text-sm text-ink-body dark:text-on-dark-soft mb-4">Xóa "{{ deleteTarget.name }}" khỏi danh sách? (File trên S3 không bị xóa.)</p>
        <div class="flex justify-end gap-2">
          <button class="btn-ghost" @click="deleteTarget = null">Cancel</button>
          <button class="btn-danger" @click="handleDelete">Delete</button>
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
  catch (e: any) { flash(e?.message || 'Không list được file S3', 'warning') }
  finally { loadingFiles.value = false }
}

function onFilePick() { pickedFile.value = fileInput.value?.files?.[0] ?? null }

async function handleUpload() {
  const file = pickedFile.value
  if (!file) return
  uploading.value = true; uploadProgress.value = 0
  try {
    await uploadS3File(file, p => { uploadProgress.value = p })
    flash('Upload xong — bấm "Dùng ↓" để thêm vào danh sách.')
    pickedFile.value = null
    if (fileInput.value) fileInput.value.value = ''
    await refreshFiles()
  } catch (e: any) {
    flash(e?.message || 'Upload thất bại', 'warning')
  } finally {
    uploading.value = false
  }
}

async function copyLink(url: string) {
  try { await navigator.clipboard.writeText(url); flash('Đã copy link.') }
  catch { flash('Không copy được — hãy copy thủ công.', 'warning') }
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
  catch (e: any) { flash(e?.message || 'Không tải được danh sách', 'warning') }
  finally { loadingSounds.value = false }
}

function openAdd() { editingId.value = null; form.name = ''; form.url = ''; showForm.value = true }
function openEdit(s: AmbientSound) { editingId.value = s.id; form.name = s.name; form.url = s.url; showForm.value = true }
function closeForm() { showForm.value = false; editingId.value = null }

async function handleSave() {
  if (!form.name.trim() || !form.url.trim()) return
  saving.value = true
  try {
    if (editingId.value) { await updateSound(editingId.value, { name: form.name.trim(), url: form.url.trim() }); flash('Đã cập nhật.') }
    else { await createSound({ name: form.name.trim(), url: form.url.trim(), sortOrder: sounds.value.length }); flash('Đã thêm.') }
    closeForm()
    await refreshSounds()
  } catch (e: any) { flash(e?.message || 'Lưu thất bại', 'warning') }
  finally { saving.value = false }
}

async function toggleActive(s: AmbientSound) {
  try { await updateSound(s.id, { isActive: !s.isActive }); await refreshSounds() }
  catch (e: any) { flash(e?.message || 'Cập nhật thất bại', 'warning') }
}

async function handleDelete() {
  if (!deleteTarget.value) return
  const t = deleteTarget.value
  try { await deleteSound(t.id); flash(`Đã xóa "${t.name}".`) }
  catch (e: any) { flash(e?.message || 'Xóa thất bại', 'warning') }
  deleteTarget.value = null
  await refreshSounds()
}

onMounted(async () => { await Promise.all([refreshSounds(), refreshFiles()]) })
</script>
