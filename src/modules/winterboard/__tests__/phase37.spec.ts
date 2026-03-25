/**
 * Phase 37: Unit tests — test system: types, CRUD, grading, store
 */
import { describe, it, expect, beforeEach } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { useWBStore } from '../board/state/boardStore'
import { useTestStore } from '../board/state/testStore'
import { checkAnswer, gradeTest } from '../utils/testGrading'
import type {
  WBTestObject,
  WBTestInput,
  WBTestRadio,
  WBTestCheckbox,
  WBTestDropdown,
  WBTestGapFill,
  WBTestMatching,
} from '../types/winterboard'

// ─── Helpers ─────────────────────────────────────────────────────────────────

function seedPage(store: ReturnType<typeof useWBStore>) {
  if (store.pages.length === 0) {
    store.pages = [{ id: 'page-1', name: 'Page 1', strokes: [], assets: [] }]
    store.currentPageIndex = 0
  }
}

function makeTestInput(overrides: Partial<WBTestInput> = {}): WBTestInput {
  return {
    id: `test-${Math.random().toString(36).slice(2, 8)}`,
    type: 'input',
    x: 100,
    y: 100,
    width: 250,
    height: 40,
    points: 1,
    createdBy: 'local',
    createdAt: Date.now(),
    inputType: 'text',
    correctAnswer: 'Paris',
    caseSensitive: false,
    ...overrides,
  }
}

function makeTestRadio(overrides: Partial<WBTestRadio> = {}): WBTestRadio {
  return {
    id: `test-${Math.random().toString(36).slice(2, 8)}`,
    type: 'radio',
    x: 100,
    y: 200,
    width: 250,
    height: 120,
    points: 2,
    createdBy: 'local',
    createdAt: Date.now(),
    options: ['Red', 'Blue', 'Green'],
    correctIndex: 1,
    layout: 'vertical',
    ...overrides,
  }
}

function makeTestCheckbox(overrides: Partial<WBTestCheckbox> = {}): WBTestCheckbox {
  return {
    id: `test-${Math.random().toString(36).slice(2, 8)}`,
    type: 'checkbox',
    x: 100,
    y: 300,
    width: 250,
    height: 120,
    points: 3,
    createdBy: 'local',
    createdAt: Date.now(),
    options: ['A', 'B', 'C', 'D'],
    correctIndices: [0, 2],
    layout: 'vertical',
    ...overrides,
  }
}

function makeTestGapFill(overrides: Partial<WBTestGapFill> = {}): WBTestGapFill {
  return {
    id: `test-${Math.random().toString(36).slice(2, 8)}`,
    type: 'gap-fill',
    x: 100,
    y: 400,
    width: 300,
    height: 80,
    points: 2,
    createdBy: 'local',
    createdAt: Date.now(),
    template: 'The capital of ___ is ___',
    gaps: [
      { position: 15, correctAnswer: 'France', caseSensitive: false },
      { position: 22, correctAnswer: 'Paris', caseSensitive: false },
    ],
    ...overrides,
  }
}

function makeTestMatching(overrides: Partial<WBTestMatching> = {}): WBTestMatching {
  return {
    id: `test-${Math.random().toString(36).slice(2, 8)}`,
    type: 'matching',
    x: 100,
    y: 500,
    width: 400,
    height: 160,
    points: 3,
    createdBy: 'local',
    createdAt: Date.now(),
    leftItems: ['Київ', 'Париж', 'Берлін'],
    rightItems: ['Україна', 'Франція', 'Німеччина'],
    correctPairs: [0, 1, 2], // Київ→Україна, Париж→Франція, Берлін→Німеччина
    ...overrides,
  }
}

// ─── Tests: Grading ──────────────────────────────────────────────────────────

