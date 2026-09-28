/**
 * «📋 Сценарій» на телефоні — LAW §9 v1.15, ТЗ TZ_REMOTE_SCENARIO_2026-09-28 §2, §5.
 *
 * ЧОМУ ЦЕЙ ТЕСТ ІСНУЄ
 * Телефон лише показує стан від ноутбука й шле намір кнопок; вирішує ноутбук. Тож
 * зламатись непомітно тут можуть три речі:
 *
 *   INV-SCN-P1  розбір `scenario` — дзеркало сервера (`_validate_remote_scenario`):
 *               зіпсоване поле відкидається ЦІЛИМ, решта стану (сторінки) лишається;
 *               поле не свого виду (гучність у PDF) — теж зіпсоване поле
 *   INV-SCN-P2  кнопки — лише в об'єктів сторінки, що на екрані; до інших — «Відкрити»;
 *               вимкнена кнопка лишається на місці й пояснює чому (вид Б)
 *   INV-SCN-P3  «📋 Сценарій · N» — лише за caps ∋ 'scenario' (старий ноутбук — кнопки
 *               немає, на відміну від фото й відео); N = 0 — вимкнена з причиною;
 *               відкриває аркуш тим самим механізмом, що «Фото» й «Відео»
 *
 * Тексти — зі справжнього uk.json: заодно перевіряємо, що ключі існують.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { nextTick, ref } from 'vue'
import { flushPromises, mount } from '@vue/test-utils'
import { createI18n } from 'vue-i18n'
import uk from '../../../i18n/locales/uk.json'
import { derivePair } from '../remote/remotePair'

// ── Підміни для WBRemoteView (як у WBRemoteView.v2.spec.ts); розбір — справжній ──
const SID = '4ba7fff3-9452-4c42-9ff9-04415ff25d90'
const PAIR = derivePair(SID)
const channelState = ref<'idle' | 'connecting' | 'connected' | 'reconnecting' | 'disconnected' | 'unavailable'>('idle')
const send = vi.fn((_data: Record<string, unknown>) => true)
let onStateCb: ((s: any) => void) | null = null
let realChannel = false

vi.mock('../composables/usePresence', () => ({
  getWsBaseUrl: () => 'wss://api.example.test',
  isPresenceAvailable: () => true,
  _getFreshTokenAsync: async () => 'tok',
}))
vi.mock('../composables/useRemoteChannel', async (importOriginal) => {
  const actual = await importOriginal<any>()
  return {
    ...actual,
    useRemoteChannel: (opts: any) => {
      if (realChannel) return actual.useRemoteChannel(opts)
      onStateCb = opts.onState
      return {
        state: channelState, lastError: ref(null), sessionId: ref(null),
        connect: vi.fn(async () => { channelState.value = 'connected' }), disconnect: vi.fn(), retry: vi.fn(), send,
      }
    },
  }
})
vi.mock('../composables/usePushToTalk', () => ({
  usePushToTalk: () => ({ supported: true, listening: ref(false), press: vi.fn(), release: vi.fn() }),
}))
vi.mock('@/modules/auth/store/authStore', () => ({ useAuthStore: () => ({ user: { email: 't@m4sh.local' }, forceLogout: vi.fn() }) }))
vi.mock('@/modules/auth/api/authApi', () => ({ default: { logout: vi.fn() } }))
vi.mock('@/utils/telemetryAgent', () => ({ trackEvent: vi.fn() }))
vi.mock('@/modules/intent/corridors/corridorApi', () => ({ fetchCorridorRegistry: vi.fn(async () => null) }))
vi.mock('../api/winterboardApi', () => ({
  winterboardApi: {
    getActiveRemoteSession: vi.fn(async () => ({ session_id: SID, name: 'Урок', ts: 1 })),
    searchVideos: vi.fn(), lookupVideo: vi.fn(),
  },
}))

import { parseRemoteScenario, useRemoteChannel } from '../composables/useRemoteChannel'
import RemoteScenarioSheet from '../components/remote/RemoteScenarioSheet.vue'
import WBRemoteView from '../views/WBRemoteView.vue'

const R = (uk as any).winterboard.remote
const S = R.scenario
const fill = (s: string, vars: Record<string, string | number>) => s.replace(/\{(\w+)\}/g, (_, k) => String(vars[k]))
const i18n = () => createI18n({ legacy: false, locale: 'uk', fallbackLocale: 'uk', messages: { uk } as never })

/** Те саме, що VALID_ITEMS у BE test_remote_scenario.py — одна форма з обох боків. */
const ITEMS: Array<Record<string, unknown>> = [
  { object_id: 'yt-1', kind: 'video', title: 'Теорема Піфагора', page_index: 0, minimized: false },
  { object_id: 'vid-2', kind: 'video', title: 'Досліди з маятником', page_index: 1, minimized: false, state: 'playing', volume: 60 },
  { object_id: 'aud-3', kind: 'audio', title: '', page_index: 1, minimized: true, state: 'paused', volume: 100 },
  { object_id: 'yt-4', kind: 'video', title: 'Приватне', page_index: 1, minimized: false, state: 'error', error: 'not_embeddable' },
  { object_id: 'doc-5', kind: 'presentation', title: 'Проєкт 7-Б', page_index: 2, minimized: false },
  { object_id: 'doc-6', kind: 'pdf', title: 'Умова', page_index: 1, minimized: false, doc_page: 2, doc_pages: 12 },
  { object_id: 'doc-7', kind: 'document', title: 'Реферат', page_index: 1, minimized: false, doc_page: 0, doc_pages: 1 },
]
const broken = (patch: Record<string, unknown>, base = ITEMS[1]) => ({ focus_id: null, items: [{ ...base, ...patch }] })
const without = (key: string, base: Record<string, unknown>) => Object.fromEntries(Object.entries(base).filter(([k]) => k !== key))

