/**
 * Транспортир, косинець і циркуль (власник 22.10.2026: «Роби всі… А всі інші подібно до лінійки. А циркуля треба
 * зробити не похожого, як в них. А щоб був похожий на реальний»). LAW §9 v1.47.
 *
 *   — масштаб як у лінійки (1 клітинка = 5 мм), даних понад геометрію немає;
 *   — транспортир: дві шкали 0…180°, радіус 3…15 см; косинець: катет 5…30 см, шкали на обох катетах, віконце;
 *   — циркуль: голка (0, h), грифель (w, h), w = радіус з кроком 1 мм; крутять навколо голки — дуга штатним штрихом;
 *   — плитки в «Геометрії» й у кнопці лівої панелі, Інтегралик їх не бачить, пульт не показує.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import uk from '@/i18n/locales/uk.json'
import en from '@/i18n/locales/en.json'
import ru from '@/i18n/locales/ru.json'
import {
  COMPASS_DRAG_MIME, PROTRACTOR_DRAG_MIME, SET_SQUARE_DRAG_MIME,
  buildCompassAsset, buildProtractorAsset, buildSetSquareAsset,
  clampCompassRadius, clampProtractorRadius, clampSetSquareLeg, compassHingeDrop, compassSize, placeInsidePage,
  protractorSize,
} from '../constants/draftingDefaults'
import {
  drawProtractor, drawSetSquare, pointAtDegree, protractorMarks, setSquareBand, setSquareMmCount,
  type DraftingCanvas,
} from '../board/draftingShapes'
import {
  angleDelta, compassArcPoints, compassGeometry, compassNeedle, compassPartAt, compassPencil, compassRadiusLabel,
  drawCompass,
} from '../board/compassShape'
import { allInserts, appOf } from '../components/sidebar/insertRegistry'
import { assetCapabilities } from '../board/objectStandard'
import { assetsEqualByOpsFields } from '../board/state/assetEquality'
import { currentPageKind, scenarioKind } from '../remote/remoteScenarioAdapter'
import { isIntegralykSolvable } from '../board/handwriteSolution'
import { NON_SCENE_INSERT_IDS } from '@/modules/intent/sceneMetric'
import type { WBAsset } from '../types/winterboard'

const SRC = resolve(__dirname, '../../..')
const read = (rel: string) => readFileSync(resolve(SRC, rel), 'utf-8').replace(/\r\n/g, '\n')
const TYPES = ['protractor', 'set_square', 'compass'] as const

/** Полотно-записувач: скільки підписів і заливок намальовано. */
function recorder(): DraftingCanvas & { texts: string[]; fills: number; turns: number[] } {
  const r = {
    texts: [] as string[], fills: 0, turns: [] as number[],
    save() {}, restore() {}, beginPath() {}, closePath() {}, moveTo() {}, lineTo() {}, quadraticCurveTo() {},
    arc() {}, translate() {}, stroke() {}, setAttr() {},
    rotate(a: number) { r.turns.push(a) },
    fill() { r.fills++ },
    fillText(t: string) { r.texts.push(t) },
  }
  return r
}

describe('розміри — як у лінійки: 1 клітинка = 5 мм (40 px/см)', () => {
  it('транспортир: радіус 6 см → 480 × (240 + смужка 0,8 см); межі 3…15 см', () => {
    expect(buildProtractorAsset({ x: 500, y: 400 }, 20, 'p')).toMatchObject({ type: 'protractor', w: 480, h: 272, x: 260, y: 264 })
    expect(protractorSize(120, 20)).toEqual({ w: 240, h: 152 })
    expect(clampProtractorRadius(10, 20)).toBe(120)
    expect(clampProtractorRadius(9999, 20)).toBe(600)
    expect(clampProtractorRadius('x', 20)).toBe(240)
  })

  it('косинець: катет 10 см; межі 5…30 см', () => {
    expect(buildSetSquareAsset({ x: 500, y: 400 }, 20, 's')).toMatchObject({ type: 'set_square', w: 400, h: 400 })
    expect(clampSetSquareLeg(50, 20)).toBe(200)
    expect(clampSetSquareLeg(5000, 20)).toBe(1200)
  })

  it('циркуль: радіус 4 см, ніжки 12 см — що ширше розведено, то нижче шарнір', () => {
    const c = buildCompassAsset({ x: 500, y: 400 }, 20, 'c')
    expect(c).toMatchObject({ type: 'compass', w: 160 })
    expect(c.h).toBe(compassSize(160, 20).h)
    expect(compassHingeDrop(400, 20)).toBeLessThan(compassHingeDrop(100, 20))
    expect(compassHingeDrop(160, 20)).toBeCloseTo(Math.sqrt(480 ** 2 - 80 ** 2), 5)
  })

  it('новий інструмент — цілком на аркуші, навіть коли центр видимої частини біля краю', () => {
    expect(placeInsidePage({ x: 894, y: 861, w: 400, h: 400 }, 1920, 1080)).toMatchObject({ x: 894, y: 680 })
    expect(placeInsidePage({ x: 1800, y: -10, w: 160, h: 555 }, 1920, 1080)).toMatchObject({ x: 1760, y: 0 })
    expect(placeInsidePage({ x: 10, y: 10, w: 3000, h: 50 }, 1920, 1080)).toMatchObject({ x: 0, y: 10 })
  })

  it('радіус циркуля — крок 1 мм, межі 0,5…20 см', () => {
    expect(clampCompassRadius(141, 20)).toBe(140)
    expect(clampCompassRadius(1, 20)).toBe(20)
    expect(clampCompassRadius(10_000, 20)).toBe(800)
    expect(clampCompassRadius(undefined, 20)).toBe(160)
  })
})

