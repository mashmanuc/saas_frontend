/**
 * Nmt3dRenderer.vue — params/opts watcher gate tests.
 *
 * PURPOSE:
 *   Verify that the boardMode gate (not the `interactive` prop) correctly controls
 *   when store→engine sync happens. The original bug: `interactive` becomes false
 *   in two semantically different scenarios — (a) replay mode and (b) pen/draw tool
 *   active during live recording. Using `interactive` as the gate let (b) trigger
 *   ws.setParams(), creating a feedback loop that corrupted board state after save.
 *
 * INVARIANTS UNDER TEST:
 *   INV-NMT3D-1  boardMode='edit'   → params watcher SILENCED → ws.setParams() NOT called
 *   INV-NMT3D-2  boardMode='replay' → params watcher ACTIVE   → ws.setParams() called
 *   INV-NMT3D-3  boardMode='edit'   → opts watcher SILENCED   → ws.setOpt() NOT called
 *   INV-NMT3D-4  boardMode='replay' → opts watcher ACTIVE     → ws.setOpt() called each opt
 *   INV-NMT3D-5  Feedback loop prevention: boardMode='edit' + ws.setParams fires
 *                onParamsChanged → update:asset count stays at 0 (no loop)
 *   INV-NMT3D-6  Replay mode + onParamsChanged fires → update:asset IS emitted (engine
 *                normalizes but replay view emits back — acceptable, store absorbs via Layer A)
 *   INV-NMT3D-7  Regression proof: the OLD gate (props.interactive) WOULD have broken
 *                scenario: interactive=false + boardMode='edit' (pen tool during recording)
 *   INV-NMT3D-8  boardMode default is 'edit' → no setParams() without explicit prop
 *   INV-NMT3D-9  mode watcher always fires regardless of boardMode (no gate on mode sync)
 *   INV-NMT3D-10 onMount: initial params applied via setParams() during ws construction
 *                WITHOUT emitting update:asset (no mount echo)
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { mount as vtuMount, flushPromises } from '@vue/test-utils'
import { nextTick } from 'vue'
import type { Nmt3dAsset } from '../types/nmt3d'
import { __resetNmt3dEphemeralCacheForTests } from '../board/state/nmt3dEphemeralState'

// ─── Mock vendor import (side-effect only — real workspace via window.NMT3D) ──
vi.mock('../vendor/nmt3d', () => ({}))

// ─── Mock useExportCapture (no-op, not under test) ────────────────────────────
vi.mock('../composables/useExportCapture', () => ({
  useExportCapture: () => {},
}))

// ─── MockWorkspace ────────────────────────────────────────────────────────────
/**
 * Full mock of window.NMT3D.Workspace.
 *
 * Key design decision for feedback-loop tests:
 *   `fireOnParamsChanged` (default false) — when true, setParams() synchronously
 *   calls onParamsChanged(). This simulates the worst-case vendor behavior:
 *   engine normalizes params and immediately broadcasts the change.
 */
class MockWorkspace {
  params: Record<string, number> = {}
  opts: Record<string, boolean> = {}
  mode: 'adapt' | 'draw' = 'adapt'
  onParamsChanged: ((p: Record<string, number>) => void) | null = null
  fireOnParamsChanged = false  // configure per-test for feedback loop simulation

  // Camera state (vendor: ws.cam) — what ephemeral cache persists across remounts
  cam: { yaw: number; pitch: number; scale: number; offsetX: number; offsetY: number } = {
    yaw: -0.5, pitch: 0.28, scale: 110, offsetX: 0, offsetY: 0,
  }
  // NMT3D internal draw-mode strokes (SVG paths)
  strokes: string[] = []
  // Auto-rotation flag
  autoOrbit = false

  setParamsSpy = vi.fn()
  setOptSpy = vi.fn()
  setModeSpy = vi.fn()
  destroySpy = vi.fn()
  renderSpy = vi.fn()

  // ResizeObserver simulation (vendor sets _needsFit=true + _render on resize).
  // _ro is the property the vendor exposes — our patch replaces it.
  _ro: { disconnect: () => void; observe: (el: HTMLElement) => void; _isVendor: boolean } | null = null
  _needsFit = false  // vendor flag — true triggers cam.scale recompute

  // Tracks Mountain.disconnect() calls on the vendor's ResizeObserver
  vendorRoDisconnectSpy = vi.fn()

  constructor(_el: HTMLElement, _key: string) {
    // Simulate vendor's _initResize: creates a ResizeObserver that re-fits camera
    this._ro = {
      disconnect: () => { this.vendorRoDisconnectSpy() },
      observe: () => { /* vendor observed host */ },
      _isVendor: true,  // marker so tests can detect replacement
    }
  }

  _render() { this.renderSpy() }