describe('Phase 37: checkAnswer', () => {
  it('input: correct case-insensitive', () => {
    const obj = makeTestInput({ correctAnswer: 'Paris', caseSensitive: false })
    expect(checkAnswer(obj, 'paris')).toBe(true)
    expect(checkAnswer(obj, 'PARIS')).toBe(true)
    expect(checkAnswer(obj, ' Paris ')).toBe(true)
  })

  it('input: correct case-sensitive', () => {
    const obj = makeTestInput({ correctAnswer: 'Paris', caseSensitive: true })
    expect(checkAnswer(obj, 'Paris')).toBe(true)
    expect(checkAnswer(obj, 'paris')).toBe(false)
  })

  it('input: number type', () => {
    const obj = makeTestInput({ inputType: 'number', correctAnswer: '42' })
    expect(checkAnswer(obj, '42')).toBe(true)
    expect(checkAnswer(obj, '42.0')).toBe(true)
    expect(checkAnswer(obj, '43')).toBe(false)
  })

  it('input: empty answer is wrong', () => {
    const obj = makeTestInput({ correctAnswer: 'Paris' })
    expect(checkAnswer(obj, '')).toBe(false)
    expect(checkAnswer(obj, null)).toBe(false)
    expect(checkAnswer(obj, undefined)).toBe(false)
  })

  it('radio: correct index', () => {
    const obj = makeTestRadio({ correctIndex: 1 })
    expect(checkAnswer(obj, 1)).toBe(true)
    expect(checkAnswer(obj, 0)).toBe(false)
    expect(checkAnswer(obj, 2)).toBe(false)
  })

  it('checkbox: correct indices (order-independent)', () => {
    const obj = makeTestCheckbox({ correctIndices: [0, 2] })
    expect(checkAnswer(obj, [0, 2])).toBe(true)
    expect(checkAnswer(obj, [2, 0])).toBe(true) // order doesn't matter
    expect(checkAnswer(obj, [0])).toBe(false) // missing one
    expect(checkAnswer(obj, [0, 1, 2])).toBe(false) // extra
  })

  it('dropdown: correct index', () => {
    const obj: WBTestDropdown = {
      id: 'dd-1',
      type: 'dropdown',
      x: 0, y: 0, width: 200, height: 40,
      points: 1,
      createdBy: 'local',
      createdAt: Date.now(),
      options: ['A', 'B', 'C'],
      correctIndex: 2,
    }
    expect(checkAnswer(obj, 2)).toBe(true)
    expect(checkAnswer(obj, 0)).toBe(false)
  })

  it('gap-fill: all gaps correct', () => {
    const obj = makeTestGapFill()
    expect(checkAnswer(obj, ['France', 'Paris'])).toBe(true)
    expect(checkAnswer(obj, ['france', 'paris'])).toBe(true) // case-insensitive
    expect(checkAnswer(obj, ['France', 'London'])).toBe(false)
    expect(checkAnswer(obj, ['France'])).toBe(false) // missing gap
  })

  it('gap-fill: case-sensitive gap', () => {
    const obj = makeTestGapFill({
      gaps: [
        { position: 15, correctAnswer: 'France', caseSensitive: true },
        { position: 22, correctAnswer: 'Paris', caseSensitive: true },
      ],
    })
    expect(checkAnswer(obj, ['France', 'Paris'])).toBe(true)
    expect(checkAnswer(obj, ['france', 'paris'])).toBe(false)
  })

  it('matching: all pairs correct', () => {
    const obj = makeTestMatching()
    expect(checkAnswer(obj, [0, 1, 2])).toBe(true)
  })

  it('matching: one pair wrong', () => {
    const obj = makeTestMatching()
    expect(checkAnswer(obj, [0, 2, 1])).toBe(false) // swapped Франція/Німеччина
  })

  it('matching: incomplete answer', () => {
    const obj = makeTestMatching()
    expect(checkAnswer(obj, [0, 1])).toBe(false) // missing one pair
  })

  it('matching: empty answer', () => {
    const obj = makeTestMatching()
    expect(checkAnswer(obj, [])).toBe(false)
    expect(checkAnswer(obj, null)).toBe(false)
  })
})

