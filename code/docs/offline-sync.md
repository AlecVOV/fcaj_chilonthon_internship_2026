# Offline-First Sync — Conflict Resolution & Queue Logic (Nuxt 4 / TypeScript)

> **Project:** Focus Mode App (Web-Only)  
> **Strategy:** Last-Write-Wins (LWW) based on `updated_at` timestamp  
> **Local DB:** Dexie.js (IndexedDB)  
> **Remote DB:** Supabase PostgreSQL  

---

## 1. Architecture Overview

```
┌──────────────────────────────────────────────────┐
│                Nuxt 4 Web App (Browser)            │
│                                                    │
│  ┌──────────┐    ┌──────────────┐                 │
│  │  Vue      │◄──►│  Pinia        │                │
│  │  Pages    │    │  Stores       │                 │
│  └──────────┘    └──────┬───────┘                 │
│                         │                          │
│                  ┌──────▼───────┐                 │
│                  │  Composables  │                 │
│                  │  (useXxx)     │                 │
│                  └──────┬───────┘                 │
│                         │                          │
│         ┌───────────────┼───────────────┐         │
│         │               │               │         │
│  ┌──────▼──────┐ ┌──────▼──────┐ ┌─────▼──────┐  │
│  │ Dexie.js     │ │ SyncQueue   │ │ Supabase    │  │
│  │ (IndexedDB)  │ │ Manager     │ │ Client      │  │
│  └──────────────┘ └──────┬──────┘ └─────┬──────┘  │
│                          │               │         │
└──────────────────────────┼───────────────┼────────┘
                           │               │
                   ┌───────▼───────────────▼───────┐
                   │  navigator.onLine +            │
                   │  window 'online'/'offline'     │
                   │  event listeners               │
                   └───────────────────────────────┘
```

## 2. Write Path (Always Local First)

```
User Action (Create/Update/Delete Task or Session)
    │
    ▼
1. Write to Dexie IndexedDB immediately
    │
    ▼
2. Auto-enqueue operation to SyncQueue table (via Dexie hooks):
   { localId, tableName, recordId, operation, payload(JSON), createdAt, retryCount: 0 }
    │
    ▼
3. Pinia store updates optimistically (reactive UI)
    │
    ▼
4. If navigator.onLine === true → trigger syncQueueManager.processQueue()
```

## 3. SyncQueueManager (TypeScript)

### 3.1 `services/sync.service.ts`

```typescript
// services/sync.service.ts
import { getDB, type SyncQueueItem } from '~/database/indexeddb_schema'
import type { SupabaseClient } from '@supabase/supabase-js'

let isSyncing = false
const MAX_RETRIES = 5

export function useSyncService(supabase: SupabaseClient) {
  const db = getDB()

  /** Process pending sync items sequentially. */
  async function processQueue(): Promise<{ synced: number; failed: number }> {
    if (isSyncing) return { synced: 0, failed: 0 }
    if (!navigator.onLine) return { synced: 0, failed: 0 }

    isSyncing = true
    let synced = 0
    let failed = 0

    try {
      const items = await db.getPendingSyncItems(50)

      for (const item of items) {
        try {
          await pushToServer(item)
          await db.removeSyncItem(item.localId)
          await markRecordSynced(item.tableName, item.recordId)
          synced++
        } catch (err: any) {
          if (err?.name === 'NetworkError' || err?.status === 0) {
            await db.incrementRetry(item.localId, err.message)
            failed++
            break // Network down — stop, retry next cycle
          }

          if (item.retryCount >= MAX_RETRIES) {
            console.error(`Sync failed after ${MAX_RETRIES} retries:`, item)
            await db.removeSyncItem(item.localId)
            failed++
            continue
          }

          await db.incrementRetry(item.localId, err.message)
          failed++
        }
      }
    } finally {
      isSyncing = false
    }

    return { synced, failed }
  }

  /** Push a single sync item to Supabase. */
  async function pushToServer(item: SyncQueueItem): Promise<void> {
    const table = supabase.from(item.tableName)
    const payload = JSON.parse(item.payload)

    switch (item.operation) {
      case 'INSERT':
        await table.insert(payload)
        break
      case 'UPDATE':
        await table.update(payload).eq('id', item.recordId)
        break
      case 'DELETE':
        await table.delete().eq('id', item.recordId)
        break
    }
  }

  /** Mark the local record as synced. */
  async function markRecordSynced(
    tableName: string,
    recordId: string
  ): Promise<void> {
    if (tableName === 'tasks') {
      await db.markTaskSynced(recordId)
    } else if (tableName === 'focus_sessions') {
      await db.markSessionSynced(recordId)
    }
  }

  /** Enqueue a sync operation. */
  async function enqueue(
    tableName: string,
    recordId: string,
    operation: 'INSERT' | 'UPDATE' | 'DELETE',
    payload: Record<string, unknown>
  ): Promise<void> {
    await db.enqueueSync(tableName, recordId, operation, payload)
  }

  async function pendingCount(): Promise<number> {
    return db.pendingSyncCount()
  }

  return { processQueue, enqueue, pendingCount, isSyncing: () => isSyncing }
}
```

