<template>
  <div class="animate-in space-y-6">
    <div class="mb-6">
      <h1 class="font-display text-display-sm text-ink dark:text-on-dark">{{ t('guide.heading') }}</h1>
      <p class="mt-1 text-sm text-ink-muted dark:text-on-dark-soft">{{ t('guide.subheading') }}</p>
    </div>

    <div v-for="section in sections" :key="section.title" class="card">
      <h2 class="font-display text-lg text-ink dark:text-on-dark mb-1">{{ section.title }}</h2>
      <p class="text-sm text-ink-muted dark:text-on-dark-soft mb-3">{{ section.tagline }}</p>
      <ul class="list-disc list-inside space-y-1.5 text-sm text-ink-body dark:text-on-dark-soft">
        <li v-for="(point, i) in section.points" :key="i" v-html="point" />
      </ul>
    </div>

    <!-- Task creation flow — sits between Profile/Worklog and Still stuck?, per the two ways
         (manual vs Agent) to get from an idea to a logged, reflected-on focus session. -->
    <div class="card">
      <h2 class="font-display text-lg text-ink dark:text-on-dark mb-1">{{ t('guide.flowTitle') }}</h2>
      <p class="text-sm text-ink-muted dark:text-on-dark-soft mb-4">{{ t('guide.flowTagline') }}</p>
      <div class="grid gap-4 sm:grid-cols-2">
        <div class="rounded-md border border-hairline dark:border-hairline-dark p-3">
          <p class="text-xs font-medium uppercase tracking-wider text-ink-muted dark:text-on-dark-soft mb-2">{{ t('guide.flowManualTitle') }}</p>
          <ol class="list-decimal list-inside space-y-1.5 text-sm text-ink-body dark:text-on-dark-soft">
            <li v-for="(step, i) in manualFlowSteps" :key="i" v-html="step" />
          </ol>
        </div>
        <div class="rounded-md border border-hairline dark:border-hairline-dark p-3">
          <p class="text-xs font-medium uppercase tracking-wider text-ink-muted dark:text-on-dark-soft mb-2">{{ t('guide.flowAgentTitle') }}</p>
          <ol class="list-decimal list-inside space-y-1.5 text-sm text-ink-body dark:text-on-dark-soft">
            <li v-for="(step, i) in agentFlowSteps" :key="i" v-html="step" />
          </ol>
        </div>
      </div>
    </div>

    <div class="card">
      <h2 class="font-display text-lg text-ink dark:text-on-dark mb-1">{{ t('guide.stuckTitle') }}</h2>
      <p class="text-sm text-ink-body dark:text-on-dark-soft">
        {{ t('guide.stuckText') }}
        <NuxtLink to="/profile" class="link">{{ t('guide.stuckLink') }}</NuxtLink>
        {{ t('guide.stuckSuffix') }}
      </p>
    </div>
  </div>
</template>

<script setup lang="ts">
definePageMeta({ middleware: ['auth'] })

const { t } = useLocale()

const sections = computed(() => [
  {
    title: t('guide.s1Title'), tagline: t('guide.s1Tagline'),
    points: [t('guide.s1P1'), t('guide.s1P2')],
  },
  {
    title: t('guide.s2Title'), tagline: t('guide.s2Tagline'),
    points: [t('guide.s2P1'), t('guide.s2P2'), t('guide.s2P3')],
  },
  {
    title: t('guide.s3Title'), tagline: t('guide.s3Tagline'),
    points: [t('guide.s3P1'), t('guide.s3P2')],
  },
  {
    title: t('guide.s4Title'), tagline: t('guide.s4Tagline'),
    points: [t('guide.s4P1'), t('guide.s4P2'), t('guide.s4P3')],
  },
  {
    title: t('guide.s5Title'), tagline: t('guide.s5Tagline'),
    points: [t('guide.s5P1'), t('guide.s5P2'), t('guide.s5P3')],
  },
])

const manualFlowSteps = computed(() => [
  t('guide.flowManualStep1'), t('guide.flowManualStep2'), t('guide.flowManualStep3'),
  t('guide.flowManualStep4'), t('guide.flowManualStep5'),
])
const agentFlowSteps = computed(() => [
  t('guide.flowAgentStep1'), t('guide.flowAgentStep2'), t('guide.flowAgentStep3'),
  t('guide.flowAgentStep4'), t('guide.flowAgentStep5'),
])
</script>
