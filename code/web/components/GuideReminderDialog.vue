<template>
  <div v-if="show" class="fixed inset-0 z-50 flex items-center justify-center bg-ink/20 backdrop-blur-sm" @click.self="dismiss">
    <div class="card w-full max-w-sm animate-in text-center space-y-3" @click.stop>
      <h2 class="font-display text-lg text-ink dark:text-on-dark">{{ t('guideDialog.title') }}</h2>
      <p class="text-sm text-ink-body dark:text-on-dark-soft">{{ t('guideDialog.body') }}</p>
      <div class="flex justify-center gap-2 pt-1">
        <button @click="dismiss" class="btn-ghost">{{ t('guideDialog.dismiss') }}</button>
        <NuxtLink to="/guide" @click="dismiss" class="btn-primary">{{ t('guideDialog.open') }}</NuxtLink>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
// Shown once right after a fresh sign-in (flag set in useAuth.login()), not on every
// page load — a restored session (syncSession) never sets the flag.
const { t } = useLocale()
const show = ref(false)

onMounted(() => {
  try {
    if (sessionStorage.getItem('focus_show_guide_dialog') === '1') show.value = true
  } catch { /* ignore */ }
})

function dismiss() {
  show.value = false
  try { sessionStorage.removeItem('focus_show_guide_dialog') } catch { /* ignore */ }
}
</script>
