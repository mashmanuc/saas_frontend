/**
 * InspectorBridgeRegistry — runtime-owned bridge map.
 *
 * Per user mandate (targeted correction sprint PP-4):
 *
 *   "Inspector reads from runtime-owned registry/state.
 *    Inspector does NOT create authoritative local state."
 *
 *   Most dangerous issue from P2.
 *
 *   STRICT:
 *     - No new infrastructure
 *     - No global reactive systems
 *     - Minimal ownership protocol
 *
 * ─── OWNERSHIP PROTOCOL (THE RULE) ─────────────────────────────────────
 *
 *   1. Runtime (via EORuntime, when wired) calls `set(instance_id, bridge)`
 *      AT MOUNT TIME ONLY. This is the single act of bridge creation.
 *
 *   2. Inspector component calls `get(instance_id)` to READ the bridge.
 *      Inspector NEVER calls `set`. Inspector NEVER stores own copy of
 *      bridge state.
 *
 *   3. On unmount, runtime calls `delete(instance_id)` exactly once.
 *
 *   4. Inspector subscribes via bridge.local (already reactive) — no
 *      separate ref/store. Production renderer should be refactored
 *      (P2.5+ authority transfer) to drop its own `registerTrigSolver`
 *      pattern and consume registry instead.
 *
 * ─── DEAD INFRASTRUCTURE NOTE ──────────────────────────────────────────
 *
 *   This class is dead unless explicitly invoked. Existing widget patterns
 *   (TrigSolverRenderer.vue creates bridge → registers у module-scoped
 *   trigSolverUiState) continue UNCHANGED. This registry exists as the
 *   target shape for future authority transfer migration.
 *
 *   §15.6 boundary respected — no existing widget file modified.
 */

import type { InspectorBridge } from '../types/inspector-bridge'

/**
 * Frozen / readonly view of a registered bridge. Same as input but
 * signals to consumers that bridge cannot be reassigned via registry
 * surface (mutations only через bridge's own action methods).
 */
export type RegisteredBridge<TState = unknown> = InspectorBridge<TState>

/**
 * Runtime-owned bridge registry. One per WBSession runtime instance
 * (when EO Runtime is eventually wired у P2.5+). Construct directly
 * для tests; production singleton wiring deferred.
 */
export class InspectorBridgeRegistry {
  private readonly bridges = new Map<string, RegisteredBridge<unknown>>()

  /**
   * Register a bridge for an EO instance.
   *
   * INVARIANT: only runtime calls this. Inspector MUST NOT call set().
   *
   * INVARIANT: duplicate registration is hard-fail (no overwrite).
   * Subsequent registration з same instance_id raises Error — protects
   * against accidental double-mount.
   */
  set<TState>(instance_id: string, bridge: InspectorBridge<TState>): void {
    if (!instance_id || typeof instance_id !== 'string') {
      throw new Error(
        `InspectorBridgeRegistry.set: instance_id must be non-empty string. ` +
          `Got: ${JSON.stringify(instance_id)}`,
      )
    }
    if (this.bridges.has(instance_id)) {
      throw new Error(
        `InspectorBridgeRegistry.set: bridge already registered для ` +
          `instance_id '${instance_id}'. Call delete() first or check mount lifecycle.`,
      )
    }
    this.bridges.set(instance_id, bridge as RegisteredBridge<unknown>)
  }

  /**
   * Read bridge by instance_id. Returns undefined if not registered.
   *
   * Inspector calls this. Renderer (post authority transfer) calls this
   * instead of creating own bridge.
   *
   * SAFETY: returns undefined for unknown id, NEVER throws.
   */
  get<TState = unknown>(instance_id: string): RegisteredBridge<TState> | undefined {
    return this.bridges.get(instance_id) as RegisteredBridge<TState> | undefined
  }

  /**
   * Check if bridge is registered.
   */
  has(instance_id: string): boolean {
    return this.bridges.has(instance_id)
  }

  /**
   * Unregister bridge. Called by runtime on unmount.
   *
   * Returns true if a bridge was actually removed.
   */
  delete(instance_id: string): boolean {
    return this.bridges.delete(instance_id)
  }

  /**
   * Number of registered bridges. Diagnostics / tests only.
   */
  size(): number {
    return this.bridges.size
  }

  /**
   * Clear all bridges. Tests only — production runtime never calls this
   * (unmount handled per-instance).
   */
  clear(): void {
    this.bridges.clear()
  }
}
