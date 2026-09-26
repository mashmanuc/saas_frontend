/**
 * Справжній роутер + гейт, як їх з'єднує `main.js`: поки вихід не підтверджено
 * сервером, жодна сторінка з даними не відкривається (ТЗ спільного екрана, R6).
 * Тест імпортує `src/router/index.js`, а не копію маршрутів.
 */
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { clearLogoutPending, markLogoutPending } from '../pendingLogout'
import { installLogoutGate } from '../logoutGate'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

async function gatedRouter() {
  const { default: router } = await import('@/router/index.js')
  if (!router.hasRoute('logout-pending')) installLogoutGate(router)
  return router
}

beforeEach(() => {
  setActivePinia(createPinia())
  localStorage.clear()
})

afterEach(() => {
  clearLogoutPending()
})

describe('роутер · гейт «вихід не завершено»', () => {
  it('з маркером будь-яка сторінка веде на екран блокування', { timeout: 120_000 }, async () => {
    markLogoutPending()
    const router = await gatedRouter()
    await router.push('/winterboard/11111111-1111-4111-8111-111111111111')
    expect(router.currentRoute.value.path).toBe('/logout-pending')

    await router.push('/start')
    expect(router.currentRoute.value.path).toBe('/logout-pending')
  })

  it('з маркером можна лише на вхід іншим акаунтом', { timeout: 120_000 }, async () => {
    markLogoutPending()
    const router = await gatedRouter()
    await router.push({ path: '/auth/login', query: { switch: '1' } })
    expect(router.currentRoute.value.path).toBe('/auth/login')
  })

  it('без маркера гейт не заважає', { timeout: 120_000 }, async () => {
    const router = await gatedRouter()
    await router.push('/start')
    expect(router.currentRoute.value.path).toBe('/start')
  })
})

describe('main.js ставить гейт до монтування', () => {
  it('installLogoutGate(router) викликається перед app.use(router)', () => {
    const main = readFileSync(resolve(__dirname, '../../../../main.js'), 'utf-8')
    const gate = main.indexOf('installLogoutGate(router)')
    expect(gate).toBeGreaterThan(-1)
    expect(gate).toBeLessThan(main.indexOf('app.use(router)'))
  })
})
