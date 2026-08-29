<template>
  <div class="flex min-h-screen flex-col bg-canvas dark:bg-surface-dark">
    <!-- Top Navigation Bar — Claude: cream in light, dark navy in dark -->
    <header class="sticky top-0 z-50 flex items-center justify-between px-5 h-14 border-b border-hairline bg-canvas text-ink dark:bg-surface-dark dark:text-on-dark dark:border-hairline-dark">
      <!-- Left: Logo + Nav -->
      <div class="flex items-center h-full">
        <div class="flex items-center gap-2 mr-8">
          <NuxtLink to="/" class="font-display font-normal text-lg tracking-tight hover:opacity-80 transition-opacity">
            {{ t('nav.brand') }}
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
          <a href="/#" class="flex items-center h-full px-3 text-sm font-medium text-ink-muted hover:text-ink dark:text-on-dark-soft dark:hover:text-on-dark transition-colors">{{ t('nav.aboutProduct') }}</a>
          <!-- <a href="/#how-it-works" class="flex items-center h-full px-3 text-sm font-medium text-ink-muted hover:text-ink dark:text-on-dark-soft dark:hover:text-on-dark transition-colors">How it works</a> -->
          <NuxtLink to="/author" class="flex items-center h-full px-3 text-sm font-medium text-ink-muted hover:text-ink dark:text-on-dark-soft dark:hover:text-on-dark transition-colors" :class="$route.path === '/author' ? 'text-ink dark:text-on-dark' : ''">
            {{ t('nav.aboutAuthor') }}
          </NuxtLink>
        </nav>
      </div>

      <!-- Right side -->
      <div class="flex items-center gap-3 h-full">
        <LocaleToggle />
        <ColorModeToggle />

        <!-- Logged-in user area -->
        <template v-if="authUser">
          <AnnouncementBell />
          <SyncStatus />
          <div class="pl-2 border-l border-hairline dark:border-hairline-dark">
            <UserMenu />
          </div>
        </template>

        <!-- Logged-out CTA -->
        <template v-else>
          <NuxtLink to="/login" class="rounded-md border px-2.5 py-1 text-sm font-medium text-ink hover:text-ink dark:text-on-dark dark:hover:text-on-dark transition-colors" style="background: rgb(204 120 92 / var(--tw-border-opacity, 1));">
            {{ t('nav.useProduct') }}
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
    <GuideReminderDialog v-if="authUser" />
  </div>
</template>

<script setup lang="ts">
import { useAuth } from '~/composables/useAuth'

const { currentUser: authUser, isAdmin } = useAuth()
const { t } = useLocale()

// User nav links — admin sees only admin links. Profile (and Notes) now live in the
// UserMenu avatar dropdown at the top-right corner instead of the main nav, and Focus
// / Tasks dropped from the top-level list since Dashboard already surfaces both
// ("Start Focus Session" button + "Today's Tasks" widget with a "View all" link).
const navItems = computed(() => {
  if (isAdmin.value) {
    return [
      { to: '/admin', label: t('nav.overview') },
      { to: '/admin/users', label: t('nav.users') },
      { to: '/admin/media', label: t('nav.media') },
    ]
  }
  return [
    { to: '/dashboard', label: t('nav.dashboard') },
    { to: '/agent', label: t('nav.agent') },
    { to: '/guide', label: t('nav.guide') },
  ]
})

// Mobile bottom nav mirrors the desktop nav — the UserMenu avatar in the header
// (always visible, not hidden on small screens) covers Profile/Notes/Sign out.
const mobileNavItems = navItems
</script>
