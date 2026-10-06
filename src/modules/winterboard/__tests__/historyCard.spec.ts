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
import { flushPromises, mount } from '@vue/test-utils'
import { describe, expect, it, vi } from 'vitest'

import HistoryCardRenderer from '../components/board/objects/HistoryCardRenderer.vue'
import { HISTORY_VARIANTS } from '../../intent/boardActions'
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
  caps: { canOpenEntity?: boolean; canPinToMap?: boolean;
    loadActions?: (ref: unknown) => Promise<{ id: string; label: string }[]> } = {},
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

  it('без джерел і без картинки підвала немає', () => {
    expect(render(KHMELNYTSKY).find('.history-card__sources').exists()).toBe(false)
  })
})

describe('HistoryCard · автор картинки — у підвалі «ⓘ», висота — після картинки (2026-09-30)', () => {
  // Прод, «0»: під картинкою лягало сире поле автора з Вікісховища («Chess x0145.svg: Betalph
  // derivative work…»), а картка не розгорнулась — висоту міряли до завантаження картинки.
  const FILE_PAGE = 'https://commons.wikimedia.org/wiki/File:Poltava.jpg'
  const WITH_PAGE: Partial<HistoryCardData> = { ...POLTAVA, image: { ...POLTAVA.image!, file_page: FILE_PAGE } }

  it('під картинкою рядка автора немає — видно лише «ⓘ» внизу', () => {
    const w = render(WITH_PAGE)
    expect(w.find('.history-card__media').text()).toBe('')
    expect(w.find('.history-card__media').text()).not.toContain('Pierre-Denis Martin')
    expect(w.find('.history-card__sources-toggle').text()).toContain('1')
    expect(w.find('[data-testid="history-card-image-source"]').exists()).toBe(false)
  })

  it('«ⓘ» відкриває автора, ліцензію і сторінку файла', async () => {
    const w = render(WITH_PAGE)
    await w.find('.history-card__sources-toggle').trigger('click')
    const item = w.find('[data-testid="history-card-image-source"]')
    expect(item.text()).toContain('Зображення')
    expect(item.text()).toContain('Pierre-Denis Martin')
    expect(item.text()).toContain('Public domain')
    expect(item.find('a').attributes('href')).toBe(FILE_PAGE)
  })

  it('лічильник рахує і джерела, і картинку', () => {
    const ref = { provider: 'wikidata', title: 'Полтавська битва', url: 'https://www.wikidata.org/wiki/Q152486' }
    const w = render({ ...WITH_PAGE, sources: [ref, { ...ref, title: 'Друге' }] as HistoryCardData['sources'] })
    expect(w.find('.history-card__sources-toggle').text()).toContain('3')
  })

  it('сторінка файла не веб-адреса — автор текстом, без посилання', async () => {
    const w = render({ ...POLTAVA, image: { ...POLTAVA.image!, file_page: 'javascript:alert(1)' } })
    await w.find('.history-card__sources-toggle').trigger('click')
    expect(w.find('[data-testid="history-card-image-source"] a').exists()).toBe(false)
  })

  it('англійська картка — «Image»', async () => {
    const w = render({ ...WITH_PAGE, content_language: 'en' })
    await w.find('.history-card__sources-toggle').trigger('click')
    expect(w.find('[data-testid="history-card-image-source"]').text()).toContain('Image')
  })

  it('розміри з даних бронюють місце картинці ще до завантаження', () => {
    const w = render({ ...POLTAVA, image: { ...POLTAVA.image!, width: 800, height: 600 } })
    const img = w.find('.history-card__image')
    expect(img.attributes('width')).toBe('800')
    expect(img.attributes('height')).toBe('600')
  })

  // У happy-dom розкладки немає: картці треба дати розміри — без них вона тепер не міряється (Б-142).
  const laidOut = (w: ReturnType<typeof render>) =>
    Object.defineProperty(w.find('.history-card').element, 'offsetHeight', { get: () => 360, configurable: true })

  it('картинка довантажилась — картка перемірює висоту', async () => {
    const w = render(POLTAVA)
    laidOut(w)
    await flushPromises()
    const before = (w.emitted('request-height') ?? []).length
    const flow = w.find('.history-card__flow').element as HTMLElement
    flow.getBoundingClientRect = () => ({ height: 420 } as DOMRect)
    await w.find('.history-card__image').trigger('load')
    await flushPromises()
    const after = w.emitted('request-height') ?? []
    expect(after.length).toBe(before + 1)
    expect(after[after.length - 1]?.[0]).toBeGreaterThanOrEqual(420)
  })

  it('картинка не завантажилась — теж перемір (місце під неї більше не потрібне)', async () => {
    const w = render(POLTAVA)
    laidOut(w)
    await flushPromises()
    const before = (w.emitted('request-height') ?? []).length
    const flow = w.find('.history-card__flow').element as HTMLElement
    flow.getBoundingClientRect = () => ({ height: 300 } as DOMRect)
    await w.find('.history-card__image').trigger('error')
    await flushPromises()
    expect((w.emitted('request-height') ?? []).length).toBe(before + 1)
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


describe('HistoryCard · «хто це» і «чому тут» (2026-09-22)', () => {
  it('lead — під назвою, факти лишаються', () => {
    const w = render({ ...POLTAVA, lead: 'Полтавська битва — битва Великої Північної війни.' })
    const heading = w.find('.history-card__heading').element
    const lead = w.find('.history-card__lead')
    expect(lead.text()).toBe('Полтавська битва — битва Великої Північної війни.')
    expect(heading.nextElementSibling).toBe(lead.element)
    expect(w.find('.history-card__fields').exists()).toBe(true)
  })

  it('немає lead — рядка немає', () => {
    expect(render(POLTAVA).find('.history-card__lead').exists()).toBe(false)
  })

  it('картка з Next Action каже, чому вона тут', () => {
    const w = render({ ...POLTAVA, relation: { label: 'Родина', of: 'Богдан Хмельницький', role: 'син' } })
    expect(w.find('.history-card__relation').text()).toBe('↳ Родина · Богдан Хмельницький (син)')
  })

  it('без ролі — лише дія і джерело', () => {
    const w = render({ ...POLTAVA, relation: { label: 'Сторони битви', of: 'Полтавська битва' } })
    expect(w.find('.history-card__relation').text()).toBe('↳ Сторони битви · Полтавська битва')
  })
})


describe('HistoryCard · вид «Держава» (polity)', () => {
  const RZECZPOSPOLITA: Partial<HistoryCardData> = {
    variant: 'polity',
    title: 'Річ Посполита',
    primary: [
      { label: 'Роки існування', status: 'verified', total: 1,
        values: [{ label: '11 червня 1569 — 24 жовтня 1795' }] },
      { label: 'Столиця', status: 'verified', total: 3,
        values: [{ label: 'Краків' }, { label: 'Варшава' }, { label: 'Вільнюс' }] },
    ],
    content_language: 'uk',
  }

  it('має власний підпис у шапці — «Держава», а не «Пам\'ятка» чи «Особа»', () => {
    expect(render(RZECZPOSPOLITA).find('.history-card__badge').text()).toBe('Держава')
  })

  it('англійська картка — «State»', () => {
    expect(render({ ...RZECZPOSPOLITA, content_language: 'en' })
      .find('.history-card__badge').text()).toBe('State')
  })

  it('кілька столиць — звичайні значення без бейджа розбіжності', () => {
    const w = render(RZECZPOSPOLITA)
    expect(w.text()).toContain('Краків')
    expect(w.find('.history-card__mixed').exists()).toBe(false)
  })

  it('кожен вид, який пропускає санітайзер, має свій підпис у рендерері', () => {
    // Розрив між цими двома списками й перетворив би державу на «Особу».
    const badges = HISTORY_VARIANTS.map(variant =>
      render({ variant: variant as HistoryCardData['variant'], title: 'X', primary: [] })
        .find('.history-card__badge').text())
    expect(new Set(badges).size).toBe(HISTORY_VARIANTS.length)
    expect(HISTORY_VARIANTS).toContain('polity')
  })
})


describe('HistoryCard · що показати далі (Next Actions V1)', () => {
  // Список дій — НЕ стан картки (слово власника 2026-09-21): у даних лише
  // entity_ref, а кнопки жива картка питає через loadActions.
  const CARD: Partial<HistoryCardData> = {
    ...POLTAVA,
    entity_ref: { provider: 'wikidata', id: 'Q152486' },
  }
  const ACTIONS = [
    { id: 'history.context', label: 'Передумови й наслідки' },
    { id: 'history.related', label: 'Сторони битви' },
    { id: 'history.map', label: 'Де це сталося' },
  ]
  const loader = (list = ACTIONS) => vi.fn(async () => list)

  it('кнопки — рівно ті, що повернув бекенд, у тому ж порядку', async () => {
    const load = loader()
    const w = render(CARD, true, { loadActions: load })
    await flushPromises()
    // 2026-10-06: другим аргументом — вид картки (бекенд «Територію» за даними не впізнає)
    expect(load).toHaveBeenCalledWith({ provider: 'wikidata', id: 'Q152486' }, 'event')
    expect(w.findAll('.history-card__action').map(b => b.text()))
      .toEqual(['Передумови й наслідки', 'Сторони битви', 'Де це сталося'])
  })

  it('клік просить виконати дію — картка сама нічого не будує', async () => {
    const w = render(CARD, true, { loadActions: loader() })
    await flushPromises()
    await w.findAll('.history-card__action')[1].trigger('click')
    expect(w.emitted('run-action')![0]).toEqual([{ id: 'history.related', label: 'Сторони битви' }])
  })

  it('⚠️ нова функція loadActions і нова висота НЕ скидають кнопки (прод 2026-09-22)', async () => {
    // Шар оверлеїв перераховує ctx на кожен asset_update. Картка скидала рядок
    // кнопок на кожну нову функцію → висота 406↔362 → 2952 asset_update.
    const first = loader()
    const w = render(CARD, true, { loadActions: first })
    await flushPromises()
    const second = loader()
    const grown = { ...w.props('asset'), h: 406 }
    await w.setProps({ loadActions: second, asset: grown })
    await flushPromises()
    expect(first).toHaveBeenCalledTimes(1)
    expect(second).not.toHaveBeenCalled()
    expect(w.findAll('.history-card__action')).toHaveLength(3)
  })

  it('немає кому спитати (Replay, учень) — ні кнопок, ні запиту', async () => {
    const w = render(CARD, true, {})
    await flushPromises()
    expect(w.find('.history-card__actions').exists()).toBe(false)
  })

  it('список, що лишився в даних старої картки, ігнорується', async () => {
    const stale = { ...CARD, next_actions: ACTIONS } as Partial<HistoryCardData>
    const w = render(stale, true, { loadActions: loader([]) })
    await flushPromises()
    expect(w.find('.history-card__actions').exists()).toBe(false)
  })

  it('без entity_ref запиту немає', async () => {
    const load = loader()
    render(POLTAVA, true, { loadActions: load })
    await flushPromises()
    expect(load).not.toHaveBeenCalled()
  })

  it('під олівцем кнопок немає', async () => {
    const w = render(CARD, false, { loadActions: loader() })
    await flushPromises()
    expect(w.find('.history-card__actions').exists()).toBe(false)
  })

  it('немає даних — немає кнопки: жодних вимкнених заглушок', async () => {
    const w = render(CARD, true, { loadActions: loader([]) })
    await flushPromises()
    expect(w.find('.history-card__actions').exists()).toBe(false)
    expect(w.find('.history-card__action[disabled]').exists()).toBe(false)
  })
})

describe('HistoryCard · вид «Територія» (2026-10-06)', () => {
  const VILNA: Partial<HistoryCardData> = {
    variant: 'territory',
    title: 'Віленське воєводство',
    primary: [
      { label: 'Роки існування', status: 'verified', total: 1, values: [{ label: '1413 — 1795' }] },
      { label: 'Центр', status: 'verified', total: 1, values: [{ label: 'Вільнюс' }] },
    ],
    relation: { label: 'Складові', of: 'Велике князівство Литовське' },
    entity_ref: { provider: 'wikidata', id: 'Q2347932' },
    content_language: 'uk',
  }

  it('у шапці — «Територія» (не «Особа»: санітайзер її пропускає), англійською — «Territory»', () => {
    expect(render(VILNA).find('.history-card__badge').text()).toBe('Територія')
    expect(render({ ...VILNA, content_language: 'en' }).find('.history-card__badge').text()).toBe('Territory')
    expect(HISTORY_VARIANTS).toContain('territory')
  })

  it('дії питає з видом картки — бекенд сам «Територію» не впізнає', async () => {
    const load = vi.fn(async () => [{ id: 'history.related', label: 'Складові' }])
    const w = render(VILNA, true, { loadActions: load })
    await flushPromises()
    expect(load).toHaveBeenCalledWith({ provider: 'wikidata', id: 'Q2347932' }, 'territory')
    expect(w.findAll('.history-card__action').map((b) => b.text())).toEqual(['Складові'])
  })
})
