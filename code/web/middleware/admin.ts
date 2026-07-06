// middleware/admin.ts
//
// Admin route guard — only users with role === 'admin' can access /admin/*.
// Uses the abstracted useAuth() composable.
//
// TODO: When migrating to cloud, Supabase RLS will also protect admin routes
//       at the database level. This middleware is the first line of defense.

import { useAuth } from '~/composables/useAuth'

export default defineNuxtRouteMiddleware((to) => {
  const { isAuthenticated, isAdmin } = useAuth()

  if (!isAuthenticated.value) {
    return navigateTo(`/login?redirect=${encodeURIComponent(to.fullPath)}`)
  }

  if (!isAdmin.value) {
    // Non-admin users trying to access admin routes → redirect to dashboard
    return navigateTo('/dashboard')
  }
})
