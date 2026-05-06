/**
 * Phase G4 — GraphCalculator param-mode toggle (g4_inv_1..10).
 *
 * Per PHASE_G4_CONTEXT_SIDEBAR_SPEC.md §5+§6+§9.
 * Verifies UI-layer toggle + engine.opts.interactionMode integration +
 * context sidebar quick-add.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { nextTick } from 'vue'

import type { WBAsset } from '../types/winterboard'
import {
  __resetGraphCalcUiForTests,
  getGraphCalcUi,
} from '../board/state/graphCalculatorUiState'

// ─── Hoisted mock state (visible inside vi.mock factory) ───────────────
const mockState = vi.hoisted(() => ({
  lastInstance: null as any,
  instances: [] as any[],
}))

vi.mock('../vendor/graph_calculator/graph-calculator.js', () => {
  class MockGraphCalculator {
    public expressions: any[] = []
    public params: Record<string, any> = {}
    public viewport = { cx: 0, cy: 0, scale: 38 }
    public points: Record<string, any> = {}
    public opts: any
    public onChange: (() => void) | null = null
    public onParamDrag: ((name: string, value: number) => void) | null = null
    public onParamDragEnd: ((name: string | undefined) => void) | null = null
    public onPointDrag: ((id: string, x: number, y: number) => void) | null = null
    public onPointDragEnd: ((id: string, x: number, y: number) => void) | null = null

    constructor(_container: HTMLElement, opts: any = {}) {
      this.opts = opts
      mockState.lastInstance = this
      mockState.instances.push(this)
    }
    setState(state: any) {
      if (state.expressions) this.expressions = state.expressions.map((e: any) => ({ ...e, classified: null }))
      if (state.params) this.params = { ...state.params }
      if (state.viewport) this.viewport = { ...state.viewport }
      if (this.onChange) this.onChange()
    }
    getState() {
      return {
        expressions: this.expressions.map((e) => ({
          id: e.id, src: e.src, color: e.color, hidden: !!e.hidden,
        })),
        params: { ...this.params } as any,
        viewport: { ...this.viewport },
        points: { ...this.points },
      }
    }
    addExpression(src: string, id: string) {
      this.expressions.push({ id, src, color: '#abc', hidden: false })
      if (this.onChange) this.onChange()
    }
    removeExpression(id: string) {
      this.expressions = this.expressions.filter((e) => e.id !== id)
      if (this.onChange) this.onChange()
    }
    updateExpression(id: string, src: string) {
      const e = this.expressions.find((x) => x.id === id)
      if (e) e.src = src
      if (this.onChange) this.onChange()
    }
    setParamValue(name: string, value: number) {
      // Mirror real engine: params entries are objects with .value
      if (this.params[name] && typeof this.params[name] === 'object') {
        this.params[name].value = value
      } else {
        this.params[name] = { value, min: -10, max: 10, step: 0.1 }
      }
    }
    setHidden(id: string, hidden: boolean) {
      const e = this.expressions.find((x) => x.id === id)
      if (e) e.hidden = hidden
      if (this.onChange) this.onChange()
    }
    destroy() { /* no-op */ }
  }

  return {
    GraphCalculator: MockGraphCalculator,
    default: MockGraphCalculator,
    GraphCalc: {},
  }
})

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'performance'] })
  mockState.lastInstance = null
  mockState.instances = []
  __resetGraphCalcUiForTests()
})
afterEach(() => {
  vi.useRealTimers()
  vi.clearAllMocks()
})

// ─── Fixture ────────────────────────────────────────────────────────────

function makeAsset(opts: {
  id?: string
  paramCount?: number  // 0, 1, or 2
  snapshotSeq?: number
} = {}): WBAsset {
  const id = opts.id || 'gc-1'
  const params: Record<string, { value: number; min: number; max: number; step: number }> = {}
  if (opts.paramCount === 1) {
    params.a = { value: 1, min: -10, max: 10, step: 0.1 }
  } else if (opts.paramCount === 2) {
    params.a = { value: 1, min: -10, max: 10, step: 0.1 }
    params.b = { value: 2, min: -10, max: 10, step: 0.1 }
  }
  const expressions = opts.paramCount && opts.paramCount > 0
    ? [{ id: 'e1', src: 'y=a*x', color: '#abc', hidden: false }]
    : []
  return {
    id,
    type: 'graph_calculator',
    src: '',
    x: 0, y: 0, w: 480, h: 360,
    rotation: 0,
    locked: false,
    data: {
      version: 1,
      state: { expressions, params, viewport: { cx: 0, cy: 0, scale: 38 } },
      ...(opts.snapshotSeq && opts.snapshotSeq > 0
        ? { meta: { last_snapshot_seq: opts.snapshotSeq } }
        : {}),
    },
  } as unknown as WBAsset
}

