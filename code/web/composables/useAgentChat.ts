// composables/useAgentChat.ts
//
// Agent Chat composable — communicates with Bedrock Task Manager Agent
// via API Gateway → Lambda BFF → Bedrock InvokeAgent.
//
// Flow:
//   User types task request → POST /agent/chat { sessionId, inputText }
//     → Lambda BFF calls Bedrock InvokeAgent
//     → Agent evaluates task detail
//       ├── Fully detailed → Agent writes to Supabase via Action Group
//       └── Missing details → Agent returns follow-up questions
//     → Lambda BFF returns response to frontend
//     → Frontend displays: "Task created" or follow-up questions

import { useAuth } from '~/composables/useAuth'
import { useConfig } from '~/composables/useConfig'

export interface ChatMessage {
  role: 'user' | 'agent'
  text: string
  timestamp: string
  tasks?: { id: string; title: string; status: string }[]
}

export function useAgentChat() {
  const { currentUser } = useAuth()
  const { apiGatewayUrl } = useConfig()

  const messages = ref<ChatMessage[]>([])
  const isLoading = ref(false)
  const sessionId = ref<string>('')
  const error = ref<string | null>(null)

  // Generate a stable session ID per user
  function ensureSessionId() {
    if (!sessionId.value) {
      sessionId.value = `session-${currentUser.value?.id ?? 'anon'}-${Date.now()}`
    }
  }

  // ── Send message to Bedrock Agent ──────────────────────────────────────
  async function sendMessage(inputText: string): Promise<void> {
    if (!inputText.trim()) return

    ensureSessionId()
    isLoading.value = true
    error.value = null

    // Add user message
    messages.value.push({
      role: 'user',
      text: inputText,
      timestamp: new Date().toISOString(),
    })

    try {
      if (!apiGatewayUrl.value) {
        throw new Error('AI agent backend is not configured (API Gateway URL missing).')
      }
      // Call the real Bedrock Agent via API Gateway.
      const response = await $fetch<{
        responseText: string
        tasks?: { id: string; title: string; status: string }[]
        followUpQuestions?: string[]
        actionTaken?: string
      }>(`${apiGatewayUrl.value}/agent/chat`, {
        method: 'POST',
        body: {
          sessionId: sessionId.value,
          userId: currentUser.value?.id,
          inputText,
        },
        headers: {
          Authorization: `Bearer ${currentUser.value?.id}`, // JWT from auth
        },
      })

      const agentText = response.followUpQuestions?.length
        ? response.responseText + '\n\n' + response.followUpQuestions.map((q, i) => `${i + 1}. ${q}`).join('\n')
        : response.responseText

      messages.value.push({
        role: 'agent',
        text: agentText,
        timestamp: new Date().toISOString(),
        tasks: response.tasks,
      })
    } catch (e: any) {
      error.value = e?.message || 'Agent communication failed'
      messages.value.push({
        role: 'agent',
        text: 'Sorry, I encountered an error. Please try again.',
        timestamp: new Date().toISOString(),
      })
    } finally {
      isLoading.value = false
    }
  }

  // ── Clear chat history ─────────────────────────────────────────────────
  function clearChat() {
    messages.value = []
    sessionId.value = ''
    error.value = null
  }

  return {
    messages,
    isLoading,
    sessionId,
    error,
    sendMessage,
    clearChat,
  }
}
