<template>
  <div>
    <!-- ═══════════════════════════════════════════
         HERO — Cream canvas, big serif headline
         ═══════════════════════════════════════════ -->
    <section class="flex flex-col items-center text-center py-20 md:py-28 px-4">
      <span class="inline-flex items-center rounded-pill bg-primary/10 px-3 py-1 text-xs font-medium text-primary mb-6">
        ver 1.0.0 demo use only — <NuxtLink to="/login" class="underline">Request access</NuxtLink>
      </span>
      <h1 class="font-display text-display-xl md:text-[4rem] text-ink dark:text-on-dark max-w-4xl leading-none">
        Deep focus,<br />powered by AI
      </h1>
      <p class="mt-6 max-w-xl text-lg text-ink-body dark:text-on-dark-soft leading-relaxed">
        FCAJ Worklog Repository combines Pomodoro timers, AI task breakdowns, and emotion-aware journaling
        into one seamless productivity workspace. Built for developers, interns, and anyone who
        wants to ship meaningful work.
      </p>
      <div class="mt-8 flex flex-wrap gap-3 justify-center">
        <NuxtLink to="/login" class="btn-primary text-base px-6 py-3">
          Use our product &rarr;
        </NuxtLink>
        <a href="/#features" class="btn-outline text-base px-6 py-3">
          See what it does
        </a>
      </div>
    </section>

    <!-- ═══════════════════════════════════════════
         STATS TRUST BAR
         ═══════════════════════════════════════════ -->
    <section class="max-w-4xl mx-auto px-4 pb-20 md:pb-28">
      <div class="grid gap-4 sm:grid-cols-3 text-center">
        <div class="card">
          <p class="font-display text-3xl text-ink dark:text-on-dark">25m</p>
          <p class="mt-1 text-xs text-ink-muted dark:text-on-dark-soft">Default Pomodoro session</p>
        </div>
        <div class="card">
          <p class="font-display text-3xl text-ink dark:text-on-dark">AI</p>
          <p class="mt-1 text-xs text-ink-muted dark:text-on-dark-soft">Agent-powered task planning</p>
        </div>
        <div class="card">
          <p class="font-display text-3xl text-ink dark:text-on-dark">100%</p>
          <p class="mt-1 text-xs text-ink-muted dark:text-on-dark-soft">Cloud-synced across all your devices</p>
        </div>
      </div>
    </section>

    <!-- ═══════════════════════════════════════════
         FEATURES — Cream clip-path expansion
         ═══════════════════════════════════════════ -->
    <div class="sticky-zoom-wrapper">
      <section
        id="features"
        class="sticky-zoom-content bg-canvas-soft dark:bg-surface-dark-soft"
        style="--inset-x: 0.04; --inset-y: 0.03;"
      >
        <!-- Background overlay that does the clip-path expansion -->
        <div class="sticky-zoom-bg bg-canvas-soft dark:bg-surface-dark-soft"></div>
        <!-- Constrained content that fades in -->
        <div class="sticky-zoom-body">
          <div class="max-w-5xl mx-auto w-full px-4 py-20 md:py-28">
            <p class="text-xs font-medium uppercase tracking-widest text-ink-muted dark:text-on-dark-soft text-center mb-3">
              What you get
            </p>
            <h2 class="font-display text-display-md text-ink dark:text-on-dark text-center mb-16">
              Everything you need to stay in flow
            </h2>

            <div class="grid gap-6 md:grid-cols-3">
              <!-- Feature 1 -->
              <div class="card">
                <div class="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary mb-5">
                  <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10" stroke-width="1.5"/><path d="M12 6v6l4 2" stroke-width="1.5" stroke-linecap="round"/></svg>
                </div>
                <h3 class="font-display text-lg text-ink dark:text-on-dark mb-2">Pomodoro Timer</h3>
                <p class="text-sm text-ink-body dark:text-on-dark-soft leading-relaxed">
                  Customizable focus sessions with ambient sounds (Minecraft, rain, cafe). Track every minute and build a consistent deep-work habit.
                </p>
              </div>
              <!-- Feature 2 -->
              <div class="card">
                <div class="flex h-10 w-10 items-center justify-center rounded-lg bg-accent-teal/20 text-accent-teal mb-5">
                  <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><rect x="3" y="3" width="18" height="18" rx="2" stroke-width="1.5"/><path d="M8 12h4l4-4" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>
                </div>
                <h3 class="font-display text-lg text-ink dark:text-on-dark mb-2">AI Task Agent</h3>
                <p class="text-sm text-ink-body dark:text-on-dark-soft leading-relaxed">
                  Describe what you need to get done and the agent breaks it into actionable tasks. Asks clarifying questions so nothing slips through.
                </p>
              </div>
              <!-- Feature 3 -->
              <div class="card">
                <div class="flex h-10 w-10 items-center justify-center rounded-lg bg-accent-amber/20 text-accent-amber mb-5">
                  <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10" stroke-width="1.5"/><path d="M8 14s1.5 2 4 2 4-2 4-2" stroke-width="1.5" stroke-linecap="round"/><circle cx="9" cy="9" r="1" fill="currentColor"/><circle cx="15" cy="9" r="1" fill="currentColor"/></svg>
                </div>
                <h3 class="font-display text-lg text-ink dark:text-on-dark mb-2">Emotion Detection</h3>
                <p class="text-sm text-ink-body dark:text-on-dark-soft leading-relaxed">
                  Journal after each session and the AI detects your mood. Get personalized content recommendations to support your wellbeing.
                </p>
              </div>
            </div>

            <div class="grid gap-6 md:grid-cols-3 mt-6">
              <!-- Feature 4 -->
              <div class="card">
                <div class="flex h-10 w-10 items-center justify-center rounded-lg bg-success/15 text-success mb-5">
                  <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M4 6h16M4 12h16M4 18h16" stroke-width="1.5" stroke-linecap="round"/><circle cx="8" cy="6" r="1.5" fill="currentColor" stroke="none"/><circle cx="8" cy="12" r="1.5" fill="currentColor" stroke="none"/><circle cx="8" cy="18" r="1.5" fill="currentColor" stroke="none"/></svg>
                </div>
                <h3 class="font-display text-lg text-ink dark:text-on-dark mb-2">Task Management</h3>
                <p class="text-sm text-ink-body dark:text-on-dark-soft leading-relaxed">
                  Full task CRUD with priorities, status tracking, and completion reviews. Kanban-style flows built for real productivity.
                </p>
              </div>
              <!-- Feature 5 -->
              <div class="card">
                <div class="flex h-10 w-10 items-center justify-center rounded-lg bg-warning/15 text-warning mb-5">
                  <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87L18.18 22 12 18.56 5.82 22 7 14.14l-5-4.87 6.91-1.01L12 2z" stroke-width="1.5" stroke-linejoin="round"/></svg>
                </div>
                <h3 class="font-display text-lg text-ink dark:text-on-dark mb-2">Report Export</h3>
                <p class="text-sm text-ink-body dark:text-on-dark-soft leading-relaxed">
                  Generate professional worklog reports as LaTeX or PDF. Summarize your focus time, completed tasks, and mood trends automatically.
                </p>
              </div>
              <!-- Feature 6 -->
              <div class="card">
                <div class="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary mb-5">
                  <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>
                </div>
                <h3 class="font-display text-lg text-ink dark:text-on-dark mb-2">Cloud Sync</h3>
                <p class="text-sm text-ink-body dark:text-on-dark-soft leading-relaxed">
                  Your tasks, focus sessions, and journals live securely in the cloud and stay in sync across every device you sign in on.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>

    <!-- ═══════════════════════════════════════════
         DARK SHOWCASE — Dark navy clip-path expansion
         ═══════════════════════════════════════════ -->
    <div class="sticky-zoom-wrapper">
      <section
        id="how-it-works"
        class="sticky-zoom-content bg-surface-dark"
        style="--inset-x: 0.04; --inset-y: 0.03;"
      >
        <!-- Background overlay that does the clip-path expansion -->
        <div class="sticky-zoom-bg bg-surface-dark"></div>
        <!-- Constrained content that fades in -->
        <div class="sticky-zoom-body">
          <div class="max-w-5xl mx-auto w-full px-4 py-20 md:py-28">
            <p class="text-xs font-medium uppercase tracking-widest text-on-dark-soft text-center mb-3">
              How it works
            </p>
            <h2 class="font-display text-display-md text-on-dark text-center mb-16">
              Focus, reflect, improve
            </h2>
            <div class="grid gap-6 md:grid-cols-3">
              <div class="bg-surface-dark-elevated border border-hairline-dark rounded-lg p-6 text-center">
                <div class="flex h-10 w-10 items-center justify-center rounded-full bg-primary/20 text-primary mx-auto mb-4 font-display text-lg">1</div>
                <h3 class="font-display text-lg text-on-dark mb-2">Start a session</h3>
                <p class="text-sm text-on-dark-soft leading-relaxed">
                  Pick a duration, choose ambient sounds, and begin your focus timer. The world fades away.
                </p>
              </div>
              <div class="bg-surface-dark-elevated border border-hairline-dark rounded-lg p-6 text-center">
                <div class="flex h-10 w-10 items-center justify-center rounded-full bg-primary/20 text-primary mx-auto mb-4 font-display text-lg">2</div>
                <h3 class="font-display text-lg text-on-dark mb-2">Journal your mood</h3>
                <p class="text-sm text-on-dark-soft leading-relaxed">
                  After each session, write a quick journal. The AI detects your emotional state and tracks patterns.
                </p>
              </div>
              <div class="bg-surface-dark-elevated border border-hairline-dark rounded-lg p-6 text-center">
                <div class="flex h-10 w-10 items-center justify-center rounded-full bg-primary/20 text-primary mx-auto mb-4 font-display text-lg">3</div>
                <h3 class="font-display text-lg text-on-dark mb-2">Export & share</h3>
                <p class="text-sm text-on-dark-soft leading-relaxed">
                  Generate worklog reports to share with your team. All your focus data, tasks, and moods in one document.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>

    <!-- ═══════════════════════════════════════════
         CORAL CTA — Final call to action
         ═══════════════════════════════════════════ -->
    <section class="bg-primary py-20 md:py-28 px-4">
      <div class="max-w-2xl mx-auto text-center">
        <h2 class="font-display text-display-md text-white mb-4">
          Ready to find your focus?
        </h2>
        <p class="text-white/80 text-lg leading-relaxed mb-8">
          Join developers and interns who use FCAJ Worklog to track their productivity,
          manage tasks with AI, and generate professional worklog reports.
        </p>
        <div class="flex flex-wrap gap-3 justify-center">
          <NuxtLink to="/login" class="rounded-md bg-white px-6 py-3 text-base font-medium text-primary hover:bg-canvas-card transition-colors">
            Use our product &rarr;
          </NuxtLink>
        </div>
        <p class="mt-6 text-sm text-white/50">
          No credit card required. Request access and start within minutes.
        </p>
      </div>
    </section>
  </div>
</template>

<script setup lang="ts">
import { useScrollZoom } from '~/composables/useScrollZoom'

definePageMeta({ layout: 'landing' })

// This is a public landing page — no auth required.
// Redirect authenticated users to their dashboard.
const { currentUser } = useAuth()
watchEffect(() => {
  if (currentUser.value) {
    navigateTo(currentUser.value.role === 'admin' ? '/admin' : '/dashboard')
  }
})

// Sticky scroll-zoom for landing-page sections
const { registerSection } = useScrollZoom()
onMounted(() => {
  registerSection('features', 150)
  registerSection('how-it-works', 150)
})
</script>
