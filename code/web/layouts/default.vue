<template>
  <div class="flex min-h-screen flex-col bg-canvas dark:bg-surface-dark">
    <!-- Top Navigation Bar — Claude: cream in light, dark navy in dark -->
    <header class="sticky top-0 z-50 flex items-center justify-between px-5 h-14 border-b border-hairline bg-canvas text-ink dark:bg-surface-dark dark:text-on-dark dark:border-hairline-dark">
      <!-- Left: Logo + Nav -->
      <div class="flex items-center h-full">
        <div class="flex items-center gap-2 mr-8">
          <NuxtLink to="/" class="font-display font-normal text-lg tracking-tight hover:opacity-80 transition-opacity">
            FCAJ Worklog Repository 
          </NuxtLink>
        </div>

        <!-- Logged-in nav -->
        <nav v-if="authUser" class="hidden md:flex items-center h-full gap-1">
          <NuxtLink
            v-for="item in navItems"
            :key="item.to"
            :to="item.to"
            class="flex items-center h-full px-3 text-sm font-medium transition-colors"
            :class="$route.path === item.to || $route.path.startsWith(item.to)
              ? 'text-primary dark:text-coral-dark'
              : 'text-ink-muted hover:text-ink dark:text-on-dark-soft dark:hover:text-on-dark'"
          >
            {{ item.label }}
          </NuxtLink>
        </nav>

        <!-- Logged-out nav links -->
        <nav v-else class="hidden md:flex items-center h-full gap-1">
          <a href="/#features" class="flex items-center h-full px-3 text-sm font-medium text-ink-muted hover:text-ink dark:text-on-dark-soft dark:hover:text-on-dark transition-colors">Features</a>
          <a href="/#how-it-works" class="flex items-center h-full px-3 text-sm font-medium text-ink-muted hover:text-ink dark:text-on-dark-soft dark:hover:text-on-dark transition-colors">How it works</a>
          <NuxtLink to="/author" class="flex items-center h-full px-3 text-sm font-medium text-ink-muted hover:text-ink dark:text-on-dark-soft dark:hover:text-on-dark transition-colors" :class="$route.path === '/author' ? 'text-ink dark:text-on-dark' : ''">
            Author
          </NuxtLink>
        </nav>
      </div>

      <!-- Right side -->
      <div class="flex items-center gap-3 h-full">
        <ColorModeToggle />

        <!-- Logged-in user area -->
        <template v-if="authUser">
          <SyncStatus />
          <div class="flex items-center gap-2 pl-2 border-l border-hairline dark:border-hairline-dark">
            <NuxtLink
              to="/profile"
              class="text-sm text-ink-muted hidden sm:inline hover:text-ink dark:text-on-dark-soft dark:hover:text-on-dark transition-colors"
            >
              {{ authUser?.name ?? authUser?.email?.split('@')[0] ?? 'User' }}
            </NuxtLink>
            <button
              @click="logout"
              class="rounded-md px-2.5 py-1 text-sm text-ink-muted hover:bg-canvas-card hover:text-error dark:text-on-dark-soft dark:hover:bg-surface-dark-elevated dark:hover:text-error transition-colors"
            >
              Sign out
            </button>
          </div>
        </template>

        <!-- Logged-out CTA -->
        <template v-else>
          <NuxtLink to="/login" class="rounded-md border px-2.5 py-1 text-sm font-medium text-ink hover:text-ink dark:text-on-dark dark:hover:text-on-dark transition-colors" style="background: rgb(204 120 92 / var(--tw-border-opacity, 1));">
            Use our product
          </NuxtLink>
        </template>
      </div>
    </header>

    <!-- Mobile bottom nav (logged-in only) -->
    <div v-if="authUser" class="md:hidden flex border-b border-hairline bg-canvas dark:bg-surface-dark-soft dark:border-hairline-dark">
      <NuxtLink
        v-for="item in mobileNavItems"
        :key="item.to"
        :to="item.to"
        class="flex-1 text-center py-2.5 text-2xs font-medium transition-colors"
        :class="$route.path === item.to
          ? 'text-primary border-b-2 border-primary'
          : 'text-ink-muted dark:text-on-dark-soft'"
      >
        {{ item.label }}
      </NuxtLink>
    </div>

    <!-- Main Content -->
    <main class="flex-1 p-4 md:p-6 lg:p-8">
      <div class="max-w-6xl mx-auto">
        <slot />
      </div>
    </main>

    <!-- Shared task-completion review prompt (works from any page) -->
    <TaskReviewDialog v-if="authUser" />
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
      { to: '/profile', label: 'Profile' },
    ]
  }
  return [
    { to: '/dashboard', label: 'Dashboard' },
    { to: '/focus', label: 'Focus' },
    { to: '/tasks', label: 'Tasks' },
    { to: '/agent', label: 'Agent' },
  ]
})

// Mobile bottom nav always exposes the account/profile link, since the header
// username link is hidden below 640px (sm).
const mobileNavItems = computed(() => {
  const items = [...navItems.value]
  if (!items.some(i => i.to === '/profile')) items.push({ to: '/profile', label: 'Profile' })
  return items
})
</script>
