// composables/useFeedback.ts
//
// Feedback: user gửi phản hồi ngay trong Profile (submitFeedback), Admin đọc
// + đổi trạng thái qua CMS /admin/feedback (listFeedback / updateFeedbackStatus).
// RLS (migration 00017) tự giới hạn: user chỉ insert/select được dòng của
// mình; admin (is_admin()) select/update được tất cả.

import { getSupabase } from '~/lib/supabaseClient'
import { useAuth } from '~/composables/useAuth'

export type FeedbackStatus = 'new' | 'read' | 'resolved'

export interface FeedbackItem {
  id: string
  userId: string
  userEmail: string
  userName: string
  message: string
  status: FeedbackStatus
  createdAt: string
}

export function useFeedback() {
  const { currentUser } = useAuth()
  const isSubmitting = ref(false)
  const submitError = ref<string | null>(null)
  const submitSuccess = ref(false)

  async function submitFeedback(message: string): Promise<void> {
    const { t } = useLocale()
    const text = message.trim()
    if (!text || isSubmitting.value) return
    isSubmitting.value = true
    submitError.value = null
    submitSuccess.value = false
    try {
      const uid = currentUser.value?.id
      if (!uid) throw new Error(t('profile.notLoggedIn'))
      const { error } = await getSupabase().from('feedback').insert({ user_id: uid, message: text })
      if (error) throw error
      submitSuccess.value = true
    } catch (e: any) {
      submitError.value = e?.message || t('profile.feedbackFailedFallback')
    } finally {
      isSubmitting.value = false
    }
  }

  // ── Admin CMS (gated bởi RLS is_admin() — user thường gọi chỉ thấy dòng của họ) ──
  async function listFeedback(): Promise<FeedbackItem[]> {
    const sb = getSupabase()
    const { data, error } = await sb
      .from('feedback')
      .select('id, user_id, message, status, created_at')
      .order('created_at', { ascending: false })
    if (error) throw new Error(`Cannot load feedback: ${error.message}`)
    const rows = data || []
    const userIds = [...new Set(rows.map((r: any) => r.user_id))]
    let usersById: Record<string, { email: string; name: string }> = {}
    if (userIds.length) {
      const { data: users } = await sb.from('users').select('id, email, display_name').in('id', userIds)
      usersById = Object.fromEntries((users || []).map((u: any) => [u.id, { email: u.email, name: (u.display_name as string) || u.email.split('@')[0] }]))
    }
    return rows.map((r: any) => ({
      id: r.id,
      userId: r.user_id,
      userEmail: usersById[r.user_id]?.email || 'unknown',
      userName: usersById[r.user_id]?.name || 'Unknown user',
      message: r.message,
      status: r.status as FeedbackStatus,
      createdAt: r.created_at,
    }))
  }

  async function updateFeedbackStatus(id: string, status: FeedbackStatus): Promise<void> {
    const { error } = await getSupabase().from('feedback').update({ status }).eq('id', id)
    if (error) throw new Error(`Cannot update feedback: ${error.message}`)
  }

  return { isSubmitting, submitError, submitSuccess, submitFeedback, listFeedback, updateFeedbackStatus }
}
