<template>
  <div v-if="taskStore.reviewTarget" class="fixed inset-0 z-50 flex items-center justify-center bg-ink/20 backdrop-blur-sm" @click.self="taskStore.cancelReview()">
    <div class="card w-full max-w-md animate-in" @click.stop>
      <h2 class="mb-4 font-display text-lg text-ink dark:text-on-dark">Task Complete — Review</h2>
      <p class="text-sm text-ink-body dark:text-on-dark-soft mb-3">
        You just completed: <span class="font-medium text-ink dark:text-on-dark">{{ taskStore.reviewTarget.title }}</span>
      </p>
      <div>
        <label class="block mb-1.5 text-xs font-medium text-ink-muted dark:text-on-dark-soft">How was this task? Any notes?</label>
        <textarea v-model="taskStore.reviewText" class="input" rows="3" placeholder="E.g., Easier than expected, took longer because of what?" />
      </div>
      <div class="mt-4 flex justify-end gap-2">
        <button @click="taskStore.skipReview()" class="btn-ghost">Skip</button>
        <button @click="taskStore.saveReview()" class="btn-primary" :disabled="!taskStore.reviewText.trim() || taskStore.reviewSaving">
          {{ taskStore.reviewSaving ? 'Saving' : 'Save Review' }}
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { useTaskStore } from '~/stores/task.store'

const taskStore = useTaskStore()
</script>
