/**
 * Власник 2026-10-22: «так, роби кнопку зліва… туди лінійку й циркуль» і «треба зробити в косу лінійку
 * і в лінійку… менш прозорим, щоб видно було… синя має бути, як зошит».
 *  - ліва панель: «Креслярські інструменти» після лінії й фігур; лише де кімната вміє вставляти;
 *  - фон сторінки: «в косу лінію»; зошитові види — синім, лінія всередині плитки, не на краю.
 */
import { mount } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { nextTick } from 'vue'
import { ADD_TOOL_TO_BOARD_KEY } from '../composables/useAddToolToBoard'
import { RULER_DRAG_MIME } from '../constants/rulerDefaults'
import { GRID_OPTIONS, useGridOverlay } from '../composables/useGridOverlay'
import {
  NOTEBOOK_INK, SLANTED_GAP_PX, SLANTED_ROW_PX, SLANTED_TILE_H, SLANTED_TILE_W, _applyGridToCanvas,
} from '../composables/usePageGrid'
import { useWBStore } from '../board/state/boardStore'
import type { WBPageGridSettings } from '../types/winterboard'

const ICON_STUBS = {
  WBIconPen: true, WBIconHighlighter: true, WBIconEraser: true, WBIconLine: true,
  WBIconRectangle: true, WBIconCircle: true, WBIconText: true, WBIconSelect: true,
  WBIconUndo: true, WBIconRedo: true, WBIconTrash: true, WBIconLaser: true,
  WBIconSticky: true, WBIconLock: true, WBIconUnlock: true,
}

async function mountToolbar(addTool?: (mime: string, payload: string) => void) {
  const WBToolbar = (await import('../components/toolbar/WBToolbar.vue')).default
  return mount(WBToolbar, {
    props: { variant: 'desktop', currentTool: 'pen' } as any,
    attachTo: document.body,
    global: {
      stubs: ICON_STUBS,
      mocks: { $t: (key: string) => key },
      provide: addTool ? { [ADD_TOOL_TO_BOARD_KEY as symbol]: addTool } : {},
    },
  })
}

/** Кнопки групи інструментів у порядку DOM: інструмент — клавіша з мітки, стиль — STYLE, креслення — DRAFT. */
function toolGroupOrder(wrapper: any): string[] {
  return wrapper.find('[role="group"]').findAll('button').map((b: any) => {
    if (b.classes().includes('wb-color-flyout__trigger')) return 'STYLE'
    if (b.attributes('data-testid') === 'wb-drafting-trigger') return 'DRAFT'
    return String(b.attributes('aria-label')).match(/\((\w)\)$/)?.[1] ?? '?'
  })
}

describe('ліва панель — «Креслярські інструменти»', () => {
  afterEach(() => { document.body.innerHTML = '' })

  it('кнопка стоїть одразу після лінії, прямокутника й кола; пункт «Лінійка» кладе лінійку на дошку', async () => {
    const addTool = vi.fn()
    const w = await mountToolbar(addTool)
    expect(toolGroupOrder(w)).toEqual(['V', 'P', 'H', 'STYLE', 'L', 'R', 'C', 'DRAFT', 'T', 'E', 'F', 'S'])

    await w.find('[data-testid="wb-drafting-trigger"]').trigger('click')
    const item = document.querySelector<HTMLButtonElement>('[data-testid="wb-drafting-instruments.ruler"]')
    expect(item).not.toBeNull()
    item!.click()
    await w.vm.$nextTick()
    expect(addTool).toHaveBeenCalledTimes(1)
    expect(addTool).toHaveBeenCalledWith(RULER_DRAG_MIME, '{}')
    expect(document.querySelector('[data-testid="wb-drafting-menu"]')).toBeNull()
    w.unmount()
  })

  it('стрілками кнопка досяжна, як інші: у групі рівно одна кнопка з tabindex 0', async () => {
    const w = await mountToolbar(vi.fn())
    const zero = w.find('[role="group"]').findAll('button').filter((b: any) => b.attributes('tabindex') === '0')
    expect(zero).toHaveLength(1)
    w.unmount()
  })

  it('кімната без вставки (не дає функції) — кнопки немає, порядок як був', async () => {
    const w = await mountToolbar()
    expect(w.find('[data-testid="wb-drafting-trigger"]').exists()).toBe(false)
    expect(toolGroupOrder(w)).toEqual(['V', 'P', 'H', 'STYLE', 'L', 'R', 'C', 'T', 'E', 'F', 'S'])
    w.unmount()
  })
})

// ─── Фон сторінки ───────────────────────────────────────────────────────────

interface Recorded { width: number; height: number; strokes: Array<{ ink: string; alpha: number; moves: number[][] }> }

