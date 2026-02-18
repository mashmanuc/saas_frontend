// WB: Lazy Konva loader — dynamic import for bundle size optimization
// Ref: TASK_BOARD.md A6.1, ARCHITECTURE.md ADR-01
// Konva (~140KB min) is loaded on-demand when canvas mounts, not at app startup.

// 7.A1: Konva's default export type is incompatible with `mod.default ?? mod`
// pattern used in dynamic imports. Using `any` is intentional here — the only
// place in the codebase where `any` is allowed (documented exception to R7).
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type KonvaModule = any

// ─── Singleton cache ────────────────────────────────────────────────────────

let konvaModule: KonvaModule | null = null
let loadPromise: Promise<KonvaModule> | null = null

// ─── Public API ─────────────────────────────────────────────────────────────

/**
 * Lazy-load Konva module. Returns cached instance on subsequent calls.
 * Use in onMounted() of canvas components.
 *
 * @example
 * ```ts
 * const Konva = await loadKonva()
 * const stage = new Konva.Stage({ container, width, height })
 * ```
 */
export async function loadKonva(): Promise<KonvaModule> {
  if (konvaModule) return konvaModule

  if (!loadPromise) {
    loadPromise = import('konva').then((mod) => {
      konvaModule = (mod.default ?? mod) as KonvaModule
      return konvaModule
    })
  }

  return loadPromise
}

/**
 * Get Konva synchronously — returns null if not yet loaded.
 * Useful for type guards and non-async contexts after initial load.
 */
export function getKonva(): KonvaModule | null {
  return konvaModule
}

/**
 * Check if Konva has been loaded.
 */
export function isKonvaLoaded(): boolean {
  return konvaModule !== null
}
