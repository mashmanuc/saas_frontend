// INV-EXPAND-SELECTED — розгорнутий об'єкт завжди виділений, поки він на
// поточній сторінці (виділення = єдиний тригер реєстрації sidebar-інспектора).
//
// Живий випадок власника: розгорнув графічний калькулятор на сторінці 12,
// пішов на іншу сторінку, повернувся — об'єкт знову розгорнутий, а інспектора
// праворуч немає, і покликати його нічим (кліки в розгорнутому оверлеї
// select-guard пропускає свідомо).

import { describe, it, expect, vi } from 'vitest'
import { reactive, nextTick, effectScope } from 'vue'
import { useExpandedAssetSelection } from '../useExpandedAssetSelection'
import type { ExpandedSelectionStore } from '../useExpandedAssetSelection'

function makeStore(over: Partial<ExpandedSelectionStore> = {}) {
  const store = reactive<ExpandedSelectionStore>({
    expandedAssetId: null,
    selectedIds: [],
    currentPageIndex: 0,
    pages: [
      { assets: [{ id: 'gc-1' }, { id: 'img-1' }] },
      { assets: [{ id: 'nmt-2' }] },
      { assets: [] },
    ],
    selectItems(ids: string[]) { store.selectedIds = [...ids] },
    ...over,
  }) as ExpandedSelectionStore
  return store
}

/** Запускає інваріант у власному scope — щоб тест міг його зупинити. */
function run(store: ExpandedSelectionStore) {
  const scope = effectScope()
  scope.run(() => useExpandedAssetSelection(store))
  return () => scope.stop()
}

describe('INV-EXPAND-SELECTED', () => {
  it('розгортання об’єкта на поточній сторінці виділяє його', async () => {
    const store = makeStore()
    const stop = run(store)
    store.expandedAssetId = 'gc-1'
    await nextTick()
    expect(store.selectedIds).toEqual(['gc-1'])
    stop()
  })

  it('повернення на сторінку розгорнутого об’єкта повертає виділення', async () => {
    // Точний сценарій власника: expand → інша сторінка (watcher сторінки у
    // WBCanvas робить clearSelection проти привида Konva-трансформера) → назад.
    const store = makeStore()
    const stop = run(store)
    store.expandedAssetId = 'gc-1'
    await nextTick()

    store.currentPageIndex = 1
    store.selectedIds = []          // ← clearSelection() при зміні сторінки
    await nextTick()
    expect(store.selectedIds).toEqual([])   // на чужій сторінці не виділяємо

    store.currentPageIndex = 0
    await nextTick()
    expect(store.selectedIds).toEqual(['gc-1'])
    stop()
  })

  it('на сторінці БЕЗ розгорнутого об’єкта виділення не воскресає (без фантома)', async () => {
    // Раніше watcher читав props.assets компонента, які під час fade (~180ms)
    // ще від старої сторінки → повертав виділення об'єкта, якого на новій
    // сторінці немає. Джерело правди — стор, тому фантома більше нема.
    const store = makeStore()
    const stop = run(store)
    store.expandedAssetId = 'gc-1'
    await nextTick()

    store.currentPageIndex = 2      // порожня сторінка
    store.selectedIds = []
    await nextTick()
    expect(store.selectedIds).toEqual([])
    stop()
  })

  it('нічого не розгорнуто → інваріант мовчить', async () => {
    const store = makeStore()
    const spy = vi.spyOn(store, 'selectItems')
    const stop = run(store)
    store.selectedIds = []
    await nextTick()
    store.currentPageIndex = 1
    await nextTick()
    expect(spy).not.toHaveBeenCalled()
    stop()
  })

  it('розгорнутий у групі виділених — не звужує виділення', async () => {
    const store = makeStore()
    const stop = run(store)
    store.expandedAssetId = 'gc-1'
    await nextTick()
    store.selectedIds = ['gc-1', 'img-1']
    await nextTick()
    expect(store.selectedIds).toEqual(['gc-1', 'img-1'])
    stop()
  })

  it('згортання (expandedAssetId → null) не чіпає виділення', async () => {
    const store = makeStore()
    const stop = run(store)
    store.expandedAssetId = 'gc-1'
    await nextTick()
    store.expandedAssetId = null
    await nextTick()
    // Об'єкт лишається виділеним — саме так тулбар повертається після ⛶.
    expect(store.selectedIds).toEqual(['gc-1'])
    stop()
  })

  it('виділення іншого об’єкта поки розгорнуто → інваріант повертає розгорнутий', async () => {
    // У розгорнутому стані оверлей покриває полотно, тож інший об'єкт можна
    // виділити хіба що збоку. Правило власника однозначне: «розгорнуто →
    // праворуч інспекція» саме цього об'єкта.
    const store = makeStore()
    const stop = run(store)
    store.expandedAssetId = 'gc-1'
    await nextTick()
    store.selectedIds = ['img-1']
    await nextTick()
    expect(store.selectedIds).toEqual(['gc-1'])
    stop()
  })
})
