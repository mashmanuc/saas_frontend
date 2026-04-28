// WB: Autosave composable for Winterboard
//
// Phase 2 (2026-04-27) FULL LEGACY CLEANUP per user directive:
//   ALL legacy write paths REMOVED. Single write pipeline:
//   UI → useReplayRecorder.record() → opsSyncStore.flush() → POST /replay/batch/
//
// DELETED у цьому refactor:
//   - performStreamSave() → POST /save-stream/  (LEGACY DUAL-WRITE pipeline)
//   - winterboardApi.streamSave() callsite
//   - winterboardApi.beaconSave() callsites (3×: beforeunload, visibility hidden, destroy)
//   - retryWithBackoff() з RETRY_BASE_MS exponential
//   - cooldown timer (FAILURE_COOLDOWN_MS) — opsSyncStore handles via DESYNC mode
//   - debounceTimer (DEBOUNCE_MS=3s) + maxWaitTimer (MAX_WAIT_MS=15s)
//   - online/offline + visibilitychange listeners (lifecycle handled by recorder + Pinia)
//   - HARD_LIMIT_BYTES + WARN_SIZE_BYTES payload checks (BE returns proper error codes)
//
// PRESERVED (backward-compat surface для consumers WBSoloRoom + WBClassroomRoom):
//   - export interface AutosaveReturn — same shape
//   - status / isSaving / saveCount / lastError / pendingOpsCount / saveNow / cancelPendingSave / destroy
//   - All methods now PROXY до opsSyncStore (single source of truth)
//
// Why composable kept (not deleted): consumers WBSoloRoom + WBClassroomRoom call
// `autosave.saveNow()` перед start-recording / template-save / nav-away. Цей flush
// trigger reused — тепер це opsSyncStore.flush() proxy. Saves boolean status у UI
// тепер reflect ops_sync state (inFlight = saving, DESYNC = error, SYNC empty = saved).

import { computed, ref, onUnmounted, type Ref } from 'vue'
import type { WBSyncStatus } from '../types/winterboard'
import { useOpsSyncStore, DesyncError } from '../stores/opsSyncStore'

// ── Types ──────────────────────────────────────────────────────────────

export interface AutosaveReturn {
  /** Current save status — derived from opsSyncStore.mode + inFlight count. */
  status: Ref<WBSyncStatus>
  /** True while opsSyncStore.flush() in progress (inFlightOps non-empty). */
  isSaving: Ref<boolean>
  /** Cumulative successful flushes since mount. */
  saveCount: Ref<number>
  /** Last error message — populated on flush failure. */
  lastError: Ref<string | null>
  /** @deprecated Always 0 — ops через opsSyncStore.pendingOps (consumed by recorder). */
  pendingOpsCount: Ref<number>
  /** Force immediate flush via opsSyncStore. */
  saveNow: () => Promise<void>
  /** No-op (debounce/timer logic moved to recorder + store). Kept for backward-compat. */
  cancelPendingSave: () => void
  /** Cleanup (unmount listeners). Store state persists per Pinia singleton. */
  destroy: () => void
}

// ── Composable ─────────────────────────────────────────────────────────

export function useAutosave(
  _sessionId: Ref<string | null>,
  options?: {
    onSaved?: () => void
    disabled?: Ref<boolean>
  },
): AutosaveReturn {
  const opsSync = useOpsSyncStore()

  // Local state — UI status derivation
  const saveCount = ref(0)
  const lastError = ref<string | null>(null)
  let _destroyed = false

  // ── Derived status ──
  // Status maps store mode + inFlight count → UI WBSyncStatus enum:
  //   DESYNC  → 'error' (UI shows DesyncRecoveryBanner / ProtocolMismatchModal)
  //   inFlightOps non-empty → 'syncing' (POST in progress)
  //   pendingOps non-empty → 'syncing' (waiting for next flush tick)
  //   SYNC + empty buffers → 'saved' (after at least 1 successful flush)
  //   BOOTSTRAP / pre-first-flush → 'idle'
  const status = computed<WBSyncStatus>(() => {
    if (opsSync.isDesync) return 'error'
    if (opsSync.inFlightOps.length > 0 || opsSync.pendingOps.length > 0) {
      return 'syncing'
    }
    return saveCount.value > 0 ? 'saved' : 'idle'
  })

  const isSaving = computed(() => opsSync.inFlightOps.length > 0)
  const pendingOpsCount = computed(() => 0)  // backward-compat: ops belong to recorder

  // ── Public API ──

  async function saveNow(): Promise<void> {
    if (_destroyed) return
    if (options?.disabled?.value) return
    try {
      await opsSync.flush()
      saveCount.value++
      lastError.value = null
      options?.onSaved?.()
    } catch (err) {
      if (err instanceof DesyncError) {
        // Store handles UI gates (modal/banner) via mode watch — caller sees status='error'
        lastError.value = err.message
        return  // don't re-throw — saveNow callers (template-save button etc.) treat
                // DESYNC як non-critical, UI tells user to reload/retry
      }
      lastError.value = (err as Error)?.message ?? 'Unknown save error'
      throw err  // network/other errors propagate to caller (existing behavior)
    }
  }

  function cancelPendingSave(): void {
    // No-op — Phase 2 cleanup. Debounce/timer logic moved to recorder + store.
    // Existing callers (none currently grepped) treat як best-effort cancel.
  }

  function destroy(): void {
    _destroyed = true
    // No timers / listeners / observers to cleanup post-Phase-2 cleanup.
    // opsSyncStore state survives (Pinia singleton); reset() called from
    // forceLogout / setAuth({access:null}) paths окремо.
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

export default useAutosave
