/** Справжній relay ноутбука: capability, явна мова, повтори й teacher-only межа. */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { defineComponent, h, reactive, ref } from 'vue'
import { mount } from '@vue/test-utils'
import { REMOTE_STATE_THROTTLE_MS, useBoardRemote, type UseBoardRemoteOptions } from '../composables/useBoardRemote'
import type { RemoteSentenceAdapter } from '../remote/remoteSentenceAdapter'

const RID = '1b4e28ba-2fa1-41d2-883f-0016d3cca427'
const sentence = () => ({ page_id: 'p', object_id: 's', source_revision: 'a'.repeat(64),
  words: [{ id: 'w0', text: 'Мама', hidden: false }], punct: false })
const request = () => ({ request_id: RID, page_id: 'p', object_id: 's', source_revision: 'a'.repeat(64),
  action: 'set_word', token_id: 'w0', hidden: true })
const mounted: Array<{ unmount: () => void }> = []
beforeEach(() => { vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'Date'] }) })
afterEach(() => { while (mounted.length) mounted.pop()!.unmount(); vi.useRealTimers() })
const settle = () => vi.advanceTimersByTimeAsync(REMOTE_STATE_THROTTLE_MS + 10)

function setup(options: { dictate?: UseBoardRemoteOptions['dictate']; sentence?: RemoteSentenceAdapter; analysisAvailability?: () => Promise<boolean> } = {}) {
  const store = reactive({ currentPageIndex: 0, pageCount: 1, goToPage: vi.fn(), addPage: vi.fn() })
  const sendMessage = vi.fn()
  const enabled = ref(true)
  let api!: ReturnType<typeof useBoardRemote>
  mounted.push(mount(defineComponent({ setup() {
    api = useBoardRemote({ sessionId: ref('4ba7fff3-9452-4c42-9ff9-04415ff25d90'), store,
      undo: vi.fn(), enabled, sendMessage, ...options })
    return () => h('div')
  } })))
  const command = (cmd: string, args: Record<string, unknown> = {}, pair?: string) => window.dispatchEvent(
    new CustomEvent('wb:remote-command', { detail: { userId: 'synthetic', pair: pair ?? api.pairCode.value,
      clientId: 'phone', cmd, args } }))
  const state = () => sendMessage.mock.calls.map(([message]) => message).filter((message) => message.type === 'remote.state').slice(-1)[0]
  return { command, state, enabled }
}

