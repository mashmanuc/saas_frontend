/**
 * Часова шкала відео й аудіо на пульті — LAW §9 v1.57 (власник 2026-10-25: «треба невеличку часову шкалу на пульт для
 * відео і аудіо, щоб вчитель міг бачити» → «роби»).
 *
 *   INV-TIME-P1  розбір `pos`/`dur` — дзеркало сервера: лише відео/аудіо, секунди 0…доба, тривалість > 0,
 *                місце не далі за кінець; зіпсоване — поле `scenario` відкинуто цілим
 *   INV-TIME-P2  смужка й «0:42 / 3:26» — лише коли тривалість відома; поки грає, телефон рухає їх сам
 *                (місце від ноутбука + скільки минуло), не далі за кінець; на паузі — стоїть
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { createI18n } from 'vue-i18n'
import uk from '../../../i18n/locales/uk.json'
import { parseRemoteScenario, type RemoteScenarioItem } from '../composables/useRemoteChannel'
import RemoteObjectControls from '../components/remote/RemoteObjectControls.vue'

const raw = (extra: Record<string, unknown>, kind = 'audio') =>
  ({ focus_id: null, items: [{ object_id: 'mel-01', kind, title: 'Мелодія', page_index: 2, minimized: false, ...extra }] })

describe('INV-TIME-P1 · розбір', () => {
  it('відео й аудіо: місце й тривалість доходять; місце далі за кінець — кінець; без них — як було', () => {
    expect(parseRemoteScenario(raw({ state: 'playing', pos: 42.4, dur: 206.9 }))!.items[0]).toMatchObject({ pos: 42.4, dur: 206.9 })
    expect(parseRemoteScenario(raw({ pos: 210, dur: 206.9 }, 'video'))!.items[0].pos).toBe(206.9)
    const plain = parseRemoteScenario(raw({ state: 'paused' }))!.items[0]
    expect(plain).not.toHaveProperty('pos')
    expect(plain).not.toHaveProperty('dur')
  })

  it.each([
    [{ pos: -1, dur: 10 }], [{ pos: '3', dur: 10 }], [{ pos: 1, dur: 0 }], [{ pos: 1, dur: 24 * 3600 + 1 }],
  ])('зіпсоване %j — поле відкинуто цілим', (extra) => {
    expect(parseRemoteScenario(raw(extra))).toBeUndefined()
  })

  it('не в програвача — зіпсоване поле', () => {
    expect(parseRemoteScenario(raw({ pos: 1, dur: 10 }, 'image'))).toBeUndefined()
  })
})

describe('INV-TIME-P2 · смужка на пульті', () => {
  const i18n = createI18n({ legacy: false, locale: 'uk', messages: { uk } })
  const item = (extra: Partial<RemoteScenarioItem>): RemoteScenarioItem =>
    ({ objectId: 'mel-01', kind: 'audio', title: 'Мелодія', pageIndex: 2, minimized: false, ...extra })
  const mountItem = (it: RemoteScenarioItem) => mount(RemoteObjectControls, {
    props: { item: it, focusId: null, ready: true, idPrefix: 'object', variant: 'main' },
    global: { plugins: [i18n] },
  })

  beforeEach(() => { vi.useFakeTimers(); vi.setSystemTime(new Date('2026-10-28T10:00:00Z')) })
  afterEach(() => vi.useRealTimers())

  it('грає — телефон рухає час сам; не далі за кінець', async () => {
    const w = mountItem(item({ state: 'playing', pos: 42.4, dur: 206.9 }))
    expect(w.find('[data-testid=object-time-text]').text()).toBe('0:42 / 3:26')
    await vi.advanceTimersByTimeAsync(3000)
    expect(w.find('[data-testid=object-time-text]').text()).toBe('0:45 / 3:26')
    await vi.advanceTimersByTimeAsync(400_000)
    expect(w.find('[data-testid=object-time-text]').text()).toBe('3:26 / 3:26')
    expect(w.find('.wb-scn__time-fill').attributes('style')).toContain('width: 100%')
    w.unmount()
  })

  it('на паузі — стоїть; новий стан від ноутбука — нове місце', async () => {
    const w = mountItem(item({ state: 'paused', pos: 65, dur: 3725 }))
    await vi.advanceTimersByTimeAsync(5000)
    expect(w.find('[data-testid=object-time-text]').text()).toBe('1:05 / 1:02:05')
    await w.setProps({ item: item({ state: 'playing', pos: 10, dur: 3725 }) })
    await vi.advanceTimersByTimeAsync(2000)
    expect(w.find('[data-testid=object-time-text]').text()).toBe('0:12 / 1:02:05')
    w.unmount()
  })

  it('тривалість невідома (старий ноутбук чи плеєр не готовий) — смужки немає', () => {
    const w = mountItem(item({ state: 'playing', pos: 3 }))
    expect(w.find('[data-testid=object-time]').exists()).toBe(false)
    w.unmount()
  })
})
