<template>
  <div class="animate-in h-full">
    <div class="mb-4">
      <h1 class="font-display text-display-sm text-ink dark:text-on-dark">Task Assistant</h1>
      <p class="mt-1.5 text-sm text-ink-body dark:text-on-dark-soft">
        Describe what you need to get done — the agent will create tasks or ask clarifying questions.
      </p>
    </div>
    <AgentChat />
  </div>
</template>

<script setup lang="ts">
definePageMeta({ middleware: ['auth'] })
</script>
