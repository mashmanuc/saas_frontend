/**
 * Б-184 · обʼєкт `number_line` на дошці (ТЗ §4 «Обʼєкт»).
 *
 * Правило вводу — одне:
 *   Enter додає рядок і НІЧОГО не пише; «Застосувати» — рівно один asset_update;
 *   помилка в одному з рядків — нуль asset_update, рисунок і текст на місці;
 *   Esc повертає застосоване; втрата фокусу нічого не пише.
 * Перегляд / запис — рисунок без поля вводу. PDF — знімок, не заглушка.
 *
 * Як у тригонометричних нерівностей: картка — лише рисунок, поля вводу — в інспекторі
 * правого сайдбару (міст numberLineUiState). Тут обидва змонтовано разом, як на дошці.
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import { createI18n } from 'vue-i18n'
import { defineComponent, h, type PropType } from 'vue'
import uk from '../../../i18n/locales/uk.json'
import NumberLineRenderer from '../components/board/objects/NumberLineRenderer.vue'
import NumberLineInspector from '../components/sidebar/NumberLineInspector.vue'
import { numberLineUiState, __resetNumberLineUiForTests } from '../board/state/numberLineUiState'
import { OVERLAY_RENDERERS } from '../components/canvas/overlayRegistry'
import { exportPreviewService } from '../services/exportPreviewService'
import { buildNumberLineAsset } from '../constants/numberLineDefaults'
import type { NumberLineAsset } from '../types/numberLine'

const i18n = () => createI18n({ legacy: false, locale: 'uk', fallbackLocale: 'uk', messages: { uk } as never })

function asset(conditions: NumberLineAsset['data']['conditions'] = [], extra: Partial<NumberLineAsset['data']> = {}): NumberLineAsset {
  return buildNumberLineAsset({ x: 300, y: 200 }, { conditions, ...extra }, 'nl-1')
}

let wrapper: VueWrapper | null = null
afterEach(() => { wrapper?.unmount(); wrapper = null; __resetNumberLineUiForTests() })

/** Картка + інспектор сайдбару (показується, лише коли картка зареєструвала міст). */
const Board = defineComponent({
  props: {
    asset: { type: Object as PropType<NumberLineAsset>, required: true },
    isSelected: { type: Boolean, default: true },
    interactive: { type: Boolean, default: true },
  },
  setup(props) {
    return () => h('div', [
      h(NumberLineRenderer, { asset: props.asset, isSelected: props.isSelected, interactive: props.interactive }),
      numberLineUiState.bridge ? h(NumberLineInspector) : null,
    ])
  },
})

/** Інспектор зʼявляється наступним рендером після того, як картка зареєструвала міст. */
async function mountIt(a: NumberLineAsset, props: Record<string, unknown> = {}) {
  wrapper = mount(Board, {
    props: { asset: a, isSelected: true, interactive: true, ...props },
    global: { plugins: [i18n()] },
    attachTo: document.body,
  })
  await flushPromises()
  return wrapper
}

const updates = (w: VueWrapper) =>
  (w.findComponent(NumberLineRenderer).emitted('update:asset') ?? []) as Array<[NumberLineAsset]>

describe('реєстр оверлеїв', () => {
  it('number_line має рендерер у реєстрі', async () => {
    expect(OVERLAY_RENDERERS.number_line?.component).toBe(NumberLineRenderer)
  })
})

