/**
 * ТЗ_LIVE_LESSON_2026-09-07 — контракт маршрутів дошки для палітри.
 *
 * Два живі випадки власника, обидва в класній кімнаті (`classroom/100`):
 *   • «впиши коло в трикутник» → «відкрийте дошку з фігурою» при відкритій
 *     дошці — палітра не знала id дошки кімнати (сліпота);
 *   • після мого «приховати в кімнаті» фраза з пульта взагалі зникала —
 *     onIntegralykAsk починається з `if (!enabled.value) return` (регресія).
 * Обидва тут як тести, щоб не повторились «за аналогією».
 */
import { describe, it, expect } from 'vitest'
import {
  resolveBoardId,
  isPaletteHiddenRoute,
  isAuthoringRoute,
  AUTHORING_ROUTES,
  CLASSROOM_ROUTE,
} from '../boardRoute'

const SESSION = '43e18384-0000-4000-8000-000000000001'

describe('resolveBoardId', () => {
  it('класна кімната: id дошки — з того, що кімната записала в стор, не з URL', () => {
    expect(resolveBoardId({
      routeName: CLASSROOM_ROUTE,
      params: { lessonId: '100' },      // це урок, не дошка
      classroomBoardId: SESSION,
    })).toBe(SESSION)
  })

  it('класна кімната ДО ініціалізації стора → чесний null, не lessonId і не падіння', () => {
    expect(resolveBoardId({ routeName: CLASSROOM_ROUTE, params: { lessonId: '100' }, classroomBoardId: null }))
      .toBeNull()
    expect(resolveBoardId({ routeName: CLASSROOM_ROUTE, params: { lessonId: '100' } }))
      .toBeNull()
  })

  it.each(AUTHORING_ROUTES)('%s: id з URL, як і було — classroomBoardId ігнорується', (name) => {
    expect(resolveBoardId({ routeName: name, params: { id: 'abc' }, classroomBoardId: SESSION })).toBe('abc')
    expect(resolveBoardId({ routeName: name, params: {} })).toBeNull()
  })

  it('поза дошкою → null навіть якщо стор щось пам\'ятає', () => {
    for (const name of ['tutor-dashboard', 'winterboard-remote', 'MyLessons', undefined]) {
      expect(resolveBoardId({ routeName: name, params: { id: 'x' }, classroomBoardId: SESSION })).toBeNull()
    }
  })
})

describe('isPaletteHiddenRoute', () => {
  it('⚠️ класна кімната НЕ прихована — інакше phrase з пульта викидається мовчки', () => {
    expect(isPaletteHiddenRoute({ name: CLASSROOM_ROUTE, path: '/winterboard/classroom/100' })).toBe(false)
  })

  it('пульт прихований: у телефона власний push-to-talk, палітра там сліпа кнопка', () => {
    expect(isPaletteHiddenRoute({ name: 'winterboard-remote', path: '/remote' })).toBe(true)
  })

  it('staff-адмінка прихована (2026-07-27), і за шляхом, не за іменем', () => {
    expect(isPaletteHiddenRoute({ name: 'staff-anything', path: '/staff/billing/pending' })).toBe(true)
    expect(isPaletteHiddenRoute({ name: 'staff-anything', path: '/tutor' })).toBe(false)
  })

  it('solo / prepare / звичайні сторінки — видима', () => {
    for (const name of [...AUTHORING_ROUTES, 'tutor-dashboard', 'MyLessons']) {
      expect(isPaletteHiddenRoute({ name, path: '/x' })).toBe(false)
    }
  })

  it('⚠️ публічний реплей — прихована: там ДИВЛЯТЬСЯ чужий запис, не редагують', () => {
    // Живий випадок власника 2026-09-06: маскот висів поверх сторінки,
    // яку вчитель кидає учням (`/winterboard/public/:token`).
    expect(isPaletteHiddenRoute({
      name: 'winterboard-public',
      path: '/winterboard/public/zHVYHz_ilux',
      meta: { public: true, requiresAuth: false },
    })).toBe(true)
  })

  it('будь-який НОВИЙ публічний маршрут прихований сам, без правки списку', () => {
    expect(isPaletteHiddenRoute({ name: 'щось-нове-публічне', path: '/x', meta: { public: true } })).toBe(true)
    expect(isPaletteHiddenRoute({ name: 'winterboard-replay-gone', path: '/winterboard/replay-gone', meta: { public: true } })).toBe(true)
  })

  it('виняток названий: /workspace — редагована демо-дошка, палітра доречна', () => {
    expect(isPaletteHiddenRoute({ name: 'local-workspace', path: '/workspace', meta: { public: true } })).toBe(false)
  })

  it('приватна сторінка (без meta.public) лишається видимою', () => {
    expect(isPaletteHiddenRoute({ name: 'winterboard-solo', path: '/winterboard/x', meta: { requiresAuth: true } })).toBe(false)
  })

  it('дірявий route (без path/name) не кидає', () => {
    expect(isPaletteHiddenRoute({})).toBe(false)
    expect(isPaletteHiddenRoute({ name: null, path: undefined })).toBe(false)
  })
})

describe('isAuthoringRoute — «опублікувати / зберегти як урок» лише там, де дошку готують', () => {
  it('solo і prepare — так; класна кімната — ні (живий урок не публікують як шаблон)', () => {
    expect(isAuthoringRoute('winterboard-solo')).toBe(true)
    expect(isAuthoringRoute('winterboard-prepare')).toBe(true)
    expect(isAuthoringRoute(CLASSROOM_ROUTE)).toBe(false)
    expect(isAuthoringRoute('winterboard-remote')).toBe(false)
  })
})
