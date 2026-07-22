// composables/useAgentChat.ts
//
// Agent Chat — nhiều đoạn hội thoại, LƯU vào Supabase (agent_conversations + agent_messages).
// State ở MODULE-LEVEL (shared) để sidebar (danh sách đoạn chat) và khung chat dùng chung.
//
// Luồng gửi: đảm bảo có conversation (tạo nếu chưa) -> lưu tin user -> gọi agent-bff
//   (sessionId = conversation.id) -> lưu tin agent. Lỗi (vd 429 giới hạn) chỉ hiển thị,
//   không lưu vào lịch sử.

import { getSupabase } from '~/lib/supabaseClient'
import { useAuth } from '~/composables/useAuth'
import { useConfig } from '~/composables/useConfig'

export interface ChatMessage {
  role: 'user' | 'agent'
  text: string
  timestamp: string
}
export interface Conversation {
  id: string
  title: string
  updatedAt: string
}

// ── Shared state (module-level) ──────────────────────────────────────────────
const conversations = ref<Conversation[]>([])
const currentId = ref<string | null>(null)
const messages = ref<ChatMessage[]>([])
const isLoading = ref(false)      // đang gửi tin
const isLoadingList = ref(false)  // đang tải danh sách/tin
const error = ref<string | null>(null)

export function useAgentChat() {
  const { currentUser } = useAuth()
  const { apiGatewayUrl } = useConfig()

  function uid() { return currentUser.value?.id ?? '' }

  async function loadConversations() {
    if (!uid()) return
    isLoadingList.value = true
    try {
      const { data, error: e } = await getSupabase()
        .from('agent_conversations')
        .select('id, title, updated_at')
        .order('updated_at', { ascending: false })
      if (e) throw e
      conversations.value = (data || []).map((r: any) => ({ id: r.id, title: r.title, updatedAt: r.updated_at }))
    } catch (e: any) { error.value = e?.message || useLocale().t('agentChat.loadConversationsFailed') }
    finally { isLoadingList.value = false }
  }

  async function selectConversation(id: string) {
    currentId.value = id
    error.value = null
    isLoadingList.value = true
    try {
      const { data, error: e } = await getSupabase()
        .from('agent_messages')
        .select('role, content, created_at')
        .eq('conversation_id', id)
        .order('created_at', { ascending: true })
      if (e) throw e
      messages.value = (data || []).map((r: any) => ({ role: r.role, text: r.content, timestamp: r.created_at }))
    } catch (e: any) { error.value = e?.message || useLocale().t('agentChat.loadMessagesFailed') }
    finally { isLoadingList.value = false }
  }

  // Bắt đầu đoạn chat mới (chưa ghi DB — tạo khi gửi tin đầu tiên).
  function newConversation() {
    currentId.value = null
    messages.value = []
    error.value = null
  }

  async function deleteConversation(id: string) {
    try {
      const { error: e } = await getSupabase().from('agent_conversations').delete().eq('id', id)
      if (e) throw e
      conversations.value = conversations.value.filter(c => c.id !== id)
      if (currentId.value === id) newConversation()
    } catch (e: any) { error.value = e?.message || useLocale().t('agentChat.deleteConversationFailed') }
  }

  async function _insertMessage(conversationId: string, role: 'user' | 'agent', content: string) {
    await getSupabase().from('agent_messages').insert({ conversation_id: conversationId, user_id: uid(), role, content })
  }

  async function _touchConversation(id: string) {
    // Bump updated_at để đưa hội thoại lên đầu danh sách (trigger set_updated_at cũng cập nhật).
    await getSupabase().from('agent_conversations').update({ updated_at: new Date().toISOString() }).eq('id', id)
    const idx = conversations.value.findIndex(c => c.id === id)
    if (idx > 0) { const [c] = conversations.value.splice(idx, 1); conversations.value.unshift(c) }
  }

  async function sendMessage(inputText: string): Promise<void> {
    const { t } = useLocale()
    const text = inputText.trim()
    if (!text || isLoading.value) return
    isLoading.value = true
    error.value = null

    // 1) Đảm bảo có conversation (tạo nếu là tin đầu). Nếu DB chưa sẵn (chưa chạy
    //    migration 00014) -> degrade: chạy IN-MEMORY, agent vẫn dùng được (không lưu).
    let convId = currentId.value
    if (!convId) {
      try {
        const title = text.slice(0, 60)
        const { data, error: e } = await getSupabase()
          .from('agent_conversations').insert({ user_id: uid(), title }).select('id, title, updated_at').single()
        if (e) throw e
        convId = (data as any).id
        currentId.value = convId
        conversations.value.unshift({ id: (data as any).id, title: (data as any).title, updatedAt: (data as any).updated_at })
      } catch (e: any) {
        console.warn('Chat persistence unavailable (đã chạy migration 00014?):', e?.message)
        // tiếp tục in-memory (convId = null -> không lưu lịch sử)
      }
    }

    // 2) Lưu (nếu có convId) + hiển thị tin user.
    messages.value.push({ role: 'user', text, timestamp: new Date().toISOString() })
    if (convId) _insertMessage(convId, 'user', text).catch(() => {})

    // 3) Gọi agent-bff.
    try {
      if (!apiGatewayUrl.value) throw new Error(t('agentChat.backendNotConfigured'))
      const { data: { session } } = await getSupabase().auth.getSession()
      if (!session?.access_token) throw new Error(t('agentChat.sessionExpired'))

      const response = await $fetch<{ responseText: string }>(`${apiGatewayUrl.value}/agent/chat`, {
        method: 'POST',
        body: { sessionId: convId || 'default', inputText: text },
        headers: { Authorization: `Bearer ${session.access_token}` },
      })

      const agentText = response.responseText || t('agentChat.noContent')
      messages.value.push({ role: 'agent', text: agentText, timestamp: new Date().toISOString() })
      if (convId) {
        _insertMessage(convId, 'agent', agentText).catch(() => {})
        _touchConversation(convId).catch(() => {})
      }
    } catch (e: any) {
      const status = e?.statusCode ?? e?.response?.status
      const backendMsg = e?.data?.message
      let text2: string
      if (status === 429) text2 = backendMsg || t('agentChat.overloadedFallback')
      else if (backendMsg) text2 = backendMsg
      else text2 = t('agentChat.genericErrorFallback')
      error.value = backendMsg || e?.message || 'Agent communication failed'
      // Hiển thị lỗi (không lưu DB để không làm bẩn lịch sử).
      messages.value.push({ role: 'agent', text: text2, timestamp: new Date().toISOString() })
    } finally {
      isLoading.value = false
    }
  }

  return {
    conversations, currentId, messages, isLoading, isLoadingList, error,
    loadConversations, selectConversation, newConversation, deleteConversation, sendMessage,
  }
}
