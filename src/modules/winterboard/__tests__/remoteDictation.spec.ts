/**
 * LAW §9 v1.49 «✍️ Диктант» (власник 2026-10-24: «вчителька української мови казала що для неї багато часу займає
 * написання речень на дошці для подальшого їх розбору… в нас є телефон мікрофон дошка і пропис»; «кажу так»).
 *
 *   — телефон: розділові слова → знаки, голос дописує поле; закриті набори стану й аргументів;
 *   — ноутбук: речення рукописом під усім, що вже є на сторінці, одним кроком «Скасувати»; чесні відмови;
 *   — пульт ноутбука: `caps` += 'dictation', команда `board.dictate` → `dictation` у стані («Пишу… / Готово / причина»).
 */
import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest'
import { reactive, ref, defineComponent, h } from 'vue'
import { mount } from '@vue/test-utils'
import {
  DICTATION_SPEECH_LANG, appendDictated, parseRemoteDictation, readDictateArgs, spokenToText,
} from '../remote/dictationContract'
import { DICTATION_GAP, HANDWRITE_MARGIN, PAGE_OBJECT_LIMIT, dictationArea } from '../board/handwriteSolution'
import {
  HandwriteUnsupported, handwriteBusyId, handwriteDictation, type HandwriteDeps, type HandwriteLayoutRequest,
} from '../composables/useHandwriteSolution'
import { REMOTE_STATE_THROTTLE_MS, useBoardRemote } from '../composables/useBoardRemote'
import { parseRemoteCaps } from '../composables/useRemoteChannel'

const RID = '1b4e28ba-2fa1-41d2-883f-0016d3cca427'

describe('телефон: продиктоване → речення', () => {
  it('розділові слова стають знаками, перша літера велика', () => {
    expect(spokenToText('сонце сходило кома і птахи співали крапка')).toBe('Сонце сходило, і птахи співали.')
    expect(spokenToText('чи прийдеш ти завтра знак питання')).toBe('Чи прийдеш ти завтра?')
    expect(spokenToText('яка краса знак оклику')).toBe('Яка краса!')
    expect(spokenToText('весна двокрапка тепло кома світло')).toBe('Весна: тепло, світло')
    expect(spokenToText('ішов дощ крапка з комою вітер стих')).toBe('Ішов дощ; вітер стих')
    expect(spokenToText('Київ тире столиця України крапка')).toBe('Київ — столиця України.')
    expect(spokenToText('і раптом три крапки')).toBe('І раптом…')
  })

  it('слова, що лише починаються так само, не чіпає: «комаха», «крапками»', () => {
    expect(spokenToText('комаха сіла на крапками вкритий лист')).toBe('Комаха сіла на крапками вкритий лист')
  })

  it('нова фраза дописується до набраного: після коми — з малої, після крапки — з великої', () => {
    expect(appendDictated('Сонце сходило,', 'і птахи співали крапка')).toBe('Сонце сходило, і птахи співали.')
    expect(appendDictated('Сонце сходило.', 'птахи співали')).toBe('Сонце сходило. Птахи співали')
    expect(appendDictated('', 'птахи')).toBe('Птахи')
    expect(appendDictated('Текст', '   ')).toBe('Текст')
  })

  it('стан від ноутбука — закриті набори, як на сервері', () => {
    expect(parseRemoteDictation({ request_id: RID, status: 'done' })).toEqual({ request_id: RID, status: 'done' })
    expect(parseRemoteDictation({ request_id: RID, status: 'refused', reason: 'no_space' })?.reason).toBe('no_space')
    for (const bad of [
      { request_id: RID, status: 'refused' }, { request_id: RID, status: 'done', reason: 'no_space' },
      { request_id: RID, status: 'refused', reason: 'boom' }, { request_id: 'x', status: 'done' },
      { request_id: RID, status: 'done', text: 'Речення.' }, 'Готово', null,
    ]) expect(parseRemoteDictation(bad), JSON.stringify(bad)).toBeUndefined()
    expect(parseRemoteCaps(['dictation', 'photo'])).toEqual(['dictation', 'photo'])
  })

  it('аргументи команди на ноутбуці — закритий набір і межі, як на сервері', () => {
    expect(readDictateArgs({ request_id: RID, text: '  Речення.  ' })).toEqual({ requestId: RID, text: 'Речення.' })
    for (const bad of [
      { request_id: RID }, { request_id: RID, text: '' }, { request_id: RID, text: 'а'.repeat(301) },
      { request_id: RID, text: 'рядок\nдругий' }, { request_id: 'x', text: 'Речення.' },
      { request_id: RID, text: 'Речення.', x: 1 },
    ]) expect(readDictateArgs(bad), JSON.stringify(bad)).toBeNull()
  })
})