async function loadRenderer() {
  return (await import('../components/board/objects/GraphCalculatorRenderer.vue')).default
}

function dispatchKey(type: 'keydown' | 'keyup', key: string) {
  window.dispatchEvent(new KeyboardEvent(type, { key }))
}

// ─── Renderer toggle tests ──────────────────────────────────────────────

describe('GraphCalculatorRenderer — Phase G4 param-mode toggle', () => {
  it('g4_inv_3: toggle button renders and reflects paramMode state', async () => {
    const Renderer = await loadRenderer()
    const asset = makeAsset({ paramCount: 1 })
    const wrapper = mount(Renderer, { props: { asset } })
    await nextTick()

    const btn = wrapper.find('[data-testid="graph-calc-param-mode-btn"]')
    expect(btn.exists()).toBe(true)
    expect(btn.classes()).not.toContain('is-active')

    await btn.trigger('click')
    await nextTick()
    expect(wrapper.find('[data-testid="graph-calc-param-mode-btn"]').classes()).toContain('is-active')
    expect(getGraphCalcUi(asset.id).paramMode).toBe(true)

    wrapper.unmount()
  })

  it('g4_inv_2: engine receives effectiveMode via opts.interactionMode (no engine state)', async () => {
    const Renderer = await loadRenderer()
    const asset = makeAsset({ paramCount: 1 })
    const wrapper = mount(Renderer, { props: { asset } })
    await nextTick()

    expect(mockState.lastInstance.opts.interactionMode).toBe('normal')

    await wrapper.find('[data-testid="graph-calc-param-mode-btn"]').trigger('click')
    await nextTick()
    expect(mockState.lastInstance.opts.interactionMode).toBe('param')

    await wrapper.find('[data-testid="graph-calc-param-mode-btn"]').trigger('click')
    await nextTick()
    expect(mockState.lastInstance.opts.interactionMode).toBe('normal')

    wrapper.unmount()
  })

  it('g4_inv_3: Shift held → effectiveMode flips to param even when toggle off', async () => {
    const Renderer = await loadRenderer()
    const asset = makeAsset({ paramCount: 1 })
    const wrapper = mount(Renderer, { props: { asset } })
    await nextTick()
    expect(mockState.lastInstance.opts.interactionMode).toBe('normal')

    dispatchKey('keydown', 'Shift')
    await nextTick()
    expect(mockState.lastInstance.opts.interactionMode).toBe('param')

    dispatchKey('keyup', 'Shift')
    await nextTick()
    expect(mockState.lastInstance.opts.interactionMode).toBe('normal')

    wrapper.unmount()
  })

  it('g4_inv_9: Shift release while toggle=on → mode залишається param (sticky)', async () => {
    const Renderer = await loadRenderer()
    const asset = makeAsset({ paramCount: 1 })
    const wrapper = mount(Renderer, { props: { asset } })
    await nextTick()
    await wrapper.find('[data-testid="graph-calc-param-mode-btn"]').trigger('click')
    await nextTick()
    expect(mockState.lastInstance.opts.interactionMode).toBe('param')

    dispatchKey('keydown', 'Shift')
    await nextTick()
    expect(mockState.lastInstance.opts.interactionMode).toBe('param')

    dispatchKey('keyup', 'Shift')
    await nextTick()
    // toggle still on → still param
    expect(mockState.lastInstance.opts.interactionMode).toBe('param')

    wrapper.unmount()
  })

  it('g4_inv_10: Shift release while toggle=off → mode normal (default)', async () => {
    const Renderer = await loadRenderer()
    const asset = makeAsset({ paramCount: 1 })
    const wrapper = mount(Renderer, { props: { asset } })
    await nextTick()
    dispatchKey('keydown', 'Shift')
    await nextTick()
    expect(mockState.lastInstance.opts.interactionMode).toBe('param')
    dispatchKey('keyup', 'Shift')
    await nextTick()
    expect(mockState.lastInstance.opts.interactionMode).toBe('normal')
    wrapper.unmount()
  })

  it('g4_inv_8: per-asset state — toggle one instance, other unaffected', async () => {
    const Renderer = await loadRenderer()
    const a1 = makeAsset({ id: 'gc-A', paramCount: 1 })
    const a2 = makeAsset({ id: 'gc-B', paramCount: 1 })
    const w1 = mount(Renderer, { props: { asset: a1 } })
    const w2 = mount(Renderer, { props: { asset: a2 } })
    await nextTick()

    await w1.find('[data-testid="graph-calc-param-mode-btn"]').trigger('click')
    await nextTick()

    expect(getGraphCalcUi('gc-A').paramMode).toBe(true)
    expect(getGraphCalcUi('gc-B').paramMode).toBe(false)
    expect(mockState.instances[0].opts.interactionMode).toBe('param')
    expect(mockState.instances[1].opts.interactionMode).toBe('normal')

    w1.unmount()
    w2.unmount()
  })

  it('toggle disabled when 0 params (no candidate)', async () => {
    const Renderer = await loadRenderer()
    const asset = makeAsset({ paramCount: 0 })
    const wrapper = mount(Renderer, { props: { asset } })
    await nextTick()
    const btn = wrapper.find('[data-testid="graph-calc-param-mode-btn"]')
    expect((btn.element as HTMLButtonElement).disabled).toBe(true)
    wrapper.unmount()
  })

  it('toggle disabled when 2+ params (multi-param picker not in v1)', async () => {
    const Renderer = await loadRenderer()
    const asset = makeAsset({ paramCount: 2 })
    const wrapper = mount(Renderer, { props: { asset } })
    await nextTick()
    const btn = wrapper.find('[data-testid="graph-calc-param-mode-btn"]')
    expect((btn.element as HTMLButtonElement).disabled).toBe(true)
    // Click while disabled — toggle stays off (browser default; our guard
    // also prevents change у JS layer).
    await btn.trigger('click')
    await nextTick()
    expect(getGraphCalcUi(asset.id).paramMode).toBe(false)
    wrapper.unmount()
  })

  it('toggle hidden when interactive=false (read-only / replay)', async () => {
    const Renderer = await loadRenderer()
    const asset = makeAsset({ paramCount: 1 })
    const wrapper = mount(Renderer, { props: { asset, interactive: false } })
    await nextTick()
    expect(wrapper.find('[data-testid="graph-calc-param-mode-btn"]').exists()).toBe(false)
    wrapper.unmount()
  })

  it('flush-on-mode-leave: switching from param→normal mid-drag flushes pending param-set', async () => {
    const Renderer = await loadRenderer()
    const asset = makeAsset({ paramCount: 1, snapshotSeq: 5 })
    const wrapper = mount(Renderer, { props: { asset } })
    await nextTick()

    // Enter param mode via toggle.
    await wrapper.find('[data-testid="graph-calc-param-mode-btn"]').trigger('click')
    await nextTick()

    // Simulate engine onParamDrag firing 2 ticks fast — both stuck у throttle
    // pending (fake timer перформенс=0 → перший виклик теж не emit'ить immediately).
    const inst = mockState.lastInstance
    inst.onParamDrag('a', 1.5)
    inst.onParamDrag('a', 2.7)  // overwrites pending (last value wins)
    await nextTick()

    // Leave param mode WITHOUT pointerup (toggle off).
    await wrapper.find('[data-testid="graph-calc-param-mode-btn"]').trigger('click')
    await nextTick()

    // Pending value MUST be flushed — exactly final value as op.
    const emits = wrapper.emitted('param-set') ?? []
    expect(emits.length).toBeGreaterThanOrEqual(1)
    expect(emits[emits.length - 1]?.[1]).toBe(2.7)

    wrapper.unmount()
  })

  it('flush-on-window-blur: blur during drag flushes pending param-set', async () => {
    const Renderer = await loadRenderer()
    const asset = makeAsset({ paramCount: 1, snapshotSeq: 5 })
    const wrapper = mount(Renderer, { props: { asset } })
    await nextTick()

    const inst = mockState.lastInstance
    inst.onParamDrag('a', 0.5)
    inst.onParamDrag('a', 0.9)  // pending overwrites
    await nextTick()

    // Window blur (Alt+Tab, OS notification, app switch on tablet).
    window.dispatchEvent(new Event('blur'))
    await nextTick()

    const emits = wrapper.emitted('param-set') ?? []
    expect(emits.length).toBeGreaterThanOrEqual(1)
    expect(emits[emits.length - 1]?.[1]).toBe(0.9)

    wrapper.unmount()
  })

  it('g4_inv_1+g4_inv_7: toggle does NOT emit any op-style events (UI-only)', async () => {
    const Renderer = await loadRenderer()
    const asset = makeAsset({ paramCount: 1, snapshotSeq: 5 })
    const wrapper = mount(Renderer, { props: { asset } })
    await nextTick()

    await wrapper.find('[data-testid="graph-calc-param-mode-btn"]').trigger('click')
    await nextTick()
    vi.advanceTimersByTime(500) // allow any debounced emits to fire
    await nextTick()

    // Toggle alone must NOT trigger update:asset / param-set / param-sync.
    expect(wrapper.emitted('update:asset')).toBeUndefined()
    expect(wrapper.emitted('param-set')).toBeUndefined()
    expect(wrapper.emitted('param-sync')).toBeUndefined()
    expect(wrapper.emitted('range-set')).toBeUndefined()
    expect(wrapper.emitted('point-add')).toBeUndefined()
    expect(wrapper.emitted('point-set')).toBeUndefined()
    expect(wrapper.emitted('point-delete')).toBeUndefined()
    expect(wrapper.emitted('point-promote')).toBeUndefined()

    wrapper.unmount()
  })
})

