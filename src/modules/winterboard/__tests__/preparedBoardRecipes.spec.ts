/**
 * TLV2-06R · готові рецепти D-VM2 на ЧИННИХ об'єктах дошки (ТЗ 43 §4–§5, §9.4–9.8).
 *
 *   • рівно 6 рецептів з ids і потребами D-VM2; 4 supported / 2 gap — з причинами;
 *   • накладання → `visual_capsule`, паралелограм → `geometry_2d_v2/parallelogram`,
 *     коло → `graph_calculator`; жодного іншого цільового типу;
 *   • числа даних виведено з D-VM2 (копія configs.js, sha256 звірено), а не вигадано;
 *   • builder дає асет чинного типу; `gap` і невідомий id — помилка без картки й без fallback;
 *   • рецепти не є інструментами: каталог Tools їх не містить і від них не росте.
 */
import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { beforeAll, describe, expect, it } from 'vitest'
import {
  BoardRecipeError,
  buildBoardRecipeAsset,
  DVM2_CONFIGS_SHA256,
  findBoardRecipe,
  PREPARED_BOARD_RECIPES,
  type CapsuleTargetData,
  type Geometry2DTargetData,
  type GraphCalculatorTargetData,
  type SupportedBoardRecipe,
} from '../board/preparedBoardRecipes'
import { resolveCapsule } from '../components/board/objects/visualCapsules/capsuleRegistry'
import { TARGET_SIDE_LENGTHS } from '../components/board/objects/visualCapsules/trianglesOverlayGeometry'
import { allInserts, STATIC_INSERTS } from '../components/sidebar/insertRegistry'
import { GraphCalc } from '../vendor/graph_calculator/graph-calculator.js'
import { OVERLAY_RENDERERS } from '../components/canvas/overlayRegistry'
import VisualCapsuleAssetRenderer from '../components/board/objects/VisualCapsuleAssetRenderer.vue'
import Geometry2DRenderer from '../components/board/objects/Geometry2DRenderer.vue'
import GraphCalculatorRenderer from '../components/board/objects/GraphCalculatorRenderer.vue'

const FIXTURE = resolve(__dirname, 'fixtures/dvm2.planimetry.geometry2d.configs.js.txt')
const DEG = Math.PI / 180

interface Dvm2Variant { id: string; [k: string]: unknown }
type Dvm2 = Record<string, { need: string; variants: Dvm2Variant[] }>

function loadDvm2(): Dvm2 {
  const sandbox: Record<string, unknown> = {}
  // eslint-disable-next-line no-new-func
  new Function('window', readFileSync(FIXTURE, 'utf-8'))(sandbox)
  return sandbox.PlanimetryConfigs as Dvm2
}

let dvm2: Dvm2
const variant = (id: string): Dvm2Variant & { familyId: string; need: string } => {
  for (const [familyId, fam] of Object.entries(dvm2)) {
    const v = fam.variants.find((x) => `tpl.${x.id}` === id)
    if (v) return { ...v, familyId, need: fam.need }
  }
  throw new Error(`немає ${id} у D-VM2`)
}
const supported = (id: string) => findBoardRecipe(id) as SupportedBoardRecipe

beforeAll(async () => {
  dvm2 = loadDvm2()
  await import('../vendor/geo2d')
})