describe('ноутбук: де писати речення', () => {
  it('порожня сторінка — від верхнього поля, на всю ширину з полями', () => {
    expect(dictationArea({ assets: [], strokes: [] }, 1920, 1080))
      .toEqual({ x: HANDWRITE_MARGIN, y: HANDWRITE_MARGIN, w: 1920 - 2 * HANDWRITE_MARGIN, h: 1080 - 2 * HANDWRITE_MARGIN })
  })

  it('під усім, що вже є (і штрихи, і об\'єкти), — кожне наступне нижче', () => {
    const page = { assets: [{ x: 100, y: 50, w: 300, h: 200 }], strokes: [{ points: [{ x: 60, y: 300 }, { x: 900, y: 360 }], size: 4 }] }
    expect(dictationArea(page, 1920, 1080)!.y).toBe(362 + DICTATION_GAP)
  })

  it('знизу не лишилось місця на рядок — немає місця («нова сторінка»)', () => {
    const page = { assets: [{ x: 0, y: 0, w: 1920, h: 1000 }], strokes: [] }
    expect(dictationArea(page, 1920, 1080)).toBeNull()
  })
})

function makeDeps(opts: { strokes?: any[]; fits?: boolean; unsupported?: boolean } = {}) {
  const page = { id: 'p1', width: 1920, height: 1080, assets: [] as any[], strokes: (opts.strokes ?? []) as any[] }
  const pages: any[] = [page]
  const store = {
    mode: 'edit', workspaceId: 'board-1', currentPageIndex: 0, pages, pageHeight: 1080,
    get currentPageCanvasHeight() { return 1080 },
    undoStack: [] as any[], redoStack: [] as any[],
    addStroke: vi.fn((s: any) => { page.strokes = [...page.strokes, s] }),
    addStrokesBatchToPage: vi.fn((_i: number, batch: any[]) => { page.strokes = [...page.strokes, ...batch] }),
    deleteStroke: vi.fn((id: string) => { page.strokes = page.strokes.filter((s: any) => s.id !== id) }),
    addAsset: vi.fn(), deleteAsset: vi.fn(), addPageUndoable: vi.fn(),
  }
  const queue: Array<() => void> = []
  const deps: HandwriteDeps = {
    store: store as any,
    sync: { mode: 'SYNC', inputLocked: false },
    fetchLayout: vi.fn(async (req: HandwriteLayoutRequest) => {
      if (opts.unsupported) throw new HandwriteUnsupported('☃')
      if (opts.fits === false) return { fits: false as const, needed_height: 900 }
      return {
        fits: true as const, scale: 46, size: 3, w: 400, h: 60, duration_ms: 200,
        strokes: [{ p: [[0, 0], [40, 30]], t: 100 }, { p: [[50, 0], [90, 30]], t: 200 }],
      }
    }),
    schedule: (fn) => { queue.push(fn); return () => { const i = queue.indexOf(fn); if (i >= 0) queue.splice(i, 1) } },
    now: () => 0,
  }
  const runAll = () => { while (queue.length) queue.shift()!() }
  return { deps, store, page, runAll }
}

const flush = () => new Promise((r) => setTimeout(r, 0))

