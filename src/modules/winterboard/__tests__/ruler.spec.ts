/**
 * Екранна лінійка (`ruler`, власник 22.10.2026: «ми зараз робимо лінійку, циркуль реальний… Куди ми положимо
 * лінійку і циркуля? Це буде все в геометрії жити»). LAW §9 v1.46.
 *
 *   — масштаб «як у зошиті»: 1 клітинка сітки = 5 мм → px на см = 2 × gridSize;
 *   — кількість поділок — з довжини `w`; довжина в межах 3…50 см шкали;
 *   — повернута лінійка тримається на аркуші за своєю видимою рамкою;
 *   — плитка в «Інструменти → Геометрія», усім; Інтегралик її не бачить і не вставляє; пульт її не показує;
 *   — зміни — штатні `asset_update` (x, y, w, h, rotation, locked — ops-поля).
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import uk from '@/i18n/locales/uk.json'
import en from '@/i18n/locales/en.json'
import ru from '@/i18n/locales/ru.json'
import {
  RULER_DRAG_MIME,
  RULER_DEFAULT_CM,
  buildRulerAsset,
  clampRulerWidth,
  rulerCmCount,
  rulerHeightPx,
  rulerMaxWidthPx,
  rulerMinWidthPx,
  rulerMmCount,
  rulerPxPerCm,
  rulerWidthForCm,
} from '../constants/rulerDefaults'
import { clampRulerBox, clampRulerCenter, drawRuler, rulerMarks, type RulerCanvas } from '../board/rulerShape'
import { allInserts, appOf, insertsByApp, visibleApps, visibleInserts } from '../components/sidebar/insertRegistry'
import { assetsEqualByOpsFields } from '../board/state/assetEquality'
import { currentPageKind, scenarioKind } from '../remote/remoteScenarioAdapter'
import { isIntegralykSolvable } from '../board/handwriteSolution'
import type { WBAsset } from '../types/winterboard'

const SRC = resolve(__dirname, '../../..')
const read = (rel: string) => readFileSync(resolve(SRC, rel), 'utf-8').replace(/\r\n/g, '\n')

describe('масштаб «як у зошиті»: клітинка = 5 мм', () => {
  it('px на 1 см = 2 × gridSize (за замовчуванням 20 → 40)', () => {
    expect(rulerPxPerCm(20)).toBe(40)
    expect(rulerPxPerCm(30)).toBe(60)
    expect(rulerPxPerCm(40)).toBe(80)
  })

  it('битий чи відсутній gridSize — масштаб за замовчуванням; межі як у setGridSize (10–100)', () => {
    for (const bad of [undefined, null, NaN, 0, -5, '20']) expect(rulerPxPerCm(bad)).toBe(40)
    expect(rulerPxPerCm(5)).toBe(20)
    expect(rulerPxPerCm(500)).toBe(200)
  })

  it('нова лінійка: шкала 0…15 см, поля по 0,5 см (≈ 16 см), висота 1,6 см; центр у точці вставки', () => {
    const a = buildRulerAsset({ x: 960, y: 540 }, 20, 'r1')
    expect(a).toEqual({ id: 'r1', type: 'ruler', src: '', x: 640, y: 508, w: 640, h: 64, rotation: 0, locked: false })
    expect(rulerCmCount(a.w, 20)).toBe(RULER_DEFAULT_CM)
    expect(rulerHeightPx(20)).toBe(64)
    // інша клітинка — інший розмір у px, ті самі 15 см
    const big = buildRulerAsset({ x: 0, y: 0 }, 30, 'r2')
    expect([big.w, big.h, rulerCmCount(big.w, 30)]).toEqual([960, 96, 15])
  })
})

describe('поділки від довжини', () => {
  it('кількість сантиметрів = floor((w − поля) / px на см)', () => {
    expect(rulerCmCount(640, 20)).toBe(15)
    expect(rulerMmCount(640, 20)).toBe(150)
    // розтягнули до 1000 px: (1000 − 40) / 40 = 24 см; хвіст — цілі міліметри до правого поля
    expect(rulerCmCount(1000, 20)).toBe(24)
    expect(rulerMmCount(1000, 20)).toBe(240)
    expect(rulerMmCount(1003, 20)).toBe(240)
    expect(rulerMmCount(1004, 20)).toBe(241)
    expect(rulerMmCount(30, 20)).toBe(0)
  })

  it('мм — коротка, 5 мм — середня, см — довга з числом; «0» на відступі від лівого краю', () => {
    const marks = rulerMarks(640, 40)
    expect(marks).toHaveLength(151)
    expect(marks[0]).toEqual({ x: 20, kind: 'cm', label: '0' })
    expect(marks[1]).toEqual({ x: 24, kind: 'mm' })
    expect(marks[5]).toEqual({ x: 40, kind: 'half' })
    expect(marks[10]).toEqual({ x: 60, kind: 'cm', label: '1' })
    expect(marks[marks.length - 1]).toEqual({ x: 620, kind: 'cm', label: '15' })
    expect(marks.filter(m => m.kind === 'cm').map(m => m.label)).toEqual(
      Array.from({ length: 16 }, (_, i) => String(i)))
  })

  it('довжина — у межах 3…50 см шкали; нечислова — як у нової лінійки', () => {
    expect(rulerMinWidthPx(20)).toBe(160)
    expect(rulerMaxWidthPx(20)).toBe(2040)
    expect(clampRulerWidth(10, 20)).toBe(160)
    expect(clampRulerWidth(99999, 20)).toBe(2040)
    expect(clampRulerWidth(777.4, 20)).toBe(777)
    expect(clampRulerWidth(NaN, 20)).toBe(rulerWidthForCm(RULER_DEFAULT_CM, 20))
    expect(rulerCmCount(rulerMinWidthPx(20), 20)).toBe(3)
    expect(rulerCmCount(rulerMaxWidthPx(20), 20)).toBe(50)
  })
})

describe('малювання', () => {
  function fakeCanvas() {
    const texts: string[] = []
    const attrs: Record<string, unknown> = {}
    let strokes = 0
    let fills = 0
    const ctx: RulerCanvas = {
      save() {}, restore() {}, beginPath() {}, closePath() {}, moveTo() {}, lineTo() {}, quadraticCurveTo() {},
      fill() { fills += 1 },
      stroke() { strokes += 1 },
      fillText(text) { texts.push(text) },
      setAttr(name, value) { attrs[name] = value },
    }
    return { ctx, texts, attrs, counts: () => ({ strokes, fills }) }
  }

  it('числа 0…15 під сантиметровими поділками й одиниця в куті', () => {
    const c = fakeCanvas()
    drawRuler(c.ctx, { w: 640, h: 64, pxPerCm: 40, unit: 'см' })
    expect(c.texts).toEqual([...Array.from({ length: 16 }, (_, i) => String(i)), 'см'])
    // тіло (заливка) + рамка + три групи поділок
    expect(c.counts()).toEqual({ strokes: 4, fills: 1 })
    expect(String(c.attrs.font)).not.toMatch(/googleapis|url\(/)
  })

  it('нульовий розмір — нічого не малюємо', () => {
    const c = fakeCanvas()
    drawRuler(c.ctx, { w: 0, h: 64, pxPerCm: 40, unit: 'см' })
    expect(c.texts).toEqual([])
    expect(c.counts()).toEqual({ strokes: 0, fills: 0 })
  })
})

describe('лінійка тримається на аркуші за повернутою рамкою', () => {
  const PAGE = { w: 1920, h: 1080 }

  it('горизонтальна біля лівого краю — рамка не за краєм', () => {
    expect(clampRulerCenter({ x: 100, y: 10 }, 640, 64, 0, PAGE, 48)).toEqual({ x: 320, y: 32 })
  })

  it('вертикальна (90°) біля лівого краю лишається там, де її поставили (не стрибає на пів довжини)', () => {
    const c = clampRulerCenter({ x: 32, y: 500 }, 640, 64, 90, PAGE, 48)
    expect(c.x).toBeCloseTo(32, 6)
    expect(c.y).toBeCloseTo(500, 6)
  })

  it('праворуч і знизу на аркуші лишається хоча б 48 px, за що вхопити', () => {
    const c = clampRulerCenter({ x: 5000, y: 5000 }, 640, 64, 0, PAGE, 48)
    expect(c.x - 320).toBe(1920 - 48)
    expect(c.y - 32).toBe(1080 - 48)
  })
})

describe('розтягування Transformer\'ом: межі довжини, край навпроти ручки — на місці', () => {
  const old = { x: 100, y: 50, width: 320, height: 32, rotation: 0 }

  it('у межах — рамка як є', () => {
    const next = { ...old, width: 400 }
    expect(clampRulerBox(old, next, 80, 1020, false)).toBe(next)
  })

  it('права ручка коротше межі — найкоротша довжина, лівий край на місці', () => {
    expect(clampRulerBox(old, { ...old, width: 30 }, 80, 1020, false)).toEqual({ ...old, width: 80 })
  })

  it('ліва ручка коротше межі — найкоротша довжина, правий край на місці (і з поворотом)', () => {
    // тягнули ліву ручку: новий лівий край у x=390, правий — 420
    expect(clampRulerBox(old, { ...old, x: 390, width: 30 }, 80, 1020, true)).toEqual({ ...old, x: 340, width: 80 })
    const rot = Math.PI / 2 // 90°: довжина йде вниз
    const c = clampRulerBox({ ...old, rotation: rot }, { ...old, rotation: rot, y: 340, width: 30 }, 80, 1020, true)
    expect(c.width).toBe(80)
    expect(c.x).toBeCloseTo(100, 6)
    expect(c.y).toBeCloseTo(290, 6)
  })

  it('довша межі — найдовша; нульова чи від\'ємна (курсор за другим краєм) — рамка не змінюється', () => {
    expect(clampRulerBox(old, { ...old, width: 5000 }, 80, 1020, false).width).toBe(1020)
    expect(clampRulerBox(old, { ...old, width: 0 }, 80, 1020, false)).toBe(old)
    expect(clampRulerBox(old, { ...old, width: -200 }, 80, 1020, false)).toBe(old)
  })
})

describe('«Інструменти → Геометрія»: плитка «Лінійка» — усім учителям', () => {
  const ruler = () => allInserts().find(e => e.id === 'instruments.ruler')

  it('плитка в картці «Геометрія», без пілота й без гейта', () => {
    const e = ruler()!
    expect(e).toMatchObject({ family: 'instruments', dragMime: RULER_DRAG_MIME, payload: '{}', iconKey: 'ruler' })
    expect(appOf(e)).toBe('geometry')
    expect(visibleInserts({ evidence: false }).some(x => x.id === 'instruments.ruler')).toBe(true)
    expect(insertsByApp(visibleInserts({ evidence: false })).geometry.map(x => x.id)).toContain('instruments.ruler')
    expect(visibleApps({ evidence: false }).some(a => a.app === 'geometry')).toBe(true)
  })

  it('у «Геометрії» — окрема підсекція з плиткою «+» (InsertTileWithAdd)', () => {
    const src = read('modules/winterboard/components/sidebar/GroupContentSidebar.vue')
    const at = src.indexOf('data-testid="tools-instruments"')
    expect(at).toBeGreaterThan(src.indexOf("catalogFamily === 'geometry'"))
    expect(src.slice(at, src.indexOf('</template>', at))).toContain('<InsertTileWithAdd v-for="e in instrumentEntries"')
  })

  it('назва, підказка й одиниця — трьома мовами', () => {
    const tiles = (loc: unknown) => (loc as { winterboard: { insertTiles: Record<string, string> } }).winterboard.insertTiles
    expect([tiles(uk).ruler, tiles(en).ruler, tiles(ru).ruler]).toEqual(['Лінійка', 'Ruler', 'Линейка'])
    expect(tiles(uk).rulerSub).toBe('Прикладіть до лінії й поверніть за кружечок')
    expect(tiles(en).rulerSub).toBeTruthy()
    expect(tiles(ru).rulerSub).toBeTruthy()
    expect([tiles(uk).rulerUnit, tiles(en).rulerUnit, tiles(ru).rulerUnit]).toEqual(['см', 'cm', 'см'])
    for (const loc of [uk, en, ru]) expect(tiles(loc).instruments).toBeTruthy()
    expect(ruler()!.labelKey).toBe('winterboard.insertTiles.ruler')
    expect(ruler()!.sublabelKey).toBe('winterboard.insertTiles.rulerSub')
  })
})

describe('Інтегралик і пульт', () => {
  it('Інтегралик лінійки не бачить і не вставляє', async () => {
    const { buildToolCatalog, runBoardAction } = await import('@/modules/intent/boardActions')
    const tools = await buildToolCatalog()
    expect(tools.some((t: { id: string }) => t.id.startsWith('instruments.'))).toBe(false)
    await expect(runBoardAction({ kind: 'add_tool', payload: { insert_id: 'instruments.ruler' } }))
      .rejects.toThrow('Такого інструмента поки немає на дошці.')
  })

  it('пульт: виду для лінійки немає — ні в «Сценарії», ні серед об\'єктів сторінки, ні для ✍', () => {
    expect(scenarioKind({ type: 'ruler' })).toBeNull()
    expect(currentPageKind({ type: 'ruler' })).toBeNull()
    expect(isIntegralykSolvable({ type: 'ruler', src: '' })).toBe(false)
  })
})

describe('зміни — штатним asset_update', () => {
  const base = buildRulerAsset({ x: 500, y: 300 }, 20, 'r1') as WBAsset

  it.each(['x', 'y', 'w', 'h', 'rotation', 'locked'] as const)('зміна %s = зміна для ops', (field) => {
    const changed = { ...base, [field]: field === 'locked' ? true : 123 }
    expect(assetsEqualByOpsFields(base, changed as WBAsset)).toBe(false)
  })

  it('та сама лінійка — без зайвої операції', () => {
    expect(assetsEqualByOpsFields(base, { ...base })).toBe(true)
  })
})

describe('полотно', () => {
  const canvas = read('modules/winterboard/components/canvas/WBCanvas.vue')

  it('лінійка — у шарі асетів, під шаром штрихів (перо малює поверх)', () => {
    const at = canvas.indexOf("v-else-if=\"asset.type === 'ruler'\"")
    expect(at).toBeGreaterThan(canvas.indexOf('<v-layer ref="assetsLayerRef">'))
    expect(at).toBeLessThan(canvas.indexOf('<v-layer ref="strokesLayerRef">'))
    expect(canvas.slice(at, at + 300)).toContain('@transformend="handleAssetTransformEnd(asset, $event)"')
  })

  it('Transformer виділеної лінійки — лише бокові ручки, без дзеркала, з межами довжини', () => {
    const cfg = canvas.slice(canvas.indexOf('const transformerConfig = computed'), canvas.indexOf('// Selection rect (rubber band)'))
    expect(cfg).toContain("enabledAnchors: ['middle-left', 'middle-right']")
    expect(cfg).toContain('keepRatio: false')
    expect(cfg).toContain('flipEnabled: false')
    expect(cfg).toContain('boundBoxFunc: rulerBoundBox')
    // ручка, з якої почали, запам'ятовується на transformstart — Konva міняє її на протилежну за другим краєм
    const at = canvas.indexOf("v-else-if=\"asset.type === 'ruler'\"")
    expect(canvas.slice(at, at + 300)).toContain('@transformstart="rememberRulerAnchor"')
    const fn = canvas.slice(canvas.indexOf('function rulerBoundBox'), canvas.indexOf('const transformerConfig = computed'))
    expect(fn).toContain('if (rulerResizeAnchor && active !== rulerResizeAnchor) return oldBox')
  })

  it('з пером лінійка натисків не ловить (listening лише з «Вибором»)', () => {
    const fn = canvas.slice(canvas.indexOf('function getRulerConfig'), canvas.indexOf('// ─── Background layer cache'))
    expect(fn).toContain('listening: selectable')
    expect(fn).toContain("const selectable = currentTool.value === 'select'")
  })
})
