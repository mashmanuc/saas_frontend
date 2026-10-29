// LAW §9 v1.55 · диктант на пульті не висить (власник 2026-10-25: «25 жовтня ⏎ класна робота» посередині —
// «Сервер відхилив команду», а вікно диктанту «тупо стоїть "Пишу на дошці"»). Enter у полі — новий рядок; відмова
// сервера чи мовчання ноутбука 8 с — «Дошка не прийняла речення», кнопка знову доступна; відповідь ноутбука вчасно —
// жодного «не прийняла». Канал, мікрофон, API і authStore підмінені так само, як у WBRemoteView.v2.spec.ts.

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { ref, nextTick } from 'vue'
import { mount, flushPromises } from '@vue/test-utils'
import { createI18n } from 'vue-i18n'
import { derivePair } from '../remote/remotePair'

const SID = '4ba7fff3-9452-4c42-9ff9-04415ff25d90'
const PAIR = derivePair(SID)

const channelState = ref<'idle' | 'connecting' | 'connected' | 'reconnecting' | 'disconnected' | 'unavailable'>('idle')
const send = vi.fn((_data: Record<string, unknown>) => true)
const connect = vi.fn(async () => { channelState.value = 'connected' })
const disconnect = vi.fn(() => { channelState.value = 'disconnected' })
let onStateCb: ((s: any) => void) | null = null
let onErrorCb: ((code: string) => void) | null = null

vi.mock('../composables/useRemoteChannel', async (importOriginal) => {
  const actual = await importOriginal<any>()
  return {
    ...actual,
    useRemoteChannel: (opts: any) => {
      onStateCb = opts.onState
      onErrorCb = opts.onError
      return { state: channelState, lastError: ref(null), sessionId: ref(null), connect, disconnect, retry: vi.fn(), send }
    },
  }
})
vi.mock('../composables/usePushToTalk', () => ({
  usePushToTalk: () => ({ supported: true, listening: ref(false), press: vi.fn(), release: vi.fn() }),
}))
// v1.70: слухання фраза за фразою — підмінене; `heard` — фраза, яку телефон почув одразу після «Говорити»
// (v1.73: віддає її в `onPhrase` тієї ж миті), `reason` — чому телефон закінчив (null — зупинив учитель)
const voice = vi.hoisted(() => ({ heard: '', lang: '', reason: null as string | null }))
vi.mock('../composables/usePhraseDictation', async () => {
  const { ref: vref } = await import('vue')
  return {
    usePhraseDictation: (opts: { onPhrase?: (phrase: string) => void; onFinish: (text: string, reason: string | null) => void }) => {
      const listening = vref(false)
      const text = vref('')
      return {
        supported: true,
        listening,
        text,
        start: (lang: string) => {
          listening.value = true; voice.lang = lang; text.value = voice.heard
          if (voice.heard) opts.onPhrase?.(voice.heard)
        },
        stop: () => { listening.value = false; opts.onFinish(text.value, voice.reason) },
      }
    },
  }
})
vi.mock('@/modules/auth/store/authStore', () => ({
  useAuthStore: () => ({ user: { email: 'teacher@m4sh.local' }, forceLogout: vi.fn() }),
}))
vi.mock('@/modules/auth/api/authApi', () => ({ default: { logout: vi.fn() } }))
vi.mock('@/utils/telemetryAgent', () => ({ trackEvent: vi.fn() }))
vi.mock('@/modules/intent/corridors/corridorApi', () => ({ fetchCorridorRegistry: vi.fn(async () => null) }))
const getActiveRemoteSession = vi.fn()
vi.mock('../api/winterboardApi', () => ({
  winterboardApi: { getActiveRemoteSession: (...a: any[]) => getActiveRemoteSession(...a), searchVideos: vi.fn(), lookupVideo: vi.fn() },
}))
const punctuateDictation = vi.fn()
vi.mock('../api/dictationAnalysis', async (importOriginal) => ({
  ...(await importOriginal<any>()), punctuateDictation: (...a: any[]) => punctuateDictation(...a),
}))

import WBRemoteView from '../views/WBRemoteView.vue'

