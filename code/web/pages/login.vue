<template>
  <div class="flex min-h-screen items-center justify-center bg-canvas dark:bg-surface-dark p-4">
    <div class="w-full max-w-md animate-in">
      <div class="mb-8 text-center">
        <h1 class="font-display text-display-sm text-ink dark:text-on-dark">FCAJ Worklog Repository </h1>
        <p class="mt-2 text-sm text-ink-muted dark:text-on-dark-soft">Your productive companion</p>
      </div>

      <!-- Tabs -->
      <div class="mb-6 flex border-b border-hairline dark:border-hairline-dark">
        <button @click="activeTab = 'signin'" class="tab flex-1 justify-center" :class="activeTab === 'signin' ? 'tab-active' : ''">Sign In</button>
        <button @click="activeTab = 'signup'" class="tab flex-1 justify-center" :class="activeTab === 'signup' ? 'tab-active' : ''">Request Access</button>
      </div>

      <!-- Sign In -->
      <form v-if="activeTab === 'signin'" @submit.prevent="handleLogin" class="space-y-4">
        <div><label class="block mb-1.5 text-xs font-medium text-ink-muted dark:text-on-dark-soft">Email</label><input v-model="email" type="email" class="input" placeholder="you@example.com" required autocomplete="email" /></div>
        <div><label class="block mb-1.5 text-xs font-medium text-ink-muted dark:text-on-dark-soft">Password</label><input v-model="pass" type="password" class="input" placeholder="Your password" required autocomplete="current-password" /></div>
        <p v-if="successMsg" class="text-sm text-success dark:text-success">{{ successMsg }}</p>
        <p v-if="authErrorText" class="text-sm text-error dark:text-error">{{ authErrorText }}</p>
        <button type="submit" class="btn-primary w-full" :disabled="authLoading || !email || !pass">{{ authLoading ? 'Please wait...' : 'Sign In' }}</button>
        <p class="text-center"><button type="button" @click="activeTab = 'forgot'" class="text-sm text-primary hover:underline">Forgot password?</button></p>
      </form>

      <!-- Sign Up -->
      <form v-if="activeTab === 'signup'" @submit.prevent="handleSignUp" class="space-y-4">
        <div class="rounded-lg border border-amber/30 bg-amber/5 p-3 text-xs text-warning dark:text-amber-400">
          <p class="font-medium mb-1">⚠️ Request Access</p>
          <p>This sends a registration request to admin for approval. If you already have demo credentials (admin@focusmode.app / user@focusmode.app), use <strong>Sign In</strong> instead.</p>
        </div>
        <div><label class="block mb-1.5 text-xs font-medium text-ink-muted dark:text-on-dark-soft">Full Name</label><input v-model="signupName" class="input" placeholder="Jane Doe" required /></div>
        <div><label class="block mb-1.5 text-xs font-medium text-ink-muted dark:text-on-dark-soft">Email</label><input v-model="signupEmail" type="email" class="input" placeholder="jane@example.com" required autocomplete="email" /></div>
        <div><label class="block mb-1.5 text-xs font-medium text-ink-muted dark:text-on-dark-soft">Password</label><input v-model="signupPass" type="password" class="input" placeholder="Min 6 characters" minlength="6" required /></div>
        <p class="text-xs text-ink-muted dark:text-on-dark-soft">Your account will be created with the password you just set, then an admin must approve it before you can sign in.</p>
        <p v-if="signupError" class="text-sm text-error dark:text-error">{{ signupError }}</p>
        <p v-if="successMsg" class="text-sm text-success dark:text-success">{{ successMsg }}</p>
        <button type="submit" class="btn-primary w-full" :disabled="authLoading || !signupName.trim() || !signupEmail.trim() || !signupPass.trim()">{{ authLoading ? 'Creating...' : 'Create Account' }}</button>
      </form>

      <!-- Forgot Password -->
      <form v-if="activeTab === 'forgot'" @submit.prevent="handleForgot" class="space-y-4">
        <div><label class="block mb-1.5 text-xs font-medium text-ink-muted dark:text-on-dark-soft">Email</label><input v-model="forgotEmail" type="email" class="input" placeholder="you@example.com" required /></div>
        <p v-if="authErrorText" class="text-sm text-error dark:text-error">{{ authErrorText }}</p>
        <p v-if="successMsg" class="text-sm text-success dark:text-success">{{ successMsg }}</p>
        <button type="submit" class="btn-primary w-full" :disabled="authLoading || !forgotEmail.trim()">{{ authLoading ? 'Sending...' : 'Send Reset Link' }}</button>
        <p class="text-center"><button type="button" @click="activeTab = 'signin'" class="text-sm text-primary hover:underline">Back to Sign In</button></p>
      </form>
    </div>
  </div>
</template>

<script setup lang="ts">
import { useAuth } from '~/composables/useAuth'

const { isLoading: authLoading, authError, signUp, login, forgotPassword } = useAuth()

const activeTab = ref<'signin' | 'signup' | 'forgot'>('signin')
const email = ref(''); const pass = ref(''); const successMsg = ref('')
const signupName = ref(''); const signupEmail = ref(''); const signupPass = ref(''); const signupError = ref('')
const forgotEmail = ref('')
const route = useRoute()

const authErrorText = computed(() => authError.value)

async function handleLogin() {
  successMsg.value = ''
  try {
    const user = await login(email.value, pass.value)
    const redirect = (route.query.redirect as string) || (user.role === 'admin' ? '/admin' : '/dashboard')
    await navigateTo(redirect)
  } catch { /* error shown via authErrorText */ }
}

async function handleSignUp() {
  successMsg.value = ''; signupError.value = ''
  try {
    await signUp(signupName.value.trim(), signupEmail.value.trim(), signupPass.value.trim())
    successMsg.value = 'Request submitted! An admin must approve your account before you can sign in.'
    signupName.value = ''; signupEmail.value = ''; signupPass.value = ''; activeTab.value = 'signin'
  } catch (e: any) {
    // Surface the real reason instead of failing silently.
    signupError.value = e?.message || 'Sign-up failed. Check the email/password and try again.'
  }
}

async function handleForgot() {
  successMsg.value = ''
  try {
    successMsg.value = forgotPassword(forgotEmail.value.trim())
    forgotEmail.value = ''
  } catch { /* ignore */ }
}
</script>
