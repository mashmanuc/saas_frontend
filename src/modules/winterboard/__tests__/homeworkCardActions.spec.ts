/**
 * Картка «Домашнє завдання» — аркуш для учня, а не задача на уроці (власник 2026-10-20: «кнопки на кучу позлипались…
 * на домашку не ліпити, там тільки скопіювати»). Без ✍ 💡 ⚠ і без «A− 100% A+ ×» — на ній лише власна
 * «📋 Скопіювати картинку» (homeworkCardCopy.spec.ts). Звичайна текстова картка — як і раніше.
 */
import { describe, expect, it } from 'vitest'
import { cardWindowActions, hasWindowActions } from '../board/windowActions'
import { isIntegralykSolvable } from '../board/handwriteSolution'
import { homeworkPage, isHomeworkCardData } from '../board/homeworkCard'
import type { WBAsset } from '../types/winterboard'

const OWNER = { isTutor: true, mode: 'edit' as const, canSolve: true }

const homework = homeworkPage({
  title: 'Домашнє завдання', lesson: 'Урок: Первісна', items: [
    { id: 'nmt-1', text: 'Задано функцію $f(x)=15x^4$.', answer: '3' },
    { id: 'nmt-2', text: 'Знайдіть $F(6)$.', answer: '12' },
  ], copy_text: '', task_count: 2, requested: 2, message: '',
}).assets[0] as WBAsset

const plain = { ...homework, id: 'th', data: { version: 1, title: 'Розв\'яжіть', body: '$x^2=4$', formulas: [] } } as WBAsset

describe('картка домашки — лише «Скопіювати картинку»', () => {
  it('сторінка «Додати в урок» дає саме картку домашки', () => {
    expect(homework.type).toBe('theory_card')
    expect(isHomeworkCardData(homework.data)).toBe(true)
    expect(isHomeworkCardData(plain.data)).toBe(false)
  })

  it('без ✍ 💡 ⚠ і без «A− 100% A+ ×» навіть у власника з Інтеграликом', () => {
    const actions = cardWindowActions(homework, OWNER)
    expect(hasWindowActions(actions)).toBe(false)
    expect(isIntegralykSolvable(homework)).toBe(false)          // і на пульті ✍ для неї немає
  })

  it('звичайна текстова картка — як і раніше: масштаб, ✍ Інтегралика, підказки', () => {
    const actions = cardWindowActions(plain, OWNER)
    expect(actions.scale).toBe(true)
    expect(actions.handwrite).toBe(true)
    expect(actions.taskHelp).toBe(true)
  })
})
