/**
 * «Побудувати» для векторів (власник 28.10: «Побудувати — так»): точки, вектори й відрізки з умови задачі →
 * наявна «Геометрія» (geomash_scene). Дані з BE `num_vec_bank_figures` (тут — дослівні відбитки трьох задач пакета).
 */
import { describe, expect, it } from 'vitest'
import '../../vendor/geomash/geo-engine.js'
import { resolveCompanions } from '../capabilityRegistry'
import { buildTaskCompanion, matchesTaskCompanion, TASK_GEOMASH_SIZE, taskGeomashData } from '../taskCompanion'

type Engine = {
  construct(objects: Map<string, unknown>, cs: unknown, cmd: Record<string, unknown>): { objects: Map<string, Record<string, unknown>> }
  deserialize(scene: unknown): { objects: Map<string, Record<string, unknown>> }
  lineDef(objects: Map<string, unknown>, o: unknown): { x: number; y: number; dx: number; dy: number } | null
}
const E = (window as unknown as { GeoEngine: Engine }).GeoEngine

// nmt-oa-3348: a=(3; −2), b=(4; 5) — вільні вектори від O.
const DOT = { geo_points: [{ name: 'O', x: 0, y: 0, hidden: false }, { name: 'a_end', x: 3, y: -2, hidden: true },
  { name: 'b_end', x: 4, y: 5, hidden: true }],
geo_vectors: [{ name: 'a', from: 'O', to: 'a_end' }, { name: 'b', from: 'O', to: 'b_end' }], geo_segments: [] }
// nmt-sc-2580: вектор AB за точками A(1; 3), B(5; 7).
const AB = { geo_points: [{ name: 'A', x: 1, y: 3, hidden: false }, { name: 'B', x: 5, y: 7, hidden: false }],
  geo_vectors: [{ name: 'AB', from: 'A', to: 'B' }], geo_segments: [] }
// …distance_2d-10512: відрізок MK, M(24; 15), K(12; 31) — далеко від початку координат.
const MK = { geo_points: [{ name: 'M', x: 24, y: 15, hidden: false }, { name: 'K', x: 12, y: 31, hidden: false }],
  geo_vectors: [], geo_segments: [{ from: 'M', to: 'K' }] }

const scene = (d: Record<string, unknown>) => (taskGeomashData(d) as { scene: { objects: Array<Record<string, unknown>>; cs: { sc: number } } }).scene

describe('Вектори з умови → «Геометрія»', () => {
  it('об\'єкти — у форматі конструктора «Геометрії», і рушій їх читає', () => {
    let built = new Map<string, unknown>()
    for (const cmd of [{ op: 'point', id: 'O', wx: 0, wy: 0 }, { op: 'point', id: 'a_end', wx: 3, wy: -2 },
      { op: 'point', id: 'b_end', wx: 4, wy: 5 }, { op: 'vector', a: 'O', b: 'a_end' }, { op: 'vector', a: 'O', b: 'b_end' }])
      built = E.construct(built, { ox: 0, oy: 0, sc: 40 }, cmd).objects
    const ours = scene(DOT).objects
    const fields = ['type', 'wx', 'wy', 'p1', 'p2', 'deps', 'visible', 'locked', 'lw']
    const pick = (o: Record<string, unknown>) => Object.fromEntries(fields.filter(f => f in o).map(f => [f, o[f]]))
    // Конструктор називає вектори a, b — так само, як умова.
    expect([...built.values()].map(o => pick(o as Record<string, unknown>))).toEqual(ours.map(pick))
    expect(ours.filter(o => o.type === 'vector').map(o => o.id)).toEqual(['a', 'b'])
    const read = E.deserialize(scene(DOT)).objects
    expect(E.lineDef(read, read.get('a'))).toEqual({ x: 0, y: 0, dx: 3, dy: -2 })
    expect(E.lineDef(read, read.get('b'))).toEqual({ x: 0, y: 0, dx: 4, dy: 5 })
  })

  it('підписи: точки й вектори з умови — так, допоміжні кінці — ні', () => {
    const label = Object.fromEntries(scene(DOT).objects.map(o => [o.id, o.labelMode]))
    expect(label).toEqual({ O: 'name', a_end: 'none', b_end: 'none', a: 'name', b: 'name' })
  })

  it('усі точки вміщуються в рамку картки (початок координат — у центрі)', () => {
    for (const d of [DOT, AB, MK]) {
      const { objects, cs } = scene(d)
      for (const p of objects.filter(o => o.type === 'point')) {
        expect(Math.abs(p.wx as number) * cs.sc).toBeLessThanOrEqual(TASK_GEOMASH_SIZE.w / 2 - 36 + 1e-9)
        expect(Math.abs(p.wy as number) * cs.sc).toBeLessThanOrEqual(TASK_GEOMASH_SIZE.h / 2 - 36 + 1e-9)
      }
    }
  })

  it('кнопка — лише з точками й векторами з умови; порожній намір кнопки не дає (живий кейс 2026-08-16)', () => {
    expect(resolveCompanions(['show_vectors_2d'], DOT, []).map(r => r.rendererType)).toEqual(['geomash_scene'])
    expect(resolveCompanions(['show_vectors_2d'], {}, ['vector_2d'])).toEqual([])
    expect(resolveCompanions(['show_vectors_2d'], { points: [[1, 2]] }, [])).toEqual([])
  })

  it('пошкоджені дані не стають рисунком навмання', () => {
    const broken = [
      { ...DOT, geo_vectors: [{ name: 'a', from: 'O', to: 'X' }] },
      { ...DOT, geo_points: [{ name: 'O', x: Number.NaN, y: 0 }] },
      { ...AB, geo_vectors: [{ name: 'A', from: 'A', to: 'B' }] },
      { ...AB, geo_vectors: [{ name: 'x"><img', from: 'A', to: 'B' }] },
      { ...AB, geo_vectors: [], geo_segments: [] },
    ]
    for (const d of broken) expect(taskGeomashData(d)).toBeNull()
  })

  it('повтор «Побудувати» знаходить свою сцену й після reload; сцена сусідньої задачі — не своя', () => {
    const [mine] = resolveCompanions(['show_vectors_2d'], DOT, [])
    const asset = buildTaskCompanion(mine, 800, 60, 'geo')!
    expect(asset.type).toBe('geomash_scene')
    expect([asset.w, asset.h]).toEqual([TASK_GEOMASH_SIZE.w, TASK_GEOMASH_SIZE.h])
    // Учитель змінив колір і підпис вектора — це все ще та сама сцена.
    const edited = JSON.parse(JSON.stringify(asset))
    edited.data.scene.objects[3].color = '#000000'
    edited.data.scene.objects[3].labelMode = 'nameValue'
    expect(matchesTaskCompanion(edited, mine)).toBe(true)
    const [other] = resolveCompanions(['show_vectors_2d'], AB, [])
    expect(matchesTaskCompanion(edited, other)).toBe(false)
  })
})
