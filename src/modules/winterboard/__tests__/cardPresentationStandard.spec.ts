/**
 * TLV2-05C · стандарт подання карток: можливості 22 типів, масштаб, операції, панель.
 *
 * ІНВАРІАНТИ
 *   INV-PRES-1  кожен із 22 типів має явні contentFit / textScale / windowChrome; невідомий — fail-closed
 *   INV-PRES-2  кроки масштабу; відсутнє/невалідне → 1; межі без операції
 *   INV-PRES-3  один клік A± → рівно один asset_update; на межі — жодного
 *   INV-PRES-4  reload/replay/клон зберігають масштаб і висоту; трей і fullscreen нічого не скидають
 *   INV-PRES-5  панель: A− 100% A+ │ — ⛶ ×; учень — нічого; заблокована — без ×
 *   INV-PRES-6  авто-висота лише за стандартом (реєстр, host), не вручну для одного типу
 */
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { createI18n } from 'vue-i18n'
import { createPinia, setActivePinia } from 'pinia'
import uk from '../../../i18n/locales/uk.json'
import { STANDARD_ASSET_TYPES, BOARD_PRIMITIVE_STANDARD, NO_CAPABILITIES, assetCapabilities } from '../board/objectStandard'
import {
  PRESENTATION_SCALE_STEPS,
  nextPresentationScale,
  normalizePresentationScale,
  presentationScaleLabel,
  presentationScaleOf,
  withPresentationScale,
} from '../board/cardPresentation'
import { cardWindowActions } from '../board/windowActions'
import { minimizedAsset, restoredAsset } from '../board/boardTray'
import { useWBStore } from '../board/state/boardStore'
import { cancelPendingUpdates } from '../board/state/assetUpdateBatcher'
import { applyReplayOperation, type ReplayStoreApi } from '../engine/applyReplayOperation'
import { OVERLAY_RENDERERS } from '../components/canvas/overlayRegistry'
import WBCardWindowControls from '../components/canvas/WBCardWindowControls.vue'
import type { WBAsset } from '../types/winterboard'
import type { RecordOperationRequest } from '../types/replay'

const SRC = resolve(__dirname, '../../..')
const read = (rel: string) => readFileSync(resolve(SRC, rel), 'utf-8').replace(/\r\n/g, '\n')
const i18n = () => createI18n({ legacy: false, locale: 'uk', fallbackLocale: 'uk', messages: { uk } as never })
const TEACHER = { isTutor: true, mode: 'edit' }

// ─── INV-PRES-1 · 22 типи ──────────────────────────────────────────────────

describe('INV-PRES-1 · можливості подання всіх 22 типів', () => {
  const TEXT = ['theory_card', 'nmt_task']

  it('рівно 22 типи; текстові — height + teacher-shared; решта — none/none; усі — з панеллю', () => {
    expect(STANDARD_ASSET_TYPES).toHaveLength(22)
    for (const type of STANDARD_ASSET_TYPES) {
      const c = assetCapabilities(type)
      const text = TEXT.includes(type)
      expect([type, c.windowChrome, c.contentFit, c.textScale])
        .toEqual([type, true, text ? 'height' : 'none', text ? 'teacher-shared' : 'none'])
    }
  })

  it('пілот: капсула й Geometry2D — панель без авто-висоти й масштабу', () => {
    for (const type of ['visual_capsule', 'geometry_2d_v2']) {
      expect([assetCapabilities(type).contentFit, assetCapabilities(type).textScale]).toEqual(['none', 'none'])
    }
  })

  it('невідомий тип і примітиви — fail-closed', () => {
    expect([NO_CAPABILITIES.contentFit, NO_CAPABILITIES.textScale, NO_CAPABILITIES.windowChrome]).toEqual(['none', 'none', false])
    expect(assetCapabilities('wat')).toEqual(NO_CAPABILITIES)
    expect(presentationScaleOf({ id: 'x', type: 'wat', data: { presentationScale: 2 } } as never)).toBe(1)
    for (const entry of Object.values(BOARD_PRIMITIVE_STANDARD)) {
      expect([entry.capabilities.contentFit, entry.capabilities.textScale, entry.capabilities.windowChrome]).toEqual(['none', 'none', false])
    }
  })
})

// ─── INV-PRES-2 · масштаб ──────────────────────────────────────────────────

