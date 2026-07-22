<template>
  <div class="animate-in">
    <div class="mb-6 flex items-center justify-between">
      <h1 class="font-display text-display-sm text-ink dark:text-on-dark">{{ t('admin.users.title') }}</h1>
    </div>

    <div class="mb-6 flex border-b border-hairline dark:border-hairline-dark">
      <NuxtLink to="/admin" class="tab">{{ t('admin.tabOverview') }}</NuxtLink>
      <NuxtLink to="/admin/users" class="tab tab-active">{{ t('admin.tabUsers') }}</NuxtLink>
      <NuxtLink to="/admin/media" class="tab">{{ t('admin.tabMedia') }}</NuxtLink>
      <NuxtLink to="/admin/ambient" class="tab">{{ t('admin.tabAmbient') }}</NuxtLink>
      <NuxtLink to="/admin/feedback" class="tab">{{ t('admin.tabFeedback') }}</NuxtLink>
    </div>

    <div v-if="loadError" class="mb-6 rounded-lg border border-error/30 bg-error/5 p-4">
      <p class="text-sm font-medium text-error dark:text-error">⚠️ {{ loadError }}</p>
      <p class="mt-1 text-xs text-ink-muted dark:text-on-dark-soft" v-html="t('admin.users.migrationHint')" />
    </div>

    <div class="grid gap-4 sm:grid-cols-2 mb-6">
      <div class="card"><p class="text-2xs font-medium uppercase tracking-wider text-ink-muted dark:text-on-dark-soft">{{ t('admin.users.approvedUsers') }}</p><p class="mt-2 font-display text-2xl text-ink dark:text-on-dark">{{ approvedUsers.length }}</p></div>
      <div class="card"><p class="text-2xs font-medium uppercase tracking-wider text-ink-muted dark:text-on-dark-soft">{{ t('admin.users.pendingRequests') }}</p><p class="mt-2 font-display text-2xl text-ink dark:text-on-dark">{{ pendingUsers.length }}</p></div>
    </div>

    <!-- Pending Requests -->
    <div class="card !p-0 overflow-hidden mb-6">
      <div class="px-5 py-3 border-b border-hairline dark:border-hairline-dark"><h2 class="text-sm font-medium text-ink dark:text-on-dark">{{ t('admin.users.pendingApproval') }}</h2></div>
      <div v-if="pendingUsers.length === 0" class="py-8 text-center text-sm text-ink-soft dark:text-on-dark-soft/70">{{ t('admin.users.noPendingRequests') }}</div>
      <div v-else class="overflow-x-auto">
        <table class="table-base">
          <thead><tr><th>{{ t('admin.users.tableName') }}</th><th>{{ t('admin.users.tableEmail') }}</th><th>{{ t('admin.users.tableRequested') }}</th><th>{{ t('admin.users.tableActions') }}</th></tr></thead>
          <tbody>
            <tr v-for="u in pendingUsers" :key="u.id">
              <td class="font-medium text-ink dark:text-on-dark">{{ u.name }}</td>
              <td class="text-ink-body dark:text-on-dark-soft">{{ u.email }}</td>
              <td class="text-xs text-ink-muted dark:text-on-dark-soft">{{ dayjs(u.requestedAt).format('MMM D, HH:mm') }}</td>
              <td>
                <div class="flex gap-1">
                  <button @click="handleApprove(u)" class="rounded-md px-2 py-0.5 text-sm text-success dark:text-success hover:bg-success/10">{{ t('admin.users.approve') }}</button>
                  <button @click="handleReject(u)" class="rounded-md px-2 py-0.5 text-sm text-error dark:text-error hover:bg-error/10">{{ t('admin.users.reject') }}</button>
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <!-- Approved Users -->
    <div class="card !p-0 overflow-hidden">
      <div class="px-5 py-3 border-b border-hairline dark:border-hairline-dark"><h2 class="text-sm font-medium text-ink dark:text-on-dark">{{ t('admin.users.approvedUsers') }}</h2></div>
      <div v-if="approvedUsers.length === 0" class="py-8 text-center text-sm text-ink-soft dark:text-on-dark-soft/70">{{ t('admin.users.noApprovedUsers') }}</div>
      <div v-else class="overflow-x-auto">
        <table class="table-base">
          <thead><tr><th>{{ t('admin.users.tableName') }}</th><th>{{ t('admin.users.tableEmail') }}</th><th>{{ t('admin.users.tableRole') }}</th><th>{{ t('admin.users.tableActions') }}</th></tr></thead>
          <tbody>
            <tr v-for="u in approvedUsers" :key="u.id">
              <td class="font-medium text-ink dark:text-on-dark">{{ u.name }}</td>
              <td class="text-ink-body dark:text-on-dark-soft">{{ u.email }}</td>
              <td><span class="badge" :class="u.role === 'admin' ? 'badge-coral' : 'badge-success'">{{ u.role }}</span></td>
              <td>
                <div class="flex gap-1" v-if="u.id !== currentUserId">
                  <button @click="toggleRole(u)" class="rounded-md px-1.5 py-0.5 text-sm text-primary hover:bg-primary/10">{{ u.role === 'admin' ? t('admin.users.demote') : t('admin.users.promote') }}</button>
                  <button @click="confirmDelete(u)" class="rounded-md px-1.5 py-0.5 text-sm text-error dark:text-error hover:bg-error/10">{{ t('admin.users.del') }}</button>
                </div>
                <span v-else class="text-sm text-ink-soft dark:text-on-dark-soft/50">{{ t('admin.users.you') }}</span>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <!-- Rejected Users -->
    <div v-if="rejectedUsers.length" class="card !p-0 overflow-hidden mt-6">
      <div class="px-5 py-3 border-b border-hairline dark:border-hairline-dark"><h2 class="text-sm font-medium text-ink dark:text-on-dark">{{ t('admin.users.rejected') }}</h2></div>
      <div class="overflow-x-auto">
        <table class="table-base">
          <thead><tr><th>{{ t('admin.users.tableName') }}</th><th>{{ t('admin.users.tableEmail') }}</th><th>{{ t('admin.users.tableActions') }}</th></tr></thead>
          <tbody>
            <tr v-for="u in rejectedUsers" :key="u.id">
              <td class="font-medium text-ink dark:text-on-dark">{{ u.name }}</td>
              <td class="text-ink-body dark:text-on-dark-soft">{{ u.email }}</td>
              <td>
                <div class="flex gap-1">
                  <button @click="reApprove(u)" class="rounded-md px-2 py-0.5 text-sm text-success dark:text-success hover:bg-success/10">{{ t('admin.users.approve') }}</button>
                  <button @click="setPending(u)" class="rounded-md px-2 py-0.5 text-sm text-primary hover:bg-primary/10">{{ t('admin.users.setPending') }}</button>
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <!-- Delete Confirm -->
    <div v-if="deleteTarget" class="fixed inset-0 z-50 flex items-center justify-center bg-ink/20 backdrop-blur-sm" @click.self="deleteTarget = null">
      <div class="card w-full max-w-sm animate-in" @click.stop>
        <h2 class="mb-2 font-display text-lg text-ink dark:text-on-dark">{{ t('admin.users.confirmDeleteTitle') }}</h2>
        <p class="text-sm text-ink-body dark:text-on-dark-soft mb-4">{{ t('admin.users.confirmDeleteText', { name: deleteTarget.name, email: deleteTarget.email }) }}</p>
        <div class="flex justify-end gap-2"><button @click="deleteTarget = null" class="btn-ghost">{{ t('admin.users.cancel') }}</button><button @click="handleDelete" class="btn-danger">{{ t('admin.users.delete') }}</button></div>
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
import { useAuth } from '~/composables/useAuth'
import { useDataService } from '~/composables/useDataService'
import dayjs from 'dayjs'