describe('рисунок', () => {
  it('точки, виколота / зафарбована, відповідь з назвою проміжку', async () => {
    const w = await mountIt(asset([{ from: '-3', fromIncluded: false, to: '5', toIncluded: true }]), { isSelected: false })
    const circles = w.findAll('circle')
    expect(circles.map((c) => c.attributes('data-filled'))).toEqual(['0', '1'])
    expect(w.find('[data-testid="number-line-answer"]').text()).toBe('x ∈ (−3; 5] — півінтервал')
    expect(w.findAll('[data-testid="number-line-result"]')).toHaveLength(1)
  })

  it('система: штрихування на кожну умову', async () => {
    const w = await mountIt(asset([{ op: '>', value: '1' }, { op: '<=', value: '4' }]), { isSelected: false })
    expect(w.find('[data-testid="number-line-hatch-0"]').findAll('line').length).toBeGreaterThan(0)
    expect(w.find('[data-testid="number-line-hatch-1"]').findAll('line').length).toBeGreaterThan(0)
  })

  it('немає розвʼязків — «розвʼязків немає (∅)»', async () => {
    const w = await mountIt(asset([{ op: '<', value: '3' }, { op: '>=', value: '3' }]), { isSelected: false })
    expect(w.find('[data-testid="number-line-answer"]').text()).toBe('розвʼязків немає (∅)')
  })

  it('дріб — чисельник над знаменником', async () => {
    const w = await mountIt(asset([{ op: '>=', value: '-1/3' }]), { isSelected: false })
    const texts = w.findAll('text').map((t) => t.text())
    expect(texts).toContain('−1')
    expect(texts).toContain('3')
  })

  it('відповідь можна сховати', async () => {
    const w = await mountIt(asset([{ op: '>', value: '3' }], { showAnswer: false }), { isSelected: false })
    expect(w.find('[data-testid="number-line-answer"]').exists()).toBe(false)
  })

  it('перегляд / запис уроку — без поля вводу', async () => {
    const w = await mountIt(asset([{ op: '>', value: '3' }]), { interactive: false })
    expect(w.find('[data-testid="number-line-editor"]').exists()).toBe(false)
    expect(w.find('svg').exists()).toBe(true)
  })
})

describe('ввід: одне правило (ТЗ §2.3)', () => {
  it('Enter додає рядок і нічого не пише', async () => {
    const w = await mountIt(asset())
    const input = w.find('[data-testid="number-line-input-0"]')
    await input.setValue('x > 1')
    await input.trigger('keydown', { key: 'Enter' })
    await flushPromises()
    expect(w.find('[data-testid="number-line-input-1"]').exists()).toBe(true)
    expect(updates(w)).toHaveLength(0)
  })

  it('«Застосувати» — рівно один asset_update з усіма умовами й «система / сукупність»', async () => {
    const w = await mountIt(asset())
    await w.find('[data-testid="number-line-input-0"]').setValue('x > 1')
    await w.find('[data-testid="number-line-input-0"]').trigger('keydown', { key: 'Enter' })
    await flushPromises()
    await w.find('[data-testid="number-line-input-1"]').setValue('x ≤ 4')
    await w.find('[data-testid="number-line-combine-or"]').trigger('click')
    await w.find('[data-testid="number-line-apply"]').trigger('click')
    const u = updates(w)
    expect(u).toHaveLength(1)
    expect(u[0][0].data.conditions).toEqual([{ op: '>', value: '1' }, { op: '<=', value: '4' }])
    expect(u[0][0].data.combine).toBe('or')
  })

  it('Ctrl+Enter теж застосовує', async () => {
    const w = await mountIt(asset())
    const input = w.find('[data-testid="number-line-input-0"]')
    await input.setValue('x ≠ 2')
    await input.trigger('keydown', { key: 'Enter', ctrlKey: true })
    expect(updates(w)).toHaveLength(1)
  })

  it('помилка в одному рядку — нуль asset_update, пояснення біля рядка, рисунок і текст на місці', async () => {
    const w = await mountIt(asset([{ op: '>', value: '3' }]))
    const answerBefore = w.find('[data-testid="number-line-answer"]').text()
    await w.find('[data-testid="number-line-input-0"]').trigger('keydown', { key: 'Enter' })
    await flushPromises()
    await w.find('[data-testid="number-line-input-1"]').setValue('x <')
    await w.find('[data-testid="number-line-apply"]').trigger('click')
    expect(updates(w)).toHaveLength(0)
    expect(w.find('[data-testid="number-line-error-1"]').text()).toBe('Після «<» очікую число')
    expect(w.find('[data-testid="number-line-error-0"]').exists()).toBe(false)
    expect((w.find('[data-testid="number-line-input-1"]').element as HTMLInputElement).value).toBe('x <')
    expect(w.find('[data-testid="number-line-answer"]').text()).toBe(answerBefore)
  })

  it('корені a·√n — так, 1 + √2 — відмова словами (етап 1б)', async () => {
    const w = await mountIt(asset())
    await w.find('[data-testid="number-line-input-0"]').setValue('x > 1 + √2')
    await w.find('[data-testid="number-line-apply"]').trigger('click')
    expect(updates(w)).toHaveLength(0)
    expect(w.find('[data-testid="number-line-error-0"]').text()).toContain('1 + √2 поки не вмію')
    await w.find('[data-testid="number-line-input-0"]').setValue('x > √12')
    await w.find('[data-testid="number-line-apply"]').trigger('click')
    expect(updates(w)).toHaveLength(1)
    await w.setProps({ asset: updates(w)[0][0] })
    expect(w.find('[data-testid="number-line-answer"]').text()).toBe('x ∈ (√12; +∞) — відкритий промінь')
  })

  it('Esc повертає застосоване', async () => {
    const w = await mountIt(asset([{ op: '>', value: '3' }]))
    const input = w.find('[data-testid="number-line-input-0"]')
    await input.setValue('x < 100')
    expect(w.find('[data-testid="number-line-dirty"]').exists()).toBe(true)
    await input.trigger('keydown', { key: 'Escape' })
    expect((w.find('[data-testid="number-line-input-0"]').element as HTMLInputElement).value).toBe('x > 3')
    expect(updates(w)).toHaveLength(0)
  })

  it('втрата фокусу нічого не пише й не стирає (позначка «не застосовано»)', async () => {
    const w = await mountIt(asset([{ op: '>', value: '3' }]))
    const input = w.find('[data-testid="number-line-input-0"]')
    await input.setValue('x < 100')
    await input.trigger('blur')
    expect(updates(w)).toHaveLength(0)
    expect((input.element as HTMLInputElement).value).toBe('x < 100')
    expect(w.find('[data-testid="number-line-dirty"]').exists()).toBe(true)
  })

  it('Backspace у порожньому рядку прибирає його', async () => {
    const w = await mountIt(asset())
    await w.find('[data-testid="number-line-input-0"]').trigger('keydown', { key: 'Enter' })
    await flushPromises()
    await w.find('[data-testid="number-line-input-1"]').trigger('keydown', { key: 'Backspace' })
    await flushPromises()
    expect(w.find('[data-testid="number-line-input-1"]').exists()).toBe(false)
    expect(updates(w)).toHaveLength(0)
  })

  it('кнопки знаків вставляють знак у рядок', async () => {
    const w = await mountIt(asset())
    await w.find('[data-testid="number-line-input-0"]').setValue('x')
    const keys = w.findAll('.nl-insp__btn--rel')
    await keys.find((k) => k.text() === '≥')!.trigger('click')
    expect((w.find('[data-testid="number-line-input-0"]').element as HTMLInputElement).value.trim()).toBe('x ≥')
  })

  it('нова застосована версія ззовні (скасувати / інший учасник) — поле показує її', async () => {
    const w = await mountIt(asset([{ op: '>', value: '3' }]))
    await w.setProps({ asset: asset([{ op: '<', value: '-1' }]) })
    expect((w.find('[data-testid="number-line-input-0"]').element as HTMLInputElement).value).toBe('x < -1')
  })
})

