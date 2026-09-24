/**
 * serverPayloadBytes ≡ сервер (apps/winterboard/services/payload_size.py):
 * len(json.dumps(json.loads(<тіло від фронту>), separators=(',', ':'), ensure_ascii=False)
 *     .encode('utf-8', 'surrogatepass')). Еталонні числа — з CPython 3.11 (прогін
 * 2026-09-24; там же 3 × 5000 випадкових payload'ів — 0 розбіжностей).
 */
import { describe, it, expect } from 'vitest'
import { serverPayloadBytes, pyFloatRepr } from '../services/opsPayloadSize'

describe('serverPayloadBytes — як сервер', () => {
  it.each([
    ['11 000 «І» — реальні UTF-8 байти (2 на літеру)', { text: 'І'.repeat(11000) }, 22011],
    ['4000 точок з малими дробами (1e-07, 3e-05)', { points: Array.from({ length: 4000 }, (_, i) => [i * 1e-7, 0.5, 3e-5]) }, 101824],
    ['межі наукової форми, -0, крайні float', { a: 1e-5, b: 0.0001, c: 1e16, d: 1e21, e: 123.5, f: -0, g: 5e-324, h: 1.7976931348623157e308 }, 109],
    ['DEL, U+2028, емодзі, escape', { s: '\u007f 😀\n"\\\u0001é' }, 30],
    ['великі цілі й дроби', { n: [0, -1, 12345678901234567890, 0.1, 2.5e-8, 1234567890123456.7] }, 64],
    ['вкладені, bool, null, не-ASCII', { nested: { x: [true, false, null, { y: 'Ї' }] } }, 45],
    ['одиночний сурогат (surrogatepass) і пара', { a: '\ud800x', b: '😀' }, 23],
  ])('%s', (_label, payload, expected) => {
    expect(serverPayloadBytes(payload)).toBe(expected)
  })

  it('pyFloatRepr = Python repr', () => {
    expect(pyFloatRepr(1e-7)).toBe('1e-07')
    expect(pyFloatRepr(0.0001)).toBe('0.0001')
    expect(pyFloatRepr(1e-5)).toBe('1e-05')
    expect(pyFloatRepr(1e16)).toBe('1e+16')
    expect(pyFloatRepr(1234567890123456.7)).toBe('1234567890123456.8')
    expect(pyFloatRepr(123.5)).toBe('123.5')
    expect(pyFloatRepr(1e21)).toBe('1e+21')
    expect(pyFloatRepr(-2.5e-8)).toBe('-2.5e-08')
    expect(pyFloatRepr(1.5e300)).toBe('1.5e+300')
  })
})
