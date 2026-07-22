<template>
  <div class="flex items-center gap-1.5">
    <span class="status-dot" :class="isOnline ? 'online' : 'offline'" />
    <span class="text-sm" :class="isOnline ? 'text-success dark:text-success' : 'text-error dark:text-error'">
      {{ isOnline ? t('syncStatus.online') : t('syncStatus.offline') }}
    </span>
  </div>
</template>

<script setup lang="ts">
import { useOffline } from '~/composables/useOffline'

const { isOnline } = useOffline()
const { t } = useLocale()
</script>
