<template>
  <div>
    <div v-if="tasks.length === 0" class="py-6 text-center text-sm text-neutral-950/20 dark:text-white/15">
      No tasks yet.
    </div>
    <div v-else class="space-y-1">
      <div
        v-for="task in tasks"
        :key="task.id"
        class="flex items-center gap-3 rounded border border-neutral-200 dark:border-dark-border px-3 py-2.5 transition-colors hover:bg-neutral-100 dark:hover:bg-dark-surface"
      >
        <button
          @click="$emit('toggle', task.id)"
          class="flex-shrink-0 flex h-5 w-5 items-center justify-center rounded border transition-colors"
          :class="task.status === 'completed'
            ? 'border-success/40 bg-success/15 text-success dark:border-success-dark/40 dark:bg-success-dark/20 dark:text-success-dark'
            : 'border-neutral-400 dark:border-dark-border text-transparent hover:border-neutral-950 dark:hover:border-dark-text'"
        >
          <span v-if="task.status === 'completed'" class="text-xs">&#10003;</span>
        </button>
        <div class="flex-1 min-w-0">
          <p
            class="text-sm font-medium"
            :class="task.status === 'completed'
              ? 'line-through text-neutral-950/25 dark:text-white/15'
              : 'text-neutral-950 dark:text-dark-text'"
          >
            {{ task.title }}
          </p>
          <p v-if="task.description" class="mt-0.5 text-xs text-neutral-950/30 dark:text-white/20 line-clamp-1">
            {{ task.description }}
          </p>
        </div>
        <span
          v-if="task.priority > 0"
          class="text-2xs text-neutral-950/30 dark:text-white/20"
        >
          P{{ task.priority }}
        </span>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
defineProps<{
  tasks: any[]
}>()

defineEmits<{
  toggle: [taskId: string]
}>()
</script>
