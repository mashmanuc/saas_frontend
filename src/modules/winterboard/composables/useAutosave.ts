// WB: Autosave composable for Winterboard
// Ref: TASK_BOARD C2.1, ManifestWinterboard_v2.md LAW-02
// - Debounced save: 3s after last change
// - Diff save (ops-based) + stream save fallback (legacy isDirty path)
// - Beacon save on beforeunload
// - Retry with exponential backoff: 1s, 2s, 4s, max 3 retries
// - Updates useWBStore: syncStatus, lastSavedAt, rev

import { ref, watch, onUnmounted, computed, type Ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useWBStore } from '../board/state/boardStore'
import { winterboardApi } from '../api/winterboardApi'
import type { WBDiffOp } from '../api/winterboardApi'
import type { WBSyncStatus, WBWorkspaceState } from '../types/winterboard'
import { isCircuitBreakerOpen } from '@/utils/apiClient'
import { useToast } from './useToast'
import { useOpsQueue, type QueuedOp } from './useOpsQueue'

// ── Config ─────────────────────────────────────────────────────────────

const DEBOUNCE_MS = 3_000        // 3 seconds after last change
const MAX_WAIT_MS = 15_000       // Force save after 15s of continuous edits
const RETRY_BASE_MS = 1_000      // Exponential backoff base
const MAX_RETRIES = 3            // Max retry attempts
const BEACON_THROTTLE_MS = 500   // Min interval between beacon saves
const FAILURE_COOLDOWN_MS = 60_000  // 60s cooldown after all retries exhausted (prevent server overload)
const WARN_SIZE_BYTES = 8 * 1024 * 1024   // 8 MB — show warning
const HARD_LIMIT_BYTES = 10 * 1024 * 1024 // 10 MB — block save

/** Returns approximate byte size of the serialized payload. */
function estimatePayloadSizeBytes(payload: unknown): number {
  return new Blob([JSON.stringify(payload)]).size
}

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

