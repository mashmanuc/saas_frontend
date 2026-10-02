/**
 * Контракт відправки в Інтегралику: поле порожніє, мікрофон гасне.
 *
 * Власник 2026-09-25 (скрін): фразу надіслано, відповідь у стрічці — а текст
 * лишився в полі й мікрофон червоний. Механізм знайдено й полагоджено в
 * `useVoiceDictation` (пізній результат рушія писав надіслане назад у поле);
 * тут — сторож на сам порядок дій у палітрі.
 *
 * Монтувати `CommandPalette.vue` не варто (роутер, стори, WS, пів дошки —
 * крихкий тест із чужих причин), тому перевіряється джерело: у `continueAi`
 * поле очищається й диктовка зупиняється ДО запиту до моделі.
 */
import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'

import { describe, expect, it } from 'vitest'

const PALETTE = resolve(process.cwd(), 'src/modules/intent/CommandPalette.vue')

/**
 * Тіло `continueAi` БЕЗ коментарів.
 *
 * Спершу сторож читав тіло разом із поясненнями — і ловив згадку `voice.stop()`
 * у коментарі замість самого виклику: kill-проба «прибрати виклик» лишалась
 * зеленою. Спіймано пробою 2026-09-25, тому коментарі відрізаються.
 */
async function functionSource(signature: string): Promise<string> {
  const src = await readFile(PALETTE, 'utf-8')
  const start = src.indexOf(signature)
  expect(start, `функція «${signature}» має існувати`).toBeGreaterThan(-1)
  const body = src.slice(start, src.indexOf('\n}', start))
  return body
    .split('\n')
    .filter((line) => !line.trim().startsWith('//'))
    .join('\n')
}

const continueAiSource = () => functionSource('function continueAi()')

describe('відправка в Інтегралику', () => {
  it('очищає поле й зупиняє диктовку ДО запиту до моделі', async () => {
    const fn = await continueAiSource()

    const clear = fn.indexOf("aiInput.value = ''")
    const stop = fn.indexOf('voice.stop()')
    const ask = fn.indexOf('askAi(')

    expect(clear, 'поле має очищатись').toBeGreaterThan(-1)
    expect(stop, 'диктовка має зупинятись').toBeGreaterThan(-1)
    expect(ask, 'запит до моделі має бути').toBeGreaterThan(-1)
    expect(clear).toBeLessThan(ask)
    expect(stop).toBeLessThan(ask)
  })

  it('будь-яка відправка Інтегралику гасить диктовку, а не переносить її в діалог', async () => {
    // Власник 2026-10-02: продиктував у полі команд, обрав «∫ Інтегралик: …» — фраза пішла,
    // а мікрофон перейшов у поле діалогу й слухав далі. Через `askAi` йдуть усі шляхи:
    // поле діалогу, пункт у списку команд, запит з інших модулів.
    const fn = await functionSource('async function askAi(phrase)')
    const stop = fn.indexOf('voice.stop()')
    expect(stop, 'askAi має зупиняти диктовку').toBeGreaterThan(-1)
    expect(stop).toBeLessThan(fn.indexOf('parseAi('))
    expect(fn, 'ре-таргет переносив живий мікрофон у діалог').not.toContain('retargetVoice()')
  })

  it('пункт «∫ Інтегралик» у списку команд відправляє саме через askAi', async () => {
    const src = await readFile(PALETTE, 'utf-8')
    expect(src).toMatch(/id: '__ai__'[^\n]*run: \(\) => askAi\(/)
  })

  it('зупиняє саме диктовку, а не лише скидає накопичення', async () => {
    const fn = await continueAiSource()

    // `voice.reset()` лише гасить базу накопичення й НЕ глушить рушій — саме
    // через це мікрофон колись лишався слухати (запит власника 09-17).
    expect(fn).toContain('voice.stop()')
    expect(fn).not.toMatch(/voice\.reset\(\)\s*$/)
  })
})
