/**
 * Module-level flags facade — boot-time loaded EORFlags instance.
 *
 * SSOT §15. Reads from Vite build-time env vars at import time.
 *
 * STRICT: boot-time only. NO hot reload, NO mutation, NO subscriptions.
 *
 * For tests — construct an EORFlags instance directly з the class
 * (see EORFlags.ts). Do NOT mutate the default module-level instance.
 */

import { EORFlags } from './EORFlags'
import type { EORFlagsConfig } from './EORFlags'

/**
 * Parse comma-separated env string into Set. Trims whitespace, drops empties.
 *
 *   parseTypeList('trig_solver, helix') → Set(['trig_solver', 'helix'])
 *   parseTypeList('') → Set()
 *   parseTypeList(undefined) → Set()
 */
function parseTypeList(value: string | undefined): ReadonlySet<string> {
  if (!value) return new Set<string>()
  const items = value
    .split(',')
    .map((s) => s.trim())
    .filter((s) => s.length > 0)
  return new Set<string>(items)
}

/**
 * Read env var value, with default fallback.
 *
 * Vite exposes env at `import.meta.env.VITE_*`. At runtime у browser these
 * are inlined at build time — flags effectively boot-time configuration.
 */
function readEnv(key: string, fallback: string): string {
  // import.meta.env may be undefined у test environment without Vite setup.
  // Default fallback is the source of truth у that case.
  const env = (import.meta as { env?: Record<string, string | undefined> }).env
  return env?.[key] ?? fallback
}

/**
 * Boot-time config loader. Pure — reads env once at module import.
 */
function loadFlagsFromEnv(): EORFlagsConfig {
  const enabled = readEnv('VITE_EO_RUNTIME_ENABLED', 'false') === 'true'
  return {
    enabled,
    authoritativeTypes: parseTypeList(readEnv('VITE_EO_RUNTIME_TYPES', '')),
    shadowTypes: parseTypeList(readEnv('VITE_EO_RUNTIME_SHADOW_TYPES', '')),
  }
}

/**
 * The default module-level flags instance.
 *
 * Loaded once at module import (boot-time). All exported functions delegate
 * to this instance. Immutable.
 */
export const defaultFlags = new EORFlags(loadFlagsFromEnv())

// ─── Public function API (delegates to defaultFlags) ─────────────────────

export function isEORuntimeEnabled(): boolean {
  return defaultFlags.isEORuntimeEnabled()
}

export function isTypeEnabled(eoType: string): boolean {
  return defaultFlags.isTypeEnabled(eoType)
}

export function isShadowEnabled(eoType: string): boolean {
  return defaultFlags.isShadowEnabled(eoType)
}

// ─── Helpers exposed for tests / advanced consumers ──────────────────────

/**
 * Parse env list value into Set. Exported for test setup що mocks env
 * differently.
 */
export { parseTypeList }
