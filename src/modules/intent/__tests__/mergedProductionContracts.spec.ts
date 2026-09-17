/**
 * Гілка коридорів несе ТРИ незалежні контракти одночасно (рев'ю 2, 2026-09-17).
 *
 * Прод-коміт `f0a7b9e1` (мікрофон + EN-гейт конструктора) влився в гілку з коридорами,
 * і всі три правки живуть в одних і тих самих файлах. Мовчазна втрата будь-якої з них
 * при наступному злитті не впала б у жодному тесті: мікрофон і вкладка конструктора
 * тестів не мають узагалі. Тому — структурний guard по джерелу.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const read = (p: string) => readFileSync(resolve(__dirname, p), 'utf8')

describe('гілка коридорів після злиття з продом', () => {
  it('мікрофон глушиться після відправки (f0a7b9e1), а не лише скидає буфер', () => {
    const palette = read('../CommandPalette.vue')
    const body = palette.slice(palette.indexOf('function continueAi(')).slice(0, 900)
    // Рядки коду, без коментарів: сам коментар нижче пояснює, чому reset() не досить.
    const code = body.split('\n').filter(line => !line.trim().startsWith('//'))
    expect(code.some(line => line.includes('voice.stop()'))).toBe(true)
    expect(code.some(line => line.includes('voice.reset()'))).toBe(false)
  })

  it('конструктор вимкнений на en-інтерфейсі ПЕРЕД читанням env-прапорця (f0a7b9e1)', () => {
    const flags = read('../../winterboard/config/featureFlags.ts')
    const fn = flags.slice(flags.indexOf('export function isLessonConstructorEnabled'))
    const enGate = fn.indexOf("i18n.global.locale.value === 'en'")
    const envRead = fn.indexOf('VITE_LESSON_CONSTRUCTOR_ENABLED')
    const lsOverride = fn.indexOf('LS_KEY_LC')
    expect(enGate).toBeGreaterThan(-1)
    expect(envRead).toBeGreaterThan(enGate)          // мова — раніше за прапорець
    expect(lsOverride).toBeGreaterThan(-1)
    expect(lsOverride).toBeLessThan(enGate)          // QA-оверрайд лишається найвищим
  })

  it('селектор коридору лишився в палітрі й бере реєстр із сервера', () => {
    const palette = read('../CommandPalette.vue')
    expect(palette).toContain('<CorridorSelector')
    expect(palette).toContain(':registry="corridor.state.registry"')
    expect(palette).toContain('corridor.applyCorridor(r.corridor)')
  })
})
