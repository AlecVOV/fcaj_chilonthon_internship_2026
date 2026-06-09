// ============================================================================
// Focus Mode App — Dexie.js (IndexedDB) Local Database Schema
// Used for Offline-First persistence in the Nuxt 4 (Vue 3) web client
// Syncs with Supabase PostgreSQL when online via SyncQueueManager
// ============================================================================

import Dexie, { type EntityTable } from 'dexie';

// ---------------------------------------------------------------------------
// 1. Local User cache (mirrors Supabase auth.users)
// ---------------------------------------------------------------------------
export interface LocalUser {
  id: string;           // UUID
  email: string;
  displayName?: string;
  createdAt: Date;
  updatedAt: Date;
}

// ---------------------------------------------------------------------------
// 2. Local Tasks (mirrors public.tasks)
// ---------------------------------------------------------------------------
export interface LocalTask {
  id: string;           // UUID
  userId: string;
  title: string;
  description?: string;
  status: 'pending' | 'in_progress' | 'completed' | 'cancelled';
  priority: number;     // 0-3
  durationSpent: number; // seconds
  dueDate?: Date;
  createdAt: Date;
  updatedAt: Date;

  // Sync metadata
  isSynced: boolean;
  syncOperation?: 'INSERT' | 'UPDATE' | 'DELETE';
}

// ---------------------------------------------------------------------------
// 3. Local Focus Sessions (mirrors public.focus_sessions)
// ---------------------------------------------------------------------------
export interface LocalFocusSession {
  id: string;
  userId: string;
  taskId?: string;
  startTime: Date;
  endTime?: Date;
  durationPlanned: number;  // seconds (e.g. 1500 = 25 min)
  durationActual?: number;
  journalText?: string;     // max 1000 chars
  emotionLabel?: 'focused' | 'stressed' | 'exhausted' | 'relaxed' | 'unmotivated';
  emotionConfidence?: number;
  ambientTrack?: string;
  createdAt: Date;
  updatedAt: Date;

  // Sync metadata
  isSynced: boolean;
  syncOperation?: 'INSERT' | 'UPDATE' | 'DELETE';
}

// ---------------------------------------------------------------------------
// 4. Local Daily Worklogs (cached from nightly Lambda aggregation)
// ---------------------------------------------------------------------------
export interface LocalDailyWorklog {
  id: string;
  userId: string;
  date: string;         // ISO date string (YYYY-MM-DD)
  totalFocusTime: number;
  sessionsCount: number;
  tasksCompleted: number;
  moodSummary?: string;
  dominantEmotion?: string;
  latexFileUrl?: string;
  pdfFileUrl?: string;
  emailSent: boolean;
  createdAt: Date;
  updatedAt: Date;
}

// ---------------------------------------------------------------------------
// 5. Sync Queue (tracks pending sync operations)
// ---------------------------------------------------------------------------
export interface SyncQueueItem {
  id?: number;            // Auto-increment
  localId: string;        // UUID of the queue item
  tableName: string;      // 'tasks' | 'focus_sessions'
  recordId: string;       // UUID of the actual record
  operation: 'INSERT' | 'UPDATE' | 'DELETE';
  payload: string;        // JSON-encoded row data
  createdAt: Date;
  retryCount: number;
  lastError?: string;
}

// ---------------------------------------------------------------------------
// 6. Dexie Database Class
// ---------------------------------------------------------------------------
export class FocusAppDB extends Dexie {
  // Tables (Dexie typing)
  localUsers!: EntityTable<LocalUser, 'id'>;
  localTasks!: EntityTable<LocalTask, 'id'>;
  localFocusSessions!: EntityTable<LocalFocusSession, 'id'>;
  localDailyWorklogs!: EntityTable<LocalDailyWorklog, 'id'>;
  syncQueue!: EntityTable<SyncQueueItem, 'id'>;

  constructor() {
    super('FocusAppDB');

    this.version(1).stores({
      localUsers: 'id, email, updatedAt',
      localTasks: 'id, userId, status, isSynced, updatedAt',
      localFocusSessions:
        'id, userId, taskId, startTime, isSynced, updatedAt',
      localDailyWorklogs: 'id, userId, date, updatedAt',
      syncQueue: '++id, localId, tableName, recordId, createdAt',
    });

    // Hooks for data integrity
    this.localTasks.hook('creating', (primKey, obj) => {
      obj.createdAt = new Date();
      obj.updatedAt = new Date();
      obj.isSynced = false;
      obj.syncOperation = 'INSERT';
    });

    this.localTasks.hook('updating', (mods, primKey, obj) => {
      mods.updatedAt = new Date();
      mods.isSynced = false;
      mods.syncOperation = 'UPDATE';
    });

    this.localFocusSessions.hook('creating', (primKey, obj) => {
      obj.createdAt = new Date();
      obj.updatedAt = new Date();
      obj.isSynced = false;
      obj.syncOperation = 'INSERT';
    });

    this.localFocusSessions.hook('updating', (mods, primKey, obj) => {
      mods.updatedAt = new Date();
      mods.isSynced = false;
      mods.syncOperation = 'UPDATE';
    });
  }

