import { describe, it, expect } from 'vitest'
// @ts-expect-error — boardActions.js без типів, як і решта спеків модуля
import { summarizeAsset } from '../boardActions'

/**
 * ⚠️ НАВІЩО. Назва картки — не лише адреса об'єкта: Інтегралик її ВИМОВЛЯЄ.
 * До 2026-09-05 квадратна картка звалася `y = 1x² + 0x + 0` (типові
 * значення a=1, b=0, c=0), тобто вголос це звучало «ігрек дорівнює один
 * ікс квадрат плюс нуль ікс плюс нуль». При від'ємних коефіцієнтах було
 * ще гірше: `+ -3x` — «плюс мінус три ікс».
 *
 * Той самий клас дефекту того ж дня знайдено у самому віджеті
 * (`QuadraticRenderer.vue` + `vendor/quad/quad-card.js`), і причина
 * спільна: кожне місце писало многочлен по-своєму.
 */
function label(data: Record<string, unknown>): string {
  return summarizeAsset({ id: 'q', type: 'quadratic_card', data }).label
}

describe('назва квадратної картки для Інтегралика', () => {
  it('типові значення не дають «1x² + 0x + 0»', () => {
    expect(label({})).toBe('y = x²')
  })

  it('коефіцієнт 1 не вимовляється', () => {
    expect(label({ a: 1, b: -1, c: -6 })).toBe('y = x² − x − 6')
  })

  it('від\'ємні йдуть знаком, а не «плюс мінус»', () => {
    expect(label({ a: 2, b: -3, c: -4 })).toBe('y = 2x² − 3x − 4')
  })

  it('нульові доданки зникають', () => {
    expect(label({ a: 3, b: 0, c: 5 })).toBe('y = 3x² + 5')
    expect(label({ a: -1, b: 4, c: 0 })).toBe('y = −x² + 4x')
  })

  it('рядкові значення з дошки теж читаються як числа', () => {
    expect(label({ a: '1', b: '0', c: '-6' })).toBe('y = x² − 6')
  })
})
