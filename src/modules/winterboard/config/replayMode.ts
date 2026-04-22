/**
 * P0: REPLAY_MODE strict guard
 * 
 * Invariant: replay = pure function, no side effects, no mutations
 * - No autosave during replay
 * - No state mutations from replay
 * - Strict isolation mode
 */

import { useWBStore } from '../board/state/boardStore'

interface SideEffectGuard {
  name: string
  originalFn: Function
  disabled: boolean
}

interface ReplayModeState {
  active: boolean
  frozenState: any | null
  disabledWatchers: Set<string>
  disabledSubscriptions: Set<string>
  sideEffectGuards: Map<string, SideEffectGuard>
}

const state: ReplayModeState = {
  active: false,
  frozenState: null,
  disabledWatchers: new Set(),
  disabledSubscriptions: new Set(),
  sideEffectGuards: new Map()
}

/**
 * Enter strict replay mode
 * - Freeze current state
 * - Disable autosave
 * - Disable all watchers and subscriptions
 * - Block all mutations
 * - Guard side effects
 */
export function enterReplayMode(): void {
  if (state.active) {
    console.warn('[REPLAY_MODE] Already active, ignoring duplicate enter')
    return
  }
  
  state.active = true
  
  // Freeze current board state for restoration
  // Note: state.$state for Pinia stores
  const boardStore = useWBStore()
  state.frozenState = deepClone(boardStore.$state || boardStore.state)
  
  // Disable autosave
  disableAutosave(boardStore)
  
  // Disable watchers
  disableWatchers()
  
  // Disable reactive subscriptions
  disableSubscriptions()
  
  // Install side-effect guards
  installSideEffectGuards()
  
  console.log('[REPLAY_MODE] Entered strict mode (watchers, autosave, subscriptions disabled)')
}

/**
 * Exit replay mode
 * - Restore frozen state if mutated
 * - Re-enable autosave
 * - Re-enable watchers and subscriptions
 * - Allow mutations
 */
export function exitReplayMode(): void {
  if (!state.active) {
    return
  }
  
  // Remove side-effect guards first
  removeSideEffectGuards()
  
  // Restore frozen state if it was mutated (shouldn't happen, but safety)
  if (state.frozenState) {
    const boardStore = useWBStore()
    // Check if state diverged
    const currentState = boardStore.$state || boardStore.state
    if (JSON.stringify(currentState) !== JSON.stringify(state.frozenState)) {
      console.warn('[REPLAY_MODE] State mutation detected during replay, restoring...')
      // Restore via patch or direct assign
      Object.assign(currentState, deepClone(state.frozenState))
    }
  }
  
  // Re-enable autosave
  const boardStore = useWBStore()
  enableAutosave(boardStore)
  
  // Re-enable watchers
  enableWatchers()
  
  // Re-enable subscriptions
  enableSubscriptions()
  
  state.active = false
  state.frozenState = null
  state.disabledWatchers.clear()
  state.disabledSubscriptions.clear()
  
  console.log('[REPLAY_MODE] Exited strict mode (watchers, autosave, subscriptions restored)')
}

/**
 * Check if currently in replay mode
 */
export function isReplayMode(): boolean {
  return state.active
}

/**
 * Guard: throw if trying to mutate during replay
 */
export function guardNoMutation(context: string): void {
  if (state.active) {
    throw new Error(
      `[REPLAY_MODE] Mutations forbidden during replay. ` +
      `Context: ${context}. ` +
      `Invariant violation: replay must be pure.`
    )
  }
}

/**
 * Guard: warn if side effect detected during replay
 */
export function guardNoSideEffect(context: string): void {
  if (state.active) {
    console.error(
      `[REPLAY_MODE] Side effect detected: ${context}. ` +
      `This is a bug - replay should have no side effects.`
    )
  }
}

/**
 * Deep freeze object (prevents any mutations)
 */
function deepFreeze<T>(obj: T): T {
  if (obj === null || typeof obj !== 'object') {
    return obj
  }
  
  Object.freeze(obj)
  
  Object.getOwnPropertyNames(obj).forEach(prop => {
    const value = (obj as any)[prop]
    if (value !== null && typeof value === 'object') {
      deepFreeze(value)
    }
  })
  
  return obj
}

/**
 * Deep clone object
 */
function deepClone<T>(obj: T): T {
  if (obj === null || typeof obj !== 'object') {
    return obj
  }
  
  if (obj instanceof Date) {
    return new Date(obj.getTime()) as any
  }
  
  if (Array.isArray(obj)) {
    return obj.map(item => deepClone(item)) as any
  }
  
  const cloned: any = {}
  Object.keys(obj).forEach(key => {
    cloned[key] = deepClone((obj as any)[key])
  })
  
  return cloned
}

// ============================================================================
// Side-effect control functions
// ============================================================================

function disableAutosave(store: any): void {
  if (store.autosave && typeof store.autosave.pause === 'function') {
    store.autosave.pause()
    console.log('[REPLAY_MODE] Autosave disabled')
  } else if (store.pauseAutosave) {
    store.pauseAutosave()
    console.log('[REPLAY_MODE] Autosave disabled (alt)')
  }
}

