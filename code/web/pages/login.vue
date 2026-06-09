<template>
  <div class="flex min-h-screen items-center justify-center bg-neutral-100 dark:bg-dark-bg p-4">
    <div class="w-full max-w-md animate-in">
      <div class="mb-8 text-center">
        <h1 class="text-xl font-bold text-neutral-950 dark:text-dark-text">Focus Mode</h1>
        <p class="mt-1 text-sm text-neutral-950/40 dark:text-white/30">Your productive companion</p>
      </div>

      <!-- Tabs -->
      <div class="mb-6 flex border-b border-neutral-200 dark:border-dark-border">
        <button @click="activeTab = 'signin'" class="tab flex-1 justify-center" :class="activeTab === 'signin' ? 'tab-active' : ''">Sign In</button>
        <button @click="activeTab = 'signup'" class="tab flex-1 justify-center" :class="activeTab === 'signup' ? 'tab-active' : ''">Request Access</button>
      </div>

      <!-- Sign In -->
      <form v-if="activeTab === 'signin'" @submit.prevent="handleLogin" class="space-y-4">
        <div><label class="block mb-1.5 text-xs font-medium text-neutral-950/60 dark:text-white/40">Email</label><input v-model="email" type="email" class="input" placeholder="you@example.com" required autocomplete="email" /></div>
        <div><label class="block mb-1.5 text-xs font-medium text-neutral-950/60 dark:text-white/40">Password</label><input v-model="pass" type="password" class="input" placeholder="Password or OTP" required autocomplete="current-password" /></div>
        <p v-if="authErrorText" class="text-sm text-critical dark:text-critical-dark">{{ authErrorText }}</p>
        <button type="submit" class="btn-primary w-full" :disabled="authLoading || !email || !pass">{{ authLoading ? 'Please wait...' : 'Sign In' }}</button>
        <p class="text-center"><button type="button" @click="activeTab = 'forgot'" class="text-xs text-interactive-blue hover:underline">Forgot password?</button></p>
      </form>

      <!-- Sign Up -->
      <form v-if="activeTab === 'signup'" @submit.prevent="handleSignUp" class="space-y-4">
        <div><label class="block mb-1.5 text-xs font-medium text-neutral-950/60 dark:text-white/40">Full Name</label><input v-model="signupName" class="input" placeholder="Jane Doe" required /></div>
        <div><label class="block mb-1.5 text-xs font-medium text-neutral-950/60 dark:text-white/40">Email</label><input v-model="signupEmail" type="email" class="input" placeholder="jane@example.com" required autocomplete="email" /></div>
        <p class="text-xs text-neutral-950/40 dark:text-white/30">No password needed — admin reviews your request, then you'll receive a one-time password.</p>
        <p v-if="authErrorText" class="text-sm text-critical dark:text-critical-dark">{{ authErrorText }}</p>
        <p v-if="successMsg" class="text-sm text-success dark:text-success-dark">{{ successMsg }}</p>
        <button type="submit" class="btn-primary w-full" :disabled="authLoading || !signupName.trim() || !signupEmail.trim()">{{ authLoading ? 'Sending...' : 'Request Access' }}</button>
      </form>

      <!-- Forgot Password -->
      <form v-if="activeTab === 'forgot'" @submit.prevent="handleForgot" class="space-y-4">
        <div><label class="block mb-1.5 text-xs font-medium text-neutral-950/60 dark:text-white/40">Email</label><input v-model="forgotEmail" type="email" class="input" placeholder="you@example.com" required /></div>
        <p v-if="authErrorText" class="text-sm text-critical dark:text-critical-dark">{{ authErrorText }}</p>
        <p v-if="successMsg" class="text-sm text-success dark:text-success-dark">{{ successMsg }}</p>
        <button type="submit" class="btn-primary w-full" :disabled="authLoading || !forgotEmail.trim()">{{ authLoading ? 'Sending...' : 'Send Reset OTP' }}</button>
        <p class="text-center"><button type="button" @click="activeTab = 'signin'" class="text-xs text-interactive-blue hover:underline">Back to Sign In</button></p>
      </form>

      <!-- Force Password Change -->
      <div v-if="needsPasswordChange" class="fixed inset-0 z-50 flex items-center justify-center bg-black/20 backdrop-blur-sm">
        <div class="card w-full max-w-md animate-in">
          <h2 class="mb-4 text-base font-semibold text-neutral-950 dark:text-dark-text">Change Your Password</h2>
          <p class="text-sm text-neutral-950/50 dark:text-white/30 mb-4">You logged in with a one-time password. Create a permanent password.</p>
          <div class="space-y-3">
            <div><label class="block mb-1 text-xs font-medium text-neutral-950/50 dark:text-white/30">New Password</label><input v-model="newPass" type="password" class="input" placeholder="Min 6 characters" minlength="6" /></div>
            <div><label class="block mb-1 text-xs font-medium text-neutral-950/50 dark:text-white/30">Confirm Password</label><input v-model="confirmPass" type="password" class="input" placeholder="Re-enter password" minlength="6" /></div>
          </div>
          <p v-if="changePassError" class="mt-2 text-sm text-critical dark:text-critical-dark">{{ changePassError }}</p>
          <div class="mt-4 flex justify-end gap-2">
            <button @click="handleChangePassword" class="btn-primary" :disabled="!newPass || newPass !== confirmPass || newPass.length < 6">Set Password</button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { useAuth } from '~/composables/useAuth'

definePageMeta({ layout: false, middleware: undefined })

const { isAuthenticated, isLoading: authLoading, authError, needsPasswordChange, signUp, login, changePassword, forgotPassword } = useAuth()

const activeTab = ref<'signin' | 'signup' | 'forgot'>('signin')
const email = ref(''); const pass = ref(''); const successMsg = ref('')
const signupName = ref(''); const signupEmail = ref('')
const forgotEmail = ref('')
const newPass = ref(''); const confirmPass = ref(''); const changePassError = ref('')
const route = useRoute()

const authErrorText = computed(() => authError.value)

async function handleLogin() {
  successMsg.value = ''
  try {
    const user = await login(email.value, pass.value)
    if (!user.requiresPasswordChange) await navigateTo(user.role === 'admin' ? '/admin' : '/')
  } catch {}
}

async function handleSignUp() {
  successMsg.value = ''
  try {
    await signUp(signupName.value.trim(), signupEmail.value.trim())
    successMsg.value = 'Request submitted! Admin will review your account.'
    signupName.value = ''; signupEmail.value = ''; activeTab.value = 'signin'
  } catch {}
}

async function handleForgot() {
  successMsg.value = ''
  try {
    const otp = forgotPassword(forgotEmail.value.trim())
    successMsg.value = `A one-time password has been sent. (Mock OTP: ${otp})`
    forgotEmail.value = ''
  } catch {}
}

async function handleChangePassword() {
  changePassError.value = ''
  if (newPass.value !== confirmPass.value) { changePassError.value = 'Passwords do not match'; return }
  if (newPass.value.length < 6) { changePassError.value = 'Password must be at least 6 characters'; return }
  try { changePassword(newPass.value); await navigateTo('/') } catch (e: any) { changePassError.value = e?.message }
}
</script>
