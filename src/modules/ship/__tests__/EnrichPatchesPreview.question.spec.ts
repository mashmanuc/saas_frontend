/**
 * ✨ × ПИТАННЯ до асистента (2026-08-16, живий випадок власника).
 *
 * У поле «Збагатити урок» ввели «що ти вмієш?» → 3 списання і 4 випадкові
 * картки замість відповіді. Тепер BE впізнає питання до асистента й
 * зупиняється ДО пакетів (kind:'question', patches порожні). FE показує
 * підтвердження — питає, а не вгадує:
 *   «Спитати Інтегралика» → CustomEvent m4sh:integralyk-ask (палітра слухає)
 *                            + модалка закривається;
 *   «Ні, збагатити як є»  → повторний enrich із forceFreeform=true
 *                            (BE не класифікує вдруге — не платимо двічі).
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { createI18n } from 'vue-i18n'
import { createPinia, setActivePinia } from 'pinia'

const enrich = vi.fn()
const enrichApply = vi.fn()
const enrichProgress = vi.fn()

vi.mock('../shipApi', () => ({
  shipApi: {
    enrich: (...args: unknown[]) => enrich(...args),
    enrichApply: (...args: unknown[]) => enrichApply(...args),
    enrichProgress: (...args: unknown[]) => enrichProgress(...args),
  },
}))
vi.mock('@/modules/winterboard/stores/opsSyncStore', () => ({
  useOpsSyncStore: () => ({ catchUp: vi.fn().mockResolvedValue({ status: 'applied', lastSeq: 1 }) }),
}))
vi.mock('@/modules/winterboard/board/state/boardStore', () => ({
  useWBStore: () => ({ applyCatchUpState: vi.fn() }),
}))

import EnrichPatchesPreview from '../EnrichPatchesPreview.vue'
import uk from '@/i18n/locales/uk.json'

const i18n = createI18n({ legacy: false, locale: 'uk', messages: { uk } })

function mountPreview() {
  return mount(EnrichPatchesPreview, {
    props: { artifactId: 'a1', visible: true },
    global: { plugins: [i18n] },
  })
}

const QUESTION_RESP = {
  patches: [], error: null, kind: 'question',
  processed_tasks: 0, total_tasks: 14, failed_task_refs: [], skipped: [],
}
const EMPTY_RUN = {
  patches: [], error: null,
  processed_tasks: 14, total_tasks: 14, failed_task_refs: [], skipped: [],
}

const CARD = '.enrich-patches-preview__question'
const ASK = `${CARD} .enrich-patches-preview__run`
const FORCE = `${CARD} .enrich-patches-preview__chip`

async function typeAndRun(wrapper: ReturnType<typeof mountPreview>, text: string) {
  const ta = wrapper.find('textarea').element as HTMLTextAreaElement
  ta.value = text
  await wrapper.find('.enrich-patches-preview__composer .enrich-patches-preview__run').trigger('click')
  await flushPromises()
}

describe('enrich — kind:"question" → підтвердження замість карток', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    enrich.mockReset()
    enrichApply.mockReset()
    enrichProgress.mockReset()
    enrichProgress.mockResolvedValue(null)
  })

  it('без kind картки підтвердження немає (старий контракт не змінився)', async () => {
    enrich.mockResolvedValueOnce(EMPTY_RUN)
    const w = mountPreview()
    await typeAndRun(w, 'додай формули')
    expect(w.find(CARD).exists()).toBe(false)
  })

  it('kind:"question" → картка з двома кнопками, поле з текстом лишається', async () => {
    enrich.mockResolvedValueOnce(QUESTION_RESP)
    const w = mountPreview()
    await typeAndRun(w, 'що ти вмієш?')
    expect(w.find(CARD).exists()).toBe(true)
    expect(w.find(ASK).exists()).toBe(true)
    expect(w.find(FORCE).exists()).toBe(true)
    // Тьютор бачить, ЩО саме визнано питанням — поле не стерте.
    expect((w.find('textarea').element as HTMLTextAreaElement).value).toBe('що ти вмієш?')
    // Жодних «Оброблено 0 з 14» — це не збій.
    expect(w.text()).not.toContain('Оброблено')
  })

  it('«Спитати Інтегралика» → подія з текстом + close', async () => {
    enrich.mockResolvedValueOnce(QUESTION_RESP)
    const w = mountPreview()
    await typeAndRun(w, 'що ти вмієш?')
    const seen: string[] = []
    const onAsk = (e: Event) => seen.push(String((e as CustomEvent).detail?.text))
    window.addEventListener('m4sh:integralyk-ask', onAsk)
    try {
      await w.find(ASK).trigger('click')
    } finally {
      window.removeEventListener('m4sh:integralyk-ask', onAsk)
    }
    expect(seen).toEqual(['що ти вмієш?'])
    expect(w.emitted('close')).toBeTruthy()
    // Другого виклику enrich не було — питання пішло в палітру, не в LLM-пакети.
    expect(enrich).toHaveBeenCalledTimes(1)
  })

  it('«Ні, збагатити як є» → повторний enrich із forceFreeform=true', async () => {
    enrich.mockResolvedValueOnce(QUESTION_RESP).mockResolvedValueOnce(EMPTY_RUN)
    const w = mountPreview()
    await typeAndRun(w, 'що ти вмієш?')
    await w.find(FORCE).trigger('click')
    await flushPromises()
    expect(enrich).toHaveBeenCalledTimes(2)
    const second = enrich.mock.calls[1]
    expect(second[0]).toBe('a1')
    expect(second[1]).toBe('що ти вмієш?')
    expect(second[2]).toBeUndefined()      // не дозбір
    expect(second[4]).toBe(true)           // forceFreeform
    // Картка зникла — рішення прийнято.
    expect(w.find(CARD).exists()).toBe(false)
  })

  it('перший (звичайний) виклик іде БЕЗ forceFreeform', async () => {
    enrich.mockResolvedValueOnce(QUESTION_RESP)
    const w = mountPreview()
    await typeAndRun(w, 'що ти вмієш?')
    expect(enrich.mock.calls[0][4]).toBeFalsy()
  })
})