describe('Phase 37: gradeTest', () => {
  it('grades multiple questions including matching', () => {
    const objects: WBTestObject[] = [
      makeTestInput({ id: 'q1', points: 1, correctAnswer: 'Paris' }),
      makeTestRadio({ id: 'q2', points: 2, correctIndex: 1 }),
      makeTestCheckbox({ id: 'q3', points: 3, correctIndices: [0, 2] }),
      makeTestMatching({ id: 'q4', points: 3, leftItems: ['A', 'B'], rightItems: ['1', '2'], correctPairs: [0, 1] }),
    ]

    const answers = new Map<string, unknown>([
      ['q1', 'Paris'],
      ['q2', 1],
      ['q3', [0, 2]],
      ['q4', [0, 1]],
    ])

    const result = gradeTest(objects, answers)
    expect(result.totalPoints).toBe(9)
    expect(result.earnedPoints).toBe(9)
    expect(result.percentage).toBe(100)
    expect(result.details).toHaveLength(4)
    expect(result.details.every(d => d.correct)).toBe(true)
  })

  it('handles partial correct answers', () => {
    const objects: WBTestObject[] = [
      makeTestInput({ id: 'q1', points: 1, correctAnswer: 'Paris' }),
      makeTestRadio({ id: 'q2', points: 2, correctIndex: 1 }),
    ]

    const answers = new Map<string, unknown>([
      ['q1', 'London'], // wrong
      ['q2', 1],        // correct
    ])

    const result = gradeTest(objects, answers)
    expect(result.totalPoints).toBe(3)
    expect(result.earnedPoints).toBe(2)
    expect(result.percentage).toBeCloseTo(66.67, 1)
    expect(result.details[0].correct).toBe(false)
    expect(result.details[1].correct).toBe(true)
  })

  it('handles no answers', () => {
    const objects: WBTestObject[] = [
      makeTestInput({ id: 'q1', points: 1, correctAnswer: 'Paris' }),
    ]
    const answers = new Map<string, unknown>()
    const result = gradeTest(objects, answers)
    expect(result.earnedPoints).toBe(0)
    expect(result.percentage).toBe(0)
  })

  it('handles empty test', () => {
    const result = gradeTest([], new Map())
    expect(result.totalPoints).toBe(0)
    expect(result.earnedPoints).toBe(0)
    expect(result.percentage).toBe(0)
    expect(result.details).toHaveLength(0)
  })
})

// ─── Tests: Store CRUD ───────────────────────────────────────────────────────

describe('Phase 37: boardStore test CRUD', () => {
  let store: ReturnType<typeof useWBStore>

  beforeEach(() => {
    setActivePinia(createPinia())
    store = useWBStore()
    seedPage(store)
  })

  it('addTestObject adds to current page', () => {
    const obj = makeTestInput({ id: 'test-1' })
    store.addTestObject(obj)

    expect(store.pages[0].testObjects).toHaveLength(1)
    expect(store.pages[0].testObjects![0].id).toBe('test-1')
  })

  it('deleteTestObject removes from page', () => {
    const obj = makeTestInput({ id: 'test-1' })
    store.addTestObject(obj)
    expect(store.pages[0].testObjects).toHaveLength(1)

    store.deleteTestObject('test-1')
    expect(store.pages[0].testObjects).toHaveLength(0)
  })

  it('updateTestObject updates fields', () => {
    const obj = makeTestInput({ id: 'test-1', label: 'Old' })
    store.addTestObject(obj)

    store.updateTestObject('test-1', { label: 'New', points: 5 })
    const updated = store.pages[0].testObjects![0]
    expect(updated.label).toBe('New')
    expect(updated.points).toBe(5)
  })

  it('getTestObjectById returns correct object', () => {
    const obj = makeTestInput({ id: 'test-1' })
    store.addTestObject(obj)

    expect(store.getTestObjectById('test-1')).toBeTruthy()
    expect(store.getTestObjectById('test-1')!.id).toBe('test-1')
    expect(store.getTestObjectById('nonexistent')).toBeNull()
  })

  it('undo addTestObject', () => {
    store.addTestObject(makeTestInput({ id: 'test-1' }))
    expect(store.pages[0].testObjects).toHaveLength(1)

    store.undo()
    expect(store.pages[0].testObjects).toHaveLength(0)
  })

  it('undo deleteTestObject', () => {
    store.addTestObject(makeTestInput({ id: 'test-1' }))
    store.deleteTestObject('test-1')
    expect(store.pages[0].testObjects).toHaveLength(0)

    store.undo()
    expect(store.pages[0].testObjects).toHaveLength(1)
    expect(store.pages[0].testObjects![0].id).toBe('test-1')
  })

  it('undo updateTestObject', () => {
    store.addTestObject(makeTestInput({ id: 'test-1', label: 'Original' }))
    store.updateTestObject('test-1', { label: 'Changed' })
    expect(store.pages[0].testObjects![0].label).toBe('Changed')

    store.undo()
    expect(store.pages[0].testObjects![0].label).toBe('Original')
  })

  it('redo addTestObject', () => {
    store.addTestObject(makeTestInput({ id: 'test-1' }))
    store.undo()
    store.redo()
    expect(store.pages[0].testObjects).toHaveLength(1)
  })

  it('test objects are per-page', () => {
    store.addTestObject(makeTestInput({ id: 'p1-test' }))
    expect(store.pages[0].testObjects).toHaveLength(1)

    // Add second page and switch to it
    store.pages = [
      ...store.pages,
      { id: 'page-2', name: 'Page 2', strokes: [], assets: [] },
    ]
    store.currentPageIndex = 1

    // Page 2 should have no test objects
    expect(store.currentPage?.testObjects ?? []).toHaveLength(0)

    // Add test to page 2
    store.addTestObject(makeTestInput({ id: 'p2-test' }))
    expect(store.pages[1].testObjects).toHaveLength(1)

    // Page 1 still has its test
    expect(store.pages[0].testObjects).toHaveLength(1)
    expect(store.pages[0].testObjects![0].id).toBe('p1-test')
  })
})

