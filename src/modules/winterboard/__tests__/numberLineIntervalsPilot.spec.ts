/**
 * Числова пряма: «Знаки інтервалів» — усім, хто увійшов (власник 2026-10-14: «треба, щоб вже для всіх
 * користувачів було увімкнено»; до того — лише id 40). Гість без акаунта — без галочки (сервер
 * розвʼязувача вимагає входу). Перемикача режимів немає ні в кого (ТЗ «один рядок» §1).
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import { createI18n } from 'vue-i18n'
import { defineComponent, h, type PropType } from 'vue'
import uk from '../../../i18n/locales/uk.json'
import NumberLineRenderer from '../components/board/objects/NumberLineRenderer.vue'
import NumberLineInspector from '../components/sidebar/NumberLineInspector.vue'
import { numberLineUiState, __resetNumberLineUiForTests } from '../board/state/numberLineUiState'
import { buildNumberLineAsset } from '../constants/numberLineDefaults'
import type { NumberLineAsset } from '../types/numberLine'

const auth = vi.hoisted(() => ({ user: { id: 40 } as { id: number } | null }))
vi.mock('@/modules/auth/store/authStore', () => ({ useAuthStore: () => auth }))

const i18n = () => createI18n({ legacy: false, locale: 'uk', fallbackLocale: 'uk', messages: { uk } as never })

const Board = defineComponent({
  props: { asset: { type: Object as PropType<NumberLineAsset>, required: true } },
  setup(props) {
    return () => h('div', [
      h(NumberLineRenderer, { asset: props.asset, isSelected: true, interactive: true }),
      numberLineUiState.bridge ? h(NumberLineInspector) : null,
    ])
  },
})

let wrapper: VueWrapper | null = null
afterEach(() => { wrapper?.unmount(); wrapper = null; __resetNumberLineUiForTests(); auth.user = { id: 40 } })

async function mountWith(userId: number | null, extra: Partial<NumberLineAsset['data']> = {}) {
  auth.user = userId === null ? null : { id: userId }
  const a = buildNumberLineAsset({ x: 300, y: 200 }, { conditions: [], ...extra }, 'nl-pilot')
  wrapper = mount(Board, { props: { asset: a }, global: { plugins: [i18n()] }, attachTo: document.body })
  await flushPromises()
  return wrapper
}

describe('«Знаки інтервалів» — усім, хто увійшов', () => {
  it('id 40 бачить галочку «Знаки інтервалів»; перемикача режимів немає', async () => {
    const w = await mountWith(40)
    expect(w.find('[data-testid="number-line-signs"]').exists()).toBe(true)
    expect(w.find('[data-testid^="number-line-mode-"]').exists()).toBe(false)
    expect(w.find('[data-testid="number-line-input-0"]').exists()).toBe(true)
  })

  it('будь-який учитель (не лише 40) — галочка є, нерівності працюють', async () => {
    const w = await mountWith(612)
    expect(w.find('[data-testid="number-line-signs"]').exists()).toBe(true)
    expect(w.find('[data-testid="number-line-input-0"]').exists()).toBe(true)
  })

  it('без входу (гість локальної дошки) — без галочки', async () => {
    const w = await mountWith(null)
    expect(w.find('[data-testid="number-line-signs"]').exists()).toBe(false)
  })

  it('пряма зі знаками — один рядок і увімкнена галочка', async () => {
    const w = await mountWith(612, { mode: 'intervals', expression: '(x-1)(x+3)', op: '>=', rhs: '0' } as never)
    expect((w.find('[data-testid="number-line-input-0"]').element as HTMLInputElement).value).toBe('(x-1)(x+3) ≥ 0')
    expect(w.find('[data-testid="number-line-signs"]').classes()).toContain('is-active')
  })

  it('кілька рядків — галочка неактивна', async () => {
    const w = await mountWith(40)
    await w.find('[data-testid="number-line-input-0"]').setValue('x > 1')
    await w.find('[data-testid="number-line-add-row"]').trigger('click')
    await w.find('[data-testid="number-line-input-1"]').setValue('x < 4')
    expect(w.find('[data-testid="number-line-signs"]').attributes('disabled')).toBeDefined()
  })
})
