/**
 * HistoryCard — довідкова картка історичної сутності.
 *
 * Тести ганяють РЕАЛЬНІ пайлоади, зібрані з корпусу 105 сутностей
 * (`DATA/knowledge_probe/CARD_CONTRACT/board_payloads/`), а не вигадані.
 *
 * ГОЛОВНЕ, ЩО СТЕРЕЖУТЬ:
 *   1. На картці НЕМАЄ технічних назв (вимога власника 2026-09-20): ні кодів
 *      властивостей, ні ідентифікаторів. `entity_ref` лишається в даних лише як
 *      непрозора адреса переходу (інваріант `CLAUDE_RULES.md`, 2026-09-21).
 *   2. Дві дати в різних календарях — ОДИН рядок плюс примітка, не діапазон.
 *   3. Порожнє поле не малює рядок — ніяких «—».
 *   4. Зображення без автора або ліцензії на дошку не йде.
 */
import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'

import HistoryCardRenderer from '../components/board/objects/HistoryCardRenderer.vue'
import type { HistoryCardData, WBAsset } from '../types/winterboard'

const i18n = {
  global: {
    mocks: { $t: (k: string) => k },
    stubs: { 'i18n-t': true },
  },
}

function asset(data: Partial<HistoryCardData>): WBAsset {
  return {
    id: 'hc1', type: 'history_card', src: '', x: 0, y: 0, w: 520, h: 380,
    rotation: 0, locked: false,
    data: { version: 1, variant: 'person', title: '', primary: [], ...data },
  } as unknown as WBAsset
}

function render(
  data: Partial<HistoryCardData>,
  interactive = true,
  // За замовчуванням дії ВИМКНЕНІ — як на дошці, поки немає адресата.
  caps: { canOpenEntity?: boolean; canPinToMap?: boolean } = {},
) {
  return mount(HistoryCardRenderer, {
    props: { asset: asset(data), interactive, ...caps },
    ...i18n,
  })
}
/** Картка з увімкненими діями — для перевірки самих переходів. */
const LIVE = { canOpenEntity: true, canPinToMap: true }

// ── реальні дані з корпусу ────────────────────────────────────────────────
const POLTAVA: Partial<HistoryCardData> = {
  variant: 'event',
  title: 'Полтавська битва',
  image: {
    url: 'https://upload.wikimedia.org/x.jpg',
    author: 'Pierre-Denis Martin',
    license: 'Public domain',
    attribution: 'Pierre-Denis Martin · Public domain · Вікісховище',
  },
  primary: [
    {
      label: 'Дата', status: 'verified', total: 1,
      values: [{ label: '8 липня 1709', display: '8 липня 1709', old_style: '27 червня 1709' }],
    },
    {
      label: 'Місце', status: 'verified', total: 1,
      values: [{ label: 'Полтава', entity_ref: { provider: 'wikidata', id: 'Q156747' }, lat: 49.589, lon: 34.551 }],
    },
    {
      label: 'Учасники', status: 'mixed', total: 4,
      values: [
        { label: 'Шведська імперія', entity_ref: { provider: 'wikidata', id: 'Q215443' } },
        { label: 'Гетьманщина', entity_ref: { provider: 'wikidata', id: 'Q212439' } },
        { label: 'Військо Запорозьке Низове', entity_ref: { provider: 'wikidata', id: 'Q4122709' } },
        { label: 'Московське царство', entity_ref: { provider: 'wikidata', id: 'Q186096' } },
      ],
    },
  ],
  secondary: [
    { label: 'Країна', status: 'verified', total: 1, values: [{ label: 'Україна', entity_ref: { provider: 'wikidata', id: 'Q212' } }] },
  ],
  content_language: 'uk',
}

