/**
 * «Мої записи»: мʼяке пояснення, як зробити відео (власник 2026-10-13: «треба просто пояснення… як робиться
 * відео»). Лише тим, кому доступна кнопка «🎬 Відео» (той самий гейт canMakeClip). Guard структурний.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import uk from '../../../i18n/locales/uk.json'

const view = readFileSync(resolve(__dirname, '../views/WBReplayList.vue'), 'utf8')

describe('«Мої записи» — пояснення «🎬 Відео»', () => {
  it('рядок під заголовком лише при canMakeClip', () => {
    expect(view).toContain('<p v-if="canMakeClip" class="replay-list__hint" data-testid="replay-clip-hint">')
    expect(view).toContain("t('winterboard.replayList.clipHint')")
  })
  it('текст людський, з назвою кнопки', () => {
    const text = (uk as { winterboard: { replayList: { clipHint: string } } }).winterboard.replayList.clipHint
    expect(text).toContain('«🎬 Відео»')
    expect(text).not.toMatch(/asset|replay|mirror/i)
  })
})
