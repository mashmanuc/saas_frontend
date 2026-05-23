/**
 * applyDataDiff — canonical partial state application helper.
 *
 * Per user mandate (targeted correction sprint PP-3):
 *
 *   "widgets manually diff-route state updates. EOD contract implicitly
 *    assumes setState-style semantics."
 *
 *   Goal: ONE canonical helper для partial state application.
 *
 *   STRICT:
 *     - Do NOT build runtime orchestration
 *     - Do NOT touch existing widgets globally
 *     - Minimal: prove ONE reusable helper shape
 *
 * Adapter declares setter map ONCE (per field). Helper routes per-field
 * diffs from incoming op payload to engine methods. Replaces the
 * ad-hoc if/else cascade у EOD.applyOp implementations.
 *
 * Pure function. No I/O. No side effects beyond invoking setters.
 *
 * STATUS: P2-correction. Dead unless explicitly invoked by an EOD.
 *
 * ─── EXAMPLE USAGE ─────────────────────────────────────────────────────
 *
 *   // EOD declares once у adapter file:
 *   const setters: FieldSetterMap<TrigEngine, TrigData> = {
 *     type: (engine, value) => engine.setType(value),
 *     rel: (engine, value) => engine.setRel(value),
 *     a: (engine, value) => engine.setA(value),
 *     snapSpecial: (engine, value) => engine.setOption('snapSpecial', value),
 *     showGraph: (engine, value) => engine.setOption('showGraph', value),
 *   }
 *
 *   // applyOp implementation:
 *   applyOp(op, engine) {
 *     if (op.op_type !== 'asset_update') return
 *     const payload = op.payload as { data?: Partial<TrigData> }
 *     if (!payload?.data) return
 *     applyDataDiff(engine, engine.getState(), payload.data, setters)
 *   }
 *
 * ─── DESIGN DECISIONS ──────────────────────────────────────────────────
 *
 *   - Identity check via `Object.is` — same value reference / NaN-safe
 *   - Unknown field у `next` (not у setters) → silent skip (forward-compat
 *     when EOD predates new field у data)
 *   - Undefined value у `next` → skipped (consistent з JSON patch semantics)
 *   - Setter signature: `(engine, value) => void` — caller has typed access
 *     to engine; we keep helper engine-agnostic via TEngine generic
 */

/**
 * Field setter — applies one field's new value to the engine.
 */
export type FieldSetter<TEngine, V> = (engine: TEngine, value: V) => void

/**
 * Setter map — adapter declares which setter handles each field.
 *
 * Optional fields per key — adapter may не include setter for read-only
 * derived fields, у which case helper silently skips when those fields
 * appear у `next`.
 */
export type FieldSetterMap<TEngine, TData> = {
  readonly [K in keyof TData]?: FieldSetter<TEngine, NonNullable<TData[K]>>
}

/**
 * Apply diff between `current` engine state and incoming `next` partial
 * data. For each field that changed, invoke the matching setter.
 *
 * @param engine   - target engine reference (passed back to setters)
 * @param current  - engine's current data state
 * @param next     - incoming partial data from op payload
 * @param setters  - field → setter map declared by adapter
 *
 * @returns void. Side effects only via setter invocations.
 */
export function applyDataDiff<TEngine, TData extends Record<string, unknown>>(
  engine: TEngine,
  current: TData,
  next: Partial<TData>,
  setters: FieldSetterMap<TEngine, TData>,
): void {
  // Iterate keys у `next` — fields not present у update are NOT touched
  for (const key of Object.keys(next) as Array<keyof TData>) {
    const newValue = next[key]
    if (newValue === undefined) continue          // explicit undefined skipped
    if (Object.is(newValue, current[key])) continue // unchanged
    const setter = setters[key]
    if (!setter) continue                          // unknown field → silent forward-compat
    // Cast is safe — TData[key] guaranteed compatible by FieldSetter<_, NonNullable<TData[key]>>
    setter(engine, newValue as NonNullable<TData[typeof key]>)
  }
}
