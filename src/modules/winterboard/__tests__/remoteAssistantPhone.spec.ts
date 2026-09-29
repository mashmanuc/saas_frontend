/**
 * LAW §9 v1.20 — пульт (телефон): Інтегралик текстом, розмова лише тут.
 *   • поле «Написати Інтегралику…» + «➤» рядком над «– Згорнути вікно Інтегралика»;
 *   • надіслане → assistant.ask { request_id (UUID), text }; поки чекає — поле неактивне, «думає…»;
 *   • відповідь — під своїм текстом; confirm → «Так / Ні» → assistant.answer; done → «Готово — сторінка N»
 *     і «Показати» → page.goto; нове питання гасить старі «Так / Ні»;
 *   • розбір `assistant_reply` — дзеркало сервера (зіпсоване поле відкидається цілим).
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { nextTick, ref } from 'vue'
import { flushPromises, mount } from '@vue/test-utils'
import { createI18n } from 'vue-i18n'
import uk from '../../../i18n/locales/uk.json'
import { derivePair } from '../remote/remotePair'

const SID = '4ba7fff3-9452-4c42-9ff9-04415ff25d90'
const PAIR = derivePair(SID)
const channelState = ref<'idle' | 'connecting' | 'connected' | 'reconnecting' | 'disconnected' | 'unavailable'>('idle')
const send = vi.fn((_data: Record<string, unknown>) => true)
let onStateCb: ((s: any) => void) | null = null

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

import { parseRemoteAssistantReply } from '../composables/useRemoteChannel'
import WBRemoteView from '../views/WBRemoteView.vue'

const A = (uk as any).winterboard.remote.assistant
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/
const i18n = () => createI18n({ legacy: false, locale: 'uk', fallbackLocale: 'uk', messages: { uk } as never })
const mounted: Array<{ unmount: () => void }> = []

async function connected(extra: Record<string, unknown> = {}) {
  const w = mount(WBRemoteView, { attachTo: document.body, global: { plugins: [i18n()], stubs: { RouterLink: true } } })
  mounted.push(w)
  await flushPromises()
  onStateCb!({ pair: PAIR, clientId: 'l', pageIndex: 1, pageCount: 5, ...extra })
  await nextTick()
  return w
}
const state = (extra: Record<string, unknown>) => { onStateCb!({ pair: PAIR, clientId: 'l', pageIndex: 1, pageCount: 5, ...extra }); return nextTick() }
const cmds = () => send.mock.calls.map((c) => c[0] as any).filter((m) => m.cmd && m.cmd !== 'hello')
const lastCmd = () => cmds()[cmds().length - 1] ?? null

async function ask(w: any, text: string): Promise<string> {
  await w.find('[data-testid="remote-ai-input"]').setValue(text)
  await w.find('.wb-remote__ai-row').trigger('submit')
  const cmd = lastCmd()
  return cmd?.args?.request_id
}

beforeEach(() => {
  channelState.value = 'idle'
  send.mockClear()
  onStateCb = null
  try { localStorage.setItem('wb.remote.firstTipSeen', '1') } catch { /* noop */ }
})
afterEach(() => { while (mounted.length) mounted.pop()!.unmount() })

describe('розбір assistant_reply — дзеркало сервера', () => {
  const REQ = '0c1f7c9e-5b7a-4d1e-9f3a-2b6c8d4e1a90'
  it('валідне — у нашій формі; сторінка лише в done', () => {
    expect(parseRemoteAssistantReply({ request_id: REQ, status: 'done', text: 'Готово', page_index: 3 }))
      .toEqual({ requestId: REQ, status: 'done', text: 'Готово', pageIndex: 3 })
    expect(parseRemoteAssistantReply({ request_id: REQ, status: 'reply', text: 'x', page_index: 3 }))
      .toEqual({ requestId: REQ, status: 'reply', text: 'x' })
  })
  it.each([['рядок', 'done'], ['без статусу', { request_id: REQ }], ['невідомий статус', { request_id: REQ, status: 'answered' }], ['без запиту', { status: 'done' }]])(
    'зіпсоване відкидається: %s', (_n, raw) => { expect(parseRemoteAssistantReply(raw)).toBeUndefined() })
})

