/**
 * Phase O PR-O2: Lazy loader для Three.js + SolidCard widget.
 *
 * Ref:
 * - saas_docs/domains/winterboard/phase_O_solid_objects/PLAN.md PR-O2
 * - saas_docs/domains/winterboard/WINTERBOARD_SSOT.md §3.7.1
 *
 * P0 fix 2026-04-29: switched from `await import('three')` (dynamic) to
 * `import * as THREE from 'three'` (static). Reason: у Vite production
 * dynamic namespace had unstable shape — vendor IIFE saw `window.THREE`
 * with `WebGLRenderer` undefined → silent fail. Static import guarantees
 * canonical ESM namespace.
 *
 * Lazy loading preserved: solidCardLoader.ts is itself dynamically-imported
 * by SolidCardRenderer.vue (which is conditionally rendered tільки коли
 * board has geometry_solid asset). Vite manualChunks rule:
 *   if (id.includes('node_modules/three')) return 'vendor-three'
 * → Three.js stays у separate chunk, loaded only коли цей file imported.
 *
 * Why window.THREE side-channel: vendored solid-card.js — це IIFE яке
 * читає `window.THREE` (legacy script style, NOT modified per SSOT
 * adapter pattern). Loader робить bridge between ES module import + IIFE.
 */
import * as THREE from 'three'

// Restricted SolidCard surface — ONLY constructor + set + destroy + rotate
// (per SSOT §3.7.1 adapter HARD RULE). Internal methods (`_apply`,
// `_buildSolid`, `rebuild`, `toggleFullscreen`) intentionally NOT exposed.
//
// Phase O Task 2 — `rotate(dx, dy)` додано як public visual rotation API
// (викликається adapter'ом для ALT+drag overlay; НЕ емітує op).
export interface SolidCardInstance {
  set(key: string, value: unknown): void
  destroy(): void
  rotate(dx: number, dy: number): void
}

export interface SolidCardConstructor {
  new (container: HTMLElement, opts: { type: string }): SolidCardInstance
}

let _loader: Promise<{ SolidCard: SolidCardConstructor }> | null = null

export function loadSolidCard(): Promise<{ SolidCard: SolidCardConstructor }> {
  if (!_loader) {
    _loader = (async () => {
      // 1. Three.js — static-imported above (canonical namespace),
      //    assign на window для legacy IIFE bridge.
      ;(globalThis as unknown as { THREE: typeof THREE }).THREE = THREE

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
