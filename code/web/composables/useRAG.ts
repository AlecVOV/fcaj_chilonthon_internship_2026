// composables/useRAG.ts
export function useRAG() {
  async function getRecommendations(emotionLabel: string) {
    try {
      const config = useRuntimeConfig()
      // Biến RIÊNG (rỗng cho tới khi deploy rag-recommender) — tránh gọi /rag không tồn tại.
      const apiUrl = config.public.ragApiUrl as string
      if (apiUrl) {
        const response = await $fetch<any[]>(`${apiUrl}/rag`, {
          method: 'POST', body: { emotion: emotionLabel, limit: 3 },
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
