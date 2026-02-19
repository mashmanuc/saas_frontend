// WB: Autosave composable for Winterboard
// Ref: TASK_BOARD C2.1, ManifestWinterboard_v2.md LAW-02
// - Debounced save: 3s after last change
// - Diff save → stream save fallback
// - Beacon save on beforeunload
// - Retry with exponential backoff: 1s, 2s, 4s, max 3 retries
// - Updates useWBStore: syncStatus, lastSavedAt, rev

import { ref, watch, onUnmounted, computed, type Ref } from 'vue'
import { useWBStore } from '../board/state/boardStore'
import { winterboardApi } from '../api/winterboardApi'
import type { WBDiffOp } from '../api/winterboardApi'
import type { WBSyncStatus, WBWorkspaceState } from '../types/winterboard'

// ── Config ─────────────────────────────────────────────────────────────

const DEBOUNCE_MS = 3_000        // 3 seconds after last change
const MAX_WAIT_MS = 15_000       // Force save after 15s of continuous edits
const RETRY_BASE_MS = 1_000      // Exponential backoff base
const MAX_RETRIES = 3            // Max retry attempts
const BEACON_THROTTLE_MS = 500   // Min interval between beacon saves

// ── Types ──────────────────────────────────────────────────────────────

export interface AutosaveReturn {
  /** Current save status */
  status: Ref<WBSyncStatus>
  /** Whether a save is in progress */
  isSaving: Ref<boolean>
  /** Total successful saves */
  saveCount: Ref<number>
  /** Last error message */
  lastError: Ref<string | null>
  /** Pending diff operations count */
  pendingOpsCount: Ref<number>
  /** Force immediate save */
  saveNow: () => Promise<void>
  /** Cancel pending save */
  cancelPendingSave: () => void
  /** Queue a diff operation */
  queueDiffOp: (op: WBDiffOp) => void
  /** Destroy — cleanup all listeners and timers */
  destroy: () => void
}

// ── Composable ─────────────────────────────────────────────────────────

