/**
 * Phase RS PR-RS-ENF-1: Frontend runtime invariant guard layer.
 *
 * Single source for emitting INVARIANT VIOLATION events from FE:
 *   1. console.error з standardized format
 *      `[INVARIANT VIOLATION] INV-<CODE> <details> <context>`
 *   2. trackEvent('invariant.violation', { code, details, ...context })
 *      → BE telemetry pipeline → Prometheus bridge (PR-RS-E4) →
 *        wb_invariant_violations_total{invariant=<code>, source="fe"}.inc()
 *
 * Used by FE Phase RS code points що enforce INV-* invariants. NEVER use raw
 * `console.error("[INVARIANT VIOLATION]")` strings — CI grep gate (PR-RS-ENF-2)
 * блокує stray strings поза this module.
 *
 * Backend equivalent: `backend/apps/core/invariant_guard.py:violate()` (emits
 * directly to wb_invariant_violations_total з source="be").
 *
 * Examples:
 *   import { violate } from '@/utils/invariantGuard'
 *
 *   // FE-1: WebGL contexts exceeded
 *   if (activeContexts > 2) {
 *     violate('FE-1', 'WebGL contexts exceeded 2', { count: activeContexts })
 *   }
 *
 *   // FE-4: loader stuck
 *   if (loaderActive && Date.now() - loaderStartedAt > 15000) {
 *     violate('FE-4', 'loader.start() без matching stop()',
 *             { active_count: loaderActive, started_ms_ago: ... })
 *   }
 */

export interface ViolateContext {
  [key: string]: string | number | boolean | null | undefined
}

/**
 * Emit invariant violation: standardized log + telemetry event.
 *
 * @param invariantCode Plain code БЕЗ "INV-" префіксу (e.g. 'FE-1', 'FE-5').
 * @param details Human-readable description.
 * @param context Extra structured fields (session_id, count, duration_ms, etc.)
 *
 * Side effects:
 *   1. console.error — ALWAYS emits з standardized format
 *   2. trackEvent('invariant.violation', { code, details, ...context })
 *      via existing telemetryAgent (10s flush, 50/100KB batch, 10/min rate limit)
 *
 * NB: Helper does NOT throw — invariant violations are observability,
 * NOT control flow. Caller продовжує execution + handles fallback самостійно.
 */
export function violate(
  invariantCode: string,
  details: string,
  context?: ViolateContext,
): void {
  if (!invariantCode || !details) {
    // Defensive: incomplete violations НЕ emit (would create unhelpful noise).
    console.warn(
      '[invariantGuard] violate() called з incomplete args:',
      { code: invariantCode, details },
    )
    return
  }

  // 1. Standardized console output (gripped by FE log viewers + Sentry).
  const ctxStr = context
    ? Object.entries(context).map(([k, v]) => `${k}=${v}`).join(' ')
    : ''
  console.error(
    `[INVARIANT VIOLATION] INV-${invariantCode} ${details}${ctxStr ? ' ' + ctxStr : ''}`,
  )

  // 2. Telemetry event → BE bridge → Prometheus counter.
  // Lazy-import telemetryAgent щоб уникнути circular deps + bundling overhead
  // якщо invariantGuard imported у very early init paths.
  // Fail-open: telemetry failure НЕ блокує caller (logged + dropped).
  import('./telemetryAgent')
    .then(m => {
      try {
        m.trackEvent('invariant.violation', {
          code: invariantCode,
          details,
          ...(context || {}),
        })
      } catch (err) {
        // Telemetry agent threw — secondary failure, log + continue.
        console.warn('[invariantGuard] trackEvent failed:', err)
      }
    })
    .catch(err => {
      // Module load failed — extremely rare. Log + continue.
      console.warn('[invariantGuard] telemetryAgent import failed:', err)
    })
}