## 4. Conflict Resolution — Last-Write-Wins (LWW)

### 4.1 Rationale

Single-user productivity app. Multi-device simultaneous edits are rare. LWW is simple and correct.

### 4.2 Resolution Logic

```
Server record.updated_at > Client record.updated_at?
    │
    ├── YES → Server wins. Overwrite local IndexedDB with server data.
    │
    └── NO  → Client wins. Write client data to server.
```

Equal timestamps → server wins (prefer authoritative source).

### 4.3 pullFromServer (Periodic Sync)

```typescript
// services/sync.service.ts (continued)

async function pullFromServer(userId: string): Promise<void> {
  // Pull tasks
  const { data: serverTasks } = await supabase
    .from('tasks')
    .select('*')
    .eq('user_id', userId)

  if (serverTasks) {
    for (const serverTask of serverTasks) {
      const localTask = await db.localTasks.get(serverTask.id)

      if (!localTask) {
        await db.localTasks.put({ ...serverTask, isSynced: true })
      } else if (
        new Date(serverTask.updated_at) > new Date(localTask.updatedAt)
      ) {
        await db.localTasks.put({ ...serverTask, isSynced: true })
      }
      // Else: local newer — keep local (will push on next cycle)
    }
  }

  // Pull focus sessions
  const { data: serverSessions } = await supabase
    .from('focus_sessions')
    .select('*')
    .eq('user_id', userId)

  if (serverSessions) {
    for (const serverSession of serverSessions) {
      const localSession = await db.localFocusSessions.get(serverSession.id)

      if (!localSession) {
        await db.localFocusSessions.put({ ...serverSession, isSynced: true })
      } else if (
        new Date(serverSession.updated_at) > new Date(localSession.updatedAt)
      ) {
        await db.localFocusSessions.put({ ...serverSession, isSynced: true })
      }
    }
  }
}
```

## 5. Sync Triggers

| Trigger | Action |
|---|---|
| **App load** | `processQueue()` if online |
| **Network regained** | `window.addEventListener('online', () => processQueue())` |
| **After any local write** | Debounced `processQueue()` (500ms) |
| **Periodic polling** | `setInterval(() => processQueue(), 5 * 60 * 1000)` |
| **Manual refresh** | User clicks "Sync Now" button |
| **Tab focus** | `document.addEventListener('visibilitychange', ...)` → sync on focus |

### 5.1 Network Listener Setup (Nuxt Plugin)

```typescript
// plugins/sync.client.ts
export default defineNuxtPlugin(() => {
  const { $supabase } = useNuxtApp()
  const syncService = useSyncService($supabase as SupabaseClient)

  window.addEventListener('online', () => {
    console.log('[Sync] Network restored — processing queue')
    syncService.processQueue()
  })

  const interval = setInterval(() => {
    if (navigator.onLine) syncService.processQueue()
  }, 5 * 60 * 1000)

  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible' && navigator.onLine) {
      syncService.processQueue()
    }
  })

  return {
    provide: { syncService },
  }
})
```

## 6. Edge Cases Handled

| Scenario | Behavior |
|---|---|
| **Tab closed mid-sync** | Sync items persist in IndexedDB; processed on next load |
| **Network timeout** | Retry with exponential backoff (1s→2s→4s→8s→16s), max 5 retries |
| **Server returns 409 Conflict** | Apply LWW: compare `updated_at`, keep newer |
| **Record deleted on server** | Client UPDATE for deleted record → discard, remove local |
| **Large payload** | Batch of 50; JSON stored as TEXT in IndexedDB |
| **Two tabs open** | Each tab has own Dexie; server `updated_at` deconflicts |
| **Storage full** | Dexie throws `QuotaExceededError` → surface warning to user |

## 7. IndexedDB Schema for Sync

```typescript
// Each local table includes:
isSynced: boolean;           // true after successful server push
syncOperation?: 'INSERT' | 'UPDATE' | 'DELETE';  // set by Dexie hooks
```

Dexie hooks auto-set `isSynced = false` and `syncOperation` on every write.

## 8. Testing the Sync Queue

See `testing-plan.md`. Key test cases:

- Insert offline → go online → verify server has record
- Update offline + update online → LWW resolves to newer
- Delete offline → go online → server record deleted
- Network failure mid-batch → remaining items retried next cycle
- Max retries exceeded → item removed from queue, error logged
