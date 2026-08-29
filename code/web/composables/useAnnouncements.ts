// composables/useAnnouncements.ts
//
// Feature announcements: admin posts via /admin/announcements, every signed-in
// user reads them via the bell icon in the header. "Seen" state is client-side
// only (localStorage) — no per-device sync needed for this feature.

import { getSupabase } from '~/lib/supabaseClient'
import { useAuth } from '~/composables/useAuth'

export interface Announcement {
  id: string
  title: string
  message: string
  createdAt: string
}

const SEEN_KEY = 'focus_seen_announcements'

function getSeenIds(): string[] {
  if (import.meta.server) return []
  try { return JSON.parse(localStorage.getItem(SEEN_KEY) || '[]') } catch { return [] }
}
function setSeenIds(ids: string[]) {
  if (import.meta.server) return
  try { localStorage.setItem(SEEN_KEY, JSON.stringify(ids)) } catch { /* ignore */ }
}

export function useAnnouncements() {
  const { currentUser } = useAuth()

  async function listAnnouncements(): Promise<Announcement[]> {
    const sb = getSupabase()
    const { data, error } = await sb
      .from('announcements')
      .select('id, title, message, created_at')
      .order('created_at', { ascending: false })
      .limit(20)
    if (error) throw new Error(`Cannot load announcements: ${error.message}`)
    return (data || []).map((r: any) => ({ id: r.id, title: r.title, message: r.message, createdAt: r.created_at }))
  }

  async function createAnnouncement(title: string, message: string): Promise<void> {
    const sb = getSupabase()
    const { error } = await sb.from('announcements').insert({
      title: title.trim(), message: message.trim(), created_by: currentUser.value?.id,
    })
    if (error) throw new Error(`Cannot create announcement: ${error.message}`)
  }

  async function deleteAnnouncement(id: string): Promise<void> {
    const sb = getSupabase()
    const { error } = await sb.from('announcements').delete().eq('id', id)
    if (error) throw new Error(`Cannot delete announcement: ${error.message}`)
  }

  function isSeen(id: string): boolean { return getSeenIds().includes(id) }
  function markSeen(ids: string[]) {
    const seen = new Set(getSeenIds())
    ids.forEach(id => seen.add(id))
    setSeenIds([...seen])
  }

  return { listAnnouncements, createAnnouncement, deleteAnnouncement, isSeen, markSeen }
}
