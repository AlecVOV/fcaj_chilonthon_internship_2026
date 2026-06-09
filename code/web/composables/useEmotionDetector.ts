// composables/useEmotionDetector.ts
export function useEmotionDetector() {
  const detecting = ref(false)
  const result = ref<{ label: string; confidence: number } | null>(null)
  const error = ref<string | null>(null)

  async function detect(text: string) {
    if (!text.trim()) return
    detecting.value = true; error.value = null
    try {
      const config = useRuntimeConfig()
      const apiUrl = config.public.apiGatewayUrl as string
      if (apiUrl) {
        const response = await $fetch<{ label: string; confidence: number }>(
          `${apiUrl}/emotion`, { method: 'POST', body: { text } },
        )
        result.value = response
      } else {
        const lc = text.toLowerCase()
        if (/focus|productive|clear|calm|flow/.test(lc)) result.value = { label: 'focused', confidence: 0.85 }
        else if (/stress|overwhelm|anxiety|burn|exhaust/.test(lc)) result.value = { label: 'stressed', confidence: 0.78 }
        else if (/tired|exhaust|fatigue|sleep/.test(lc)) result.value = { label: 'exhausted', confidence: 0.72 }
        else if (/relax|peace|easy|breeze/.test(lc)) result.value = { label: 'relaxed', confidence: 0.75 }
        else result.value = { label: 'focused', confidence: 0.55 }
      }
    } catch (e: any) { error.value = e?.message || 'Detection failed' }
    finally { detecting.value = false }
  }

  return { detect, detecting, result, error }
}
