<template>
  <div class="animate-in">
    <div class="mb-6 flex items-center justify-between">
      <h1 class="font-display text-display-sm text-ink dark:text-on-dark">{{ t('admin.feedback.title') }}</h1>
    </div>

    <div class="mb-6 flex border-b border-hairline dark:border-hairline-dark">
      <NuxtLink to="/admin" class="tab">{{ t('admin.tabOverview') }}</NuxtLink>
      <NuxtLink to="/admin/users" class="tab">{{ t('admin.tabUsers') }}</NuxtLink>
      <NuxtLink to="/admin/media" class="tab">{{ t('admin.tabMedia') }}</NuxtLink>
      <NuxtLink to="/admin/ambient" class="tab">{{ t('admin.tabAmbient') }}</NuxtLink>
      <NuxtLink to="/admin/feedback" class="tab tab-active">{{ t('admin.tabFeedback') }}</NuxtLink>
    </div>

    <div v-if="loadError" class="mb-6 rounded-lg border border-error/30 bg-error/5 p-4">
      <p class="text-sm font-medium text-error dark:text-error">⚠️ {{ loadError }}</p>
      <p class="mt-1 text-xs text-ink-muted dark:text-on-dark-soft" v-html="t('admin.feedback.migrationHint')" />
    </div>

    <div class="grid gap-4 sm:grid-cols-3 mb-6">
      <div class="card"><p class="text-2xs font-medium uppercase tracking-wider text-ink-muted dark:text-on-dark-soft">{{ t('admin.feedback.total') }}</p><p class="mt-2 font-display text-2xl text-ink dark:text-on-dark">{{ items.length }}</p></div>
      <div class="card"><p class="text-2xs font-medium uppercase tracking-wider text-ink-muted dark:text-on-dark-soft">{{ t('admin.feedback.new') }}</p><p class="mt-2 font-display text-2xl text-ink dark:text-on-dark">{{ counts.new }}</p></div>
      <div class="card"><p class="text-2xs font-medium uppercase tracking-wider text-ink-muted dark:text-on-dark-soft">{{ t('admin.feedback.resolved') }}</p><p class="mt-2 font-display text-2xl text-ink dark:text-on-dark">{{ counts.resolved }}</p></div>
    </div>

    <div class="card !p-0 overflow-hidden">
      <div class="px-5 py-3 border-b border-hairline dark:border-hairline-dark"><h2 class="text-sm font-medium text-ink dark:text-on-dark">{{ t('admin.feedback.allFeedback') }}</h2></div>
      <div v-if="isLoading" class="py-8 text-center text-sm text-ink-soft dark:text-on-dark-soft/70">{{ t('admin.feedback.loading') }}</div>
      <div v-else-if="items.length === 0" class="py-8 text-center text-sm text-ink-soft dark:text-on-dark-soft/70">{{ t('admin.feedback.noFeedbackYet') }}</div>
      <div v-else class="overflow-x-auto">
        <table class="table-base">
          <thead><tr><th>{{ t('admin.feedback.tableFrom') }}</th><th>{{ t('admin.feedback.tableMessage') }}</th><th>{{ t('admin.feedback.tableStatus') }}</th><th>{{ t('admin.feedback.tableSent') }}</th><th>{{ t('admin.feedback.tableActions') }}</th></tr></thead>
          <tbody>
            <tr v-for="f in items" :key="f.id">
              <td class="text-ink-body dark:text-on-dark-soft whitespace-nowrap">
                <div class="font-medium text-ink dark:text-on-dark">{{ f.userName }}</div>
                <div class="text-xs text-ink-muted dark:text-on-dark-soft">{{ f.userEmail }}</div>
              </td>
              <td class="text-ink-body dark:text-on-dark-soft max-w-md whitespace-pre-wrap">{{ f.message }}</td>
              <td><span class="badge" :class="statusBadgeClass(f.status)">{{ f.status }}</span></td>
              <td class="text-xs text-ink-muted dark:text-on-dark-soft whitespace-nowrap">{{ dayjs(f.createdAt).format('MMM D, HH:mm') }}</td>
              <td>
                <div class="flex gap-1">
                  <button v-if="f.status !== 'read'" @click="setStatus(f, 'read')" class="rounded-md px-1.5 py-0.5 text-sm text-primary hover:bg-primary/10">{{ t('admin.feedback.markRead') }}</button>
                  <button v-if="f.status !== 'resolved'" @click="setStatus(f, 'resolved')" class="rounded-md px-1.5 py-0.5 text-sm text-success dark:text-success hover:bg-success/10">{{ t('admin.feedback.resolve') }}</button>
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <!-- Toast -->
    <Teleport to="body">
      <div v-if="toast" class="fixed bottom-6 right-6 z-[9999] max-w-sm animate-in rounded-lg border border-success/30 bg-canvas dark:bg-surface-dark-elevated p-4">
        <p class="text-sm text-success dark:text-success">{{ toast }}</p>
      </div>
    </Teleport>
  </div>
</template>

<script setup lang="ts">
import { useFeedback, type FeedbackItem, type FeedbackStatus } from '~/composables/useFeedback'
import dayjs from 'dayjs'

definePageMeta({ middleware: ['auth', 'admin'] })

const { listFeedback, updateFeedbackStatus } = useFeedback()
const { t } = useLocale()

const items = ref<FeedbackItem[]>([])
const isLoading = ref(false)
const loadError = ref('')
const toast = ref('')

const counts = computed(() => ({
  new: items.value.filter(f => f.status === 'new').length,
  resolved: items.value.filter(f => f.status === 'resolved').length,
}))

function statusBadgeClass(status: FeedbackStatus) {
  if (status === 'new') return 'badge-coral'
  if (status === 'resolved') return 'badge-success'
  return ''
}

let timer: ReturnType<typeof setTimeout>
function flash(msg: string) { toast.value = msg; clearTimeout(timer); timer = setTimeout(() => { toast.value = '' }, 4000) }

async function refresh() {
  isLoading.value = true
  loadError.value = ''
  try {
    items.value = await listFeedback()
  } catch (e: any) {
    loadError.value = e?.message || t('admin.feedback.loadFailed')
  } finally {
    isLoading.value = false
  }
}

onMounted(refresh)

async function setStatus(f: FeedbackItem, status: FeedbackStatus) {
  try {
    await updateFeedbackStatus(f.id, status)
    f.status = status
    flash(t('admin.feedback.markedAsFlash', { status }))
  } catch (e: any) {
    flash(e?.message || t('admin.feedback.updateFailedFlash'))
  }
}
</script>
