// composables/useAuth.ts
//
// Auth service — approval workflow:
//   1. User signs up → status = 'pending' → admin must approve
//   2. Admin approves → auto-generates OTP → user receives it (simulated)
//   3. User logs in with email + OTP → forced to change password
//   4. After change → permanent password, normal login

import { ref, computed } from 'vue'
import { useConfig } from '~/composables/useConfig'

// ── Types ─────────────────────────────────────────────────────────────────
export interface AuthUser {
  id: string; email: string; role: 'admin' | 'user'; name: string
  status: 'pending' | 'approved' | 'rejected'
  requiresPasswordChange: boolean
  oneTimePassword?: string
}

export interface PendingUser {
  id: string; email: string; name: string; status: 'pending' | 'approved' | 'rejected'
  requestedAt: string; approvedAt?: string
}

// ── Admin ────────────────────────────────────────────────────────────────
const ADMIN = { id: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', email: 'admin@focusmode.app', password: 'admin123', role: 'admin' as const, name: 'Admin' }

// ── State ─────────────────────────────────────────────────────────────────
const currentUser = ref<AuthUser | null>(null)
const isLoading = ref(false)
const authError = ref<string | null>(null)
const pendingUsers: PendingUser[] = []
const userCredentials: Record<string, { password: string; otpUsed: boolean }> = {}

// ── Helpers ──────────────────────────────────────────────────────────────
function restoreSession(): boolean {
  if (import.meta.server) return false
  try { const s = localStorage.getItem('focus_auth_user'); if (s) { currentUser.value = JSON.parse(s); return true } } catch {}
  return false
}

function genOTP(): string { return Math.random().toString(36).slice(2, 8).toUpperCase() }

// ── Composable ────────────────────────────────────────────────────────────
export function useAuth() {
  const { useMockBackend } = useConfig()
  if (!import.meta.server && !currentUser.value) restoreSession()

  const isAuthenticated = computed(() => currentUser.value !== null)
  const isAdmin = computed(() => currentUser.value?.role === 'admin')
  const needsPasswordChange = computed(() => currentUser.value?.requiresPasswordChange === true)

  // ── Sign Up (creates pending request) ───────────────────────────────────
  async function signUp(name: string, email: string): Promise<void> {
    isLoading.value = true; authError.value = null
    try {
      await new Promise(r => setTimeout(r, 400))
      if (pendingUsers.find(u => u.email === email)) throw new Error('A request already exists for this email.')
      pendingUsers.push({ id: crypto.randomUUID(), email: email.toLowerCase(), name, status: 'pending', requestedAt: new Date().toISOString() })
    } catch (e: any) { authError.value = e?.message || 'Sign-up failed'; throw e }
    finally { isLoading.value = false }
  }

  // ── Admin: Approve → generates OTP ─────────────────────────────────────
  function approveUser(userId: string): string {
    const u = pendingUsers.find(p => p.id === userId); if (!u) throw new Error('User not found')
    u.status = 'approved'; u.approvedAt = new Date().toISOString()
    const otp = genOTP()
    userCredentials[u.email] = { password: otp, otpUsed: false }
    return otp // In production: email this to user
  }

  // ── Admin: Reject ──────────────────────────────────────────────────────
  function rejectUser(userId: string): void {
    const u = pendingUsers.find(p => p.id === userId); if (u) u.status = 'rejected'
  }

  function getPendingUsers(): PendingUser[] { return [...pendingUsers] }

  // ── Login ───────────────────────────────────────────────────────────────
  async function login(email: string, password: string): Promise<AuthUser> {
    isLoading.value = true; authError.value = null
    try {
      await new Promise(r => setTimeout(r, 400))
      const key = email.toLowerCase()

      // Admin
      if (key === ADMIN.email && password === ADMIN.password) {
        const u: AuthUser = { id: ADMIN.id, email: ADMIN.email, role: ADMIN.role, name: ADMIN.name, status: 'approved', requiresPasswordChange: false }
        currentUser.value = u; if (!import.meta.server) localStorage.setItem('focus_auth_user', JSON.stringify(u))
        return u
      }

      // Regular user flow
      const pending = pendingUsers.find(p => p.email === key)
      if (!pending || pending.status === 'pending') throw new Error('Your account is pending admin approval. Please wait.')
      if (pending.status === 'rejected') throw new Error('Your account request was rejected.')

      const cred = userCredentials[key]
      if (!cred || password !== cred.password) throw new Error('Invalid email or password.')

      // First login with OTP → must change password
      if (!cred.otpUsed) {
        cred.otpUsed = true
        const u: AuthUser = { id: pending.id, email: pending.email, role: 'user', name: pending.name, status: 'approved', requiresPasswordChange: true, oneTimePassword: cred.password }
        currentUser.value = u; if (!import.meta.server) localStorage.setItem('focus_auth_user', JSON.stringify(u))
        return u
      }

      // Normal login
      const u: AuthUser = { id: pending.id, email: pending.email, role: 'user', name: pending.name, status: 'approved', requiresPasswordChange: false }
      currentUser.value = u; if (!import.meta.server) localStorage.setItem('focus_auth_user', JSON.stringify(u))
      return u
    } catch (e: any) { authError.value = e?.message || 'Login failed'; throw e }
    finally { isLoading.value = false }
  }

  // ── Change Password ─────────────────────────────────────────────────────
  function changePassword(newPassword: string): void {
    if (!currentUser.value) throw new Error('Not logged in')
    userCredentials[currentUser.value.email.toLowerCase()] = { password: newPassword, otpUsed: true }
    currentUser.value.requiresPasswordChange = false
    if (!import.meta.server) localStorage.setItem('focus_auth_user', JSON.stringify(currentUser.value))
  }

  // ── Forgot Password (generates new OTP) ─────────────────────────────────
  function forgotPassword(email: string): string {
    const key = email.toLowerCase()
    const pending = pendingUsers.find(p => p.email === key)
    if (!pending || pending.status !== 'approved') throw new Error('Account not found or not approved.')
    const otp = genOTP()
    userCredentials[key] = { password: otp, otpUsed: false }
    return otp
  }

  // ── Logout ──────────────────────────────────────────────────────────────
  async function logout(): Promise<void> {
    currentUser.value = null; if (!import.meta.server) localStorage.removeItem('focus_auth_user')
    navigateTo('/login')
  }

  return {
    currentUser, isAuthenticated, isAdmin, needsPasswordChange,
    isLoading, authError,
    signUp, login, logout, restoreSession,
    approveUser, rejectUser, getPendingUsers,
    changePassword, forgotPassword,
  }
}
