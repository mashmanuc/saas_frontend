/**
 * Палітра: поки виконується команда (генерація уроку тощо) — Інтегралик думає, а не лише «Виконую…»
 * (власник 2026-10-18: «що він думає, а не просто колесо крутиться»).
 *
 * CommandPalette не монтується в тестах (тягне router/auth/profile/WS) — перевіряємо по тексту файлу:
 * обидва місця з персонажем (кнопка-значок і шапка) беруть той самий прапорець, а він увімкнений і
 * під час розмови з ШІ, і під час виконання команди.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const SRC = readFileSync(resolve(__dirname, '../CommandPalette.vue'), 'utf8')

describe('палітра: Інтегралик думає, поки працює', () => {
  it('обидва місця з персонажем — один прапорець «думає»', () => {
    const mascots = SRC.match(/class="cmdp-mascot[^"]*"[\s\S]{0,80}?:class="\[\{ thinking: (\w+) \}/g) ?? []
    expect(mascots).toHaveLength(2)
    expect(mascots.every((m) => m.endsWith('thinking: mascotThinking }'))).toBe(true)
  })

  it('думає і під час розмови з ШІ, і під час виконання команди', () => {
    expect(SRC).toMatch(/const mascotThinking = computed\(\(\) => aiBusy\.value \|\| loading\.value\)/)
  })
})