describe('INV-PRES-2 · кроки й нормалізація', () => {
  it('кроки рівно ті, що в ТЗ', () => {
    expect([...PRESENTATION_SCALE_STEPS]).toEqual([0.8, 0.9, 1, 1.15, 1.3, 1.5, 1.75, 2])
  })

  it.each([undefined, null, '1.3', 1.25, 0, -1, 3, Number.NaN, {}])('%s → 1', (value) => {
    expect(normalizePresentationScale(value)).toBe(1)
  })

  it('старі картки без поля — 1; для не-текстових типів поле ігнорується', () => {
    expect(presentationScaleOf({ id: 't', type: 'theory_card', data: {} } as never)).toBe(1)
    expect(presentationScaleOf({ id: 't', type: 'theory_card' } as never)).toBe(1)
    expect(presentationScaleOf({ id: 'c', type: 'visual_capsule', data: { presentationScale: 1.5 } } as never)).toBe(1)
  })

  it('A+ / A− / 100%; на межах і на 100% — null (операції не буде)', () => {
    expect(nextPresentationScale(1, 1)).toBe(1.15)
    expect(nextPresentationScale(1.15, 1)).toBe(1.3)
    expect(nextPresentationScale(1, -1)).toBe(0.9)
    expect(nextPresentationScale(2, 1)).toBeNull()
    expect(nextPresentationScale(0.8, -1)).toBeNull()
    expect(nextPresentationScale(1.5, 0)).toBe(1)
    expect(nextPresentationScale(1, 0)).toBeNull()
    expect(presentationScaleLabel(1.15)).toBe('115%')
  })

  it('withPresentationScale міняє лише масштаб', () => {
    const asset = { id: 'a', type: 'theory_card', x: 1, y: 2, w: 3, h: 4, data: { title: 'T', autoFitH: 4 } } as unknown as WBAsset
    const next = withPresentationScale(asset, 1.3)
    expect(next).toEqual({ ...asset, data: { title: 'T', autoFitH: 4, presentationScale: 1.3 } })
  })
})

// ─── INV-PRES-3/4 · операції й стан ────────────────────────────────────────

describe('INV-PRES-3/4 · через store, журнал, трей і клон', () => {
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

  const theory = (): WBAsset => ({
    id: 'th', type: 'theory_card', src: '', x: 100, y: 100, w: 520, h: 300, rotation: 0, locked: false,
    data: { version: 1, title: 'T', body: 'B', autoFitH: 300 },
  }) as unknown as WBAsset

  function seed() {
    const store = useWBStore()
    store.pages = [{ id: 'page-1', name: '1', strokes: [], assets: [theory()] }] as never
    store.currentPageIndex = 0
    ops = []
    stop = store.onOperation(op => ops.push(op))
    return store
  }

  /** Те, що робить host на клік: наступний крок → один asset-update → кімната → store. */
  function click(store: ReturnType<typeof useWBStore>, direction: -1 | 0 | 1) {
    const asset = store.pages[0].assets[0] as WBAsset
    const next = nextPresentationScale(presentationScaleOf(asset), direction)
    if (next === null) return
    store.updateAsset(withPresentationScale(asset, next))
    vi.advanceTimersByTime(20)
  }

  it('один клік A+ — рівно один asset_update; на межі — жодного', () => {
    const store = seed()
    click(store, 1)
    expect(ops.map(o => o.op_type)).toEqual(['asset_update'])
    expect(((ops[0].payload as { asset: WBAsset }).asset.data as unknown as { presentationScale: number }).presentationScale).toBe(1.15)

    for (let i = 0; i < 10; i++) click(store, 1)
    const count = ops.length
    click(store, 1)   // уже 2 — межа
    expect(ops.length).toBe(count)
    expect(presentationScaleOf(store.pages[0].assets[0] as WBAsset)).toBe(2)
  })

  it('reload / replay журналу: масштаб, висота й autoFitH ті самі', () => {
    const store = seed()
    click(store, 1)
    click(store, 1)
    store.updateAsset({ ...(store.pages[0].assets[0] as WBAsset), h: 420,
      data: { ...((store.pages[0].assets[0] as WBAsset).data as unknown as object), autoFitH: 420 } } as unknown as WBAsset)
    vi.advanceTimersByTime(20)
    stop()

    setActivePinia(createPinia())
    const fresh = useWBStore()
    fresh.pages = [{ id: 'page-1', name: '1', strokes: [], assets: [theory()] }] as never
    fresh.currentPageIndex = 0
    fresh.setMode('replay')
    ops.forEach((op, i) => applyReplayOperation(fresh as unknown as ReplayStoreApi, {
      id: i + 1, seq: i + 1, op_type: op.op_type, page_id: op.page_id, payload: op.payload,
    } as never))
    vi.advanceTimersByTime(20)
    const restored = fresh.pages[0].assets[0] as WBAsset
    expect(presentationScaleOf(restored)).toBe(1.3)
    expect([restored.h, (restored.data as unknown as { autoFitH: number }).autoFitH]).toEqual([420, 420])
  })

  it('клон у класну кімнату (глибока копія стану, як BE deepcopy) зберігає масштаб', () => {
    const state = { pages: [{ id: 'p', assets: [withPresentationScale(theory(), 1.5)] }] }
    const cloned = structuredClone(state)
    expect(presentationScaleOf(cloned.pages[0].assets[0] as WBAsset)).toBe(1.5)
  })

  it('трей туди й назад нічого не скидає', () => {
    const scaled = { ...withPresentationScale(theory(), 1.75), h: 640 } as WBAsset
    const back = restoredAsset(minimizedAsset(scaled))
    expect([presentationScaleOf(back), back.h, back.w, back.x, back.y]).toEqual([1.75, 640, 520, 100, 100])
  })

  it('fullscreen — лише стан подання: перемикач не пише в картку', () => {
    const canvas = read('modules/winterboard/components/canvas/WBCanvas.vue')
    const fn = canvas.slice(canvas.indexOf('function handleWindowExpand'), canvas.indexOf('function handleWindowScale'))
    expect(fn).not.toContain("emit('asset-update'")
  })
})

