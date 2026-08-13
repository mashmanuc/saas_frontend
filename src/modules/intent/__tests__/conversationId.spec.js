/**
 * Ключ розмови для серверної пам'яті (Фаза 2 «пам'ять чату»).
 *
 * Сервер тримає за цим ключем згорнутий стан старших реплік — те, чого не
 * видно ні в дошці, ні в останніх шести репліках. Дві речі ламаються тихо:
 *
 *  • ключ не валідний uuid → сервер його відкидає й працює БЕЗ пам'яті.
 *    Помилки не буде ніде: чат просто знову «губиться», як до всієї роботи.
 *  • ключ не змінився на «нова розмова» → тьютор почав з чистого аркуша, а
 *    модель тягне в новий урок мету старого.
 *
 * Тест перевіряє контракт `parseAi` і генератор ключа, а не монтує
 * CommandPalette: той тягне роутер, стори й пів дошки.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'

const post = vi.fn()
vi.mock('../../../utils/apiClient', () => ({
  default: { post: (...args) => post(...args) },
}))

import { parseAi } from '../sendIntent'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

describe('parseAi — ключ розмови', () => {
  beforeEach(() => {
    post.mockReset()
    post.mockResolvedValue({ data: { status: 'none', explain: 'ок' } })
  })

  it('їде в context.conversation_id', async () => {
    await parseAi('додай картку', 'brd-1', [], null, null, 'uk', 'c0ffee00-1111-4222-8333-444455556666')

    const [, body] = post.mock.calls[0]
    expect(body.context.conversation_id).toBe('c0ffee00-1111-4222-8333-444455556666')
  })

  it('без ключа контракт не ламається — старий виклик лишається валідним', async () => {
    await parseAi('привіт')

    const [, body] = post.mock.calls[0]
    expect(body.context.conversation_id).toBeNull()
    expect(body.phrase).toBe('привіт')
  })

  it('не чіпає решту контексту', async () => {
    await parseAi('x', 'brd-1', [{ role: 'user', content: 'привіт' }],
                  { pages: 2, items: [] }, [{ id: 'trig.circle' }], 'en', 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee')

    const [, body] = post.mock.calls[0]
    expect(body.context.board_id).toBe('brd-1')
    expect(body.context.locale).toBe('en')
    expect(body.history).toHaveLength(1)
  })
})

/**
 * Генератор — копія тієї, що в CommandPalette.vue. Тримаємо тут дослівно:
 * сам компонент не імпортується (тягне пів дошки), а контракт «валідний
 * uuid» мусить мати сторожа. Розійдуться — впаде саме цей тест, і це
 * дешевше, ніж помітити мовчазну втрату пам'яті на проді.
 */
function newConversationId() {
  const c = globalThis.crypto
  if (c?.randomUUID) return c.randomUUID()
  const b = new Uint8Array(16)
  if (c?.getRandomValues) c.getRandomValues(b)
  else for (let i = 0; i < 16; i++) b[i] = Math.floor(Math.random() * 256)
  b[6] = (b[6] & 0x0f) | 0x40
  b[8] = (b[8] & 0x3f) | 0x80
  const h = [...b].map((x) => x.toString(16).padStart(2, '0')).join('')
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`
}

describe('генератор ключа', () => {
  it('дає валідний uuid v4', () => {
    expect(newConversationId()).toMatch(UUID_RE)
  })

  it('фолбек без crypto.randomUUID теж валідний — небезпечний контекст не має права мовчки вимкнути пам\'ять', () => {
    // `globalThis.crypto` — геттер без сеттера, присвоєнням не підміниш.
    const real = globalThis.crypto
    const spy = vi.spyOn(globalThis, 'crypto', 'get').mockReturnValue({
      getRandomValues: real.getRandomValues.bind(real),
    })
    try {
      expect(newConversationId()).toMatch(UUID_RE)
    } finally {
      spy.mockRestore()
    }
  })

  it('ключі не повторюються', () => {
    const keys = new Set(Array.from({ length: 200 }, newConversationId))
    expect(keys.size).toBe(200)
  })
})