describe('ноутбук: письмо продиктованого', () => {
  afterEach(() => { handwriteBusyId.value = null })

  it('рукописом під написаним, тим самим почерком, одним кроком «Скасувати»', async () => {
    const d = makeDeps({ strokes: [{ id: 's0', points: [{ x: 60, y: 100 }, { x: 600, y: 140 }], size: 2 }] })
    const done = handwriteDictation('Сонце сходило, і птахи співали.', d.deps)
    await flush(); d.runAll()
    expect(await done).toEqual({ status: 'written' })
    const req = (d.deps.fetchLayout as any).mock.calls[0][0]
    expect(req).toMatchObject({ text: 'Сонце сходило, і птахи співали.', mode: 'full', answer: '', width: 1840, hand: 'school' })
    const written = d.page.strokes.filter((s: any) => String(s.id).startsWith('dict-'))
    expect(written).toHaveLength(2)
    expect(Math.min(...written.flatMap((s: any) => s.points.map((p: any) => p.y)))).toBeGreaterThan(141)
    expect(d.store.undoStack).toHaveLength(1)
    d.store.undoStack[0].revert()
    expect(d.page.strokes.map((s: any) => s.id)).toEqual(['s0'])
  })

  it('чесні відмови: немає місця, почерк не знає знака, уже пише, дошку не можна змінювати', async () => {
    expect(await handwriteDictation('Речення.', makeDeps({ fits: false }).deps)).toEqual({ status: 'refused', reason: 'no_space' })
    expect(await handwriteDictation('Речення ☃.', makeDeps({ unsupported: true }).deps)).toEqual({ status: 'refused', reason: 'unsupported' })
    handwriteBusyId.value = 'task-1'
    expect(await handwriteDictation('Речення.', makeDeps().deps)).toEqual({ status: 'refused', reason: 'busy' })
    handwriteBusyId.value = null
    const locked = makeDeps()
    ;(locked.deps.sync as any).inputLocked = true
    expect(await handwriteDictation('Речення.', locked.deps)).toEqual({ status: 'refused', reason: 'blocked' })
  })

  it('речення не влазить у межу сторінки цілим — «немає місця», а не обрізане під «готово» (стенд 24.10, «…діду»)', async () => {
    const full = Array.from({ length: PAGE_OBJECT_LIMIT - 1 }, (_, i) => ({ id: `s${i}`, points: [{ x: 60, y: 20 }, { x: 70, y: 22 }], size: 2 }))
    const d = makeDeps({ strokes: full })
    expect(await handwriteDictation('Речення.', d.deps)).toEqual({ status: 'refused', reason: 'no_space' })
    expect(d.page.strokes).toHaveLength(PAGE_OBJECT_LIMIT - 1)
    expect(d.store.undoStack).toHaveLength(0)
  })
})

describe('пульт ноутбука: команда й стан', () => {
  const SID = '4ba7fff3-9452-4c42-9ff9-04415ff25d90'
  const mounted: Array<{ unmount: () => void }> = []
  // Стан пульту ноутбук шле не частіше раз на REMOTE_STATE_THROTTLE_MS — годинник підставний, щоб бачити кожен стан
  beforeEach(() => { vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'Date'] }) })
  afterEach(() => { while (mounted.length) mounted.pop()!.unmount(); vi.useRealTimers() })
  const settle = () => vi.advanceTimersByTimeAsync(REMOTE_STATE_THROTTLE_MS + 10)

  function setup(dictate?: (text: string) => Promise<any>) {
    const store = reactive({ currentPageIndex: 0, pageCount: 1, goToPage: vi.fn(), addPage: vi.fn() })
    const sendMessage = vi.fn()
    let api!: ReturnType<typeof useBoardRemote>
    mounted.push(mount(defineComponent({
      setup() {
        api = useBoardRemote({ sessionId: ref<string | null>(SID), store, undo: vi.fn(), sendMessage, enabled: ref(true), dictate })
        return () => h('div')
      },
    })))
    const command = (cmd: string, args: Record<string, unknown> = {}) =>
      window.dispatchEvent(new CustomEvent('wb:remote-command', { detail: { userId: 'u', pair: api.pairCode.value, clientId: 'phone', cmd, args } }))
    const states = () => sendMessage.mock.calls.map((c) => c[0]).filter((m: any) => m?.type === 'remote.state')
    return { command, states }
  }

  it('є диктант — caps ∋ dictation; речення: «пишу», потім «готово»', async () => {
    let resolve!: (r: any) => void
    const dictate = vi.fn(() => new Promise((r) => { resolve = r }))
    const { command, states } = setup(dictate)
    command('hello')
    await settle()
    expect(states().slice(-1)[0].caps).toContain('dictation')
    command('board.dictate', { request_id: RID, text: 'Речення.' })
    await settle()
    expect(dictate).toHaveBeenCalledWith('Речення.')
    expect(states().slice(-1)[0].dictation).toEqual({ request_id: RID, status: 'writing' })
    resolve({ status: 'written' })
    await settle()
    expect(states().slice(-1)[0].dictation).toEqual({ request_id: RID, status: 'done' })
  })

  it('відмова — з причиною; зупинене посеред письма — чесно «дошку змінили», не «готово»', async () => {
    const r1 = setup(async () => ({ status: 'refused', reason: 'no_space' }))
    r1.command('board.dictate', { request_id: RID, text: 'Речення.' })
    await settle()
    expect(r1.states().slice(-1)[0].dictation).toEqual({ request_id: RID, status: 'refused', reason: 'no_space' })
    const r2 = setup(async () => ({ status: 'stopped' }))
    r2.command('board.dictate', { request_id: RID, text: 'Речення.' })
    await settle()
    expect(r2.states().slice(-1)[0].dictation).toEqual({ request_id: RID, status: 'refused', reason: 'blocked' })
  })

  it('кімната без диктанту: кнопки немає, а команда (старий телефон) — відмова, не тиша', async () => {
    const { command, states } = setup()
    command('hello')
    await settle()
    expect(states().slice(-1)[0].caps).not.toContain('dictation')
    command('board.dictate', { request_id: RID, text: 'Речення.' })
    await settle()
    expect(states().slice(-1)[0].dictation).toEqual({ request_id: RID, status: 'refused', reason: 'error' })
  })

  it('зіпсовані аргументи — нічого не пише', () => {
    const dictate = vi.fn(async () => ({ status: 'written' }))
    const { command } = setup(dictate)
    command('board.dictate', { request_id: RID, text: '' })
    command('board.dictate', { request_id: 'x', text: 'Речення.' })
    expect(dictate).not.toHaveBeenCalled()
  })
})