const MSG = {
  connected: 'Зв\'язок є', serverRejected: 'Сервер відхилив ({code})', listening: 'Слухаю…',
  dictation: { button: 'Диктант', write: 'Написати на дошці', writing: 'Пишу на дошці…', done: 'Готово', noAnswer: 'Дошка не прийняла речення',
    punctuate: 'Розставити знаки', punctuating: 'Розставляю знаки…', punctuateFailed: 'Не вдалося розставити знаки',
    punctuateChanged: 'Ви змінили текст', writingOf: 'Пишу {n} з {total}', tapToSpeak: 'Говорити', stopSpeaking: 'Зупинити',
    limitReached: 'Ліміт вичерпано', heard: 'Чую: {text}',
    voice: { denied: 'Браузер не дав мікрофон', stopped: 'Телефон перестав слухати' } },
}
const CAPS = ['dictation', 'dictation_center', 'dictation_line_v1']

const mounted: Array<{ unmount: () => void }> = []
async function connected(caps = CAPS) {
  const i18n = createI18n({ legacy: false, locale: 'uk', fallbackLocale: 'uk', missingWarn: false, fallbackWarn: false,
    messages: { uk: { winterboard: { remote: MSG } } } })
  const w = mount(WBRemoteView, { attachTo: document.body, global: { plugins: [i18n], stubs: { RouterLink: true } } })
  mounted.push(w)
  await flushPromises()
  onStateCb?.({ pair: PAIR, clientId: 'l', pageIndex: 0, pageCount: 1, caps })
  await nextTick()
  await w.find('[data-testid="open-dictation"]').trigger('click')
  return w
}
function dictateCmd() {
  const c = send.mock.calls.map((x) => x[0] as any).filter((d) => d.cmd === 'board.dictate')
  return c[c.length - 1]
}
async function write(w: any, text: string) {
  await w.find('[data-testid="dictation-text"]').setValue(text)
  await w.find('[data-testid="dictation-send"]').trigger('click')
  await nextTick()
}
const status = (w: any) => w.find('[data-testid="dictation-status"]').text()
const sendDisabled = (w: any) => w.find('[data-testid="dictation-send"]').attributes('disabled') !== undefined

describe('LAW §9 v1.55 · диктант на пульті не висить', () => {
  beforeEach(() => {
    channelState.value = 'idle'
    send.mockClear()
    getActiveRemoteSession.mockReset()
    getActiveRemoteSession.mockResolvedValue({ session_id: SID, name: 'Українська 5-А', ts: 1 })
    onStateCb = null; onErrorCb = null
    try { localStorage.setItem('wb.remote.firstTipSeen', '1') } catch { /* noop */ }
  })
  afterEach(() => { vi.useRealTimers(); while (mounted.length) mounted.pop()!.unmount() })

  it('Enter у полі — новий рядок; пробіли по краях ноутбуку не йдуть', async () => {
    const w = await connected()
    await write(w, '  25 жовтня \n  класна робота \n')
    expect(dictateCmd().args.text).toBe('25 жовтня\nкласна робота')
    expect(status(w)).toBe('Пишу на дошці…')
  })

  it('сервер відхилив команду — одразу «не прийняла», кнопка доступна, текст лишився', async () => {
    const w = await connected()
    await write(w, '25 жовтня\nкласна робота')
    expect(sendDisabled(w)).toBe(true)
    onErrorCb?.('invalid_message')
    await nextTick()
    expect(status(w)).toBe('Дошка не прийняла речення')
    expect(sendDisabled(w)).toBe(false)
    expect((w.find('[data-testid="dictation-text"]').element as HTMLTextAreaElement).value).toBe('25 жовтня\nкласна робота')
  })

  it('ноутбук мовчить 8 с — «не прийняла»; новий натиск — знову «Пишу…»', async () => {
    const w = await connected()
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] })
    await write(w, 'Речення.')
    vi.advanceTimersByTime(7900)
    await nextTick()
    expect(status(w)).toBe('Пишу на дошці…')
    vi.advanceTimersByTime(200)
    await nextTick()
    expect(status(w)).toBe('Дошка не прийняла речення')
    await write(w, 'Речення.')
    expect(status(w)).toBe('Пишу на дошці…')
  })

  it('ноутбук відповів вчасно — жодного «не прийняла», навіть якщо пише довше 8 с', async () => {
    const w = await connected()
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] })
    await write(w, 'Речення.')
    const rid = dictateCmd().args.request_id
    onStateCb?.({ pair: PAIR, clientId: 'l', pageIndex: 0, pageCount: 1, caps: CAPS, dictation: { request_id: rid, status: 'writing' } })
    vi.advanceTimersByTime(20000)
    onErrorCb?.('rate_limit')
    await nextTick()
    expect(status(w)).toBe('Пишу на дошці…')
    onStateCb?.({ pair: PAIR, clientId: 'l', pageIndex: 0, pageCount: 1, caps: CAPS, dictation: { request_id: rid, status: 'done' } })
    await nextTick()
    expect(status(w)).toBe('Готово')
  })
})