// ─── INV-PRES-5 · панель ───────────────────────────────────────────────────

describe('INV-PRES-5 · верхня панель', () => {
  const FULL = { scale: true, minimize: true, expand: true, delete: true }

  it('порядок: A− 100% A+ │ — ⛶ ×', () => {
    const w = mount(WBCardWindowControls, { props: { actions: FULL, isExpanded: false, scale: 1.15 }, global: { plugins: [i18n()] } })
    expect(w.findAll('button').map(b => b.text())).toEqual(['A−', '115%', 'A+', '—', '⛶', '×'])
    expect(w.find('.wb-card-window-controls__divider').exists()).toBe(true)
    w.unmount()
  })

  it('кнопки масштабу емітять −1 / 0 / +1; на межах вимкнені', async () => {
    const w = mount(WBCardWindowControls, { props: { actions: FULL, isExpanded: false, scale: 2 }, global: { plugins: [i18n()] } })
    await w.get('[data-testid="wb-card-window-scale-down"]').trigger('click')
    await w.get('[data-testid="wb-card-window-scale-reset"]').trigger('click')
    expect(w.emitted('scale')).toEqual([[-1], [0]])
    expect(w.get('[data-testid="wb-card-window-scale-up"]').attributes('disabled')).toBeDefined()
    w.unmount()
  })

  it('кнопки масштабу не спливають до полотна', async () => {
    const parent = document.createElement('div')
    document.body.appendChild(parent)
    const w = mount(WBCardWindowControls, { props: { actions: FULL, isExpanded: false, scale: 1 }, global: { plugins: [i18n()] }, attachTo: parent })
    let bubbled = 0
    for (const type of ['pointerdown', 'mousedown', 'click']) parent.addEventListener(type, () => { bubbled += 1 })
    for (const id of ['scale-down', 'scale-reset', 'scale-up']) {
      const btn = w.get(`[data-testid="wb-card-window-${id}"]`)
      await btn.trigger('pointerdown')
      await btn.trigger('mousedown')
      await btn.trigger('click')
    }
    expect(bubbled).toBe(0)
    w.unmount()
    parent.remove()
  })

  it('дії: текстові картки мають масштаб; заблокована — масштаб і ⛶ без ×; учень — нічого', () => {
    const task = { id: 'q', type: 'nmt_task', locked: true } as unknown as WBAsset
    expect(cardWindowActions(task, TEACHER)).toEqual({ scale: true, minimize: true, expand: true, delete: false })
    expect(cardWindowActions({ id: 'c', type: 'visual_capsule' } as never, TEACHER).scale).toBe(false)
    expect(cardWindowActions(task, { isTutor: false, mode: 'edit' }).scale).toBe(false)
  })
})

// ─── INV-PRES-6 · авто-висота за стандартом ────────────────────────────────

describe('INV-PRES-6 · авто-висота за стандартом', () => {
  const ctx = {
    isSelected: () => false, interactive: true, isTutor: true, boardMode: 'edit', disableAnimation: false,
    expandedId: null, onUpdate: () => {}, onDelete: () => {}, onSelectOther: () => {}, onFormulaEdit: () => {},
    onSpawnCompanions: () => {}, onRequestHeight: vi.fn(), toggleExpand: () => {}, graph: {} as never,
  }

  it('реєстр: request-height рівно в типів із contentFit: height', () => {
    for (const [type, entry] of Object.entries(OVERLAY_RENDERERS)) {
      const events = entry.buildEvents({ id: 'a', type } as never, ctx as never)
      expect([type, 'request-height' in events]).toEqual([type, assetCapabilities(type).contentFit === 'height'])
    }
  })

  it('host: гард за стандартом і для згорнутої картки; legacy-блок теорії просить висоту', () => {
    const canvas = read('modules/winterboard/components/canvas/WBCanvas.vue')
    const fn = canvas.slice(canvas.indexOf('function handleOverlayHeightRequest'), canvas.indexOf('const nextH = nextAutoFitHeight'))
    expect(fn).toContain("assetCapabilities(asset.type).contentFit !== 'height' || isMinimizedOnBoard(asset)")
    const theoryBlock = canvas.slice(canvas.indexOf('<TheoryCardRenderer'), canvas.indexOf('/>', canvas.indexOf('<TheoryCardRenderer')))
    expect(theoryBlock).toContain('@request-height="(px: number) => handleOverlayHeightRequest(asset.id, px)"')
  })

  it('host масштабу: один emit на клік через спільні функції', () => {
    const canvas = read('modules/winterboard/components/canvas/WBCanvas.vue')
    const fn = canvas.slice(canvas.indexOf('function handleWindowScale'), canvas.indexOf('function handleWindowDelete'))
    expect(fn).toContain('nextPresentationScale(presentationScaleOf(asset), direction)')
    expect(fn.match(/emit\('asset-update'/g)).toHaveLength(1)
  })
})
