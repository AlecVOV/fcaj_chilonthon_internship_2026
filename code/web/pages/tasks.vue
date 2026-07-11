<template>
  <div class="animate-in">
    <div class="mb-6 flex items-center justify-between">
      <h1 class="font-display text-display-sm text-ink dark:text-on-dark">Tasks</h1>
      <div class="flex gap-2">
        <NuxtLink to="/agent" class="btn-outline text-sm">Add via Agent</NuxtLink>
        <button @click="openAdd" class="btn-primary text-sm">+ Add Task</button>
      </div>
    </div>

    <div class="mb-4 flex flex-wrap gap-2">
      <button v-for="tab in tabs" :key="tab.key" @click="activeTab = tab.key"
        class="rounded-pill px-3.5 py-1.5 text-sm font-medium transition-colors"
        :class="activeTab === tab.key ? tab.activeClass : tab.idleClass">
        {{ tab.label }} <span class="ml-1 opacity-70">({{ tab.count }})</span>
      </button>
    </div>

    <!-- Manual Add Dialog -->
    <div v-if="showAdd" class="fixed inset-0 z-50 flex items-center justify-center bg-ink/20 backdrop-blur-sm" @click.self="closeAdd">
      <div class="card w-full max-w-md animate-in" @click.stop>
        <h2 class="mb-4 font-display text-lg text-ink dark:text-on-dark">New Task</h2>
        <div class="space-y-3">
          <div>
            <label class="block mb-1 text-xs font-medium text-ink-muted dark:text-on-dark-soft">Title</label>
            <input ref="addInput" v-model="newTitle" class="input" placeholder="What needs to be done?" @keyup.enter="handleAdd" />
          </div>
          <div>
            <label class="block mb-1 text-xs font-medium text-ink-muted dark:text-on-dark-soft">Description <span class="text-ink-soft/60">(optional)</span></label>
            <textarea v-model="newDescription" class="input resize-y" rows="7" placeholder="Add more detail" />
          </div>
          <div>
            <label class="block mb-1 text-xs font-medium text-ink-muted dark:text-on-dark-soft">Priority</label>
            <select v-model.number="newPriority" class="input">
              <option :value="0">None</option>
              <option :value="1">Low</option>
              <option :value="2">Medium</option>
              <option :value="3">High</option>
            </select>
          </div>
        </div>
        <p v-if="addError" class="mt-3 text-sm text-error dark:text-error">{{ addError }}</p>
        <div class="mt-4 flex justify-end gap-2">
          <button @click="closeAdd" class="btn-ghost">Cancel</button>
          <button @click="handleAdd" class="btn-primary" :disabled="!newTitle.trim() || saving">{{ saving ? 'Adding' : 'Add Task' }}</button>
        </div>
      </div>
    </div>

    <div v-if="taskStore.loadError" class="mb-4 rounded-lg border border-error/30 bg-error/5 p-3 text-sm text-error dark:text-error">
      {{ taskStore.loadError }}
      <button @click="taskStore.fetchTasks()" class="link ml-2">Retry</button>
    </div>
    <div v-if="taskStore.isLoading" class="py-8 text-center text-sm text-ink-soft dark:text-on-dark-soft">Loading</div>
    <div v-else-if="filteredTasks.length === 0" class="py-12 text-center text-sm text-ink-soft dark:text-on-dark-soft/70">
      No {{ statusLabel(activeTab).toLowerCase() }} tasks.
      <button @click="openAdd" class="link ml-1">Add one manually</button>
      <span class="mx-1">or</span>
      <NuxtLink to="/agent" class="link">ask the Agent</NuxtLink>
    </div>
    <div v-else class="card !p-0 overflow-hidden">
      <table class="table-base">
        <thead><tr><th class="w-10" /><th>Title</th><th class="hidden md:table-cell">Status</th><th class="hidden md:table-cell">Priority</th><th class="hidden md:table-cell">Review</th><th class="w-24 text-right">Actions</th></tr></thead>
        <tbody>
          <tr v-for="task in filteredTasks" :key="task.id">
            <td class="text-center">
              <button @click="handleToggle(task)" :disabled="taskStore.isLockedByFocus(task.id)"
                :title="taskStore.isLockedByFocus(task.id) ? 'Locked — this task is in an active focus session' : (task.status === 'completed' ? 'Mark as pending' : 'Mark as complete')"
                class="flex h-5 w-5 items-center justify-center rounded-md border mx-auto transition-colors"
                :class="[
                  task.status === 'completed' ? 'border-success/40 bg-success/15 text-success dark:border-success/40 dark:bg-success-muted/20 dark:text-success' : 'border-hairline dark:border-hairline-dark text-transparent hover:border-ink dark:hover:border-on-dark',
                  taskStore.isLockedByFocus(task.id) ? 'cursor-not-allowed opacity-40 hover:border-hairline' : '',
                ]">
                <span v-if="task.status === 'completed'" class="text-xs">&#10003;</span>
                <span v-else-if="taskStore.isLockedByFocus(task.id)" class="text-2xs">&#128274;</span>
              </button>
            </td>
            <td>
              <p class="text-sm font-medium" :class="task.status === 'completed' ? 'line-through text-ink-soft/40 dark:text-on-dark-soft/40' : 'text-ink dark:text-on-dark'">{{ task.title }}</p>
              <p v-if="task.description" class="mt-0.5 text-xs text-ink-muted dark:text-on-dark-soft line-clamp-1">{{ task.description }}</p>
              <p v-if="task.dueDate" class="mt-0.5 text-2xs text-ink-soft dark:text-on-dark-soft/70">Due {{ dayjs(task.dueDate).format('MMM D, YYYY') }}</p>
            </td>
            <td class="hidden md:table-cell"><span class="badge" :class="statusBadgeClass(task.status)">{{ statusLabel(task.status) }}</span></td>
            <td class="hidden md:table-cell text-ink-muted dark:text-on-dark-soft">{{ task.priority > 0 ? 'P' + task.priority : '--' }}</td>
            <td class="hidden md:table-cell text-sm text-ink-soft dark:text-on-dark-soft max-w-[150px] truncate">{{ task.review || '--' }}</td>
            <td class="text-right whitespace-nowrap">
              <button @click="openEdit(task)" class="link text-sm">Edit</button>
              <button @click="deleteTarget = task" :disabled="taskStore.isLockedByFocus(task.id)"
                :title="taskStore.isLockedByFocus(task.id) ? 'Locked — this task is in an active focus session' : 'Delete task'"
                class="link text-sm ml-3 text-error dark:text-error"
                :class="{ 'opacity-40 cursor-not-allowed': taskStore.isLockedByFocus(task.id) }">Delete</button>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- Edit Task Dialog -->
    <div v-if="editTarget" class="fixed inset-0 z-50 flex items-center justify-center bg-ink/20 backdrop-blur-sm" @click.self="closeEdit">
      <div class="card w-full max-w-md animate-in" @click.stop>
        <h2 class="mb-4 font-display text-lg text-ink dark:text-on-dark">Edit Task</h2>
        <div class="space-y-3">
          <div>
            <label class="block mb-1 text-xs font-medium text-ink-muted dark:text-on-dark-soft">Title</label>
            <input v-model="editTitle" :disabled="editCompleted" :class="{ 'opacity-60 cursor-not-allowed': editCompleted }" class="input" placeholder="What needs to be done?" @keyup.enter="saveEdit" />
          </div>
          <div>
            <label class="block mb-1 text-xs font-medium text-ink-muted dark:text-on-dark-soft">Description <span class="text-ink-soft/60">(optional)</span></label>
            <textarea v-model="editDescription" :disabled="editCompleted" :class="{ 'opacity-60 cursor-not-allowed': editCompleted, 'resize-y': !editCompleted }" class="input" rows="7" placeholder="Add more detail" />
          </div>
          <div class="grid grid-cols-2 gap-3">
            <div>
              <label class="block mb-1 text-xs font-medium text-ink-muted dark:text-on-dark-soft">Priority</label>
              <select v-model.number="editPriority" :disabled="editCompleted" :class="{ 'opacity-60 cursor-not-allowed': editCompleted }" class="input">
                <option :value="0">None</option>
                <option :value="1">Low</option>
                <option :value="2">Medium</option>
                <option :value="3">High</option>
              </select>
            </div>
            <div>
              <label class="block mb-1 text-xs font-medium text-ink-muted dark:text-on-dark-soft">Status</label>
              <select v-model="editStatus" :disabled="editCompleted || editLocked" :class="{ 'opacity-60 cursor-not-allowed': editCompleted || editLocked }" class="input">
                <option value="pending">Pending</option>
                <option value="in_progress">In Progress</option>
                <option value="completed">Completed</option>
              </select>
            </div>
          </div>
          <div v-if="editCompleted">
            <label class="block mb-1 text-xs font-medium text-ink-muted dark:text-on-dark-soft">Your review</label>
            <textarea v-model="editReview" class="input" rows="3" placeholder="How did this task go? Any notes" />
          </div>
        </div>
        <p v-if="editCompleted" class="mt-3 text-xs text-ink-soft dark:text-on-dark-soft/70">This task is completed — only your review can be edited.</p>
        <p v-else-if="editLocked" class="mt-3 text-xs text-ink-soft dark:text-on-dark-soft/70">Status is locked while this task's focus session is active.</p>
        <p v-if="editError" class="mt-3 text-sm text-error dark:text-error">{{ editError }}</p>
        <div class="mt-4 flex justify-end gap-2">
          <button @click="closeEdit" class="btn-ghost">Cancel</button>
          <button @click="saveEdit" class="btn-primary" :disabled="(!editCompleted && !editTitle.trim()) || editSaving">{{ editSaving ? 'Saving' : 'Save' }}</button>
        </div>
      </div>
    </div>

    <!-- Delete Confirm Dialog -->
    <div v-if="deleteTarget" class="fixed inset-0 z-50 flex items-center justify-center bg-ink/20 backdrop-blur-sm" @click.self="deleteTarget = null">
      <div class="card w-full max-w-sm animate-in" @click.stop>
        <h2 class="mb-2 font-display text-lg text-ink dark:text-on-dark">Delete Task</h2>
        <p class="text-sm text-ink-body dark:text-on-dark-soft">Delete <span class="font-medium text-ink dark:text-on-dark">{{ deleteTarget.title }}</span>? This can't be undone.</p>
        <p v-if="deleteError" class="mt-3 text-sm text-error dark:text-error">{{ deleteError }}</p>
        <div class="mt-4 flex justify-end gap-2">
          <button @click="deleteTarget = null" class="btn-ghost">Cancel</button>
          <button @click="doDelete" class="btn-danger" :disabled="deleting">{{ deleting ? 'Deleting' : 'Delete' }}</button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { useTaskStore } from '~/stores/task.store'
