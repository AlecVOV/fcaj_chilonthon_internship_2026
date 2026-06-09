<template>
  <span
    class="badge capitalize"
    :class="badgeClass"
  >
    {{ label }}
  </span>
</template>

<script setup lang="ts">
defineProps<{
  label: string
}>()

const badgeClass = 'badge-success' // neutral default
</script>