describe('транспортир', () => {
  it('поділки 0…180°: 19 довгих (кожні 10°), 18 середніх (5°), решта — кожен градус', () => {
    const m = protractorMarks()
    expect(m).toHaveLength(181)
    expect(m.filter(x => x.kind === 'ten')).toHaveLength(19)
    expect(m.filter(x => x.kind === 'five')).toHaveLength(18)
  })

  it('0° праворуч, 90° угорі, 180° ліворуч від центру', () => {
    const at = (d: number) => pointAtDegree(100, 100, 50, d)
    expect(at(0).x).toBeCloseTo(150)
    expect([at(90).x, at(90).y].map(v => Math.round(v))).toEqual([100, 50])
    expect(at(180).x).toBeCloseTo(50)
  })

  it('дві шкали: зовнішня 0→180 і внутрішня 180→0 (числа кожні 10°)', () => {
    const r = recorder()
    drawProtractor(r, { w: 480, h: 272, pxPerCm: 40 })
    expect(r.texts.slice(0, 19)).toEqual(Array.from({ length: 19 }, (_, i) => String(i * 10)))
    expect(r.texts.slice(19)).toEqual(Array.from({ length: 19 }, (_, i) => String(180 - i * 10)))
  })

  it('нульовий розмір — нічого не малюємо', () => {
    const r = recorder()
    drawProtractor(r, { w: 0, h: 0, pxPerCm: 40 })
    expect([r.fills, r.texts.length]).toEqual([0, 0])
  })
})

describe('косинець', () => {
  it('шкали на обох катетах від прямого кута, «45°» біля гострих кутів', () => {
    const r = recorder()
    drawSetSquare(r, { leg: 400, pxPerCm: 40 })
    expect(setSquareMmCount(400, 40)).toBe(85)
    // нижній катет — 0…8, лівий — 1…8 (без «0» впритул до нижнього), і два «45°»
    expect(r.texts).toEqual([...'012345678'].concat([...'12345678'], ['45°', '45°']))
  })

  it('віконце є й на найменшому косинці: смуга пластмаси — до 2,2 см, але не більше п\'ятої частини катета', () => {
    expect(setSquareBand(400, 40)).toBe(88)
    expect(setSquareBand(200, 40)).toBe(44)
  })
})