describe('вигляд як у тригонометричних нерівностей', () => {
  it('картка — лише рисунок: полів вводу в ній немає, вони в інспекторі', async () => {
    const w = await mountIt(asset([{ op: '>', value: '3' }]))
    const card = w.findComponent(NumberLineRenderer)
    expect(card.find('input').exists()).toBe(false)
    expect(w.findComponent(NumberLineInspector).find('[data-testid="number-line-input-0"]').exists()).toBe(true)
  })

  it('інспектор — лише для виділеної картки', async () => {
    const w = await mountIt(asset([{ op: '>', value: '3' }]), { isSelected: false })
    expect(w.find('[data-testid="number-line-editor"]').exists()).toBe(false)
    await w.setProps({ isSelected: true })
    expect(w.find('[data-testid="number-line-editor"]').exists()).toBe(true)
    await w.setProps({ isSelected: false })
    expect(numberLineUiState.bridge).toBeNull()
  })

  it('HUD: вид, формула й відповідь', async () => {
    const w = await mountIt(asset([{ op: '>', value: '1' }, { op: '<=', value: '4' }], { combine: 'or' }), { isSelected: false })
    expect(w.find('[data-testid="number-line-kind"]').text()).toBe('СУКУПНІСТЬ')
    expect(w.find('[data-testid="number-line-formula"]').text()).toBe('x > 1 або x ≤ 4')
  })
})