// ─── Tests: testStore ────────────────────────────────────────────────────────

describe('Phase 37: testStore', () => {
  let testStore: ReturnType<typeof useTestStore>

  beforeEach(() => {
    setActivePinia(createPinia())
    testStore = useTestStore()
  })

  it('toggleTestMode toggles on/off', () => {
    expect(testStore.testMode).toBe(false)
    testStore.toggleTestMode()
    expect(testStore.testMode).toBe(true)
    testStore.toggleTestMode()
    expect(testStore.testMode).toBe(false)
  })

  it('exiting test mode also exits player mode', () => {
    testStore.toggleTestMode() // enter
    testStore.togglePlayerMode() // enter play
    expect(testStore.testPlayerMode).toBe(true)

    testStore.toggleTestMode() // exit
    expect(testStore.testMode).toBe(false)
    expect(testStore.testPlayerMode).toBe(false)
  })

  it('answers are per-page', () => {
    testStore.setAnswer('page-1', 'q1', 'Paris')
    testStore.setAnswer('page-2', 'q1', 'London')

    expect(testStore.getAnswer('page-1', 'q1')).toBe('Paris')
    expect(testStore.getAnswer('page-2', 'q1')).toBe('London')
  })

  it('clearPageAnswers resets a page', () => {
    testStore.setAnswer('page-1', 'q1', 'Paris')
    testStore.clearPageAnswers('page-1')
    expect(testStore.getAnswer('page-1', 'q1')).toBeUndefined()
  })

  it('gradePage stores result per page', () => {
    const objects: WBTestObject[] = [
      makeTestInput({ id: 'q1', points: 1, correctAnswer: 'Paris' }),
    ]
    testStore.setAnswer('page-1', 'q1', 'Paris')
    const result = testStore.gradePage('page-1', objects)

    expect(result.earnedPoints).toBe(1)
    expect(testStore.getGradeResult('page-1')).toBeTruthy()
    expect(testStore.getGradeResult('page-2')).toBeNull()
  })

  it('resetAll clears everything', () => {
    testStore.toggleTestMode()
    testStore.setAnswer('page-1', 'q1', 'X')
    testStore.selectTestObject('test-1')

    testStore.resetAll()
    expect(testStore.testMode).toBe(false)
    expect(testStore.selectedTestId).toBeNull()
    expect(testStore.getAnswer('page-1', 'q1')).toBeUndefined()
  })
})
