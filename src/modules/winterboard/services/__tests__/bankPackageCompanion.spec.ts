import { describe, expect, it } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import samples from './bank-package-visuals.json'
import '../../vendor/nmt3d/nmt-templates.js'
import '../../vendor/nmt3d/nmt-3d.js'
import { GraphCalc } from '../../vendor/graph_calculator/graph-calculator.js'
import { resolveCompanions } from '../capabilityRegistry'
import {
  buildTaskCompanion, matchesTaskCompanion, NMT3D_TEMPLATE_KEYS, SOLID_OPTS, SOLID_PARAMS, taskSolidData,
} from '../taskCompanion'
import { useWBStore } from '../../board/state/boardStore'

type Row = (typeof samples.tasks)[number] & {
  fingerprint?: { intents: string[]; extracted_data: Record<string, unknown> } | null
  reason?: string
  probes?: Array<{ x: number; y: number | null }>
}
type Template = { params: Record<string, { min: number; max: number }>; aux: Array<{ key: string }> }
const TEMPLATES = (window as unknown as { NMT3D: { TEMPLATES: Record<string, Template> } }).NMT3D.TEMPLATES
const rows = samples.tasks as Row[]
const built = rows.filter(r => r.fingerprint)

function host(): HTMLElement {
  const el = document.createElement('div')
  el.getBoundingClientRect = () =>
    ({ width: 800, height: 600, left: 0, top: 0, right: 800, bottom: 600, x: 0, y: 0, toJSON: () => ({}) }) as DOMRect
  document.body.appendChild(el)
  return el
}

function expectProbes(source: string, probes: Array<{ x: number; y: number | null }>) {
  const c = GraphCalc.classify(source.startsWith('y=') ? source : `y=${source}`, [])
  expect(c.kind).toBe('explicitY')
  for (const probe of probes) {
    const actual = GraphCalc.evalAst(c.ast, { x: probe.x })
    if (probe.y === null) expect(Number.isFinite(actual), `${source} @ ${probe.x}`).toBe(false)
    else expect(Math.abs(actual - probe.y), `${source} @ ${probe.x}`).toBeLessThanOrEqual(1e-8 + 1e-12 * Math.abs(probe.y))
  }
}

