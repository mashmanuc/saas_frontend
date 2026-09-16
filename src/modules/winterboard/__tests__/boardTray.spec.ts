/**
 * TLV2-05B · нижній трей згорнутих карток.
 *
 * ЧОМУ ЦЕЙ ТЕСТ ІСНУЄ
 *
 * Згортання — не видалення і не «сховати в пам'яті вкладки». Той самий об'єкт
 * (id, місце, розмір, шар, блокування, вміст) лише перестає малюватись, а стан
 * живе в журналі операцій — тому його бачать учень, reload, replay і клон.
 *
 * ІНВАРІАНТИ
 *   INV-TRAY-1  згортаються лише картки з `minimizable`; примітив, медіа й невідомий тип — ні
 *   INV-TRAY-2  згортання/відновлення = рівно один `asset_update` того самого id; без add/delete/копії
 *   INV-TRAY-3  місце, розмір, шар, блокування й дані не змінюються
 *   INV-TRAY-4  трей — лише поточна сторінка; одна вкладка на об'єкт; порядок = шари
 *   INV-TRAY-5  стан переживає reload/replay журналу
 *   INV-TRAY-6  учень і replay не бачать трею й дії «Згорнути»
 *   INV-TRAY-7  V1: без прапорця дії «Згорнути» немає
 *   INV-TRAY-8  згорнута картка не виділяється рамкою
 *   INV-TRAY-9  капсула не перемонтовується, а її годинник стоїть на паузі
 *   INV-TRAY-10 полотно ховає за даними й пише лише штатними asset-update / asset-delete
 */
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { createI18n } from 'vue-i18n'
import { createPinia, setActivePinia } from 'pinia'
import uk from '../../../i18n/locales/uk.json'
import { useWBStore } from '../board/state/boardStore'
import { cancelPendingUpdates } from '../board/state/assetUpdateBatcher'
import { STANDARD_ASSET_TYPES, isMinimizableAsset, isMinimizedOnBoard } from '../board/objectStandard'
import {
  canMinimize,
  canShowTray,
  minimizedAsset,
  restoredAsset,
  trayItems,
  trayTitle,
} from '../board/boardTray'
import { isBoardTrayEnabled } from '../config/featureFlags'
import { useRectSelect } from '../composables/useRectSelect'
import { createSuspendableFrameScheduler } from '../composables/suspendableFrameScheduler'
import { applyReplayOperation, type ReplayStoreApi } from '../engine/applyReplayOperation'
import WBBoardTray from '../components/canvas/WBBoardTray.vue'
import VisualCapsuleAssetRenderer from '../components/board/objects/VisualCapsuleAssetRenderer.vue'
import VisualCapsuleTrianglesOverlay from '../components/board/objects/VisualCapsuleTrianglesOverlay.vue'
import type { FrameScheduler } from '../components/board/objects/visualCapsules/overlayPlayer'
import type { WBAsset } from '../types/winterboard'
import type { RecordOperationRequest } from '../types/replay'

const SRC = resolve(__dirname, '../../..')
const read = (rel: string) => readFileSync(resolve(SRC, rel), 'utf-8')

const TEACHER = { isTutor: true, mode: 'edit' }
const STUDENT = { isTutor: false, mode: 'edit' }

function card(id: string, type: string, extra: Record<string, unknown> = {}): WBAsset {
  return {
    id, type, src: '', x: 100, y: 200, w: 300, h: 150, rotation: 0, locked: false,
    data: { version: 1, title: `Картка ${id}` },
    ...extra,
  } as unknown as WBAsset
}

const i18n = () => createI18n({ legacy: false, locale: 'uk', fallbackLocale: 'uk', messages: { uk } as never })

// ─── Правила ────────────────────────────────────────────────────────────────

