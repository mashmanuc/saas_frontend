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
import { flushPromises } from '@vue/test-utils'
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
    expect(w.find('.theory-card__sources-toggle').text()).toBe('Source')
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
    // саме ЗАГОЛОВОК не посилання; посилання ліцензії поруч лишається валідним
    expect(item.find('a.theory-card__source-title').exists()).toBe(false)
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


// ── Ліцензія як посилання (рев'ю H0) ────────────────────────────────────────
describe('назва ліцензії веде на її текст', () => {
  const licenseLink = (w: any) => w.find('.theory-card__source-license-link')

  it('CC BY-SA з валідним license_url — клікабельна', async () => {
    const w = mountCard({ content_language: 'uk', sources: [REF] })
    await w.find('.theory-card__sources-toggle').trigger('click')
    const link = licenseLink(w)
    expect(link.exists()).toBe(true)
    expect(link.attributes('href')).toBe('https://creativecommons.org/licenses/by-sa/4.0/')
    expect(link.text()).toContain('CC BY-SA 4.0')
    expect(link.attributes('rel')).toContain('noopener')
    w.unmount()
  })

  it('небезпечний license_url — назва лишається текстом', async () => {
    for (const bad of ['javascript:alert(1)', 'data:text/html,x', 'ftp://a/b', '']) {
      const w = mountCard({ content_language: 'uk', sources: [{ ...REF, license_url: bad }] })
      await w.find('.theory-card__sources-toggle').trigger('click')
      expect(licenseLink(w).exists(), bad).toBe(false)
      // сама ліцензія нікуди не зникає — ховати її не можна, це умова показу
      expect(w.find('.theory-card__source').text()).toContain('CC BY-SA 4.0')
      w.unmount()
    }
  })
})

// ── Висота картки при відкритті джерел (рев'ю H0) ───────────────────────────
describe('відкритий список джерел змінює потрібну висоту', () => {
  const BASE = 400
  const FOOTER = 24
  const PER_SOURCE = 60

  /** Потік росте разом із DOM: відкритий список — це реальні рядки. */
  function stubFlow(w: any) {
    const root = w.find('.theory-card').element as HTMLElement
    const body = w.find('.theory-card__body').element as HTMLElement
    const flow = w.find('.theory-card__flow').element as HTMLElement
    Object.defineProperty(root, 'offsetHeight', { get: () => 300, configurable: true })
    Object.defineProperty(body, 'clientHeight', { get: () => 260, configurable: true })
    // Згорнутий підвал — це рядок «Джерела: N», він теж займає місце;
    // розгорнутий додає ще по рядку на джерело.
    flow.getBoundingClientRect = () => ({
      height: BASE
        + (w.find('.theory-card__sources').exists() ? FOOTER : 0)
        // Висота залежить від САМОГО тексту, а не лише від кількості рядків —
        // довша назва переносить рядок і забирає більше місця.
        + w.findAll('.theory-card__source')
          .reduce((acc: number, el: any) => acc + PER_SOURCE + el.text().length, 0),
    }) as DOMRect
  }

  const lastHeight = (w: any) => {
    const all = w.emitted('request-height') as number[][] | undefined
    return all?.[all.length - 1]?.[0]
  }

  it('відкрити → більша висота; закрити → повертається до згорнутої', async () => {
    const w = mountCard({ content_language: 'uk', sources: [REF, { ...REF, title: 'Друге' }] })
    stubFlow(w)
    await flushPromises()
    const collapsed = lastHeight(w)
    expect(collapsed, 'картка не запитала висоту згорнутого вмісту').toBeGreaterThan(0)

    await w.find('.theory-card__sources-toggle').trigger('click')
    await flushPromises()
    const opened = lastHeight(w)
    expect(opened, 'після відкриття джерел висота не перерахувалась').toBeGreaterThan(collapsed!)

    await w.find('.theory-card__sources-toggle').trigger('click')
    await flushPromises()
    expect(lastHeight(w)).toBe(collapsed)
    w.unmount()
  })

  it('та сама кількість, але довший текст → висота збільшилась', async () => {
    // Дефект: стеження лише за `sources.length` не бачить ЗАМІНИ джерела.
    // Відкрита картка лишалась із висотою під коротку назву, і текст ліз під
    // нижню межу.
    const asset = card({ content_language: 'uk', sources: [REF] })
    const w = mount(TheoryCardRenderer, {
      props: { asset, isSelected: false, interactive: true },
      global: { plugins: [i18n()] },
    })
    stubFlow(w)
    await w.find('.theory-card__sources-toggle').trigger('click')
    await flushPromises()
    const short = lastHeight(w)

    const longer = { ...REF, title: 'Ivan Mazepa, hetman of the Zaporozhian Host, ' + 'x'.repeat(120) }
    await w.setProps({ asset: card({ content_language: 'uk', sources: [longer] }) })
    await flushPromises()

    expect(w.findAll('.theory-card__source')).toHaveLength(1)   // кількість НЕ змінилась
    expect(lastHeight(w), 'заміна джерела не перерахувала висоту').toBeGreaterThan(short!)
    w.unmount()
  })

  it('зміна мови матеріалу теж перераховує — підписи інші за довжиною', async () => {
    const w = mount(TheoryCardRenderer, {
      props: { asset: card({ content_language: 'uk', sources: [REF] }), isSelected: false, interactive: true },
      global: { plugins: [i18n()] },
    })
    stubFlow(w)
    await w.find('.theory-card__sources-toggle').trigger('click')
    await flushPromises()
    const uk = lastHeight(w)

    await w.setProps({ asset: card({ content_language: 'en', sources: [REF] }) })
    await flushPromises()
    expect(w.find('.theory-card__sources-toggle').text()).toBe('Source')
    expect(lastHeight(w)).not.toBe(uk)
    w.unmount()
  })

  it('поява джерел у даних теж перераховує висоту', async () => {
    const asset = card({ content_language: 'uk' })
    const w = mount(TheoryCardRenderer, {
      props: { asset, isSelected: false, interactive: true },
      global: { plugins: [i18n()] },
    })
    stubFlow(w)
    await flushPromises()
    const before = lastHeight(w)

    await w.setProps({ asset: card({ content_language: 'uk', sources: [REF] }) })
    await flushPromises()
    // підвал «Джерела: 1» — це теж вміст, і він займає місце
    expect(lastHeight(w)).not.toBe(before)
    w.unmount()
  })
})

