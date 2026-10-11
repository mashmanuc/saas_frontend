/**
 * Інтегралик — один малюнок на весь застосунок (ТЗ TZ_START_INTEGRALYK_HINTS_2026-10-11 §5: «персонаж —
 * спільний SVG, винести в окремий модуль і підключити з обох місць — без копії»).
 *
 * Хеші нижче — sha256 рядків, що ДО винесення були вшиті в `CommandPalette.vue` і `AppErrorBoundary.vue`
 * (виміряно на origin/master 9a0310ca). Збіг хешу = побайтово той самий SVG, тобто вигляд у наявних
 * місцях не змінився. Самих рядків тут немає навмисно — інакше це була б третя копія.
 */
import { describe, it, expect } from 'vitest'
import { createHash } from 'node:crypto'
import {
  INTEGRALYK_SVG,
  INTEGRALYK_SVG_SORRY,
  INTEGRALYK_SVG_STANDALONE,
  buildIntegralykSvg,
} from '../integralykMascotSvg'
import paletteSource from '../CommandPalette.vue?raw'
import errorBoundarySource from '../../../components/AppErrorBoundary.vue?raw'
import landingHintSource from '../../../views/LandingIntegralykHint.vue?raw'

const sha256 = (s: string) => createHash('sha256').update(s).digest('hex')

// Унікальний шматок малюнка (контур тіла) — ним шукаємо копії.
const BODY_PATH = 'M60 22 C55 12'

describe('спільний SVG Інтегралика', () => {
  it('палітра на дошці отримує побайтово той самий малюнок, що був вшитий у неї', () => {
    expect(sha256(INTEGRALYK_SVG)).toBe('a5b256ab0c70eb895c95c2c9533ac299b224ad577d62ab0b7d732bbf4b7b00e9')
  })

  it('екран помилки — так само (винуватий погляд і сльозинка)', () => {
    expect(sha256(INTEGRALYK_SVG_SORRY)).toBe('509aa865b25f483807d18d913ac789c0cfb42dc30181865c977e9bd07e5d4a2d')
  })

  it('варіант для лендінгу — той самий персонаж без слотів настрою палітри', () => {
    // Палітра заповнює ВСІ `.itg-mood` / `.itg-accessory` на сторінці (querySelectorAll),
    // тож у малюнку поза палітрою їх бути не повинно.
    expect(INTEGRALYK_SVG_STANDALONE).not.toContain('itg-mood')
    expect(INTEGRALYK_SVG_STANDALONE).not.toContain('itg-accessory')
    // А решта — як у палітрі: прибрали слоти — отримали рівно лендінговий рядок.
    const paletteWithoutSlots = INTEGRALYK_SVG
      .replace('<g class="itg-mood"></g>', '')
      .replace('<g class="itg-accessory"></g>', '')
    expect(INTEGRALYK_SVG_STANDALONE).toBe(paletteWithoutSlots)
    expect(INTEGRALYK_SVG_STANDALONE).toContain('class="itg-body"')
    expect(INTEGRALYK_SVG_STANDALONE).toContain('class="itg-eye"')
    expect(INTEGRALYK_SVG_STANDALONE).toContain('aria-hidden="true"')
  })

  it('варіанти будуються одним конструктором (немає окремих рядків-копій у модулі)', () => {
    expect(buildIntegralykSvg({ look: 'calm', arm: true, slots: true, ariaHidden: true })).toBe(INTEGRALYK_SVG)
    expect(buildIntegralykSvg({ look: 'sorry', tear: true })).toBe(INTEGRALYK_SVG_SORRY)
  })

  it('копій малюнка в компонентах немає — усі беруть зі спільного модуля', () => {
    for (const [name, src] of [
      ['CommandPalette.vue', paletteSource],
      ['AppErrorBoundary.vue', errorBoundarySource],
      ['LandingIntegralykHint.vue', landingHintSource],
    ] as const) {
      expect(src.includes(BODY_PATH), `${name}: вшитий SVG персонажа`).toBe(false)
      expect(src, name).toMatch(/integralykMascotSvg'/)
    }
  })
})