definePageMeta({ middleware: ['auth', 'admin'] })

const { currentUser, approveUser, rejectUser, getPendingUsers, getRejectedUsers, setUserStatus } = useAuth()
const { getUsers, updateUserRole, deleteUser } = useDataService()
const { t } = useLocale()

// Single source of truth, loaded from Supabase (by public.users.status).
const pendingUsers = ref<any[]>([])
const approvedUsers = ref<any[]>([])
const rejectedUsers = ref<any[]>([])
const deleteTarget = ref<any>(null); const toast = ref('')
const loadError = ref('')
const currentUserId = computed(() => currentUser.value?.id ?? '')

let timer: ReturnType<typeof setTimeout>
function flash(msg: string) { toast.value = msg; clearTimeout(timer); timer = setTimeout(() => { toast.value = '' }, 4000) }

async function refresh() {
  loadError.value = ''
  try {
    const [pending, approved, rejected] = await Promise.all([getPendingUsers(), getUsers(), getRejectedUsers()])
    pendingUsers.value = pending.filter(u => u.status === 'pending')
    approvedUsers.value = approved
    rejectedUsers.value = rejected
  } catch (e: any) {
    loadError.value = e?.message || t('admin.users.loadFailed')
  }
}

onMounted(refresh)

async function handleApprove(u: any) {
  try {
    await approveUser(u.id)
    flash(t('admin.users.approvedFlash', { email: u.email }))
    await refresh()
  } catch (e: any) { flash(e?.message || t('admin.users.approveFailed')) }
}

async function handleReject(u: any) {
  try { await rejectUser(u.id); flash(t('admin.users.rejectedFlash', { email: u.email })); await refresh() }
  catch (e: any) { flash(e?.message || t('admin.users.rejectFailed')) }
}

async function reApprove(u: any) {
  try { await approveUser(u.id); flash(t('admin.users.reApprovedFlash', { email: u.email })); await refresh() }
  catch (e: any) { flash(e?.message || t('admin.users.approveFailed')) }
}

async function setPending(u: any) {
  try { await setUserStatus(u.id, 'pending'); flash(t('admin.users.pendingFlash', { email: u.email })); await refresh() }
  catch (e: any) { flash(e?.message || t('admin.users.updateFailed')) }
}

async function toggleRole(u: any) {
  const r = u.role === 'admin' ? 'user' : 'admin'
  try { await updateUserRole(u.id, r); flash(t('admin.users.roleSetFlash', { role: r })); await refresh() }
  catch (e: any) { flash(e?.message || t('admin.users.updateFailed')) }
}

function confirmDelete(u: any) { if (u.id !== currentUserId.value) deleteTarget.value = u }

async function handleDelete() {
  if (!deleteTarget.value) return
  const target = deleteTarget.value
  try { await deleteUser(target.id); flash(t('admin.users.deletedFlash', { name: target.name })) }
  catch (e: any) { flash(e?.message || t('admin.users.deleteFailed')) }
  deleteTarget.value = null
  await refresh()
}
</script>
