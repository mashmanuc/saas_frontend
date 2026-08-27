/**
 * Поведінковий доказ у ТОЧНИХ умовах прода.
 *
 * Файл-близнюк до `coursesStudioGate.spec.ts`, і різниця принципова: той
 * читає ВИХІДНИЙ ТЕКСТ і стереже форму гейта, цей ВИКЛИКАЄ функції з тим
 * самим env, що стоїть у панелі Cloudflare Pages (скріншот власника
 * 2026-08-27):
 *
 *     VITE_LESSON_CONSTRUCTOR_ENABLED = true
 *     VITE_COURSES_STUDIO_ENABLED     — відсутня
 *
 * Саме ця пара має дати «конструктор видно, курси приховано» БЕЗ жодної
 * зміни в Cloudflare. Якщо колись доведеться правити ще й панель — цей
 * тест впаде першим і скаже про це.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'

const LS_LC = 'lc_enabled'
const LS_COURSES = 'courses_studio_enabled'

describe('прод-конфігурація: конструктор увімкнено, курси — ні', () => {
  beforeEach(() => {
    vi.resetModules()
    // localStorage-оверайди мусять бути порожні: у тьютора на проді їх немає,
    // а вони перебивають env і зробили б тест брехливим.
    try {
      localStorage.removeItem(LS_LC)
      localStorage.removeItem(LS_COURSES)
    } catch { /* середовище без localStorage — теж валідний випадок */ }
    vi.stubEnv('VITE_LESSON_CONSTRUCTOR_ENABLED', 'true')
  })

  afterEach(() => { vi.unstubAllEnvs() })

  it('🔴 курси ПРИХОВАНО, хоча прапорець конструктора true', async () => {
    const m = await import('../config/featureFlags')
    expect(m.isLessonConstructorEnabled()).toBe(true)
    expect(m.isCoursesStudioEnabled()).toBe(false)
  })

  it('🔴 у Cloudflare нічого міняти не треба — відсутня змінна вже = вимкнено', async () => {
    // Головне практичне твердження всього пакета: власник не мусить нічого
    // додавати в панель, щоб курси зникли.
    const m = await import('../config/featureFlags')
    expect(import.meta.env.VITE_COURSES_STUDIO_ENABLED).toBeUndefined()
    expect(m.isCoursesStudioEnabled()).toBe(false)
  })

  it('увімкнути курси можна явно — гейт не глухий', async () => {
    vi.stubEnv('VITE_COURSES_STUDIO_ENABLED', 'true')
    const m = await import('../config/featureFlags')
    expect(m.isCoursesStudioEnabled()).toBe(true)
  })

  it('localStorage перебиває env — шлях для QA лишається', async () => {
    localStorage.setItem(LS_COURSES, 'true')
    const m = await import('../config/featureFlags')
    expect(m.isCoursesStudioEnabled()).toBe(true)
    localStorage.removeItem(LS_COURSES)
  })

  it('вимкнення курсів НЕ чіпає конструктор', async () => {
    const m = await import('../config/featureFlags')
    expect(m.isLessonConstructorEnabled()).toBe(true)
  })
})
