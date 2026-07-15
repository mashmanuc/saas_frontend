/**
 * Phase RS PR-RS-C1 (2026-05-01): centralized THREE.WebGLRenderer factory.
 *
 * INV-FE-5: `new THREE.WebGLRenderer` — ONLY through this composable.
 * Direct construction поза цим module блокується CI grep gate (PR-RS-ENF-2:
 * `frontend/.github/workflows/invariants.yml` + `.husky/pre-push`).
 *
 * INV-FE-1: ≤2 active WebGL contexts per session. Browser limit ~16 contexts;
 * leak fills quota → "Too many active WebGL contexts. Oldest context will be
 * lost" warnings + visual breakage. Counter tracks live contexts; >2 → emit
 * violate('FE-1').
 *
 * INV-FE-2: onUnmounted MUST dispose. Composable wraps lifecycle automatically:
 *   - renderer.dispose() — releases GL programs/textures/buffers
 *   - renderer.forceContextLoss() — explicit GL context release
 *   - scene.traverse(dispose) — cleanup attached geometry/material resources
 *
 * Vendor (`vendor/solidCard.js:87`) — legacy direct callsite, exempted у grep
 * gate by `/vendor/` filter. Migration до useThreeRenderer planned future phase.
 *
 * Reference: saas_docs/domains/winterboard/phase_RS_runtime_stability/PLAN.md
 *            SECTION C
 */

import * as THREE from 'three'
import { onUnmounted } from 'vue'
import { register, unregister } from './webglContextRegistry'

// PR-RS-C1.2: counter management delegated до webglContextRegistry — shared
// з useSolidCardRenderer (vendor adapter). Single source for INV-FE-1.

/**
 * Create THREE.WebGLRenderer з automatic disposal на onUnmounted.
 *
 * MUST be called within Vue setup() — uses onUnmounted lifecycle hook.
 * Calling outside setup() context → renderer created but NEVER disposed →
 * INV-FE-2 violation на app shutdown.
 *
 * @param canvas Target HTMLCanvasElement (must be mounted у DOM).
 * @param opts Optional THREE.WebGLRendererParameters override defaults.
 *             Default: { antialias: true, alpha: true }.
 *
 * @returns Configured THREE.WebGLRenderer. Caller responsible для:
 *   - setSize() / setPixelRatio() per viewport
 *   - render(scene, camera) calls
 *   - Setting `renderer.scene` IF wants auto-traverse-dispose (optional pattern).
 *
 * Side effects:
 *   - Increments _activeContexts → emits trackEvent('wb.webgl.active')
 *   - If count > 2 → emits violate('FE-1', ...)
 *   - Registers onUnmounted callback для full disposal pipeline
 */
export function useThreeRenderer(
  canvas: HTMLCanvasElement,
  opts?: THREE.WebGLRendererParameters,
): THREE.WebGLRenderer {
  const renderer = new THREE.WebGLRenderer({
    canvas,
    antialias: true,
    alpha: true,
    // 2026-07-15: без preserveDrawingBuffer WebGL-буфер очищується після
    // compositing → html2canvas/toDataURL знімає ЧОРНИЙ прямокутник
    // (board thumbnail + export capture). GraphMASH 3D вже роками живе
    // з цим прапором (vendor/graphmash3d/grapher-3d-engine.js) без скарг;
    // ціна — GPU-пам'ять одного буфера на віджет.
    preserveDrawingBuffer: true,
    ...opts,
  })

  register()

  onUnmounted(() => {
    try {
      // Traverse attached scene (caller-set `renderer.scene` pattern) —
      // dispose geometry/material resources. Optional — caller may not set
      // .scene; in that case skip traverse.
      const scene = (renderer as unknown as { scene?: THREE.Scene }).scene
      if (scene && typeof scene.traverse === 'function') {
        scene.traverse((obj: THREE.Object3D) => {
          // Type narrowing — Object3D має optional geometry/material у Mesh
          const mesh = obj as THREE.Mesh
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

      // Core GL release sequence (per Three.js docs)
      renderer.dispose()
      renderer.forceContextLoss()
    } finally {
      // Counter decrement always (fail-safe — навіть якщо disposal threw)
      unregister()
    }
  })

  return renderer
}
