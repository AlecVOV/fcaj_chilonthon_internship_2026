// composables/useNotes.ts — one personal Markdown notes doc per user (public.user_notes).
import { getSupabase } from '~/lib/supabaseClient'
import { useAuth } from '~/composables/useAuth'

export function useNotes() {
  const { currentUser } = useAuth()

  async function loadNote(): Promise<{ content: string; updatedAt: string | null }> {
    const uid = currentUser.value?.id
    if (!uid) return { content: '', updatedAt: null }
    const sb = getSupabase()
    const { data, error } = await sb.from('user_notes').select('content, updated_at').eq('user_id', uid).maybeSingle()
    if (error) throw new Error(`Cannot load notes: ${error.message}`)
    return { content: data?.content ?? '', updatedAt: data?.updated_at ?? null }
  }

  async function saveNote(content: string): Promise<string> {
    const uid = currentUser.value?.id
    if (!uid) throw new Error('Not signed in.')
    const sb = getSupabase()
    const { data, error } = await sb
      .from('user_notes')
      .upsert({ user_id: uid, content }, { onConflict: 'user_id' })
      .select('updated_at')
      .single()
    if (error) throw new Error(`Cannot save notes: ${error.message}`)
    return data.updated_at
  }

  return { loadNote, saveNote }
}
