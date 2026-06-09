// stores/user.store.ts
// DEPRECATED — use composables/useAuth.ts instead.
// Kept as a thin wrapper for backward compatibility during migration.

import { defineStore } from 'pinia'
import { useAuth } from '~/composables/useAuth'

export const useUserStore = defineStore('user', () => {
  const auth = useAuth()

  const user = computed(() => auth.currentUser.value ? {
    id: auth.currentUser.value.id,
    email: auth.currentUser.value.email,
    app_metadata: { role: auth.currentUser.value.role },
    user_metadata: {},
    aud: 'authenticated',
    created_at: new Date().toISOString(),
  } : null)

  const session = computed(() => auth.currentUser.value ? {
    access_token: 'mock-token',
    user: user.value,
  } : null)

  const isLoading = ref(false)
  const isAuthenticated = computed(() => auth.isAuthenticated.value)
  const isAdmin = computed(() => auth.isAdmin.value)
  const userId = computed(() => auth.currentUser.value?.id ?? '')

  function initialize() { /* auth auto-restores from localStorage */ }
  function signIn(email: string, password: string) { auth.login(email, password) }
  function signUp(email: string, password: string) { auth.signUp(email, password) }
  function signOut() { auth.logout(); navigateTo('/login') }

  return { user, session, isLoading, isAuthenticated, isAdmin, userId, initialize, signIn, signUp, signOut }
})
