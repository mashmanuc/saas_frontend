/**
 * Пульт має представлятися серверу міткою `client=remote`.
 *
 * Борг із розбору уроку власника 2026-09-03: дошка на ноутбуці й пульт на
 * телефоні йдуть в ОДИН endpoint і обидва мають роль `owner`, тому в
 * телеметрії їх було не розрізнити. На дошці `e16e5e94` (11:53–12:21) через
 * це не вдалося сказати головного: чи ноутбук узагалі був на дошці, коли
 * телефон дванадцять разів слав `hello` без відповіді.
 *
 * Мітка суто спостережна — на поведінку каналу вона не впливає, тому тут
 * перевіряється рівно одне: вона є в адресі й не ламає токен.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

vi.mock('../composables/usePresence', () => ({
  getWsBaseUrl: () => 'wss://api.example.test',
  isPresenceAvailable: () => true,
  _getFreshTokenAsync: async () => 'tok/en+with special',
}))

import { useRemoteChannel } from '../composables/useRemoteChannel'

const urls: string[] = []

class FakeWS {
  static OPEN = 1
  readyState = 0
  onopen: (() => void) | null = null
  onclose: ((e: { code: number }) => void) | null = null
  onerror: (() => void) | null = null
  onmessage: ((e: { data: string }) => void) | null = null
  constructor(url: string) { urls.push(url) }
  close() { /* noop */ }
  send() { /* noop */ }
}

describe('useRemoteChannel — мітка клієнта в адресі', () => {
  beforeEach(() => {
    urls.length = 0
    vi.stubGlobal('WebSocket', FakeWS as unknown as typeof WebSocket)
  })
  afterEach(() => { vi.unstubAllGlobals() })

  it('додає client=remote і не ламає токен', async () => {
    const ch = useRemoteChannel({ onState: () => {} })
    await ch.connect('b2859c15-b985-46f8-ae25-03319864c050')

    expect(urls).toHaveLength(1)
    const url = new URL(urls[0].replace(/^wss:/, 'https:'))

    // мітка на місці й рівно та, яку сервер приймає (білий список board|remote)
    expect(url.searchParams.get('client')).toBe('remote')
    // токен не постраждав від додавання параметра
    expect(url.searchParams.get('token')).toBe('tok/en+with special')
    expect(url.pathname).toBe('/ws/winterboard/b2859c15-b985-46f8-ae25-03319864c050/')
  })
})
