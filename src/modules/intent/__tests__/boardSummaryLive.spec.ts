/**
 * Гейт G-2, живий прогін власника 2026-08-15.
 *
 * Тьютор посунув повзунок і спитав «а тепер?» — Інтегралик відповів
 * «нічого не змінювалося» і повторив своє ж старе число. Питання, яке це
 * поставило: чи доїжджає РУХ повзунка до контексту, чи READ бачить лише
 * стан на момент створення графіка?
 *
 * Ланцюжок прочитано по коду (слайдер → emit('param-set') →
 * `wbStore.graphParamSet` → мутація `asset.data.state.params[name].value`),
 * але «прочитано» ≠ «перевірено»: між сторами й `buildBoardSummary()` не
 * було жодного тесту. Тут він є — на майбутнє, бо цей розрив не падає, а
 * мовчить, і відрізнити «модель збрехала» від «дані не доїхали» на живому
 * прогоні неможливо.
 */
import { describe, it, expect, beforeEach } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { useWBStore } from '@/modules/winterboard/board/state/boardStore'
import { buildBoardSummary } from '../boardActions'

function graphAsset(id = 'g1') {
  return {
    id, type: 'graph_calculator', x: 0, y: 0, w: 400, h: 300,
    data: {
      version: 1,
      state: {
        expressions: [{ id: 'e1', src: 'a*x^2 + b' }],
        params: { a: { value: 1, min: -10, max: 10, step: 0.1 },
                  b: { value: 0, min: -10, max: 10, step: 0.1 } },
        viewport: { cx: 0, cy: 0, scale: 38 },
      },
    },
  } as any
}

function page(id: string, assets: any[]) {
  return { id, name: id, strokes: [], shapes: [], texts: [], assets } as any
}

describe('READ бачить дошку ЗАРАЗ, а не на момент створення', () => {
  beforeEach(() => setActivePinia(createPinia()))

  it('посунутий повзунок доїжджає у board_summary', async () => {
    const store = useWBStore()
    store.pages = [page('p1', [graphAsset()])]
    store.currentPageIndex = 0
    ;(store as any).mode = 'edit'

    const before = await buildBoardSummary()
    expect(before.items.find((i: any) => i.id === 'g1').params.params.a).toBe(1)

    store.graphParamSet('g1', 'a', 1.5)     // рівно те, що робить слайдер

    const after = await buildBoardSummary()
    expect(after.items.find((i: any) => i.id === 'g1').params.params.a,
           'READ показує значення на момент створення, а не поточне').toBe(1.5)
  })

  it('currentPage відповідає сторінці, яку бачить тьютор', async () => {
    const store = useWBStore()
    store.pages = [page('p1', [graphAsset('g1')]), page('p2', [graphAsset('g2')])]
    store.currentPageIndex = 1
    ;(store as any).mode = 'edit'

    // Без цього числа BE не знає, чиї параметри показувати першими, і
    // відповідь про «цю сторінку» стосується чужої.
    expect((await buildBoardSummary()).currentPage).toBe(2)
  })
})