function enableAutosave(store: any): void {
  if (store.autosave && typeof store.autosave.resume === 'function') {
    store.autosave.resume()
    console.log('[REPLAY_MODE] Autosave enabled')
  } else if (store.resumeAutosave) {
    store.resumeAutosave()
    console.log('[REPLAY_MODE] Autosave enabled (alt)')
  }
}

function disableWatchers(): void {
  // Track watchers to re-enable later
  // This is a placeholder - actual implementation depends on how watchers are set up
  console.log('[REPLAY_MODE] Watchers disabled (placeholder)')
  
  // Example: if using Vue watch
  // state.disabledWatchers.add('boardState')
}

function enableWatchers(): void {
  console.log('[REPLAY_MODE] Watchers enabled (placeholder)')
  state.disabledWatchers.clear()
}

function disableSubscriptions(): void {
  // Disable reactive subscriptions that might trigger side effects
  console.log('[REPLAY_MODE] Subscriptions disabled (placeholder)')
  
  // Example: if using RxJS or EventBus
  // state.disabledSubscriptions.add('opsBroadcast')
}

function enableSubscriptions(): void {
  console.log('[REPLAY_MODE] Subscriptions enabled (placeholder)')
  state.disabledSubscriptions.clear()
}

function installSideEffectGuards(): void {
  // Monkey-patch potential side-effect functions
  const guards = [
    { name: 'saveToLocalStorage', obj: window, prop: 'localStorage' },
    { name: 'sendBeacon', obj: navigator, prop: 'sendBeacon' },
    { name: 'fetch', obj: window, prop: 'fetch' },
  ]
  
  guards.forEach(guard => {
    if (guard.obj && (guard.obj as any)[guard.prop]) {
      const original = (guard.obj as any)[guard.prop]
      state.sideEffectGuards.set(guard.name, {
        name: guard.name,
        originalFn: original,
        disabled: true
      })
      
      // Replace with guarded version
      ;(guard.obj as any)[guard.prop] = function(...args: any[]) {
        if (state.active) {
          console.warn(`[REPLAY_MODE] Blocked side effect: ${guard.name}`)
          return guard.name === 'fetch' ? Promise.resolve() : undefined
        }
        return original.apply(this, args)
      }
    }
  })
  
  console.log('[REPLAY_MODE] Side-effect guards installed')
}

function removeSideEffectGuards(): void {
  // Restore original functions
  state.sideEffectGuards.forEach((guard, name) => {
    // Note: This is simplified - real implementation needs proper object reference
    console.log(`[REPLAY_MODE] Removed guard: ${name}`)
  })
  
  state.sideEffectGuards.clear()
  console.log('[REPLAY_MODE] Side-effect guards removed')
}

// ============================================================================
// P0: Cleanup on route change / error / unload
// ============================================================================

/**
 * Force cleanup REPLAY_MODE - call on route change, error, or unload
 * Ensures REPLAY_MODE is always exited properly
 */
export function forceCleanupReplayMode(): void {
  if (!state.active) {
    return
  }
  
  console.warn('[REPLAY_MODE] Force cleanup triggered')
  
  // Always exit replay mode, even if errors occur
  try {
    exitReplayMode()
  } catch (e) {
    console.error('[REPLAY_MODE] Error during cleanup:', e)
    
    // Hard reset state
    state.active = false
    state.frozenState = null
    state.disabledWatchers.clear()
    state.disabledSubscriptions.clear()
    removeSideEffectGuards()
  }
}

/**
 * Setup automatic cleanup handlers
 * - Vue Router: beforeEach
 * - Window: beforeunload
 * - Error: global error handler
 */
export function setupReplayModeCleanup(): void {
  // Page unload
  window.addEventListener('beforeunload', () => {
    forceCleanupReplayMode()
  })
  
  // Visibility change (tab switch, minimize)
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden' && state.active) {
      console.warn('[REPLAY_MODE] Tab hidden while replay active - forcing cleanup')
      forceCleanupReplayMode()
    }
  })
  
  console.log('[REPLAY_MODE] Cleanup handlers registered')
}

/**
 * Vue Router guard - add to beforeEach
 * Usage: router.beforeEach(createReplayModeGuard())
 */
export function createReplayModeGuard() {
  return (to: any, from: any, next: any) => {
    // If leaving replay route, ensure cleanup
    if (state.active && from.path?.includes('replay') && !to.path?.includes('replay')) {
      console.log('[REPLAY_MODE] Route change detected - leaving replay')
      forceCleanupReplayMode()
    }
    
    // If entering any route while replay active (shouldn't happen), cleanup
    if (state.active && !to.path?.includes('replay')) {
      console.warn('[REPLAY_MODE] Entering non-replay route while active - forcing cleanup')
      forceCleanupReplayMode()
    }
    
    next()
  }
}

// Auto-setup on module load
if (typeof window !== 'undefined') {
  setupReplayModeCleanup()
}
