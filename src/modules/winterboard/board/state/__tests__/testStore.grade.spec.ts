/**
 * §1 хвостів DIR: `onRemoteTestGrade` — ранній вихід і порожній цикл.
 *
 * Дефект: `return` при неготовому `authStore` стояв усередині учнівської
 * гілки, але виходив із УСІЄЇ функції. Якщо `test.grade` прилітав раніше,
 * ніж піднявся auth (перезавантаження сторінки, повільний refresh), урок
 * лишався у фазі 'live' з оцінками на руках.
 *
 * Тести стережуть саме РОЗДІЛЕННЯ двох боків — бо зламалось воно.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { useTestStore, type GradeResult } from '../testStore'

// Керований мок: auth буває неготовим — у цьому вся суть §1.
let mockUser: { id: string } | null = null
vi.mock('@/modules/auth/store/authStore', () => ({
  useAuthStore: () => ({ user: mockUser }),
}))

const RESULT: GradeResult = {
  earnedPoints: 8,
  totalPoints: 10,
  percentage: 80,
  details: [{ objectId: 'test-1', correct: true, points: 8, studentAnswer: null, correctAnswer: null }],
}

function startedStore() {
  const store = useTestStore()
  store.onRemoteTestStart({
    testSessionId: 'sess-1',
    testObjects: [],
    testMeta: {},
    pageId: 'page-1',
  })
  return store
}

describe('onRemoteTestGrade — auth НЕ готовий', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    mockUser = null
  })

  it('усе одно переводить урок у розбір', () => {
    const store = startedStore()
    expect(store.testPhase).toBe('live')

    store.onRemoteTestGrade({ results: { 'student-1': RESULT } })

    expect(store.testPhase).toBe('review')
  })

  it('свою оцінку не вигадує — просто не зіставляє', () => {
    const store = startedStore()
    store.onRemoteTestGrade({ results: { 'student-1': RESULT } })

    expect(store.getGradeResult('page-1')).toBeFalsy()
  })

  it('вчительська гілка відпрацьовує попри неготовий auth', () => {
    const store = startedStore()
    store.onRemoteTestAnswer({
      studentId: 'student-7', studentName: 'Оля', objectId: 'test-1', answer: '42',
    })

    store.onRemoteTestGrade({ results: { 'student-7': RESULT } })

    expect(store.studentProgress.get('student-7')?.result).toEqual(RESULT)
  })
})

describe('onRemoteTestGrade — auth готовий', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    mockUser = { id: 'student-1' }
  })

  it('фаза і власна оцінка — обидві на місці', () => {
    const store = startedStore()

    store.onRemoteTestGrade({ results: { 'student-1': RESULT } })

    expect(store.testPhase).toBe('review')
    expect(store.getGradeResult('page-1')).toEqual(RESULT)
  })

  it('підсумок учня лягає в його progress, а не в нікуди', () => {
    const store = startedStore()
    store.onRemoteTestAnswer({
      studentId: 'student-2', studentName: 'Іван', objectId: 'test-1', answer: 'x',
    })

    store.onRemoteTestGrade({ results: { 'student-2': RESULT } })

    const progress = store.studentProgress.get('student-2')
    expect(progress?.result).toEqual(RESULT)
    expect(progress?.studentName).toBe('Іван')
  })

  it('оцінка невідомого учня нічого не створює', () => {
    const store = startedStore()

    store.onRemoteTestGrade({ results: { 'ghost': RESULT } })

    expect(store.studentProgress.size).toBe(0)
    expect(store.testPhase).toBe('review')
  })
})
