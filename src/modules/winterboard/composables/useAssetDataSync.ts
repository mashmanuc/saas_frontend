/**
 * useAssetDataSync — SSOT §3.7.X adapter utility.
 *
 * Widget renderers follow a strict one-way binding (SSOT §3.7.X adapter pattern):
 *   ✅ store → card   via `syncAssetField` (incoming from ops/replay)
 *   ✅ card  → store  via `onXChange` callbacks set at mount (outgoing for persistence)
 *   ❌ NEVER read card internal state back into the store
 *   ❌ NEVER call internal card methods (rebuild, _apply, etc.) from renderer
 *
 * ## Why a separate composable?
 *   Each widget renderer (TrigCircleRenderer, HelixRenderer, CalculusRenderer,
 *   Geometry2DRenderer) manually wires the same guard pattern:
 *     ```ts
 *     watch(() => props.asset.data.X, (val) => {
 *       if (!card) return
 *       card.setX(val)
 *     })
 *     ```
 *   `syncAssetField` centralises the guard and documents the architectural intent.
 *   Guarantees: (1) null-card is always guarded, (2) pattern is grep-able.
 *
 * ## Usage in a renderer
 *   ```ts
 *   import { syncAssetField } from '../../../composables/useAssetDataSync'
 *
 *   // Inside <script setup> — watcher is auto-cleaned on component unmount
 *   syncAssetField(
 *     () => props.asset.data.theta,
 *     () => widget,
 *     (c, val) => c.setTheta(val),
 *   )
 *
 *   syncAssetField(
 *     () => props.asset.data.toggles,
 *     () => widget,
 *     (c, toggles) => {
 *       if (!toggles) return
 *       for (const [k, on] of Object.entries(toggles)) c.setToggle(k, on as boolean)
 *     },
 *     { deep: true },
 *   )
 *   ```
 *
 * ## Existing renderers
 *   TrigCircleRenderer, HelixRenderer, CalculusRenderer, Geometry2DRenderer
 *   implement this pattern inline (written before this composable existed).
 *   New renderers MUST use `syncAssetField` instead of manual watch+guard.
 *   Existing renderers may be migrated incrementally.
 */
import { watch, type WatchOptions } from 'vue'

/**
 * Registers a reactive watcher: when `source()` changes, calls `setter(card, newVal)`.
 *
 * Guard: if `getCard()` returns `null` or `undefined` at reaction time, the setter
 * is silently skipped (card not yet mounted or already destroyed — safe to ignore).
 *
 * The watcher is automatically stopped when the calling component unmounts
 * (standard Vue `watch` lifecycle within `<script setup>` / `setup()`).
 *
 * @param source  Reactive getter for the asset data field to observe.
 *                Should be a narrow getter (`() => props.asset.data.theta`) —
 *                not the entire `data` object — to minimise spurious calls.
 * @param getCard Returns the current engine card/widget reference (or null/undefined).
 *                Typically a simple closure over a `let card: MyCard | null = null`
 *                variable set in onMounted and cleared in onUnmounted.
 * @param setter  Called with (card, newValue) when source changes.
 *                MUST NOT mutate `props.asset` — only call engine API methods.
 * @param options Vue WatchOptions.  `immediate: true` useful if the card may be
 *                mounted before the first data change fires; `deep: true` for
 *                object/array sources (e.g. `toggles`, `pointsSnapshot`).
 *
 * @example — theta sync in TrigCircleRenderer
 * ```ts
 * syncAssetField(
 *   () => props.asset.data.theta,
 *   () => trig,
 *   (c, val) => { if (Math.abs(c.opts.theta - val) > 0.0001) c.setTheta(val) },
 * )
 * ```
 *
 * @example — toggle map sync in Geometry2DRenderer
 * ```ts
 * syncAssetField(
 *   () => props.asset.data.toggles,
 *   () => card,
 *   (c, toggles) => {
 *     if (!toggles) return
 *     for (const [k, on] of Object.entries(toggles)) {
 *       try { c.setToggle(k, on as boolean) } catch { /* unknown toggle — safe */ }
 *     }
 *   },
 *   { deep: true },
 * )
 * ```
 */
export function syncAssetField<T, C>(
  source: () => T,
  getCard: () => C | null | undefined,
  setter: (card: C, val: T) => void,
  options?: WatchOptions,
): void {
  watch(source, (val) => {
    const card = getCard()
    if (card == null) return
    setter(card, val)
  }, options)
}