  // =======================================================================
  // Task Operations
  // =======================================================================

  /** Insert or update a task locally (upsert by id) */
  async upsertTask(task: LocalTask): Promise<string> {
    return this.localTasks.put(task);
  }

  /** Get all unsynced tasks for a user */
  async getUnsyncedTasks(userId: string): Promise<LocalTask[]> {
    return this.localTasks
      .where({ userId, isSynced: false })
      .toArray();
  }

  /** Mark a task as synced */
  async markTaskSynced(taskId: string): Promise<void> {
    await this.localTasks.update(taskId, {
      isSynced: true,
      syncOperation: undefined,
    });
  }

  /** Get tasks for user, optionally filtered by status */
  async getTasksForUser(
    userId: string,
    status?: string
  ): Promise<LocalTask[]> {
    let collection = this.localTasks.where({ userId });
    const tasks = await collection.toArray();
    if (status) return tasks.filter((t) => t.status === status);
    return tasks;
  }

  /** Soft-delete a task (for sync tracking) */
  async deleteTask(taskId: string): Promise<void> {
    // Mark for sync deletion
    await this.localTasks.update(taskId, {
      syncOperation: 'DELETE',
      isSynced: false,
      updatedAt: new Date(),
    });
    // Actually remove from local
    // (SyncQueueManager will push the DELETE before pruning locally)
    await this.localTasks.delete(taskId);
  }

  // =======================================================================
  // Focus Session Operations
  // =======================================================================

  async upsertFocusSession(session: LocalFocusSession): Promise<string> {
    return this.localFocusSessions.put(session);
  }

  async getUnsyncedSessions(userId: string): Promise<LocalFocusSession[]> {
    return this.localFocusSessions
      .where({ userId, isSynced: false })
      .toArray();
  }

  async markSessionSynced(sessionId: string): Promise<void> {
    await this.localFocusSessions.update(sessionId, {
      isSynced: true,
      syncOperation: undefined,
    });
  }

  async getSessionsForUser(
    userId: string,
    from?: Date,
    to?: Date
  ): Promise<LocalFocusSession[]> {
    let sessions = await this.localFocusSessions
      .where({ userId })
      .toArray();
    if (from) sessions = sessions.filter((s) => s.startTime >= from);
    if (to) sessions = sessions.filter((s) => s.startTime <= to);
    return sessions.sort(
      (a, b) => b.startTime.getTime() - a.startTime.getTime()
    );
  }

  // =======================================================================
  // Sync Queue Operations
  // =======================================================================

  /** Enqueue a sync operation */
  async enqueueSync(
    tableName: string,
    recordId: string,
    operation: 'INSERT' | 'UPDATE' | 'DELETE',
    payload: Record<string, unknown>
  ): Promise<void> {
    await this.syncQueue.add({
      localId: crypto.randomUUID(),
      tableName,
      recordId,
      operation,
      payload: JSON.stringify(payload),
      createdAt: new Date(),
      retryCount: 0,
    });
  }

  /** Get pending sync items ordered by creation time (oldest first) */
  async getPendingSyncItems(limit = 50): Promise<SyncQueueItem[]> {
    return this.syncQueue
      .orderBy('createdAt')
      .limit(limit)
      .toArray();
  }

  /** Remove a sync item after successful server push */
  async removeSyncItem(localId: string): Promise<void> {
    await this.syncQueue.where({ localId }).delete();
  }

  /** Increment retry count on failure */
  async incrementRetry(localId: string, error: string): Promise<void> {
    const item = await this.syncQueue.where({ localId }).first();
    if (item) {
      await this.syncQueue.update(item.id!, {
        retryCount: item.retryCount + 1,
        lastError: error,
      });
    }
  }

  /** Count pending sync items (for badge in UI) */
  async pendingSyncCount(): Promise<number> {
    return this.syncQueue.count();
  }

  // =======================================================================
  // Worklog Operations
  // =======================================================================

  async getWorklogsForUser(
    userId: string,
    from?: string,
    to?: string
  ): Promise<LocalDailyWorklog[]> {
    let worklogs = await this.localDailyWorklogs
      .where({ userId })
      .toArray();
    if (from) worklogs = worklogs.filter((w) => w.date >= from);
    if (to) worklogs = worklogs.filter((w) => w.date <= to);
    return worklogs.sort((a, b) => b.date.localeCompare(a.date));
  }
}

// =======================================================================
// 7. Singleton instance (lazy init)
// =======================================================================
let dbInstance: FocusAppDB | null = null;

export function getDB(): FocusAppDB {
  if (!dbInstance) {
    dbInstance = new FocusAppDB();
  }
  return dbInstance;
}

/** For testing: inject a mock DB */
export function setDB(db: FocusAppDB): void {
  dbInstance = db;
}