describe('пульт: Інтегралик текстом', () => {
  it('поле й «➤» — рядком над «– Згорнути вікно Інтегралика»', async () => {
    const w = await connected()
    const ai = w.find('[data-testid="remote-ai"]').element as HTMLElement
    expect(ai.nextElementSibling?.getAttribute('data-testid')).toBe('assistant-minimize')
    expect((w.find('[data-testid="remote-ai-input"]').element as HTMLInputElement).placeholder).toBe(A.placeholder)
  })

  it('зв\'язок загубився — поле неактивне', async () => {
    const w = await connected()
    expect((w.find('[data-testid="remote-ai-input"]').element as HTMLInputElement).disabled).toBe(false)
    channelState.value = 'reconnecting'
    await nextTick()
    expect((w.find('[data-testid="remote-ai-input"]').element as HTMLInputElement).disabled).toBe(true)
  })

  it('надіслане → assistant.ask з UUID і текстом; поле очищається й чекає; «думає…»', async () => {
    const w = await connected()
    const requestId = await ask(w, '  підготуй задачу на дискримінант  ')
    expect(lastCmd()).toMatchObject({ cmd: 'assistant.ask', args: { text: 'підготуй задачу на дискримінант' } })
    expect(requestId).toMatch(UUID_RE)
    const input = w.find('[data-testid="remote-ai-input"]').element as HTMLInputElement
    expect(input.value).toBe('')
    expect(input.disabled).toBe(true)
    expect(w.find('.wb-remote__ai-me').text()).toBe('підготуй задачу на дискримінант')
    expect(w.find('.wb-remote__ai-bot--wait').text()).toBe(A.thinking)
  })

  it('відповідь — під своїм текстом; поле знову активне', async () => {
    const w = await connected()
    const requestId = await ask(w, 'що таке дискримінант?')
    await state({ assistantReply: { requestId, status: 'reply', text: 'Дискримінант — це b² − 4ac.' } })
    expect(w.find('[data-testid="remote-ai-reply"]').text()).toBe('Дискримінант — це b² − 4ac.')
    expect((w.find('[data-testid="remote-ai-input"]').element as HTMLInputElement).disabled).toBe(false)
  })

  it('confirm → «Так» / «Ні»; «Так» → assistant.answer yes, кнопки гаснуть', async () => {
    const w = await connected()
    const requestId = await ask(w, 'додай сторінку з задачею')
    await state({ assistantReply: { requestId, status: 'confirm', text: 'Додам сторінку з карткою?' } })
    expect(w.find('[data-testid="remote-ai-yes"]').text()).toBe(A.yes)
    expect(w.find('[data-testid="remote-ai-no"]').text()).toBe(A.no)
    await w.find('[data-testid="remote-ai-yes"]').trigger('click')
    expect(lastCmd()).toEqual(expect.objectContaining({ cmd: 'assistant.answer', args: { request_id: requestId, choice: 'yes' } }))
    expect(w.find('[data-testid="remote-ai-yes"]').exists()).toBe(false)
  })

  it('done → «Готово — сторінка N» і «Показати» → page.goto на неї', async () => {
    const w = await connected()
    const requestId = await ask(w, 'підготуй задачу')
    await state({ assistantReply: { requestId, status: 'done', text: 'Поклав задачу.', pageIndex: 3 } })
    expect(w.find('[data-testid="remote-ai-ready"]').text()).toBe(A.ready.replace('{n}', '4'))
    await w.find('[data-testid="remote-ai-show"]').trigger('click')
    expect(lastCmd()).toEqual(expect.objectContaining({ cmd: 'page.goto', args: { index: 3 } }))
  })

  it('нове питання гасить старі «Так / Ні» (ноутбук те підтвердження вже скасував)', async () => {
    const w = await connected()
    const first = await ask(w, 'додай сторінку')
    await state({ assistantReply: { requestId: first, status: 'confirm', text: 'Додати?' } })
    await ask(w, 'ні, краще графік')
    expect(w.find('[data-testid="remote-ai-yes"]').exists()).toBe(false)
    expect(w.text()).toContain(A.cancelled)
  })

  it('поки попереднє без відповіді — друге не надсилається', async () => {
    const w = await connected()
    await ask(w, 'перше')
    send.mockClear()
    await w.find('[data-testid="remote-ai-input"]').setValue('друге')
    await w.find('.wb-remote__ai-row').trigger('submit')
    expect(cmds()).toHaveLength(0)
  })

  it('текст уже набрано, а ноутбук повідомив «думає…» (пульт перезавантажився) — не надсилається', async () => {
    const w = await connected()
    await w.find('[data-testid="remote-ai-input"]').setValue('друге питання')
    await state({ assistantReply: { requestId: '0c1f7c9e-5b7a-4d1e-9f3a-2b6c8d4e1a90', status: 'thinking' } })
    send.mockClear()
    await w.find('.wb-remote__ai-row').trigger('submit')   // Enter у полі / програмна відправка
    expect(cmds()).toHaveLength(0)
  })

  it('відповідь на запит, якого пульт не бачив (перезавантажився), — все одно видно', async () => {
    const w = await connected({ assistantReply: { requestId: '0c1f7c9e-5b7a-4d1e-9f3a-2b6c8d4e1a90', status: 'done', text: 'Готово', pageIndex: 2 } })
    expect(w.find('[data-testid="remote-ai-ready"]').exists()).toBe(true)
    expect(w.findAll('[data-testid="remote-ai-turn"]')).toHaveLength(1)
  })
})
