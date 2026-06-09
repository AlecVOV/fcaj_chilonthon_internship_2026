// composables/useSyncQueue.ts
import { getDB } from '~/lib/db'
import { getSupabase } from '~/lib/supabaseClient'

export function useSyncQueue() {
  const isSyncing = ref(false)
  const pendingCount = ref(0)
  const lastSyncTime = ref<string | null>(null)

  async function syncAll() {
    if (isSyncing.value) return
    isSyncing.value = true
    try {
      const db = getDB()
      const items = await db.getPendingSyncItems(50)
      pendingCount.value = items.length
      for (const item of items) {
        try {
          const payload = JSON.parse(item.payload)
          if (item.tableName === 'localTasks') {
            await syncRecord('focus_tasks', item.operation, payload.id, payload)
          } else if (item.tableName === 'localFocusSessions') {
            await syncRecord('focus_sessions', item.operation, payload.id, payload)
          }
          await db.removeSyncItem(item.localId)
        } catch (e: any) {
          await db.incrementRetry(item.localId, e?.message || 'Unknown error')
        }
      }
      pendingCount.value = await db.pendingSyncCount()
      lastSyncTime.value = new Date().toISOString()
    } finally { isSyncing.value = false }
  }

  async function syncRecord(table: string, operation: string, id: string, payload: any) {
    const supabase = getSupabase()
    if (operation === 'DELETE') {
      await supabase.from(table).delete().eq('id', id)
    } else {
      await supabase.from(table).upsert({
        ...payload, id, updated_at: payload.updatedAt || new Date().toISOString(),
      }, { onConflict: 'id' })
    }
  }

  let syncInterval: ReturnType<typeof setInterval> | null = null
  onMounted(() => { syncInterval = setInterval(syncAll, 30_000) })
  onUnmounted(() => { if (syncInterval) clearInterval(syncInterval) })

  return { isSyncing, pendingCount, lastSyncTime, syncAll }
}
