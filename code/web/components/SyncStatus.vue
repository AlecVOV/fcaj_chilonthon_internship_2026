<template>
  <div class="flex items-center gap-1.5">
    <span class="status-dot" :class="isOnline ? 'online' : 'offline'" />
    <span class="text-xs" :class="isOnline ? 'text-success dark:text-success-dark' : 'text-critical dark:text-critical-dark'">
      {{ isOnline ? 'Online' : 'Offline' }}
    </span>
  </div>
</template>

<script setup lang="ts">
import { useOffline } from '~/composables/useOffline'

const { isOnline } = useOffline()
</script>
