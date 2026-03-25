/**
 * Phase 37: Test Store — окремий Pinia store для test system.
 *
 * 3-фазна архітектура:
 *   edit   → вчитель конструює тест (видно правильні відповіді)
 *   live   → учень проходить тест (порожні поля, відповіді приховані)
 *   review → перегляд результатів (зелене/червоне підсвічування)
 *
 * Принципи:
 * - testMode / testPhase — ГЛОБАЛЬНІ (не скидаються при page switch)
 * - answers — PER PAGE (answersPerPage map)
 * - testObjects живуть у WBPage (boardStore), НЕ тут
 * - selectedTestId — окремий від boardStore.selectedIds (FIX-9)
 */
import { defineStore } from 'pinia'
import { ref, triggerRef } from 'vue'
import type { WBTestObject } from '../../types/winterboard'
import { gradeTest, checkAnswer } from '../../utils/testGrading'

export type TestPhase = 'edit' | 'live' | 'review'

export interface GradeResult {
  totalPoints: number
  earnedPoints: number
  percentage: number
  details: Array<{
    objectId: string
    correct: boolean
    points: number
    studentAnswer: unknown
    correctAnswer: unknown
  }>
}

export const useTestStore = defineStore('wb-test', () => {
  // ─── Global Mode ────────────────────────────────────────────────────────────
  const testMode = ref(false)
  const testPhase = ref<TestPhase>('edit')

  /** @deprecated Compat shim — use testPhase instead */
  const testPlayerMode = ref(false)

  // ─── Selection (FIX-9: separate from boardStore.selectedIds) ────────────────
  const selectedTestId = ref<string | null>(null)

  // ─── Per-Page State ─────────────────────────────────────────────────────────
  // pageId → Map<objectId, answer>
  const answersPerPage = ref<Map<string, Map<string, unknown>>>(new Map())
  // pageId → GradeResult
  const gradeResultPerPage = ref<Map<string, GradeResult | null>>(new Map())

  // ─── Per-element inline check (Phase 38) ──────────────────────────────────
  // pageId → Map<objectId, correct: boolean>
  const checkedPerPage = ref<Map<string, Map<string, boolean>>>(new Map())

  // ─── Currently active test tool (for creating new test objects) ─────────────
  type TestTool = 'input' | 'radio' | 'checkbox' | 'dropdown' | 'gap-fill' | 'matching' | null
  const activeTestTool = ref<TestTool>(null)

  // ─── Phase Transitions ────────────────────────────────────────────────────

  function toggleTestMode() {
    testMode.value = !testMode.value
    if (!testMode.value) {
      // Exiting test mode → reset to edit phase
      testPhase.value = 'edit'
      testPlayerMode.value = false
      activeTestTool.value = null
      selectedTestId.value = null
    }
  }

  /** Transition to a specific phase */
  function setTestPhase(phase: TestPhase) {
    testPhase.value = phase
    // Sync legacy flag
    testPlayerMode.value = phase !== 'edit'

    if (phase === 'edit') {
      // Back to edit — deselect play state
    } else if (phase === 'live') {
      // Going live — deactivate creation tools, deselect
      activeTestTool.value = null
      selectedTestId.value = null
    }
    // review — keep answers + grade result visible
  }

  /** @deprecated Use setTestPhase instead */
  function togglePlayerMode() {
    if (testPhase.value === 'edit') {
      setTestPhase('live')
    } else {
      setTestPhase('edit')
    }
  }

  function selectTestObject(id: string | null) {
    selectedTestId.value = id
  }

  function setActiveTestTool(tool: TestTool) {
    activeTestTool.value = tool
  }

  // ─── Answers ────────────────────────────────────────────────────────────────

  function getPageAnswers(pageId: string): Map<string, unknown> {
    if (!answersPerPage.value.has(pageId)) {
      answersPerPage.value.set(pageId, new Map())
    }
    return answersPerPage.value.get(pageId)!
  }

  function setAnswer(pageId: string, objectId: string, answer: unknown) {
    getPageAnswers(pageId).set(objectId, answer)
    // Phase 38: скинути inline check коли відповідь змінюється
    if (checkedPerPage.value.get(pageId)?.delete(objectId)) {
      triggerRef(checkedPerPage)
    }
  }

  function getAnswer(pageId: string, objectId: string): unknown {
    return answersPerPage.value.get(pageId)?.get(objectId)
  }

  function clearPageAnswers(pageId: string) {
    answersPerPage.value.set(pageId, new Map())
    gradeResultPerPage.value.set(pageId, null)
    checkedPerPage.value.set(pageId, new Map())
  }

  // ─── Inline Check (Phase 38) ────────────────────────────────────────────────

  /** Перевірити одну відповідь inline — без переходу в review */
  function checkSingleAnswer(pageId: string, objectId: string, testObject: WBTestObject): boolean {
    const answer = getAnswer(pageId, objectId)
    const correct = checkAnswer(testObject, answer)
    if (!checkedPerPage.value.has(pageId)) {
      checkedPerPage.value.set(pageId, new Map())
    }
    checkedPerPage.value.get(pageId)!.set(objectId, correct)
    triggerRef(checkedPerPage) // Vue reactivity: Map mutation не тригерить ref
    return correct
  }

  /** Отримати результат inline перевірки */
  function getCheckedResult(pageId: string, objectId: string): boolean | undefined {
    return checkedPerPage.value.get(pageId)?.get(objectId)
  }

  /** Скинути inline перевірку для одного елемента (коли відповідь змінилась) */
  function clearCheck(pageId: string, objectId: string) {
    if (checkedPerPage.value.get(pageId)?.delete(objectId)) {
      triggerRef(checkedPerPage)
    }
  }

  /** Отримати всю map перевірок для сторінки */
  function getPageChecks(pageId: string): Map<string, boolean> | undefined {
    return checkedPerPage.value.get(pageId)
  }

  // ─── Grading ────────────────────────────────────────────────────────────────

  function gradePage(pageId: string, testObjects: WBTestObject[]): GradeResult {
    const answers = getPageAnswers(pageId)
    const result = gradeTest(testObjects, answers)
    gradeResultPerPage.value.set(pageId, result)
    return result
  }

  function getGradeResult(pageId: string): GradeResult | null {
    return gradeResultPerPage.value.get(pageId) ?? null
  }

  // ─── Reset ──────────────────────────────────────────────────────────────────

  function resetAll() {
    testMode.value = false
    testPhase.value = 'edit'
    testPlayerMode.value = false
    selectedTestId.value = null
    activeTestTool.value = null
    answersPerPage.value = new Map()
    gradeResultPerPage.value = new Map()
    checkedPerPage.value = new Map()
  }

  return {
    // State
    testMode,
    testPhase,
    testPlayerMode, // deprecated compat
    selectedTestId,
    activeTestTool,
    answersPerPage,
    gradeResultPerPage,
    checkedPerPage,
    // Actions
    toggleTestMode,
    setTestPhase,
    togglePlayerMode, // deprecated compat
    selectTestObject,
    setActiveTestTool,
    getPageAnswers,
    setAnswer,
    getAnswer,
    clearPageAnswers,
    checkSingleAnswer,
    getCheckedResult,
    clearCheck,
    getPageChecks,
    gradePage,
    getGradeResult,
    resetAll,
  }
})