describe('Речення: relay пульта без дубльованих записів', () => {
  it('OFF/старий сервер/невдала перевірка: кнопки розбору не оголошуються; звичайний диктант лишається', async () => {
    for (const availability of [async () => false, async () => { throw new Error('old_server') }]) {
      const check = vi.fn(availability)
      const d = setup({ dictate: async () => ({ status: 'written' }), analysisAvailability: check,
        sentence: { state: sentence, apply: (r) => ({ request_id: r.request_id, status: 'done' }),
          applyAnalysis: async (r) => ({ request_id: r.request_id, status: 'done' }) } })
      d.command('hello'); await settle()
      expect(d.state().caps).not.toContain('dictation_analysis_v1')
      expect(d.state().caps).toContain('dictation_line_v1')
      expect(check).toHaveBeenCalledOnce()
    }
  })
  it('поки відповідь сервера ще в дорозі й після вимкнення host — можливості розбору немає', async () => {
    let finish!: (enabled: boolean) => void
    const d = setup({ dictate: async () => ({ status: 'written' }),
      analysisAvailability: () => new Promise((resolve) => { finish = resolve }),
      sentence: { state: sentence, apply: (r) => ({ request_id: r.request_id, status: 'done' }),
        applyAnalysis: async (r) => ({ request_id: r.request_id, status: 'done' }) } })
    d.command('hello'); await settle()
    expect(d.state().caps).not.toContain('dictation_analysis_v1')
    d.enabled.value = false; await settle(); finish(true); await settle()
    d.enabled.value = true; await settle(); d.command('hello'); await settle()
    expect(d.state().caps).not.toContain('dictation_analysis_v1')
  })
  it('підтверджений аналіз: у WS лише UUID; pending і завершений запит не дублюються', async () => {
    let finish!: (result: { request_id: string; status: 'done' }) => void
    const applyAnalysis = vi.fn(() => new Promise<{ request_id: string; status: 'done' }>((resolve) => { finish = resolve }))
    const d = setup({ dictate: async () => ({ status: 'written' }), analysisAvailability: async () => true, sentence: { state: sentence,
      apply: (req) => ({ request_id: req.request_id, status: 'done' }), applyAnalysis } })
    const args = { request_id: RID, page_id: 'p', object_id: 's', source_revision: 'a'.repeat(64),
      action: 'apply_analysis', proposal_id: '2b4e28ba-2fa1-41d2-883f-0016d3cca427' }
    expect(new TextEncoder().encode(JSON.stringify(args)).length).toBeLessThan(2048)
    d.command('dictation.action', args); d.command('dictation.action', args); await settle()
    expect(applyAnalysis).toHaveBeenCalledOnce()
    finish({ request_id: RID, status: 'done' }); await settle()
    expect(d.state().sentence_result).toEqual({ request_id: RID, status: 'done' })
    d.command('dictation.action', args); await settle()
    expect(applyAnalysis).toHaveBeenCalledOnce()
    expect(d.state().caps).toContain('dictation_analysis_v1')
    d.command('dictation.action', { ...args, proposal_id: '3b4e28ba-2fa1-41d2-883f-0016d3cca427' }); await settle()
    expect(d.state().sentence_result).toEqual({ request_id: RID, status: 'refused', reason: 'invalid' })
    expect(applyAnalysis).toHaveBeenCalledOnce()
  })
  it('cap лише з адаптером і диктантом, snapshot без геометрії; повтор request_id виконується один раз', async () => {
    const apply = vi.fn<RemoteSentenceAdapter['apply']>((req) => ({ request_id: req.request_id, status: 'done' }))
    const adapter = { state: sentence, apply }
    const d = setup({ dictate: async () => ({ status: 'written' }), sentence: adapter })
    d.command('hello'); await settle()
    expect(d.state().caps).toContain('dictation_line_v1')
    expect(d.state().sentence).toEqual(sentence())
    d.command('dictation.action', request()); await settle()
    d.command('dictation.action', request()); await settle()
    expect(apply).toHaveBeenCalledOnce()
    expect(d.state().sentence_result).toEqual({ request_id: RID, status: 'done' })
  })
  it('нове написання передає uk/en і не дублюється ні під час виконання, ні після', async () => {
    let finish!: (value: { status: 'written' }) => void
    const dictate = vi.fn<NonNullable<UseBoardRemoteOptions['dictate']>>(() => new Promise((resolve) => { finish = resolve }))
    const d = setup({ dictate })
    const args = { request_id: RID, text: 'Hello.', lang: 'en', align: 'center' }
    d.command('board.dictate', args); await settle()
    d.command('board.dictate', args); await settle()
    expect(dictate).toHaveBeenCalledOnce()
    expect(dictate).toHaveBeenCalledWith('Hello.', 'center', 'en')
    expect(d.state().dictation).toEqual({ request_id: RID, status: 'writing' })
    finish({ status: 'written' }); await settle()
    d.command('board.dictate', args); await settle()
    expect(dictate).toHaveBeenCalledOnce()
    expect(d.state().dictation).toEqual({ request_id: RID, status: 'done' })
    expect(d.state().caps).not.toContain('dictation_line_v1')
  })
  it('неправильна пара, вимкнений host і зайве поле не доходять до адаптера', async () => {
    const apply = vi.fn<RemoteSentenceAdapter['apply']>((req) => ({ request_id: req.request_id, status: 'done' }))
    const d = setup({ sentence: { state: sentence, apply } })
    d.command('dictation.action', request(), 'wrong-pair')
    d.enabled.value = false; await settle()
    d.command('dictation.action', request())
    d.enabled.value = true; await settle()
    d.command('dictation.action', { ...request(), glyphs: [] }); await settle()
    expect(apply).not.toHaveBeenCalled()
  })
  it('без адаптера повертає відмову, не удаване виконання', async () => {
    const d = setup()
    d.command('dictation.action', request()); await settle()
    expect(d.state().sentence_result).toEqual({ request_id: RID, status: 'refused', reason: 'blocked' })
  })
})
