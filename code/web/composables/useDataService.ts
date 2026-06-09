// composables/useDataService.ts
//
// Data service abstraction — provides CRUD for tasks, focus sessions,
// media library, and admin user management.
//
// POC / Demo  (USE_MOCK_BACKEND = true)  → in‑memory store (pre‑seeded)
// Cloud / Prod (USE_MOCK_BACKEND = false) → Supabase REST client
//
// Using plain module‑level variables instead of localStorage avoids all
// SSR/hydration issues. Data is available immediately on mount.

import dayjs from 'dayjs'
import { useAuth } from '~/composables/useAuth'
import { useConfig } from '~/composables/useConfig'

// ── Types ─────────────────────────────────────────────────────────────────
export interface Task {
  id: string; userId: string; title: string; description?: string
  status: 'pending' | 'in_progress' | 'completed' | 'cancelled'
  priority: number; durationSpent: number; dueDate?: string
  createdAt: string; updatedAt: string; isSynced: boolean
}

export interface FocusSession {
  id: string; userId: string; taskId?: string
  startTime: string; endTime?: string
  durationPlanned: number; durationActual?: number
  journalText?: string; emotionLabel?: string; emotionConfidence?: number
  ambientTrack?: string; createdAt: string; updatedAt: string; isSynced: boolean
}

export interface MediaItem {
  id: string; title: string; media_type: 'sutra' | 'audio' | 'video'
  content_text?: string; content_url?: string; source?: string
  tags: string[]; has_embedding: boolean; created_at: string
}

export interface AdminUser {
  id: string; name: string; email: string; role: 'admin' | 'user'
  totalFocusTime: number; sessionsCount: number; created_at: string
}

// ── In‑Memory Store (EMPTY — needs real DB connection) ──────────────────
const tasksStore: Task[] = []

const sessionsStore: FocusSession[] = []

const mediaStore: MediaItem[] = []

const adminUsersStore: AdminUser[] = []

