<template>
  <div class="animate-in">
    <div class="mb-6 flex items-center justify-between">
      <div class="flex items-center gap-3">
        <h1 class="text-xl font-bold text-neutral-950 dark:text-dark-text">Tasks</h1>
        <!-- Agentic / Manual Toggle -->
        <button
          @click="useAgent = !useAgent"
          class="rounded border px-2.5 py-1 text-xs transition-colors"
          :class="useAgent
            ? 'border-interactive-blue/30 bg-interactive-blue/10 text-interactive-blue dark:bg-interactive-blue/20'
            : 'border-neutral-200 dark:border-dark-border text-neutral-950/50 dark:text-white/30 hover:text-neutral-950 dark:hover:text-white'"
        >
          {{ useAgent ? 'Agentic Mode' : 'Manual Mode' }}
        </button>
      </div>
      <div class="flex gap-2">
        <NuxtLink v-if="useAgent" to="/agent" class="btn-outline text-xs">Add via Agent</NuxtLink>
        <button v-else @click="showAdd = true" class="btn-primary text-xs">Add Task</button>
      </div>
    </div>

    <div class="mb-4 flex border-b border-neutral-200 dark:border-dark-border">
      <button v-for="tab in tabs" :key="tab.key" @click="activeTab = tab.key" class="tab" :class="activeTab === tab.key ? 'tab-active' : ''">
        {{ tab.label }} <span class="ml-1.5 text-neutral-950/25 dark:text-white/15">({{ tab.count }})</span>
      </button>
    </div>

    <!-- Manual Add Dialog -->
    <div v-if="showAdd" class="fixed inset-0 z-50 flex items-center justify-center bg-black/20 backdrop-blur-sm" @click.self="showAdd = false">
      <div class="card w-full max-w-md animate-in" @click.stop>
        <h2 class="mb-4 text-base font-semibold text-neutral-950 dark:text-dark-text">New Task</h2>
        <input ref="addInput" v-model="newTitle" class="input mb-3" placeholder="Task title" @keyup.enter="handleAdd" />
        <textarea v-model="newDescription" class="input mb-3" rows="2" placeholder="Description (optional)" />
        <div class="flex justify-end gap-2">
          <button @click="showAdd = false" class="btn-ghost">Cancel</button>
          <button @click="handleAdd" class="btn-primary" :disabled="!newTitle.trim()">Add Task</button>
        </div>
      </div>
    </div>

    <div v-if="taskStore.isLoading" class="py-8 text-center text-sm text-neutral-950/30 dark:text-white/20">Loading...</div>
    <div v-else-if="filteredTasks.length === 0" class="py-12 text-center text-sm text-neutral-950/20 dark:text-white/15">
      No {{ activeTab === 'all' ? '' : activeTab }} tasks.
      <NuxtLink to="/agent" class="link ml-1">Ask the Agent</NuxtLink>
    </div>
    <div v-else class="card !p-0 overflow-hidden">
      <table class="table-base">
        <thead><tr><th class="w-10" /><th>Title</th><th class="hidden md:table-cell">Status</th><th class="hidden md:table-cell">Priority</th><th class="hidden md:table-cell">Review</th></tr></thead>
        <tbody>
          <tr v-for="task in filteredTasks" :key="task.id">
            <td class="text-center">
              <button @click="handleToggle(task)" class="flex h-5 w-5 items-center justify-center rounded border mx-auto transition-colors"
                :class="task.status === 'completed' ? 'border-success/40 bg-success/15 text-success dark:border-success-dark/40 dark:bg-success-dark/20 dark:text-success-dark' : 'border-neutral-400 dark:border-dark-border text-transparent hover:border-neutral-950 dark:hover:border-dark-text'">
                <span v-if="task.status === 'completed'" class="text-xs">&#10003;</span>
              </button>
            </td>
            <td>
              <p class="text-sm font-medium" :class="task.status === 'completed' ? 'line-through text-neutral-950/25 dark:text-white/15' : 'text-neutral-950 dark:text-dark-text'">{{ task.title }}</p>
              <p v-if="task.description" class="mt-0.5 text-xs text-neutral-950/30 dark:text-white/20 line-clamp-1">{{ task.description }}</p>
            </td>
            <td class="hidden md:table-cell"><span class="badge" :class="task.status === 'completed' ? 'badge-success' : ''">{{ task.status === 'in_progress' ? 'In Progress' : task.status }}</span></td>
            <td class="hidden md:table-cell text-neutral-950/50 dark:text-white/30">{{ task.priority > 0 ? 'P' + task.priority : '--' }}</td>
            <td class="hidden md:table-cell text-xs text-neutral-950/30 dark:text-white/20 max-w-[150px] truncate">{{ task.review || '--' }}</td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- Task Review Dialog -->
    <div v-if="reviewTarget" class="fixed inset-0 z-50 flex items-center justify-center bg-black/20 backdrop-blur-sm" @click.self="reviewTarget = null">
      <div class="card w-full max-w-md animate-in" @click.stop>
        <h2 class="mb-4 text-base font-semibold text-neutral-950 dark:text-dark-text">Task Complete — Review</h2>
        <p class="text-sm text-neutral-950/50 dark:text-white/30 mb-3">
          You just completed: <span class="font-medium text-neutral-950 dark:text-dark-text">{{ reviewTarget.title }}</span>
        </p>
        <div>
          <label class="block mb-1.5 text-xs font-medium text-neutral-950/50 dark:text-white/30">How was this task? Any notes?</label>
          <textarea v-model="reviewText" class="input" rows="3" placeholder="E.g., Easier than expected, took longer because..." />
        </div>
        <div class="mt-4 flex justify-end gap-2">
          <button @click="skipReview" class="btn-ghost text-xs">Skip</button>
          <button @click="saveReview" class="btn-primary text-xs" :disabled="!reviewText.trim()">Save Review</button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { useTaskStore } from '~/stores/task.store'