/** Полотно jsdom не малює — підміняємо контекст записувачем: що й де накреслено. */
function recordCanvas(): Recorded {
  const rec: Recorded = { width: 0, height: 0, strokes: [] }
  let moves: number[][] = []
  const ctx: any = {
    strokeStyle: '', fillStyle: '', lineWidth: 1, globalAlpha: 1,
    clearRect() {}, beginPath() { moves = [] }, arc() {}, fill() {},
    moveTo(x: number, y: number) { moves.push([x, y]) },
    lineTo(x: number, y: number) { moves[moves.length - 1].push(x, y) },
    stroke() { rec.strokes.push({ ink: ctx.strokeStyle, alpha: ctx.globalAlpha, moves }) },
  }
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockImplementation(function (this: HTMLCanvasElement) {
    return ctx
  } as any)
  vi.spyOn(HTMLCanvasElement.prototype, 'toDataURL').mockImplementation(function (this: HTMLCanvasElement) {
    rec.width = this.width
    rec.height = this.height
    return 'data:image/png;base64,'
  })
  return rec
}

function grid(style: WBPageGridSettings['style'], size: number, opacity = 0.1): WBPageGridSettings {
  return { enabled: true, style, size, color: '#000000', opacity }
}

describe('фон сторінки — зошитові види', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    const store = useWBStore()
    store.$patch({ workspaceId: 'ws', pages: [{ id: 'p1', name: '1', strokes: [], assets: [] }], currentPageIndex: 0 })
  })
  afterEach(() => { vi.restoreAllMocks() })

  it('у меню фону є «в косу лінію» одразу після «в лінійку»; вибір записується у сторінку', async () => {
    const ids = GRID_OPTIONS.map(o => o.id)
    expect(ids.indexOf('slanted')).toBe(ids.indexOf('ruled') + 1)
    const store = useWBStore()
    useGridOverlay('ws-test').setGrid('slanted')
    await nextTick()
    expect(store.currentPage?.grid).toMatchObject({ enabled: true, style: 'slanted' })
  })

  it('коса лінія: плитка 37×80, рядки 4 мм через 6 мм, похилі ~65° без розривів на межі', () => {
    const rec = recordCanvas()
    _applyGridToCanvas(useWBStore(), grid('slanted', 40))
    expect([rec.width, rec.height]).toEqual([SLANTED_TILE_W, SLANTED_TILE_H])
    expect(rec.strokes.every(s => s.ink === NOTEBOOK_INK)).toBe(true)

    const rows = rec.strokes.flatMap(s => s.moves).filter(m => m[1] === m[3]).map(m => m[1])
    expect(rows).toEqual([12.5, 28.5, 52.5, 68.5])
    expect(rows[1] - rows[0]).toBe(SLANTED_ROW_PX)
    expect(rows[2] - rows[1]).toBe(SLANTED_GAP_PX)
    // наступна плитка: від останнього рядка до першого — той самий проміжок
    expect(rows[0] + SLANTED_TILE_H - rows[3]).toBe(SLANTED_GAP_PX)

    const slants = rec.strokes.flatMap(s => s.moves).filter(m => m[1] !== m[3])
    for (const [x0, y0, x1, y1] of slants) {
      // за висоту плитки — рівно ширина плитки: похила продовжується в сусідній плитці
      expect([x1 - x0, y0 - y1]).toEqual([SLANTED_TILE_W, SLANTED_TILE_H])
    }
    const deg = Math.atan2(SLANTED_TILE_H, SLANTED_TILE_W) * 180 / Math.PI
    expect(deg).toBeGreaterThan(64.5)
    expect(deg).toBeLessThan(65.5)
  })

  it('клітинка синя й видна незалежно від збереженої прозорості; лінія всередині плитки', () => {
    const rec = recordCanvas()
    _applyGridToCanvas(useWBStore(), grid('small-grid', 20, 0.1))
    expect(rec.strokes).toHaveLength(1)
    expect(rec.strokes[0].ink).toBe(NOTEBOOK_INK)
    expect(rec.strokes[0].alpha).toBeGreaterThanOrEqual(0.4)
    expect(rec.strokes[0].moves).toEqual([[19.5, 0, 19.5, 20], [0, 19.5, 20, 19.5]])
  })

  it('лінійка: лише горизонтальна синя лінія, темніша за клітинку', () => {
    const rec = recordCanvas()
    _applyGridToCanvas(useWBStore(), grid('ruled', 32))
    expect(rec.strokes[0].ink).toBe(NOTEBOOK_INK)
    expect(rec.strokes[0].moves).toEqual([[0, 31.5, 32, 31.5]])
    expect(rec.strokes[0].alpha).toBeGreaterThan(0.4)
  })
})
