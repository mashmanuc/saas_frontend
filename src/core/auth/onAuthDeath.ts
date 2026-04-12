// P0.0: Atomic auth death handler
// When auth dies (refresh fails, session expired), ALL subsystems must stop IMMEDIATELY.
// No partial cleanup — everything stops atomically.
//
// INVARIANT:
// System recovery currently depends on full Vue remount via router navigation.
// If silent auth recovery is introduced — this module MUST implement re-init hooks.
//
// Usage:
//   import { registerAuthDeathCleanup, onAuthDeath } from '@/core/auth/onAuthDeath'
//
//   // In any subsystem (WS, recorder, store):
//   const unregister = registerAuthDeathCleanup(() => { myService.stop() })
//
//   // In forceLogout:
//   onAuthDeath()

type CleanupFn = () => void

const _registry = new Set<CleanupFn>()
let _dead = false

/**
 * Register a cleanup callback that will be called on auth death.
 * Returns an unregister function — call it on component unmount.
 */
export function registerAuthDeathCleanup(fn: CleanupFn): () => void {
  _registry.add(fn)
  return () => { _registry.delete(fn) }
}

/**
 * Atomic auth death: calls ALL registered cleanups synchronously.
 * Safe to call multiple times — subsequent calls are no-ops until reset.
 * Callbacks are idempotent by contract (disconnect checks ws !== null, etc.)
 */
export function onAuthDeath(): void {
  if (_dead) return
  _dead = true

  // P2.0: Track auth death event (fire-and-forget, must not block)
  import('../../utils/telemetryAgent').then(
    m => m.trackEvent('auth.death', { subsystems: _registry.size }),
  ).catch(() => {})

  for (const fn of _registry) {
    try {
      fn()
    } catch (err) {
      console.error('[onAuthDeath] cleanup threw:', err)
    }
  }
  // Don't clear registry — subsystems may re-register after re-login.
  // Zombie handlers (from leaked composables) are safe: all callbacks
  // check their own state (ws !== null, _destroyed, reconnectAborted).
}

/**
 * Reset death state (call after successful re-login).
 */
export function resetAuthDeath(): void {
  _dead = false
}

/**
 * Check if auth death has been triggered (for guards in retry loops).
 */
export function isAuthDead(): boolean {
  return _dead
}