// ─── Inline quick-add tests (renderer panel) ──────────────────────────

describe('GraphCalculatorRenderer — Phase G4 inline quick-add + help hint', () => {
  it('quick-add buttons rendered у renderer panel (4 templates)', async () => {
    const Renderer = await loadRenderer()
    const asset = makeAsset({ paramCount: 0 })
    const wrapper = mount(Renderer, { props: { asset } })
    await nextTick()
    expect(wrapper.find('[data-testid="graph-calc-quick-linear"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="graph-calc-quick-sin"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="graph-calc-quick-parabola"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="graph-calc-quick-circle"]').exists()).toBe(true)
    wrapper.unmount()
  })

  it('quick-add click → calc.addExpression(src, uuid) called', async () => {
    const Renderer = await loadRenderer()
    const asset = makeAsset({ paramCount: 0 })
    const wrapper = mount(Renderer, { props: { asset } })
    await nextTick()
    const inst = mockState.lastInstance
    const spy = vi.spyOn(inst, 'addExpression')
    await wrapper.find('[data-testid="graph-calc-quick-sin"]').trigger('click')
    await nextTick()
    expect(spy).toHaveBeenCalledTimes(1)
    expect(spy.mock.calls[0][0]).toBe('y = a*sin(x)')
    expect(typeof spy.mock.calls[0][1]).toBe('string')  // uuid
    wrapper.unmount()
  })

  it('quick-add hidden when interactive=false', async () => {
    const Renderer = await loadRenderer()
    const asset = makeAsset({ paramCount: 0 })
    const wrapper = mount(Renderer, { props: { asset, interactive: false } })
    await nextTick()
    expect(wrapper.find('[data-testid="graph-calc-quick-sin"]').exists()).toBe(false)
    wrapper.unmount()
  })

  it('help hint shown only when params exist', async () => {
    const Renderer = await loadRenderer()
    const noParams = makeAsset({ paramCount: 0 })
    const w1 = mount(Renderer, { props: { asset: noParams } })
    await nextTick()
    expect(w1.find('.gc-help-hint').exists()).toBe(false)
    w1.unmount()

    const withParams = makeAsset({ id: 'gc-2', paramCount: 1 })
    const w2 = mount(Renderer, { props: { asset: withParams } })
    await nextTick()
    expect(w2.find('.gc-help-hint').exists()).toBe(true)
    w2.unmount()
  })
})