// ═════════════════════════════════════════════════════════════════════════════
describe('INV-SCN-P1 · розбір scenario — дзеркало сервера', () => {
  it('валідне поле приходить у нашій формі, порядок — як прислав ноутбук', () => {
    const out = parseRemoteScenario({ focus_id: 'doc-5', items: ITEMS })!
    expect(out.focusId).toBe('doc-5')
    expect(out.items.map((i) => i.objectId)).toEqual(['yt-1', 'vid-2', 'aud-3', 'yt-4', 'doc-5', 'doc-6', 'doc-7'])
    expect(out.items[1]).toEqual({ objectId: 'vid-2', kind: 'video', title: 'Досліди з маятником', pageIndex: 1, minimized: false, state: 'playing', volume: 60 })
    expect(out.items[3]).toMatchObject({ state: 'error', error: 'not_embeddable' })
    expect(out.items[5]).toEqual({ objectId: 'doc-6', kind: 'pdf', title: 'Умова', pageIndex: 1, minimized: false, docPage: 2, docPages: 12 })
    // живих полів немає — їх і немає (не undefined-ключі)
    expect(Object.keys(out.items[0])).toEqual(['objectId', 'kind', 'title', 'pageIndex', 'minimized'])
  })

  it('без показу — focusId null; без назви — порожня; довга назва обрізається, а не відкидає поле', () => {
    expect(parseRemoteScenario({ items: [] })).toEqual({ focusId: null, items: [] })
    expect(parseRemoteScenario({ focus_id: null, items: [without('title', ITEMS[0])] })!.items[0].title).toBe('')
    expect(parseRemoteScenario({ focus_id: null, items: [{ ...ITEMS[0], title: 'т'.repeat(250) }] })!.items[0].title).toBe('т'.repeat(200))
  })

  it('null у необов\'язковому полі = поля немає (як `is not None` на сервері)', () => {
    const out = parseRemoteScenario({ focus_id: null, items: [
      { ...ITEMS[1], error: null, doc_page: null, doc_pages: null },
      { ...ITEMS[5], state: null, volume: null },
    ] })!
    expect(out.items[0]).toEqual({ objectId: 'vid-2', kind: 'video', title: 'Досліди з маятником', pageIndex: 1, minimized: false, state: 'playing', volume: 60 })
    expect(out.items[1]).toMatchObject({ docPage: 2, docPages: 12 })
    expect(out.items[1]).not.toHaveProperty('state')
  })

  it('50 об\'єктів — межа, ще приймається', () => {
    const items = Array.from({ length: 50 }, (_, i) => ({ ...ITEMS[0], object_id: `o-${i}` }))
    expect(parseRemoteScenario({ focus_id: null, items })!.items).toHaveLength(50)
  })

  it.each([
    ['не об\'єкт', 'broken'],
    ['список замість об\'єкта', ['items']],
    ['items не список', { focus_id: null, items: 'x' }],
    ['без items', { focus_id: null }],
    ['51 об\'єкт', { focus_id: null, items: Array.from({ length: 51 }, (_, i) => ({ ...ITEMS[0], object_id: `o-${i}` })) }],
    ['focus_id порожній', { focus_id: '', items: [] }],
    ['focus_id 65 символів', { focus_id: 'x'.repeat(65), items: [] }],
    ['focus_id число', { focus_id: 5, items: [] }],
    ['об\'єкт — рядок', { focus_id: null, items: ['x'] }],
    ['невідомий kind', broken({ kind: 'image' })],
    ['провайдер замість виду', broken({ kind: 'youtube' })],
    ['kind — список', broken({ kind: ['video'] })],
    ['object_id порожній', broken({ object_id: '' })],
    ['object_id 65 символів', broken({ object_id: 'x'.repeat(65) })],
    ['title null', broken({ title: null })],
    ['page_index від\'ємний', broken({ page_index: -1 })],
    ['page_index boolean', broken({ page_index: true })],
    ['page_index дробовий', broken({ page_index: 1.5 })],
    ['page_index понад межу', broken({ page_index: 10001 })],
    ['без minimized', { focus_id: null, items: [without('minimized', ITEMS[1])] }],
    ['minimized не boolean', broken({ minimized: 'yes' })],
    ['невідомий state', broken({ state: 'exploded' })],
    ['error без state error', broken({ error: 'not_found' })],
    ['невідомий error', broken({ state: 'error', error: 'hacked' })],
    ['volume 101', broken({ volume: 101 })],
    ['volume −1', broken({ volume: -1 })],
    ['volume boolean', broken({ volume: true })],
    ['volume дробовий', broken({ volume: 60.5 })],
    ['сторінка документа у відео', broken({ doc_page: 0, doc_pages: 3 })],
    ['гучність у PDF', broken({ volume: 50 }, ITEMS[5])],
    ['відтворення в PDF', broken({ state: 'playing' }, ITEMS[5])],
    ['doc_page == doc_pages', broken({ doc_page: 12 }, ITEMS[5])],
    ['doc_page від\'ємна', broken({ doc_page: -1 }, ITEMS[5])],
    ['doc_pages 0', broken({ doc_pages: 0, doc_page: 0 }, ITEMS[5])],
    ['doc_page без doc_pages', { focus_id: null, items: [without('doc_pages', ITEMS[5])] }],
    ['doc_pages понад межу', broken({ doc_pages: 10001 }, ITEMS[5])],
  ])('зіпсоване поле відкидається цілим: %s', (_name, raw) => {
    expect(parseRemoteScenario(raw)).toBeUndefined()
  })

  describe('канал: зіпсоване поле не ламає стан', () => {
    class FakeWS {
      static OPEN = 1
      static last: FakeWS | null = null
      readyState = 1
      onopen: (() => void) | null = null
      onclose: ((e: { code: number }) => void) | null = null
      onerror: (() => void) | null = null
      onmessage: ((e: { data: string }) => void) | null = null
      constructor() { FakeWS.last = this }
      close() { /* noop */ }
      send() { /* noop */ }
    }
    beforeEach(() => { realChannel = true; vi.stubGlobal('WebSocket', FakeWS as unknown as typeof WebSocket) })
    afterEach(() => { realChannel = false; vi.unstubAllGlobals() })

    it('валідний scenario доходить до пульта; зіпсований — зникає, сторінки й caps лишаються', async () => {
      const states: any[] = []
      const ch = useRemoteChannel({ onState: (s) => states.push(s) })
      await ch.connect(SID)
      const ws = FakeWS.last!
      ws.onopen!()
      const msg = (scenario: unknown) => ws.onmessage!({ data: JSON.stringify({
        type: 'remote.state', pair: PAIR, client_id: 'l', page_index: 1, page_count: 5, caps: ['photo', 'video', 'scenario'], scenario,
      }) })
      msg({ focus_id: null, items: ITEMS })
      msg({ focus_id: null, items: [{ ...ITEMS[5], volume: 50 }] })
      expect(states[0].scenario.items).toHaveLength(7)
      expect(states[1]).not.toHaveProperty('scenario')
      expect(states[1]).toMatchObject({ pageIndex: 1, pageCount: 5, caps: ['photo', 'video', 'scenario'] })
    })
  })
})

