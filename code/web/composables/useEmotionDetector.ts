// composables/useEmotionDetector.ts
import { getSupabase } from '~/lib/supabaseClient'
import { useConfig } from '~/composables/useConfig'

export function useEmotionDetector() {
  const detecting = ref(false)
  const result = ref<{ label: string; confidence: number } | null>(null)
  const error = ref<string | null>(null)

  async function detect(text: string) {
    if (!text.trim()) return
    detecting.value = true; error.value = null
    try {
      const { emotionApiUrl } = useConfig()
      const apiUrl = emotionApiUrl.value
      if (apiUrl) {
        const { data: { session } } = await getSupabase().auth.getSession()
        if (!session?.access_token) throw new Error('Phiên đăng nhập đã hết hạn — đăng nhập lại.')
        const response = await $fetch<{ label: string; confidence: number }>(
          `${apiUrl}/emotion`,
          { method: 'POST', body: { text }, headers: { Authorization: `Bearer ${session.access_token}` } },
        )
        result.value = response
      } else {
        // Fallback keyword-regex thuần client khi chưa deploy Lambda (không phải AI).
        const lc = text.toLowerCase()
        if (/focus|productive|clear|calm|flow/.test(lc)) result.value = { label: 'focused', confidence: 0.85 }
        else if (/stress|overwhelm|anxiety|burn|pressure/.test(lc)) result.value = { label: 'stressed', confidence: 0.78 }
        else if (/tired|exhaust|fatigue|drained|sleep/.test(lc)) result.value = { label: 'exhausted', confidence: 0.72 }
        else if (/relax|peace|easy|breeze|calm/.test(lc)) result.value = { label: 'relaxed', confidence: 0.75 }
        else if (/unmotivated|procrastinat|can't start|lazy|no drive/.test(lc)) result.value = { label: 'unmotivated', confidence: 0.6 }
        else result.value = { label: 'focused', confidence: 0.55 }
      }
    } catch (e: any) { error.value = e?.message || 'Detection failed' }
    finally { detecting.value = false }
  }

  return { detect, detecting, result, error }
}
