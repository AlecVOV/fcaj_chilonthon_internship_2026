<template>
  <div class="flex min-h-screen items-center justify-center bg-neutral-100 dark:bg-dark-bg p-6">
    <div class="text-center max-w-md">
      <div class="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded bg-brand-orange text-squid-ink font-bold text-lg">FM</div>
      <h1 class="text-xl font-bold text-neutral-950 dark:text-dark-text mb-2">Something went wrong</h1>
      <p class="text-sm text-neutral-950/50 dark:text-white/30 mb-4">
        An unexpected error occurred. Please try refreshing the page.
      </p>
      <p v-if="error?.message" class="text-xs text-critical dark:text-critical-dark mb-4 font-mono">{{ error.message }}</p>
      <div class="flex gap-2 justify-center">
        <button @click="handleClear" class="btn-outline text-xs">Clear error</button>
        <NuxtLink to="/" class="btn-primary text-xs">Go to Dashboard</NuxtLink>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
defineProps<{ error?: { message: string } }>()

function handleClear() {
  clearError()
  navigateTo('/')
}
</script>
