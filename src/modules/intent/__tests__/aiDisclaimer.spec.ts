/**
 * Під полем розмови з Інтеграликом — рядок «може помилятися» (власник 2026-10-12: «знизу Інтегралика
 * треба вписувати, що він може припускатись помилки… як у всіх нормальних моделях»).
 *
 * Guard структурний, як noLessonPlanPanel: рядок — одна строка в шаблоні, яку легко загубити.
 * Рядок стоїть у режимі розмови (після поля вводу), а не в кожній відповіді — відповіді лишаються
 * без службових слів (правило 2026-10-08).
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const palette = readFileSync(resolve(__dirname, '../CommandPalette.vue'), 'utf8')

describe('вікно Інтегралика: рядок «може помилятися»', () => {
  it('рядок унизу вікна, поза режимами (видно і в командах, і в розмові), лише коли Інтегралик є', () => {
    const lastMode = palette.indexOf('<!-- MODE: мої уроки -->')
    const note = palette.indexOf('data-testid="ai-disclaimer"')
    const hint = palette.indexOf('<div class="cmdp-hint">{{ uiText.keyboardHint }}')
    expect(lastMode).toBeGreaterThan(0)
    expect(note).toBeGreaterThan(lastMode)
    expect(note).toBeLessThan(hint)
    expect(palette).toContain('<p v-if="showAI" class="cmdp-ai-disclaimer" data-testid="ai-disclaimer">{{ uiText.mistakesNote }}</p>')
  })

  it('текст є українською й англійською, з іменем обраного вигляду', () => {
    // Ім'я — з вигляду помічника (Інтегралик / Інтегралка), як і решта текстів вікна.
    expect(palette).toContain('mistakesNote: `${nameUk.value.nom} може помилятися. Важливі факти перевіряйте.`')
    expect(palette).toContain('mistakesNote: `${nameEn.value.nom} can make mistakes. Check important facts.`')
  })
})
