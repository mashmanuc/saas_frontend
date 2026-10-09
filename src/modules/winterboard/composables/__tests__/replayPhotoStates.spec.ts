/**
 * «Дзеркало уроку» — добір фото-станів сторінок із завершеного запису (ТЗ
 * TZ_LESSON_MIRROR_VIDEO_PILOT_2026-10-09 §3: джерело — start_state + ops у межах
 * start_seq…end_seq у порядку seq; фото після end_seq не належать запису).
 *
 * Сторінку визначає той самий applier, що й плеєр, тому окремий випадок — ops, записані з іншим
 * id сторінки, ніж у start_state (позиційна мапа applier-а).
 */
import { describe, it, expect } from 'vitest'
import { collectMirrorPhotoPages, type MirrorPhotoSource } from '../replayPhotoStates'
import type { BoardOperation } from '../../types/replay'

const img = (n: number | string) => `https://cdn.test/mirror/${n}.jpg`

function op(seq: number, op_type: string, page_id: string, payload: Record<string, unknown> = {}): BoardOperation {
  return { id: seq, seq, op_type, page_id, payload, user: 1, created_at: new Date(1_700_000_000_000 + seq * 1000).toISOString() }
}
const photo = (seq: number, page: string, n: number | string) =>
  op(seq, 'background_update', page, { background: { type: 'image', url: img(n), prev: 'white' } })

function page(id: string, background: unknown = 'white') {
  return { id, name: id, strokes: [], assets: [], background }
}

function source(over: Partial<MirrorPhotoSource>): MirrorPhotoSource {
  return { start_state: null, operations: [], start_seq: 10, end_seq: 100, ...over }
}

describe('collectMirrorPhotoPages', () => {
  it('початковий фото-фон зі start_state — перший стан сторінки з seq = start_seq − 1', () => {
    const pages = collectMirrorPhotoPages(source({
      start_state: { pages: [page('p1', { type: 'image', url: img('start') })], currentPageIndex: 0 },
      operations: [photo(12, 'p1', 1)],
    }))
    expect(pages).toEqual([{ pageId: 'p1', label: '1', states: [{ seq: 9, url: img('start') }, { seq: 12, url: img(1) }] }])
  })

  it('межі запису: фото до start_seq і після end_seq не беруться', () => {
    const pages = collectMirrorPhotoPages(source({
      start_state: { pages: [page('p1')], currentPageIndex: 0 },
      operations: [photo(5, 'p1', 'before'), photo(10, 'p1', 1), photo(100, 'p1', 2), photo(101, 'p1', 'after')],
    }))
    expect(pages).toHaveLength(1)
    expect(pages[0].states).toEqual([{ seq: 10, url: img(1) }, { seq: 100, url: img(2) }])
  })

  it('кілька сторінок — окремі групи, підпис = номер сторінки', () => {
    const pages = collectMirrorPhotoPages(source({
      start_state: { pages: [page('p1'), page('p2')], currentPageIndex: 0 },
      operations: [photo(11, 'p2', 'a'), photo(12, 'p1', 'x'), photo(13, 'p2', 'b'), photo(14, 'p1', 'y')],
    }))
    expect(pages.map(p => [p.pageId, p.label, p.states.map(s => s.seq)])).toEqual([
      ['p1', '1', [12, 14]],
      ['p2', '2', [11, 13]],
    ])
  })

  it('колір чи візерунок замість фото — не стан (і не розриває злиття однакових фото)', () => {
    const pages = collectMirrorPhotoPages(source({
      start_state: { pages: [page('p1')], currentPageIndex: 0 },
      operations: [
        photo(11, 'p1', 1),
        op(12, 'background_update', 'p1', { color: '#ffeedd' }),
        op(13, 'background_update', 'p1', { background: 'grid' }),
        photo(14, 'p1', 2),
      ],
    }))
    expect(pages[0].states).toEqual([{ seq: 11, url: img(1) }, { seq: 14, url: img(2) }])
  })

  it('сусідні стани з тим самим фото зливаються в один', () => {
    const pages = collectMirrorPhotoPages(source({
      start_state: { pages: [page('p1', { type: 'image', url: img(1) })], currentPageIndex: 0 },
      operations: [photo(11, 'p1', 1), photo(12, 'p1', 2), photo(13, 'p1', 2), photo(14, 'p1', 1)],
    }))
    expect(pages[0].states).toEqual([
      { seq: 9, url: img(1) }, { seq: 12, url: img(2) }, { seq: 14, url: img(1) },
    ])
  })

  it('сторінка з < 2 станами відкидається (і злиті дублікати рахуються як один)', () => {
    const pages = collectMirrorPhotoPages(source({
      start_state: { pages: [page('p1'), page('p2'), page('p3')], currentPageIndex: 0 },
      operations: [photo(11, 'p1', 1), photo(12, 'p2', 7), photo(13, 'p2', 7), photo(14, 'p3', 'a'), photo(15, 'p3', 'b')],
    }))
    expect(pages.map(p => p.pageId)).toEqual(['p3'])
  })

  it('порядок станів — за seq, навіть якщо ops прийшли не впорядковано', () => {
    const ops = [photo(30, 'p1', 3), photo(11, 'p1', 1), photo(20, 'p1', 2)]
    const pages = collectMirrorPhotoPages(source({
      start_state: { pages: [page('p1')], currentPageIndex: 0 },
      operations: ops,
    }))
    expect(pages[0].states.map(s => s.seq)).toEqual([11, 20, 30])
    // вхід не переставлено
    expect(ops.map(o => o.seq)).toEqual([30, 11, 20])
  })

  it('мапа id сторінок плеєра: ops з іншим id сторінки лягають на сторінку start_state', () => {
    // Запис має сторінку «p1» у start_state, а ops писались з id «page-175» (сторінку перестворено).
    const pages = collectMirrorPhotoPages(source({
      start_state: { pages: [page('p1', { type: 'image', url: img('start') })], currentPageIndex: 0 },
      operations: [photo(11, 'page-175', 1)],
    }))
    expect(pages).toEqual([{ pageId: 'p1', label: '1', states: [{ seq: 9, url: img('start') }, { seq: 11, url: img(1) }] }])
  })

  it('сторінка, додана під час запису, отримує свій номер', () => {
    const pages = collectMirrorPhotoPages(source({
      start_state: { pages: [page('p1')], currentPageIndex: 0 },
      operations: [
        op(11, 'page_add', 'p-new', { page: { id: 'p-new', name: '2' } }),
        photo(12, 'p-new', 1),
        photo(13, 'p-new', 2),
      ],
    }))
    expect(pages).toEqual([{ pageId: 'p-new', label: '2', states: [{ seq: 12, url: img(1) }, { seq: 13, url: img(2) }] }])
  })

  it('без меж запису (не завершений) — нічого не добираємо', () => {
    const ops = [photo(11, 'p1', 1), photo(12, 'p1', 2)]
    const start_state = { pages: [page('p1')], currentPageIndex: 0 }
    expect(collectMirrorPhotoPages(source({ start_state, operations: ops, end_seq: undefined }))).toEqual([])
    expect(collectMirrorPhotoPages(source({ start_state, operations: ops, start_seq: undefined }))).toEqual([])
  })
})
