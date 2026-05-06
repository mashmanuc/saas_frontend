/**
 * Phase G.5 — graph_calculator tray + drop handler tests
 *
 * Per OPS_SYNC_SSOT.md INV-21 + UX-RULES 1-10:
 *   - UX-RULE-1: drop creates full valid asset (state + meta envelope)
 *   - UX-RULE-3: tray sets MIME with empty payload (no state injection)
 *   - UX-RULE-4: drop handler pure — only builds asset object
 *   - UX-RULE-9: initial size from constants (480×360)
 *   - UX-RULE-10: multiple instances independent (isolated IDs)
 */
import { describe, expect, it, vi, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { ref } from 'vue'

import GraphCalculatorTray from '../components/sidebar/GraphCalculatorTray.vue'
import { useContentDrop } from '../composables/useContentDrop'
import {
  DEFAULT_GRAPH_STATE,
  DEFAULT_GRAPH_WIDTH,
  DEFAULT_GRAPH_HEIGHT,
  GRAPH_CALCULATOR_MIME,
} from '../constants/graphCalculatorDefaults'
import type { WBAsset } from '../types/winterboard'

// ─── Helpers ───────────────────────────────────────────────────────────

function makeDataTransferStub(): DataTransfer {
  const data = new Map<string, string>()
  return {
    setData: (type: string, value: string) => { data.set(type, value) },
    getData: (type: string) => data.get(type) ?? '',
    setDragImage: () => {},
    clearData: () => { data.clear() },
    types: [],
    effectAllowed: 'none' as DataTransfer['effectAllowed'],
    dropEffect: 'none' as DataTransfer['dropEffect'],
    files: [] as unknown as FileList,
    items: [] as unknown as DataTransferItemList,
  } as unknown as DataTransfer
}

function makeDropEvent(mime: string, payload: string, clientX = 100, clientY = 200): DragEvent {
  const dt = makeDataTransferStub()
  dt.setData(mime, payload)
  return new (class extends Event {
    dataTransfer = dt
    clientX = clientX
    clientY = clientY
  })('drop') as unknown as DragEvent
}

// ─── GraphCalculatorTray ────────────────────────────────────────────────

describe('GraphCalculatorTray (Phase G.5)', () => {
  it('UX-RULE-3: dragstart sets graph MIME with empty payload (no state injection)', async () => {
    const wrapper = mount(GraphCalculatorTray)
    const btn = wrapper.find('[data-testid="graph-calculator-tray-btn"]')
    expect(btn.exists()).toBe(true)

    const dt = makeDataTransferStub()
    const event = new (class extends Event {
      dataTransfer = dt
    })('dragstart') as unknown as DragEvent

    await btn.trigger('dragstart', event)

    // The component handles dragstart internally — assert via setData
    // (we manipulate dt directly through the wrapper's event-handling).
    // Since vue-test-utils trigger creates a fresh DragEvent without our dt,
    // we simulate by calling dragstart handler directly:
    const handler = (btn.element as HTMLElement).ondragstart
    if (handler) {
      const dataEvent = { dataTransfer: dt, preventDefault: () => {} } as unknown as DragEvent
      handler.call(btn.element, dataEvent)
    } else {
      // Fallback: manually invoke
      ;(wrapper.vm as any).$.setupState?.onDragStart?.({ dataTransfer: dt } as DragEvent)
    }
    // Either way, after dragstart the MIME should be set. Re-fire via
    // raw event to ensure handler invocation:
    ;(btn.element as HTMLElement).dispatchEvent(
      Object.assign(new Event('dragstart', { bubbles: true }), { dataTransfer: dt }),
    )

    const raw = dt.getData(GRAPH_CALCULATOR_MIME)
    expect(raw).toBe(JSON.stringify({}))
    expect(dt.effectAllowed).toBe('copy')
  })

  it('UX-RULE-3: payload contains NO expressions/params/viewport', async () => {
    const wrapper = mount(GraphCalculatorTray)
    const dt = makeDataTransferStub()
    const btn = wrapper.find('[data-testid="graph-calculator-tray-btn"]')
    ;(btn.element as HTMLElement).dispatchEvent(
      Object.assign(new Event('dragstart', { bubbles: true }), { dataTransfer: dt }),
    )
    const raw = dt.getData(GRAPH_CALCULATOR_MIME)
    const parsed = JSON.parse(raw)
    expect(parsed.expressions).toBeUndefined()
    expect(parsed.params).toBeUndefined()
    expect(parsed.viewport).toBeUndefined()
  })
})

// ─── useContentDrop graph_calculator branch ─────────────────────────────

describe('useContentDrop graph_calculator (Phase G.5)', () => {
  let onAssetAdd: ReturnType<typeof vi.fn>
  let drop: ReturnType<typeof useContentDrop>

  beforeEach(() => {
    onAssetAdd = vi.fn()
    drop = useContentDrop({
      sessionId: ref('test-session'),
      canDraw: ref(true),
      onAssetAdd,
      screenToCanvas: (x, y) => ({ x, y }),
    })
  })

  it('UX-RULE-1: drop creates asset with full state + meta envelope', async () => {
    const event = makeDropEvent(GRAPH_CALCULATOR_MIME, '{}', 240, 180)
    await drop.handleCanvasDrop(event)
    expect(onAssetAdd).toHaveBeenCalledTimes(1)
    const asset = onAssetAdd.mock.calls[0][0] as WBAsset
    expect(asset.type).toBe('graph_calculator')
    expect((asset.data as any).version).toBe(1)
    expect((asset.data as any).state.expressions).toEqual(DEFAULT_GRAPH_STATE.expressions)
    expect((asset.data as any).state.params).toEqual(DEFAULT_GRAPH_STATE.params)
    expect((asset.data as any).state.viewport).toEqual(DEFAULT_GRAPH_STATE.viewport)
    expect((asset.data as any).meta).toBeDefined()
    expect((asset.data as any).meta.last_snapshot_seq).toBe(0)
  })

  it('UX-RULE-9: initial size from constants (480×360); centered on drop point', async () => {
    const event = makeDropEvent(GRAPH_CALCULATOR_MIME, '{}', 1000, 500)
    await drop.handleCanvasDrop(event)
    const asset = onAssetAdd.mock.calls[0][0] as WBAsset
    expect(asset.w).toBe(DEFAULT_GRAPH_WIDTH)
    expect(asset.h).toBe(DEFAULT_GRAPH_HEIGHT)
    // Centered: x = clientX - w/2, y = clientY - h/2
    expect(asset.x).toBe(1000 - DEFAULT_GRAPH_WIDTH / 2)
    expect(asset.y).toBe(500 - DEFAULT_GRAPH_HEIGHT / 2)
  })

  it('UX-RULE-10: multiple drops generate independent IDs', async () => {
    await drop.handleCanvasDrop(makeDropEvent(GRAPH_CALCULATOR_MIME, '{}'))
    await drop.handleCanvasDrop(makeDropEvent(GRAPH_CALCULATOR_MIME, '{}'))
    expect(onAssetAdd).toHaveBeenCalledTimes(2)
    const a1 = onAssetAdd.mock.calls[0][0] as WBAsset
    const a2 = onAssetAdd.mock.calls[1][0] as WBAsset
    expect(a1.id).not.toBe(a2.id)
  })

  it('UX-RULE-1: state objects are deep-cloned (not shared reference with constants)', async () => {
    const event = makeDropEvent(GRAPH_CALCULATOR_MIME, '{}')
    await drop.handleCanvasDrop(event)
    const asset = onAssetAdd.mock.calls[0][0] as WBAsset
    const dataState = (asset.data as any).state
    // Mutating asset state must NOT mutate DEFAULT_GRAPH_STATE.
    dataState.params.test = 99
    expect(DEFAULT_GRAPH_STATE.params.test).toBeUndefined()
    dataState.viewport.cx = 999
    expect(DEFAULT_GRAPH_STATE.viewport.cx).toBe(0)
  })

  it('UX-RULE-4: handler is pure — does not crash without sessionId', async () => {
    const drop2 = useContentDrop({
      sessionId: ref(null),
      canDraw: ref(true),
      onAssetAdd,
      screenToCanvas: (x, y) => ({ x, y }),
    })
    const event = makeDropEvent(GRAPH_CALCULATOR_MIME, '{}')
    await expect(drop2.handleCanvasDrop(event)).resolves.toBeUndefined()
    expect(onAssetAdd).toHaveBeenCalled()
  })

  it('respects canDraw=false (no asset added)', async () => {
    const drop2 = useContentDrop({
      sessionId: ref('s'),
      canDraw: ref(false),
      onAssetAdd,
      screenToCanvas: (x, y) => ({ x, y }),
    })
    const event = makeDropEvent(GRAPH_CALCULATOR_MIME, '{}')
    await drop2.handleCanvasDrop(event)
    expect(onAssetAdd).not.toHaveBeenCalled()
  })

  it('asset includes type=graph_calculator and src field for WBAsset shape compat', async () => {
    const event = makeDropEvent(GRAPH_CALCULATOR_MIME, '{}')
    await drop.handleCanvasDrop(event)
    const asset = onAssetAdd.mock.calls[0][0] as WBAsset
    expect(asset.type).toBe('graph_calculator')
    expect(asset.src).toBe('') // graph_calculator не використовує src, але поле required
    expect(asset.locked).toBe(false)
    expect(asset.rotation).toBe(0)
  })
})
