<template>
  <div>
    <div v-if="tasks.length === 0" class="py-6 text-center text-sm text-ink-soft dark:text-on-dark-soft/70">
      {{ t('taskList.empty') }}
    </div>
    <div v-else class="space-y-1">
      <div
        v-for="task in tasks"
        :key="task.id"
        class="flex items-center gap-3 rounded-md border border-hairline dark:border-hairline-dark px-3 py-2.5 transition-colors hover:bg-canvas dark:hover:bg-surface-dark-soft"
      >
        <button
          @click="taskStore.isLockedByFocus(task.id) ? null : $emit('toggle', task.id)"
          :disabled="taskStore.isLockedByFocus(task.id)"
          :title="taskStore.isLockedByFocus(task.id) ? t('taskList.lockedTooltip') : ''"
          class="flex-shrink-0 flex h-5 w-5 items-center justify-center rounded-md border transition-colors"
          :class="[
            task.status === 'completed'
              ? 'border-success/40 bg-success/15 text-success dark:border-success/40 dark:bg-success-muted/20 dark:text-success'
              : 'border-hairline dark:border-hairline-dark text-transparent hover:border-ink dark:hover:border-on-dark',
            taskStore.isLockedByFocus(task.id) ? 'cursor-not-allowed opacity-40 hover:border-hairline' : '',
          ]"
        >
          <span v-if="task.status === 'completed'" class="text-xs">&#10003;</span>
          <span v-else-if="taskStore.isLockedByFocus(task.id)" class="text-2xs">&#128274;</span>
        </button>
        <div class="flex-1 min-w-0">
          <p
            class="text-sm font-medium"
            :class="task.status === 'completed'
              ? 'line-through text-ink-soft/40 dark:text-on-dark-soft/40'
              : 'text-ink dark:text-on-dark'"
          >
            {{ task.title }}
          </p>
          <p v-if="task.description" class="mt-0.5 text-xs text-ink-muted dark:text-on-dark-soft line-clamp-1">
            {{ task.description }}
          </p>
        </div>
        <span
          v-if="task.priority > 0"
          class="text-2xs text-ink-soft dark:text-on-dark-soft"
        >
          P{{ task.priority }}
        </span>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { useTaskStore } from '~/stores/task.store'

defineProps<{
  tasks: any[]
}>()

defineEmits<{
  toggle: [taskId: string]
}>()

const taskStore = useTaskStore()
const { t } = useLocale()
</script>
