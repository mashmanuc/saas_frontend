/**
 * «Інтегралик знає сцену» (власник 2026-10-06): матеріал сторінки уроку доходить до моделі окремими
 * полями — щоб на «дай підказку до цього питання» чи «поясни простіше» вона відповідала з нього,
 * з цитатою, а не загально чи «з пам'яті».
 *
 * Збираємо з ЖИВОГО стора (той самий `buildBoardSummary`, що йде в кожен запит до моделі).
 */
import { beforeEach, describe, expect, it } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { useWBStore } from '@/modules/winterboard/board/state/boardStore'
import { buildBoardSummary, sceneExtras, summarizeAsset } from '../boardActions'

const SOURCE = {
  provider: 'wikipedia', title: 'Вікіпедія: «Люблінська унія»', url: 'https://uk.wikipedia.org/wiki/Люблінська_унія',
  evidence: "угода про об'єднання Королівства Польського та Великого князівства Литовського в союз держав — Річ Посполиту",
}
const scene = () => [
  { id: 'pic', type: 'image', x: 0, y: 0, w: 840, h: 560,
    data: { caption: 'Річ Посполита в кордонах 1619 року; пунктир — сучасні кордони' } },
  { id: 'theory', type: 'theory_card', x: 960, y: 0, w: 880, h: 300,
    data: { title: 'Держава, якої вже немає', body: 'Вона виникла 1569 року з союзу Польщі й Литви.', sources: [SOURCE, SOURCE] } },
  { id: 'q', type: 'discussion_question', x: 0, y: 780, w: 1760, h: 90,
    data: { question: 'Як називалась угода про об\'єднання?', answer: 'Люблінська унія 1569 року',
            support: SOURCE.evidence, showAnswer: false } },
  { id: 'vkl', type: 'history_card', x: 0, y: 0, w: 520, h: 380,
    data: { variant: 'polity', title: 'Велике князівство Литовське', lead: 'Держава у Східній Європі.',
            primary: [{ label: 'Роки існування', values: [{ label: '1236 — 1795' }] },
                      { label: 'Столиця', values: [{ label: 'Вільнюс' }] }],
            sources: [{ title: 'Вікідані: Велике князівство Литовське', evidence: '' }] } },
] as any[]

beforeEach(() => setActivePinia(createPinia()))

describe('матеріал сцени — у стані дошки для Інтегралика', () => {
  it('питання: відповідь і опора окремими полями (не в label — за ним модель адресує)', async () => {
    const store = useWBStore()
    store.pages = [{ id: 'p1', name: 'p1', strokes: [], assets: scene() }] as any
    store.currentPageIndex = 0
    const { items } = await buildBoardSummary()
    const q = items.find((i: any) => i.id === 'q')
    expect(q).toMatchObject({ kind: 'питання', label: "Як називалась угода про об'єднання?",
      answer: 'Люблінська унія 1569 року', quote: SOURCE.evidence })
  })

  it('картка теорії: текст, дослівна цитата-опора (без дублів) і назва джерела', async () => {
    const store = useWBStore()
    store.pages = [{ id: 'p1', name: 'p1', strokes: [], assets: scene() }] as any
    store.currentPageIndex = 0
    const t = (await buildBoardSummary()).items.find((i: any) => i.id === 'theory')
    expect(t).toMatchObject({ text: 'Вона виникла 1569 року з союзу Польщі й Литви.', quote: SOURCE.evidence,
      sources: 'Вікіпедія: «Люблінська унія»' })
  })

  it('довідка: назва в label, «хто це» і факти — у тексті', async () => {
    const store = useWBStore()
    store.pages = [{ id: 'p1', name: 'p1', strokes: [], assets: scene() }] as any
    store.currentPageIndex = 0
    const h = (await buildBoardSummary()).items.find((i: any) => i.id === 'vkl')
    expect(h).toMatchObject({ kind: 'довідка', label: 'Велике князівство Литовське',
      text: 'Держава у Східній Європі. Роки існування: 1236 — 1795; Столиця: Вільнюс',
      sources: 'Вікідані: Велике князівство Литовське' })
    expect(h).not.toHaveProperty('quote')            // порожня цитата не стає полем
  })

  it('інші об\'єкти нових полів не отримують; порожні дані нічого не ламають', () => {
    expect(sceneExtras({ type: 'graph_calculator', data: { sources: [SOURCE] } })).toEqual({})
    expect(sceneExtras({ type: 'discussion_question', data: {} })).toEqual({})
    expect(sceneExtras({ type: 'theory_card' })).toEqual({})
    expect(summarizeAsset({ id: 'x', type: 'history_card', data: {} }).label).toBe('')
  })

  it('довгі поля ріжуться до меж, які пропускає сервер', () => {
    const long = 'с'.repeat(500)
    const out = sceneExtras({ type: 'discussion_question', data: { answer: long, support: long } })
    expect([out.answer.length, out.quote.length]).toEqual([240, 240])
  })
})
