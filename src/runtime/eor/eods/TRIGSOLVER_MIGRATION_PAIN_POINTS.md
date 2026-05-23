# TrigSolver Shadow Migration — Real Pain Points

> **Status:** Discovered during P2 shadow EOD implementation
> **Source:** `frontend/src/runtime/eor/eods/trigSolverEOD.ts` + tests
> **Purpose:** practical migration > infrastructure purity. Document what
> ACTUALLY breaks / surprises when wrapping a real widget у EOD contract.
>
> This is raw feedback from doing the work. NOT polished design doc.

---

## Summary

EOD contract (P1 substrate) is **mostly satisfiable** but has 7 friction
points that surfaced from one widget alone. Several point at SSOT amendments
needed BEFORE migrating 6 widgets through the same contract.

**33 tests pass — shadow path provably works for TrigSolver.** But pain
points below would multiply 6x if migrated naively.

---

## PP-1 — `RuntimeAdapter.mount()` requires DOM

**What:** Contract signature `mount(host: AdapterHostContext)` where
`host.stageRef: HTMLElement`. Real vendor (`window.TrigEquation`) constructs
itself with DOM container.

**Impact:**
- Unit tests cannot exercise mount() — there's no DOM у Vitest by default
- Mock engine bypasses mount entirely, тests only `applyOp` / `serialize` / etc.
- Shadow integration will require either jsdom setup or integration-test infrastructure

**Workaround у P2:** mount() throws explicit "shadow-only stub" message.
Tests exercise everything else via mock engine.

**Production fix direction:** AdapterHostContext should support optional
"headless" mode for shadow validation. OR shadow validator should test
via test-doubles only, never invoking real mount.

---

## PP-2 — Vendor engine has no TypeScript types

**What:** `window.TrigEquation` is JS vendor bundle. Adapter declares
`TEngine = unknown` — loses all type safety. Adapter has to cast or use
runtime guards.

**Impact:**
- IDE autocomplete broken for engine operations
- Type errors lost — `engine.setType('invalid')` compiles
- Hard to maintain when vendor API evolves

**Workaround у P2:** declared `TrigSolverEngineLike` interface у adapter
file. Acts as informal typed facade.

**Production fix direction:** Ship `.d.ts` alongside vendor bundle OR
wrap vendor у typed facade у separate file. Should be done BEFORE migrating
3D engines (NMT3D, Helix) which have richer APIs.

---

## PP-3 — `applyOp` does diff-based routing, contract assumes setState

**What:** TrigEquation has `setType` / `setRel` / `setA` / `setOption` —
no unified `setState(partial)` method. `asset_update` op carries full
data envelope, so adapter must:

1. Compute diff between `op.payload.data` and `engine.getState()`
2. Call individual setter per changed field

Contract docs say "route to engine.setState() / engine.setParam() / etc."
This is implicit — actual mapping logic burdens each EOD.

**Impact:**
- Code duplication — every EOD writes similar diff-routing
- Easy to forget a field — leads to silent state divergence
- Adds branching code which colleague review explicitly forbade for
  classification ("no semantic interpretation") but is now mandatory here

**Workaround у P2:** explicit per-field if/else у applyOp.

**Production fix direction:** Either:
- (a) standardize engine wrappers to expose `setState(partial)`, OR
- (b) provide adapter helper `applyDataDiff(engine, current, new, setters)`
  у EO Runtime utilities, so each EOD declares setter map instead of
  writing routing code

---

## PP-4 — InspectorBridge ownership clash

**What:**
- Existing pattern: `TrigSolverRenderer.vue` (line ~Y) creates bridge
  у onMount, calls `registerTrigSolver(id, bridge)` — populates global
  module-level `trigSolverUiState`. Inspector reads from there.
- EOD pattern: `InspectorAdapter.buildBridge(engine) → bridge` —
  assumes adapter OWNS bridge lifecycle.

**Impact:**
- Two bridges coexist у shadow mode (one renderer-owned, one EOD-built)
- Inspector reads only one of them — currently the renderer one
- Authority transfer point unclear: when does Inspector switch source?

**Workaround у P2:** EOD bridge is shadow-scoped, used only for parity
testing. Production bridge stays renderer-owned.

**Production fix direction:** SSOT amendment needed defining authority
transfer protocol. Suggested:
- `EORegistry.registerInspectorBridge(instance_id, bridge)` becomes
  single source of truth
- Renderer reads from runtime's bridge instead of creating its own
- Migration phase D switches renderers one-by-one

---

## PP-5 — Snapshot scope: data vs full asset envelope

**What:**
- `PersistenceAdapter.serialize(engine) → TData` where `TData extends EODataBase`
  documents "all engine config + version + type"
- Real `WBAsset` shape: `{ id, type, x, y, w, h, rotation, data: {...}, ... }`
- Adapter's data is JUST `data` field — geometry (`x, y, w, h`) is parent
  responsibility

**Impact:**
- Shadow validator receives full board_state, must filter to per-asset
  data before comparing
- Where does responsibility live: adapter knows data shape; glue layer
  knows asset envelope; comparator знає neither
- Risk: comparator misses geometry diffs (asset moved by 10px on legacy
  but not on EOD) because data-only comparison passes

**Workaround у P2:** Tests construct asset envelope manually around EOD
data.