describe('Три пакети: «Побудувати» з надрукованої умови', () => {
  it('обсяг: 668 задач, 179 побудов з умови, решта — з причиною', () => {
    expect(rows).toHaveLength(668)
    expect(built).toHaveLength(179)
    for (const r of rows.filter(t => t.handled && !t.fingerprint)) expect(r.reason, r.id).toBeTruthy()
  })

  it.each(built.filter(r => r.fingerprint!.intents[0] === 'show_graph'))('$id: графік функції умови', row => {
    const fp = row.fingerprint!
    const [resolved] = resolveCompanions(fp.intents, fp.extracted_data, [])
    expect(resolved.rendererType).toBe('graph_calculator')
    const asset = buildTaskCompanion(resolved, 900, 24, 'graph')!
    const src = (asset.data as unknown as { state: { expressions: Array<{ src: string }> } }).state.expressions[0].src
    expectProbes(src, row.probes!)
  })

  it.each(built.filter(r => r.fingerprint!.intents[0] === 'show_integral_area'))('$id: визначений інтеграл', row => {
    const fp = row.fingerprint!
    const resolved = resolveCompanions(fp.intents, fp.extracted_data, [])
    expect(resolved).toHaveLength(1)
    const asset = buildTaskCompanion(resolved[0], 900, 24, 'integral')!
    const calc = fp.extracted_data.calculus as { a: number; b: number }
    expect(asset.type).toBe('calculus_card')
    expect(asset.data).toMatchObject({ mode: 'integral', a: calc.a, b: calc.b, version: 1 })
    const fit = (asset.data as unknown as { viewport: { fit?: { xMin: number; xMax: number } } }).viewport.fit
    if (fit) expect(fit.xMin <= calc.a && calc.b <= fit.xMax).toBe(true)
    expectProbes((asset.data as unknown as { expr: string }).expr, row.probes!)
    expect(matchesTaskCompanion(JSON.parse(JSON.stringify(asset)), resolved[0])).toBe(true)
    const other = { ...resolved[0], data: { ...fp.extracted_data, calculus: { ...calc, b: calc.b + 1 } } }
    expect(matchesTaskCompanion(asset, other)).toBe(false)
  })

  it.each(built.filter(r => r.fingerprint!.intents[0] === 'show_3d_solid'))('$id: тіло з умови в чинному 3D-об’єкті', row => {
    const d = row.fingerprint!.extracted_data
    const [resolved] = resolveCompanions(row.fingerprint!.intents, d, [])
    expect(resolved.rendererType).toBe('nmt3d')
    const data = taskSolidData(d) as { templateKey: string; params?: Record<string, number>; opts?: Record<string, boolean> }
    expect(data).not.toBeNull()
    const tpl = TEMPLATES[data.templateKey]
    expect(tpl, data.templateKey).toBeTruthy()
    const dims = d.solid_dims as Record<string, number> | undefined
    if (data.params) {
      const spec = SOLID_PARAMS[data.templateKey]
      const pairs = Object.entries(spec).map(([p, [key]]) => [data.params![p], dims![key]])
      // Один множник на всі розміри: пропорції умови збережено.
      for (const [v, w] of pairs) expect(v / w).toBeCloseTo(pairs[0][0] / pairs[0][1], 2)
    }
    const ws = new (window as unknown as { NMT3D: { Workspace: new (h: HTMLElement, k: string) => {
      params: Record<string, number>; opts: Record<string, boolean>; setParams(p: object): void
      setOpt(k: string, v: boolean): void; destroy(): void } } }).NMT3D.Workspace(host(), data.templateKey)
    if (data.params) {
      ws.setParams(data.params)
      // Рушій не обрізав жодного значення — пропорції дійшли до рисунка такими, як з умови.
      for (const [k, v] of Object.entries(data.params)) expect(ws.params[k], k).toBe(v)
    }
    for (const [k, v] of Object.entries(data.opts ?? {})) {
      expect(tpl.aux.map(a => a.key)).toContain(k)
      ws.setOpt(k, v)
    }
    ws.destroy()
  })

  it('межі параметрів і лінії збігаються з шаблонами рушія; ключі — ті, що відкриває 3D-об’єкт', () => {
    for (const key of NMT3D_TEMPLATE_KEYS) expect(TEMPLATES[key], key).toBeTruthy()
    // Старі ключі SVG-мініатюр рушій дошки не знає — через них «Побудувати» давало порожню картку.
    for (const key of ['sphere_in_cube', 'cube_in_sphere', 'truncCone']) expect(TEMPLATES[key]).toBeUndefined()
    for (const [tplKey, spec] of Object.entries(SOLID_PARAMS))
      for (const [p, [, min, max]] of Object.entries(spec))
        expect([TEMPLATES[tplKey].params[p].min, TEMPLATES[tplKey].params[p].max], `${tplKey}.${p}`).toEqual([min, max])
    for (const [tplKey, map] of Object.entries(SOLID_OPTS))
      for (const opt of Object.values(map)) expect(TEMPLATES[tplKey].aux.map(a => a.key), tplKey).toContain(opt)
  })

  it('дві задачі з різними тілами на сторінці: кожна будує своє, повтор знаходить своє', () => {
    const cube = resolveCompanions(['show_3d_solid'], { shape: 'cube', solid_marks: ['diagonal'] }, [])[0]
    const cuboid = resolveCompanions(['show_3d_solid'],
      { shape: 'cuboid', solid_dims: { length: 3, width: 4, height: 12 }, solid_marks: ['diagonal'] }, [])[0]
    const built = buildTaskCompanion(cuboid, 900, 60, 'cuboid')!
    expect(built.type).toBe('nmt3d')
    // 3D-об'єкт після відкриття дописує решту ліній і камеру — це все ще те саме тіло.
    const mounted = JSON.parse(JSON.stringify({ ...built, data: { ...built.data, cam: { yaw: 1, pitch: 0, scale: 90 },
      opts: { ...(built.data as unknown as { opts: object }).opts, sides: false } } }))
    expect(matchesTaskCompanion(mounted, cuboid)).toBe(true)
    expect(matchesTaskCompanion(mounted, cube)).toBe(false)
    const other = resolveCompanions(['show_3d_solid'],
      { shape: 'cuboid', solid_dims: { length: 3, width: 4, height: 5 }, solid_marks: [] }, [])[0]
    expect(matchesTaskCompanion(mounted, other)).toBe(false)
  })

  it('пошкоджені дані не перетворюються на рисунок навмання', () => {
    const base = { shape: 'cone' }
    for (const solid_dims of [{}, { radius: 3 }, { radius: -1, height: 4 }, { radius: '3', height: 4 }, [3, 4]])
      expect(taskSolidData({ ...base, solid_dims })).toBeNull()
    expect(taskSolidData({ ...base, solid_marks: 'slant' })).toBeNull()
    expect(taskSolidData({ shape: 'prism', base_shape: 'pentagon', solid_dims: { base_side: 2, height: 3 } })).toBeNull()
    // Пропорції поза межами шаблону — типовий вигляд, а не стиснення кожного розміру окремо.
    expect(taskSolidData({ ...base, solid_dims: { radius: 1, height: 400 } })).toEqual(
      { version: 1, templateKey: 'cone', mode: 'adapt' })
    for (const calculus of [{ mode: 'integral', a: 2, b: 2 }, { mode: 'integral', a: 3, b: 1 }, { mode: 'integral', a: 0 },
      { mode: 'integral', a: '0', b: 1 }])
      expect(resolveCompanions(['show_integral_area'], { equations: ['x^2'], calculus }, [])).toEqual([])
  })

  it('тіло й інтеграл: додати → undo → redo → JSON без зміни полотна', () => {
    setActivePinia(createPinia())
    const store = useWBStore()
    store.pages = [{ id: 'page', name: 'Сторінка 1', width: 1920, height: 1080, strokes: [], assets: [] }]
    store.currentPageIndex = 0
    const cone = taskSolidData({ shape: 'cone', solid_dims: { radius: 6, height: 8 }, solid_marks: ['height', 'slant'] })!
    store.addAsset({ id: 'cone', type: 'nmt3d', src: '', x: 60, y: 60, w: 680, h: 500, rotation: 0, locked: false,
      data: cone } as never, 'page')
    const [integral] = resolveCompanions(['show_integral_area'],
      { equations: ['x^2'], calculus: { mode: 'integral', a: 0, b: 2 } }, [])
    store.addAsset(buildTaskCompanion(integral, 900, 24, 'integral')!, 'page')
    expect(store.pages[0].assets).toHaveLength(2)
    store.undo(); store.undo(); expect(store.pages[0].assets).toHaveLength(0)
    store.redo(); store.redo(); expect(store.pages[0].assets).toHaveLength(2)
    store.pages = JSON.parse(JSON.stringify(store.pages))
    expect(store.pages[0].assets[0].data).toEqual(cone)
    expect(matchesTaskCompanion(store.pages[0].assets[1], integral)).toBe(true)
    expect([store.pages[0].width, store.pages[0].height]).toEqual([1920, 1080])
  })
})
