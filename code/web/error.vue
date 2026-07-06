<template>
  <div class="flex min-h-screen items-center justify-center bg-canvas dark:bg-surface-dark p-6">
    <div class="text-center max-w-md">
      <div class="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-lg bg-primary text-white font-display text-lg tracking-tight">FW</div>
      <h1 class="font-display text-display-sm text-ink dark:text-on-dark mb-3">Something went wrong</h1>
      <p class="text-sm text-ink-body dark:text-on-dark-soft mb-5">
        An unexpected error occurred. Please try refreshing the page.
      </p>
      <p v-if="error?.message" class="text-xs text-error dark:text-error-muted mb-5 font-mono">{{ error.message }}</p>
      <div class="flex gap-2 justify-center">
        <button @click="handleClear" class="btn-outline text-sm">Clear error</button>
        <a href="/" class="btn-primary text-sm">Go to Home</a>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
defineProps<{ error?: { message: string } }>()

function handleClear() {
  clearError({ redirect: '/' })
}
</script>
