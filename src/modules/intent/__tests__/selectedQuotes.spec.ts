/**
 * Усі цитати-джерела виділеної картки (власник 2026-10-07: «цитати-джерела теж»). Живий випадок з проду:
 * «розкажи тут детальніше» — деталі лежали в 3-й і 4-й цитатах, моделі йшли лише дві перші.
 */
import { beforeEach, describe, expect, it } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { useWBStore } from '@/modules/winterboard/board/state/boardStore'
import { buildBoardSummary } from '../boardActions'

const Q = ['спільний монарх', 'універсал березня 1569 року', 'зокрема Чернігово-Сіверщину і Смоленськ', 'на межі катастрофи']
const CARD = {
  id: 'c', type: 'theory_card', x: 0, y: 0, w: 600, h: 300,
  data: { title: 'Чому Литві знадобився союзник', body: 'Литва втратила майже третину земель.',
          sources: Q.map((evidence, i) => ({ provider: 'wikipedia', title: `Джерело ${i + 1}`, evidence })) },
}

function board(selectedIds: string[]) {
  const store = useWBStore()
  store.pages = [{ id: 'p1', name: 'p1', strokes: [], assets: [CARD] }] as any
  store.currentPageIndex = 0
  store.selectedIds = selectedIds
  store.expandedAssetId = null
}

beforeEach(() => setActivePinia(createPinia()))

describe('усі цитати-джерела виділеної картки', () => {
  it('виділена — усі чотири, звичайне поле — як і було (дві перші)', async () => {
    board(['c'])
    const c = (await buildBoardSummary()).items.find((i: any) => i.id === 'c')
    expect(c.all_quotes).toBe(Q.join(' … '))
    expect(c.quote).toBe(Q.slice(0, 2).join(' … '))
  })

  it('невиділена — без усіх цитат', async () => {
    board([])
    const c = (await buildBoardSummary()).items.find((i: any) => i.id === 'c')
    expect(c.all_quotes).toBeUndefined()
  })
})
