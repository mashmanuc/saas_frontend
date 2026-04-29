// Phase O PR-O2: TypeScript declarations for vendored solidCard.js.
// JS file — IIFE attaches `SolidCard` constructor to globalThis.
// Adapter consumes only constructor + set() + destroy() per SSOT §3.7.1.

export {}

declare global {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  interface Window {
    THREE?: unknown
    // Restricted shape — adapter exposes ONLY these. Internal methods
    // (_apply, _buildSolid, rebuild, toggleFullscreen) intentionally NOT typed
    // щоб accidental usage у TS code was a compile error per SSOT §3.7.1.
    SolidCard?: new (
      container: HTMLElement,
      opts: { type: string },
    ) => {
      set(key: string, value: unknown): void
      destroy(): void
    }
  }
}