// ═════════════════════════════════════════════════════════════════════════════
describe('INV-SCN-P2 · аркуш «Сценарій»', () => {
  const parsed = (items: Array<Record<string, unknown>> = ITEMS, focus: string | null = null) => parseRemoteScenario({ focus_id: focus, items })!
  const mountSheet = (props: Record<string, unknown> = {}) => mount(RemoteScenarioSheet, {
    props: { scenario: parsed(), pageIndex: 1, ready: true, open: false, ...props },
    global: { plugins: [i18n()] },
  })
  const sent = (w: any) => ((w.emitted('send') ?? []) as Array<[string, Record<string, unknown>]>)
  const lastSent = (w: any) => { const all = sent(w); return all[all.length - 1] }
  const inItem = (w: any, id: string) => w.find(`[data-testid="scenario-item-${id}"]`)
  /** Тап по вимкненій кнопці: її ловить обгортка (у кнопки pointer-events: none) */
  const tapSlot = async (btn: any) => { (btn.element.parentElement as HTMLElement).click(); await nextTick() }

  afterEach(() => { vi.useRealTimers() })

  it('групи за сторінками в порядку сторінок; поточна — «на екрані», решта — «Відкрити» → page.goto', async () => {
    const w = mountSheet({ scenario: parsed([ITEMS[4], ITEMS[1], ITEMS[0]]) })
    const groups = w.findAll('[data-testid^="scenario-page-"]')
    expect(groups.map((g) => g.attributes('data-testid'))).toEqual(['scenario-page-0', 'scenario-page-1', 'scenario-page-2'])
    expect(groups[1].find('.wb-scn__page-name').text()).toBe(`${fill(S.page, { n: 2 })} · ${S.onScreen}`)
    expect(groups[1].classes()).toContain('wb-scn__group--current')
    expect(groups[1].find('.wb-scn__open').exists()).toBe(false)

    await w.find('[data-testid="scenario-open-2"]').trigger('click')
    expect(lastSent(w)).toEqual(['page.goto', { index: 2 }])
    // тап по назві об'єкта не на екрані — те саме, що «Відкрити»
    await inItem(w, 'yt-1').find('.wb-scn__name--link').trigger('click')
    expect(lastSent(w)).toEqual(['page.goto', { index: 0 }])
  })

  it('плитки: непарні й парні сторінки — різні класи (за номером сторінки); об\'єкти в плитці чергуються', () => {
    // Власник 2026-09-28: «непарні — один колір, парні — інші… так само і список на одній дошці»
    const w = mountSheet({ scenario: parsed([ITEMS[0], ITEMS[1], ITEMS[2], ITEMS[3], ITEMS[4]]), pageIndex: 1 })
    const tone = (pi: number) => w.find(`[data-testid="scenario-page-${pi}"]`).classes()
      .filter((c) => c === 'wb-scn__group--odd' || c === 'wb-scn__group--even')
    expect(tone(0)).toEqual(['wb-scn__group--odd'])     // «Сторінка 1»
    expect(tone(1)).toEqual(['wb-scn__group--even'])    // «Сторінка 2» — на екрані, рамка своя
    expect(tone(2)).toEqual(['wb-scn__group--odd'])     // «Сторінка 3»
    expect(w.find('[data-testid="scenario-page-1"]').classes()).toContain('wb-scn__group--current')
    // стор. 2: відео, аудіо, ще відео — сусідні різного відтінку
    expect(['vid-2', 'aud-3', 'yt-4'].map((id) => inItem(w, id).classes().includes('wb-scn__item--alt'))).toEqual([false, true, false])
  })

  it('об\'єкти сторінки не на екрані — лише значок і назва, без жодної кнопки керування', () => {
    const w = mountSheet({ pageIndex: 2 })
    for (const id of ['vid-2', 'aud-3', 'doc-6']) {
      const it = inItem(w, id)
      expect(it.classes()).toContain('wb-scn__item--dim')
      expect(it.findAll('.wb-scn__btn'), id).toHaveLength(0)
    }
    expect(inItem(w, 'doc-5').findAll('.wb-scn__btn').length).toBeGreaterThan(0)
  })

  it('без назви — вид і номер цього виду в списку; значки за видом', () => {
    const untitled = (kind: string, n: number, page = 1) => ({ object_id: `${kind}-${n}`, kind, title: '', page_index: page, minimized: false })
    const w = mountSheet({ scenario: parsed([
      { ...ITEMS[0], page_index: 1 },            // «Теорема Піфагора» — відео 1 з назвою
      untitled('video', 2), untitled('audio', 1), { ...untitled('video', 3), title: '   ' },
      untitled('presentation', 1), untitled('pdf', 1), untitled('document', 1),
    ]) })
    const label = (id: string) => inItem(w, id).find('.wb-scn__title').text()
    expect(label('yt-1')).toBe('Теорема Піфагора')
    expect(label('video-2')).toBe(fill(S.kind.video, { n: 2 }))
    expect(label('video-3')).toBe(fill(S.kind.video, { n: 3 }))
    expect(label('audio-1')).toBe(fill(S.kind.audio, { n: 1 }))
    expect(label('presentation-1')).toBe(fill(S.kind.presentation, { n: 1 }))
    expect(label('pdf-1')).toBe(fill(S.kind.pdf, { n: 1 }))
    expect(label('document-1')).toBe(fill(S.kind.document, { n: 1 }))
    const icon = (id: string) => inItem(w, id).find('.wb-scn__icon').text()
    expect([icon('video-2'), icon('audio-1'), icon('presentation-1'), icon('pdf-1'), icon('document-1')]).toEqual(['🎬', '🎵', '📊', '📄', '📄'])
  })

  it('відео на екрані: «грає · гучність 60 %»; ▶ ⏸ 🔉 🔊 ⛶ — шлють намір для свого object_id', async () => {
    const w = mountSheet()
    const v = inItem(w, 'vid-2')
    expect(v.find('[data-testid="scenario-status"]').text()).toBe(`● ${R.video.state.playing} · ${fill(S.volume, { v: 60 })}`) // «●» — грає (власник 2026-09-28)
    for (const [tid, cmd, args] of [
      ['scenario-play', 'video.play', { object_id: 'vid-2' }],
      ['scenario-pause', 'video.pause', { object_id: 'vid-2' }],
      ['scenario-quieter', 'video.volume', { object_id: 'vid-2', delta: -1 }],
      ['scenario-louder', 'video.volume', { object_id: 'vid-2', delta: 1 }],
      ['scenario-focus', 'view.focus', { object_id: 'vid-2' }],
      ['scenario-minimize', 'card.minimize', { object_id: 'vid-2' }],
    ] as const) {
      await v.find(`[data-testid="${tid}"]`).trigger('click')
      expect(lastSent(w), tid).toEqual([cmd, args])
    }
  })

  it('поки об\'єкт на весь екран — замість «⛶ На весь екран» «▭ Уся сторінка» (view.page); в інших — ⛶', async () => {
    const w = mountSheet({ scenario: parsed(ITEMS, 'vid-2') })
    const v = inItem(w, 'vid-2')
    expect(v.find('[data-testid="scenario-focus"]').exists()).toBe(false)
    const whole = v.find('[data-testid="scenario-whole-page"]')
    expect(whole.text()).toContain(R.fitPage)
    await whole.trigger('click')
    expect(lastSent(w)).toEqual(['view.page', {}])
    expect(inItem(w, 'doc-6').find('[data-testid="scenario-focus"]').exists()).toBe(true)
  })

  it('аудіо: ▶ ⏸ 🔉 🔊 і лише «— Згорнути», без «На весь екран»', () => {
    const w = mountSheet({ scenario: parsed([{ ...ITEMS[2], minimized: false }]) })
    const a = inItem(w, 'aud-3')
    expect(a.findAll('.wb-scn__btn').map((b) => b.attributes('data-testid'))).toEqual([
      'scenario-play', 'scenario-pause', 'scenario-quieter', 'scenario-louder', 'scenario-minimize',
    ])
  })

  it('згорнутий — «згорнуто» і лише «↩ Повернути» (card.restore)', async () => {
    const w = mountSheet()
    const a = inItem(w, 'aud-3')
    expect(a.find('[data-testid="scenario-status"]').text()).toBe(S.minimized)
    expect(a.findAll('.wb-scn__btn').map((b) => b.attributes('data-testid'))).toEqual(['scenario-restore'])
    await a.find('[data-testid="scenario-restore"]').trigger('click')
    expect(lastSent(w)).toEqual(['card.restore', { object_id: 'aud-3' }])
  })

  it.each([
    ['0 % — 🔉 вимкнена', 0, 'scenario-quieter', 'whyMuted', 'scenario-louder'],
    ['100 % — 🔊 вимкнена', 100, 'scenario-louder', 'whyMax', 'scenario-quieter'],
  ])('гучність %s, тап пояснює; сусідня працює', async (_n, volume, off, why, on) => {
    const w = mountSheet({ scenario: parsed([{ ...ITEMS[1], volume }]) })
    const v = inItem(w, 'vid-2')
    expect((v.find(`[data-testid="${off}"]`).element as HTMLButtonElement).disabled).toBe(true)
    expect((v.find(`[data-testid="${on}"]`).element as HTMLButtonElement).disabled).toBe(false)
    await tapSlot(v.find(`[data-testid="${off}"]`))
    expect(v.find('[data-testid="scenario-why"]').text()).toBe(S[why])
    expect(sent(w).some(([cmd]) => cmd === 'video.volume')).toBe(false)
  })

  it('гучність ще невідома (плеєр не завантажився) — 🔉 і 🔊 вимкнені, причина одна', async () => {
    const w = mountSheet({ scenario: parsed([without('volume', ITEMS[1])]) })
    const v = inItem(w, 'vid-2')
    expect(v.find('[data-testid="scenario-status"]').text()).toBe(`● ${R.video.state.playing}`) // «●» — грає (власник 2026-09-28)
    for (const tid of ['scenario-quieter', 'scenario-louder']) {
      expect((v.find(`[data-testid="${tid}"]`).element as HTMLButtonElement).disabled).toBe(true)
      await tapSlot(v.find(`[data-testid="${tid}"]`))
      expect(v.find('[data-testid="scenario-why"]').text()).toBe(S.whyNoVolume)
    }
  })

  it('заблоковано браузером і помилка плеєра — ті самі тексти, що в зоні D, з позначкою', () => {
    const w = mountSheet({ scenario: parsed([
      { ...ITEMS[1], state: 'blocked' },
      ITEMS[3],
    ]) })
    const blocked = inItem(w, 'vid-2').find('[data-testid="scenario-status"]')
    expect(blocked.text()).toBe(`${R.video.blocked} · ${fill(S.volume, { v: 60 })}`)
    expect(blocked.classes()).toContain('wb-scn__status--warn')
    expect(inItem(w, 'yt-4').find('[data-testid="scenario-status"]').text()).toBe(R.video.playerError.not_embeddable)
  })

  it('документ: «Слайд 3 / 12» і «слайд 3 з 12»; PDF — «Стор.»; ◀ ▶ шлють doc.page ∓1', async () => {
    const w = mountSheet({ scenario: parsed([{ ...ITEMS[4], page_index: 1, doc_page: 2, doc_pages: 12 }, ITEMS[5]]) })
    const p = inItem(w, 'doc-5')
    expect(p.find('[data-testid="scenario-doc-label"]').text()).toBe(fill(S.slideShort, { n: 3, total: 12 }))
    expect(p.find('[data-testid="scenario-status"]').text()).toBe(fill(S.slideOf, { n: 3, total: 12 }))
    expect(inItem(w, 'doc-6').find('[data-testid="scenario-doc-label"]').text()).toBe(fill(S.pageShort, { n: 3, total: 12 }))
    expect(inItem(w, 'doc-6').find('[data-testid="scenario-status"]').text()).toBe(fill(S.pageOf, { n: 3, total: 12 }))
    await p.find('[data-testid="scenario-doc-prev"]').trigger('click')
    expect(lastSent(w)).toEqual(['doc.page', { object_id: 'doc-5', dir: -1 }])
    await p.find('[data-testid="scenario-doc-next"]').trigger('click')
    expect(lastSent(w)).toEqual(['doc.page', { object_id: 'doc-5', dir: 1 }])
  })

  it('документ на межі: ◀ на першій і ▶ на останній вимкнені й пояснюють', async () => {
    const w = mountSheet({ scenario: parsed([
      { ...ITEMS[5], doc_page: 0 },
      { ...ITEMS[5], object_id: 'doc-last', doc_page: 11 },
    ]) })
    const first = inItem(w, 'doc-6')
    expect((first.find('[data-testid="scenario-doc-prev"]').element as HTMLButtonElement).disabled).toBe(true)
    expect((first.find('[data-testid="scenario-doc-next"]').element as HTMLButtonElement).disabled).toBe(false)
    await tapSlot(first.find('[data-testid="scenario-doc-prev"]'))
    expect(first.find('[data-testid="scenario-why"]').text()).toBe(S.whyFirstDocPage)
    const last = inItem(w, 'doc-last')
    expect((last.find('[data-testid="scenario-doc-next"]').element as HTMLButtonElement).disabled).toBe(true)
    await tapSlot(last.find('[data-testid="scenario-doc-next"]'))
    expect(last.find('[data-testid="scenario-why"]').text()).toBe(S.whyLastDocPage)
    expect(sent(w).some(([cmd]) => cmd === 'doc.page')).toBe(false)
  })

  it('документ, чиї сторінки ноутбук ще не порахував, — без гортання, лише ⛶ і —', () => {
    const w = mountSheet({ scenario: parsed([{ ...without('doc_pages', without('doc_page', ITEMS[5])) }]) })
    const d = inItem(w, 'doc-6')
    expect(d.find('[data-testid="scenario-doc-label"]').exists()).toBe(false)
    expect(d.findAll('.wb-scn__btn').map((b) => b.attributes('data-testid'))).toEqual(['scenario-focus', 'scenario-minimize'])
  })

  it('без зв\'язку з дошкою — кнопки на місці, але вимкнені; тап пояснює «Чекаю дошку…»', async () => {
    const w = mountSheet({ ready: false })
    const v = inItem(w, 'vid-2')
    const btns = v.findAll('.wb-scn__btn')
    expect(btns.length).toBe(6)
    expect(btns.every((b) => (b.element as HTMLButtonElement).disabled)).toBe(true)
    await tapSlot(v.find('[data-testid="scenario-louder"]'))
    expect(v.find('[data-testid="scenario-why"]').text()).toBe(R.waitingBoard)
    expect((w.find('[data-testid="scenario-open-0"]').element as HTMLButtonElement).disabled).toBe(true)
  })

  it('пояснення зникає саме за 2,5 с', async () => {
    vi.useFakeTimers()
    const w = mountSheet({ scenario: parsed([{ ...ITEMS[1], volume: 0 }]) })
    await tapSlot(inItem(w, 'vid-2').find('[data-testid="scenario-quieter"]'))
    expect(w.find('[data-testid="scenario-why"]').exists()).toBe(true)
    vi.advanceTimersByTime(2400); await nextTick()
    expect(w.find('[data-testid="scenario-why"]').exists()).toBe(true)
    vi.advanceTimersByTime(200); await nextTick()
    expect(w.find('[data-testid="scenario-why"]').exists()).toBe(false)
  })

  it('відкриття аркуша прокручує до сторінки «на екрані»', async () => {
    const scrolled: Element[] = []
    const proto = HTMLElement.prototype as any
    const had = 'scrollIntoView' in proto
    const prev = proto.scrollIntoView
    proto.scrollIntoView = function (this: Element) { scrolled.push(this) }
    try {
      const w = mountSheet({ pageIndex: 2 })
      await w.setProps({ open: true })
      await flushPromises()
      expect(scrolled).toHaveLength(1)
      expect((scrolled[0] as HTMLElement).dataset.testid).toBe('scenario-page-2')
    } finally {
      if (had) proto.scrollIntoView = prev
      else delete proto.scrollIntoView
    }
  })

  it('порожній список — один рядок пояснення', () => {
    const w = mountSheet({ scenario: parsed([]) })
    expect(w.find('[data-testid="scenario-empty"]').text()).toBe(S.empty)
  })
  it('▶/⏸ показують стан: «▶ Грає» зелена, «⏸ На паузі» підсвічена, «▶ Запускається…»; решта — звичайні', async () => {
    // Власник 2026-09-28: «вчитель… не бачить, чи воно відтворюється, чи не відтворюється»
    const V = uk.winterboard.remote.video
    const one = (state: string) => parsed([{ object_id: 'vid-2', kind: 'video', title: 'Маятник', page_index: 1, minimized: false, state, volume: 60 }])
    const w = mountSheet({ scenario: one('playing') })
    const play = () => inItem(w, 'vid-2').find('[data-testid="scenario-play"]')
    const pause = () => inItem(w, 'vid-2').find('[data-testid="scenario-pause"]')
    const status = () => inItem(w, 'vid-2').find('[data-testid="scenario-status"]')
    expect(play().classes()).toContain('wb-scn__btn--playing')
    expect(play().text()).toBe(`▶ ${V.state.playing}`)
    expect(play().attributes('aria-pressed')).toBe('true')
    expect(pause().classes()).not.toContain('wb-scn__btn--paused')
    expect(pause().text()).toBe(`⏸ ${S.pause}`)
    expect(status().classes()).toContain('wb-scn__status--playing')
    expect(status().text().startsWith('●')).toBe(true)

    await w.setProps({ scenario: one('paused') })
    expect(play().classes()).not.toContain('wb-scn__btn--playing')
    expect(play().text()).toBe(`▶ ${S.play}`)
    expect(pause().classes()).toContain('wb-scn__btn--paused')
    expect(pause().text()).toBe(`⏸ ${V.state.paused}`)
    expect(pause().attributes('aria-pressed')).toBe('true')
    expect(status().classes()).not.toContain('wb-scn__status--playing')

    await w.setProps({ scenario: one('loading') })
    expect(play().text()).toBe(`▶ ${V.starting}`)
    expect(play().classes()).not.toContain('wb-scn__btn--playing')

    await w.setProps({ scenario: one('idle') })
    expect(play().classes()).not.toContain('wb-scn__btn--playing')
    expect(pause().classes()).not.toContain('wb-scn__btn--paused')
    expect(play().text()).toBe(`▶ ${S.play}`)
    w.unmount()
  })
})