describe('TLV2-06R · реєстр рецептів = D-VM2, лише дані', () => {
  it('копія configs.js побайтово та, що опублікував Диз; provenance посилається на неї', () => {
    expect(createHash('sha256').update(readFileSync(FIXTURE)).digest('hex')).toBe(DVM2_CONFIGS_SHA256)
    for (const r of PREPARED_BOARD_RECIPES) expect(r.provenance.sourceHash).toBe(DVM2_CONFIGS_SHA256)
  })

  it('рівно 6 рецептів — усі варіанти D-VM2, з їхніми потребами, назвами й сімействами', () => {
    const fromSource = Object.values(dvm2).flatMap((f) => f.variants.map((v) => `tpl.${v.id}`)).sort()
    expect(PREPARED_BOARD_RECIPES.map((r) => r.id).sort()).toEqual(fromSource)
    expect(new Set(PREPARED_BOARD_RECIPES.map((r) => r.id)).size).toBe(6)
    for (const r of PREPARED_BOARD_RECIPES) {
      const v = variant(r.id)
      expect(r.needId, r.id).toBe(v.need)
      expect(r.title, r.id).toBe(v.title)
      expect(r.provenance.variantId).toBe(v.id)
      expect(r.provenance.familyId).toBe(v.familyId)
    }
  })

  it('один механізм — один власник: 4 supported / 2 gap, цільові типи чинних об\'єктів', () => {
    expect(PREPARED_BOARD_RECIPES.map((r) => [r.id, r.targetType, r.status])).toEqual([
      ['tpl.g7-l16-abc-edf', 'visual_capsule', 'supported'],
      ['tpl.g7-l16-xyz-hkg', 'visual_capsule', 'gap'],
      ['tpl.g8-l04-abcd', 'geometry_2d_v2', 'supported'],
      ['tpl.g8-l04-klmn', 'geometry_2d_v2', 'gap'],
      ['tpl.g9-l27-c3-m2-r4', 'graph_calculator', 'supported'],
      ['tpl.g9-l27-cm2-5-r3', 'graph_calculator', 'supported'],
    ])
    for (const r of PREPARED_BOARD_RECIPES) {
      if (r.status === 'gap') expect(r.gapReason.length, r.id).toBeGreaterThan(40)
      else expect(r.limits.length, r.id).toBeGreaterThan(0)
    }
    // цільовий тип рендерить ЧИННИЙ рендерер реєстру overlay — окремого немає
    expect(OVERLAY_RENDERERS.visual_capsule.component).toBe(VisualCapsuleAssetRenderer)
    expect(OVERLAY_RENDERERS.geometry_2d_v2.component).toBe(Geometry2DRenderer)
    expect(OVERLAY_RENDERERS.graph_calculator.component).toBe(GraphCalculatorRenderer)
  })

  it('ABC/EDF → чинна капсула: та сама пара трикутників і ті самі довжини, що в D-VM2', () => {
    const r = supported('tpl.g7-l16-abc-edf')
    const target = r.targetData as CapsuleTargetData
    const capsule = resolveCapsule(target.visual_id, target.capsule_version)
    expect(capsule.modes).toContain(target.mode)
    const v = variant(r.id) as unknown as { sides: number[]; fixedLabels: string[]; movingLabels: string[]; answer: string }
    // triangleFromSides(p12, p13, p23) на мітках E, D, F: ED = s0, EF = s1, DF = s2
    expect([v.fixedLabels.join(''), v.movingLabels.join('')]).toEqual(['EDF', 'ABC'])
    expect(TARGET_SIDE_LENGTHS).toEqual({ DE: v.sides[0], EF: v.sides[1], DF: v.sides[2] })
    expect(v.answer).toBe('D')
  })

  it('ABCD → чинний preset parallelogram: A, B, D дають AB = 5, AD = 3, ∠A = 58° з D-VM2', () => {
    const r = supported('tpl.g8-l04-abcd')
    const target = r.targetData as Geometry2DTargetData
    const v = variant(r.id) as unknown as { labels: string[]; sideA: number; sideB: number; theta0: number }
    expect(target.preset).toBe('parallelogram')
    expect(v.labels).toEqual(['A', 'B', 'C', 'D']) // букви preset-а — ті самі
    const W = window as unknown as { Geo2D: { PRESETS: Record<string, { build(c: unknown): void; toggles: { key: string }[] }> } }
    const preset = W.Geo2D.PRESETS.parallelogram
    const ids: Array<{ id: string; kind: string; movable?: boolean }> = []
    preset.build({ add: (o: { id: string; kind: string; movable?: boolean }) => ids.push(o) })
    const free = ids.filter((o) => o.movable).map((o) => o.id).sort()
    expect(Object.keys(target.pointsSnapshot ?? {}).sort()).toEqual(free) // тягнуться саме A, B, D
    for (const key of Object.keys(target.toggles ?? {})) {
      expect(preset.toggles.map((t) => t.key), key).toContain(key)
    }
    const { A, B, D } = target.pointsSnapshot!
    expect(Math.hypot(B.x - A.x, B.y - A.y)).toBeCloseTo(v.sideA, 5)
    expect(Math.hypot(D.x - A.x, D.y - A.y)).toBeCloseTo(v.sideB, 5)
    expect(Math.atan2(D.y - A.y, D.x - A.x) / DEG).toBeCloseTo(v.theta0, 4)
  })

  it.each(['tpl.g9-l27-c3-m2-r4', 'tpl.g9-l27-cm2-5-r3'])('%s → чинний Graph Calculator: неявне рівняння саме цього кола', (id) => {
    const r = supported(id)
    const target = r.targetData as GraphCalculatorTargetData
    const v = variant(id) as unknown as { center: number[]; radius: number; view: number[] }
    const [a, b] = v.center
    const R = v.radius
    expect(target.expressions).toHaveLength(1)
    const parsed = GraphCalc.classify(target.expressions[0].src, []) as { kind: string; lhs: unknown; rhs: unknown }
    expect(parsed.kind).toBe('implicit')
    const f = (x: number, y: number) =>
      GraphCalc.evalAst(parsed.lhs, { x, y }) - GraphCalc.evalAst(parsed.rhs, { x, y })
    for (let k = 0; k < 12; k++) {
      const t = (k / 12) * 2 * Math.PI
      expect(f(a + R * Math.cos(t), b + R * Math.sin(t))).toBeCloseTo(0, 9)
    }
    expect(f(a, b)).toBeLessThan(0)
    expect(f(a + 2 * R, b)).toBeGreaterThan(0)
    // вікно: центр view D-VM2, масштаб вміщує view у картку 480×360
    const [x0, y0, x1, y1] = v.view
    expect(target.viewport.cx).toBeCloseTo((x0 + x1) / 2, 9)
    expect(target.viewport.cy).toBeCloseTo((y0 + y1) / 2, 9)
    expect(target.viewport.scale).toBe(Math.floor(Math.min(480 / (x1 - x0), 360 / (y1 - y0))))
  })
})

