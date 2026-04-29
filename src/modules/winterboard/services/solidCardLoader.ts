/**
 * Phase O PR-O2: Lazy loader для Three.js + SolidCard widget.
 *
 * Ref:
 * - saas_docs/domains/winterboard/phase_O_solid_objects/PLAN.md PR-O2
 * - saas_docs/domains/winterboard/WINTERBOARD_SSOT.md §3.7.1
 *
 * Why singleton: уникає повторного download великого Three.js bundle
 * та повторного виконання IIFE у vendor/solidCard.js (яке навішує
 * `window.SolidCard` constructor). First call resolves promise, всі
 * наступні reuse same Promise.
 *
 * Why dynamic import: Three.js ~500KB. Завантажуємо ТІЛЬКИ коли board
 * actually renders solid asset (CHECKPOINT 1: Three.js NOT у main chunk).
 *
 * Why window.THREE side-channel: vendored solid-card.js — це IIFE яке
 * читає `window.THREE` (legacy script style, NOT modified per SSOT
 * adapter pattern). Loader робить bridge between ES module import + IIFE.
 */

// Restricted SolidCard surface — ONLY constructor + set + destroy (per SSOT
// §3.7.1 adapter HARD RULE). Internal methods (`_apply`, `_buildSolid`,
// `rebuild`, `toggleFullscreen`) intentionally NOT exposed.
export interface SolidCardInstance {
  set(key: string, value: unknown): void
  destroy(): void
}

export interface SolidCardConstructor {
  new (container: HTMLElement, opts: { type: string }): SolidCardInstance
}

let _loader: Promise<{ SolidCard: SolidCardConstructor }> | null = null

export function loadSolidCard(): Promise<{ SolidCard: SolidCardConstructor }> {
  if (!_loader) {
    _loader = (async () => {
      // 1. Завантажити Three.js (ESM) → assign на window для legacy IIFE
      const THREE = await import('three')
      // Vendor IIFE reads `window.THREE` (default + namespace exports merge).
      // Cast through unknown — `window` augmentation у solidCard.d.ts.
      ;(globalThis as unknown as { THREE: unknown }).THREE = THREE

      // 2. Завантажити vendor IIFE — виконається + assign window.SolidCard.
      // Side-effect import: import path триггерує IIFE.
      await import('../vendor/solidCard.js')

      const ctor = (globalThis as unknown as { SolidCard?: SolidCardConstructor })
        .SolidCard
      if (!ctor) {
        throw new Error(
          'solidCardLoader: SolidCard constructor not found on globalThis after vendor import',
        )
      }
      return { SolidCard: ctor }
    })()
  }
  return _loader
}

/**
 * Test-only reset (unit tests reseed loader). NOT exported у production
 * surface — only spec files import this via direct path.
 */
export function _resetSolidCardLoaderForTests(): void {
  _loader = null
}