import dayjs from 'dayjs'
definePageMeta({ middleware: ['auth'] })

const taskStore = useTaskStore()
const activeTab = ref<'pending' | 'in_progress' | 'completed'>('pending')
const showAdd = ref(false)
const newTitle = ref('')
const newDescription = ref('')
const newPriority = ref(0)
const addError = ref('')
const saving = ref(false)
const addInput = ref<HTMLInputElement>()

// Edit dialog state
const editTarget = ref<any>(null)
const editTitle = ref('')
const editDescription = ref('')
const editPriority = ref(0)
const editStatus = ref<'pending' | 'in_progress' | 'completed'>('pending')
const editReview = ref('')
const editError = ref('')
const editSaving = ref(false)
const editLocked = computed(() => !!editTarget.value && taskStore.isLockedByFocus(editTarget.value.id))
// A completed task is frozen — only its review may be edited.
const editCompleted = computed(() => editTarget.value?.status === 'completed')

// Delete dialog state
const deleteTarget = ref<any>(null)
const deleteError = ref('')
const deleting = ref(false)

const tabs = computed(() => [
  { key: 'pending' as const, label: 'Pending', count: taskStore.pendingTasks.length,
    activeClass: 'bg-ink-soft text-white', idleClass: 'text-ink-muted hover:bg-canvas-card dark:text-on-dark-soft dark:hover:bg-surface-dark-soft' },
  { key: 'in_progress' as const, label: 'In Progress', count: taskStore.inProgressTasks.length,
    activeClass: 'bg-warning text-ink', idleClass: 'text-warning hover:bg-warning/10' },
  { key: 'completed' as const, label: 'Completed', count: taskStore.completedTasks.length,
    activeClass: 'bg-success text-white', idleClass: 'text-success hover:bg-success/10' },
])
const filteredTasks = computed(() =>
  activeTab.value === 'pending' ? taskStore.pendingTasks
    : activeTab.value === 'in_progress' ? taskStore.inProgressTasks
      : taskStore.completedTasks)