describe('TLV2-06R · builder: чинний тип або контрольована відмова', () => {
  it.each(PREPARED_BOARD_RECIPES.filter((r) => r.status === 'supported').map((r) => r.id))(
    '%s: асет чинного типу, центр у точці, дані рецепта',
    (id) => {
      const r = supported(id)
      const asset = buildBoardRecipeAsset(id, { x: 900, y: 600 }) as unknown as {
        type: string; x: number; y: number; w: number; h: number; data: Record<string, unknown>
      }
      expect(asset.type).toBe(r.targetType)
      expect(asset.x + asset.w / 2).toBe(900)
      expect(asset.y + asset.h / 2).toBe(600)
      expect(asset.data.version).toBe(1)
      expect(JSON.parse(JSON.stringify(asset.data))).toEqual(asset.data)
      if (r.targetType === 'visual_capsule') {
        expect(asset.data).toEqual({ version: 1, ...(r.targetData as CapsuleTargetData) })
      } else if (r.targetType === 'geometry_2d_v2') {
        const t = r.targetData as Geometry2DTargetData
        expect(asset.data).toEqual({ version: 1, preset: t.preset, pointsSnapshot: t.pointsSnapshot, toggles: t.toggles })
      } else {
        const t = r.targetData as GraphCalculatorTargetData
        const state = asset.data.state as { expressions: Array<Record<string, unknown>>; params: object; viewport: object }
        expect(state.expressions.map((e) => [e.src, e.color, e.hidden])).toEqual(t.expressions.map((e) => [e.src, e.color, false]))
        expect(typeof state.expressions[0].id).toBe('string')
        expect(state.params).toEqual({})
        expect(state.viewport).toEqual(t.viewport)
        expect(asset.data.meta).toEqual({ last_snapshot_seq: 0 })
      }
    },
  )

  it.each(['tpl.g7-l16-xyz-hkg', 'tpl.g8-l04-klmn'])('gap %s: помилка з причиною, картки немає', (id) => {
    const err = (() => { try { buildBoardRecipeAsset(id, { x: 0, y: 0 }) } catch (e) { return e } return null })()
    expect(err).toBeInstanceOf(BoardRecipeError)
    expect((err as BoardRecipeError).code).toBe('gap')
    expect((err as BoardRecipeError).reason).toBe((findBoardRecipe(id) as { gapReason: string }).gapReason)
  })

  it.each(['tpl.unknown', 'g8-l04-abcd', 'planimetry.parallelogram', '', undefined, 42])('невідомий id %s: fail-closed', (id) => {
    expect(findBoardRecipe(id)).toBeNull()
    const err = (() => { try { buildBoardRecipeAsset(id, { x: 0, y: 0 }) } catch (e) { return e } return null })()
    expect((err as BoardRecipeError).code).toBe('unknown_recipe')
  })
})

describe('TLV2-06R · рецепти не є інструментами', () => {
  it('у Tools немає жодного tpl.* і каталог не залежить від кількості рецептів', () => {
    // рушій завантажено в beforeAll → window.GEO_PRESETS заповнений, як на живій дошці
    const ids = allInserts().map((e) => e.id)
    expect(ids.filter((id) => id.includes('tpl.'))).toEqual([])
    expect(STATIC_INSERTS.some((e) => e.payload.includes('recipeId') || e.dragMime.includes('recipe'))).toBe(false)
    // Geometry = 14 presets Geo2D + GeoMASH, як до TLV2-06
    const geometry = allInserts().filter((e) => e.family === 'planimetry' || e.family === 'geomash')
    expect(geometry.filter((e) => e.family === 'planimetry')).toHaveLength(14)
    expect(geometry.filter((e) => e.family === 'geomash').map((e) => e.id)).toEqual(['geomash.scene'])
  })
})