const KHMELNYTSKY: Partial<HistoryCardData> = {
  variant: 'person',
  title: 'Богдан Хмельницький',
  subtitle: 'гетьман Війська Запорозького',
  primary: [
    {
      label: 'Народження', status: 'mixed', total: 3,
      values: [{ label: 'Жовква' }, { label: 'Чигирин' }, { label: 'Суботів' }],
    },
  ],
  content_language: 'uk',
}

describe('HistoryCard · технічних назв на картці немає', () => {
  it('ні кодів властивостей, ні QID у видимому тексті', () => {
    const w = render(POLTAVA)
    const text = w.text()
    // посилання в даних є — воно потрібне для переходу; на картці його бути не може
    expect(POLTAVA.primary![1].values[0].entity_ref?.id).toBe('Q156747')
    expect(text).not.toMatch(/Q\d{3,}/)
    expect(text).not.toMatch(/\bP\d{2,}\b/)
  })

  it('підпис рядка — людський, не назва властивості', () => {
    expect(render(POLTAVA).text()).toContain('Учасники')
  })
})

describe('HistoryCard · календар', () => {
  it('дві дати в різних календарях дають ОДИН рядок, не діапазон', () => {
    const text = render(POLTAVA).text()
    expect(text).toContain('8 липня 1709')
    expect(text).not.toContain('…')
    expect(text).not.toContain('27 червня 1709')   // старий стиль схований під «?»
  })

  it('примітка про старий стиль розкривається кнопкою', async () => {
    const w = render(POLTAVA)
    await w.find('.history-card__hint').trigger('click')
    expect(w.text()).toContain('27 червня 1709')
    expect(w.text()).toContain('за старим стилем')
  })
})

describe('HistoryCard · кілька значень і розбіжність', () => {
  it('показує до трьох, решту ховає за «+N»', () => {
    const w = render(POLTAVA)
    expect(w.text()).toContain('Військо Запорозьке Низове')
    expect(w.text()).not.toContain('Московське царство')
    expect(w.find('.history-card__more').text()).toBe('+1')
  })

  it('«+N» розкриває решту', async () => {
    const w = render(POLTAVA)
    await w.find('.history-card__more').trigger('click')
    expect(w.text()).toContain('Московське царство')
  })

  it('розбіжність джерел — бейдж, і він розкриває всі значення', async () => {
    const w = render(KHMELNYTSKY)
    expect(w.text()).toContain('джерела розходяться')
    await w.find('.history-card__mixed').trigger('click')
    const list = w.find('.history-card__mixed-list').text()
    expect(list).toContain('Жовква')
    expect(list).toContain('Чигирин')
    expect(list).toContain('Суботів')
  })

  it('verified не отримує бейджа', () => {
    expect(render({ ...POLTAVA, primary: [POLTAVA.primary![0]] })
      .find('.history-card__mixed').exists()).toBe(false)
  })
})

describe('HistoryCard · порожнє не малюється', () => {
  it('без полів немає блоку полів і немає «—»', () => {
    const w = render({ variant: 'event', title: 'Хрестові походи', primary: [] })
    expect(w.find('.history-card__fields').exists()).toBe(false)
    expect(w.text()).not.toContain('—')
  })

  it('без підзаголовка рядка немає', () => {
    expect(render({ title: 'X', primary: [] }).find('.history-card__subtitle').exists()).toBe(false)
  })

  it('без джерел підвала немає', () => {
    expect(render(POLTAVA).find('.history-card__sources').exists()).toBe(false)
  })
})

describe('HistoryCard · зображення проходить гейт атрибуції', () => {
  it('з автором і ліцензією — показуємо', () => {
    expect(render(POLTAVA).find('.history-card__image').exists()).toBe(true)
  })

  it('без автора — НЕ показуємо', () => {
    const w = render({ ...POLTAVA, image: { ...POLTAVA.image!, author: '' } })
    expect(w.find('.history-card__image').exists()).toBe(false)
  })

  it('без ліцензії — НЕ показуємо', () => {
    const w = render({ ...POLTAVA, image: { ...POLTAVA.image!, license: '' } })
    expect(w.find('.history-card__image').exists()).toBe(false)
  })
})