function statusLabel(status: string) {
  return status === 'in_progress' ? 'In Progress' : status.charAt(0).toUpperCase() + status.slice(1)
}
function statusBadgeClass(status: string) {
  return status === 'completed' ? 'bg-success text-white'
    : status === 'in_progress' ? 'bg-warning text-ink'
      : 'bg-ink-soft text-white' // pending (default)
}

onMounted(() => taskStore.fetchTasks())

function handleToggle(task: any) {
  // Opens the shared review prompt when completing; no-op if locked by a focus session.
  taskStore.requestToggle(task.id)
}

function openEdit(task: any) {
  editTarget.value = task
  editTitle.value = task.title
  editDescription.value = task.description || ''
  editPriority.value = task.priority || 0
  editStatus.value = task.status === 'cancelled' ? 'pending' : task.status
  editReview.value = task.review || ''
  editError.value = ''
}
function closeEdit() { editTarget.value = null }

async function saveEdit() {
  if (!editTarget.value || editSaving.value) return
  editSaving.value = true; editError.value = ''
  // Completed tasks are frozen except for the review; everything else is locked.
  const changes: any = editCompleted.value
    ? { review: editReview.value.trim() || undefined }
    : {
        title: editTitle.value.trim(),
        description: editDescription.value.trim() || undefined,
        priority: editPriority.value,
        // Status only when not locked to an active focus session.
        ...(editLocked.value ? {} : { status: editStatus.value }),
      }
  if (!editCompleted.value && !changes.title) {
    editError.value = 'Title is required.'; editSaving.value = false; return
  }
  try {
    await taskStore.updateTask(editTarget.value.id, changes)
    editTarget.value = null
  } catch (e: any) {
    editError.value = e?.message || 'Failed to save changes.'
  } finally {
    editSaving.value = false
  }
}

async function doDelete() {
  if (!deleteTarget.value || deleting.value) return
  deleting.value = true; deleteError.value = ''
  try {
    await taskStore.deleteTask(deleteTarget.value.id)
    deleteTarget.value = null
  } catch (e: any) {
    deleteError.value = e?.message || 'Failed to delete task.'
  } finally {
    deleting.value = false
  }
}

function openAdd() {
  newTitle.value = ''; newDescription.value = ''; newPriority.value = 0
  addError.value = ''; showAdd.value = true
}
function closeAdd() { showAdd.value = false }

async function handleAdd() {
  if (!newTitle.value.trim() || saving.value) return
  saving.value = true; addError.value = ''
  try {
    await taskStore.addTask(
      newTitle.value.trim(),
      newDescription.value.trim() || undefined,
      { priority: newPriority.value },
    )
    showAdd.value = false
  } catch (e: any) {
    addError.value = e?.message || 'Failed to add task. Please try again.'
  } finally {
    saving.value = false
  }
}

watch(showAdd, v => { if (v) nextTick(() => addInput.value?.focus()) })
</script>