describe('LAW §9 v1.64 · «Розставити знаки» у вікні диктанту', () => {
  beforeEach(() => {
    channelState.value = 'idle'
    send.mockClear(); punctuateDictation.mockReset()
    getActiveRemoteSession.mockReset()
    getActiveRemoteSession.mockResolvedValue({ session_id: SID, name: 'Українська 5-А', ts: 1 })
    onStateCb = null; onErrorCb = null
    try { localStorage.setItem('wb.remote.firstTipSeen', '1') } catch { /* noop */ }
  })
  afterEach(() => { while (mounted.length) mounted.pop()!.unmount() })
  const field = (w: any) => w.find('[data-testid="dictation-text"]').element as HTMLTextAreaElement

  it('кнопка — лише там, де ввімкнено мовний розбір', async () => {
    const off = await connected()
    expect(off.find('[data-testid="dictation-punctuate"]').exists()).toBe(false)
    const on = await connected([...CAPS, 'dictation_analysis_v1'])
    expect(on.find('[data-testid="dictation-punctuate"]').exists()).toBe(true)
  })

  it('знаки лягають у поле, вчитель бачить їх ДО «Написати на дошці»; дошці нічого не йде', async () => {
    punctuateDictation.mockResolvedValue('Він жартував, а вона сміялась.')
    const w = await connected([...CAPS, 'dictation_analysis_v1'])
    await w.find('[data-testid="dictation-text"]').setValue('він жартував а вона сміялась')
    await w.find('[data-testid="dictation-punctuate"]').trigger('click')
    await flushPromises()
    expect(punctuateDictation).toHaveBeenCalledWith('він жартував а вона сміялась', 'uk')
    expect(field(w).value).toBe('Він жартував, а вона сміялась.')
    expect(dictateCmd()).toBeUndefined()
  })

  it('збій — пояснення, поле не змінено; змінили текст під час роботи — не перезаписуємо', async () => {
    punctuateDictation.mockRejectedValue(new Error('boom'))
    const w = await connected([...CAPS, 'dictation_analysis_v1'])
    await w.find('[data-testid="dictation-text"]').setValue('він жартував')
    await w.find('[data-testid="dictation-punctuate"]').trigger('click')
    await flushPromises()
    expect(field(w).value).toBe('він жартував')
    expect(w.find('[data-testid="dictation-punctuate-note"]').text()).toBe('Не вдалося розставити знаки')
    let finish!: (v: string) => void
    punctuateDictation.mockReturnValue(new Promise<string>((r) => { finish = r }))
    await w.find('[data-testid="dictation-punctuate"]').trigger('click')
    await w.find('[data-testid="dictation-text"]').setValue('він жартував а вона')
    finish('Він жартував.')
    await flushPromises()
    expect(field(w).value).toBe('він жартував а вона')
    expect(w.find('[data-testid="dictation-punctuate-note"]').text()).toBe('Ви змінили текст')
  })
})


