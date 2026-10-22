import { describe, expect, it } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import samples from './fixtures/powers-roots-visuals.json'
import { GraphCalc } from '../../vendor/graph_calculator/graph-calculator.js'
import { resolveCompanions } from '../capabilityRegistry'
import { buildTaskCompanion, matchesTaskCompanion } from '../taskCompanion'
import { useWBStore } from '../../board/state/boardStore'

describe('Степеневі функції: чинний живий графік з умови', () => {
  it.each(samples)('$id: граматика, ОДЗ й точні контрольні значення', sample => {
    const fp = sample.fingerprint
    const resolutions = resolveCompanions(fp.intents, fp.extracted_data, [])
    expect(resolutions).toHaveLength(1)
    const asset = buildTaskCompanion(resolutions[0], 1000, 24, 'graph')!
    expect(asset.type).toBe('graph_calculator')
    expect(matchesTaskCompanion(JSON.parse(JSON.stringify(asset)), resolutions[0])).toBe(true)
    const data = fp.extracted_data as { equations?: string[]; graph_points?: { x: number; y: number }[] }
    if (sample.family === 'pf_coefficient') {
      expect(data.equations).toBeUndefined()
      expect(data.graph_points).toHaveLength(1)
    } else {
      const classified = GraphCalc.classify(data.equations![0], [])
      expect(classified.kind).toBe('explicitY')
      for (const point of sample.checks) {
        const actual = GraphCalc.evalAst(classified.ast, { x: point.x })
        if (point.y === null) expect(Number.isFinite(actual)).toBe(false)
        else expect(actual).toBeCloseTo(point.y, 9)
      }
    }
    setActivePinia(createPinia())
    const store = useWBStore()
    store.pages = [{ id: 'page', name: 'Сторінка 1', width: 1920, height: 1080, strokes: [], assets: [] }]
    store.currentPageIndex = 0
    store.addAsset(asset, 'page')
    expect(store.pages[0].assets).toHaveLength(1)
    store.undo(); expect(store.pages[0].assets).toHaveLength(0)
    store.redo(); expect(store.pages[0].assets).toHaveLength(1)
    store.pages = JSON.parse(JSON.stringify(store.pages))
    expect(matchesTaskCompanion(store.pages[0].assets[0], resolutions[0])).toBe(true)
    expect([store.pages[0].width, store.pages[0].height]).toEqual([1920, 1080])
  })
})
