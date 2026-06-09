<template>
  <div class="animate-in h-full">
    <div class="mb-4">
      <h1 class="text-xl font-bold text-neutral-950 dark:text-dark-text">Task Assistant</h1>
      <p class="mt-1 text-sm text-neutral-950/40 dark:text-white/30">
        Describe what you need to get done — the agent will create tasks or ask clarifying questions.
      </p>
    </div>
    <AgentChat />
  </div>
</template>

<script setup lang="ts">
definePageMeta({ middleware: ['auth'] })
</script>
