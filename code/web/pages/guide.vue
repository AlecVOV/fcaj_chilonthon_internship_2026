<template>
  <div class="animate-in space-y-6">
    <div class="mb-6">
      <h1 class="font-display text-display-sm text-ink dark:text-on-dark">User Guide</h1>
      <p class="mt-1 text-sm text-ink-muted dark:text-on-dark-soft">A quick tour of every feature in FCAJ Worklog Repository.</p>
    </div>

    <div v-for="section in sections" :key="section.title" class="card">
      <h2 class="font-display text-lg text-ink dark:text-on-dark mb-1">{{ section.title }}</h2>
      <p class="text-sm text-ink-muted dark:text-on-dark-soft mb-3">{{ section.tagline }}</p>
      <ul class="list-disc list-inside space-y-1.5 text-sm text-ink-body dark:text-on-dark-soft">
        <li v-for="(point, i) in section.points" :key="i" v-html="point" />
      </ul>
    </div>

    <div class="card">
      <h2 class="font-display text-lg text-ink dark:text-on-dark mb-1">Still stuck?</h2>
      <p class="text-sm text-ink-body dark:text-on-dark-soft">
        Send feedback from your
        <NuxtLink to="/profile" class="link">Profile page</NuxtLink>
        — it goes straight to the team.
      </p>
    </div>
  </div>
</template>

<script setup lang="ts">
definePageMeta({ middleware: ['auth'] })

const sections = [
  {
    title: '1. Dashboard',
    tagline: 'Your daily snapshot.',
    points: [
      'Shows today\'s total focus time, sessions, and task completion at a glance.',
      'Charts break down focus time by hour and by mood, so you can spot your best working hours.',
    ],
  },
  {
    title: '2. Focus',
    tagline: 'Run a timed deep-work session.',
    points: [
      'Pick a task (optional), set a duration, and start the timer.',
      'Choose an ambient sound track — it keeps playing even if you switch to another page while the session runs.',
      'At the end of a session you can log your mood and a short journal entry.',
    ],
  },
  {
    title: '3. Tasks',
    tagline: 'Plan and track what you\'re working on.',
    points: [
      'Create tasks manually, or use the <strong>Task Assistant</strong> on the Agent page — describe what you need to do in plain language and it will create tasks for you, asking clarifying questions like priority when needed.',
      'Mark tasks as in progress or completed; completed tasks show up in your Worklog History.',
    ],
  },
  {
    title: '4. Agent',
    tagline: 'Chat with your AI task assistant.',
    points: [
      'Ask it to create, update, or organize tasks — it can also just answer questions about your workload.',
      'Conversations are saved, so you can pick up a previous chat from the sidebar.',
      'Bulk actions (e.g. "clear all pending tasks and add these 5 new ones") may take longer to process — if you see a "Service Unavailable" message, it usually means the request took too long; try splitting it into smaller requests.',
    ],
  },
  {
    title: '5. Profile & Worklog History',
    tagline: 'Manage your account and export your work.',
    points: [
      'Edit your name or email — email changes apply immediately (it\'s also your login).',
      'Worklog History lists each day you\'ve worked; click <strong>Report</strong> to download a Markdown summary for that day (focus time, tasks, mood, journal entries).',
      'Send feedback about the app directly from this page — the team reads every submission.',
    ],
  },
]
</script>
