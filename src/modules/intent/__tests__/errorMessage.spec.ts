/**
 * Читач помилок палітри — три форми відповіді бекенда.
 *
 * ⚠️ Головне, що фіксують ці тести, — ПОПРАВКА до звіту, який ходив між
 * сесіями 2026-08-26: «мапа ERR_MSG мертва, дев'ять повідомлень не
 * показуються жодного разу». Перевірка коду показала інше:
 *
 *   • для ПЛОСКОЇ форми ВЕЛИКИМИ (основний шлях палітри — усі CapabilityError
 *     через `apps/intent/api/views.py:80`) мапа працювала і працює;
 *   • сліпою вона була до ВКЛАДЕНОЇ форми глобального DRF-обробника
 *     (`apps/core/errors.py:279`) — тобто до відмов у правах, throttle і 500.
 *
 * Тобто дефект вужчий, ніж повідомлялось, але справжній: саме на відмові в
 * правах тьютор бачив «Request failed with status code 403».
 */
import { describe, it, expect } from 'vitest'

import { errorCodeOf, errorDetailOf, humanErrorMessage } from '../errorMessage'

const MESSAGES = {
  TASK_SELECTION_FAILED: 'Недостатньо задач',
  AUTH_FORBIDDEN: 'Немає доступу',
}

const wrap = (data: unknown, message = 'Request failed with status code 403') =>
  ({ response: { data }, message })

describe('errorCodeOf — три форми', () => {
  it('плоска ВЕЛИКИМИ (основний шлях палітри)', () => {
    expect(errorCodeOf({ error: 'TASK_SELECTION_FAILED' })).toBe('TASK_SELECTION_FAILED')
  })

  it('вкладена (глобальний DRF-обробник) — код усередині об\'єкта', () => {
    expect(errorCodeOf({ error: { code: 'AUTH_FORBIDDEN', detail: 'x' } }))
      .toBe('AUTH_FORBIDDEN')
  })

  it('плоска малими — нормалізується до ВЕЛИКИХ', () => {
    expect(errorCodeOf({ error: 'task_selection_failed' })).toBe('TASK_SELECTION_FAILED')
  })

  it('нема коду — null, а не undefined-ключ у мапі', () => {
    expect(errorCodeOf(undefined)).toBeNull()
    expect(errorCodeOf({})).toBeNull()
    expect(errorCodeOf({ error: 42 })).toBeNull()
  })
})

describe('errorDetailOf — detail живе у двох різних місцях', () => {
  it('плоска форма: поруч із error', () => {
    expect(errorDetailOf({ error: 'X', detail: 'поруч' })).toBe('поруч')
  })

  it('вкладена форма: УСЕРЕДИНІ error — саме тут читач і сліпнув', () => {
    expect(errorDetailOf({ error: { code: 'X', detail: 'усередині' } })).toBe('усередині')
  })

  it('нема жодного — null', () => {
    expect(errorDetailOf({ error: { code: 'X' } })).toBeNull()
  })
})

describe('humanErrorMessage — що побачить тьютор', () => {
  it('плоска ВЕЛИКИМИ: мапа працювала й раніше — це не регресія', () => {
    expect(humanErrorMessage(wrap({ error: 'TASK_SELECTION_FAILED' }), MESSAGES))
      .toBe('Недостатньо задач')
  })

  it('🔴 ВКЛАДЕНА: справжній дефект — раніше падало аж до тексту axios', () => {
    const err = wrap({ error: { code: 'AUTH_FORBIDDEN', detail: 'no role' } })
    // Стара логіка: ERR_MSG[об'єкт] → undefined; d.detail → undefined
    //               (він усередині error) → e.message.
    expect(err.message).toBe('Request failed with status code 403')
    expect(humanErrorMessage(err, MESSAGES)).toBe('Немає доступу')
  })

  it('код невідомий — технічний detail бекенда, а не текст axios', () => {
    expect(humanErrorMessage(wrap({ error: 'НЕВІДОМИЙ', detail: 'з бекенда' }), MESSAGES))
      .toBe('з бекенда')
  })

  it('вкладена з невідомим кодом — detail дістається зсередини', () => {
    expect(humanErrorMessage(wrap({ error: { code: 'НЕВІДОМИЙ', detail: 'зсередини' } }), MESSAGES))
      .toBe('зсередини')
  })

  it('нічого читабельного — текст винятку', () => {
    expect(humanErrorMessage(wrap({}), MESSAGES)).toBe('Request failed with status code 403')
  })

  it('нема навіть винятку — свій fallback', () => {
    expect(humanErrorMessage(undefined, MESSAGES, 'Помилка AI')).toBe('Помилка AI')
  })

  it('порожня мапа не ламає читача', () => {
    expect(humanErrorMessage(wrap({ error: 'X', detail: 'd' }), undefined)).toBe('d')
  })
})

describe('kill-тести: без фікса ці випадки провалюються', () => {
  it('вкладену форму не можна прочитати старим способом', () => {
    const d: any = { error: { code: 'AUTH_FORBIDDEN', detail: 'no role' } }
    // Дослівно стара логіка з CommandPalette.vue:404.
    const old = MESSAGES[d?.error as keyof typeof MESSAGES] || d?.detail
    expect(old).toBeUndefined()
  })

  it('плоский код малими не знаходився в мапі ВЕЛИКИМИ', () => {
    const d: any = { error: 'task_selection_failed' }
    expect(MESSAGES[d.error as keyof typeof MESSAGES]).toBeUndefined()
    expect(humanErrorMessage(wrap(d), MESSAGES)).toBe('Недостатньо задач')
  })
})
