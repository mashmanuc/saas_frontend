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
import { useAuthStore } from '@/modules/auth/store/authStore'

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

export interface StudentProgress {
  studentId: string
  studentName: string
  answeredCount: number
  totalCount: number
  answers: Map<string, unknown> // objectId → answer
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

  // ─── Phase 38: Classroom Mode (WS sync) ────────────────────────────────────
  // Active test session ID (from backend WBTestSession)
  const activeTestSessionId = ref<string | null>(null)

  // Remote test objects received from teacher (student side)
  const remoteTestObjects = ref<WBTestObject[]>([])
  const remoteTestMeta = ref<Record<string, unknown> | null>(null)
  const remotePageId = ref<string | null>(null)

  // Teacher side: student progress tracking
  // studentId → StudentProgress
  const studentProgress = ref<Map<string, StudentProgress>>(new Map())

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

  // ─── Phase 38: Classroom Actions ───────────────────────────────────────────

  /** Teacher: start live test (sends WS test.start) */
  function startLiveTest(
    pageId: string,
    testObjects: WBTestObject[],
    testMeta: Record<string, unknown>,
    sendWsFn: (msg: unknown) => void
  ) {
    sendWsFn({
      type: 'test.start',
      page_id: pageId,
      test_objects: testObjects,
      test_meta: testMeta,
    })
    // Local state will be updated via WS echo
  }

  /** Teacher: end live test (sends WS test.end) */
  function endLiveTest(sendWsFn: (msg: unknown) => void) {
    if (!activeTestSessionId.value || !remotePageId.value) return

    sendWsFn({
      type: 'test.end',
      test_session_id: activeTestSessionId.value,
      page_id: remotePageId.value,
    })

    // Reset local state
    activeTestSessionId.value = null
    remoteTestObjects.value = []
    remoteTestMeta.value = null
    remotePageId.value = null
    studentProgress.value.clear()
    testPhase.value = 'edit'
    testMode.value = false
  }

  /** Teacher: request grading (sends WS test.grade) */
  function requestGrade(sendWsFn: (msg: unknown) => void) {
    if (!activeTestSessionId.value || !remotePageId.value) return

    sendWsFn({
      type: 'test.grade',
      test_session_id: activeTestSessionId.value,
      page_id: remotePageId.value,
    })
  }

  /** Student: submit answer (sends WS test.answer) */
  function submitAnswer(
    objectId: string,
    answer: unknown,
    sendWsFn: (msg: unknown) => void
  ) {
    if (!activeTestSessionId.value || !remotePageId.value) return

    // Save locally first (optimistic UI)
    setAnswer(remotePageId.value, objectId, answer)

    // Send to backend
    sendWsFn({
      type: 'test.answer',
      test_session_id: activeTestSessionId.value,
      object_id: objectId,
      answer: answer,
      page_id: remotePageId.value,
    })
  }

  /** WS handler: remote test.start */
  function onRemoteTestStart(data: {
    testSessionId: string
    testObjects: WBTestObject[]
    testMeta: Record<string, unknown>
    pageId: string
  }) {
    // RISK-1 FIX: Ignore duplicate test.start (reconnect scenario)
    if (activeTestSessionId.value === data.testSessionId) {
      console.info('[testStore] Ignoring duplicate test.start for session', data.testSessionId)
      return
    }

    activeTestSessionId.value = data.testSessionId
    remoteTestObjects.value = data.testObjects
    remoteTestMeta.value = data.testMeta
    remotePageId.value = data.pageId
    testPhase.value = 'live'
    testMode.value = true
  }

  /** WS handler: remote test.answer (teacher receives student answer) */
  function onRemoteTestAnswer(data: {
    studentId: string
    studentName: string
    objectId: string
    answer: unknown
  }) {
    const { studentId, studentName, objectId, answer } = data

    let progress = studentProgress.value.get(studentId)
    if (!progress) {
      progress = {
        studentId,
        studentName,
        answeredCount: 0,
        totalCount: remoteTestObjects.value.length,
        answers: new Map(),
      }
      studentProgress.value.set(studentId, progress)
    }

    const hadAnswer = progress.answers.has(objectId)
    progress.answers.set(objectId, answer)
    if (!hadAnswer) {
      progress.answeredCount++
    }

    triggerRef(studentProgress)
  }

