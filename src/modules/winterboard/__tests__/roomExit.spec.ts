/**
 * Куди веде кнопка виходу з дошки (власник 2026-09-24).
 *
 * Симптом: і з дошки-шаблона, і з дошки-уроку кнопка вела в «Студію уроків»,
 * хоча урок відкривають із «Моїх уроків» кнопкою «Провести» — і повертатись
 * він мав туди. Кімнати в тестах не монтуються, тож правило — чиста функція.
 */
import { describe, expect, it } from 'vitest'
import { roomExitTarget, EXIT_TO_STUDIO, EXIT_TO_LESSONS } from '../board/roomExit'

describe('roomExitTarget', () => {
  it('дошка-шаблон (конструктор) → Студія уроків', () => {
    expect(roomExitTarget({ constructorMode: true, isLessonPlay: false, hasOriginLesson: false }))
      .toEqual(EXIT_TO_STUDIO)
  })

  it('шаблон, зроблений з уроку, теж лишається у Студії', () => {
    expect(roomExitTarget({ constructorMode: true, isLessonPlay: false, hasOriginLesson: true }))
      .toEqual(EXIT_TO_STUDIO)
  })

  it('урок («Провести») → Мої уроки', () => {
    expect(roomExitTarget({ constructorMode: false, isLessonPlay: true, hasOriginLesson: false }))
      .toEqual(EXIT_TO_LESSONS)
  })

  it('дошка, народжена з уроку, → Мої уроки', () => {
    expect(roomExitTarget({ constructorMode: false, isLessonPlay: false, hasOriginLesson: true }))
      .toEqual(EXIT_TO_LESSONS)
  })

  it('звичайна дошка Студії → Студія уроків', () => {
    expect(roomExitTarget({ constructorMode: false, isLessonPlay: false, hasOriginLesson: false }))
      .toEqual(EXIT_TO_STUDIO)
  })

  it('напис каже, куди веде кнопка (обидва ключі різні)', () => {
    expect(EXIT_TO_LESSONS.label).not.toBe(EXIT_TO_STUDIO.label)
  })
})
