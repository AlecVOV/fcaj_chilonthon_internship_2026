// composables/useAuth.ts
//
// Cloud-only auth — Supabase Auth + public.users (role + approval status).
//   - Sign up:   supabase.auth.signUp (user sets their own password)
//   - Login:     supabase.auth.signInWithPassword, then gate on public.users.status
//                (pending / rejected users are blocked; admins always allowed)
//   - Role:      public.users.role  (admin = role 'admin' in the DB — matches RLS is_admin())
//   - Approval:  approveUser / rejectUser update public.users.status (admin only, via RLS)
//
// Session is persisted both by the Supabase SDK and a lightweight localStorage
// snapshot (focus_auth_user) so the UI restores instantly on reload.

import { ref, computed } from 'vue'
import { getSupabase } from '~/lib/supabaseClient'

export interface AuthUser {
  id: string
  email: string
  role: 'admin' | 'user'
  name: string
  status: 'pending' | 'approved' | 'rejected'
}

export interface PendingUser {
  id: string
  email: string
  name: string
  status: 'pending' | 'approved' | 'rejected'
  requestedAt: string
  approvedAt?: string
}

// ── Shared state ────────────────────────────────────────────────────────────
const currentUser = ref<AuthUser | null>(null)
const isLoading = ref(false)
const authError = ref<string | null>(null)

// ── Helpers ─────────────────────────────────────────────────────────────────
function persistSession() {
  if (!import.meta.server) localStorage.setItem('focus_auth_user', JSON.stringify(currentUser.value))
}
function restoreSession() {
  if (import.meta.server) return
  try { const s = localStorage.getItem('focus_auth_user'); if (s) currentUser.value = JSON.parse(s) } catch { /* ignore */ }
}

