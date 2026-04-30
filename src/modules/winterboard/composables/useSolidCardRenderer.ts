/**
 * Phase RS PR-RS-C1.2 (2026-05-01): Vue lifecycle adapter для vendor SolidCard.
 *
 * Vendor `vendor/solidCard.js` — IIFE без Vue lifecycle integration:
 *   - Creates `new THREE.WebGLRenderer` internally у `_initRenderer()`
 *   - Has `destroy()` method, але без `forceContextLoss()` + scene traverse
 *   - Bypassed counter / INV-FE-1 / INV-FE-2
 *
 * Adapter goals:
 *   1. Bind vendor lifecycle до Vue setup() / onUnmounted (INV-FE-2)
 *   2. Register/unregister context counter (INV-FE-1 via webglContextRegistry)
 *   3. Monkey-patch `SolidCard.prototype.destroy` ONCE щоб включити full
 *      disposal pipeline (scene traverse + forceContextLoss) — gaps relative
 *      до useThreeRenderer disposal contract.
 *
 * Vendor file ITSELF stays untouched (per scope) — only prototype patched
 * at runtime, idempotent (one-time guard).
 *
 * Reference: saas_docs/domains/winterboard/phase_RS_runtime_stability/PLAN.md
 *            SECTION C
 */

import { onUnmounted, ref, markRaw, type Ref } from 'vue'
import {
  loadSolidCard,
  type SolidCardInstance,
  type SolidCardConstructor,
} from '../services/solidCardLoader'
import { register, unregister } from './webglContextRegistry'

// ─── Vendor destroy() patch (monkey-patch once-only) ───────────────────────
//
// Vendor's `destroy()` (vendor/solidCard.js:610) calls лише renderer.dispose()
// + DOM cleanup. Missing relative до useThreeRenderer:
//   - scene traverse → geometry/material disposal (GPU memory leak)
//   - renderer.forceContextLoss() — explicit GL context release
//
// Patch wraps original destroy(): pre-traverse + call original + post-loss.
// Idempotent guard prevents double-patching on multiple adapter instances
// (multiple solid cards у sidebar all share same SolidCard.prototype).

let _destroyPatched = false

function _ensureDestroyPatch(SolidCard: SolidCardConstructor): void {
  if (_destroyPatched) return
  // Vendor IIFE class — access prototype via constructor.
  const proto = (SolidCard as unknown as { prototype?: Record<string, unknown> })
    .prototype
  if (!proto || typeof proto.destroy !== 'function') return

  const original = proto.destroy as (this: unknown) => void
  proto.destroy = function patchedDestroy(this: Record<string, unknown>): void {
    // 1. Pre-disposal: traverse scene → dispose geometry/materials
    try {
      const scene = this.scene as
        | { traverse?: (cb: (obj: Record<string, unknown>) => void) => void }
        | undefined
      if (scene && typeof scene.traverse === 'function') {
        scene.traverse((obj) => {
          const mesh = obj as {
            geometry?: { dispose?: () => void }
            material?: { dispose?: () => void } | Array<{ dispose?: () => void }>
          }
          if (mesh.geometry && typeof mesh.geometry.dispose === 'function') {
            mesh.geometry.dispose()
          }
          const mat = mesh.material
          if (Array.isArray(mat)) {
            mat.forEach((m) => {
              if (m && typeof m.dispose === 'function') m.dispose()
            })
          } else if (mat && typeof mat.dispose === 'function') {
            mat.dispose()
          }
        })
      }
    } catch {
      // pre-disposal failure non-fatal — original destroy() still runs
    }

    // 2. Vendor's original destroy() — calls renderer.dispose() + DOM cleanup
    try {
      original.call(this)
    } catch {
      // continue до forceContextLoss навіть якщо vendor destroy threw
    }

    // 3. Post-disposal: explicit GL context release (NOT у vendor)
    try {
      const renderer = this.renderer as
        | { forceContextLoss?: () => void }
        | undefined
      if (renderer && typeof renderer.forceContextLoss === 'function') {
        renderer.forceContextLoss()
      }
    } catch {
      // forceContextLoss failure non-fatal (browser may already have released)
    }
  } as typeof original
  _destroyPatched = true
}

// ─── Adapter composable ─────────────────────────────────────────────────────

export interface UseSolidCardRendererResult {
  /** Card instance ref (null до initialize() called OR після disposal). */
  cardRef: Ref<SolidCardInstance | null>
  /**
   * Async constructor: loads vendor, monkey-patches destroy ONCE,
   * creates SolidCard instance, registers context counter.
   *
   * MUST be called from onMounted() (or later) — needs container у DOM.
   *
   * @returns Card instance OR null якщо component unmounted під час await.
   */
  initialize: (container: HTMLElement) => Promise<SolidCardInstance | null>
}

/**
 * Vue lifecycle adapter для vendor SolidCard.
 *
 * Usage:
 *   const { cardRef, initialize } = useSolidCardRenderer({ type: 'cube' })
 *   onMounted(async () => {
 *     if (!container.value) return
 *     await initialize(container.value)
 *     // cardRef.value тепер available для set()/rotate() calls
 *   })
 *   // onUnmounted handled automatically — destroy() + counter unregister
 *
 * @param opts SolidCard constructor options (e.g. `{ type: 'cube' }`)
 */
export function useSolidCardRenderer(
  opts: { type: string },
): UseSolidCardRendererResult {
  const cardRef = ref<SolidCardInstance | null>(null)
  let _registered = false

  const initialize = async (
    container: HTMLElement,
  ): Promise<SolidCardInstance | null> => {
    const { SolidCard } = await loadSolidCard()
    // Component може unmount протягом await — guard.
    if (!container.isConnected) return null

    _ensureDestroyPatch(SolidCard)

    // markRaw: vendor SolidCard має internal class fields (renderer, scene,
    // mesh — THREE objects). Vue reactivity на цих об'єктах = perf disaster
    // (recursive Proxy wrapping). markRaw signals "do NOT reactify".
    const card = markRaw(new SolidCard(container, opts))
    cardRef.value = card
    register()
    _registered = true
    return card
  }

  onUnmounted(() => {
    if (cardRef.value) {
      try {
        // Patched destroy() pipeline: scene traverse → vendor original →
        // forceContextLoss. Counter unregister після (fail-safe finally).
        cardRef.value.destroy()
      } catch {
        // disposal failure non-fatal — counter still decrements
      }
      cardRef.value = null
    }
    if (_registered) {
      unregister()
      _registered = false
    }
  })

  return { cardRef, initialize }
}
