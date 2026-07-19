<template>
  <div class="animate-in">
    <div class="mb-6">
      <h1 class="font-display text-display-sm text-ink dark:text-on-dark">Admin Panel</h1>
      <p class="mt-1.5 text-sm text-ink-body dark:text-on-dark-soft">System management & analytics</p>
    </div>

    <div class="mb-6 flex border-b border-hairline dark:border-hairline-dark">
      <NuxtLink to="/admin" class="tab" :class="$route.path === '/admin' ? 'tab-active' : ''">Overview</NuxtLink>
      <NuxtLink to="/admin/users" class="tab" :class="$route.path.startsWith('/admin/users') ? 'tab-active' : ''">Users</NuxtLink>
      <NuxtLink to="/admin/media" class="tab" :class="$route.path.startsWith('/admin/media') ? 'tab-active' : ''">Media</NuxtLink>
      <NuxtLink to="/admin/ambient" class="tab" :class="$route.path.startsWith('/admin/ambient') ? 'tab-active' : ''">Ambient</NuxtLink>
      <NuxtLink to="/admin/feedback" class="tab" :class="$route.path.startsWith('/admin/feedback') ? 'tab-active' : ''">Feedback</NuxtLink>
    </div>

    <div class="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
      <NuxtLink to="/admin/users" class="card group hover:bg-surface-card dark:hover:bg-surface-dark-elevated transition-colors">
        <div class="mb-3 flex h-10 w-10 items-center justify-center rounded-lg bg-coral/20 text-coral dark:bg-coral-dark/30 dark:text-coral-dark">
          <svg class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5"><path stroke-linecap="round" stroke-linejoin="round" d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z" /></svg>
        </div>
        <h2 class="font-display text-lg text-ink dark:text-on-dark mb-1">User Management</h2>
        <p class="text-sm text-ink-body dark:text-on-dark-soft">View all users, approve registrations, manage roles & permissions.</p>
      </NuxtLink>

      <NuxtLink to="/admin/media" class="card group hover:bg-surface-card dark:hover:bg-surface-dark-elevated transition-colors">
        <div class="mb-3 flex h-10 w-10 items-center justify-center rounded-lg bg-accent-teal/20 text-accent-teal dark:bg-accent-teal/30 dark:text-accent-teal">
          <svg class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5"><path stroke-linecap="round" stroke-linejoin="round" d="M12 6.042A8.967 8.967 0 006 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 016 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 016-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0018 18a8.967 8.967 0 00-6 2.292m0-14.25v14.25" /></svg>
        </div>
        <h2 class="font-display text-lg text-ink dark:text-on-dark mb-1">Media Library</h2>
        <p class="text-sm text-ink-body dark:text-on-dark-soft">Manage RAG content — sutras, quotes, videos, and embedding vectors.</p>
      </NuxtLink>

      <NuxtLink to="/admin/ambient" class="card group hover:bg-surface-card dark:hover:bg-surface-dark-elevated transition-colors">
        <div class="mb-3 flex h-10 w-10 items-center justify-center rounded-lg bg-accent-amber/20 text-accent-amber dark:bg-accent-amber/30 dark:text-accent-amber">
          <svg class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5"><path stroke-linecap="round" stroke-linejoin="round" d="M9 9l10.5-3m0 6.553v3.75a2.25 2.25 0 01-1.632 2.163l-1.32.377a1.803 1.803 0 11-.99-3.467l2.31-.66a2.25 2.25 0 001.632-2.163zm0 0V2.25L9 5.25v10.303m0 0v3.75a2.25 2.25 0 01-1.632 2.163l-1.32.377a1.803 1.803 0 01-.99-3.467l2.31-.66A2.25 2.25 0 009 15.553z" /></svg>
        </div>
        <h2 class="font-display text-lg text-ink dark:text-on-dark mb-1">Ambient Sound</h2>
        <p class="text-sm text-ink-body dark:text-on-dark-soft">Upload nhạc nền lên S3 & quản lý danh sách nhạc hiển thị cho user.</p>
      </NuxtLink>

      <NuxtLink to="/admin/feedback" class="card group relative hover:bg-surface-card dark:hover:bg-surface-dark-elevated transition-colors">
        <span v-if="newFeedbackCount > 0" class="absolute right-4 top-4 rounded-full bg-coral px-2 py-0.5 text-2xs font-medium text-white dark:bg-coral-dark">{{ newFeedbackCount }} new</span>
        <div class="mb-3 flex h-10 w-10 items-center justify-center rounded-lg bg-primary/20 text-primary">
          <svg class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5"><path stroke-linecap="round" stroke-linejoin="round" d="M8.625 12a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H8.25m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H12m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0h-.375M21 12c0 4.556-4.03 8.25-9 8.25a9.764 9.764 0 01-2.555-.337A5.972 5.972 0 015.41 20.97a5.969 5.969 0 01-.474-.065 4.48 4.48 0 00.978-2.025c.09-.457-.133-.901-.467-1.226C3.93 16.178 3 14.189 3 12c0-4.556 4.03-8.25 9-8.25s9 3.694 9 8.25z" /></svg>
        </div>
        <h2 class="font-display text-lg text-ink dark:text-on-dark mb-1">Feedback</h2>
        <p class="text-sm text-ink-body dark:text-on-dark-soft">Read what users are saying about the app and mark items as resolved.</p>
      </NuxtLink>

      <div class="card">
        <div class="mb-3 flex h-10 w-10 items-center justify-center rounded-lg bg-accent-teal/20 text-accent-teal dark:bg-accent-teal/30 dark:text-accent-teal">
          <svg class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5"><path stroke-linecap="round" stroke-linejoin="round" d="M3.75 3v11.25A2.25 2.25 0 006 16.5h2.25M3.75 3h-1.5m1.5 0h16.5m0 0h1.5m-1.5 0v11.25A2.25 2.25 0 0118 16.5h-2.25m-7.5 0h7.5m-7.5 0l-1 3m8.5-3l1 3m0 0l.5 1.5m-.5-1.5h-9.5m0 0l-.5 1.5m.75-9l3-3 2.148 2.148A12.061 12.061 0 0116.5 7.605" /></svg>
        </div>
        <h2 class="font-display text-lg text-ink dark:text-on-dark mb-1">System Health</h2>
        <p class="text-sm text-ink-body dark:text-on-dark-soft">API Gateway status, Lambda invocations, Supabase connection monitor.</p>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { useFeedback } from '~/composables/useFeedback'

definePageMeta({ middleware: ['auth', 'admin'] })

const { listFeedback } = useFeedback()
const newFeedbackCount = ref(0)

onMounted(async () => {
  try {
    const items = await listFeedback()
    newFeedbackCount.value = items.filter(f => f.status === 'new').length
  } catch { /* im lặng — box vẫn hiện, chỉ không có badge số lượng */ }
})
</script>