describe('циркуль: голка на місці, грифель — на радіусі', () => {
  const needle = { x: 300, y: 500 }

  it('геометрія з голки, радіуса й напряму — голка й грифель там, де треба, за будь-якого кута', () => {
    for (const angle of [0, 30, 90, -135, 179]) {
      const g = compassGeometry(needle, 160, angle, 20)
      const n = compassNeedle(g)
      const p = compassPencil(g)
      expect([n.x, n.y].map(v => Math.round(v * 1000) / 1000)).toEqual([300, 500])
      expect(p.x).toBeCloseTo(300 + 160 * Math.cos((angle * Math.PI) / 180), 6)
      expect(p.y).toBeCloseTo(500 + 160 * Math.sin((angle * Math.PI) / 180), 6)
      expect(g.rotation).toBe(angle)
    }
  })

  it('новий циркуль стоїть ніжками вниз: голка ліворуч, грифель праворуч на одній висоті', () => {
    const c = buildCompassAsset({ x: 500, y: 400 }, 20, 'c')
    const n = compassNeedle(c)
    const p = compassPencil(c)
    expect([p.x - n.x, p.y - n.y]).toEqual([160, 0])
    expect(n.y).toBe(c.y + c.h)
  })

  it('поворот через ±180° не стрибає на цілий оберт', () => {
    expect(angleDelta(170, -170)).toBe(20)
    expect(angleDelta(-170, 170)).toBe(-20)
    expect(angleDelta(10, 10)).toBe(0)
  })

  it('дуга: обидва кінці на колі, хорда не довша ~3 px; повний оберт замикається; у зворотний бік — теж', () => {
    const pts = compassArcPoints(needle, 160, 0, 360)
    for (const q of pts) expect(Math.hypot(q.x - 300, q.y - 500)).toBeCloseTo(160, 6)
    for (let i = 1; i < pts.length; i++) {
      expect(Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y)).toBeLessThanOrEqual(3.01)
    }
    expect(pts[0].x).toBeCloseTo(pts[pts.length - 1].x, 6)
    const back = compassArcPoints(needle, 100, 90, 0)
    expect(back[0].y).toBeCloseTo(600, 6)
    expect(back[back.length - 1].x).toBeCloseTo(400, 6)
  })

  it('за що взяли: грифель — радіус, ручка вгорі — креслити, решта — перенести', () => {
    const { w, h } = compassSize(160, 20)
    expect(compassPartAt({ x: w + 5, y: h - 5 }, w, h, 40)).toBe('pencil')
    expect(compassPartAt({ x: w / 2, y: 10 }, w, h, 40)).toBe('knob')
    expect(compassPartAt({ x: 0, y: h }, w, h, 40)).toBe('body')
    expect(compassPartAt({ x: w * 0.3, y: h * 0.6 }, w, h, 40)).toBe('body')
  })

  it('підпис радіуса: «r = 4 см», «r = 3,5 см», англійською — з крапкою', () => {
    expect(compassRadiusLabel(160, 40, 'см')).toBe('r = 4 см')
    expect(compassRadiusLabel(140, 40, 'см')).toBe('r = 3,5 см')
    expect(compassRadiusLabel(140, 40, 'cm')).toBe('r = 3.5 cm')
  })

  it('справжній циркуль: ніжки, голка, тримач, грифель кольору пера, ручка, шарнір; підпис — лише коли просили', () => {
    const r = recorder()
    drawCompass(r, { w: 160, h: 555, pxPerCm: 40, ink: '#dc2626' })
    expect(r.texts).toEqual([])
    expect(r.fills).toBeGreaterThanOrEqual(9)
    const labelled = recorder()
    drawCompass(labelled, { w: 160, h: 555, pxPerCm: 40, ink: '#dc2626', radiusLabel: 'r = 4 см' })
    expect(labelled.texts).toEqual(['r = 4 см'])
  })

  it('підпис читається прямо, хоч би як циркуль повернули', () => {
    const r = recorder()
    drawCompass(r, { w: 160, h: 555, pxPerCm: 40, ink: '#000', radiusLabel: 'r = 4 см', uprightDeg: -72 })
    expect(r.turns).toEqual([(72 * Math.PI) / 180])
  })
})