// ── LAW §9 v1.22: джерело — кнопкою, а не рядком у тексті (власник 2026-09-29) ──────────
describe('рядок атрибуції з кінця тексту переїжджає в кнопку «Джерело»', () => {
  const TASL = 'Джерело: «Ivan Mazepa», Вікіпедія (en), Wikipedia contributors · https://en.wikipedia.org/wiki/Mazepa · CC BY-SA 4.0'
  const text = (w: any) => w.find('.theory-card__text').text()

  it('одне джерело — кнопка «Джерело» без лічби', () => {
    const w = mountCard({ content_language: 'uk', sources: [REF] })
    expect(w.find('.theory-card__sources-toggle').text()).toBe('Джерело')
    w.unmount()
  })

  it('TASL-рядок про джерело картки в тексті не видно; дані картки ті самі (гейт H0)', () => {
    const body = `Гетьман Війська Запорозького.\n\n${TASL}`
    const asset = card({ content_language: 'uk', body, sources: [REF] })
    const w = mount(TheoryCardRenderer, {
      props: { asset, isSelected: false, interactive: true },
      global: { plugins: [i18n()] },
    })
    expect(text(w)).toBe('Гетьман Війська Запорозького.')
    expect(w.text()).not.toContain('Wikipedia contributors ·')
    expect((asset.data as { body: string }).body).toBe(body)
    w.unmount()
  })

  it('розгорнута кнопка дає назву-посилання, автора й ліцензію — повну атрибуцію', async () => {
    const w = mountCard({ content_language: 'uk', body: `Текст.\n\n${TASL}`, sources: [REF] })
    await w.find('.theory-card__sources-toggle').trigger('click')
    const item = w.find('.theory-card__source')
    expect(item.find('a').attributes('href')).toBe(REF.url)
    expect(item.text()).toContain('Автор: Wikipedia contributors')
    expect(item.text()).toContain('Ліцензія: CC BY-SA 4.0')
    w.unmount()
  })

  it('картка поза гейтом коридорів (без sources[]): «Джерело: Вікіпедія — адреса» теж стає кнопкою', async () => {
    const url = 'https://uk.wikipedia.org/wiki/%D0%9C%D0%B0%D0%B7%D0%B5%D0%BF%D0%B0'
    const w = mountCard({ body: `Гетьман.\n\nДжерело: Вікіпедія — ${url}` })
    expect(text(w)).toBe('Гетьман.')
    expect(w.find('.theory-card__sources-toggle').text()).toBe('Джерело')
    await w.find('.theory-card__sources-toggle').trigger('click')
    const link = w.find('.theory-card__source a')
    expect(link.attributes('href')).toBe(url)
    expect(link.text()).toBe('https://uk.wikipedia.org/wiki/Мазепа')
    expect(link.attributes('rel')).toContain('noopener')
    expect(w.find('.theory-card__source').text()).toContain('Вікіпедія')
    w.unmount()
  })

  it('стара картка без sources[] і без упізнаного рядка — рендериться як раніше', () => {
    const w = mountCard({ body: `Текст.\n\n${TASL}` })
    expect(text(w)).toContain(TASL)
    expect(w.find('.theory-card__sources').exists()).toBe(false)
    w.unmount()
  })

  it('останній абзац не про джерело картки (інша адреса) — лишається в тексті', () => {
    const w = mountCard({ content_language: 'uk', body: 'Текст.\n\nДжерело: підручник, с. 12', sources: [REF] })
    expect(text(w)).toContain('Джерело: підручник, с. 12')
    w.unmount()
  })
})