describe('лінійні нерівності', () => {
  it('2x + 3 > 7 — розвʼязок x > 2, а формула — як записав учитель', async () => {
    const w = await mountIt(asset())
    await w.find('[data-testid="number-line-input-0"]').setValue('2x + 3 > 7')
    await w.find('[data-testid="number-line-apply"]').trigger('click')
    const u = updates(w)
    expect(u).toHaveLength(1)
    expect(u[0][0].data.conditions).toEqual([{ op: '>', value: '2', source: '2x + 3 > 7' }])
    await w.setProps({ asset: u[0][0] })
    expect(w.find('[data-testid="number-line-formula"]').text()).toBe('2x + 3 > 7')
    expect(w.find('[data-testid="number-line-answer"]').text()).toBe('x ∈ (2; +∞) — відкритий промінь')
    expect((w.find('[data-testid="number-line-input-0"]').element as HTMLInputElement).value).toBe('2x + 3 > 7')
  })

  it('коефіцієнт 0 — відповідь на прямій і міркування словами', async () => {
    const w = await mountIt(asset())
    await w.find('[data-testid="number-line-input-0"]').setValue('0x > -1')
    await w.find('[data-testid="number-line-apply"]').trigger('click')
    const u = updates(w)
    expect(u).toHaveLength(1)
    await w.setProps({ asset: u[0][0] })
    expect(w.find('[data-testid="number-line-answer"]').text()).toBe('x ∈ (−∞; +∞) — числова пряма')
    expect(w.find('[data-testid="number-line-zero-note"]').text()).toBe(
      'Коефіцієнт при x дорівнює 0: 0·x = 0 при будь-якому x, а 0 > −1 — правильно, тож x — будь-яке число')
    expect(w.findAll('[data-testid="number-line-result"]')).toHaveLength(1)
  })

  it('нелінійне — пояснення словами, нічого не пишеться', async () => {
    const w = await mountIt(asset())
    await w.find('[data-testid="number-line-input-0"]').setValue('x·x > 4')
    await w.find('[data-testid="number-line-apply"]').trigger('click')
    expect(updates(w)).toHaveLength(0)
    expect(w.find('[data-testid="number-line-error-0"]').text()).toContain('не лінійна')
  })
})

