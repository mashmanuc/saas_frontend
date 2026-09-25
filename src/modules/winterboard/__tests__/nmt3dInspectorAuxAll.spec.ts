/**
 * Кнопка «показати всі / сховати всі» у «Доп. побудовах» 3D-тіла
 * (власник 2026-09-25: «щоб кожного разу не приходилось вмикати окремо»).
 *
 * Гарантуємо:
 *   - натиск вмикає в рушії КОЖНУ побудову шаблону;
 *   - зберігаємо ОДИН раз — одна зміна картки на дошці й у Replay;
 *   - коли ввімкнені всі, та сама кнопка їх ховає;
 *   - частково ввімкнені → вмикає решту, ввімкнені не гасить.
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { createI18n } from 'vue-i18n'
import uk from '../../../i18n/locales/uk.json'
import Nmt3dInspector from '../components/sidebar/Nmt3dInspector.vue'
import {
  registerNmt3dWorkspace,
  __resetNmt3dUiStateForTests,
} from '../board/state/nmt3dUiState'
import type { Nmt3dWorkspace } from '../vendor/nmt3d'

const AUX = [
  { key: 'height', label: 'висота SO' },
  { key: 'apothem', label: 'апофема SM' },
  { key: 'diags', label: 'діагоналі основи' },
]

function setup(opts: Record<string, boolean>) {
  const ws = {
    template: { key: 'testSolid', name: 'Тіло', params: {}, aux: AUX },
    params: {},
    opts: { ...opts },
    setOpt: vi.fn((key: string, v: boolean) => { ws.opts[key] = v }),
  }
  const persistOpts = vi.fn()
  registerNmt3dWorkspace('a1', ws as unknown as Nmt3dWorkspace, persistOpts)
  const i18n = createI18n({ legacy: false, locale: 'uk', fallbackLocale: 'uk', messages: { uk } as never })
  const wrapper = mount(Nmt3dInspector, { global: { plugins: [i18n] } })
  const button = () => wrapper.get('[data-testid="nmt3d-aux-all"]')
  const checked = () => wrapper.findAll('input[type="checkbox"]').map((c) => (c.element as HTMLInputElement).checked)
  return { ws, persistOpts, button, checked }
}

const allOff = { height: false, apothem: false, diags: false }
const allOn = { height: true, apothem: true, diags: true }

afterEach(() => __resetNmt3dUiStateForTests())

describe('Nmt3dInspector — показати / сховати всі доп. побудови', () => {
  it('вмикає всі побудови й зберігає один раз', async () => {
    const { ws, persistOpts, button, checked } = setup(allOff)
    expect(button().text()).toBe('показати всі')

    await button().trigger('click')

    expect(ws.opts).toEqual(allOn)
    expect(persistOpts).toHaveBeenCalledTimes(1)
    expect(persistOpts).toHaveBeenCalledWith(allOn)
    expect(checked()).toEqual([true, true, true])
    expect(button().text()).toBe('сховати всі')
  })

  it('коли ввімкнені всі — ховає всі, теж одним збереженням', async () => {
    const { ws, persistOpts, button, checked } = setup(allOn)
    expect(button().text()).toBe('сховати всі')

    await button().trigger('click')

    expect(ws.opts).toEqual(allOff)
    expect(persistOpts).toHaveBeenCalledTimes(1)
    expect(persistOpts).toHaveBeenCalledWith(allOff)
    expect(checked()).toEqual([false, false, false])
  })

  it('частково ввімкнені — вмикає решту, ввімкнену не гасить', async () => {
    const { persistOpts, button } = setup({ height: true, apothem: false, diags: false })
    expect(button().text()).toBe('показати всі')

    await button().trigger('click')

    expect(persistOpts).toHaveBeenCalledTimes(1)
    expect(persistOpts).toHaveBeenCalledWith(allOn)
  })
})