**Production fix direction:** Two-level parity:
- Asset-envelope parity (geometry, identity) — shared comparator
- Asset-data parity (EOD-specific) — adapter-aware comparator
Glue layer composes both.

---

## PP-6 — No canonical engine event names

**What:** Adapter contract uses `host.bus.emit('engine_change', payload)`
as **example**. SSOT §9 doesn't enumerate canonical events. TrigEquation
emits via its own callback shape (`opts.onChange`). Adapter must
subscribe and translate.

**Impact:**
- Every EOD invents its own engine→bus event names
- No catalog → telemetry / dashboards inconsistent
- Future bus event filtering / routing complex

**Production fix direction:** SSOT amendment з canonical bus event catalog:
- `engine_change` (general state delta)
- `param_change` (specific param for HighFreqParam policy)
- `expand_requested` (UI signal up to runtime)
- `interactivity_changed` (mirror of setInteractive)
- etc.

---

## PP-7 — `setInteractive` semantics unclear

**What:** Contract says `setInteractive(engine, interactive)` toggles
pen-tool readonly mode. Many widgets (TrigSolver, GraphCalc, NMT3D)
implement this via CSS `pointer-events: none` on overlay container —
the engine itself is unaware.

**Impact:**
- TrigEquation has no setInteractive method
- Adapter implements as no-op
- Contract suggests engine knows; reality says host CSS knows

**Workaround у P2:** Adapter no-op, comment explains.

**Production fix direction:** Either:
- (a) `setInteractive` becomes optional у contract, OR
- (b) Renamed to `setEngineInteractive` to clarify it's about engine
  internal interactivity (e.g., disabling Konva listening), distinct
  from CSS chrome.

---

## PP-N — Field name collision (`type` discriminator)

**What:**
- `EODataBase.type: string` = EO type discriminator ('trig_solver')
- Original `TrigSolverData.type: TrigFuncType` = which trig function ('sin' | 'cos' | ...)

Both fields exist as `data.type` but mean completely different things.

**Impact у P2:** Adapter renamed second to `trigType` у EOD-internal
shape. Caller must translate when emitting / consuming ops. Easy to mix up.

**Production fix direction:** SSOT mandate: EODataBase.type is **reserved
discriminator name**. Widgets with collision must rename. TrigSolverData
should rename `type` → `trigType` у source eventually (or EOD wraps
permanently with translation).

---

## Estimate impact on remaining 5 widgets

| Widget | Predicted incremental cost |
|---|---|
| TrigCircle | LOW (same vendor family — same PPs as TrigSolver) |
| Helix | MEDIUM (3D engine, more state, no animation persistence) |
| Calculus | MEDIUM (similar to TrigSolver but mode-specific fields) |
| NMT3D | MEDIUM-HIGH (DirectCallback policy migration + 3D scene wrapping) |
| GraphCalc | HIGH (ThrottledParamPolicy, race_guard, complex viewport state) |

Each will surface widget-specific PPs. Mandatory documentation per
migration to prevent re-discovery.

---

## What worked smoothly

✅ EORegistry.register() — concrete EOD registered cleanly, deepFreeze worked
✅ Capabilities declaration — Set<Capability> intuitive, immutable
✅ SnapshotPolicyImpl construction — validated debounce_ms at construction
✅ PersistenceAdapter.buildDefaultData — reused existing `buildDefaultTrigSolverData()`
✅ Shadow parity comparators — all 4 (serialize / replay / applyOp / classify)
   worked first time на real widget data
✅ Identity normalization (P1.5.a) — runtime_id stripping silently saved
   the day у shadow parity test that intentionally varied runtime_id
✅ §15.6 boundary held — zero modification of existing TrigSolver files

---

## Resolution status (post-P2 targeted correction sprint)

| PP | Status | Resolution |
|---|---|---|
| **PP-3** | ✅ RESOLVED | `applyDataDiff` helper у `runtime/eor/utils/`. TrigSolverEOD refactored to use it. Declarative setter map replaces if/else cascade. |
| **PP-4** | ✅ RESOLVED | `InspectorBridgeRegistry` у `runtime/eor/inspector/`. Ownership rule: runtime sets, Inspector reads, NEVER creates. Duplicate registration hard-fails. |
| **PP-6** | ✅ RESOLVED | `EngineEvent` constants у `runtime/eor/events/`. 5 canonical names + `isCanonicalEngineEvent` guard. |
| PP-1 | DEFERRED | Mount DOM dependency — addressed when first integration test lands |
| PP-2 | DEFERRED | Vendor `.d.ts` strategy — addressed before 3D widget migration |
| PP-5 | DEFERRED | Snapshot scope — addressed when glue layer designed |
| PP-7 | DEFERRED | `setInteractive` semantics — low impact, no-op у adapter sufficient |
| PP-N | DEFERRED | `type` field collision — adapter-level translation у P2 sufficient |

## Recommendation before migrating widget #2

1. **SSOT amendment** для PP-3 (applyDataDiff helper) and PP-6 (canonical
   bus event catalog) — these compound across widgets
2. **Vendor `.d.ts`** strategy decided BEFORE migrating 3D widgets (PP-2
   gets worse with richer APIs)
3. **InspectorBridge ownership protocol** defined (PP-4) — currently both
   renderer and EOD attempt ownership
4. **Asset envelope parity layer** designed (PP-5) — glue layer
   architecture decision

If those 4 land before widget #2, remaining migrations should follow same
pattern without re-discovering same PPs.
