/**
 * Keepalive присутності (2026-09-06) — знайдено на ЖИВОМУ уроці.
 *
 * BE продовжує два ключі з TTL лише повідомленням `presence.heartbeat`
 * (`consumers.py::_handle_heartbeat` → `_redis_presence_refresh` +
 * `_active_session_touch`); штрихи й курсори TTL не чіпають:
 *   - `wb_presence:{session}`    TTL 120с → бейдж «Онлайн/Очікує»
 *   - `wb_active_session:{user}` TTL 180с → пульт /remote
 *
 * Клієнт heartbeat не слав узагалі. Наслідок на уроці: на 2-й хвилині
 * вчитель і учень бачили одне одного «Очікує», хоча обидва малювали; на
 * 3-й — пульт казав «на ноутбуці не відкрита жодна дошка». Дошка при
 * цьому працювала (штрихи йдуть `stroke.broadcast`, повз Redis-presence),
 * тому баг був невидимий для тестів «чи малюється».
 *
 * Тест тримає САМЕ контракт keepalive, а не реалізацію таймера:
 * періодичність < TTL, правильний тип і `userId` (BE рве сокет 4400 при
 * розбіжності), зупинка при disconnect (без витоку інтервалу).
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { ref } from 'vue'

vi.mock('@/utils/apiClient', () => ({
  default: { get: vi.fn(), post: vi.fn() },
  isCircuitBreakerOpen: vi.fn(() => false),
}))
// Гейти connect(): жива авторизація + доступний WS-бекенд. Токен береться
// через authStore.getDecryptedAccess() (див. _getFreshTokenAsync).
vi.mock('@/core/auth/onAuthDeath', () => ({
  isAuthDead: () => false,
  registerAuthDeathCleanup: () => {},
}))
vi.mock('@/modules/auth/store/authStore', () => ({
  useAuthStore: () => ({
    access: 'enc-token',
    getDecryptedAccess: async () => 'test-token',
    refreshAccess: async () => {},
    isAuthenticated: true,
  }),
}))

import { usePresence } from '../composables/usePresence'

const SID = '9f92ea15-3b12-425f-a196-b0a88f7df484'
const USER_ID = '196'

/** Мінімальний WebSocket-дубль: ловить усе, що клієнт шле. */
class FakeWS {
  static OPEN = 1
  static instances: FakeWS[] = []
  readyState = 1
  sent: any[] = []
  onopen: ((e?: any) => void) | null = null
  onmessage: ((e: any) => void) | null = null
  onclose: ((e: any) => void) | null = null
  onerror: ((e: any) => void) | null = null
  constructor(public url: string) {
    FakeWS.instances.push(this)
  }
  send(raw: string) {
    this.sent.push(JSON.parse(raw))
  }
  close() {
    this.readyState = 3
    this.onclose?.({ code: 1000 })
  }
  get types() {
    return this.sent.map((m) => m.type)
  }
}

async function connected() {
  const p = usePresence({
    sessionId: ref<string | null>(SID),
    userId: USER_ID,
    displayName: 'Демо Тьютор',
    color: '#0f7b5f',
  })
  const promise = p.connect(SID)
  await vi.advanceTimersByTimeAsync(0)
  const ws = FakeWS.instances[FakeWS.instances.length - 1]
  ws.onopen?.()
  await promise.catch(() => {})
  return { p, ws }
}

describe('presence keepalive — TTL присутності й пульта не має згасати посеред уроку', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    FakeWS.instances = []
    vi.stubGlobal('WebSocket', FakeWS as any)
  })
  afterEach(() => {
    vi.useRealTimers()
    vi.unstubAllGlobals()
  })

  it('шле presence.heartbeat періодично, поки з’єднання живе', async () => {
    const { ws } = await connected()
    expect(ws.types).toContain('presence.join')
    expect(ws.types).not.toContain('presence.heartbeat')

    await vi.advanceTimersByTimeAsync(46_000)
    expect(ws.types.filter((t) => t === 'presence.heartbeat')).toHaveLength(1)

    await vi.advanceTimersByTimeAsync(46_000)
    expect(ws.types.filter((t) => t === 'presence.heartbeat')).toHaveLength(2)
  })

  it('період істотно менший за TTL 120с навіть з одним пропущеним тіком', async () => {
    const { ws } = await connected()
    // Найгірший сценарій: один тік загубився → наступний має встигнути до 120с.
    await vi.advanceTimersByTimeAsync(119_000)
    const beats = ws.types.filter((t) => t === 'presence.heartbeat').length
    expect(beats).toBeGreaterThanOrEqual(2)
  })

  it('у тілі є власний userId — BE рве сокет 4400 при розбіжності', async () => {
    const { ws } = await connected()
    await vi.advanceTimersByTimeAsync(46_000)
    const beat = ws.sent.find((m) => m.type === 'presence.heartbeat')
    expect(beat).toBeDefined()
    expect(String(beat.userId)).toBe(USER_ID)
  })

  it('після disconnect тіків більше немає (немає витоку інтервалу)', async () => {
    const { p, ws } = await connected()
    await vi.advanceTimersByTimeAsync(46_000)
    const before = ws.types.filter((t) => t === 'presence.heartbeat').length
    expect(before).toBeGreaterThan(0)

    p.disconnect()
    await vi.advanceTimersByTimeAsync(200_000)
    const after = ws.types.filter((t) => t === 'presence.heartbeat').length
    expect(after).toBe(before)
  })

  it('після onclose (обрив мережі) тіків у мертвий сокет немає', async () => {
    const { ws } = await connected()
    await vi.advanceTimersByTimeAsync(46_000)
    const before = ws.types.filter((t) => t === 'presence.heartbeat').length

    ws.onclose?.({ code: 1006 })
    await vi.advanceTimersByTimeAsync(200_000)
    expect(ws.types.filter((t) => t === 'presence.heartbeat').length).toBe(before)
  })
})
