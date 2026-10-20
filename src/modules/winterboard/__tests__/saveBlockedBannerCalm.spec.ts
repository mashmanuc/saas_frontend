/**
 * LAW v1.39 — банер зупинки збереження (власник 2026-10-20).
 *
 * «Користувач не буде розбиратися, він не розуміє, що таке завантажити копію, відкинути… Він тільки повинен бачити,
 * що зв'язок обірвався. І ми це будемо намагатись зберегти.»
 *   · обрив зв'язку (дошка зберігає сама) — лише «Зв'язок обірвався — зберігаємо…», без цифр і кнопок;
 *   · рідкісні поломки — одне просте речення; цифри й дії лише за «Що робити?».
 */
import { describe, it, expect, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { createI18n } from 'vue-i18n'
import uk from '@/i18n/locales/uk.json'
import OpsSaveBlockedBanner from '../components/dialogs/OpsSaveBlockedBanner.vue'
import { useOpsSyncStore } from '../stores/opsSyncStore'

function block(kind: string, extra: Record<string, unknown> = {}) {
  const store = useOpsSyncStore()
  store.sessionId = 's1'
  store.mode = 'SAVE_BLOCKED'
  store.saveBlock = {
    kind, httpStatus: 0, reason: null, invalidOpIndex: null, invalidOpId: null, invalidOpType: null,
    retryNotBefore: null, at: Date.now(), feBuild: 'x', storageOk: true, restored: false, ...extra,
  } as never
  store.inFlightOps = [{ op_id: 'a', op_type: 'stroke_add', page_id: 'p1', payload: {} }] as never
  return store
}

function mountBanner() {
  const i18n = createI18n({ legacy: false, locale: 'uk', fallbackLocale: 'uk', messages: { uk } as never })
  return mount(OpsSaveBlockedBanner, { global: { plugins: [i18n] } })
}

const S = (uk as never as { winterboard: { errors: { saveBlocked: Record<string, never> } } }).winterboard.errors.saveBlocked

beforeEach(() => setActivePinia(createPinia()))

describe('обрив зв’язку — лише «зберігаємо», без технічного', () => {
  it('один рядок, жодних цифр і кнопок, не «тривога»', () => {
    block('unconfirmed')
    const w = mountBanner()
    const calm = w.get('[data-testid="wb-save-auto"]')
    expect(calm.text()).toBe('Зв’язок обірвався — зберігаємо, щойно повернеться')
    expect(calm.attributes('role')).toBe('status')
    expect(w.findAll('button')).toHaveLength(0)
    expect(w.text()).not.toContain(S.export)
    expect(w.text()).not.toContain(S.discard)
    expect(w.text()).not.toContain('Змін ще не на сервері')
  })

  it('копія на комп’ютері не лягла — одне людське застереження', () => {
    block('unconfirmed', { storageOk: false })
    expect(mountBanner().text()).toContain('Не закривайте цю вкладку, доки не збережеться.')
  })

  it('«забагато запитів» — так само спокійно', () => {
    block('rate_limited', { retryNotBefore: Date.now() + 5000 })
    expect(mountBanner().find('[data-testid="wb-save-auto"]').exists()).toBe(true)
  })
})

describe('рідкісні поломки — дії сховані за «Що робити?»', () => {
  it('сервер відхилив зміну: просте речення; цифр і кнопок не видно, доки не натиснули «Що робити?»', async () => {
    block('rejected', { invalidOpType: 'stroke_add' })
    const w = mountBanner()
    expect(w.find('[data-testid="wb-save-auto"]').exists()).toBe(false)
    expect(w.text()).toContain('Останні зміни не вдалося зберегти — вони лишаються на цьому комп’ютері.')
    expect(w.text()).not.toContain(S.export)
    expect(w.text()).not.toContain('Змін ще не на сервері')
    await w.get('[data-testid="wb-save-more"]').trigger('click')
    expect(w.text()).toContain(S.export)
    expect(w.text()).toContain(S.discard)
    expect(w.text()).toContain('Змін ще не на сервері: 1')
  })

  it('звірка не змогла довести (автоспроби зупинено) — теж без кнопок на виду', () => {
    const store = block('unconfirmed')
    store.blockedAutoStopped = true
    const w = mountBanner()
    expect(w.find('[data-testid="wb-save-auto"]').exists()).toBe(false)
    expect(w.find('[data-testid="wb-save-more"]').exists()).toBe(true)
    expect(w.text()).not.toContain(S.discard)
  })
})
