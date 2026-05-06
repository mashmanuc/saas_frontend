/**
 * Phase G GraphCalculatorRenderer.vue tests
 *
 * Per OPS_SYNC_SSOT.md INV-21 + FE-RULES 1-12.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { nextTick } from 'vue'

import type { WBAsset } from '../types/winterboard'
import type { GraphCalculatorState } from '../types/graphCalculator'

// ─── Mock vendor module ────────────────────────────────────────────────
class MockGraphCalculator {
  public expressions: any[] = []
  public params: Record<string, number> = {}
  public viewport = { cx: 0, cy: 0, scale: 38 }
  public opts: any
  public onChange: (() => void) | null = null

  public setStateSpy = vi.fn()
  public addExpressionSpy = vi.fn()
  public removeExpressionSpy = vi.fn()
  public updateExpressionSpy = vi.fn()
  public setParamValueSpy = vi.fn()
  public setHiddenSpy = vi.fn()
  public destroySpy = vi.fn()

  constructor(_container: HTMLElement, opts: any = {}) {
    this.opts = opts
  }
  setState(state: any) {
    this.setStateSpy(state)
    if (state.expressions) this.expressions = state.expressions.map((e: any) => ({ ...e, classified: null }))
    if (state.params) this.params = { ...state.params }
    if (state.viewport) this.viewport = { ...state.viewport }
    if (this.onChange) this.onChange()
  }
  getState(): GraphCalculatorState {
    return {
      expressions: this.expressions.map((e) => ({
        id: e.id, src: e.src, color: e.color, hidden: !!e.hidden,
        ...(e.paramRange ? { paramRange: { ...e.paramRange } } : {}),
      })),
      params: { ...this.params } as any,
      viewport: { ...this.viewport },
    }
  }
  addExpression(src: string, id: string) {
    this.addExpressionSpy(src, id)
    this.expressions.push({ id, src, color: '#abc', hidden: false, paramRange: { min: -10, max: 10, step: 0.01 } })
    if (this.onChange) this.onChange()
  }
  removeExpression(id: string) {
    this.removeExpressionSpy(id)
    this.expressions = this.expressions.filter((e) => e.id !== id)
    if (this.onChange) this.onChange()
  }
  updateExpression(id: string, src: string) {
    this.updateExpressionSpy(id, src)
    const e = this.expressions.find((x) => x.id === id)
    if (e) e.src = src
    if (this.onChange) this.onChange()
  }
  setParamValue(name: string, value: number) {
    this.setParamValueSpy(name, value)
    this.params[name] = value
  }
  setHidden(id: string, hidden: boolean) {
    this.setHiddenSpy(id, hidden)
    const e = this.expressions.find((x) => x.id === id)
    if (e) e.hidden = hidden
    if (this.onChange) this.onChange()
  }
  destroy() { this.destroySpy() }
}

vi.mock('../vendor/graph_calculator/graph-calculator.js', () => ({
  GraphCalculator: MockGraphCalculator,
  default: MockGraphCalculator,
  GraphCalc: {},
}))

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'performance'] })
})
afterEach(() => {
  vi.useRealTimers()
  vi.clearAllMocks()
})

// ─── Test fixture builder ──────────────────────────────────────────────

function makeAsset(opts: { snapshotSeq?: number; expressions?: any[] } = {}): WBAsset {
  const asset: any = {
    id: 'gc-1',
    type: 'graph_calculator',
    src: '',
    x: 0, y: 0, w: 480, h: 360,
    rotation: 0,
    locked: false,
    data: {
      version: 1,
      state: {
        expressions: opts.expressions || [],
        params: {},
        viewport: { cx: 0, cy: 0, scale: 38 },
      },
      ...(opts.snapshotSeq && opts.snapshotSeq > 0
        ? { meta: { last_snapshot_seq: opts.snapshotSeq } }
        : {}),
    },
  }
  return asset as WBAsset
}

async function loadComponent() {
  return (await import('../components/board/objects/GraphCalculatorRenderer.vue')).default
}

const E_BASE = { id: 'e1', src: 'y=x^2', color: '#abc', hidden: false }
const E_ALT = { id: 'e1', src: 'y=999', color: '#abc', hidden: false }

// ─── Tests ─────────────────────────────────────────────────────────────

describe('GraphCalculatorRenderer (Phase G)', () => {
  it('FE-RULE-12: mounts and applies initial state without emitting echo', async () => {
    const Renderer = await loadComponent()
    const asset = makeAsset({ snapshotSeq: 5, expressions: [E_BASE] })
    const wrapper = mount(Renderer, { props: { asset } })
    await nextTick()
    expect(wrapper.emitted('update:asset')).toBeUndefined()
    expect(wrapper.emitted('param-set')).toBeUndefined()
    wrapper.unmount()
  })

  it('FE-RULE-7: skips applyState when signature equal', async () => {
    const Renderer = await loadComponent()
    const asset = makeAsset({ snapshotSeq: 1, expressions: [E_BASE] })
    const wrapper = mount(Renderer, { props: { asset } })
    await nextTick()
    const same = makeAsset({ snapshotSeq: 1, expressions: [{ ...E_BASE }] })
    await wrapper.setProps({ asset: same })
    await nextTick()
    expect(wrapper.emitted('update:asset')).toBeUndefined()
    wrapper.unmount()
  })

  it('FE-RULE-8: skips applyState when incomingSeq < lastAppliedSeq (stale)', async () => {
    const Renderer = await loadComponent()
    const asset = makeAsset({ snapshotSeq: 10, expressions: [E_BASE] })
    const wrapper = mount(Renderer, { props: { asset } })
    await nextTick()
    const stale = makeAsset({ snapshotSeq: 5, expressions: [E_ALT] })
    await wrapper.setProps({ asset: stale })
    await nextTick()
    expect(wrapper.emitted('update:asset')).toBeUndefined()
    wrapper.unmount()
  })

  it('FE-RULE-10: flushes pending snapshot on unmount', async () => {
    const Renderer = await loadComponent()
    const asset = makeAsset({ snapshotSeq: 1 })
    const wrapper = mount(Renderer, { props: { asset } })
    await nextTick()
    const addBtn = wrapper.find('[data-testid="graph-calc-add-expr"]')
    await addBtn.trigger('click')
    await nextTick()
    wrapper.unmount()
    const updates = wrapper.emitted('update:asset')
    expect(updates).toBeTruthy()
    expect(updates!.length).toBeGreaterThanOrEqual(1)
  })

  it('FE-RULE-5: snapshot debounced ~150ms (one emit per burst of 5 changes)', async () => {
    const Renderer = await loadComponent()
    const asset = makeAsset({ snapshotSeq: 1, expressions: [E_BASE] })
    const wrapper = mount(Renderer, { props: { asset } })
    await nextTick()
    const input = wrapper.find('.gc-input')
    for (const v of ['y=x', 'y=x+', 'y=x+1', 'y=x+1.', 'y=x+1.5']) {
      await input.setValue(v)
    }
    vi.advanceTimersByTime(100)
    expect(wrapper.emitted('update:asset')).toBeUndefined()
    vi.advanceTimersByTime(100)
    await nextTick()
    expect(wrapper.emitted('update:asset')!.length).toBe(1)
    wrapper.unmount()
  })

  it('readonly mode: panel hidden when interactive=false', async () => {
    const Renderer = await loadComponent()
    const asset = makeAsset({ snapshotSeq: 1 })
    const wrapper = mount(Renderer, { props: { asset, interactive: false } })
    await nextTick()
    expect(wrapper.find('.gc-panel').exists()).toBe(false)
    expect(wrapper.find('.gc-add-btn').exists()).toBe(false)
    wrapper.unmount()
  })
})