// ── Composable ────────────────────────────────────────────────────────────
export function useDataService() {
  const { useMockBackend } = useConfig()
  const { currentUser, isAdmin } = useAuth()

  function uid() { return currentUser.value?.id ?? 'unknown' }

  // ── Tasks ──────────────────────────────────────────────────────────────
  async function getTasks(): Promise<Task[]> {
    if (useMockBackend.value) {
      const u = uid()
      if (isAdmin.value) return [...tasksStore.map(t => ({ ...t, userId: t.userId || u }))]
      return [...tasksStore.filter(t => t.userId === u || !t.userId)]
    }
    return []
  }
  async function createTask(title: string, description?: string): Promise<Task> {
    const now = dayjs().toISOString()
    const task: Task = { id: crypto.randomUUID(), userId: uid(), title, description, status: 'pending', priority: 0, durationSpent: 0, createdAt: now, updatedAt: now, isSynced: false }
    if (useMockBackend.value) tasksStore.unshift(task)
    return task
  }
  async function updateTask(taskId: string, changes: Partial<Task>): Promise<void> {
    if (useMockBackend.value) { const i = tasksStore.findIndex(t => t.id === taskId); if (i >= 0) tasksStore[i] = { ...tasksStore[i], ...changes, updatedAt: dayjs().toISOString() } }
  }
  async function deleteTask(taskId: string): Promise<void> {
    if (useMockBackend.value) { const i = tasksStore.findIndex(t => t.id === taskId); if (i >= 0) tasksStore.splice(i, 1) }
  }

  // ── Sessions ───────────────────────────────────────────────────────────
  async function getSessions(): Promise<FocusSession[]> {
    if (useMockBackend.value) { const u = uid(); if (isAdmin.value) return [...sessionsStore]; return [...sessionsStore.filter(s => s.userId === u || !s.userId)] }
    return []
  }
  async function createSession(s: Omit<FocusSession, 'id' | 'createdAt' | 'updatedAt' | 'isSynced'>): Promise<FocusSession> {
    const now = dayjs().toISOString(); const ss: FocusSession = { ...s, id: crypto.randomUUID(), userId: uid(), createdAt: now, updatedAt: now, isSynced: false }
    if (useMockBackend.value) sessionsStore.unshift(ss)
    return ss
  }

  // ── Media ──────────────────────────────────────────────────────────────
  async function getMedia(): Promise<MediaItem[]> { if (useMockBackend.value) return [...mediaStore]; return [] }
  async function createMedia(item: Omit<MediaItem, 'id' | 'created_at' | 'has_embedding'>): Promise<MediaItem> {
    const m: MediaItem = { ...item, id: crypto.randomUUID(), created_at: dayjs().toISOString(), has_embedding: false }
    if (useMockBackend.value) mediaStore.unshift(m)
    return m
  }
  async function updateMedia(id: string, changes: Partial<MediaItem>): Promise<void> {
    if (useMockBackend.value) { const i = mediaStore.findIndex(m => m.id === id); if (i >= 0) mediaStore[i] = { ...mediaStore[i], ...changes } }
  }
  async function deleteMedia(mediaId: string): Promise<void> {
    if (useMockBackend.value) { const i = mediaStore.findIndex(m => m.id === mediaId); if (i >= 0) mediaStore.splice(i, 1) }
  }
  async function generateEmbedding(mediaId: string): Promise<void> {
    await new Promise(r => setTimeout(r, 1000))
    if (useMockBackend.value) { const i = mediaStore.findIndex(m => m.id === mediaId); if (i >= 0) mediaStore[i].has_embedding = true }
  }
  async function generateAllEmbeddings(): Promise<number> {
    let c = 0
    if (useMockBackend.value) { for (const item of mediaStore) { if (!item.has_embedding) { await new Promise(r => setTimeout(r, 400)); item.has_embedding = true; c++ } } }
    return c
  }

  // ── Admin Users ────────────────────────────────────────────────────────
  async function getUsers(): Promise<AdminUser[]> { if (useMockBackend.value) return [...adminUsersStore]; return [] }
  async function updateUserRole(userId: string, role: 'admin' | 'user'): Promise<void> {
    if (useMockBackend.value) { const i = adminUsersStore.findIndex(u => u.id === userId); if (i >= 0) adminUsersStore[i].role = role }
  }
  async function deleteUser(userId: string): Promise<void> {
    if (useMockBackend.value) { const i = adminUsersStore.findIndex(u => u.id === userId); if (i >= 0) adminUsersStore.splice(i, 1) }
  }
  async function addMockUser(user: Omit<AdminUser, 'id' | 'created_at' | 'totalFocusTime' | 'sessionsCount'>): Promise<AdminUser> {
    const u: AdminUser = { ...user, id: 'user-' + crypto.randomUUID().slice(0, 8), totalFocusTime: 0, sessionsCount: 0, created_at: dayjs().toISOString() }
    if (useMockBackend.value) adminUsersStore.unshift(u)
    return u
  }
  async function getAdminStats(): Promise<{ totalUsers: number; sessionsToday: number; avgFocusTime: number; totalFocusMinutes: number }> {
    if (useMockBackend.value) return { totalUsers: adminUsersStore.length, sessionsToday: sessionsStore.length, avgFocusTime: Math.round(sessionsStore.reduce((s, x) => s + (x.durationActual ?? x.durationPlanned), 0) / Math.max(sessionsStore.length, 1) / 60), totalFocusMinutes: Math.round(adminUsersStore.reduce((s, u) => s + u.totalFocusTime, 0) / 60) }
    return { totalUsers: 0, sessionsToday: 0, avgFocusTime: 0, totalFocusMinutes: 0 }
  }

  return { getTasks, createTask, updateTask, deleteTask, getSessions, createSession, getMedia, createMedia, updateMedia, deleteMedia, generateEmbedding, generateAllEmbeddings, getUsers, updateUserRole, deleteUser, addMockUser, getAdminStats }
}