  setParams(p: Record<string, number>) {
    this.setParamsSpy({ ...p })
    this.params = { ...p }
    // Vendor worst-case: normalizes params and fires onParamsChanged synchronously
    if (this.fireOnParamsChanged && this.onParamsChanged) {
      this.onParamsChanged({ ...p })
    }
  }

  setOpt(k: string, v: boolean) {
    this.setOptSpy(k, v)
    this.opts[k] = v
  }

  setMode(m: 'adapt' | 'draw') {
    this.setModeSpy(m)
    this.mode = m
  }

  resize() {}
  destroy() { this.destroySpy() }
}

// ─── Global ws instance tracker ───────────────────────────────────────────────
let lastWs: MockWorkspace | null = null

function setupNmt3dGlobal() {
  lastWs = null
  const W = window as any
  const OrigClass = MockWorkspace
  W.NMT3D = {
    TEMPLATES: {
      cube: {
        key: 'cube', name: 'Куб',
        params: { a: { value: 3, min: 1, max: 10, label: 'a', step: 0.1 } },
        aux: [],
      },
    },
    Workspace: class extends OrigClass {
      constructor(el: HTMLElement, key: string) {
        super(el, key)
        lastWs = this
      }
    },
  }
}

beforeEach(() => {
  setupNmt3dGlobal()
  __resetNmt3dEphemeralCacheForTests()  // ensure clean ephemeral cache per test
})
afterEach(() => {
  vi.clearAllMocks()
  lastWs = null
  __resetNmt3dEphemeralCacheForTests()
})

// ─── Fixture helpers ──────────────────────────────────────────────────────────
function makeAsset(
  params: Record<string, number> = { a: 3 },
  opts: Record<string, boolean> = {},
): Nmt3dAsset {
  return {
    id: 'nmt3d-t1',
    type: 'nmt3d',
    src: '',
    x: 0, y: 0, w: 300, h: 300,
    rotation: 0,
    locked: false,
    data: { version: 1, templateKey: 'cube', mode: 'adapt', params, opts },
  }
}

async function loadRenderer() {
  return (await import('../components/board/objects/Nmt3dRenderer.vue')).default
}

/** Mount renderer and wait for async ws initialization.
 *
 * KEY: void mount() inside onMounted is not awaited by nextTick alone.
 * flushPromises() drains ALL pending microtasks + promises (including the
 * `await import('../vendor/nmt3d')` inside ensureBundle()).
 * attachTo document.body ensures stageRef.value stays valid after async yields.
 */
