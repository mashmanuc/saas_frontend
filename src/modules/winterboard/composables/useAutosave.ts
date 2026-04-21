// WB: Autosave composable for Winterboard
// Ref: TASK_BOARD C2.1, ManifestWinterboard_v2.md LAW-02
// - Stream save: 3s debounce after last change
// - Beacon save on beforeunload
// - Retry with exponential backoff: 1s, 2s, 4s, max 3 retries
// - Updates useWBStore: syncStatus, lastSavedAt, rev
//
// Ops pipeline: all board ops go through /replay/batch/ (useReplayRecorder).
// Autosave handles ONLY stream-save (isDirty state) and beacon fallback.

import { ref, onUnmounted, computed, type Ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useWBStore } from '../board/state/boardStore'
import { winterboardApi } from '../api/winterboardApi'
import type { WBSyncStatus } from '../types/winterboard'
import { isCircuitBreakerOpen } from '@/utils/apiClient'
import { useToast } from './useToast'

// ── Config ─────────────────────────────────────────────────────────────

const DEBOUNCE_MS = 3_000        // 3 seconds after last change
const MAX_WAIT_MS = 15_000       // Force save after 15s of continuous edits
const RETRY_BASE_MS = 1_000      // Exponential backoff base
const MAX_RETRIES = 3            // Max retry attempts
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
  /** @deprecated Always 0 — ops go through /replay/batch/ (useReplayRecorder) */
  pendingOpsCount: Ref<number>
  /** Force immediate save */
  saveNow: () => Promise<void>
  /** Cancel pending save */
  cancelPendingSave: () => void
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

  // Ops go through /replay/batch/ (useReplayRecorder) — autosave only stream/beacon.
  const pendingOpsCount = computed(() => 0)

  let debounceTimer: ReturnType<typeof setTimeout> | null = null
  let maxWaitTimer: ReturnType<typeof setTimeout> | null = null
  let cooldownTimer: ReturnType<typeof setTimeout> | null = null
  let retryCount = 0
  let destroyed = false
  let inCooldown = false  // True after all retries exhausted — prevents hammering dead server

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

  // ── Stream save ───────────────────────────────────────────────────

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
      store.setLastSaved(new Date())
      return true
    } catch (err: any) {
      const errStatus = err?.response?.status
      if (errStatus === 204) {
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
    if (!store.isDirty) return

    // REPLAY-INV-12: NEVER save during replay — replay operations are temporary
    // and must not overwrite the real board state on the server
    if (store.mode === 'replay') return

    clearTimers()
    isSaving.value = true
    status.value = 'syncing'
    store.setSyncStatus('syncing')
    lastError.value = null

    try {
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

      // Save failed
      if (store.isDirty) {
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

    showToast(t('winterboard.autosave.saveFailed'), 'error')

    // Circuit breaker: cooldown after total failure to prevent server overload
    inCooldown = true
    console.warn(`[WB:autosave] Entering cooldown for ${FAILURE_COOLDOWN_MS / 1000}s`)
    cooldownTimer = setTimeout(() => {
      inCooldown = false
      cooldownTimer = null
      console.info('[WB:autosave] Cooldown ended, will retry on next change')
      if (store.isDirty) {
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
        if (store.isDirty) {
          performSave()
        }
      }, MAX_WAIT_MS)
    }
  }

  // ── Public API ─────────────────────────────────────────────────────

  async function saveNow(): Promise<void> {
    clearTimers()
    await performSave()
  }

  function cancelPendingSave(): void {
    clearTimers()
  }

  // ── Watch store.isDirty for auto-scheduling ────────────────────────

  // G4 fix (2026-04-21): isDirty більше НЕ тригерить /save-stream/ у debounce.
  // Ops-log через /replay/batch/ (useReplayRecorder) = source of truth.
  // Persistence: ops-log + Celery worker apply_ops_and_snapshot + beacon on unload.
  // Manual saveNow() callers (record start, template save, nav away) залишаються
  // доступними через public API.
  //
  // Причина: /save-stream/ кожні 3 сек конкурував за WBSession row lock з
  // /replay/batch/ → 409 session_locked cascade (G3 у REPLAY_PIPELINE_SSOT).
  // Ref: saas_docs/domains/winterboard/REPLAY_PIPELINE_SSOT.md §6 G3+G4
  const stopDirtyWatch = () => { /* noop — kept for destroy() compatibility */ }

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
      if (store.isDirty) {
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
    if (!store.isDirty) return

    winterboardApi.beaconSave(sessionId.value, {
      state: store.serializedState,
      rev: store.rev,
      client_ts: new Date().toISOString(),
    })
  }

  function handleVisibilityChange(): void {
    if (document.visibilityState === 'hidden' && sessionId.value) {
      if (store.isDirty) {
        // G4 fix (2026-04-21): beacon достатній при tab-hidden.
        // Попередня версія викликала performSave() паралельно з beacon → race
        // з одночасним /replay/batch/ за WBSession lock → 409 cascade (G3).
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
    if (sessionId.value && store.isDirty) {
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
    destroy,
  }
}

// ── Utility ──────────────────────────────────────────────────────────

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

export default useAutosave
