/**
 * H0 · підвал джерел у картці теорії.
 *
 * ТЗ `TZ_INTEGRALYK_EVIDENCE_TIMELINE_MAP_2026-09-17.md`, §5.
 *
 * ЧОМУ САМЕ ЗМОНТОВАНА КАРТКА, А НЕ ПОШУК РЯДКІВ
 *
 * Тут ламається дві речі, і жодна не видно в джерелі:
 * 1) службовий підпис мусить бути мовою МАТЕРІАЛУ, а не UI-локалі — англомовна
 *    картка в українському інтерфейсі не має підписуватись «Джерела»;
 * 2) стара картка без `sources[]` має рендеритись точно як раніше, без
 *    порожнього підвалу.
 */
import { describe, expect, it, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { createI18n } from 'vue-i18n'
import uk from '../../../i18n/locales/uk.json'
import TheoryCardRenderer from '../components/board/objects/TheoryCardRenderer.vue'
import type { WBAsset } from '../types/winterboard'

vi.mock('@/utils/media', () => ({ resolveMediaUrl: (u: string) => u }))

const i18n = () => createI18n({ legacy: false, locale: 'uk', fallbackLocale: 'uk', messages: { uk } as never })

const REF = {
  provider: 'wikipedia',
  source_id: '',
  title: 'Ivan Mazepa',
  url: 'https://en.wikipedia.org/wiki/Mazepa',
  language: 'en',
  author: 'Wikipedia contributors',
  license: 'CC BY-SA 4.0',
  license_url: 'https://creativecommons.org/licenses/by-sa/4.0/',
  revision_id: '1284477112',
  retrieved_at: '2026-09-18T10:00:00+00:00',
  evidence: 'Ukrainian hetman.',
  evidence_key: '',
  modified: false,
}

function card(data: Record<string, unknown> = {}) {
  return {
    id: 'th1', type: 'theory_card', src: '', x: 0, y: 0, w: 520, h: 300, rotation: 0, locked: false,
    data: { version: 1, title: 'Ivan Mazepa', body: 'Text.', formulas: [], ...data },
  } as unknown as WBAsset
}

const mountCard = (data: Record<string, unknown> = {}) => mount(TheoryCardRenderer, {
  props: { asset: card(data), isSelected: false, interactive: true },
  global: { plugins: [i18n()] },
})

describe('theory_card · підвал джерел', () => {
  it('стара картка без sources рендериться як раніше — підвалу немає', () => {
    const w = mountCard()
    expect(w.find('.theory-card__sources').exists()).toBe(false)
    w.unmount()
  })

  it('компактний рядок показує кількість, список згорнутий', () => {
    const w = mountCard({ content_language: 'uk', sources: [REF, { ...REF, title: 'Друге' }] })
    expect(w.find('.theory-card__sources-toggle').text()).toBe('Джерела: 2')
    expect(w.find('.theory-card__sources-list').exists()).toBe(false)
    w.unmount()
  })

  it('клік розгортає назву, URL, автора, ліцензію й час отримання', async () => {
    const w = mountCard({ content_language: 'uk', sources: [REF] })
    await w.find('.theory-card__sources-toggle').trigger('click')
    const item = w.find('.theory-card__source')
    expect(item.find('a').attributes('href')).toBe(REF.url)
    expect(item.text()).toContain('Ivan Mazepa')
    expect(item.text()).toContain('Автор: Wikipedia contributors')
    expect(item.text()).toContain('Ліцензія: CC BY-SA 4.0')
    expect(item.text()).toContain('Отримано: 2026-09-18')
    w.unmount()
  })

  it('англомовна картка підписана англійською, хоч UI український', async () => {
    const w = mountCard({ content_language: 'en', sources: [REF] })
    expect(w.find('.theory-card__sources-toggle').text()).toBe('Sources: 1')
    await w.find('.theory-card__sources-toggle').trigger('click')
    const text = w.find('.theory-card__source').text()
    expect(text).toContain('Author: Wikipedia contributors')
    expect(text).toContain('License: CC BY-SA 4.0')
    expect(text).not.toContain('Автор')
    expect(text).not.toContain('Ліцензія')
    w.unmount()
  })

  it('версію джерела видно поряд із ліцензією', async () => {
    const w = mountCard({ content_language: 'uk', sources: [REF] })
    await w.find('.theory-card__sources-toggle').trigger('click')
    expect(w.find('.theory-card__source').text()).toContain('Версія: 1284477112')
    w.unmount()
  })

  it('непридатний URL показується текстом, а не посиланням', async () => {
    const w = mountCard({ content_language: 'uk', sources: [{ ...REF, url: 'javascript:alert(1)' }] })
    await w.find('.theory-card__sources-toggle').trigger('click')
    const item = w.find('.theory-card__source')
    // джерело лишається видимим — ховати його було б гірше, ніж показати без посилання
    expect(item.text()).toContain('Ivan Mazepa')
    expect(item.find('a').exists()).toBe(false)
    expect(item.find('.theory-card__source-title--plain').exists()).toBe(true)
    w.unmount()
  })

  it('зіпсований retrieved_at не ламає картку — рядка дати просто немає', async () => {
    const w = mountCard({ content_language: 'uk', sources: [{ ...REF, retrieved_at: 'позавчора' }] })
    await w.find('.theory-card__sources-toggle').trigger('click')
    const item = w.find('.theory-card__source')
    expect(item.exists()).toBe(true)
    expect(item.text()).toContain('Ivan Mazepa')
    expect(item.text()).not.toContain('Отримано')
    expect(item.text()).not.toContain('позавчора')
    w.unmount()
  })

  it('зовнішнє посилання не тягне за собою реферер', async () => {
    const w = mountCard({ content_language: 'uk', sources: [REF] })
    await w.find('.theory-card__sources-toggle').trigger('click')
    expect(w.find('.theory-card__source a').attributes('rel')).toContain('noopener')
    w.unmount()
  })
})
