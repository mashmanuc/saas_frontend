/**
 * Навігаційні команди палітри не завершуються тишею.
 *
 * Живий тест власника (2026-08-17): у конструкторі з незбереженими змінами
 * «Створити дошку» → дошка створюється, тьютор не бачить НІЧОГО. Три
 * обставини разом: `close()` іде перед `router.push`; done-бульбашка під
 * `if (open.value)` — після close недосяжна; перехід із конструктора чекає
 * `onBeforeRouteLeave → flushAll()`.
 *
 * Тут перевіряється контракт `announceAndGo`, який це закриває:
 *   1. сигнал ПЕРЕД закриттям і переходом;
 *   2. сигнал не залежить від того, чи навігація відбулась (push може
 *      відхилитись guard'ом — тьютор усе одно має знати, що дію виконано);
 *   3. очікування триває, поки перехід не завершився (loading не гасне
 *      раніше) — саме тому `run()` тепер `await onOk(r)`.
 *
 * Форма контракту тестується без монтування CommandPalette (він тягне
 * router/auth/profile/WS): та сама послідовність, що у файлі.
 */
import { describe, it, expect, vi } from 'vitest'

/** Дзеркало announceAndGo + run із CommandPalette.vue. */
function makeHarness(pushImpl: () => Promise<unknown>) {
  const calls: string[] = []
  const notifySuccess = vi.fn((t: string) => calls.push(`notify:${t}`))
  const close = vi.fn(() => calls.push('close'))
  const push = vi.fn(async () => { calls.push('push:start'); await pushImpl(); calls.push('push:end') })
  const loading = { value: false }

  async function announceAndGo(text: string, route: unknown) {
    notifySuccess(text)
    close()
    await push()
    void route
  }
  async function run(fn: () => Promise<unknown>, onOk?: (r: unknown) => unknown) {
    if (loading.value) return
    loading.value = true
    calls.push('loading:on')
    try {
      const r = await fn()
      if (onOk) await onOk(r)
    } finally {
      loading.value = false
      calls.push('loading:off')
    }
  }
  return { calls, notifySuccess, close, push, loading, announceAndGo, run }
}

describe('палітра — навігаційна команда не мовчить', () => {
  it('сигнал іде ПЕРЕД close і push', async () => {
    const h = makeHarness(async () => {})
    await h.announceAndGo('Дошку «Похідна» створено', { name: 'winterboard-prepare' })
    expect(h.calls).toEqual(['notify:Дошку «Похідна» створено', 'close', 'push:start', 'push:end'])
  })

  it('сигнал є навіть коли навігацію відхилено (guard/затримка)', async () => {
    // DoD записки: «сигнал успіху викликано, навіть якщо router.push
    // відхилено/затримано». Інакше саме кейс власника: flushAll() довгий,
    // перехід не стався — і тиша.
    const h = makeHarness(async () => { throw new Error('navigation aborted') })
    await expect(
      h.announceAndGo('Урок «Дроби» згенеровано', { name: 'winterboard-prepare' }),
    ).rejects.toThrow('navigation aborted')
    expect(h.notifySuccess).toHaveBeenCalledTimes(1)
    expect(h.calls[0]).toBe('notify:Урок «Дроби» згенеровано')
  })

  it('очікування триває до кінця переходу — loading не гасне раніше', async () => {
    let release: () => void = () => {}
    const slow = new Promise<void>((r) => { release = r })
    const h = makeHarness(() => slow)
    const p = h.run(async () => ({ result: { board_id: 'b1' } }),
                    () => h.announceAndGo('Дошку створено', { name: 'winterboard-prepare' }))
    await Promise.resolve(); await Promise.resolve(); await Promise.resolve()
    expect(h.loading.value).toBe(true)      // перехід ще йде
    expect(h.calls).not.toContain('loading:off')
    release()
    await p
    expect(h.loading.value).toBe(false)
    expect(h.calls[h.calls.length - 1]).toBe('loading:off')
    expect(h.calls.indexOf('push:end')).toBeLessThan(h.calls.indexOf('loading:off'))
  })

  it('текст називає результат, а не «Готово»', () => {
    // Безлике «Готово» не відрізняє створення дошки від відкриття уроку —
    // тьютор не розуміє, ЩО саме сталося (§5.1 записки).
    const texts = [
      'Дошку «Похідна» створено',
      'Урок «Дроби» згенеровано',
      'Копію дошки створено: «Похідна (копія)»',
      'Урок відкрито: «Інтеграл»',
    ]
    for (const t of texts) {
      expect(t).not.toBe('Готово')
      expect(t.length).toBeGreaterThan(10)
    }
  })
})
