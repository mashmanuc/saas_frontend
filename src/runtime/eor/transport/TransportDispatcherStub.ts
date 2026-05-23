/**
 * TransportDispatcherStub — placeholder marker, NOT a dispatcher.
 *
 * SSOT §4.4. **Zero execution path** per colleague review P1.e.
 *
 *   ALLOWED:
 *     - interface declaration
 *     - no-op implementation marker
 *
 *   FORBIDDEN (deferred to P2+ activation):
 *     - dispatcher runtime
 *     - routing logic
 *     - policy execution
 *     - policy composition engine
 *     - queueing / buffering
 *     - actual op emission to WBBoardOperation
 *
 * This stub exists so that EOR substrate code can compile / type-check
 * against `TransportDispatcher` signature without any execution behavior.
 * Real dispatcher implementation lands у P2+ when first widget migrates.
 */

import type { EOpEnvelope } from '../types/op-envelope'
import type { TransportDispatcher } from '../types/transport'

/**
 * Stub dispatcher — explicitly throws if called.
 *
 * Per MIG-INV-8 Dead Infrastructure: P1 substrate must NOT execute any
 * production code path. Calling this dispatcher = bug у current phase
 * (should not happen because no EOD activated yet).
 *
 * Throws у dev to catch accidental wiring; у prod would also throw —
 * это deliberate Dead Infrastructure guard.
 */
export const dispatcherStub: TransportDispatcher = (op: EOpEnvelope): void => {
  throw new Error(
    `EOR TransportDispatcherStub invoked unexpectedly у P1 dead-infrastructure phase. ` +
      `op_type=${op.op_type} instance_id=${op.instance_id}. ` +
      `Real dispatcher lands у P2+ activation; if you see this у P1, ` +
      `something accidentally wired the substrate into a production path.`,
  )
}
