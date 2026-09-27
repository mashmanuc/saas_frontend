/**
 * Сторож: CommandPalette застосовує рішення розкладки (TABLET 2А + 3А + 3Б).
 *
 * Монтувати палітру не варто (роутер, стори, WS, пів дошки — крихкий тест із чужих
 * причин; той самий підхід, що в `sendClearsInputAndMic.spec.ts`), тому перевіряється
 * джерело без коментарів. Самі рішення — під тестами в `paletteLayout.spec.ts`.
 */
import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'

import { describe, expect, it } from 'vitest'

const PALETTE = resolve(process.cwd(), 'src/modules/intent/CommandPalette.vue')

async function paletteCode(): Promise<string> {
  const src = await readFile(PALETTE, 'utf-8')
  return src
    .split('\n')
    .filter((line) => !line.trim().startsWith('//'))
    .join('\n')
}

function fnBody(src: string, signature: string): string {
  const start = src.indexOf(signature)
  expect(start, `${signature} має існувати`).toBeGreaterThan(-1)
  return src.slice(start, src.indexOf('\n}', start))
}

describe('Інтегралик на планшеті', () => {
  it('3Б: поля Інтегралика не отримують фокус напряму — лише через autofocus()', async () => {
    const src = await paletteCode()
    expect(src).not.toMatch(/aiInputEl\.value\?\.focus\(\)/)
    expect(src).not.toMatch(/inputEl\.value\)?\?\.focus\(\)/)
    expect(fnBody(src, 'function autofocus(')).toContain('shouldAutofocus(isTouch.value)')
  })

  it('3А: підйом над клавіатурою — не лише на телефоні', async () => {
    const body = fnBody(await paletteCode(), 'function onViewportResize()')
    expect(body).toContain('isTouch.value')
    expect(body).toContain('keyboardInset(')
  })

  it('2А: розкладка вирішує resolvePaletteLayout, підкладка отримує її клас', async () => {
    const src = await paletteCode()
    expect(src).toContain('resolvePaletteLayout({')
    expect(src).toContain("'cmdp-overlay--dock': layout === 'dock'")
    expect(src).toContain("'cmdp-overlay--sheet': layout === 'sheet'")
  })

  it('2А: панель праворуч займає висоту полотна дошки', async () => {
    const body = fnBody(await paletteCode(), 'function updateDock()')
    expect(body).toContain("getElementById('wb-canvas')")
    expect(body).toContain('dockBox(')
  })

  it('лист знизу — класом, а не лише медіа-запитом телефона', async () => {
    const src = await readFile(PALETTE, 'utf-8')
    const style = src.slice(src.indexOf('<style scoped>'))
    expect(style).toContain('.cmdp-overlay.cmdp-overlay--sheet {')
    const phoneMq = style.slice(style.indexOf('@media (max-width: 640px)'))
    expect(phoneMq.slice(0, phoneMq.indexOf('}\n}'))).not.toContain('.cmdp-overlay {')
  })
})
