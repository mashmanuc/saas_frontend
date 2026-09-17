/**
 * Панель етапів уроку прибрано з інтерфейсу Інтегралика (ТЗ власника 2026-09-18).
 *
 * Прибрано саме ВИДИМУ панель: напис «План уроку», тип уроку, етапи
 * «Мотивація … Підсумок» і кнопки «Попередній / Пропустити / Наступний /
 * Змінити тип». Стан `lessonPlan` і його GET навмисно лишились — на них
 * тримається логіка compose/proposeDraft, і ТЗ їх не чіпало.
 *
 * Guard структурний, бо повернення панелі — це один рядок у шаблоні, який
 * не впав би в жодному наявному тесті: `LessonPlanPanel.vue` має власні
 * тести й лишається зеленим сам по собі, навіть коли ніхто його не рендерить.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const palette = readFileSync(resolve(__dirname, '../CommandPalette.vue'), 'utf8')

describe('вікно Інтегралика без панелі етапів уроку', () => {
  it('CommandPalette не рендерить і не імпортує LessonPlanPanel', () => {
    expect(palette).not.toContain('LessonPlanPanel')
  })

  it('стан плану лишився — GET і логіка compose не зачеплені', () => {
    expect(palette).toContain('useLessonPlan')
    expect(palette).toContain('lessonPlan.requestCompose()')
  })
})
