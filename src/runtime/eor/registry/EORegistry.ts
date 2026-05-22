/**
 * EORegistry — type catalog for Educational Object Definitions.
 *
 * SSOT: saas_docs/domains/winterboard/EDUCATIONAL_OBJECT_RUNTIME_SSOT.md §9.1
 *
 * STATUS: P1.b — compiler-time catalog, NOT runtime system.
 *
 * Per MIG-INV-8 Dead Infrastructure principle and user mental model
 * "compiler-time catalog vs runtime system":
 *
 *   - Pure data structure (Map<type, EOD>)
 *   - Pure lookup helpers
 *   - NO global instance / singleton (consumers construct registry locally
 *     for tests; production wiring deferred to P2+)
 *   - NO Vue provide/inject
 *   - NO WBCanvas hooks
 *   - NO lazy loading / dynamic imports
 *   - NO event bus integration
 *
 * Just a typed Map with safety invariants.
 */

import type { Capability } from '../types/capabilities'
import type { EducationalObjectDefinition } from '../types/eo-definition'

/**
 * Frozen / readonly EOD — same as input, but signals to consumers that
 * mutation is forbidden (and runtime will reject via deep-freeze).
 */
export type FrozenEOD = Readonly<EducationalObjectDefinition>

/**
 * Recursively freeze object to enforce immutability guard.
 *
 * Per registry tests requirement: returned definition MUST be readonly —
 * capability set, transport config, adapter refs all frozen so that
 * runtime-side mutation of EOD throws у dev (strict mode) і silently
 * fails у prod (browser behavior на frozen object writes).
 *
 * Limited recursion: freezes own enumerable properties + nested objects.
 * Skips functions and prototype chain.
 */
function deepFreeze<T>(obj: T): Readonly<T> {
  if (obj === null || typeof obj !== 'object') return obj
  if (Object.isFrozen(obj)) return obj
  Object.freeze(obj)
  for (const key of Object.getOwnPropertyNames(obj)) {
    const value = (obj as Record<string, unknown>)[key]
    if (value && typeof value === 'object' && !Object.isFrozen(value)) {
      deepFreeze(value)
    }
  }
  return obj
}

/**
 * EORegistry — typed Map catalog with safety invariants.
 *
 * Construct directly for tests and dev wiring:
 *
 *   const registry = new EORegistry()
 *   registry.register(trigSolverEOD)
 *   const eod = registry.get('trig_solver')
 *
 * Production singleton wiring deferred to later phase (NOT P1).
 */
export class EORegistry {
  // Hidden Map storage. Type discriminator = EOD.type field.
  private readonly definitions = new Map<string, FrozenEOD>()

  /**
   * Register an EOD. Type field is the catalog key.
   *
   * INVARIANT: duplicate registration is hard-fail (no silent overwrite,
   * no warning — throws). Per user spec: "invariant violation, throw error".
   *
   * INVARIANT: EOD is deep-frozen on registration — runtime cannot mutate
   * capability set, transport config, or adapter references. Mutation
   * attempts throw у strict mode (TypeError у Vitest / Jest).
   */
  register(eod: EducationalObjectDefinition): void {
    const type = eod.type
    if (this.definitions.has(type)) {
      throw new Error(
        `EORegistry: duplicate registration of EO type '${type}'. ` +
          `Each EO type can only be registered once.`,
      )
    }
    this.definitions.set(type, deepFreeze(eod) as FrozenEOD)
  }

  /**
   * Get EOD by type. Returns undefined if not registered.
   *
   * Returned EOD is frozen — consumers MUST NOT attempt mutation.
   */
  get(type: string): FrozenEOD | undefined {
    return this.definitions.get(type)
  }

  /**
   * Check if EOD type is registered.
   */
  has(type: string): boolean {
    return this.definitions.has(type)
  }

  /**
   * List all registered EO types.
   *
   * Returns a fresh array (caller may not mutate internal Map keys).
   * Order = insertion order (Map invariant).
   */
  listTypes(): readonly string[] {
    return Array.from(this.definitions.keys())
  }

  /**
   * Check if EOD of given type has a specific capability.
   *
   * SAFETY INVARIANT: unknown type returns false, NEVER throws.
   * Per user spec: hasCapability(unknownType, ...) === false. Allows
   * callers to defensively query capabilities without first checking
   * has(type).
   */
  hasCapability(type: string, capability: Capability): boolean {
    const eod = this.definitions.get(type)
    if (!eod) return false
    return eod.capabilities.has(capability)
  }

  /**
   * Number of registered EO types. Primarily for tests + diagnostics.
   */
  size(): number {
    return this.definitions.size
  }
}