describe('метод інтервалів (етап 2)', () => {
  const iv = (extra: Partial<NumberLineAsset['data']>) => asset([], { mode: 'intervals', ...extra })

  it('вираз: Enter застосовує — рівно один asset_update; картка показує знаки й виколотий нуль знаменника', async () => {
    const w = await mountIt(asset())
    await w.find('[data-testid="number-line-mode-intervals"]').trigger('click')
    const input = w.find('[data-testid="number-line-expression"]')
    await input.setValue('(x-1)(x+3)/(x-2) ≥ 0')
    await input.trigger('keydown', { key: 'Enter' })
    const u = updates(w)
    expect(u).toHaveLength(1)
    expect(u[0][0].data).toMatchObject({ mode: 'intervals', expression: '(x-1)(x+3)/(x-2)', rhs: '0', op: '>=' })
    await w.setProps({ asset: u[0][0] })
    expect(w.find('[data-testid="number-line-kind"]').text()).toBe('МЕТОД ІНТЕРВАЛІВ')
    expect(w.find('[data-testid="number-line-formula"]').text()).toBe('(x-1)(x+3)/(x-2) ≥ 0')
    expect(w.find('[data-testid="number-line-answer"]').text()).toBe('x ∈ [−3; 1] ∪ (2; +∞)')
    expect([0, 1, 2, 3].map((i) => w.find(`[data-testid="number-line-sign-${i}"]`).text())).toEqual(['−', '+', '−', '+'])
    expect(w.findAll('circle').map((c) => c.attributes('data-filled'))).toEqual(['1', '1', '0'])
    expect(w.findAll('[data-testid="number-line-snake"]')).toHaveLength(4)
  })

  it('помилка у виразі — нуль записів, пояснення під полем', async () => {
    const w = await mountIt(iv({ expression: 'x - 1', rhs: '0', op: '>' }))
    const input = w.find('[data-testid="number-line-expression"]')
    expect((input.element as HTMLInputElement).value).toBe('x - 1 > 0')
    await input.setValue('(x-1)(x+2) = 0')
    await w.find('[data-testid="number-line-apply"]').trigger('click')
    expect(updates(w)).toHaveLength(0)
    expect(w.find('[data-testid="number-line-iv-error"]').text()).toBe('Потрібна нерівність зі знаком <, ≤, > або ≥')
    expect(w.find('[data-testid="number-line-answer"]').text()).toBe('x ∈ (1; +∞) — відкритий промінь')
    await input.trigger('keydown', { key: 'Escape' })
    expect((w.find('[data-testid="number-line-expression"]').element as HTMLInputElement).value).toBe('x - 1 > 0')
  })

  it('вручну: точки за значенням, клік — виколота, знаки й знак нерівності від учителя', async () => {
    const w = await mountIt(asset())
    await w.find('[data-testid="number-line-mode-intervals"]').trigger('click')
    await w.find('[data-testid="number-line-iv-manual"]').trigger('click')
    await w.find('[data-testid="number-line-points"]').setValue('2; -3; 1')
    expect(w.findAll('[data-testid^="number-line-point-chip-"]').map((c) => c.text())).toEqual(['−3', '1', '2'])
    await w.find('[data-testid="number-line-op->="]').trigger('click')
    await w.find('[data-testid="number-line-point-chip-2"]').trigger('click') // 2 — виколота
    expect([0, 1, 2, 3].map((i) => w.find(`[data-testid="number-line-sign-btn-${i}"]`).text())).toEqual(['−', '+', '−', '+'])
    await w.find('[data-testid="number-line-apply"]').trigger('click')
    const u = updates(w)
    expect(u).toHaveLength(1)
    expect(u[0][0].data).toMatchObject({
      mode: 'intervals',
      op: '>=',
      points: [{ value: '-3', included: true }, { value: '1', included: true }, { value: '2', included: false }],
      signs: ['-', '+', '-', '+'],
    })
    expect(u[0][0].data.expression).toBeUndefined()
    await w.setProps({ asset: u[0][0] })
    expect(w.find('[data-testid="number-line-answer"]').text()).toBe('x ∈ [−3; 1] ∪ (2; +∞)')
  })

  it('вручну: знак на проміжку перемикається кліком', async () => {
    const w = await mountIt(iv({ points: [{ value: '0', included: false }], signs: ['-', '+'], op: '>' }))
    expect(w.find('[data-testid="number-line-iv-manual"]').classes()).toContain('is-active')
    await w.find('[data-testid="number-line-sign-btn-0"]').trigger('click')
    expect(w.find('[data-testid="number-line-dirty"]').exists()).toBe(true)
    await w.find('[data-testid="number-line-apply"]').trigger('click')
    expect(updates(w)[0][0].data.signs).toEqual(['+', '+'])
  })

  it('перемкнути режим без «Застосувати» — нічого не пише, позначка «не застосовано»', async () => {
    const w = await mountIt(asset([{ op: '>', value: '3' }]))
    await w.find('[data-testid="number-line-mode-intervals"]').trigger('click')
    expect(updates(w)).toHaveLength(0)
    expect(w.find('[data-testid="number-line-dirty"]').exists()).toBe(true)
    expect(w.find('[data-testid="number-line-answer"]').text()).toBe('x ∈ (3; +∞) — відкритий промінь')
  })
})

describe('чернетка проти змін ззовні', () => {
  it('незастосована чернетка не стирається, коли застосоване змінилось ззовні', async () => {
    const w = await mountIt(asset([{ op: '>', value: '3' }]))
    await w.find('[data-testid="number-line-input-0"]').setValue('x ≤ 7')
    await w.setProps({ asset: asset([{ op: '<', value: '-1' }]) })
    expect((w.find('[data-testid="number-line-input-0"]').element as HTMLInputElement).value).toBe('x ≤ 7')
    expect(w.find('[data-testid="number-line-dirty"]').exists()).toBe(true)
    expect(w.find('[data-testid="number-line-answer"]').text()).toBe('x ∈ (−∞; −1) — відкритий промінь')
  })
})

describe('PDF: знімок, а не заглушка (інваріант 4а)', () => {
  it('рендер реєструє знімок у сервісі експорту', async () => {
    const spy = vi.spyOn(exportPreviewService, 'register')
    await mountIt(asset([{ op: '>', value: '3' }]))
    expect(spy).toHaveBeenCalledWith('nl-1', expect.any(Function))
    spy.mockRestore()
  })
})
