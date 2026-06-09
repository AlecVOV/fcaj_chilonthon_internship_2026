// lib/db.ts — Dexie.js IndexedDB setup
import Dexie, { type EntityTable } from 'dexie'

export interface LocalTask {
  id: string; userId: string; title: string; description?: string
  status: 'pending' | 'in_progress' | 'completed' | 'cancelled'
  priority: number; durationSpent: number; dueDate?: string
  review?: string; // post-completion review text
  createdAt: string; updatedAt: string; isSynced: boolean
  syncOperation?: 'INSERT' | 'UPDATE' | 'DELETE'
}

export interface LocalFocusSession {
  id: string; userId: string; taskId?: string
  startTime: string; endTime?: string
  durationPlanned: number; durationActual?: number
  journalText?: string; emotionLabel?: string; emotionConfidence?: number
  ambientTrack?: string; createdAt: string; updatedAt: string
  isSynced: boolean; syncOperation?: 'INSERT' | 'UPDATE' | 'DELETE'
}

export interface SyncQueueItem {
  id?: number; localId: string; tableName: string; recordId: string
  operation: 'INSERT' | 'UPDATE' | 'DELETE'; payload: string
  createdAt: string; retryCount: number; lastError?: string
}

export class FocusAppDB extends Dexie {
  localTasks!: EntityTable<LocalTask, 'id'>
  localFocusSessions!: EntityTable<LocalFocusSession, 'id'>
  syncQueue!: EntityTable<SyncQueueItem, 'id'>

  constructor() {
    super('FocusAppDB')
    this.version(1).stores({
      localTasks: 'id, userId, status, isSynced, updatedAt',
      localFocusSessions: 'id, userId, taskId, startTime, isSynced, updatedAt',
      syncQueue: '++id, localId, tableName, recordId, createdAt',
    })
  }

  async upsertTask(task: LocalTask) { return this.localTasks.put(task) }
  async getTasksForUser(userId: string) { return this.localTasks.where({ userId }).toArray() }
  async deleteTask(taskId: string) {
    await this.localTasks.update(taskId, { syncOperation: 'DELETE', isSynced: false } as any)
    await this.localTasks.delete(taskId)
  }

  async upsertFocusSession(session: LocalFocusSession) { return this.localFocusSessions.put(session) }
  async getSessionsForUser(userId: string) { return this.localFocusSessions.where({ userId }).toArray() }

  async enqueueSync(tableName: string, recordId: string, operation: 'INSERT' | 'UPDATE' | 'DELETE', payload: Record<string, unknown>) {
    await this.syncQueue.add({
      localId: crypto.randomUUID(), tableName, recordId, operation,
      payload: JSON.stringify(payload), createdAt: new Date().toISOString(), retryCount: 0,
    })
  }
  async getPendingSyncItems(limit = 50) { return this.syncQueue.orderBy('createdAt').limit(limit).toArray() }
  async removeSyncItem(localId: string) { await this.syncQueue.where({ localId }).delete() }
  async incrementRetry(localId: string, error: string) {
    const item = await this.syncQueue.where({ localId }).first()
    if (item?.id) await this.syncQueue.update(item.id, { retryCount: (item.retryCount || 0) + 1, lastError: error })
  }
  async pendingSyncCount() { return this.syncQueue.count() }
}

let dbInstance: FocusAppDB | null = null
export function getDB(): FocusAppDB {
  if (!dbInstance) dbInstance = new FocusAppDB()
  return dbInstance
}
