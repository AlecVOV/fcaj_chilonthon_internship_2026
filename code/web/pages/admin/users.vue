<template>
  <div class="animate-in">
    <div class="mb-6 flex items-center justify-between">
      <h1 class="text-xl font-bold text-neutral-950 dark:text-dark-text">Admin Users</h1>
    </div>

    <div class="mb-6 flex border-b border-neutral-200 dark:border-dark-border">
      <NuxtLink to="/admin" class="tab">Overview</NuxtLink>
      <NuxtLink to="/admin/users" class="tab tab-active">Users</NuxtLink>
      <NuxtLink to="/admin/media" class="tab">Media</NuxtLink>
    </div>

    <div class="grid gap-4 sm:grid-cols-2 mb-6">
      <div class="card"><p class="text-2xs font-medium uppercase tracking-wider text-neutral-950/40 dark:text-white/25">Approved Users</p><p class="mt-2 text-2xl font-bold text-neutral-950 dark:text-dark-text">{{ approvedUsers.length }}</p></div>
      <div class="card"><p class="text-2xs font-medium uppercase tracking-wider text-neutral-950/40 dark:text-white/25">Pending Requests</p><p class="mt-2 text-2xl font-bold text-neutral-950 dark:text-dark-text">{{ pendingUsers.length }}</p></div>
    </div>

    <!-- Pending Requests -->
    <div class="card !p-0 overflow-hidden mb-6">
      <div class="px-5 py-3 border-b border-neutral-200 dark:border-dark-border"><h2 class="text-sm font-semibold text-neutral-950 dark:text-dark-text">Pending Approval</h2></div>
      <div v-if="pendingUsers.length === 0" class="py-8 text-center text-sm text-neutral-950/20 dark:text-white/15">No pending requests.</div>
      <div v-else class="overflow-x-auto">
        <table class="table-base">
          <thead><tr><th>Name</th><th>Email</th><th>Requested</th><th>Actions</th></tr></thead>
          <tbody>
            <tr v-for="u in pendingUsers" :key="u.id">
              <td class="font-medium text-neutral-950 dark:text-dark-text">{{ u.name }}</td>
              <td class="text-neutral-950/50 dark:text-white/30">{{ u.email }}</td>
              <td class="text-xs text-neutral-950/30 dark:text-white/20">{{ dayjs(u.requestedAt).format('MMM D, HH:mm') }}</td>
              <td>
                <div class="flex gap-1">
                  <button @click="handleApprove(u)" class="rounded px-2 py-0.5 text-xs text-success dark:text-success-dark hover:bg-success/10">Approve</button>
                  <button @click="handleReject(u)" class="rounded px-2 py-0.5 text-xs text-critical dark:text-critical-dark hover:bg-critical/10">Reject</button>
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <!-- Approved Users -->
    <div class="card !p-0 overflow-hidden">
      <div class="px-5 py-3 border-b border-neutral-200 dark:border-dark-border"><h2 class="text-sm font-semibold text-neutral-950 dark:text-dark-text">Approved Users</h2></div>
      <div v-if="approvedUsers.length === 0" class="py-8 text-center text-sm text-neutral-950/20 dark:text-white/15">No approved users yet.</div>
      <div v-else class="overflow-x-auto">
        <table class="table-base">
          <thead><tr><th>Name</th><th>Email</th><th>Role</th><th>Actions</th></tr></thead>
          <tbody>
            <tr v-for="u in approvedUsers" :key="u.id">
              <td class="font-medium text-neutral-950 dark:text-dark-text">{{ u.name }}</td>
              <td class="text-neutral-950/50 dark:text-white/30">{{ u.email }}</td>
              <td><span class="badge" :class="u.role === 'admin' ? 'badge-success' : ''">{{ u.role }}</span></td>
              <td>
                <div class="flex gap-1" v-if="u.id !== currentUserId">
                  <button @click="toggleRole(u)" class="rounded px-1.5 py-0.5 text-xs text-interactive-blue hover:bg-interactive-blue/10">{{ u.role === 'admin' ? 'Demote' : 'Promote' }}</button>
                  <button @click="confirmDelete(u)" class="rounded px-1.5 py-0.5 text-xs text-critical dark:text-critical-dark hover:bg-critical/10">Del</button>
                </div>
                <span v-else class="text-xs text-neutral-950/15 dark:text-white/10">You</span>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <!-- Delete Confirm -->
    <div v-if="deleteTarget" class="fixed inset-0 z-50 flex items-center justify-center bg-black/20 backdrop-blur-sm" @click.self="deleteTarget = null">
      <div class="card w-full max-w-sm animate-in" @click.stop>
        <h2 class="mb-2 text-base font-semibold text-neutral-950 dark:text-dark-text">Confirm Delete</h2>
        <p class="text-sm text-neutral-950/50 dark:text-white/30 mb-4">Remove {{ deleteTarget.name }} ({{ deleteTarget.email }})?</p>
        <div class="flex justify-end gap-2"><button @click="deleteTarget = null" class="btn-ghost">Cancel</button><button @click="handleDelete" class="btn-danger">Delete</button></div>
      </div>
    </div>

    <!-- Toast -->
    <Teleport to="body">
      <div v-if="toast" class="fixed bottom-6 right-6 z-[9999] max-w-sm animate-in rounded border border-success/30 bg-white dark:bg-dark-card shadow-subtle-lg p-3">
        <p class="text-sm text-success dark:text-success-dark">{{ toast }}</p>
      </div>
    </Teleport>
  </div>
</template>

<script setup lang="ts">
import { useAuth } from '~/composables/useAuth'
import { useDataService } from '~/composables/useDataService'
import dayjs from 'dayjs'

definePageMeta({ middleware: ['auth', 'admin'] })

const { currentUser, approveUser, rejectUser, getPendingUsers } = useAuth()
const { getUsers, updateUserRole, deleteUser } = useDataService()

const users = ref<any[]>([])
const deleteTarget = ref<any>(null); const toast = ref('')
const currentUserId = computed(() => currentUser.value?.id ?? '')

const pendingUsers = computed(() => getPendingUsers().filter(u => u.status === 'pending'))
const approvedUsers = computed(() => users.value)

let timer: ReturnType<typeof setTimeout>
function flash(msg: string) { toast.value = msg; clearTimeout(timer); timer = setTimeout(() => { toast.value = '' }, 3000) }

onMounted(async () => { users.value = await getUsers() })

async function handleApprove(u: any) {
  const otp = approveUser(u.id); flash(`Approved! OTP: ${otp}`)
  await new Promise(r => setTimeout(r, 200)); users.value = await getUsers()
}

function handleReject(u: any) { rejectUser(u.id); flash('User rejected') }

async function toggleRole(u: any) {
  const r = u.role === 'admin' ? 'user' : 'admin'
  await updateUserRole(u.id, r); flash(`Role set to "${r}"`); users.value = await getUsers()
}

function confirmDelete(u: any) { if (u.id !== currentUserId.value) deleteTarget.value = u }

async function handleDelete() {
  if (!deleteTarget.value) return
  await deleteUser(deleteTarget.value.id); flash(`Deleted ${deleteTarget.value.name}`)
  deleteTarget.value = null; users.value = await getUsers()
}
</script>
