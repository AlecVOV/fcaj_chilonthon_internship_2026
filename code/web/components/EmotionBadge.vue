<template>
  <span
    class="badge"
    :class="badgeClass"
  >
    {{ t('emotion.' + label) }}
  </span>
</template>

<script setup lang="ts">
defineProps<{
  label: string
}>()

const { t } = useLocale()
const badgeClass = 'badge-coral'
</script>