  /** WS handler: remote test.grade */
  function onRemoteTestGrade(data: {
    results: Record<string, GradeResult>
  }) {
    // Store my result (student side)
    if (remotePageId.value && data.results) {
      const authStore = useAuthStore()
      if (!authStore.user?.id) {
        console.warn('[testStore] User not ready — cannot match grade result')
        return
      }
      const myUserId = String(authStore.user.id)
      const myResult = data.results[myUserId]
      if (myResult) {
        gradeResultPerPage.value.set(remotePageId.value, myResult)
      }
    }

    // Update student progress with results (teacher side)
    for (const [studentId, result] of Object.entries(data.results)) {
      const progress = studentProgress.value.get(studentId)
      if (progress) {
        // Store result in progress (можна додати поле result: GradeResult)
      }
    }

    testPhase.value = 'review'
  }

  /** WS handler: remote test.sync (resync on connect) */
  function onRemoteTestSync(data: {
    testSessionId: string
    testObjects: WBTestObject[]
    testMeta: Record<string, unknown>
    phase: TestPhase
    pageId: string
    myAnswers?: Record<string, unknown>
    myResult?: GradeResult
    allAnswers?: Record<string, Record<string, unknown>>
    allResults?: Record<string, GradeResult>
  }) {
    // INV-TEST-7: SINGLE SOURCE OF TRUTH — replace local state
    // RISK-2 DECISION: sync завжди overwrite (backend = authority)
    // Pending local answers губляться — це усвідомлений trade-off для consistency
    activeTestSessionId.value = data.testSessionId
    remoteTestObjects.value = data.testObjects
    remoteTestMeta.value = data.testMeta
    remotePageId.value = data.pageId
    testPhase.value = data.phase
    testMode.value = true

    // Restore student answers from server
    if (data.myAnswers && data.pageId) {
      const pageAnswers = new Map<string, unknown>()
      for (const [objId, answer] of Object.entries(data.myAnswers)) {
        pageAnswers.set(objId, answer)
      }
      answersPerPage.value.set(data.pageId, pageAnswers)
    }

    // Restore student result (review phase)
    if (data.myResult && data.pageId) {
      gradeResultPerPage.value.set(data.pageId, data.myResult)
    }

    // Teacher: rebuild studentProgress from allAnswers
    if (data.allAnswers) {
      studentProgress.value.clear()
      for (const [studentId, studentAnswers] of Object.entries(data.allAnswers)) {
        const answersMap = new Map<string, unknown>()
        for (const [objId, answer] of Object.entries(studentAnswers)) {
          answersMap.set(objId, answer)
        }
        studentProgress.value.set(studentId, {
          studentId,
          studentName: `Student ${studentId}`, // TODO: get from presence
          answeredCount: answersMap.size,
          totalCount: data.testObjects.length,
          answers: answersMap,
        })
      }
    }
  }

  /** WS handler: remote test.end */
  function onRemoteTestEnd() {
    activeTestSessionId.value = null
    remoteTestObjects.value = []
    remoteTestMeta.value = null
    remotePageId.value = null
    studentProgress.value.clear()
    testPhase.value = 'edit'
    testMode.value = false
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
    // Phase 38
    activeTestSessionId.value = null
    remoteTestObjects.value = []
    remoteTestMeta.value = null
    remotePageId.value = null
    studentProgress.value.clear()
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
    // Phase 38: Classroom state
    activeTestSessionId,
    remoteTestObjects,
    remoteTestMeta,
    remotePageId,
    studentProgress,
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
    // Phase 38: Classroom actions
    startLiveTest,
    endLiveTest,
    requestGrade,
    submitAnswer,
    onRemoteTestStart,
    onRemoteTestAnswer,
    onRemoteTestGrade,
    onRemoteTestSync,
    onRemoteTestEnd,
  }
})
