<template>
  <div class="text-center space-y-4">
    <p v-if="!store.isIdle && !store.isFinished" class="text-2xs uppercase tracking-wider text-ink-soft dark:text-on-dark-soft">
      {{ t('focusTimer.timerLabel') }}
    </p>
    <p v-else class="text-2xs uppercase tracking-wider text-ink-soft dark:text-on-dark-soft">
      {{ t('focusTimer.startPrompt') }}
    </p>

    <!-- Timer Display -->
    <p class="font-mono text-4xl font-normal tabular-nums text-ink dark:text-on-dark tracking-tight" v-if="!store.isIdle && !store.isFinished">
      {{ store.displayTime }}
    </p>
    <p v-else class="font-mono text-4xl font-normal tabular-nums text-ink-soft/30 dark:text-on-dark-soft/30">
      {{ store.status === 'finished' ? '00:00' : '--:--' }}
    </p>

    <!-- Progress bar (when running) -->
    <div v-if="!store.isIdle && !store.isFinished" class="h-1.5 rounded-full bg-hairline dark:bg-hairline-dark overflow-hidden">
      <div
        class="h-full rounded-full bg-primary transition-all duration-1000"
        :style="{ width: `${store.progress * 100}%` }"
      />
    </div>

    <!-- Quick Start Button -->
    <div v-if="store.isIdle || store.isFinished">
      <NuxtLink to="/focus" class="btn-primary">
        {{ t('focusTimer.goToFocus') }}
      </NuxtLink>
    </div>

    <!-- Pause/Resume -->
    <div v-if="!store.isIdle && !store.isFinished" class="flex justify-center gap-2">
      <button
        v-if="store.isRunning"
        @click="store.pause()"
        class="btn-outline text-sm"
      >
        {{ t('focusTimer.pause') }}
      </button>
      <button
        v-if="store.isPaused"
        @click="store.resume()"
        class="btn-primary text-sm"
      >
        {{ t('focusTimer.resume') }}
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { useFocusStore } from '~/stores/focus.store'

const store = useFocusStore()
const { t } = useLocale()
</script>
