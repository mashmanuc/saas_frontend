import { ref, watch, onUnmounted, type Ref, type WatchSource } from 'vue'
import { soloApi } from '../api/soloApi'
import type { WorkspaceState } from '../types/solo'

export interface AutosaveOptions {
  debounceMs?: number
  maxWaitMs?: number
  enabled?: boolean
  onSaveStart?: () => void
  onSaveSuccess?: () => void
  onSaveError?: (error: Error) => void
}

export interface AutosaveStatus {
  isSaving: boolean
  lastSaved: Date | null
  lastError: Error | null
  pendingChanges: boolean
  saveCount: number
}

const DEFAULT_DEBOUNCE_MS = 2000 // 2 seconds
const DEFAULT_MAX_WAIT_MS = 10000 // 10 seconds max wait

export function useAutosave(
  sessionId: Ref<string | null>,
  state: Ref<WorkspaceState | null>,
  options: AutosaveOptions = {}
) {
  const {
    debounceMs = DEFAULT_DEBOUNCE_MS,
    maxWaitMs = DEFAULT_MAX_WAIT_MS,
    enabled = true,
    onSaveStart,
    onSaveSuccess,
    onSaveError,
  } = options

  // Status
  const status = ref<AutosaveStatus>({
    isSaving: false,
    lastSaved: null,
    lastError: null,
    pendingChanges: false,
    saveCount: 0,
  })

  // Internal state
  let debounceTimer: ReturnType<typeof setTimeout> | null = null
  let maxWaitTimer: ReturnType<typeof setTimeout> | null = null
  let lastChangeTime = 0
  let pendingState: WorkspaceState | null = null

  // Clear timers
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

  // Perform actual save
  async function performSave(): Promise<void> {
    if (!sessionId.value || !pendingState) {
      return
    }

    clearTimers()
    status.value.isSaving = true
    onSaveStart?.()

    try {
      // Clone state to avoid mutation during save
      const stateToSave = JSON.parse(JSON.stringify(pendingState))

      await soloApi.updateSession(sessionId.value, {
        state: stateToSave,
      })

      status.value.lastSaved = new Date()
      status.value.lastError = null
      status.value.pendingChanges = false
      status.value.saveCount++
      pendingState = null

      onSaveSuccess?.()

      // Log in dev mode
      if (import.meta.env?.DEV) {
        console.log(`[Autosave] Saved successfully (${status.value.saveCount} saves)`)
      }
    } catch (error) {
      const err = error instanceof Error ? error : new Error('Unknown error')
      status.value.lastError = err
      onSaveError?.(err)

      console.error('[Autosave] Save failed:', err)
    } finally {
      status.value.isSaving = false
    }
  }

  // Schedule save with debounce
  function scheduleSave(newState: WorkspaceState): void {
    if (!enabled || !sessionId.value) {
      return
    }

    pendingState = newState
    status.value.pendingChanges = true
    lastChangeTime = Date.now()

    // Clear existing debounce timer
    if (debounceTimer) {
      clearTimeout(debounceTimer)
    }

    // Set new debounce timer
    debounceTimer = setTimeout(() => {
      performSave()
    }, debounceMs)

    // Set max wait timer if not already set
    if (!maxWaitTimer) {
      maxWaitTimer = setTimeout(() => {
        if (pendingState) {
          performSave()
        }
      }, maxWaitMs)
    }
  }

  // Force immediate save
  async function saveNow(): Promise<void> {
    if (state.value) {
      pendingState = state.value
    }

    if (pendingState) {
      await performSave()
    }
  }

  // Cancel pending save
  function cancelPendingSave(): void {
    clearTimers()
    pendingState = null
    status.value.pendingChanges = false
  }

  // Watch state changes
  const stopWatch = watch(
    () => state.value,
    (newState) => {
      if (newState && enabled) {
        scheduleSave(newState)
      }
    },
    { deep: true }
  )

  // Handle page visibility change (save before tab close)
  function handleVisibilityChange(): void {
    if (document.visibilityState === 'hidden' && pendingState) {
      // Try to save synchronously before page unload
      performSave()
    }
  }

  // Handle before unload
  function handleBeforeUnload(event: BeforeUnloadEvent): void {
    if (status.value.pendingChanges) {
      event.preventDefault()
      event.returnValue = 'You have unsaved changes. Are you sure you want to leave?'
    }
  }

  // Setup event listeners
  if (typeof document !== 'undefined') {
    document.addEventListener('visibilitychange', handleVisibilityChange)
    window.addEventListener('beforeunload', handleBeforeUnload)
  }

  // Cleanup on unmount
  onUnmounted(() => {
    clearTimers()
    stopWatch()

    if (typeof document !== 'undefined') {
      document.removeEventListener('visibilitychange', handleVisibilityChange)
      window.removeEventListener('beforeunload', handleBeforeUnload)
    }

    // Final save if pending
    if (pendingState && sessionId.value) {
      performSave()
    }
  })

  return {
    // Status
    status,

    // Methods
    saveNow,
    cancelPendingSave,
    scheduleSave,

    // Computed helpers
    get isSaving() {
      return status.value.isSaving
    },
    get hasPendingChanges() {
      return status.value.pendingChanges
    },
    get lastSavedAt() {
      return status.value.lastSaved
    },
  }
}

// Utility: Format last saved time
export function formatLastSaved(date: Date | null): string {
  if (!date) return 'Never'

  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffSec = Math.floor(diffMs / 1000)
  const diffMin = Math.floor(diffSec / 60)

  if (diffSec < 5) return 'Just now'
  if (diffSec < 60) return `${diffSec}s ago`
  if (diffMin < 60) return `${diffMin}m ago`

  return date.toLocaleTimeString()
}

export default useAutosave
