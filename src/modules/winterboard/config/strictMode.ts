/**
 * P0: STRICT_MODE - Frontend State Invariants
 * 
 * Invariant: All mutations go through ops (single source of truth)
 * - No direct state mutations
 * - No hidden mutations via reactivity
 * - Transient state isolated from persistence
 */

import { isReplayMode, guardNoMutation } from './replayMode'

interface StrictModeState {
  enabled: boolean
  mutationLog: string[]
  maxLogSize: number
}

const state: StrictModeState = {
  enabled: false,  // P0: DISABLED by default - log only, no enforce
  mutationLog: [],
  maxLogSize: 100
}

/**
 * Enable strict mode (production default)
 */
export function enableStrictMode(): void {
  state.enabled = true
  console.log('[STRICT_MODE] Enabled')
}

/**
 * Disable strict mode (emergency only)
 */
export function disableStrictMode(): void {
  state.enabled = false
  console.warn('[STRICT_MODE] DISABLED - this is an emergency override')
}

/**
 * Check if strict mode is active
 */
export function isStrictMode(): boolean {
  return state.enabled
}

/**
 * Guard: enforce mutation via ops only
 * 
 * Call at entry points that might cause state mutation
 */
export function enforceMutationViaOps(
  context: string,
  hasOp: boolean = false
): void {
  // Check replay mode first
  guardNoMutation(context)
  
  if (!hasOp) {
    // ALWAYS log mutation attempts for analysis
    logMutationAttempt(context)
    
    // Phase 1: Log only (default, safe)
    console.warn(
      `[STRICT_MODE] Direct mutation detected: ${context}. ` +
      `Logged for analysis. Enable STRICT_MODE after fixing all violations.`
    )
    
    // Phase 2: Enforce (after all violations fixed)
    if (state.enabled) {
      if (import.meta.env.DEV) {
        throw new Error(
          `[STRICT_MODE] Direct mutation detected: ${context}. ` +
          `All mutations must go through ops.`
        )
      } else {
        console.error(
          `[STRICT_MODE] ENFORCING: Direct mutation blocked: ${context}`
        )
      }
    }
  }
}

/**
 * Log mutation attempt for debugging
 */
function logMutationAttempt(context: string): void {
  state.mutationLog.push(`${new Date().toISOString()}: ${context}`)
  
  if (state.mutationLog.length > state.maxLogSize) {
    state.mutationLog.shift()
  }
}

/**
 * Get mutation log for debugging
 */
export function getMutationLog(): string[] {
  return [...state.mutationLog]
}

/**
 * Clear mutation log
 */
export function clearMutationLog(): void {
  state.mutationLog = []
}

/**
 * Guard: transient state isolation
 * 
 * Ensures UI state doesn't leak to persistence
 */
export function guardTransientIsolation(
  stateKey: string,
  isTransient: boolean
): void {
  if (!state.enabled) {
    return
  }
  
  const transientKeys = [
    'selection', 'hover', 'cursor', 'activeTool',
    'tempSelection', 'dragState', 'resizeHandle'
  ]
  
  const isTransientKey = transientKeys.some(k => stateKey.includes(k))
  
  if (isTransientKey && !isTransient) {
    console.warn(
      `[STRICT_MODE] Transient key "${stateKey}" may leak to persistence. ` +
      `Ensure sanitize_snapshot() removes this.`
    )
  }
}

/**
 * Create strict wrapper for store mutations
 * 
 * Usage: wrapMutation('context', originalFunction)
 */
export function wrapMutation<T extends (...args: any[]) => any>(
  context: string,
  fn: T
): T {
  return ((...args: any[]) => {
    // Check if this is an op-based mutation
    const hasOp = args.some(arg => 
      arg && typeof arg === 'object' && 
      (arg.op_id || arg.opType || arg.seq !== undefined)
    )
    
    enforceMutationViaOps(context, hasOp)
    
    return fn(...args)
  }) as T
}
