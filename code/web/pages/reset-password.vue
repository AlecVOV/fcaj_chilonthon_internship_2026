<template>
  <div class="flex min-h-screen items-center justify-center bg-canvas dark:bg-surface-dark p-4">
    <div class="w-full max-w-md animate-in">
      <div class="mb-8 text-center">
        <h1 class="font-display text-display-sm text-ink dark:text-on-dark">{{ t('resetPassword.title') }}</h1>
        <p class="mt-2 text-sm text-ink-muted dark:text-on-dark-soft">{{ t('resetPassword.subtitle') }}</p>
      </div>

      <!-- Link không hợp lệ / đã hết hạn -->
      <div v-if="linkError" class="space-y-4">
        <p class="text-sm text-error dark:text-error">{{ linkError }}</p>
        <NuxtLink to="/login" class="btn-primary w-full block text-center">{{ t('resetPassword.goToLogin') }}</NuxtLink>
      </div>

      <!-- Thành công -->
      <div v-else-if="done" class="space-y-4">
        <p class="text-sm text-success dark:text-success">{{ t('resetPassword.success') }}</p>
        <NuxtLink to="/login" class="btn-primary w-full block text-center">{{ t('resetPassword.goToLogin') }}</NuxtLink>
      </div>

      <!-- Form đặt mật khẩu mới -->
      <form v-else-if="ready" @submit.prevent="handleSubmit" class="space-y-4">
        <div>
          <label class="block mb-1.5 text-xs font-medium text-ink-muted dark:text-on-dark-soft">{{ t('resetPassword.newPassword') }}</label>
          <input v-model="password" type="password" class="input" :placeholder="t('resetPassword.newPasswordPlaceholder')" minlength="6" required autocomplete="new-password" />
        </div>
        <div>
          <label class="block mb-1.5 text-xs font-medium text-ink-muted dark:text-on-dark-soft">{{ t('resetPassword.confirmPassword') }}</label>
          <input v-model="confirm" type="password" class="input" :placeholder="t('resetPassword.confirmPasswordPlaceholder')" minlength="6" required autocomplete="new-password" />
        </div>
        <p v-if="formError" class="text-sm text-error dark:text-error">{{ formError }}</p>
        <button type="submit" class="btn-primary w-full" :disabled="isLoading || !password || !confirm">
          {{ isLoading ? t('resetPassword.saving') : t('resetPassword.submit') }}
        </button>
      </form>

      <p v-else class="text-center text-sm text-ink-muted dark:text-on-dark-soft">{{ t('resetPassword.authenticating') }}</p>
    </div>
  </div>
</template>

<script setup lang="ts">
// pages/reset-password.vue — landing page cho link "quên mật khẩu" của Supabase.
// Supabase redirect về đây kèm access_token/refresh_token/type=recovery trong URL HASH
// (không phải query string). supabaseClient.ts tắt detectSessionInUrl (auto=false) nên
// phải tự đọc hash + setSession() thủ công ở đây trước khi cho phép đổi mật khẩu.
import { getSupabase } from '~/lib/supabaseClient'

const { t } = useLocale()

const ready = ref(false)
const done = ref(false)
const linkError = ref('')
const formError = ref('')
const isLoading = ref(false)
const password = ref('')
const confirm = ref('')

onMounted(async () => {
  const hash = window.location.hash.startsWith('#') ? window.location.hash.slice(1) : ''
  const params = new URLSearchParams(hash)
  const accessToken = params.get('access_token')
  const refreshToken = params.get('refresh_token')
  const type = params.get('type')

  // Xóa token khỏi thanh địa chỉ/lịch sử trình duyệt ngay, dù link hợp lệ hay không.
  if (hash) window.history.replaceState(null, '', window.location.pathname)

  if (!accessToken || !refreshToken || type !== 'recovery') {
    linkError.value = t('resetPassword.linkInvalid')
    return
  }

  const { error } = await getSupabase().auth.setSession({ access_token: accessToken, refresh_token: refreshToken })
  if (error) {
    linkError.value = t('resetPassword.linkExpired')
    return
  }
  ready.value = true
})

async function handleSubmit() {
  formError.value = ''
  if (password.value !== confirm.value) { formError.value = t('resetPassword.mismatch'); return }
  if (password.value.length < 6) { formError.value = t('resetPassword.tooShort'); return }

  isLoading.value = true
  try {
    const { error } = await getSupabase().auth.updateUser({ password: password.value })
    if (error) throw error
    // Đăng xuất session recovery -> buộc đăng nhập lại bằng mật khẩu mới qua luồng
    // login() bình thường (luồng đó mới populate đủ role/status vào useAuth).
    await getSupabase().auth.signOut()
    done.value = true
  } catch (e: any) {
    formError.value = e?.message || t('resetPassword.updateFailed')
  } finally {
    isLoading.value = false
  }
}
</script>
