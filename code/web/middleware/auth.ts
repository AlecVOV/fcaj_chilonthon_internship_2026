// middleware/auth.ts
// Global auth guard — redirects to /login if not authenticated.
// Admin users go straight to /admin after login.

import { useAuth } from '~/composables/useAuth'

export default defineNuxtRouteMiddleware((to) => {
  const { isAuthenticated, isAdmin } = useAuth()

  if (to.path === '/login') return

  if (!isAuthenticated.value) {
    return navigateTo(`/login?redirect=${encodeURIComponent(to.fullPath)}`)
  }

  // Admin users: redirect user-only routes to admin panel
  if (isAdmin.value && to.path === '/') {
    return navigateTo('/admin')
  }

  // Non-admin users: redirect admin routes to dashboard
  if (!isAdmin.value && to.path.startsWith('/admin')) {
    return navigateTo('/')
  }
})