describe('LAW §9 v1.69 · вільний диктант', () => {
  beforeEach(() => {
    channelState.value = 'idle'
    send.mockClear(); punctuateDictation.mockReset()
    getActiveRemoteSession.mockReset()
    getActiveRemoteSession.mockResolvedValue({ session_id: SID, name: 'Українська 5-А', ts: 1 })
    onStateCb = null; onErrorCb = null
    voice.heard = ''; voice.lang = ''; voice.reason = null
    try { localStorage.setItem('wb.remote.firstTipSeen', '1') } catch { /* noop */ }
  })
  afterEach(() => { while (mounted.length) mounted.pop()!.unmount() })
  const field = (w: any) => (w.find('[data-testid="dictation-text"]').element as HTMLTextAreaElement).value
  const dictates = () => send.mock.calls.map((x) => x[0] as any).filter((d) => d.cmd === 'board.dictate')
  function answer(rid: string, st: 'done' | 'refused', reason?: string) {
    onStateCb?.({ pair: PAIR, clientId: 'l', pageIndex: 0, pageCount: 1, caps: CAPS,
      dictation: reason ? { request_id: rid, status: st, reason } : { request_id: rid, status: st } })
  }

  it('v1.73: почуте — одразу в полі (розмітка голосом), телефон знаків не чекає; знаки ставить дошка — `punctuate`', async () => {
    voice.heard = 'посередині класна робота пропусти рядок диктант'
    const w = await connected([...CAPS, 'dictation_analysis_v1', 'dictation_punctuate_v1'])
    const mic = w.find('[data-testid="dictation-mic"]')
    await mic.trigger('click')
    expect(voice.lang).toBe('uk-UA')
    expect(field(w)).toBe('↔ Класна робота\n\nДиктант')                                 // ще під час слухання
    expect(w.find('[data-testid="dictation-heard"]').text()).toBe('Слухаю…')
    expect(w.find('[data-testid="dictation-send"]').attributes('disabled')).toBeDefined()   // спершу «Зупинити»
    await mic.trigger('click')
    await flushPromises()
    expect(punctuateDictation).not.toHaveBeenCalled()                                     // телефон не чекає знаків
    expect(field(w)).toBe('↔ Класна робота\n\nДиктант')
    expect(dictates()).toHaveLength(0)                                                    // на дошку — лише «Написати»
    await w.find('[data-testid="dictation-send"]').trigger('click')
    expect(dictates()[0].args).toMatchObject({ text: 'Класна робота', align: 'center', lang: 'uk', punctuate: true })
  })

  it('без мовного розбору — розмітка й розділові слова, без запиту знаків', async () => {
    voice.heard = 'сонце сходило кома птахи співали з нового рядка вечоріло'
    const w = await connected()
    await w.find('[data-testid="dictation-mic"]').trigger('click')
    await w.find('[data-testid="dictation-mic"]').trigger('click')
    await flushPromises()
    expect(punctuateDictation).not.toHaveBeenCalled()
    expect(field(w)).toBe('Сонце сходило, птахи співали\nВечоріло')
    // ноутбук не оголосив, що ставить знаки, — прапорця немає (старий ноутбук відкинув би команду)
    await w.find('[data-testid="dictation-send"]').trigger('click')
    expect(dictates()[0].args.punctuate).toBeUndefined()
  })

  it('«Написати» — шматки по одному: наступний лише після «Готово», написане зникає з поля', async () => {
    const w = await connected()
    await write(w, '↔ 28 жовтня\n↔ Класна робота\n\nДиктант.')
    expect(dictates()).toHaveLength(1)
    expect(dictates()[0].args).toMatchObject({ text: '28 жовтня\nКласна робота', align: 'center' })
    expect(status(w)).toBe('Пишу 1 з 2')
    expect(w.find('[data-testid="dictation-text"]').attributes('readonly')).toBeDefined()
    answer(dictates()[0].args.request_id, 'done')
    await nextTick(); await nextTick()
    expect(dictates()).toHaveLength(2)
    expect(dictates()[1].args).toMatchObject({ text: 'Диктант.', skip: 1 })
    expect(dictates()[1].args.align).toBeUndefined()
    expect(field(w)).toBe('\nДиктант.')
    expect(status(w)).toBe('Пишу 2 з 2')
    answer(dictates()[1].args.request_id, 'done')
    await nextTick(); await nextTick()
    expect(field(w)).toBe('')
    expect(dictates()).toHaveLength(2)
    expect(status(w)).toBe('Готово')
  })

  it('v1.76: текст із мікрофона клавіатури — «з нового рядка посередині» стає розміткою при «Написати»', async () => {
    const w = await connected()
    await write(w, 'Дуже добре записує з нового рядка посередині бувай здорова')
    expect(dictates()[0].args).toMatchObject({ text: 'Дуже добре записує' })
    expect(dictates()[0].args.align).toBeUndefined()
    answer(dictates()[0].args.request_id, 'done')
    await nextTick(); await nextTick()
    expect(dictates()[1].args).toMatchObject({ text: 'Бувай здорова', align: 'center' })
  })

  it('відмова посеред черги — зупинка, решта лишається в полі, кнопка знову доступна', async () => {
    const w = await connected()
    await write(w, 'Перше.\n\nДруге.\n\nТретє.')
    answer(dictates()[0].args.request_id, 'done')
    await nextTick(); await nextTick()
    answer(dictates()[1].args.request_id, 'refused', 'no_space')
    await nextTick(); await nextTick()
    expect(dictates()).toHaveLength(2)
    expect(field(w)).toBe('\nДруге.\n\nТретє.')
    expect(w.find('[data-testid="dictation-send"]').attributes('disabled')).toBeUndefined()
  })

  it('кнопки розмітки: «Посередині», «Новий рядок», «Пропустити рядок» — прямо в полі', async () => {
    const w = await connected()
    await w.find('[data-testid="dictation-center"]').trigger('click')
    expect(field(w)).toBe('↔ ')
    expect(w.find('[data-testid="dictation-center"]').attributes('aria-pressed')).toBe('true')
    await w.find('[data-testid="dictation-text"]').setValue('↔ 28 жовтня')
    await w.find('[data-testid="dictation-skip"]').trigger('click')
    expect(field(w)).toBe('↔ 28 жовтня\n\n')
    await w.find('[data-testid="dictation-text"]').setValue('Перше.')
    await w.find('[data-testid="dictation-newline"]').trigger('click')
    expect(field(w)).toBe('Перше.\n')
  })

  it('телефон не дав мікрофон — причина словами, сказане до того лишилось у полі', async () => {
    voice.heard = 'сонце сходило'
    voice.reason = 'not-allowed'
    const w = await connected()
    await w.find('[data-testid="dictation-mic"]').trigger('click')
    await w.find('[data-testid="dictation-mic"]').trigger('click')
    await flushPromises()
    expect(field(w)).toBe('Сонце сходило')
    expect(w.find('[data-testid="dictation-voice-note"]').text()).toContain('Браузер не дав мікрофон')
    // новий натиск «Говорити» — пояснення зникає
    voice.reason = null
    await w.find('[data-testid="dictation-mic"]').trigger('click')
    expect(w.find('[data-testid="dictation-voice-note"]').exists()).toBe(false)
  })

  it('телефон перестав слухати без явної причини — «натисніть ще раз»', async () => {
    voice.heard = ''
    voice.reason = 'stopped_listening'
    const w = await connected()
    await w.find('[data-testid="dictation-mic"]').trigger('click')
    await w.find('[data-testid="dictation-mic"]').trigger('click')
    await flushPromises()
    expect(w.find('[data-testid="dictation-voice-note"]').text()).toContain('Телефон перестав слухати')
  })

  it('«✨ Розставити знаки»: ліміт Інтегралика вичерпано — словами, текст лишився, як розпізнано', async () => {
    punctuateDictation.mockRejectedValue({ response: { status: 403, data: { error: 'LIMIT_EXCEEDED' } } })
    voice.heard = 'він жартував'
    const w = await connected([...CAPS, 'dictation_analysis_v1'])
    await w.find('[data-testid="dictation-mic"]').trigger('click')
    await w.find('[data-testid="dictation-mic"]').trigger('click')
    await w.find('[data-testid="dictation-punctuate"]').trigger('click')
    await flushPromises()
    expect(punctuateDictation).toHaveBeenCalledWith('Він жартував', 'uk')
    expect(field(w)).toBe('Він жартував')
    expect(w.find('[data-testid="dictation-punctuate-note"]').text()).toBe('Ліміт вичерпано')
  })
})
