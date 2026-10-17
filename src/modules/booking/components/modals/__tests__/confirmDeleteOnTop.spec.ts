/**
 * Розклад: «Ви впевнені…» при видаленні уроку відкривалось ПІД вікном уроку (власник 17.10: урок не видалити).
 * Вікна уроку (`EditLessonModal`, `EventModal`) стоять на z-index 1000, а спільне підтвердження — на звичайному
 * шарі вікон (200). Тепер підтвердження з цих вікон — `stacked` (шар 1100), поверх них.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { mount } from '@vue/test-utils'
import ConfirmModal from '../../../../../ui/ConfirmModal.vue'

const read = (name: string) => readFileSync(resolve(__dirname, '..', name), 'utf8')
const confirmBlock = (src: string) => {
  const start = src.indexOf('<ConfirmDialog')
  return src.slice(start, src.indexOf('/>', start))
}

describe('Підтвердження видалення уроку — поверх вікна уроку', () => {
  it('ConfirmModal із stacked відкривається на верхньому шарі', () => {
    const w = mount(ConfirmModal, { props: { open: true, stacked: true, message: 'Ви впевнені?' }, global: { stubs: { teleport: true } } })
    expect(w.find('.modal-overlay').classes()).toContain('modal-overlay--stacked')
    const plain = mount(ConfirmModal, { props: { open: true, message: 'Ви впевнені?' }, global: { stubs: { teleport: true } } })
    expect(plain.find('.modal-overlay').classes()).not.toContain('modal-overlay--stacked')   // решта підтверджень — як були
  })

  it.each(['EditLessonModal.vue', 'EventModal.vue'])('%s: власний шар 1000, підтвердження — stacked', (file) => {
    const src = read(file)
    expect(src).toMatch(/z-index:\s*1000/)
    expect(confirmBlock(src)).toMatch(/\bstacked\b/)
  })
})