describe('INV-TRAY-1 · що може потрапити в трей', () => {
  it.each(['theory_card', 'nmt_task', 'geometry_2d_v2', 'visual_capsule', 'geomash_scene', 'image', 'document_viewer'])(
    '%s згортається', (type) => {
      expect(isMinimizableAsset(type)).toBe(true)
      expect(isMinimizedOnBoard(card('a', type, { minimized: true }))).toBe(true)
    })

  it.each([
    ['медіа', { type: 'video_player' }],
    ['невідомий тип', { type: 'visual_capsule_v9' }],
    ['без типу', {}],
    ['штрих-примітив', { tool: 'pen' }],
    ['фігура-примітив', { tool: 'rectangle' }],
  ])('%s не ховається навіть з minimized: true', (_label, shape) => {
    const thing = { id: 'x', minimized: true, ...shape } as never
    expect(isMinimizedOnBoard(thing)).toBe(false)
    expect(trayItems([thing])).toEqual([])
  })

  it('кожен тип стандарту без minimizable не згортається', () => {
    for (const type of STANDARD_ASSET_TYPES.filter(t => !isMinimizableAsset(t))) {
      expect(isMinimizedOnBoard(card('a', type, { minimized: true })), type).toBe(false)
    }
  })
})

describe('INV-TRAY-3 · згортання не змінює нічого, крім прапорця', () => {
  it('той самий id, місце, розмір, поворот, блокування й дані', () => {
    const original = card('a1', 'theory_card', { locked: true, rotation: 12 })
    const folded = minimizedAsset(original)
    const back = restoredAsset(folded)
    const { minimized: _m1, ...foldedRest } = folded as WBAsset & { minimized?: boolean }
    const { minimized: _m2, ...backRest } = back as WBAsset & { minimized?: boolean }
    expect(folded.minimized).toBe(true)
    expect(back.minimized).toBe(false)
    expect(foldedRest).toEqual(original)
    expect(backRest).toEqual(original)
    expect(folded.data).toBe(original.data)
  })
})

describe('INV-TRAY-4 · вкладки', () => {
  it('лише згорнуті, у порядку шарів, одна вкладка на об\'єкт', () => {
    const a = card('a', 'theory_card', { minimized: true })
    const b = card('b', 'nmt_task')
    const c = card('c', 'visual_capsule', { minimized: true })
    expect(trayItems([a, b, c, { ...a }]).map(x => x.id)).toEqual(['a', 'c'])
  })

  it('назва вкладки — з даних картки, коротко', () => {
    expect(trayTitle(card('a', 'theory_card'))).toBe('Картка a')
    expect(trayTitle(card('a', 'nmt_task', { data: { question: 'x'.repeat(90) } })).length).toBe(40)
    expect(trayTitle(card('a', 'image', { data: {} }))).toBe('')
  })
})

describe('INV-TRAY-6/7 · хто бачить трей і дію «Згорнути»', () => {
  const theory = card('a', 'theory_card')

  it('учень не бачить трею й не може згорнути', () => {
    expect(canShowTray(STUDENT, 3)).toBe(false)
    expect(canMinimize(theory, STUDENT, true)).toBe(false)
  })

  it('у replay й readonly трею немає', () => {
    expect(canShowTray({ isTutor: true, mode: 'replay' }, 3)).toBe(false)
    expect(canMinimize(theory, { isTutor: true, mode: 'readonly' }, true)).toBe(false)
  })

  it('вчитель бачить трей, лише коли в ньому є картки', () => {
    expect(canShowTray(TEACHER, 0)).toBe(false)
    expect(canShowTray(TEACHER, 1)).toBe(true)
  })

  it('V1: без прапорця дії «Згорнути» немає', () => {
    expect(canMinimize(theory, TEACHER, false)).toBe(false)
    expect(canMinimize(theory, TEACHER, true)).toBe(true)
  })

  it('TLV2-05C: прапорець — dev увімкнено без env; production і явний false — вимкнено', () => {
    try { localStorage.removeItem('wb_board_tray') } catch { /* немає localStorage */ }
    try {
      vi.stubEnv('VITE_WB_BOARD_TRAY', '')
      vi.stubEnv('DEV', true)
      expect(isBoardTrayEnabled()).toBe(true)
      vi.stubEnv('DEV', false)
      expect(isBoardTrayEnabled()).toBe(false)
      vi.stubEnv('DEV', true)
      vi.stubEnv('VITE_WB_BOARD_TRAY', 'false')
      expect(isBoardTrayEnabled()).toBe(false)
    } finally {
      vi.unstubAllEnvs()
    }
  })

  it('медіа й уже згорнуту картку згорнути не можна', () => {
    expect(canMinimize(card('v', 'video_player'), TEACHER, true)).toBe(false)
    expect(canMinimize(minimizedAsset(theory), TEACHER, true)).toBe(false)
  })
})

