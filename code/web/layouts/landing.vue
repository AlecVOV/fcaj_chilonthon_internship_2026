<template>
  <div class="flex min-h-screen flex-col bg-canvas dark:bg-surface-dark">
    <!-- Top Navigation Bar -->
    <header class="sticky top-0 z-50 flex items-center justify-between px-5 h-14 border-b border-hairline bg-canvas text-ink dark:bg-surface-dark dark:text-on-dark dark:border-hairline-dark">
      <div class="flex items-center h-full">
        <div class="flex items-center gap-2 mr-8">
          <NuxtLink to="/" class="font-display font-normal text-lg tracking-tight hover:opacity-80 transition-opacity">
            FCAJ Worklog Repository
          </NuxtLink>
        </div>

        <!-- Landing nav links -->
        <nav class="hidden md:flex items-center h-full gap-1">
          <a href="#" class="flex items-center h-full px-3 text-sm font-medium text-ink-muted hover:text-ink dark:text-on-dark-soft dark:hover:text-on-dark transition-colors rounded-md">About the Product</a>
          <!-- <a href="/#how-it-works" class="flex items-center h-full px-3 text-sm font-medium text-ink-muted hover:text-ink dark:text-on-dark-soft dark:hover:text-on-dark transition-colors rounded-md">How it works</a> -->
          <NuxtLink to="/author" class="flex items-center h-full px-3 text-sm font-medium text-ink-muted hover:text-ink dark:text-on-dark-soft dark:hover:text-on-dark transition-colors rounded-md" :class="$route.path === '/author' ? 'bg-canvas-card text-ink dark:bg-surface-dark-elevated dark:text-on-dark' : ''">
            About the Author
          </NuxtLink>
        </nav>
      </div>

      <div class="flex items-center gap-3 h-full">
        <ColorModeToggle />
          <NuxtLink to="/login" class="rounded-md border px-2.5 py-1 text-sm font-medium text-ink hover:text-ink dark:text-on-dark dark:hover:text-on-dark transition-colors" style="background: rgb(204 120 92 / var(--tw-border-opacity, 1));">
            Use our product
          </NuxtLink>
      </div>
    </header>

    <!-- FLUID content area — NO padding, NO max-width. Each section handles its own constraints. -->
    <main class="flex-1">
      <slot />
    </main>

    <!-- Footer -->
    <footer class="border-t border-hairline bg-canvas dark:bg-surface-dark dark:border-hairline-dark">
      <div class="max-w-6xl mx-auto px-4 py-8 flex flex-col sm:flex-row items-center justify-between gap-4">
        <div class="flex items-center gap-2">
          <NuxtLink to="/" class="font-display text-sm text-ink-muted dark:text-on-dark-soft hover:text-ink dark:hover:text-on-dark transition-colors">
            FCAJ Worklog Repository
          </NuxtLink>
          <span class="text-ink-soft/40 dark:text-on-dark-soft/40 text-xs">&middot;</span>
          <span class="text-xs text-ink-soft dark:text-on-dark-soft">&copy; {{ new Date().getFullYear() }}</span>
        </div>
        <div class="flex items-center gap-4">
          <a href="/#features" class="text-xs text-ink-muted dark:text-on-dark-soft hover:text-ink dark:hover:text-on-dark transition-colors">Features</a>
          <a href="/#how-it-works" class="text-xs text-ink-muted dark:text-on-dark-soft hover:text-ink dark:hover:text-on-dark transition-colors">How it works</a>
          <NuxtLink to="/author" class="text-xs text-ink-muted dark:text-on-dark-soft hover:text-ink dark:hover:text-on-dark transition-colors">Author</NuxtLink>
        </div>
      </div>
    </footer>
  </div>
</template>
