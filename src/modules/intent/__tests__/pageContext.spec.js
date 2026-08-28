/**
 * E3 (2026-08-28): де саме тьютор — їде в контекст `parseAi`.
 *
 * Живий випадок власника на `/tutor/schedule`: «що ти тут бачиш на сторінці і
 * що на цій сторінці ти можеш робити» → «зараз я не бачу відкритої дошки».
 * Модель не помилилась: у контексті не було нічого, крім `board_id: null`, тож
 * єдине, що вона знала, стосувалось дошки. Питання було не про дошку.
 *
 * Маршрут у палітри був завжди (`useRoute()` для навігації) — просто не
 * доїжджав до моделі. Тест стереже саме цей дріт.
 *
 * Перевіряємо контракт `parseAi`, а не CommandPalette: той тягне роутер, стори
 * й пів дошки — той самий підхід, що у `conversationId.spec.js`.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'

const post = vi.fn()
vi.mock('../../../utils/apiClient', () => ({
  default: { post: (...args) => post(...args) },
}))

import { parseAi } from '../sendIntent'

const PAGE = { path: '/tutor/schedule', name: 'tutor-calendar' }

describe('parseAi — поточна сторінка', () => {
  beforeEach(() => {
    post.mockReset()
    post.mockResolvedValue({ data: { status: 'none', explain: 'ок' } })
  })

  it('їде в context.page', async () => {
    await parseAi('що я тут можу', null, [], null, null, 'uk', null, PAGE)

    const [, body] = post.mock.calls[0]
    expect(body.context.page).toEqual(PAGE)
  })

  it('їде навіть коли дошки немає — саме заради цього випадку все й робилось', async () => {
    await parseAi('яка вкладка відкрита', null, [], null, null, 'uk', null, PAGE)

    const [, body] = post.mock.calls[0]
    expect(body.context.board_id).toBeNull()
    expect(body.context.page.path).toBe('/tutor/schedule')
  })

  it('без сторінки контракт не ламається — старі виклики лишаються чинними', async () => {
    await parseAi('привіт')

    const [, body] = post.mock.calls[0]
    expect(body.context.page).toBeNull()
  })
})