describe('стандарт і реєстр', () => {
  it('нові типи — креслярські: без трею й верхньої панелі; рухаються, дублюються, блокуються', () => {
    for (const t of TYPES) {
      const c = assetCapabilities(t)
      expect([t, c.minimizable, c.windowChrome, c.movable, c.duplicable, c.lockable]).toEqual([t, false, false, true, true, true])
    }
  })

  it('плитки в «Геометрії» поруч із лінійкою: лінійка, косинець, транспортир, циркуль', () => {
    const inst = allInserts().filter(e => e.family === 'instruments')
    expect(inst.map(e => e.id)).toEqual(['instruments.ruler', 'instruments.set_square', 'instruments.protractor', 'instruments.compass'])
    expect(inst.slice(1).map(e => e.dragMime)).toEqual([SET_SQUARE_DRAG_MIME, PROTRACTOR_DRAG_MIME, COMPASS_DRAG_MIME])
    for (const e of inst) expect([appOf(e), e.payload]).toEqual(['geometry', '{}'])
  })

  it('назви й підказки — трьома мовами', () => {
    const tiles = (loc: unknown) => (loc as { winterboard: { insertTiles: Record<string, string> } }).winterboard.insertTiles
    expect([tiles(uk).setSquare, tiles(uk).protractor, tiles(uk).compass]).toEqual(['Косинець', 'Транспортир', 'Циркуль'])
    expect([tiles(en).setSquare, tiles(en).protractor, tiles(en).compass]).toEqual(['Set square', 'Protractor', 'Compass'])
    for (const loc of [uk, en, ru]) {
      for (const k of ['setSquareSub', 'protractorSub', 'compassSub']) expect(tiles(loc)[k], k).toBeTruthy()
    }
  })

  it('Інтегралик їх не бачить і не вставляє; пульт виду не має', async () => {
    const { buildToolCatalog, runBoardAction } = await import('@/modules/intent/boardActions')
    const tools = await buildToolCatalog()
    expect(tools.some((t: { id: string }) => t.id.startsWith('instruments.'))).toBe(false)
    await expect(runBoardAction({ kind: 'add_tool', payload: { insert_id: 'instruments.compass' } }))
      .rejects.toThrow('Такого інструмента поки немає на дошці.')
    for (const id of ['instruments.set_square', 'instruments.protractor', 'instruments.compass']) {
      expect(NON_SCENE_INSERT_IDS).toContain(id)
    }
    for (const type of TYPES) {
      expect(scenarioKind({ type })).toBeNull()
      expect(currentPageKind({ type })).toBeNull()
      expect(isIntegralykSolvable({ type, src: '' })).toBe(false)
    }
  })

  it('зміни — штатним asset_update: радіус циркуля (w) і напрям (rotation) — поля ops', () => {
    const c = buildCompassAsset({ x: 500, y: 400 }, 20, 'c') as WBAsset
    expect(assetsEqualByOpsFields(c, { ...c, w: 200 })).toBe(false)
    expect(assetsEqualByOpsFields(c, { ...c, rotation: 45 })).toBe(false)
    expect(assetsEqualByOpsFields(c, { ...c })).toBe(true)
  })
})

describe('полотно', () => {
  const canvas = read('modules/winterboard/components/canvas/WBCanvas.vue')

  it('усі три — у шарі асетів, під шаром штрихів (перо малює поверх)', () => {
    for (const marker of [
      "v-else-if=\"asset.type === 'protractor' || asset.type === 'set_square'\"",
      "v-else-if=\"asset.type === 'compass'\"",
    ]) {
      const at = canvas.indexOf(marker)
      expect(at, marker).toBeGreaterThan(canvas.indexOf('<v-layer ref="assetsLayerRef">'))
      expect(at, marker).toBeLessThan(canvas.indexOf('<v-layer ref="strokesLayerRef">'))
    }
  })

  it('транспортир і косинець — кутові ручки без перекосу й дзеркала; циркуль — без ручок і повороту рамкою', () => {
    const cfg = canvas.slice(canvas.indexOf('const transformerConfig = computed'), canvas.indexOf('// Selection rect (rubber band)'))
    expect(cfg).toContain("enabledAnchors: ['top-left', 'top-right', 'bottom-left', 'bottom-right']")
    expect(cfg).toContain('boundBoxFunc: uniformInstrumentBoundBox')
    expect(cfg).toContain("selectedInstrumentType.value === 'compass' ? { enabledAnchors: [], rotateEnabled: false, resizeEnabled: false }")
  })

  it('циркуль Konva не тягне — один жест; креслення — штатний штрих пера кольором і товщиною пера', () => {
    const at = canvas.indexOf("v-else-if=\"asset.type === 'compass'\"")
    expect(canvas.slice(at, at + 200)).toContain('@pointerdown="startCompassGesture(asset, $event)"')
    const cfg = canvas.slice(canvas.indexOf('function getCompassConfig'), canvas.indexOf('interface CompassGesture'))
    expect(cfg).toContain('draggable: false')
    expect(cfg).toContain('listening: selectable')
    const end = canvas.slice(canvas.indexOf('function endCompassGesture'), canvas.indexOf('// ─── Background layer cache'))
    expect(end).toContain("emit('stroke-add', {")
    expect(end).toContain("tool: 'pen'")
    expect(end).toContain('color: props.color')
    expect(end).toContain('size: props.size')
    expect(end).toContain("emit('asset-update', { ...g.asset, ...geom })")
  })

  it('з пером транспортир і косинець натисків не ловлять (listening лише з «Вибором»)', () => {
    const fn = canvas.slice(canvas.indexOf('function getDraftingConfig'), canvas.indexOf('// ─── Циркуль (2026-10-22)'))
    expect(fn).toContain('listening: selectable')
    expect(fn).toContain("const selectable = currentTool.value === 'select'")
  })
})
