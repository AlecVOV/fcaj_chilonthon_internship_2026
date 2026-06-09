<template>
  <div class="animate-in">
    <div class="mb-6">
      <h1 class="text-xl font-bold text-neutral-950 dark:text-dark-text">Admin Panel</h1>
      <p class="mt-1 text-sm text-neutral-950/40 dark:text-white/30">System management & analytics</p>
    </div>

    <div class="mb-6 flex border-b border-neutral-200 dark:border-dark-border">
      <NuxtLink to="/admin" class="tab" :class="$route.path === '/admin' ? 'tab-active' : ''">Overview</NuxtLink>
      <NuxtLink to="/admin/users" class="tab" :class="$route.path.startsWith('/admin/users') ? 'tab-active' : ''">Users</NuxtLink>
      <NuxtLink to="/admin/media" class="tab" :class="$route.path.startsWith('/admin/media') ? 'tab-active' : ''">Media</NuxtLink>
    </div>

    <div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 mb-8">
      <div class="card"><p class="text-2xs font-medium uppercase tracking-wider text-neutral-950/40 dark:text-white/25">Total Users</p><p class="mt-2 text-2xl font-bold text-neutral-950/30 dark:text-white/15">-</p></div>
      <div class="card"><p class="text-2xs font-medium uppercase tracking-wider text-neutral-950/40 dark:text-white/25">Sessions Today</p><p class="mt-2 text-2xl font-bold text-neutral-950/30 dark:text-white/15">-</p></div>
      <div class="card"><p class="text-2xs font-medium uppercase tracking-wider text-neutral-950/40 dark:text-white/25">Avg Focus</p><p class="mt-2 text-2xl font-bold text-neutral-950/30 dark:text-white/15">-</p></div>
      <div class="card"><p class="text-2xs font-medium uppercase tracking-wider text-neutral-950/40 dark:text-white/25">Media Items</p><p class="mt-2 text-2xl font-bold text-neutral-950/30 dark:text-white/15">-</p></div>
    </div>

    <div class="grid gap-6 sm:grid-cols-2">
      <div class="card">
        <h2 class="text-base font-semibold text-neutral-950 dark:text-dark-text mb-2">User Management</h2>
        <p class="text-sm text-neutral-950/50 dark:text-white/30 mb-4">View all users, change roles, add mock users.</p>
        <NuxtLink to="/admin/users" class="btn-outline text-xs">Manage Users</NuxtLink>
      </div>
      <div class="card">
        <h2 class="text-base font-semibold text-neutral-950 dark:text-dark-text mb-2">Media Library</h2>
        <p class="text-sm text-neutral-950/50 dark:text-white/30 mb-4">Manage content for RAG recommendations. Add quotes, videos, generate embeddings.</p>
        <NuxtLink to="/admin/media" class="btn-outline text-xs">Manage Media</NuxtLink>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
definePageMeta({ middleware: ['auth', 'admin'] })
</script>