export function useAutosave(
  sessionId: Ref<string | null>,
  options?: {
    onSaved?: () => void
    disabled?: Ref<boolean>
  },
): AutosaveReturn {
  const store = useWBStore()
  const { t } = useI18n({ useScope: 'global' })
  const { showToast } = useToast()

  // Reactive state
  const status = ref<WBSyncStatus>('idle')
  const isSaving = ref(false)
  const saveCount = ref(0)
  const lastError = ref<string | null>(null)

  // Phase 3: Ops queue with ACK/retry (replaces plain pendingOps array)
  const opsQueue = useOpsQueue({
    sessionId,
    onFlush: async (ops: QueuedOp[]) => {
      const rev = store.rev
      try {
        const result = await winterboardApi.diffSave(
          sessionId.value!,
          { rev, ops, client_ts: new Date().toISOString() },
          rev,
        )
        return {
          rev: result.rev ?? result.next_rev,
          ack: result.ack ?? 0,
          assigned: result.assigned ?? [],
        }
      } catch (err: any) {
        const errStatus = err?.response?.status
        // Log error details for debugging
        if (import.meta.env?.DEV) {
          console.warn(
            `[WB:autosave] onFlush error ${errStatus}:`,
            err?.response?.data,
            `(${ops.length} ops, rev=${rev})`,
          )
        }
        // 409: rev mismatch — update store.rev from server response
        if (errStatus === 409) {
          const serverRev = err?.response?.data?.server_rev
          if (typeof serverRev === 'number') {
            store.rev = serverRev
          }
        }
        throw err
      }
    },
    onAck: (lastSeq: number, newRev: number) => {
      store.rev = newRev
      store.lastSeq = lastSeq
      store.setLastSaved(new Date())
    },
    onError: (err: unknown) => {
      onSaveError(String(err))
    },
  })

  // Legacy alias — pendingOps now delegates to opsQueue
  const pendingOps = opsQueue.pending

  let debounceTimer: ReturnType<typeof setTimeout> | null = null
  let maxWaitTimer: ReturnType<typeof setTimeout> | null = null
  let cooldownTimer: ReturnType<typeof setTimeout> | null = null
  let retryCount = 0
  let destroyed = false
  let inCooldown = false  // True after all retries exhausted — prevents hammering dead server

  const pendingOpsCount = opsQueue.pendingCount

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

  // ── Diff save (Phase 3: delegates to opsQueue) ────────────────────

  async function performDiffSave(): Promise<boolean> {
    const sid = sessionId.value
    if (!sid || opsQueue.pendingCount.value === 0) return true

    const countBefore = opsQueue.pendingCount.value
    await opsQueue.flush()
    // flush() catches errors internally — check if ops were actually consumed
    return opsQueue.pendingCount.value < countBefore
  }

  // ── Stream save (legacy fallback for isDirty without ops) ─────────
  // TODO: Remove when all board mutations generate ops via queueDiffOp

  async function performStreamSave(): Promise<boolean> {
    const sid = sessionId.value
    if (!sid) return false

    const state = store.serializedStateForSave
    const payloadSizeBytes = estimatePayloadSizeBytes({ state })

    if (payloadSizeBytes > HARD_LIMIT_BYTES) {
      showToast(t('winterboard.autosave.boardTooLarge'), 'error')
      return false
    }

    if (payloadSizeBytes > WARN_SIZE_BYTES) {
      showToast(t('winterboard.autosave.boardLargeWarning'), 'warning')
    }

    const rev = store.rev

    try {
      const result = await winterboardApi.streamSave(sid, state, rev)
      if (result.rev) {
        store.rev = result.rev
      }
      opsQueue.clear()
      store.setLastSaved(new Date())
      return true
    } catch (err: any) {
      const errStatus = err?.response?.status
      if (errStatus === 204) {
        opsQueue.clear()
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
    // Phase 0: In classroom mode, student doesn't save (teacher is SSOT)
    if (options?.disabled?.value) return

    // Guard: nothing to save
    if (!store.isDirty && pendingOps.value.length === 0) return

    // REPLAY-INV-12: NEVER save during replay — replay operations are temporary
    // and must not overwrite the real board state on the server
    if (store.mode === 'replay') return

    clearTimers()
    isSaving.value = true
    status.value = 'syncing'
    store.setSyncStatus('syncing')
    lastError.value = null

    try {
      const hasPendingOps = pendingOps.value.length > 0

      // Strategy 1: Diff save (ops-based) — primary
      if (hasPendingOps) {
        const diffSuccess = await retryWithBackoff(async () => {
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

      // Strategy 2: Stream save — fallback for isDirty without ops
      // (legacy path: board mutations set isDirty but don't generate ops yet)
      if (store.isDirty) {
        const streamSuccess = await retryWithBackoff(async () => {
          try {
            return await performStreamSave()
          } catch (err: any) {
            const errStatus = err?.response?.status
            if (errStatus === 401) throw err
            if (errStatus === 413) {
              showToast(t('winterboard.autosave.boardTooLarge'), 'error')
              throw err
            }
            if (errStatus === 412 || errStatus === 409) {
              const serverRev = err?.response?.data?.server_rev
              if (typeof serverRev === 'number') {
                store.rev = serverRev
              }
            }
            return false
          }
        })

        if (streamSuccess) {
          onSaveSuccess()
          return
        }
      }

      // Both strategies failed (or nothing to save)
      if (hasPendingOps || store.isDirty) {
        onSaveError('Save failed after all retries')
      }
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

    // Classroom sync: notify other participants about state change
    options?.onSaved?.()

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

    // Circuit breaker: cooldown after total failure to prevent server overload
    inCooldown = true
    opsQueue.stop()  // Stop opsQueue timer during cooldown to prevent hammering
    console.warn(`[WB:autosave] Entering cooldown for ${FAILURE_COOLDOWN_MS / 1000}s`)
    cooldownTimer = setTimeout(() => {
      inCooldown = false
      cooldownTimer = null
      opsQueue.start()  // Resume opsQueue timer
      console.info('[WB:autosave] Cooldown ended, will retry on next change')
      if (store.isDirty || pendingOps.value.length > 0) {
        scheduleSave()
      }
    }, FAILURE_COOLDOWN_MS)
  }

  // ── Scheduling ─────────────────────────────────────────────────────

  function scheduleSave(): void {
    if (destroyed || !sessionId.value) return
    if (inCooldown) return
    if (isCircuitBreakerOpen()) return

    if (debounceTimer) {
      clearTimeout(debounceTimer)
    }

    debounceTimer = setTimeout(() => {
      performSave()
    }, DEBOUNCE_MS)

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
    opsQueue.enqueue(op)
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
    if (status.value === 'offline' || status.value === 'error') {
      status.value = 'idle'
      store.setSyncStatus('idle')
      inCooldown = false
      if (cooldownTimer) {
        clearTimeout(cooldownTimer)
        cooldownTimer = null
      }
      opsQueue.start()  // Resume opsQueue timer
      if (store.isDirty || pendingOps.value.length > 0) {
        scheduleSave()
      }
    }
  }

  function handleOffline(): void {
    status.value = 'offline'
    store.setSyncStatus('offline')
    opsQueue.stop()  // Stop opsQueue timer when offline
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
        performSave().catch(() => { /* beacon already sent as fallback */ })
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

  // Phase 3: Start ops queue flush timer
  opsQueue.start()

  // ── Cleanup ────────────────────────────────────────────────────────

  function destroy(): void {
    destroyed = true
    clearTimers()
    stopDirtyWatch()
    opsQueue.destroy()
    if (cooldownTimer) {
      clearTimeout(cooldownTimer)
      cooldownTimer = null
    }
    inCooldown = false

    if (typeof window !== 'undefined') {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
      window.removeEventListener('beforeunload', handleBeforeUnload)
      document.removeEventListener('visibilitychange', handleVisibilityChange)
    }

    // Final beacon save if pending
    if (sessionId.value && (store.isDirty || opsQueue.pendingCount.value > 0)) {
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
