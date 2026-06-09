<template>
  <div class="text-center space-y-4">
    <p v-if="!store.isIdle && !store.isFinished" class="text-2xs uppercase tracking-wider text-neutral-950/30 dark:text-white/20">
      Timer
    </p>
    <p v-else class="text-2xs uppercase tracking-wider text-neutral-950/30 dark:text-white/20">
      Start a Focus Session
    </p>

    <!-- Timer Display -->
    <p class="text-4xl font-bold tabular-nums text-neutral-950 dark:text-dark-text tracking-tight" v-if="!store.isIdle && !store.isFinished">
      {{ store.displayTime }}
    </p>
    <p v-else class="text-4xl font-bold tabular-nums text-neutral-950/20 dark:text-white/10">
      {{ store.status === 'finished' ? '00:00' : '--:--' }}
    </p>

    <!-- Progress bar (when running) -->
    <div v-if="!store.isIdle && !store.isFinished" class="h-1.5 rounded bg-neutral-200 dark:bg-dark-border overflow-hidden">
      <div
        class="h-full rounded bg-interactive-blue transition-all duration-1000"
        :style="{ width: `${store.progress * 100}%` }"
      />
    </div>

    <!-- Quick Start Button -->
    <div v-if="store.isIdle || store.isFinished">
      <NuxtLink to="/focus" class="btn-primary text-sm">
        Go to Focus
      </NuxtLink>
    </div>

    <!-- Pause/Resume -->
    <div v-if="!store.isIdle && !store.isFinished" class="flex justify-center gap-2">
      <button
        v-if="store.isRunning"
        @click="store.pause()"
        class="btn-outline text-xs"
      >
        Pause
      </button>
      <button
        v-if="store.isPaused"
        @click="store.resume()"
        class="btn-primary text-xs"
      >
        Resume
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { useFocusStore } from '~/stores/focus.store'

const store = useFocusStore()
</script>
