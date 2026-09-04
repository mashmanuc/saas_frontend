// Правило збереження сторінок document_viewer.
//
// `pages[]` не персистяться — для хмарного документа це важкий дубль, сторінки
// довантажуються на вимогу за `content_ref`. Але якщо `content_ref` нема,
// повертати сторінки нізвідки, і вирізання нищить об'єкт назавжди. Такий
// випадок реальний: демо-дошка `/workspace` живе без API і тримає адреси
// статичних файлів прямо в об'єкті.
//
// Звідси правило: ВИРІЗАТИ ЛИШЕ ТЕ, ЩО МОЖНА ПОВЕРНУТИ.

import { describe, it, expect, beforeEach } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { useWBStore } from '../boardStore'
import type { WBAsset, WBPage, WBSession } from '../../../types/winterboard'

function viewer(id: string, withContentRef: boolean): WBAsset {
  return {
    id,
    type: 'document_viewer',
    src: '/demo/sheet-uk-1.svg',
    x: 0, y: 0, w: 400, h: 560,
    rotation: 0,
    locked: false,
    currentPage: 0,
    totalPages: 2,
    pages: [
      { index: 0, url: '/demo/sheet-uk-1.svg' },
      { index: 1, url: '/demo/sheet-uk-2.svg' },
    ],
    viewerMode: 'compact',
    ...(withContentRef ? { content_ref: { content_id: 42, content_type: 'pdf' } } : {}),
  } as unknown as WBAsset
}

function session(assets: WBAsset[]): WBSession {
  const page = { id: 'p1', name: 'P', background: 'white', strokes: [], assets } as unknown as WBPage
  return {
    id: 's1', name: 'S', owner_id: '',
    state: { pages: [page], currentPageIndex: 0 },
    page_count: 1, thumbnail_url: null, rev: 0,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  } as unknown as WBSession
}

function firstAsset(store: ReturnType<typeof useWBStore>): WBAsset {
  return store.pages[0].assets[0]
}

describe('document_viewer.pages — вирізати лише те, що можна повернути', () => {
  beforeEach(() => setActivePinia(createPinia()))

  describe('hydrateFromSession', () => {
    it('хмарний документ (є content_ref): сторінки вирізає — їх довантажать за посиланням', () => {
      const store = useWBStore()
      store.hydrateFromSession(session([viewer('cloud', true)]))
      expect(firstAsset(store).pages).toBeUndefined()
    })

    it('локальний аркуш (нема content_ref): сторінки лишає — інакше вони зникнуть назавжди', () => {
      const store = useWBStore()
      store.hydrateFromSession(session([viewer('local', false)]))
      expect(firstAsset(store).pages?.map((p) => p.url)).toEqual([
        '/demo/sheet-uk-1.svg', '/demo/sheet-uk-2.svg',
      ])
    })
  })

  describe('serializedStateForSave (те, що йде на бекенд)', () => {
    it('хмарний документ: сторінки не шле', () => {
      const store = useWBStore()
      store.pages = [{ id: 'p1', name: 'P', background: 'white', strokes: [],
                       assets: [viewer('cloud', true)] } as unknown as WBPage]
      expect(store.serializedStateForSave.pages[0].assets[0].pages).toBeUndefined()
    })

    it('локальний аркуш: сторінки зберігає', () => {
      const store = useWBStore()
      store.pages = [{ id: 'p1', name: 'P', background: 'white', strokes: [],
                       assets: [viewer('local', false)] } as unknown as WBPage]
      expect(store.serializedStateForSave.pages[0].assets[0].pages).toHaveLength(2)
    })

    it('data:-картинки й далі чистяться (правило не зачепило сусіднє)', () => {
      const store = useWBStore()
      const img = { id: 'i1', type: 'image', src: 'data:image/png;base64,AAAA',
                    x: 0, y: 0, w: 10, h: 10 } as unknown as WBAsset
      store.pages = [{ id: 'p1', name: 'P', background: 'white', strokes: [],
                       assets: [img] } as unknown as WBPage]
      const saved = store.serializedStateForSave.pages[0].assets[0]
      expect(saved.src).toBe('')
      expect((saved as { _localOnly?: boolean })._localOnly).toBe(true)
    })
  })

  describe('updateDocViewerPage — межа гортання', () => {
    it('затискає сторінку по totalPages (без нього аркуш стоїть на першій)', () => {
      const store = useWBStore()
      store.hydrateFromSession(session([viewer('local', false)]))
      store.updateDocViewerPage('local', 1)
      expect(firstAsset(store).currentPage).toBe(1)
      store.updateDocViewerPage('local', 99)
      expect(firstAsset(store).currentPage).toBe(1)
    })
  })
})