describe('HistoryCard · два стани', () => {
  it('compact не показує другорядні рядки', () => {
    expect(render(POLTAVA).text()).not.toContain('Країна')
  })

  it('клік на заголовок просить оновити асет, а не мутує локально', async () => {
    const w = render(POLTAVA)
    await w.find('.history-card__heading').trigger('click')
    const emitted = w.emitted('update:asset')
    expect(emitted).toBeTruthy()
    const next = (emitted![0][0] as WBAsset).data as HistoryCardData
    expect(next.expanded).toBe(true)
  })

  it('expanded показує другорядні рядки', () => {
    expect(render({ ...POLTAVA, expanded: true }).text()).toContain('Країна')
  })

  it('під олівцем стан не перемикається', async () => {
    const w = render(POLTAVA, false)
    await w.find('.history-card__heading').trigger('click')
    expect(w.emitted('update:asset')).toBeFalsy()
  })
})

describe('HistoryCard · переходи', () => {
  it('значення з entity_ref просить відкрити суміжну картку', async () => {
    const w = render(POLTAVA, true, LIVE)
    await w.findAll('.history-card__link')[0].trigger('click')
    // Посилання йде далі ЦІЛИМ і непрозорим — рендерер `id` не розбирає.
    expect(w.emitted('open-entity')![0]).toEqual([{ provider: 'wikidata', id: 'Q156747' }, 'Полтава'])
  })

  it('шпилька на карту лише коли координата є', async () => {
    const w = render(POLTAVA, true, LIVE)
    const pins = w.findAll('.history-card__pin')
    expect(pins).toHaveLength(1)          // тільки в Полтави
    await pins[0].trigger('click')
    expect(w.emitted('to-map')![0]).toEqual([49.589, 34.551, 'Полтава'])
  })

  it('значення без entity_ref не є посиланням', () => {
    const w = render(KHMELNYTSKY, true, LIVE)
    expect(w.find('.history-card__link').exists()).toBe(false)
  })
})

describe('HistoryCard · мертвих кнопок немає', () => {
  it('без обробника переходу значення лишається ТЕКСТОМ, не посиланням', () => {
    // Кімната ще не слухає `open-entity`. Кнопка, яка нічого не робить,
    // гірша за її відсутність — тому її немає.
    const w = render(POLTAVA, true, { canOpenEntity: false, canPinToMap: true })
    expect(w.find('.history-card__link').exists()).toBe(false)
    expect(w.text()).toContain('Полтава')       // значення видно, просто не клікається
  })

  it('без карти на дошці шпильки немає, хоч координата є', () => {
    const w = render(POLTAVA, true, { canOpenEntity: true, canPinToMap: false })
    expect(POLTAVA.primary![1].values[0].lat).toBe(49.589)
    expect(w.find('.history-card__pin').exists()).toBe(false)
  })

  it('типові props — усі дії вимкнені', () => {
    const w = render(POLTAVA)
    expect(w.find('.history-card__link').exists()).toBe(false)
    expect(w.find('.history-card__pin').exists()).toBe(false)
  })
})

describe('HistoryCard · мова матеріалу, не UI', () => {
  it('англійська картка має англійські службові підписи', () => {
    const w = render({ ...KHMELNYTSKY, content_language: 'en' })
    expect(w.text()).toContain('sources disagree')
    expect(w.text()).not.toContain('джерела розходяться')
  })

  it('подання має власний підпис у шапці', () => {
    expect(render(POLTAVA).find('.history-card__badge').text()).toBe('Подія')
    expect(render(KHMELNYTSKY).find('.history-card__badge').text()).toBe('Особа')
    expect(render({ variant: 'monument', title: 'X', primary: [] })
      .find('.history-card__badge').text()).toBe("Пам'ятка")
  })
})