// ─── Операції, сторінки, reload ─────────────────────────────────────────────

describe('INV-TRAY-2/4/5/8 · через store і журнал', () => {
  let ops: RecordOperationRequest[]
  let stop: () => void

  beforeEach(() => {
    setActivePinia(createPinia())
    cancelPendingUpdates()
    vi.useFakeTimers()
    vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) =>
      setTimeout(() => cb(performance.now()), 16) as unknown as number)
    vi.stubGlobal('cancelAnimationFrame', (id: number) => clearTimeout(id as never))
  })

  afterEach(() => {
    stop?.()
    cancelPendingUpdates()
    vi.useRealTimers()
    vi.unstubAllGlobals()
  })

  function seed() {
    const store = useWBStore()
    store.pages = [
      { id: 'page-1', name: '1', strokes: [], assets: [card('t1', 'theory_card'), card('q1', 'nmt_task')] },
      { id: 'page-2', name: '2', strokes: [], assets: [card('g2', 'geometry_2d_v2')] },
    ] as never
    store.currentPageIndex = 0
    ops = []
    stop = store.onOperation(op => ops.push(op))
    return store
  }

  function update(store: ReturnType<typeof useWBStore>, asset: WBAsset) {
    store.updateAsset(asset)
    vi.advanceTimersByTime(20)   // Layer B: RAF-коалесценція
  }

  it('згортання й відновлення — рівно один asset_update того самого id', () => {
    const store = seed()
    const before = store.pages[0].assets.map(a => a.id)
    update(store, minimizedAsset(store.pages[0].assets[0] as WBAsset))
    update(store, restoredAsset(store.pages[0].assets[0] as WBAsset))

    expect(ops.map(o => o.op_type)).toEqual(['asset_update', 'asset_update'])
    const payloads = ops.map(o => (o.payload as { asset: WBAsset }).asset)
    expect(payloads.map(a => [a.id, a.minimized])).toEqual([['t1', true], ['t1', false]])
    expect(store.pages[0].assets.map(a => a.id)).toEqual(before)   // той самий шар, без копій
  })

  it('трей показує лише поточну сторінку', () => {
    const store = seed()
    update(store, minimizedAsset(store.pages[0].assets[0] as WBAsset))
    store.currentPageIndex = 1
    expect(trayItems(store.currentAssets as WBAsset[])).toEqual([])
    store.currentPageIndex = 0
    expect(trayItems(store.currentAssets as WBAsset[]).map(a => a.id)).toEqual(['t1'])
  })

  it('reload: replay журналу відтворює згорнутий стан і відновлення', () => {
    const store = seed()
    update(store, minimizedAsset(store.pages[0].assets[0] as WBAsset))
    update(store, minimizedAsset(store.pages[0].assets[1] as WBAsset))
    update(store, restoredAsset(store.pages[0].assets[0] as WBAsset))
    stop()

    setActivePinia(createPinia())
    const fresh = useWBStore()
    fresh.pages = [{ id: 'page-1', name: '1', strokes: [], assets: [card('t1', 'theory_card'), card('q1', 'nmt_task')] }] as never
    fresh.currentPageIndex = 0
    fresh.setMode('replay')
    ops.forEach((op, i) => applyReplayOperation(fresh as unknown as ReplayStoreApi, {
      id: i + 1, seq: i + 1, op_type: op.op_type, page_id: op.page_id, payload: op.payload,
    } as never))
    vi.advanceTimersByTime(20)

    expect(trayItems(fresh.currentAssets as WBAsset[]).map(a => a.id)).toEqual(['q1'])
    expect(fresh.currentAssets.map(a => [a.id, a.x, a.y, a.w, a.h]))
      .toEqual([['t1', 100, 200, 300, 150], ['q1', 100, 200, 300, 150]])
  })

  it('згорнута картка не виділяється рамкою', () => {
    const store = seed()
    update(store, minimizedAsset(store.pages[0].assets[0] as WBAsset))
    const rect = useRectSelect(store)
    rect.startRectSelect({ x: 0, y: 0 })
    rect.updateRectSelect({ x: 2000, y: 2000 })
    rect.finishRectSelect()
    expect(store.selectedIds).toEqual(['q1'])
  })
})

