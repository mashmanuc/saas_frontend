import { describe, expect, it } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import samples from './derivative-bank-visuals.json'
import { GraphCalc } from '../../vendor/graph_calculator/graph-calculator.js'
import { resolveCompanions } from '../capabilityRegistry'
import { buildTaskCompanion, matchesTaskCompanion, taskCalculusInput } from '../taskCompanion'
import { useWBStore } from '../../board/state/boardStore'

describe('Похідна: графік і дотична з надрукованої умови', () => {
  it.each(samples.tasks)('$id: чинний рушій обчислює ту саму функцію', sample => {
    const fp = sample.fingerprint
    if (!fp) { expect(sample.id).toBe('nmt-sc-2895'); return }
    const resolved = resolveCompanions(fp.intents, fp.extracted_data, [])
    expect(resolved).toHaveLength(1)
    const c = GraphCalc.classify(`y=${fp.extracted_data.equations[0]}`, [])
    expect(c.kind).toBe('explicitY')
    for (const probe of sample.probes) {
      const actual = GraphCalc.evalAst(c.ast, { x: probe.x })
      if (probe.y === null) expect(Number.isFinite(actual)).toBe(false)
      // Похибка IEEE754 масштабується: e^32 ≈ 7,9·10^13 не порівнюємо
      // абсолютним допуском 10^-8, але вимагаємо 12 відносних розрядів.
      else expect(Math.abs(actual - probe.y)).toBeLessThanOrEqual(1e-8 + 1e-12 * Math.abs(probe.y))
    }
    const asset = buildTaskCompanion(resolved[0], 900, 24, 'derivative-native')!
    expect(asset).not.toBeNull()
    expect(matchesTaskCompanion(JSON.parse(JSON.stringify(asset)), resolved[0])).toBe(true)
    if (fp.extracted_data.calculus) {
      expect(asset.type).toBe('calculus_card')
      expect([asset.x, asset.y]).toEqual([900, 24])
      expect(asset.data).toMatchObject({ mode: 'derivative', x0: fp.extracted_data.calculus.x0, version: 1 })
    } else expect(asset.type).toBe('graph_calculator')
  })

  it.each(samples.domain_traps)('не скорочує ОДЗ: $source', sample => {
    const c = GraphCalc.classify(`y=${sample.source}`, [])
    expect(c.kind).toBe('explicitY')
    expect(Number.isFinite(GraphCalc.evalAst(c.ast, { x: sample.x }))).toBe(false)
  })

  it('calculus add → undo → redo → JSON-гідратація без зміни полотна', () => {
    const data = { equations: ['x^3'], calculus: { mode: 'derivative', x0: 2 } }
    const resolution = resolveCompanions(['show_tangent', 'show_graph'], data, [])
    expect(resolution).toHaveLength(1)
    const asset = buildTaskCompanion(resolution[0], 900, 24, 'tangent')!
    setActivePinia(createPinia())
    const store = useWBStore()
    store.pages = [{ id: 'page', name: 'Сторінка 1', width: 1920, height: 1080, strokes: [], assets: [] }]
    store.currentPageIndex = 0
    store.addAsset(asset, 'page')
    expect(store.pages[0].assets).toHaveLength(1)
    store.undo(); expect(store.pages[0].assets).toHaveLength(0)
    store.redo(); expect(store.pages[0].assets).toHaveLength(1)
    store.pages = JSON.parse(JSON.stringify(store.pages))
    expect(matchesTaskCompanion(store.pages[0].assets[0], resolution[0])).toBe(true)
    expect([store.pages[0].width, store.pages[0].height]).toEqual([1920, 1080])
    const other = { ...resolution[0], data: { ...data, calculus: { mode: 'derivative', x0: 3 } } }
    expect(matchesTaskCompanion(asset, other)).toBe(false)
  })

  it('не підставляє x₀=1 замість відсутньої/пошкодженої точки; старий контракт працює', () => {
    for (const calculus of [null, {}, { mode: 'derivative' }, { mode: 'derivative', x0: NaN },
      { mode: 'derivative', x0: '2' }, { mode: 'integral', x0: 2 }]) {
      const data = { equations: ['x^3'], calculus }
      expect(taskCalculusInput(data)).toBeNull()
      expect(resolveCompanions(['show_tangent'], data, [])).toEqual([])
      expect(buildTaskCompanion({ rendererType: 'calculus_card', intent: 'show_tangent', data }, 0, 0, 'bad')).toBeNull()
    }
    expect(resolveCompanions(['show_tangent'], { equations: ['x^2'] }, [])).toHaveLength(1)
  })
})