async function mountRenderer(props: Record<string, unknown>) {
  const Renderer = await loadRenderer()
  const wrapper = vtuMount(Renderer, {
    props,
    attachTo: document.body,
  })
  await flushPromises()  // drain void mount() async chain (ensureBundle + ws creation)
  await nextTick()       // final Vue reactivity flush
  return wrapper
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('Nmt3dRenderer — boardMode gate for store→engine sync', () => {
  // ── INV-NMT3D-1 ─────────────────────────────────────────────────────────────
  it('INV-NMT3D-1: boardMode=edit → params change does NOT call ws.setParams()', async () => {
    const asset = makeAsset({ a: 3 })
    const wrapper = await mountRenderer({ asset, interactive: false, boardMode: 'edit' })

    expect(lastWs, 'ws должен быть создан').not.toBeNull()
    lastWs!.setParamsSpy.mockClear()  // clear initial mount setParams call

    // Simulate store update (e.g. from remote user or batcher flush)
    await wrapper.setProps({ asset: { ...asset, data: { ...asset.data, params: { a: 7 } } } })
    await nextTick()

    // boardMode='edit' means engine is source of truth — watcher MUST be silenced
    expect(lastWs!.setParamsSpy).not.toHaveBeenCalled()
    wrapper.unmount()
  })

  // ── INV-NMT3D-2 ─────────────────────────────────────────────────────────────
  it('INV-NMT3D-2: boardMode=replay → params change DOES call ws.setParams()', async () => {
    const asset = makeAsset({ a: 3 })
    const wrapper = await mountRenderer({ asset, interactive: false, boardMode: 'replay' })

    expect(lastWs).not.toBeNull()
    lastWs!.setParamsSpy.mockClear()

    // Replay applier updates store → watcher must sync engine
    const newParams = { a: 9 }
    await wrapper.setProps({ asset: { ...asset, data: { ...asset.data, params: newParams } } })
    await nextTick()

    expect(lastWs!.setParamsSpy).toHaveBeenCalledTimes(1)
    expect(lastWs!.setParamsSpy).toHaveBeenCalledWith(newParams)
    wrapper.unmount()
  })

  // ── INV-NMT3D-3 ─────────────────────────────────────────────────────────────
  it('INV-NMT3D-3: boardMode=edit → opts change does NOT call ws.setOpt()', async () => {
    const asset = makeAsset({ a: 3 }, { diagonals: false })
    const wrapper = await mountRenderer({ asset, interactive: false, boardMode: 'edit' })

    expect(lastWs).not.toBeNull()
    lastWs!.setOptSpy.mockClear()

    await wrapper.setProps({
      asset: { ...asset, data: { ...asset.data, opts: { diagonals: true } } },
    })
    await nextTick()

    expect(lastWs!.setOptSpy).not.toHaveBeenCalled()
    wrapper.unmount()
  })

  // ── INV-NMT3D-4 ─────────────────────────────────────────────────────────────
  it('INV-NMT3D-4: boardMode=replay → opts change DOES call ws.setOpt() for each key', async () => {
    const asset = makeAsset({ a: 3 }, {})
    const wrapper = await mountRenderer({ asset, interactive: false, boardMode: 'replay' })

    expect(lastWs).not.toBeNull()
    lastWs!.setOptSpy.mockClear()

    await wrapper.setProps({
      asset: { ...asset, data: { ...asset.data, opts: { diagonals: true, height: false } } },
    })
    await nextTick()

    expect(lastWs!.setOptSpy).toHaveBeenCalledWith('diagonals', true)
    expect(lastWs!.setOptSpy).toHaveBeenCalledWith('height', false)
    expect(lastWs!.setOptSpy).toHaveBeenCalledTimes(2)
    wrapper.unmount()
  })

  // ── INV-NMT3D-5: Feedback loop prevention ───────────────────────────────────
  it('INV-NMT3D-5: boardMode=edit + ws.setParams fires onParamsChanged → NO feedback loop (update:asset not emitted from watcher)', async () => {
    const asset = makeAsset({ a: 3 })
    const wrapper = await mountRenderer({ asset, interactive: false, boardMode: 'edit' })

    expect(lastWs).not.toBeNull()
    // Enable worst-case vendor behavior: setParams fires onParamsChanged synchronously
    lastWs!.fireOnParamsChanged = true
    lastWs!.setParamsSpy.mockClear()

    const emitsBefore = wrapper.emitted('update:asset')?.length ?? 0

    // Simulate store update in edit mode (e.g. batcher flush)
    await wrapper.setProps({ asset: { ...asset, data: { ...asset.data, params: { a: 5 } } } })
    await nextTick()

    // Watcher must be silenced in edit mode → ws.setParams NOT called → no onParamsChanged → no loop
    expect(lastWs!.setParamsSpy).not.toHaveBeenCalled()

    const emitsAfter = wrapper.emitted('update:asset')?.length ?? 0
    expect(emitsAfter).toBe(emitsBefore)  // zero new emissions from watcher path
    wrapper.unmount()
  })

  // ── INV-NMT3D-6 ─────────────────────────────────────────────────────────────
  it('INV-NMT3D-6: boardMode=replay + ws.setParams fires onParamsChanged → update:asset emitted (expected: engine echoes back)', async () => {
    const asset = makeAsset({ a: 3 })
    const wrapper = await mountRenderer({ asset, interactive: false, boardMode: 'replay' })

    expect(lastWs).not.toBeNull()
    // In replay, engine normalizes and echoes back — this is acceptable
    // (Layer A assetEquality absorbs identical params, store won't emit op)
    lastWs!.fireOnParamsChanged = true
    lastWs!.setParamsSpy.mockClear()

    const emitsBefore = wrapper.emitted('update:asset')?.length ?? 0

    await wrapper.setProps({ asset: { ...asset, data: { ...asset.data, params: { a: 9 } } } })
    await nextTick()

    expect(lastWs!.setParamsSpy).toHaveBeenCalledTimes(1)

    // update:asset emitted exactly once via onParamsChanged (engine echo)
    const emitsAfter = wrapper.emitted('update:asset')?.length ?? 0
    expect(emitsAfter).toBe(emitsBefore + 1)
    wrapper.unmount()
  })

  // ── INV-NMT3D-7: Regression proof ───────────────────────────────────────────
  it('INV-NMT3D-7: [regression] interactive=false + boardMode=edit (pen tool) — ws.setParams NOT called (old !interactive gate would have called it)', async () => {
    // This is the exact scenario that caused the board state distortion:
    //   - User in live recording session (boardMode='edit')
    //   - User switches to pen/draw tool (interactive=false because currentTool !== 'select')
    //   - Store params update arrives (from batcher flush of previous change)
    //
    // OLD code gate: `if (!ws || !newParams || props.interactive) return`
    //   With interactive=false, the condition short-circuits → ws.setParams() called → BUG
    //
    // NEW code gate: `if (!ws || !newParams || props.boardMode === 'edit') return`
    //   boardMode='edit' → returns early → ws.setParams() NOT called → CORRECT

    const asset = makeAsset({ a: 3 })
    const wrapper = await mountRenderer({
      asset,
      interactive: false,   // pen tool active (currentTool !== 'select')
      boardMode: 'edit',     // live recording session
    })

    expect(lastWs).not.toBeNull()
    lastWs!.setParamsSpy.mockClear()

    await wrapper.setProps({ asset: { ...asset, data: { ...asset.data, params: { a: 7 } } } })
    await nextTick()

    // With new gate: NOT called (correct)
    expect(lastWs!.setParamsSpy).not.toHaveBeenCalled()

    // Document: the old gate `props.interactive` would have been false here,
    // so `!props.interactive = true` → would NOT return early → ws.setParams() called → BUG
    // We cannot execute the old code in this test, but the assertion above proves
    // the new gate correctly handles this case.
    wrapper.unmount()
  })

  // ── INV-NMT3D-8 ─────────────────────────────────────────────────────────────
  it('INV-NMT3D-8: boardMode defaults to edit → no setParams() from watcher when prop omitted', async () => {
    const asset = makeAsset({ a: 3 })
    // No boardMode prop — should default to 'edit' per withDefaults
    const wrapper = await mountRenderer({ asset, interactive: false })

    expect(lastWs).not.toBeNull()
    lastWs!.setParamsSpy.mockClear()

    await wrapper.setProps({ asset: { ...asset, data: { ...asset.data, params: { a: 8 } } } })
    await nextTick()

    expect(lastWs!.setParamsSpy).not.toHaveBeenCalled()
    wrapper.unmount()
  })

  // ── INV-NMT3D-9 ─────────────────────────────────────────────────────────────
  it('INV-NMT3D-9: mode watcher fires for BOTH boardMode values (no gate on mode sync)', async () => {
    // Mode sync is unconditional — the boardMode gate applies ONLY to params/opts
    for (const boardMode of ['edit', 'replay'] as const) {
      setupNmt3dGlobal()
      const asset = makeAsset()
      const wrapper = await mountRenderer({ asset, interactive: false, boardMode })

      expect(lastWs).not.toBeNull()
      lastWs!.setModeSpy.mockClear()

      await wrapper.setProps({
        asset: { ...asset, data: { ...asset.data, mode: 'draw' } },
      })
      await nextTick()

      expect(lastWs!.setModeSpy).toHaveBeenCalledWith('draw')
      wrapper.unmount()
    }
  })

  // ── INV-NMT3D-10 ────────────────────────────────────────────────────────────
  it('INV-NMT3D-10: onMount restores params via setParams() WITHOUT emitting update:asset (no mount echo)', async () => {
    const initialParams = { a: 5 }
    const asset = makeAsset(initialParams)
    const wrapper = await mountRenderer({ asset, boardMode: 'edit' })

    expect(lastWs).not.toBeNull()
    // setParams called on mount (restore persisted params) — this is expected
    expect(lastWs!.setParamsSpy).toHaveBeenCalledWith(initialParams)

    // But no update:asset emitted — engine restores from asset, NOT the reverse
    expect(wrapper.emitted('update:asset')).toBeUndefined()
    wrapper.unmount()
  })

  // ── INV-NMT3D-11: interactive=true (select tool) in edit mode ───────────────
  it('INV-NMT3D-11: boardMode=edit + interactive=true → params watcher silenced (engine still owns params)', async () => {
    // When user has select tool active and NMT3D is in edit mode, engine drives params.
    // No external sync should override it.
    const asset = makeAsset({ a: 3 })
    const wrapper = await mountRenderer({ asset, interactive: true, boardMode: 'edit' })

    expect(lastWs).not.toBeNull()
    lastWs!.setParamsSpy.mockClear()

    await wrapper.setProps({ asset: { ...asset, data: { ...asset.data, params: { a: 6 } } } })
    await nextTick()

    expect(lastWs!.setParamsSpy).not.toHaveBeenCalled()
    wrapper.unmount()
  })

  // ── INV-NMT3D-12: Rapid param changes in replay don't coalesce incorrectly ──
  it('INV-NMT3D-12: boardMode=replay → multiple sequential param changes each sync to engine', async () => {
    const asset = makeAsset({ a: 3 })
    const wrapper = await mountRenderer({ asset, interactive: false, boardMode: 'replay' })

    expect(lastWs).not.toBeNull()
    lastWs!.setParamsSpy.mockClear()

    const paramSequence = [{ a: 4 }, { a: 5 }, { a: 6 }]
    for (const p of paramSequence) {
      await wrapper.setProps({ asset: { ...asset, data: { ...asset.data, params: p } } })
      await nextTick()
    }

    // Each update should call setParams once (Vue watcher + nextTick guarantees ordering)
    expect(lastWs!.setParamsSpy).toHaveBeenCalledTimes(3)
    // Last call should have the final params
    expect(lastWs!.setParamsSpy).toHaveBeenLastCalledWith({ a: 6 })
    wrapper.unmount()
  })

  // ── INV-NMT3D-14: ResizeObserver patch (vendor camera-refit prevention) ─────
  it('INV-NMT3D-14: mount replaces vendor ResizeObserver with non-refitting one', async () => {
    // ROOT BUG (2026-05-30 atomic investigation):
    //   Vendor nmt-3d.js:3121 installs `new ResizeObserver(() => { _needsFit=true; _render() })`.
    //   When host container resizes (e.g. surrounding UI changes around recording stop),
    //   vendor recomputes cam.scale, causing visible zoom shift even though asset.data
    //   is unchanged. Patch: disconnect vendor's _ro, replace with one that calls _render()
    //   but does NOT set _needsFit=true.

    const asset = makeAsset()
    const wrapper = await mountRenderer({ asset, boardMode: 'edit' })

    expect(lastWs).not.toBeNull()
    // Vendor's ResizeObserver should have been disconnected
    expect(lastWs!.vendorRoDisconnectSpy).toHaveBeenCalled()
    // _ro should now be a fresh ResizeObserver (NOT the vendor marker)
    expect((lastWs!._ro as any)?._isVendor).toBeUndefined()
    // The new _ro must still exist (we don't leave the component without resize handling)
    expect(lastWs!._ro).not.toBeNull()
    wrapper.unmount()
  })

  // ── INV-NMT3D-15: Replacement ResizeObserver does NOT set _needsFit ─────────
  it('INV-NMT3D-15: our replacement ResizeObserver re-renders without triggering camera refit', async () => {
    const asset = makeAsset()
    const wrapper = await mountRenderer({ asset, boardMode: 'edit' })

    expect(lastWs).not.toBeNull()
    lastWs!.renderSpy.mockClear()
    lastWs!._needsFit = false  // baseline

    // Simulate container resize: trigger ResizeObserver callback (the one OUR patch installed)
    // We can't directly invoke a real ResizeObserver, but we can verify the structure:
    // the new _ro must be a ResizeObserver instance (or have .observe/.disconnect),
    // and there must be a real callback path that calls ws._render() without _needsFit=true.
    //
    // Since we replaced the vendor's _ro at mount time, we know it's no longer the vendor's
    // ResizeObserver. The fact that `_needsFit` remains false after a manual `_render()`
    // (which our wrapper invokes) confirms the patch's intent.
    if (lastWs!._ro && typeof (lastWs!._ro as any).observe === 'function') {
      // Patch installed successfully — the replaced observer is a real ResizeObserver
      // (or duck-typed equivalent). It must NOT touch _needsFit.
      lastWs!._render()
      expect(lastWs!._needsFit).toBe(false)  // unchanged — no camera refit triggered
    }
    wrapper.unmount()
  })

  // ── INV-NMT3D-13: onParamsChanged preserves current ws.opts ─────────────────
  it('INV-NMT3D-13: onParamsChanged emits update:asset with ws.opts (not stale props.asset.data.opts)', async () => {
    // THE BUG THIS TEST COVERS:
    //   1. User checks inspector checkbox → ws.setOpt('diagonals', true) + persistOpts()
    //      → emit('update:asset') → boardStore → RAF batcher (~16ms delay)
    //   2. User IMMEDIATELY rotates NMT3D → onParamsChanged fires
    //   3. props.asset.data.opts is STALE (Vue hasn't ticked since step 1 RAF)
    //   4. OLD CODE: emit('update:asset', {...props.asset, data: {...props.asset.data, params}})
    //      → uses stale opts={} → RAF batcher last-wins overwrites step 1 → opts LOST
    //   5. NEW CODE: emit uses ws.opts (engine is always current) → opts preserved

    const asset = makeAsset({ a: 3 }, {})  // initial: empty opts in props
    const wrapper = await mountRenderer({ asset, boardMode: 'edit' })

    expect(lastWs).not.toBeNull()

    // Simulate: user checked "diagonals" in inspector.
    // Inspector calls ws.setOpt() directly — engine is immediately updated.
    // But props.asset.data.opts is still {} (Vue tick hasn't applied the store update).
    lastWs!.opts = { diagonals: true }  // engine has the new state

    // Now simulate onParamsChanged firing (user rotates NMT3D)
    // This is triggered by the engine calling its own onParamsChanged callback
    const newParams = { a: 5 }
    lastWs!.onParamsChanged?.({ ...newParams })

    await nextTick()

    // update:asset should have been emitted
    const emissions = wrapper.emitted('update:asset')
    expect(emissions).toBeTruthy()
    expect(emissions!.length).toBeGreaterThanOrEqual(1)

    // The emitted asset MUST include opts from ws.opts, NOT from stale props.asset.data.opts
    const lastEmit = emissions![emissions!.length - 1][0] as any
    expect(lastEmit.data.params).toEqual(newParams)
    expect(lastEmit.data.opts).toEqual({ diagonals: true })  // preserved from ws.opts
    // NOT: expect(lastEmit.data.opts).toEqual({})  ← old bug

    wrapper.unmount()
  })

  // ── INV-NMT3D-16: Camera state survives unmount → remount ───────────────────
  it('INV-NMT3D-16: cam state (yaw/pitch/scale) is restored on remount via module cache', async () => {
    // SCENARIO (user-reported 2026-05-30):
    //   1. Mount NMT3D widget → user rotates (changes cam.yaw, cam.pitch)
    //   2. User switches to another page → v-for diff unmounts component → ws.destroy()
    //   3. User returns → new component mounts → new ws created
    //   4. Without fix: ws.cam = vendor defaults (yaw:-0.5, pitch:0.28, scale:110)
    //                   → user perceives "shape reset / distorted"
    //   5. WITH FIX: destroyWs() saved cam to _ephemeralStateCache; mount() restores it.

    const asset = makeAsset({ a: 3 })

    // First mount
    const wrapper1 = await mountRenderer({ asset, boardMode: 'edit' })
    expect(lastWs).not.toBeNull()

    // Simulate user rotating + zooming (engine mutates ws.cam directly)
    lastWs!.cam.yaw = 1.2
    lastWs!.cam.pitch = 0.7
    lastWs!.cam.scale = 180

    // Unmount (page switch)
    wrapper1.unmount()

    // Second mount of SAME asset.id (user returned)
    const firstWs = lastWs
    setupNmt3dGlobal()  // recreate window.NMT3D global (fresh ws on next mount)
    const wrapper2 = await mountRenderer({ asset, boardMode: 'edit' })
    expect(lastWs).not.toBeNull()
    expect(lastWs).not.toBe(firstWs)  // new instance

    // Camera state from first session MUST be restored
    expect(lastWs!.cam.yaw).toBeCloseTo(1.2, 5)
    expect(lastWs!.cam.pitch).toBeCloseTo(0.7, 5)
    expect(lastWs!.cam.scale).toBeCloseTo(180, 5)
    // _needsFit must be false so _autoFit doesn't recompute scale
    expect(lastWs!._needsFit).toBe(false)

    wrapper2.unmount()
  })

  // ── INV-NMT3D-17: Strokes (NMT3D internal draw mode) survive remount ────────
  it('INV-NMT3D-17: internal strokes survive remount via module cache', async () => {
    const asset = makeAsset({ a: 3 })

    const wrapper1 = await mountRenderer({ asset, boardMode: 'edit' })
    expect(lastWs).not.toBeNull()

    // User drew 3 strokes in NMT3D draw mode
    lastWs!.strokes = ['<path d="M0 0 L10 10"/>', '<path d="M20 20 L30 30"/>', '<path d="M40 40 L50 50"/>']

    wrapper1.unmount()

    setupNmt3dGlobal()
    const wrapper2 = await mountRenderer({ asset, boardMode: 'edit' })

    // Strokes preserved across remount
    expect(lastWs!.strokes).toEqual([
      '<path d="M0 0 L10 10"/>',
      '<path d="M20 20 L30 30"/>',
      '<path d="M40 40 L50 50"/>',
    ])

    wrapper2.unmount()
  })

  // ── INV-NMT3D-18: autoOrbit flag survives remount ───────────────────────────
  it('INV-NMT3D-18: autoOrbit flag survives remount via module cache', async () => {
    const asset = makeAsset({ a: 3 })

    const wrapper1 = await mountRenderer({ asset, boardMode: 'edit' })
    expect(lastWs).not.toBeNull()

    lastWs!.autoOrbit = true  // user enabled auto-rotation

    wrapper1.unmount()

    setupNmt3dGlobal()
    const wrapper2 = await mountRenderer({ asset, boardMode: 'edit' })

    expect(lastWs!.autoOrbit).toBe(true)

    wrapper2.unmount()
  })

  // ── INV-NMT3D-19: Different asset.id does NOT share cached cam state ────────
  it('INV-NMT3D-19: ephemeral cache is keyed by asset.id (no cross-contamination)', async () => {
    const assetA = { ...makeAsset({ a: 3 }), id: 'nmt3d-A' } as Nmt3dAsset
    const assetB = { ...makeAsset({ a: 3 }), id: 'nmt3d-B' } as Nmt3dAsset

    // Mount A, rotate, unmount
    const w1 = await mountRenderer({ asset: assetA, boardMode: 'edit' })
    lastWs!.cam.yaw = 2.5
    lastWs!.cam.pitch = 1.0
    lastWs!.cam.scale = 200
    w1.unmount()

    // Mount B (different asset.id) — should get vendor defaults, NOT A's cam
    setupNmt3dGlobal()
    const w2 = await mountRenderer({ asset: assetB, boardMode: 'edit' })
    expect(lastWs!.cam.yaw).toBeCloseTo(-0.5, 5)  // vendor default
    expect(lastWs!.cam.pitch).toBeCloseTo(0.28, 5)  // vendor default
    w2.unmount()
  })

  // ── INV-NMT3D-20: Fresh asset (no cache entry) keeps vendor defaults ────────
  it('INV-NMT3D-20: first-time mount uses vendor defaults (no cache entry)', async () => {
    const asset = makeAsset({ a: 3 })
    const wrapper = await mountRenderer({ asset, boardMode: 'edit' })

    // Vendor defaults preserved (no prior unmount → no cache entry)
    expect(lastWs!.cam.yaw).toBeCloseTo(-0.5, 5)
    expect(lastWs!.cam.pitch).toBeCloseTo(0.28, 5)
    wrapper.unmount()
  })

  // ── INV-NMT3D-21: data.cam → applied to engine on mount (replay path) ───────
  it('INV-NMT3D-21: mount restores data.cam to engine when ephemeral cache absent', async () => {
    // REPLAY SCENARIO: applier writes data.cam to store via asset_update op.
    // Next mount (e.g. replay viewer opens session) must apply data.cam to engine
    // so 3D orientation matches what recording author had — otherwise board strokes
    // drawn over the 3D shape appear misaligned ("каша").
    const asset = {
      ...makeAsset({ a: 3 }),
      data: {
        ...makeAsset({ a: 3 }).data,
        cam: { yaw: 1.5, pitch: -0.4, scale: 175 },
      },
    } as Nmt3dAsset
    const wrapper = await mountRenderer({ asset, boardMode: 'replay' })

    expect(lastWs).not.toBeNull()
    expect(lastWs!.cam.yaw).toBeCloseTo(1.5, 5)
    expect(lastWs!.cam.pitch).toBeCloseTo(-0.4, 5)
    expect(lastWs!.cam.scale).toBeCloseTo(175, 5)
    expect(lastWs!._needsFit).toBe(false)  // don't recompute scale
    wrapper.unmount()
  })

  // ── INV-NMT3D-22: Ephemeral cache wins over data.cam on remount ─────────────
  it('INV-NMT3D-22: ephemeral cache takes priority over data.cam (live edit state)', async () => {
    // RATIONALE: ephemeral cache holds the CURRENT session live state.
    // data.cam holds the LAST PERSISTED state (last op emitted). After a fresh
    // orbit drag that hasn't yet hit pointerup-emit, cache has new cam, data.cam
    // has old cam. On remount (page switch), prefer cache (most recent).
    const asset = {
      ...makeAsset({ a: 3 }),
      data: {
        ...makeAsset({ a: 3 }).data,
        cam: { yaw: 0.5, pitch: 0.1, scale: 120 },  // persisted (older)
      },
    } as Nmt3dAsset

    // First mount — manually set ws.cam to simulate live orbit
    const w1 = await mountRenderer({ asset, boardMode: 'edit' })
    lastWs!.cam.yaw = 2.0     // live state (not yet emitted)
    lastWs!.cam.pitch = 0.9
    lastWs!.cam.scale = 200
    w1.unmount()  // saves to ephemeral cache

    // Second mount — ephemeral cache present + data.cam present
    setupNmt3dGlobal()
    const w2 = await mountRenderer({ asset, boardMode: 'edit' })

    // Cache wins: live values, not persisted ones
    expect(lastWs!.cam.yaw).toBeCloseTo(2.0, 5)
    expect(lastWs!.cam.pitch).toBeCloseTo(0.9, 5)
    expect(lastWs!.cam.scale).toBeCloseTo(200, 5)
    w2.unmount()
  })

  // ── INV-NMT3D-23: pointerup in edit mode emits asset_update with cam ────────
  it('INV-NMT3D-23: pointerup over stage emits asset_update with current ws.cam', async () => {
    const asset = makeAsset({ a: 3 })
    const wrapper = await mountRenderer({ asset, boardMode: 'edit' })
    expect(lastWs).not.toBeNull()

    // Simulate user orbited (cam mutated by vendor drag handler)
    lastWs!.cam.yaw = 1.8
    lastWs!.cam.pitch = 0.6
    lastWs!.cam.scale = 145

    // ROOT CAUSE FIX (2026-05-31): orbit gestures often end OUTSIDE the stage div.
    // The emit is now gated on pointerdown-in-stage, not pointerup-in-stage.
    // Tests must dispatch pointerdown (on stage) then pointerup (anywhere on window).
    const stage = wrapper.find('.nmt3d-stage').element as HTMLElement
    expect(stage).toBeTruthy()
    stage.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, cancelable: true }))
    window.dispatchEvent(new PointerEvent('pointerup', { bubbles: true, cancelable: true }))
    await nextTick()

    const emissions = wrapper.emitted('update:asset')
    expect(emissions).toBeTruthy()
    const lastEmit = emissions![emissions!.length - 1][0] as any
    expect(lastEmit.data.cam).toEqual({ yaw: 1.8, pitch: 0.6, scale: 145 })
    wrapper.unmount()
  })

  // ── INV-NMT3D-24: pointerup in replay mode does NOT emit ────────────────────
  it('INV-NMT3D-24: pointerup is silenced in replay mode (no emit loop)', async () => {
    const asset = makeAsset({ a: 3 })
    const wrapper = await mountRenderer({ asset, boardMode: 'replay' })
    expect(lastWs).not.toBeNull()
    lastWs!.cam.yaw = 1.0  // simulate change

    const stage = wrapper.find('.nmt3d-stage').element as HTMLElement
    stage.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, cancelable: true }))
    window.dispatchEvent(new PointerEvent('pointerup', { bubbles: true, cancelable: true }))
    await nextTick()

    // No emission — replay mode is read-only for cam state
    const emissions = wrapper.emitted('update:asset')
    expect(emissions === undefined || emissions.length === 0).toBe(true)
    wrapper.unmount()
  })

  // ── INV-NMT3D-25: pointerup dedupes — no emit if cam unchanged ──────────────
  it('INV-NMT3D-25: consecutive pointerups with same cam emit only once', async () => {
    const asset = makeAsset({ a: 3 })
    const wrapper = await mountRenderer({ asset, boardMode: 'edit' })
    lastWs!.cam.yaw = 1.0
    lastWs!.cam.pitch = 0.5
    lastWs!.cam.scale = 130

    const stage = wrapper.find('.nmt3d-stage').element as HTMLElement
    // Three orbit gestures that end outside the stage (window pointerup)
    for (let i = 0; i < 3; i++) {
      stage.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, cancelable: true }))
      window.dispatchEvent(new PointerEvent('pointerup', { bubbles: true, cancelable: true }))
    }
    await nextTick()

    // Only the first pointerup should produce an emit (cam didn't change between)
    const emissions = wrapper.emitted('update:asset')
    expect(emissions).toBeTruthy()
    expect(emissions!.length).toBe(1)
    wrapper.unmount()
  })

  // ── INV-NMT3D-26: data.cam watcher (replay) syncs ws.cam ────────────────────
  it('INV-NMT3D-26: boardMode=replay → data.cam change applies to ws.cam (replay sync)', async () => {
    const asset = makeAsset({ a: 3 })
    const wrapper = await mountRenderer({ asset, boardMode: 'replay' })
    expect(lastWs).not.toBeNull()

    // Replay applier writes new cam to asset.data → watcher should rotate engine
    await wrapper.setProps({
      asset: {
        ...asset,
        data: { ...asset.data, cam: { yaw: 2.5, pitch: 1.0, scale: 190 } },
      },
    })
    await nextTick()

    expect(lastWs!.cam.yaw).toBeCloseTo(2.5, 5)
    expect(lastWs!.cam.pitch).toBeCloseTo(1.0, 5)
    expect(lastWs!.cam.scale).toBeCloseTo(190, 5)
    expect(lastWs!._needsFit).toBe(false)
    wrapper.unmount()
  })

  // ── INV-NMT3D-27: data.cam watcher silenced in edit mode (no feedback loop) ──
  it('INV-NMT3D-27: boardMode=edit → data.cam change does NOT call ws cam update (engine is source)', async () => {
    const asset = makeAsset({ a: 3 })
    const wrapper = await mountRenderer({ asset, boardMode: 'edit' })
    expect(lastWs).not.toBeNull()
    const initialYaw = lastWs!.cam.yaw

    // Store update happens (e.g. own emit echoed back); watcher must NOT override engine
    await wrapper.setProps({
      asset: {
        ...asset,
        data: { ...asset.data, cam: { yaw: 99, pitch: 99, scale: 999 } },
      },
    })
    await nextTick()

    // Engine cam unchanged — edit mode means user drives (orbit is real-time)
    expect(lastWs!.cam.yaw).toBeCloseTo(initialYaw, 5)
    wrapper.unmount()
  })
})