// ── Composable ──────────────────────────────────────────────────────────────
export function useAuth() {
  if (!import.meta.server && !currentUser.value) restoreSession()

  const isAuthenticated = computed(() => currentUser.value !== null)
  const isAdmin = computed(() => currentUser.value?.role === 'admin')

  async function signUp(name: string, email: string, password?: string) {
    const key = email.toLowerCase()
    if (key === 'admin@focusmode.app' || key === 'user@focusmode.app') {
      throw new Error('This is a demo account. Please use Sign In with the pre-set password.')
    }
    const sb = getSupabase()
    const { data, error } = await sb.auth.signUp({
      email,
      password: password || '',
      options: { data: { display_name: name } },
    })
    if (error) throw error
    // public.users row is created by the DB trigger (status='pending').
    return data
  }

  async function login(email: string, password: string): Promise<AuthUser> {
    isLoading.value = true
    authError.value = null
    try {
      const sb = getSupabase()
      const { data, error } = await sb.auth.signInWithPassword({ email, password })
      if (error) throw error
      if (!data.user) throw new Error('Login failed')

      const { data: profile } = await sb
        .from('users')
        .select('role, status, display_name')
        .eq('id', data.user.id)
        .single()

      const admin = profile?.role === 'admin'
      const status = (profile?.status as AuthUser['status']) || 'pending'

      // Approval gate — admins always allowed; everyone else must be approved.
      if (!admin) {
        if (status === 'pending') { await sb.auth.signOut(); throw new Error('Your account is pending admin approval.') }
        if (status === 'rejected') { await sb.auth.signOut(); throw new Error('Your account request was rejected.') }
      }

      const u: AuthUser = {
        id: data.user.id,
        email: data.user.email!,
        role: admin ? 'admin' : 'user',
        name: (profile?.display_name as string)
          || (data.user.user_metadata?.display_name as string)
          || data.user.email!.split('@')[0],
        status: admin ? 'approved' : status,
      }
      currentUser.value = u
      persistSession()
      return u
    } catch (e: any) {
      authError.value = e?.message || 'Login failed'
      throw e
    } finally {
      isLoading.value = false
    }
  }

  async function logout() {
    const sb = getSupabase()
    await sb.auth.signOut()
    currentUser.value = null
    if (!import.meta.server) localStorage.removeItem('focus_auth_user')
    navigateTo('/login')
  }

  async function changePassword(newPassword: string, currentPassword?: string) {
    const sb = getSupabase()
    // Re-authenticate to verify the CURRENT password before changing it.
    if (currentPassword && currentUser.value?.email) {
      const { error: verifyErr } = await sb.auth.signInWithPassword({
        email: currentUser.value.email,
        password: currentPassword,
      })
      if (verifyErr) throw new Error('Mật khẩu hiện tại không đúng.')
    }
    const { error } = await sb.auth.updateUser({ password: newPassword })
    if (error) throw error
  }

  // Update display name and/or email. Email is the LOGIN identity (auth.users.email),
  // so changing it changes the sign-in address; we also keep the public.users mirror
  // in sync. Supabase may require confirming the new email — returns emailPending in
  // that case (the change only applies after the user confirms via the new address).
  async function updateAccount(updates: { name?: string; email?: string }): Promise<{ emailPending: boolean }> {
    const sb = getSupabase()
    const uid = currentUser.value?.id
    const currentEmail = (currentUser.value?.email || '').toLowerCase()
    if (!uid) throw new Error('Chưa đăng nhập.')

    // 1) Email → change immediately via the change_my_email RPC (migration 00012).
    //    Avoids the client updateUser({email}) flow that some projects hold pending
    //    for email confirmation. RPC applies the change + confirms it right away.
    const newEmail = (updates.email || '').toLowerCase()
    const emailChanged = !!newEmail && newEmail !== currentEmail
    if (emailChanged) {
      const { error } = await sb.rpc('change_my_email', { new_email: newEmail })
      if (error) throw new Error(error.message)
      try { await sb.auth.refreshSession() } catch { /* refresh token best-effort */ }
    }

    // 2) Name → public.users.display_name (RLS allows updating own row).
    if (updates.name !== undefined) {
      const { error: dbErr } = await sb.from('users').update({ display_name: updates.name }).eq('id', uid)
      if (dbErr) throw dbErr
    }

    // 3) Refresh the local snapshot.
    if (currentUser.value) {
      currentUser.value = {
        ...currentUser.value,
        ...(updates.name !== undefined ? { name: updates.name } : {}),
        ...(emailChanged ? { email: newEmail } : {}),
      }
      persistSession()
    }
    return { emailPending: false }
  }

  // Re-fetch the account row from public.users and refresh the local snapshot.
  // Use this before generating anything derived from the user's identity (e.g.
  // the worklog report) so a stale in-memory/localStorage copy (leftover from
  // another tab, or from before an email change) never leaks into the output.
  async function refreshCurrentUser(): Promise<void> {
    const uid = currentUser.value?.id
    if (!uid) return
    const sb = getSupabase()
    const { data: profile, error } = await sb
      .from('users')
      .select('email, display_name, role, status')
      .eq('id', uid)
      .single()
    if (error || !profile || !currentUser.value) return
    currentUser.value = {
      ...currentUser.value,
      email: (profile.email as string) || currentUser.value.email,
      name: (profile.display_name as string) || currentUser.value.name,
      role: profile.role === 'admin' ? 'admin' : 'user',
      status: (profile.status as AuthUser['status']) || currentUser.value.status,
    }
    persistSession()
  }

  function forgotPassword(_email: string): string {
    // redirectTo PHẢI nằm trong allowlist "Redirect URLs" của Supabase Auth (Dashboard),
    // nếu không Supabase âm thầm fallback về "Site URL" (mặc định localhost:3000 -> link
    // chết trên production). appUrl lấy từ NUXT_PUBLIC_APP_URL (build-time, xem .env.example).
    const config = useRuntimeConfig()
    const redirectTo = `${config.public.appUrl}/reset-password`
    getSupabase().auth.resetPasswordForEmail(_email, { redirectTo })
    return 'If an account exists, a password reset link has been sent to your email.'
  }

  // ── Admin user-management (Supabase-backed; gated by RLS is_admin()) ───────
  async function getPendingUsers(): Promise<PendingUser[]> {
    const sb = getSupabase()
    const { data, error } = await sb
      .from('users')
      .select('id, email, display_name, status, created_at')
      .eq('status', 'pending')
      .order('created_at', { ascending: false })
    if (error) throw new Error(`Cannot load pending users: ${error.message}`)
    return (data || []).map(u => ({
      id: u.id,
      email: u.email,
      name: (u.display_name as string) || u.email.split('@')[0],
      status: u.status as PendingUser['status'],
      requestedAt: u.created_at,
    }))
  }

  async function approveUser(userId: string): Promise<void> {
    const sb = getSupabase()
    const { error } = await sb.from('users').update({ status: 'approved' }).eq('id', userId)
    if (error) throw error
  }

  async function rejectUser(userId: string): Promise<void> {
    const sb = getSupabase()
    const { error } = await sb.from('users').update({ status: 'rejected' }).eq('id', userId)
    if (error) throw error
  }

  async function getRejectedUsers(): Promise<PendingUser[]> {
    const sb = getSupabase()
    const { data, error } = await sb
      .from('users')
      .select('id, email, display_name, status, created_at')
      .eq('status', 'rejected')
      .order('created_at', { ascending: false })
    if (error) throw new Error(`Cannot load rejected users: ${error.message}`)
    return (data || []).map(u => ({
      id: u.id, email: u.email,
      name: (u.display_name as string) || u.email.split('@')[0],
      status: u.status as PendingUser['status'], requestedAt: u.created_at,
    }))
  }

  async function setUserStatus(userId: string, status: AuthUser['status']): Promise<void> {
    const sb = getSupabase()
    const { error } = await sb.from('users').update({ status }).eq('id', userId)
    if (error) throw error
  }

  // Re-validate the cached session against Supabase on app start: role/status may
  // have changed (demote / reject / revoke) or the token may have expired, so a
  // stale localStorage snapshot shouldn't keep granting access.
  async function syncSession(): Promise<void> {
    if (import.meta.server) return
    const sb = getSupabase()
    const { data: { session } } = await sb.auth.getSession()
    if (!session?.user) {
      if (currentUser.value) { currentUser.value = null; localStorage.removeItem('focus_auth_user'); navigateTo('/login') }
      return
    }
    const { data: profile } = await sb
      .from('users').select('role, status, display_name').eq('id', session.user.id).single()
    const admin = profile?.role === 'admin'
    const status = (profile?.status as AuthUser['status']) || 'pending'
    if (!admin && status !== 'approved') {
      await sb.auth.signOut()
      currentUser.value = null
      localStorage.removeItem('focus_auth_user')
      navigateTo('/login')
      return
    }
    currentUser.value = {
      id: session.user.id, email: session.user.email!,
      role: admin ? 'admin' : 'user',
      name: (profile?.display_name as string) || session.user.email!.split('@')[0],
      status: admin ? 'approved' : status,
    }
    persistSession()
  }

  return {
    currentUser, isAuthenticated, isAdmin, isLoading, authError,
    signUp, login, logout, changePassword, updateAccount, refreshCurrentUser, forgotPassword,
    approveUser, rejectUser, getPendingUsers, getRejectedUsers, setUserStatus, syncSession,
  }
}