describe('v1.50: диктант англійською', () => {
  it('розділові слова англійською стають знаками, перша літера велика', () => {
    expect(spokenToText('hello world comma how are you question mark', 'en')).toBe('Hello world, how are you?')
    expect(spokenToText('it is late full stop', 'en')).toBe('It is late.')
    expect(spokenToText('it is late period', 'en')).toBe('It is late.')
    expect(spokenToText('wait exclamation mark', 'en')).toBe('Wait!')
    expect(spokenToText('one semicolon two colon three', 'en')).toBe('One; two: three')
    expect(spokenToText('London dash the capital', 'en')).toBe('London — the capital')
  })

  it('слова, що лише починаються так само, не чіпає; мови не змішуються', () => {
    expect(spokenToText('the periodic table', 'en')).toBe('The periodic table')
    expect(spokenToText('кома', 'en')).toBe('Кома')
    expect(spokenToText('comma', 'uk')).toBe('Comma')
  })

  it('продовження після коми — з малої, але «I» завжди велике', () => {
    expect(appendDictated('Yesterday,', 'I went home full stop', 'en')).toBe('Yesterday, I went home.')
    expect(appendDictated('Yesterday,', "I'm at home", 'en')).toBe("Yesterday, I'm at home")
    expect(appendDictated('Yesterday,', 'We went', 'en')).toBe('Yesterday, we went')
    expect(appendDictated('Hi.', 'how are you', 'en')).toBe('Hi. How are you')
  })

  it('телефон слухає британську англійську; наступний натиск без мови — знову українська', async () => {
    let inst: any = null
    class FakeSR {
      lang = ''; started: string[] = []
      onend: any; onresult: any; onerror: any
      constructor() { inst = this }
      start() { this.started.push(this.lang) }
      stop() {}
    }
    vi.stubGlobal('webkitSpeechRecognition', FakeSR)
    vi.resetModules()
    try {
      const { usePushToTalk } = await import('../composables/usePushToTalk')
      let api!: ReturnType<typeof usePushToTalk>
      const w = mount(defineComponent({ setup() { api = usePushToTalk({ onFinal: () => {} }); return () => h('div') } }))
      expect(DICTATION_SPEECH_LANG.en).toBe('en-GB')
      api.press(DICTATION_SPEECH_LANG.en)
      inst.onend()
      api.press()
      expect(inst.started).toEqual(['en-GB', 'uk-UA'])
      w.unmount()
    } finally {
      vi.unstubAllGlobals()
      vi.resetModules()
    }
  })
})
