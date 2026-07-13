// composables/useRAG.ts
import { getSupabase } from '~/lib/supabaseClient'
import { useConfig } from '~/composables/useConfig'

export function useRAG() {
  async function getRecommendations(emotionLabel: string) {
    try {
      const { ragApiUrl } = useConfig()
      const apiUrl = ragApiUrl.value
      if (apiUrl) {
        const { data: { session } } = await getSupabase().auth.getSession()
        if (!session?.access_token) throw new Error('Phiên đăng nhập đã hết hạn — đăng nhập lại.')
        const response = await $fetch<any[]>(`${apiUrl}/rag`, {
          method: 'POST', body: { emotion: emotionLabel, limit: 3 },
          headers: { Authorization: `Bearer ${session.access_token}` },
        })
        return response
      }
    } catch {}
    return [
      { id: '1', title: 'On Patience', source: 'Lamrim Class 2023', type: 'sutra' },
      { id: '2', title: '5-Minute Breathing', source: 'Self-Help Library', type: 'video' },
    ]
  }
  return { getRecommendations }
}
