<template>
  <div class="animate-in">
    <div class="mb-6 flex items-center justify-between">
      <h1 class="font-display text-display-sm text-ink dark:text-on-dark">{{ t('admin.announcements.title') }}</h1>
      <button @click="openAdd" class="btn-primary text-sm">{{ t('admin.announcements.newAction') }}</button>
    </div>

    <div class="mb-6 flex border-b border-hairline dark:border-hairline-dark">
      <NuxtLink to="/admin" class="tab">{{ t('admin.tabOverview') }}</NuxtLink>
      <NuxtLink to="/admin/users" class="tab">{{ t('admin.tabUsers') }}</NuxtLink>
      <NuxtLink to="/admin/media" class="tab">{{ t('admin.tabMedia') }}</NuxtLink>
      <NuxtLink to="/admin/ambient" class="tab">{{ t('admin.tabAmbient') }}</NuxtLink>
      <NuxtLink to="/admin/feedback" class="tab">{{ t('admin.tabFeedback') }}</NuxtLink>
      <NuxtLink to="/admin/announcements" class="tab tab-active">{{ t('admin.tabAnnouncements') }}</NuxtLink>
      <NuxtLink to="/admin/analytics" class="tab">{{ t('admin.tabAnalytics') }}</NuxtLink>
    </div>

    <div v-if="loadError" class="mb-4 rounded-lg border border-error/30 bg-error/5 p-3 text-sm text-error dark:text-error">{{ loadError }}</div>

    <!-- Add Dialog -->
    <div v-if="showAdd" class="fixed inset-0 z-50 flex items-center justify-center bg-ink/20 backdrop-blur-sm" @click.self="showAdd = false">
      <div class="card w-full max-w-md animate-in" @click.stop>
        <h2 class="mb-4 font-display text-lg text-ink dark:text-on-dark">{{ t('admin.announcements.newAction') }}</h2>
        <div class="space-y-3">
          <div>
            <label class="block mb-1 text-xs font-medium text-ink-muted dark:text-on-dark-soft">{{ t('admin.announcements.titleLabel') }}</label>
            <input v-model="newTitle" class="input" :placeholder="t('admin.announcements.titlePlaceholder')" />
          </div>
          <div>
            <label class="block mb-1 text-xs font-medium text-ink-muted dark:text-on-dark-soft">{{ t('admin.announcements.messageLabel') }}</label>
            <textarea v-model="newMessage" class="input resize-y" rows="4" :placeholder="t('admin.announcements.messagePlaceholder')" />
          </div>
        </div>
        <p v-if="addError" class="mt-3 text-sm text-error dark:text-error">{{ addError }}</p>
        <div class="mt-4 flex justify-end gap-2">
          <button @click="showAdd = false" class="btn-ghost">{{ t('common.cancel') }}</button>
          <button @click="handleAdd" class="btn-primary" :disabled="!newTitle.trim() || !newMessage.trim() || saving">{{ saving ? t('common.saving') : t('common.add') }}</button>
        </div>
      </div>
    </div>

    <div class="card !p-0 overflow-hidden">
      <div v-if="isLoading" class="py-8 text-center text-sm text-ink-soft dark:text-on-dark-soft/70">{{ t('common.loading') }}</div>
      <div v-else-if="items.length === 0" class="py-8 text-center text-sm text-ink-soft dark:text-on-dark-soft/70">{{ t('announcements.empty') }}</div>
      <table v-else class="table-base">
        <thead><tr><th>{{ t('admin.announcements.titleLabel') }}</th><th>{{ t('admin.announcements.messageLabel') }}</th><th>{{ t('admin.feedback.tableSent') }}</th><th class="w-16 text-right">{{ t('tasks.tableActions') }}</th></tr></thead>
        <tbody>
          <tr v-for="a in items" :key="a.id">
            <td class="font-medium text-ink dark:text-on-dark whitespace-nowrap">{{ a.title }}</td>
            <td class="text-ink-body dark:text-on-dark-soft max-w-md whitespace-pre-wrap">{{ a.message }}</td>
            <td class="text-xs text-ink-muted dark:text-on-dark-soft whitespace-nowrap">{{ dayjs(a.createdAt).format('MMM D, HH:mm') }}</td>
            <td class="text-right"><button @click="handleDelete(a)" class="link text-sm text-error dark:text-error">{{ t('tasks.delete') }}</button></td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>

<script setup lang="ts">
import { useAnnouncements, type Announcement } from '~/composables/useAnnouncements'
import dayjs from 'dayjs'

definePageMeta({ middleware: ['auth', 'admin'] })

const { listAnnouncements, createAnnouncement, deleteAnnouncement } = useAnnouncements()
const { t } = useLocale()

const items = ref<Announcement[]>([])
const isLoading = ref(false)
const loadError = ref('')

const showAdd = ref(false)
const newTitle = ref('')
const newMessage = ref('')
const addError = ref('')
const saving = ref(false)

function openAdd() { newTitle.value = ''; newMessage.value = ''; addError.value = ''; showAdd.value = true }

async function refresh() {
  isLoading.value = true; loadError.value = ''
  try { items.value = await listAnnouncements() }
  catch (e: any) { loadError.value = e?.message || t('announcements.empty') }
  finally { isLoading.value = false }
}
onMounted(refresh)

async function handleAdd() {
  if (!newTitle.value.trim() || !newMessage.value.trim() || saving.value) return
  saving.value = true; addError.value = ''
  try {
    await createAnnouncement(newTitle.value, newMessage.value)
    showAdd.value = false
    await refresh()
  } catch (e: any) {
    addError.value = e?.message || t('tasks.addFailed')
  } finally {
    saving.value = false
  }
}

async function handleDelete(a: Announcement) {
  try {
    await deleteAnnouncement(a.id)
    items.value = items.value.filter(x => x.id !== a.id)
  } catch { /* keep the row visible if delete failed — user can retry */ }
}
</script>
