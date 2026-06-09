<template>
  <div class="flex min-h-screen flex-col">
    <!-- Top Navigation Bar (AWS Squid Ink) -->
    <header class="navbar sticky top-0 z-50 flex items-center justify-between px-4 h-12">
      <!-- Left: Logo + Nav -->
      <div class="flex items-center h-full">
        <div class="flex items-center gap-1.5 mr-6">
          <!-- <div class="flex h-7 w-10 items-center justify-center rounded bg-navy text-xs font-bold text-white/90">
            FCAJ
          </div> -->
          <span class="font-semibold text-sm tracking-tight">FCAJ Worklog Generator</span>
        </div>
        <nav class="hidden md:flex items-center h-full">
          <NuxtLink
            v-for="item in navItems"
            :key="item.to"
            :to="item.to"
            class="flex items-center h-full px-3 text-xs font-medium transition-colors"
            :class="$route.path === item.to
              ? 'bg-white/10 text-white border-b-2 border-brand-orange'
              : 'text-white/70 hover:bg-white/5 hover:text-white'"
          >
            {{ item.label }}
          </NuxtLink>
        </nav>
      </div>

      <!-- Right: Sync status, Dark mode, Admin, User -->
      <div class="flex items-center gap-2 h-full">
        <SyncStatus />
        <ColorModeToggle />
        <div class="flex items-center gap-2 pl-2 border-l border-white/10">
          <NuxtLink
            to="/profile"
            class="text-xs text-white/50 hidden sm:inline hover:text-white transition-colors"
          >
            {{ authUser?.name ?? authUser?.email?.split('@')[0] ?? 'User' }}
          </NuxtLink>
          <button
            @click="logout"
            class="rounded px-2 py-1 text-xs text-white/60 hover:bg-white/10 hover:text-red-400 transition-colors"
          >
            Sign out
          </button>
        </div>
      </div>
    </header>

    <!-- Mobile bottom nav -->
    <div class="md:hidden flex border-b border-neutral-200 bg-white dark:bg-dark-surface dark:border-dark-border">
      <NuxtLink
        v-for="item in navItems"
        :key="item.to"
        :to="item.to"
        class="flex-1 text-center py-2 text-2xs font-medium transition-colors"
        :class="$route.path === item.to
          ? 'text-interactive-blue border-b-2 border-interactive-blue'
          : 'text-neutral-950/50 dark:text-white/40'"
      >
        {{ item.label }}
      </NuxtLink>
    </div>

    <!-- Main Content -->
    <main class="flex-1 p-4 md:p-6">
      <slot />
    </main>

    <!-- Footer -->
    <footer class="border-t border-neutral-200 dark:border-dark-border bg-white dark:bg-dark-surface px-4 py-2.5 text-center text-2xs text-neutral-950/30 dark:text-white/20">
      Focus Mode &middot; v1.0.0
    </footer>
  </div>
</template>

<script setup lang="ts">
import { useAuth } from '~/composables/useAuth'

const { currentUser: authUser, isAdmin, logout } = useAuth()

// User nav links — admin sees only admin links
const navItems = computed(() => {
  if (isAdmin.value) {
    return [
      { to: '/admin', label: 'Overview' },
      { to: '/admin/users', label: 'Users' },
      { to: '/admin/media', label: 'Media' },
    ]
  }
  return [
    { to: '/agent', label: 'Agent' },
    { to: '/', label: 'Dashboard' },
    { to: '/focus', label: 'Focus' },
    { to: '/tasks', label: 'Tasks' },
  ]
})
</script>
