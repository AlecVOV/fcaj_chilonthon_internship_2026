<template>
  <div class="flex min-h-screen items-center justify-center bg-canvas dark:bg-surface-dark p-4">
    <div class="w-full max-w-md animate-in">
      <div class="mb-8 text-center">
        <h1 class="font-display text-display-sm text-ink dark:text-on-dark">Reset Password</h1>
        <p class="mt-2 text-sm text-ink-muted dark:text-on-dark-soft">Đặt mật khẩu mới cho tài khoản của bạn</p>
      </div>

      <!-- Link không hợp lệ / đã hết hạn -->
      <div v-if="linkError" class="space-y-4">
        <p class="text-sm text-error dark:text-error">{{ linkError }}</p>
        <NuxtLink to="/login" class="btn-primary w-full block text-center">Quay lại đăng nhập</NuxtLink>
      </div>

      <!-- Thành công -->
      <div v-else-if="done" class="space-y-4">
        <p class="text-sm text-success dark:text-success">Đã đổi mật khẩu thành công. Vui lòng đăng nhập lại.</p>
        <NuxtLink to="/login" class="btn-primary w-full block text-center">Đến trang đăng nhập</NuxtLink>
      </div>

      <!-- Form đặt mật khẩu mới -->
      <form v-else-if="ready" @submit.prevent="handleSubmit" class="space-y-4">
        <div>
          <label class="block mb-1.5 text-xs font-medium text-ink-muted dark:text-on-dark-soft">Mật khẩu mới</label>
          <input v-model="password" type="password" class="input" placeholder="Minimum 6 characters" minlength="6" required autocomplete="new-password" />
        </div>
        <div>
          <label class="block mb-1.5 text-xs font-medium text-ink-muted dark:text-on-dark-soft">Xác nhận mật khẩu</label>
          <input v-model="confirm" type="password" class="input" placeholder="Re-enter password" minlength="6" required autocomplete="new-password" />
        </div>
        <p v-if="formError" class="text-sm text-error dark:text-error">{{ formError }}</p>
        <button type="submit" class="btn-primary w-full" :disabled="isLoading || !password || !confirm">
          {{ isLoading ? 'Saving' : 'Enter New Password' }}
        </button>
      </form>

      <p v-else class="text-center text-sm text-ink-muted dark:text-on-dark-soft">Authenticating</p>
    </div>
  </div>
</template>

<script setup lang="ts">
// pages/reset-password.vue — landing page cho link "quên mật khẩu" của Supabase.
// Supabase redirect về đây kèm access_token/refresh_token/type=recovery trong URL HASH
// (không phải query string). supabaseClient.ts tắt detectSessionInUrl (auto=false) nên
// phải tự đọc hash + setSession() thủ công ở đây trước khi cho phép đổi mật khẩu.
import { getSupabase } from '~/lib/supabaseClient'

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
    linkError.value = 'Liên kết đặt lại mật khẩu không hợp lệ hoặc đã hết hạn. Vui lòng yêu cầu link mới ở trang đăng nhập.'
    return
  }

  const { error } = await getSupabase().auth.setSession({ access_token: accessToken, refresh_token: refreshToken })
  if (error) {
    linkError.value = 'Liên kết đã hết hạn hoặc không hợp lệ. Vui lòng yêu cầu link mới ở trang đăng nhập.'
    return
  }
  ready.value = true
})

async function handleSubmit() {
  formError.value = ''
  if (password.value !== confirm.value) { formError.value = 'Mật khẩu xác nhận không khớp.'; return }
  if (password.value.length < 6) { formError.value = 'Mật khẩu tối thiểu 6 ký tự.'; return }

  isLoading.value = true
  try {
    const { error } = await getSupabase().auth.updateUser({ password: password.value })
    if (error) throw error
    // Đăng xuất session recovery -> buộc đăng nhập lại bằng mật khẩu mới qua luồng
    // login() bình thường (luồng đó mới populate đủ role/status vào useAuth).
    await getSupabase().auth.signOut()
    done.value = true
  } catch (e: any) {
    formError.value = e?.message || 'Không đổi được mật khẩu. Vui lòng thử lại.'
  } finally {
    isLoading.value = false
  }
}
</script>
