/**
 * «Інтегралик розуміє виділене» (власник 2026-10-07: «роби виділене без зайвих токенів»).
 * Виділений учителем об'єкт поточної сторінки — «ця картка»: позначка `selected` і повний текст
 * (`full_text`) замість обрізаних 400 символів. Виділення нічого не запускає — лише позначає об'єкт
 * у описі дошки, який іде разом із питанням. Збираємо з ЖИВОГО стора, як і кожен запит до моделі.
 */
import { beforeEach, describe, expect, it } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { useWBStore } from '@/modules/winterboard/board/state/boardStore'
import { SELECTED_TEXT_MAX, buildBoardSummary, selectedAssetId } from '../boardActions'

const LONG = 'Річ Посполита — союзна держава. '.repeat(40)   // ~1280 символів, довше за звичайні 400
const card = (id: string, title: string, body: string) =>
  ({ id, type: 'theory_card', x: 0, y: 0, w: 600, h: 300, data: { title, body } })

function board(selectedIds: string[] = [], expandedAssetId: string | null = null) {
  const store = useWBStore()
  store.pages = [
    { id: 'p1', name: 'p1', strokes: [], assets: [card('old', 'Стара картка', LONG), card('new', 'Нова картка', 'Коротко.')] },
    { id: 'p2', name: 'p2', strokes: [], assets: [card('far', 'Інша сторінка', 'Текст.')] },
  ] as any
  store.currentPageIndex = 0
  store.selectedIds = selectedIds
  store.expandedAssetId = expandedAssetId
  return store
}

beforeEach(() => setActivePinia(createPinia()))

describe('виділене — «ця картка» для Інтегралика', () => {
  it('один виділений об\'єкт на поточній сторінці: позначка й повний текст, а не 400 символів', async () => {
    board(['old'])
    const { items } = await buildBoardSummary()
    const old = items.find((i: any) => i.id === 'old')
    expect(old.selected).toBe(true)
    expect(old.full_text.length).toBeGreaterThan(400)
    expect(old.full_text.startsWith('Стара картка. Річ Посполита')).toBe(true)
    expect(old.text.length).toBe(400)                       // звичайне поле — як і було
    expect(items.filter((i: any) => i.selected)).toHaveLength(1)
  })

  it('повний текст має стелю — опис дошки не роздувається', async () => {
    const store = board(['old'])
    ;(store.pages[0] as any).assets[0].data.body = 'а'.repeat(5000)
    const { items } = await buildBoardSummary()
    expect(items.find((i: any) => i.id === 'old').full_text.length).toBe(SELECTED_TEXT_MAX)
  })

  it('без виділення, кілька виділених чи виділене на іншій сторінці — позначки немає, як і було', async () => {
    for (const ids of [[], ['old', 'new'], ['far']]) {
      setActivePinia(createPinia())
      board(ids)
      const { items } = await buildBoardSummary()
      expect(items.some((i: any) => i.selected || i.full_text), String(ids)).toBe(false)
    }
  })

  it('задача на екрані («Задача на екран») — теж «ця», коли нічого не виділено', async () => {
    expect(selectedAssetId(board([], 'new'))).toBe('new')
    expect(selectedAssetId(board(['old'], 'new'))).toBe('old')    // виділення важливіше
    expect(selectedAssetId(board([], 'far'))).toBeNull()          // не на поточній сторінці
  })
})
