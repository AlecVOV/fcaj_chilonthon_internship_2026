<template>
  <div ref="root" class="relative">
    <button
      @click="open = !open"
      class="flex h-8 w-8 items-center justify-center rounded-full bg-primary/15 text-sm font-medium text-primary transition-colors hover:bg-primary/25 dark:bg-primary/25 dark:text-coral-dark"
      :title="authUser?.name ?? authUser?.email"
    >
      {{ initial }}
    </button>
    <div
      v-if="open"
      class="absolute right-0 top-10 z-50 w-48 overflow-hidden rounded-lg border border-hairline bg-canvas-card shadow-lg dark:border-hairline-dark dark:bg-surface-dark-elevated animate-in"
    >
      <p class="truncate border-b border-hairline px-3 py-2 text-xs text-ink-muted dark:border-hairline-dark dark:text-on-dark-soft">
        {{ authUser?.name ?? authUser?.email }}
      </p>
      <NuxtLink to="/profile" @click="open = false" class="block px-3 py-2 text-sm text-ink hover:bg-canvas dark:text-on-dark dark:hover:bg-surface-dark-soft">
        {{ t('nav.profile') }}
      </NuxtLink>
      <NuxtLink to="/notes" @click="open = false" class="block px-3 py-2 text-sm text-ink hover:bg-canvas dark:text-on-dark dark:hover:bg-surface-dark-soft">
        {{ t('nav.notes') }}
      </NuxtLink>
      <button @click="handleLogout" class="block w-full px-3 py-2 text-left text-sm text-error hover:bg-canvas dark:text-error dark:hover:bg-surface-dark-soft">
        {{ t('nav.signOut') }}
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { onClickOutside } from '@vueuse/core'
import { useAuth } from '~/composables/useAuth'

const { currentUser: authUser, logout } = useAuth()
const { t } = useLocale()

const open = ref(false)
const root = ref<HTMLElement>()
onClickOutside(root, () => { open.value = false })

const initial = computed(() => (authUser.value?.name || authUser.value?.email || '?').charAt(0).toUpperCase())

function handleLogout() { open.value = false; logout() }
</script>