export function useAutosave(sessionId: Ref<string | null>): AutosaveReturn {
  const store = useWBStore()

  // Reactive state
  const status = ref<WBSyncStatus>('idle')
  const isSaving = ref(false)
  const saveCount = ref(0)
  const lastError = ref<string | null>(null)

  // Internal state
  const pendingOps = ref<WBDiffOp[]>([])
  let debounceTimer: ReturnType<typeof setTimeout> | null = null
  let maxWaitTimer: ReturnType<typeof setTimeout> | null = null
  let retryCount = 0
  let destroyed = false

  const pendingOpsCount = computed(() => pendingOps.value.length)

  // ── Timer management ───────────────────────────────────────────────

  function clearTimers(): void {
    if (debounceTimer) {
      clearTimeout(debounceTimer)
      debounceTimer = null
    }
    if (maxWaitTimer) {
      clearTimeout(maxWaitTimer)
      maxWaitTimer = null
    }
  }

  // ── Retry with exponential backoff ─────────────────────────────────

  function getRetryDelay(): number {
    return RETRY_BASE_MS * Math.pow(2, retryCount)
  }

  async function retryWithBackoff(fn: () => Promise<boolean>): Promise<boolean> {
    retryCount = 0
    while (retryCount <= MAX_RETRIES) {
      const success = await fn()
      if (success) {
        retryCount = 0
        return true
      }
      retryCount++
      if (retryCount > MAX_RETRIES) break
      const delay = getRetryDelay()
      if (import.meta.env?.DEV) {
        console.warn(`[WB:autosave] Retry ${retryCount}/${MAX_RETRIES} in ${delay}ms`)
      }
      await sleep(delay)
      if (destroyed) return false
    }
    return false
  }

  // ── Diff save ──────────────────────────────────────────────────────

  async function performDiffSave(): Promise<boolean> {
    const sid = sessionId.value
    if (!sid || pendingOps.value.length === 0) return true

    const ops = [...pendingOps.value]
    const rev = store.rev

    try {
      const result = await winterboardApi.diffSave(
        sid,
        {
          rev,
          ops,
          client_ts: new Date().toISOString(),
        },
        rev,
      )

      // Success — clear saved ops, update store
      pendingOps.value = pendingOps.value.slice(ops.length)
      store.rev = result.next_rev
      store.setLastSaved(new Date(result.server_ts))
      return true
    } catch (err: any) {
      const status = err?.response?.status
      // 409 = rev mismatch, 422 = invalid ops → fallback to stream save
      if (status === 409 || status === 422) {
        if (import.meta.env?.DEV) {
          console.warn(`[WB:autosave] Diff save failed (${status}), falling back to stream save`)
        }
        return false
      }
      // Other errors → retry
      throw err
    }
  }

  // ── Stream save (fallback) ─────────────────────────────────────────

  async function performStreamSave(): Promise<boolean> {
    const sid = sessionId.value
    if (!sid) return false

    const state = store.serializedState
    const rev = store.rev

    try {
      const result = await winterboardApi.streamSave(sid, state, rev)

      // 202 Accepted with new rev
      if (result.rev) {
        store.rev = result.rev
      }
      pendingOps.value = []
      store.setLastSaved(new Date())
      return true
    } catch (err: any) {
      const status = err?.response?.status
      // 204 = no change (digest match) — still success
      if (status === 204 || err?.response?.status === 204) {
        pendingOps.value = []
        store.setLastSaved(new Date())
        return true
      }
      throw err
    }
  }

  // ── Main save orchestrator ─────────────────────────────────────────

  async function performSave(): Promise<void> {
    if (destroyed || !sessionId.value) return
    if (isSaving.value) return

    clearTimers()
    isSaving.value = true
    status.value = 'syncing'
    store.setSyncStatus('syncing')
    lastError.value = null

    try {
      // PROB-4 FIX: If no pending diff ops, skip diff save entirely and use stream save.
      // Previously diffSave returned true with 0 ops, marking isDirty=false without saving.
      const hasPendingOps = pendingOps.value.length > 0

      let diffSuccess = false
      if (hasPendingOps) {
        // Strategy 1: Try diff save with retry (only when we have ops)
        diffSuccess = await retryWithBackoff(async () => {
          try {
            return await performDiffSave()
          } catch {
            return false
          }
        })

        if (diffSuccess) {
          onSaveSuccess()
          return
        }
      }

      // Strategy 2: Stream save — used as fallback OR when no diff ops but store is dirty
      if (import.meta.env?.DEV) {
        console.warn(`[WB:autosave] ${hasPendingOps ? 'Diff save exhausted, trying' : 'No pending ops, using'} stream save`)
      }

      const streamSuccess = await retryWithBackoff(async () => {
        try {
          return await performStreamSave()
        } catch {
          return false
        }
      })

      if (streamSuccess) {
        onSaveSuccess()
        return
      }

      // Both strategies failed
      onSaveError('Save failed after all retries')
    } catch (err: any) {
      onSaveError(err?.message || 'Unknown save error')
    } finally {
      isSaving.value = false
    }
  }

  function onSaveSuccess(): void {
    status.value = 'saved'
    store.setSyncStatus('saved')
    store.setSyncError(null)
    saveCount.value++
    retryCount = 0

    if (import.meta.env?.DEV) {
      console.log(`[WB:autosave] Saved (#${saveCount.value})`)
    }
  }

  function onSaveError(message: string): void {
    status.value = 'error'
    store.setSyncStatus('error')
    store.setSyncError(message)
    lastError.value = message
    console.error('[WB:autosave]', message)
  }

  // ── Scheduling ─────────────────────────────────────────────────────

  function scheduleSave(): void {
    if (destroyed || !sessionId.value) return

    // Clear existing debounce
    if (debounceTimer) {
      clearTimeout(debounceTimer)
    }

    debounceTimer = setTimeout(() => {
      performSave()
    }, DEBOUNCE_MS)

    // Max wait timer — force save after continuous edits
    if (!maxWaitTimer) {
      maxWaitTimer = setTimeout(() => {
        maxWaitTimer = null
        if (store.isDirty || pendingOps.value.length > 0) {
          performSave()
        }
      }, MAX_WAIT_MS)
    }
  }

  // ── Public API ─────────────────────────────────────────────────────

  function queueDiffOp(op: WBDiffOp): void {
    pendingOps.value = [...pendingOps.value, op]
    scheduleSave()
  }

  async function saveNow(): Promise<void> {
    clearTimers()
    await performSave()
  }

  function cancelPendingSave(): void {
    clearTimers()
  }

  // ── Watch store.isDirty for auto-scheduling ────────────────────────

  const stopDirtyWatch = watch(
    () => store.isDirty,
    (dirty) => {
      if (dirty && sessionId.value) {
        scheduleSave()
      }
    },
  )

  // ── Online/Offline detection ───────────────────────────────────────

  function handleOnline(): void {
    if (status.value === 'offline') {
      status.value = 'idle'
      store.setSyncStatus('idle')
      // Trigger save for any pending changes
      if (store.isDirty || pendingOps.value.length > 0) {
        scheduleSave()
      }
    }
  }

  function handleOffline(): void {
    status.value = 'offline'
    store.setSyncStatus('offline')
    clearTimers()
  }

  // ── Beacon save on beforeunload ────────────────────────────────────

  function handleBeforeUnload(_event: BeforeUnloadEvent): void {
    if (!sessionId.value) return
    if (!store.isDirty && pendingOps.value.length === 0) return

    winterboardApi.beaconSave(sessionId.value, {
      state: store.serializedState,
      rev: store.rev,
      client_ts: new Date().toISOString(),
    })
  }

  function handleVisibilityChange(): void {
    if (document.visibilityState === 'hidden' && sessionId.value) {
      if (store.isDirty || pendingOps.value.length > 0) {
        winterboardApi.beaconSave(sessionId.value, {
          state: store.serializedState,
          rev: store.rev,
          client_ts: new Date().toISOString(),
        })
      }
    }
  }

  // ── Event listeners ────────────────────────────────────────────────

  if (typeof window !== 'undefined') {
    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)
    window.addEventListener('beforeunload', handleBeforeUnload)
    document.addEventListener('visibilitychange', handleVisibilityChange)
  }

  // ── Cleanup ────────────────────────────────────────────────────────

  function destroy(): void {
    destroyed = true
    clearTimers()
    stopDirtyWatch()

    if (typeof window !== 'undefined') {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
      window.removeEventListener('beforeunload', handleBeforeUnload)
      document.removeEventListener('visibilitychange', handleVisibilityChange)
    }

    // Final beacon save if pending
    if (sessionId.value && (store.isDirty || pendingOps.value.length > 0)) {
      winterboardApi.beaconSave(sessionId.value, {
        state: store.serializedState,
        rev: store.rev,
        client_ts: new Date().toISOString(),
      })
    }
  }

  onUnmounted(destroy)

  return {
    status,
    isSaving,
    saveCount,
    lastError,
    pendingOpsCount,
    saveNow,
    cancelPendingSave,
    queueDiffOp,
    destroy,
  }
}

// ── Utility ──────────────────────────────────────────────────────────

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

export default useAutosave
