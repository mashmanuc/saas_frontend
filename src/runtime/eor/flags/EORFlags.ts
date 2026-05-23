/**
 * EORFlags class — pure feature flag facade.
 *
 * SSOT: saas_docs/domains/winterboard/EDUCATIONAL_OBJECT_RUNTIME_SSOT.md §15
 *
 * **STRICT CONSTRAINTS** (per colleague review P1.d):
 *
 *   ALLOWED:
 *     - boot-time configuration загрузка
 *     - pure read methods
 *     - explicit precedence rules
 *
 *   FORBIDDEN:
 *     - runtime mutation
 *     - subscriptions / watchers / reactive store
 *     - hot updates
 *     - event emitters
 *
 * Migration law, NOT a product feature system. Instance is immutable
 * after construction.
 */

export interface EORFlagsConfig {
  readonly enabled: boolean
  readonly authoritativeTypes: ReadonlySet<string>
  readonly shadowTypes: ReadonlySet<string>
}

export class EORFlags {
  private readonly enabled: boolean
  private readonly authoritativeTypes: ReadonlySet<string>
  private readonly shadowTypes: ReadonlySet<string>

  constructor(config: EORFlagsConfig) {
    // Defensive freeze — instance is immutable after construction.
    this.enabled = config.enabled
    this.authoritativeTypes = config.authoritativeTypes
    this.shadowTypes = config.shadowTypes
    Object.freeze(this)
  }

  /**
   * Master switch — gates ALL EOR functionality.
   *
   * If false, isTypeEnabled() and isShadowEnabled() return false
   * regardless of type lists.
   */
  isEORuntimeEnabled(): boolean {
    return this.enabled
  }

  /**
   * True if EOR is authoritative for this EO type.
   *
   * Precedence rules (explicit per colleague review):
   *   1. enabled must be true (master switch)
   *   2. type must appear у authoritativeTypes
   */
  isTypeEnabled(eoType: string): boolean {
    if (!this.enabled) return false
    return this.authoritativeTypes.has(eoType)
  }

  /**
   * True if EOR observes this type у shadow mode (P2).
   *
   * Precedence rules:
   *   1. enabled must be true
   *   2. type must NOT be у authoritativeTypes (authoritative wins)
   *   3. type must appear у shadowTypes
   */
  isShadowEnabled(eoType: string): boolean {
    if (!this.enabled) return false
    // Authoritative wins over shadow — mutually exclusive.
    if (this.authoritativeTypes.has(eoType)) return false
    return this.shadowTypes.has(eoType)
  }
}
