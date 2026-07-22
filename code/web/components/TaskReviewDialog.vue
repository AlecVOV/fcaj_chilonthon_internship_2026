<template>
  <div v-if="taskStore.reviewTarget" class="fixed inset-0 z-50 flex items-center justify-center bg-ink/20 backdrop-blur-sm" @click.self="taskStore.cancelReview()">
    <div class="card w-full max-w-md animate-in" @click.stop>
      <h2 class="mb-4 font-display text-lg text-ink dark:text-on-dark">{{ t('taskReview.title') }}</h2>
      <p class="text-sm text-ink-body dark:text-on-dark-soft mb-3">
        {{ t('taskReview.completedPrefix') }} <span class="font-medium text-ink dark:text-on-dark">{{ taskStore.reviewTarget.title }}</span>
      </p>
      <div>
        <label class="block mb-1.5 text-xs font-medium text-ink-muted dark:text-on-dark-soft">{{ t('taskReview.label') }}</label>
        <textarea v-model="taskStore.reviewText" class="input" rows="3" :placeholder="t('taskReview.placeholder')" />
      </div>
      <div class="mt-4 flex justify-end gap-2">
        <button @click="taskStore.skipReview()" class="btn-ghost">{{ t('taskReview.skip') }}</button>
        <button @click="taskStore.saveReview()" class="btn-primary" :disabled="!taskStore.reviewText.trim() || taskStore.reviewSaving">
          {{ taskStore.reviewSaving ? t('taskReview.saving') : t('taskReview.save') }}
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { useTaskStore } from '~/stores/task.store'

const taskStore = useTaskStore()
const { t } = useLocale()
</script>
