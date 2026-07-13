// composables/useDataService.ts
//
// Cloud-only data service — all reads/writes go to Supabase.
//   tasks          → public.tasks            (read; writes live in stores/task.store)
//   focus_sessions → public.focus_sessions
//   media_library  → public.media_library
//   users          → public.users            (admin management)
//
// Embeddings require the AI backend (API Gateway); without it, generate* throws.

import { useAuth } from '~/composables/useAuth'
import { useConfig } from '~/composables/useConfig'
import { getSupabase } from '~/lib/supabaseClient'

// ── Types ─────────────────────────────────────────────────────────────────
export interface Task {
  id: string; userId: string; title: string; description?: string
  status: 'pending' | 'in_progress' | 'completed' | 'cancelled'
  priority: number; durationSpent: number; dueDate?: string; review?: string
  completedAt?: string  // set once when completed; stable for daily mapping
  createdAt: string; updatedAt: string; isSynced: boolean
}

export interface FocusSession {
  id: string; userId: string; taskId?: string
  startTime: string; endTime?: string
  durationPlanned: number; durationActual?: number
  journalText?: string; emotionLabel?: string; emotionConfidence?: number
  ambientTrack?: string; createdAt: string; updatedAt: string; isSynced: boolean
}

// Mirrors the DB CHECK on media_library.type (00001_initial_schema.sql).
export type MediaType = 'quote' | 'sutra' | 'video' | 'article' | 'audio'

export interface MediaItem {
  id: string; title: string; media_type: MediaType
  content_text?: string; content_url?: string; source?: string
  tags: string[]; has_embedding: boolean; created_at: string
}

export interface AdminUser {
  id: string; name: string; email: string; role: 'admin' | 'user'
  status: 'pending' | 'approved' | 'rejected'
  totalFocusTime: number; sessionsCount: number; created_at: string
}

// ── Supabase row ↔ app object mapping (snake_case ↔ camelCase) ────────────
function rowToTask(r: any): Task {
  return {
    id: r.id, userId: r.user_id, title: r.title, description: r.description ?? undefined,
    status: r.status, priority: r.priority ?? 0, durationSpent: r.duration_spent ?? 0,
    dueDate: r.due_date ?? undefined, review: r.review ?? undefined,
    completedAt: r.completed_at ?? undefined,
    createdAt: r.created_at, updatedAt: r.updated_at, isSynced: true,
  }
}

function rowToSession(r: any): FocusSession {
  return {
    id: r.id, userId: r.user_id, taskId: r.task_id ?? undefined,
    startTime: r.start_time, endTime: r.end_time ?? undefined,
    durationPlanned: r.duration_planned ?? 0, durationActual: r.duration_actual ?? undefined,
    journalText: r.journal_text ?? undefined, emotionLabel: r.emotion_label ?? undefined,
    emotionConfidence: r.emotion_confidence ?? undefined, ambientTrack: r.ambient_track ?? undefined,
    createdAt: r.created_at, updatedAt: r.updated_at, isSynced: true,
  }
}

const ALLOWED_EMOTIONS = ['focused', 'stressed', 'exhausted', 'relaxed', 'unmotivated']
function sessionToRow(s: Partial<FocusSession>): Record<string, unknown> {
  const row: Record<string, unknown> = {}
  if (s.id !== undefined) row.id = s.id
  if (s.userId !== undefined) row.user_id = s.userId
  row.task_id = s.taskId ? s.taskId : null
  if (s.startTime !== undefined) row.start_time = s.startTime
  if (s.endTime !== undefined) row.end_time = s.endTime ?? null
  if (s.durationPlanned !== undefined) row.duration_planned = s.durationPlanned
  if (s.durationActual !== undefined) row.duration_actual = s.durationActual ?? null
  row.journal_text = s.journalText ? s.journalText.slice(0, 1000) : null
  row.emotion_label = s.emotionLabel && ALLOWED_EMOTIONS.includes(s.emotionLabel) ? s.emotionLabel : null
  if (s.emotionConfidence !== undefined) row.emotion_confidence = s.emotionConfidence ?? null
  row.ambient_track = s.ambientTrack ? s.ambientTrack : null
  return row
}

function rowToMedia(r: any): MediaItem {
  return {
    id: r.id, title: r.title, media_type: r.type,
    content_text: r.content_text ?? undefined, content_url: r.content_url ?? undefined,
    source: r.source ?? undefined, tags: r.tags ?? [],
    has_embedding: r.embedding_vector != null, created_at: r.created_at,
  }
}

