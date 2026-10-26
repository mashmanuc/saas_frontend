/**
 * LAW §9 v1.62 «Переклад» у мовному розборі (власник 2026-10-26: «треба додати перекладача» → «роби»).
 *
 *   — чернетка перекладу приходить закритою схемою (лише текст іншою мовою диктанту, до 300 знаків, без керівних,
 *     крім переносу рядка);
 *   — учитель бачить і править переклад; «Написати на дошці» — звичайний диктант мовою перекладу (той самий шлях,
 *     що вікно «Диктант»), рядок стану — з пульта; без диктанту на пульті кнопки «Переклад» немає;
 *   — збій — чесне «недоступний», дошку не змінено.
 */
import { describe, it, expect, vi } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import RemoteSentenceAnalysis from '../components/remote/RemoteSentenceAnalysis.vue'
import { readTranslationDraft, type TranslationDraft, type TranslationTarget } from '../api/dictationAnalysis'

const revision = 'a'.repeat(64)
const target: TranslationTarget = { board_id: 'b', page_id: 'p', object_id: 's', source_revision: revision }
const sentence = () => ({ page_id: 'p', object_id: 's', source_revision: revision,
  words: [{ id: 'w0', text: 'Сонце', hidden: false }, { id: 'w1', text: 'сходило', hidden: false }], punct: false })
const raw = (extra: Record<string, unknown> = {}) => ({ source_revision: revision, kind: 'translation',
  text: 'Сонце сходило.', translation: 'The sun was rising.', lang: 'en', ...extra })

describe('v1.62 · переклад речення з мовного розбору', () => {
  it('чернетка — закрита схема: лише переклад іншою мовою, без керівних (крім переносу рядка)', () => {
    expect(readTranslationDraft(raw(), target)).toEqual({ source_revision: revision, text: 'Сонце сходило.',
      translation: 'The sun was rising.', lang: 'en' })
    expect(readTranslationDraft(raw({ translation: '25 October\nClass work' }), target).translation).toBe('25 October\nClass work')
    for (const bad of [raw({ kind: 'parts' }), raw({ lang: 'de' }), raw({ source_revision: 'b'.repeat(64) }),
      raw({ translation: '' }), raw({ translation: 'a'.repeat(301) }), raw({ translation: 'The\tsun' }),
      { ...raw(), items: [] }, null]) {
      expect(() => readTranslationDraft(bad, target), JSON.stringify(bad)).toThrow()
    }
  })

  it('«Переклад» → чернетка на телефоні → правка → «Написати на дошці» = диктант мовою перекладу', async () => {
    const send = vi.fn(() => true), dictate = vi.fn(() => true)
    const translate = vi.fn(async (): Promise<TranslationDraft> => readTranslationDraft(raw(), target))
    const w = mount(RemoteSentenceAnalysis, { props: { boardId: 'b', sentence: sentence(), ready: true, result: null, send,
      dictate, translate, dictationStatus: '' } })
    await w.get('[data-analysis-kind="translation"]').trigger('click'); await flushPromises()
    expect(translate).toHaveBeenCalledWith(target, expect.any(AbortSignal))
    expect(dictate).not.toHaveBeenCalled(); expect(send).not.toHaveBeenCalled()      // чернетка дошку не змінює
    const area = w.get('[data-testid="translation-text"]')
    expect((area.element as HTMLTextAreaElement).value).toBe('The sun was rising.')
    await area.setValue('The sun rose.')
    await w.get('[data-testid="translation-review"]').trigger('submit')
    expect(dictate).toHaveBeenCalledWith('The sun rose.', 'en')
    expect(w.find('[data-testid="translation-review"]').exists()).toBe(false)
    await w.setProps({ dictationStatus: 'Пишу на дошці…' })
    expect(w.get('[data-testid="translation-status"]').text()).toBe('Пишу на дошці…')
    await w.setProps({ dictationStatus: 'Готово — речення на дошці' })
    expect(w.get('[data-testid="translation-status"]').text()).toBe('Готово — речення на дошці')
    w.unmount()
  })

  it('без диктанту на пульті кнопки «Переклад» немає; збій — «недоступний», дошку не змінено', async () => {
    const plain = mount(RemoteSentenceAnalysis, { props: { boardId: 'b', sentence: sentence(), ready: true, result: null, send: vi.fn() } })
    expect(plain.find('[data-analysis-kind="translation"]').exists()).toBe(false)
    plain.unmount()
    const dictate = vi.fn(() => true)
    const w = mount(RemoteSentenceAnalysis, { props: { boardId: 'b', sentence: sentence(), ready: true, result: null, send: vi.fn(),
      dictate, translate: vi.fn(async () => { throw new Error('boom') }) } })
    await w.get('[data-analysis-kind="translation"]').trigger('click'); await flushPromises()
    expect(w.text()).toContain('Переклад недоступний')
    expect(dictate).not.toHaveBeenCalled()
    w.unmount()
  })

  it('немає зв\'язку — переклад лишається на телефоні з поясненням', async () => {
    const w = mount(RemoteSentenceAnalysis, { props: { boardId: 'b', sentence: sentence(), ready: true, result: null, send: vi.fn(),
      dictate: vi.fn(() => false), translate: vi.fn(async () => readTranslationDraft(raw(), target)) } })
    await w.get('[data-analysis-kind="translation"]').trigger('click'); await flushPromises()
    await w.get('[data-testid="translation-review"]').trigger('submit')
    expect(w.find('[data-testid="translation-review"]').exists()).toBe(true)
    expect(w.text()).toContain('Немає зв’язку з дошкою')
    w.unmount()
  })
})
