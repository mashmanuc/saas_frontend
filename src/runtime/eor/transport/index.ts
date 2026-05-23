/**
 * EOR Transport — public API barrel.
 *
 * P1.e: policy metadata contracts only. NO execution path.
 *
 *   Policy classes:    SnapshotPolicyImpl / ThrottledParamPolicyImpl /
 *                      DirectCallbackPolicyImpl (@deprecated)
 *   Dispatcher:        TransportDispatcherStub — throws if invoked
 *   Utilities:         assertKnownPolicyKind / serializePolicy / policyEquals
 *
 * Execution semantics (timers, scheduling, dispatch wiring) DO NOT
 * exist у P1. Real dispatcher implementation lands у P2+ activation.
 */

export {
  SnapshotPolicyImpl,
  MIN_SNAPSHOT_DEBOUNCE_MS,
  MAX_SNAPSHOT_DEBOUNCE_MS,
} from './SnapshotPolicyImpl'

export {
  ThrottledParamPolicyImpl,
  MIN_THROTTLE_RATE_MS,
  MAX_THROTTLE_RATE_MS,
} from './ThrottledParamPolicyImpl'

export { DirectCallbackPolicyImpl } from './DirectCallbackPolicyImpl'

export { dispatcherStub } from './TransportDispatcherStub'

export {
  assertKnownPolicyKind,
  serializePolicy,
  policyEquals,
} from './policy-utils'
