/**
 * Рев'ю C0–C4 (Codex, 2026-09-17): мова вже створених матеріалів доходить до сервера.
 *
 * Резолвер мови матеріалу (ТЗ §3.7 п. 4) бере мову дошки з `board_summary.items[].lang`.
 * Джерело — дані самого об'єкта (LAW §9.D): картка в `asset.data`, текст у `stroke.data`.
 * Об'єкти без коридору ключів не отримують — summary для всіх інших як був.
 */
import { describe, it, expect, beforeEach } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { useWBStore } from '@/modules/winterboard/board/state/boardStore'
import { buildBoardSummary } from '../boardActions'

function page(id: string, strokes: any[], assets: any[]) {
  return { id, name: id, strokes, shapes: [], texts: [], assets } as any
}

describe('board_summary несе мову матеріалу', () => {
  beforeEach(() => { setActivePinia(createPinia()) })

  it('картка й текст із коридором — lang і lang_source; без коридору — нічого', async () => {
    const store = useWBStore()
    store.pages = [page('p1', [
      { id: 's1', tool: 'text', text: 'Causes', points: [], color: '#000', size: 22, opacity: 1,
        data: { content_language: 'en', provenance: { content_language_source: 'lesson' } } },
      { id: 's2', tool: 'text', text: 'Звичайний текст', points: [], color: '#000', size: 22, opacity: 1 },
    ], [
      { id: 'c1', type: 'theory_card', x: 0, y: 0, w: 10, h: 10,
        data: { version: 1, title: 'Hetmanate', body: 'B', content_language: 'en',
                provenance: { content_language_source: 'explicit_command' } } },
      { id: 'c2', type: 'theory_card', x: 0, y: 0, w: 10, h: 10, data: { version: 1, title: 'Стара', body: 'B' } },
    ])] as any
    store.currentPageIndex = 0
    const summary = await buildBoardSummary()
    const byLabel = Object.fromEntries(summary.items.map((i: any) => [i.label, i]))
    expect(byLabel['Causes']).toMatchObject({ lang: 'en', lang_source: 'lesson' })
    expect(byLabel['Hetmanate']).toMatchObject({ lang: 'en', lang_source: 'explicit_command' })
    expect(byLabel['Звичайний текст']).not.toHaveProperty('lang')
    expect(byLabel['Стара']).not.toHaveProperty('lang')
  })
})
