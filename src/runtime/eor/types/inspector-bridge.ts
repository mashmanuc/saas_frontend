/**
 * Inspector Bridge — reactive contract between engine and sidebar UI.
 *
 * SSOT §8. Bridge is framework-agnostic у type definition; concrete
 * reactivity (Vue ref / React signal / Solid signal) is integration-layer
 * choice.
 *
 * STATUS: P1.a — type declarations only.
 */

/**
 * Generic reactive container — typed by integration layer.
 *
 * In Vue: maps to `Reactive<T>` or `Readonly<Reactive<T>>`.
 * In React: maps to a signal / store state.
 *
 * Type parameter intentionally minimal — we don't import vue/solid here
 * because EO Runtime types layer is framework-agnostic.
 */
export type Reactive<T> = T & { readonly __reactive: unique symbol }

/**
 * Inspector Bridge — reactive contract between engine state и sidebar UI.
 *
 * Per BR-INV-1..4:
 * - state MUST be reactive
 * - mutations go through bridge action methods (NOT direct local mutation)
 * - bridge survives Inspector show/hide
 * - auto-released on adapter unmount
 */
export interface InspectorBridge<TBridgeState = unknown> {
  // Reactive snapshot for live UI binding
  readonly local: Readonly<Reactive<TBridgeState>>

  // Action methods — mutations go through engine API
  toggle(key: keyof TBridgeState & string): void
  setOption(key: keyof TBridgeState & string, value: unknown): void
  setParam?(name: string, value: number): void   // optional (HighFreqParam-capable)

  // Lifecycle observation (optional)
  onMount?(cb: () => void): void
  onUnmount?(cb: () => void): void
}