// ── Composable ────────────────────────────────────────────────────────────
export function useDataService() {
  const { currentUser, isAdmin } = useAuth()
  const { apiGatewayUrl } = useConfig()

  function uid() { return currentUser.value?.id ?? '' }

  // Gửi kèm access_token cho các route Lambda tự xác thực in-Lambda (không dùng
  // JWT authorizer — xem aws/README.md). Dùng cho /embed, /embed-all (admin-only).
  async function authHeaders(): Promise<Record<string, string>> {
    const sb = getSupabase()
    const { data: { session } } = await sb.auth.getSession()
    return session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {}
  }

  // ── Tasks (read-only here; CRUD lives in stores/task.store) ──────────────
  async function getTasks(): Promise<Task[]> {
    const sb = getSupabase()
    let q = sb.from('tasks').select('*').order('created_at', { ascending: false })
    if (!isAdmin.value) q = q.eq('user_id', uid())
    const { data, error } = await q
    if (error) throw new Error(`Cannot load tasks: ${error.message}`)
    return (data || []).map(rowToTask)
  }

  // ── Focus sessions ───────────────────────────────────────────────────────
  async function getSessions(): Promise<FocusSession[]> {
    const sb = getSupabase()
    let q = sb.from('focus_sessions').select('*').order('start_time', { ascending: false })
    if (!isAdmin.value) q = q.eq('user_id', uid())
    const { data, error } = await q
    if (error) throw new Error(`Cannot load sessions: ${error.message}`)
    return (data || []).map(rowToSession)
  }
  async function createSession(s: Omit<FocusSession, 'id' | 'createdAt' | 'updatedAt' | 'isSynced'>): Promise<FocusSession> {
    const sb = getSupabase()
    const { data, error } = await sb.from('focus_sessions').insert(sessionToRow({ ...s, userId: uid() })).select().single()
    if (error) throw error
    return rowToSession(data)
  }

  // ── Media library ────────────────────────────────────────────────────────
  async function getMedia(): Promise<MediaItem[]> {
    const sb = getSupabase()
    const { data, error } = await sb.from('media_library').select('*').order('created_at', { ascending: false })
    if (error) throw new Error(`Cannot load media: ${error.message}`)
    return (data || []).map(rowToMedia)
  }
  async function createMedia(item: Omit<MediaItem, 'id' | 'created_at' | 'has_embedding'>): Promise<void> {
    const sb = getSupabase()
    const { error } = await sb.from('media_library').insert({
      title: item.title, type: item.media_type,
      content_text: item.content_text ?? null, content_url: item.content_url ?? null,
      source: item.source ?? null, tags: item.tags ?? [], created_by: uid(),
    })
    if (error) throw error
  }
  async function updateMedia(id: string, changes: Partial<MediaItem>): Promise<void> {
    const sb = getSupabase()
    const row: Record<string, unknown> = {}
    if (changes.title !== undefined) row.title = changes.title
    if (changes.media_type !== undefined) row.type = changes.media_type
    if (changes.content_text !== undefined) row.content_text = changes.content_text ?? null
    if (changes.content_url !== undefined) row.content_url = changes.content_url ?? null
    if (changes.source !== undefined) row.source = changes.source ?? null
    if (changes.tags !== undefined) row.tags = changes.tags
    const { error } = await sb.from('media_library').update(row).eq('id', id)
    if (error) throw error
  }
  async function deleteMedia(mediaId: string): Promise<void> {
    const sb = getSupabase()
    const { error } = await sb.from('media_library').delete().eq('id', mediaId)
    if (error) throw error
  }
  async function generateEmbedding(mediaId: string): Promise<void> {
    if (!apiGatewayUrl.value) throw new Error('Embedding generation requires the AI backend (API Gateway not configured).')
    await $fetch(`${apiGatewayUrl.value}/embed`, { method: 'POST', body: { mediaId }, headers: await authHeaders() })
  }
  async function generateAllEmbeddings(): Promise<number> {
    if (!apiGatewayUrl.value) throw new Error('Embedding generation requires the AI backend (API Gateway not configured).')
    const res = await $fetch<{ count: number }>(`${apiGatewayUrl.value}/embed-all`, { method: 'POST', headers: await authHeaders() })
    return res?.count ?? 0
  }

  // ── Admin users ──────────────────────────────────────────────────────────
  async function getUsers(): Promise<AdminUser[]> {
    const sb = getSupabase()
    const { data, error } = await sb
      .from('users')
      .select('id, email, display_name, role, status, created_at')
      .eq('status', 'approved')
      .order('created_at', { ascending: false })
    if (error) throw new Error(`Cannot load users: ${error.message}`)
    return (data || []).map(u => ({
      id: u.id, name: (u.display_name as string) || u.email.split('@')[0], email: u.email,
      role: u.role as 'admin' | 'user', status: u.status as AdminUser['status'],
      totalFocusTime: 0, sessionsCount: 0, created_at: u.created_at,
    }))
  }
  async function updateUserRole(userId: string, role: 'admin' | 'user'): Promise<void> {
    const sb = getSupabase()
    const { error } = await sb.from('users').update({ role }).eq('id', userId)
    if (error) throw error
  }
  async function deleteUser(userId: string): Promise<void> {
    const sb = getSupabase()
    const { error } = await sb.from('users').delete().eq('id', userId)
    if (error) throw error
  }

  return {
    getTasks,
    getSessions, createSession,
    getMedia, createMedia, updateMedia, deleteMedia, generateEmbedding, generateAllEmbeddings,
    getUsers, updateUserRole, deleteUser,
  }
}
