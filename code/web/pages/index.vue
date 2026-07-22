<template>
  <div>
    <!-- ═══════════════════════════════════════════
         HERO — Cream canvas, big serif headline
         ═══════════════════════════════════════════ -->
    <section class="flex flex-col items-center text-center py-20 md:py-28 px-4">
      <span class="inline-flex items-center rounded-pill bg-primary/10 px-3 py-1 text-xs font-medium text-primary mb-6">
        {{ t('landing.badge') }} <NuxtLink to="/login" class="underline">{{ t('landing.requestAccess') }}</NuxtLink>
      </span>
      <h1 class="font-display text-display-xl md:text-[4rem] text-ink dark:text-on-dark max-w-4xl leading-none">
        {{ t('landing.heroTitleLine1') }}<br />{{ t('landing.heroTitleLine2') }}
      </h1>
      <p class="mt-6 max-w-xl text-lg text-ink-body dark:text-on-dark-soft leading-relaxed">
        {{ t('landing.heroSubtitle') }}
      </p>
      <div class="mt-8 flex flex-wrap gap-3 justify-center">
        <NuxtLink to="/login" class="btn-primary text-base px-6 py-3">
          {{ t('landing.useProductArrow') }}
        </NuxtLink>
        <a href="/#features" class="btn-outline text-base px-6 py-3">
          {{ t('landing.seeWhatItDoes') }}
        </a>
      </div>
    </section>

    <!-- ═══════════════════════════════════════════
         STATS TRUST BAR
         ═══════════════════════════════════════════ -->
    <section class="max-w-4xl mx-auto px-4 pb-20 md:pb-28">
      <div class="grid gap-4 sm:grid-cols-3 text-center">
        <div class="card">
          <p class="font-display text-3xl text-ink dark:text-on-dark">{{ t('landing.stat1Value') }}</p>
          <p class="mt-1 text-xs text-ink-muted dark:text-on-dark-soft">{{ t('landing.stat1Label') }}</p>
        </div>
        <div class="card">
          <p class="font-display text-3xl text-ink dark:text-on-dark">{{ t('landing.stat2Value') }}</p>
          <p class="mt-1 text-xs text-ink-muted dark:text-on-dark-soft">{{ t('landing.stat2Label') }}</p>
        </div>
        <div class="card">
          <p class="font-display text-3xl text-ink dark:text-on-dark">{{ t('landing.stat3Value') }}</p>
          <p class="mt-1 text-xs text-ink-muted dark:text-on-dark-soft">{{ t('landing.stat3Label') }}</p>
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
              {{ t('landing.featuresEyebrow') }}
            </p>
            <h2 class="font-display text-display-md text-ink dark:text-on-dark text-center mb-16">
              {{ t('landing.featuresTitle') }}
            </h2>

            <div class="grid gap-6 md:grid-cols-3">
              <!-- Feature 1 -->
              <div class="card">
                <div class="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary mb-5">
                  <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10" stroke-width="1.5"/><path d="M12 6v6l4 2" stroke-width="1.5" stroke-linecap="round"/></svg>
                </div>
                <h3 class="font-display text-lg text-ink dark:text-on-dark mb-2">{{ t('landing.feature1Title') }}</h3>
                <p class="text-sm text-ink-body dark:text-on-dark-soft leading-relaxed">
                  {{ t('landing.feature1Desc') }}
                </p>
              </div>
              <!-- Feature 2 -->
              <div class="card">
                <div class="flex h-10 w-10 items-center justify-center rounded-lg bg-accent-teal/20 text-accent-teal mb-5">
                  <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><rect x="3" y="3" width="18" height="18" rx="2" stroke-width="1.5"/><path d="M8 12h4l4-4" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>
                </div>
                <h3 class="font-display text-lg text-ink dark:text-on-dark mb-2">{{ t('landing.feature2Title') }}</h3>
                <p class="text-sm text-ink-body dark:text-on-dark-soft leading-relaxed">
                  {{ t('landing.feature2Desc') }}
                </p>
              </div>
              <!-- Feature 3 -->
              <div class="card">
                <div class="flex h-10 w-10 items-center justify-center rounded-lg bg-accent-amber/20 text-accent-amber mb-5">
                  <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10" stroke-width="1.5"/><path d="M8 14s1.5 2 4 2 4-2 4-2" stroke-width="1.5" stroke-linecap="round"/><circle cx="9" cy="9" r="1" fill="currentColor"/><circle cx="15" cy="9" r="1" fill="currentColor"/></svg>
                </div>
                <h3 class="font-display text-lg text-ink dark:text-on-dark mb-2">{{ t('landing.feature3Title') }}</h3>
                <p class="text-sm text-ink-body dark:text-on-dark-soft leading-relaxed">
                  {{ t('landing.feature3Desc') }}
                </p>
              </div>
            </div>

            <div class="grid gap-6 md:grid-cols-3 mt-6">
              <!-- Feature 4 -->
              <div class="card">
                <div class="flex h-10 w-10 items-center justify-center rounded-lg bg-success/15 text-success mb-5">
                  <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M4 6h16M4 12h16M4 18h16" stroke-width="1.5" stroke-linecap="round"/><circle cx="8" cy="6" r="1.5" fill="currentColor" stroke="none"/><circle cx="8" cy="12" r="1.5" fill="currentColor" stroke="none"/><circle cx="8" cy="18" r="1.5" fill="currentColor" stroke="none"/></svg>
                </div>
                <h3 class="font-display text-lg text-ink dark:text-on-dark mb-2">{{ t('landing.feature4Title') }}</h3>
                <p class="text-sm text-ink-body dark:text-on-dark-soft leading-relaxed">
                  {{ t('landing.feature4Desc') }}
                </p>
              </div>
              <!-- Feature 5 -->
              <div class="card">
                <div class="flex h-10 w-10 items-center justify-center rounded-lg bg-warning/15 text-warning mb-5">
                  <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87L18.18 22 12 18.56 5.82 22 7 14.14l-5-4.87 6.91-1.01L12 2z" stroke-width="1.5" stroke-linejoin="round"/></svg>
                </div>
                <h3 class="font-display text-lg text-ink dark:text-on-dark mb-2">{{ t('landing.feature5Title') }}</h3>
                <p class="text-sm text-ink-body dark:text-on-dark-soft leading-relaxed">
                  {{ t('landing.feature5Desc') }}
                </p>
              </div>
              <!-- Feature 6 -->
              <div class="card">
                <div class="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary mb-5">
                  <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>
                </div>
                <h3 class="font-display text-lg text-ink dark:text-on-dark mb-2">{{ t('landing.feature6Title') }}</h3>
                <p class="text-sm text-ink-body dark:text-on-dark-soft leading-relaxed">
                  {{ t('landing.feature6Desc') }}
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
              {{ t('landing.howEyebrow') }}
            </p>
            <h2 class="font-display text-display-md text-on-dark text-center mb-16">
              {{ t('landing.howTitle') }}
            </h2>
            <div class="grid gap-6 md:grid-cols-3">
              <div class="bg-surface-dark-elevated border border-hairline-dark rounded-lg p-6 text-center">
                <div class="flex h-10 w-10 items-center justify-center rounded-full bg-primary/20 text-primary mx-auto mb-4 font-display text-lg">1</div>
                <h3 class="font-display text-lg text-on-dark mb-2">{{ t('landing.step1Title') }}</h3>
                <p class="text-sm text-on-dark-soft leading-relaxed">
                  {{ t('landing.step1Desc') }}
                </p>
              </div>
              <div class="bg-surface-dark-elevated border border-hairline-dark rounded-lg p-6 text-center">
                <div class="flex h-10 w-10 items-center justify-center rounded-full bg-primary/20 text-primary mx-auto mb-4 font-display text-lg">2</div>
                <h3 class="font-display text-lg text-on-dark mb-2">{{ t('landing.step2Title') }}</h3>
                <p class="text-sm text-on-dark-soft leading-relaxed">
                  {{ t('landing.step2Desc') }}
                </p>
              </div>
              <div class="bg-surface-dark-elevated border border-hairline-dark rounded-lg p-6 text-center">
                <div class="flex h-10 w-10 items-center justify-center rounded-full bg-primary/20 text-primary mx-auto mb-4 font-display text-lg">3</div>
                <h3 class="font-display text-lg text-on-dark mb-2">{{ t('landing.step3Title') }}</h3>
                <p class="text-sm text-on-dark-soft leading-relaxed">
                  {{ t('landing.step3Desc') }}
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
          {{ t('landing.ctaTitle') }}
        </h2>
        <p class="text-white/80 text-lg leading-relaxed mb-8">
          {{ t('landing.ctaSubtitle') }}
        </p>
        <div class="flex flex-wrap gap-3 justify-center">
          <NuxtLink to="/login" class="rounded-md bg-white px-6 py-3 text-base font-medium text-primary hover:bg-canvas-card transition-colors">
            {{ t('landing.useProductArrow') }}
          </NuxtLink>
        </div>
        <p class="mt-6 text-sm text-white/50">
          {{ t('landing.ctaNote') }}
        </p>
      </div>
    </section>
  </div>
</template>

<script setup lang="ts">
import { useScrollZoom } from '~/composables/useScrollZoom'

definePageMeta({ layout: 'landing' })

const { t } = useLocale()

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