// ═════════════════════════════════════════════════════════════════════════════
describe('INV-SCN-P3 · кнопка «📋 Сценарій» на пульті', () => {
  const mounted: Array<{ unmount: () => void }> = []
  async function connected(extra: Record<string, unknown> = {}) {
    // attachTo: isVisible() бачить display:none лише в документі
    const w = mount(WBRemoteView, { attachTo: document.body, global: { plugins: [i18n()], stubs: { RouterLink: true } } })
    mounted.push(w)
    await flushPromises()
    onStateCb!({ pair: PAIR, clientId: 'l', pageIndex: 1, pageCount: 5, ...extra })
    await nextTick()
    return w
  }
  const state = (extra: Record<string, unknown>) => { onStateCb!({ pair: PAIR, clientId: 'l', pageIndex: 1, pageCount: 5, ...extra }); return nextTick() }
  const CAPS = ['photo', 'video', 'scenario']
  const scenario = () => parseRemoteScenario({ focus_id: null, items: ITEMS })!
  const btn = (w: any) => w.find('[data-testid="open-scenario"]')
  const lastCmd = () => {
    const cmds = send.mock.calls.map((c) => c[0] as any).filter((m) => m.cmd !== 'hello')
    return cmds[cmds.length - 1] ?? null
  }

  beforeEach(() => {
    channelState.value = 'idle'
    send.mockClear()
    onStateCb = null
    try { localStorage.setItem('wb.remote.firstTipSeen', '1') } catch { /* noop */ }
  })
  afterEach(() => { vi.restoreAllMocks(); while (mounted.length) mounted.pop()!.unmount() })

  it('вид А: кнопки немає без caps ∋ scenario — і в класній кімнаті, і зі старим ноутбуком без caps', async () => {
    const w = await connected({ caps: ['photo', 'video'], scenario: scenario() })
    expect(btn(w).exists()).toBe(false)
    await state({ scenario: scenario() })                 // старий ноутбук: caps немає зовсім
    expect(btn(w).exists()).toBe(false)
    expect(w.find('[data-testid="open-photo"]').exists()).toBe(true)   // фото й відео — як до v2
    await state({ caps: CAPS, scenario: scenario() })
    expect(btn(w).exists()).toBe(true)
  })

  it('стоїть одразу під «+ Фото / + Відео» і над «– Згорнути вікно Інтегралика»; ядро не зсунулось', async () => {
    const w = await connected({ caps: CAPS, scenario: scenario() })
    const slot = w.find('[data-testid="scenario-slot"]').element as HTMLElement
    expect(slot.previousElementSibling?.getAttribute('data-testid')).toBe('add-row')
    expect(slot.nextElementSibling?.getAttribute('data-testid')).toBe('assistant-minimize')
    expect(w.findAll('.wb-remote__btn')).toHaveLength(4)         // ◀ ▶ «Нова сторінка» «Відмінити»
    // ядро — вище за нову кнопку в документі, «Говорю» — нижче
    const grid = w.find('.wb-remote__grid').element
    expect(grid.compareDocumentPosition(slot) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    expect(slot.compareDocumentPosition(w.find('.wb-remote__talk').element) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
  })

  it('N = 0 — на місці, вимкнена; тап пояснює одним рядком і нічого не шле', async () => {
    const w = await connected({ caps: CAPS })
    expect(btn(w).text().replace(/\s+/g, ' ')).toContain(`${S.button} · 0`)
    expect((btn(w).element as HTMLButtonElement).disabled).toBe(true)
    await w.find('[data-testid="scenario-slot"]').trigger('click')
    expect(w.find('[data-testid="scenario-why-empty"]').text()).toBe(S.empty)
    expect(w.find('[data-testid="remote-sheet"]').isVisible()).toBe(false)
    expect(lastCmd()).toBeNull()
  })

  it('без зв\'язку — вимкнена, тап пояснює «Чекаю дошку…»', async () => {
    const w = await connected({ caps: CAPS, scenario: scenario() })
    channelState.value = 'reconnecting'
    await nextTick()
    expect((btn(w).element as HTMLButtonElement).disabled).toBe(true)
    await w.find('[data-testid="scenario-slot"]').trigger('click')
    expect(w.find('[data-testid="scenario-why-empty"]').text()).toBe(R.waitingBoard)
  })

  it('«📋 Сценарій · 7» відкриває аркуш тим самим механізмом: заголовок, «×», «Назад»', async () => {
    const push = vi.spyOn(window.history, 'pushState')
    vi.spyOn(window.history, 'back').mockImplementation(() => {})
    const w = await connected({ caps: CAPS, scenario: scenario() })
    expect(btn(w).text().replace(/\s+/g, ' ')).toContain(`${S.button} · 7`)
    const sheet = w.find('[data-testid="remote-sheet"]')
    expect(sheet.isVisible()).toBe(false)
    await btn(w).trigger('click')
    expect(sheet.isVisible()).toBe(true)
    expect(sheet.attributes('data-sheet')).toBe('scenario')
    expect(sheet.text()).toContain(S.title)
    expect(w.find('[data-testid="scenario-sheet"]').isVisible()).toBe(true)
    expect(w.find('[data-testid="remote-photo"]').isVisible()).toBe(false)
    expect(push).toHaveBeenCalledTimes(1)
    await w.find('[data-testid="sheet-close"]').trigger('click')
    expect(sheet.isVisible()).toBe(false)
    await btn(w).trigger('click')
    window.dispatchEvent(new PopStateEvent('popstate'))
    await nextTick()
    expect(sheet.isVisible()).toBe(false)
  })

  it('кнопка аркуша шле намір через канал пульта: remote.command з pair', async () => {
    const w = await connected({ caps: CAPS, scenario: scenario() })
    await btn(w).trigger('click')
    send.mockClear()
    await w.find('[data-testid="scenario-item-vid-2"] [data-testid="scenario-louder"]').trigger('click')
    expect(send).toHaveBeenCalledTimes(1)
    expect(lastCmd()).toMatchObject({ type: 'remote.command', pair: PAIR, cmd: 'video.volume', args: { object_id: 'vid-2', delta: 1 } })
  })

  it('стан від ноутбука живе під відкритим аркушем: N і рядок стану оновлюються', async () => {
    const w = await connected({ caps: CAPS, scenario: scenario() })
    await btn(w).trigger('click')
    const next = parseRemoteScenario({ focus_id: null, items: [{ ...ITEMS[1], state: 'paused', volume: 70 }] })!
    await state({ caps: CAPS, scenario: next })
    expect(btn(w).text().replace(/\s+/g, ' ')).toContain(`${S.button} · 1`)
    expect(w.find('[data-testid="scenario-item-vid-2"] [data-testid="scenario-status"]').text())
      .toBe(`${R.video.state.paused} · ${fill(S.volume, { v: 70 })}`)
  })

  it('дошка перестала вміти «Сценарій» — кнопка зникає, відкритий аркуш закривається', async () => {
    vi.spyOn(window.history, 'back').mockImplementation(() => {})
    const w = await connected({ caps: CAPS, scenario: scenario() })
    await btn(w).trigger('click')
    expect(w.find('[data-testid="remote-sheet"]').isVisible()).toBe(true)
    await state({ caps: ['photo', 'video'] })
    await nextTick()
    expect(btn(w).exists()).toBe(false)
    expect(w.find('[data-testid="remote-sheet"]').isVisible()).toBe(false)
  })
})
