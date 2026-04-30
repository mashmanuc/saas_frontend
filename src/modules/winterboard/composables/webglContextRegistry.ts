/**
 * Phase RS PR-RS-C1.2 (2026-05-01): shared WebGL context counter registry.
 *
 * Single source of truth для INV-FE-1 enforcement (≤2 active WebGL contexts).
 * Both `useThreeRenderer` (managed renderers) AND `useSolidCardRenderer`
 * (vendor adapter) call register()/unregister() — counter aggregated.
 *
 * Why module-level: vendor `solidCard.js` IIFE has its own renderer creation
 * pipeline що bypass useThreeRenderer composable. Single counter у shared
 * module = consistent INV-FE-1 detection regardless of WHERE renderer
 * created.
 *
 * Reference: saas_docs/domains/winterboard/phase_RS_runtime_stability/PLAN.md
 *            SECTION C
 */

import { trackEvent } from '@/utils/telemetryAgent'
import { violate } from '@/utils/invariantGuard'

const MAX_CONTEXTS = 2  // INV-FE-1 ceiling — primary board + 1 popup

let _count = 0

function _emit(): void {
  // FE telemetry → BE bridge maps до wb_active_webgl_contexts Gauge
  // (PR-RS-E4 deferred — events stored у Postgres TelemetryEvent table).
  try {
    trackEvent('wb.webgl.active', { count: _count })
  } catch {
    // telemetry failure non-fatal
  }
  if (_count > MAX_CONTEXTS) {
    violate('FE-1', 'WebGL contexts exceeded ceiling', {
      count: _count,
      max: MAX_CONTEXTS,
    })
  }
}

/** Register new active WebGL context. Increments counter + emits telemetry. */
export function register(): void {
  _count += 1
  _emit()
}

/** Unregister WebGL context (on disposal). Counter floor 0 (fail-safe). */
export function unregister(): void {
  _count = Math.max(0, _count - 1)
  _emit()
}

/** Read current active count (read-only access для diagnostics). */
export function getCount(): number {
  return _count
}

// ─── Test-only helpers (do NOT use у production paths) ─────────────────────

/** @internal Reset state for unit tests (singleton across runs). */
export function __testOnly_reset(): void {
  _count = 0
}

/** @internal Read raw count without telemetry side effects. */
export function __testOnly_count(): number {
  return _count
}
