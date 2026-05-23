/**
 * Engine event vocabulary — canonical names only.
 *
 * P2-correction PP-6. Type-only contract. No event bus, no orchestration.
 */

export {
  EngineEvent,
  CANONICAL_ENGINE_EVENTS,
  isCanonicalEngineEvent,
} from './engine-events'
export type { EngineEventName } from './engine-events'