// ─── Компонент трею ─────────────────────────────────────────────────────────

describe('WBBoardTray · вкладки теорії, задачі, Geometry2D і капсули', () => {
  const items = [
    card('t', 'theory_card', { minimized: true }),
    card('q', 'nmt_task', { minimized: true, data: { question: 'Знайдіть кут' } }),
    card('g', 'geometry_2d_v2', { minimized: true, data: {} }),
    card('c', 'visual_capsule', { minimized: true, locked: true, data: {} }),
  ]

  function mountTray() {
    return mount(WBBoardTray, { props: { items }, global: { plugins: [i18n()] } })
  }

  it('кожна вкладка — тип і назва', () => {
    const w = mountTray()
    const tabs = w.findAll('[data-testid="wb-board-tray-tab"]')
    expect(tabs.map(t => t.attributes('data-asset-type')))
      .toEqual(['theory_card', 'nmt_task', 'geometry_2d_v2', 'visual_capsule'])
    expect(tabs.map(t => t.get('.wb-board-tray__kind').text()))
      .toEqual(['Теорія', 'Задача', 'Геометрія', 'Анімація'])
    expect(tabs[1].text()).toContain('Знайдіть кут')
  })

  it('клік по вкладці відновлює саме цю картку', async () => {
    const w = mountTray()
    await w.findAll('[data-testid="wb-board-tray-restore"]')[2].trigger('click')
    expect(w.emitted('restore')).toEqual([['g']])
  })

  it('видалення — через меню вкладки; заблоковану видалити не можна', async () => {
    const w = mountTray()
    await w.findAll('[data-testid="wb-board-tray-menu"]')[0].trigger('click')
    await w.get('[data-testid="wb-board-tray-delete"]').trigger('click')
    expect(w.emitted('delete')).toEqual([['t']])

    await w.findAll('[data-testid="wb-board-tray-menu"]')[3].trigger('click')
    expect(w.get('[data-testid="wb-board-tray-delete"]').attributes('disabled')).toBeDefined()
  })
})

// ─── Капсула ────────────────────────────────────────────────────────────────

function manualScheduler() {
  let t = 0
  let nextId = 1
  const pending = new Map<number, (now: number) => void>()
  const scheduler: FrameScheduler & { advance(ms: number): void; pendingCount(): number } = {
    requestFrame(cb) { const id = nextId++; pending.set(id, cb); return id },
    cancelFrame(id) { pending.delete(id) },
    now: () => t,
    advance(ms) {
      t += ms
      const due = [...pending.entries()]
      pending.clear()
      for (const [, cb] of due) cb(t)
    },
    pendingCount: () => pending.size,
  }
  return scheduler
}

