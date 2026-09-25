// Вхід у режим тесту (кнопка 📝) прибрано з дошки.
//
// Рішення власника 2026-09-25: «прибрати вхід 📝». Режим тесту — жива класна
// сесія з фазами (на беку `Phase 38 — TEST LIVE SYNC`), і в продукті
// «вчитель + один учень» кнопка стояла поруч із гортанням сторінок та
// потрапляла в кадр запису уроку.
//
// Сховано прапорцем, не видалено: сам режим, протокол і моделі лишаються.
import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'

import { describe, expect, it } from 'vitest'

import { TEST_MODE_ENTRY_VISIBLE } from '../board/state/testStore'

const ROOM = resolve(process.cwd(), 'src/modules/winterboard/views/WBSoloRoom.vue')

describe('вхід у режим тесту', () => {
  it('прапорець вимкнений', () => {
    expect(TEST_MODE_ENTRY_VISIBLE).toBe(false)
  })

  it('кнопка 📝 малюється лише за прапорцем — інакше її ніщо не ховає', async () => {
    const src = await readFile(ROOM, 'utf-8')
    const button = src.slice(src.indexOf('wb-page-nav'), src.indexOf('WBGridButton'))

    expect(button).toContain('📝')
    expect(button).toContain('TEST_MODE_ENTRY_VISIBLE &&')
  })

  it('решта входів у режим тесту лишились робочими (панель самого тесту)', async () => {
    const src = await readFile(ROOM, 'utf-8')

    // «Вийти з тесту» всередині режиму — не чіпали: інакше з увімкненого
    // автоматично режиму не було б виходу.
    expect(src).toContain('wb-test-bar__btn--exit')
  })
})