definePageMeta({ middleware: ['auth'] })

const taskStore = useTaskStore()
const useAgent = ref(true)
const activeTab = ref<'all' | 'pending' | 'completed'>('pending')
const showAdd = ref(false)
const newTitle = ref('')
const newDescription = ref('')
const addInput = ref<HTMLInputElement>()
const reviewTarget = ref<any>(null)
const reviewText = ref('')

const tabs = computed(() => [
  { key: 'pending' as const, label: 'Pending', count: taskStore.pendingTasks.length },
  { key: 'completed' as const, label: 'Completed', count: taskStore.completedTasks.length },
  { key: 'all' as const, label: 'All', count: taskStore.tasks.length },
])
const filteredTasks = computed(() => activeTab.value === 'pending' ? taskStore.pendingTasks : activeTab.value === 'completed' ? taskStore.completedTasks : taskStore.tasks)

onMounted(() => taskStore.fetchTasks())

function handleToggle(task: any) {
  if (task.status !== 'completed') {
    // Marking as complete → show review dialog
    reviewTarget.value = task
    reviewText.value = task.review || ''
  } else {
    taskStore.toggleTask(task.id)
  }
}

async function saveReview() {
  if (!reviewTarget.value || !reviewText.value.trim()) return
  await taskStore.updateTask(reviewTarget.value.id, { review: reviewText.value.trim() })
  await taskStore.toggleTask(reviewTarget.value.id)
  reviewTarget.value = null
  reviewText.value = ''
}

function skipReview() {
  if (reviewTarget.value) taskStore.toggleTask(reviewTarget.value.id)
  reviewTarget.value = null; reviewText.value = ''
}

async function handleAdd() {
  if (!newTitle.value.trim()) return
  await taskStore.addTask(newTitle.value.trim(), newDescription.value.trim() || undefined)
  newTitle.value = ''; newDescription.value = ''; showAdd.value = false
}

watch(showAdd, v => { if (v) nextTick(() => addInput.value?.focus()) })
</script>