describe('INV-TRAY-9 · капсула: пауза без перемонтування', () => {
  it('годинник стоїть на час згортання, після відновлення — без стрибка', () => {
    const base = manualScheduler()
    const s = createSuspendableFrameScheduler(base)
    const seen: number[] = []
    const loop = (now: number) => { seen.push(now); s.requestFrame(loop) }

    s.requestFrame(loop)
    base.advance(100)                 // кадр на 100
    s.suspend()
    expect(s.now()).toBe(100)
    base.advance(5000)                // 5 с у треї: жодного кадру
    expect(seen).toEqual([100])
    expect(s.now()).toBe(100)
    s.resume()
    base.advance(16)                  // перший кадр після відновлення — 116, а не 5116
    expect(seen).toEqual([100, 116])
    expect(s.now()).toBe(116)
  })

  it('скасований під час згортання кадр не приходить після відновлення', () => {
    const base = manualScheduler()
    const s = createSuspendableFrameScheduler(base)
    const cb = vi.fn()
    const id = s.requestFrame(cb)
    s.suspend()
    s.cancelFrame(id)
    s.resume()
    base.advance(16)
    expect(cb).not.toHaveBeenCalled()
  })

  it('згортання не перемонтовує V-D3.1 і зупиняє її кадри', async () => {
    const base = manualScheduler()
    const asset = card('cap', 'visual_capsule', {
      w: 780, h: 620,
      data: { version: 1, visual_id: 'visual.triangles.congruence.overlay', capsule_version: 1, mode: 'full' },
    })
    const w = mount(VisualCapsuleAssetRenderer, {
      props: { asset, scheduler: base, isSelected: true },
      global: { plugins: [i18n()], stubs: { Geometry2DRenderer: true } },
    })
    const uid = w.findComponent(VisualCapsuleTrianglesOverlay).vm.$.uid

    // Учитель робить прогноз (D) і запускає накладання — як на уроці.
    await w.get('[data-testid="vcap-predict-D"]').trigger('click')
    const primary = w.find('[data-testid="vcap-primary"]')
    if (primary.exists() && base.pendingCount() === 0) await primary.trigger('click')
    expect(base.pendingCount()).toBeGreaterThan(0)          // анімація йде

    await w.setProps({ asset: minimizedAsset(asset) })
    expect(base.pendingCount()).toBe(0)                     // у треї кадрів немає
    expect(w.findComponent(VisualCapsuleTrianglesOverlay).vm.$.uid).toBe(uid)

    await w.setProps({ asset: restoredAsset(asset) })
    expect(base.pendingCount()).toBeGreaterThan(0)          // рух продовжився
    expect(w.findComponent(VisualCapsuleTrianglesOverlay).vm.$.uid).toBe(uid)
    w.unmount()
  })
})

// ─── Полотно ────────────────────────────────────────────────────────────────

describe('INV-TRAY-10 · WBCanvas: одна оболонка, запис лише штатно', () => {
  const canvas = read('modules/winterboard/components/canvas/WBCanvas.vue')

  it('Konva-шар малює лише незгорнуті картки', () => {
    expect(canvas).toContain('<template v-for="asset in konvaAssets" :key="asset.id">')
    expect(canvas).toContain('const konvaAssets = computed(() => assets.value.filter(a => !isMinimizedOnBoard(a)))')
  })

  it('HTML-оверлей згорнутої картки лишається змонтованим (display:none)', () => {
    expect(canvas).toContain("...(isMinimizedOnBoard(asset) ? { display: 'none' } : {}),")
  })

  it('вкладки — лише з поточної сторінки', () => {
    expect(canvas).toContain('const trayList = computed(() => trayItems(assets.value))')
  })

  it('згортання й відновлення пишуть штатним asset-update, видалення — asset-delete', () => {
    expect(canvas).toContain("emit('asset-update', minimizedAsset(asset))")
    expect(canvas).toContain("emit('asset-update', restoredAsset(asset))")
    expect(canvas).toMatch(/function handleTrayDelete\(assetId: string\): void \{[\s\S]*?emit\('asset-delete', assetId\)/)
  })

  it('роль і прапорець вирішують спільні правила, а не шаблон', () => {
    expect(canvas).toContain("const trayViewer = computed(() => ({ isTutor: props.isTutor !== false, mode: wbStore.mode }))")
    // TLV2-05B.2: «Згорнути» — у спільній групі віконних дій; правило те саме (canMinimize).
    expect(canvas).toContain('cardWindowActions(asset, trayViewer.value, boardTrayEnabled)')
    expect(canvas).toContain('const boardTrayEnabled = isBoardTrayEnabled()')
    expect(canvas).toMatch(/<WBBoardTray\s+v-if="showTray"/)
  })

  it('fullscreen-картка перед згортанням повертається до звичайного frame', () => {
    expect(canvas).toMatch(/function handleMinimize\(asset: WBAsset\): void \{\s*\/\/[^\n]*\n\s*if \(expandedAssetId\.value === asset\.id\) expandedAssetId\.value = null/)
  })
})
