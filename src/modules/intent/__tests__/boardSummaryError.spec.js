/**
 * Б-13 (2026-09-27): відкрита дошка, стан якої зібрати не вдалося, — не «дошки немає».
 *
 * Живий урок 2026-09-06: «Що ти бачиш на дошці» → «Не бачу дошки» при 21
 * сторінці. `askAi` ковтав помилку `buildBoardSummary` порожнім catch: модель
 * отримувала board_id без стану, а за правилом промпту це «не бачу дошки»; у
 * консолі не лишалось нічого. Тепер причина їде на сервер (`board_summary_error`),
 * той пише її в лог і каже моделі «не прочитано».
 *
 * Перевіряємо контракт `parseAi`, а не CommandPalette — той самий підхід, що
 * `pageContext.spec.js`: палітра тягне роутер, стори й пів дошки.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'

const post = vi.fn()
vi.mock('../../../utils/apiClient', () => ({
  default: { post: (...args) => post(...args) },
}))

import { parseAi } from '../sendIntent'

describe('parseAi — чому стан дошки не зібрано', () => {
  beforeEach(() => {
    post.mockReset()
    post.mockResolvedValue({ data: { status: 'none', explain: 'ок' } })
  })

  it('причина їде в context.board_summary_error', async () => {
    await parseAi('що на дошці', 'b1', [], null, null, 'uk', null, null, 'Дошка ще не завантажилась')

    const [, body] = post.mock.calls[0]
    expect(body.context.board_id).toBe('b1')
    expect(body.context.board_summary).toBeNull()
    expect(body.context.board_summary_error).toBe('Дошка ще не завантажилась')
  })

  it('коли стан зібрано — поля немає зовсім', async () => {
    await parseAi('що на дошці', 'b1', [], { pages: 1, currentPage: 1, items: [] })

    const [, body] = post.mock.calls[0]
    expect('board_summary_error' in body.context).toBe(false)
  })
})

describe('палітра не ковтає помилку зору мовчки (LAW §12)', () => {
  it('жодного `catch {` без змінної одразу після buildBoardSummary()', () => {
    // Палітру не змонтувати в тесті (роутер, стори, пів дошки) — стережемо текст.
    const src = fs.readFileSync(path.resolve(__dirname, '../CommandPalette.vue'), 'utf8')
    expect(src.match(/buildBoardSummary\(\)\s*\}\s*catch\s*\{/g) || []).toEqual([])
  })
})
