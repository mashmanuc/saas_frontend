import { describe, it, expect, beforeEach, vi } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { useTestStore, type TestPhase, type GradeResult } from '../testStore'
import type { WBTestObject } from '../../../types/winterboard'

describe('testStore — Phase 38 TEST LIVE SYNC', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  describe('Initial State', () => {
    it('should initialize with correct default values', () => {
      const store = useTestStore()

      expect(store.testMode).toBe(false)
      expect(store.testPhase).toBe('edit')
      expect(store.activeTestSessionId).toBeNull()
      expect(store.remoteTestObjects).toEqual([])
      expect(store.remoteTestMeta).toBeNull()
      expect(store.remotePageId).toBeNull()
      expect(store.studentProgress.size).toBe(0)
    })
  })

  describe('Getters', () => {
    it('should get answers for page', () => {
      const store = useTestStore()
      const pageId = 'page-1'

      const answers = store.getPageAnswers(pageId)
      expect(answers.size).toBe(0)
    })

    it('should get grade result for page', () => {
      const store = useTestStore()
      expect(store.getGradeResult('non-existent')).toBeNull()
    })
  })

  describe('Classroom Actions (Teacher)', () => {
    it('should start live test and send WS message', () => {
      const store = useTestStore()
      const sendFn = vi.fn()
      const testObjects: WBTestObject[] = [
        { id: 'test-1', type: 'input', x: 0, y: 0, width: 100, height: 100 } as WBTestObject,
      ]
      const pageId = 'page-1'
      const testMeta = { title: 'Test' }

      store.startLiveTest(pageId, testObjects, testMeta, sendFn)

      expect(sendFn).toHaveBeenCalledWith({
        type: 'test.start',
        test_objects: testObjects,
        page_id: pageId,
        test_meta: testMeta,
      })
    })

    it('should end live test and send WS message', () => {
      const store = useTestStore()
      const sendFn = vi.fn()

      // Setup active test session
      store.onRemoteTestStart({
        testSessionId: 'session-123',
        testObjects: [],
        testMeta: {},
        pageId: 'page-1',
      })

      store.endLiveTest(sendFn)

      expect(sendFn).toHaveBeenCalled()
      const call = sendFn.mock.calls[0][0]
      expect(call.type).toBe('test.end')
    })

    it('should request grade', () => {
      const store = useTestStore()
      const sendFn = vi.fn()

      // Setup active test session
      store.onRemoteTestStart({
        testSessionId: 'session-123',
        testObjects: [],
        testMeta: {},
        pageId: 'page-1',
      })

      store.requestGrade(sendFn)

      expect(sendFn).toHaveBeenCalled()
      const call = sendFn.mock.calls[0][0]
      expect(call.type).toBe('test.grade')
    })
  })

  describe('Classroom Actions (Student)', () => {
    it('should submit answer', () => {
      const store = useTestStore()
      const sendFn = vi.fn()
      const objectId = 'test-1'
      const answer = '42'

      // Setup active test session
      store.onRemoteTestStart({
        testSessionId: 'session-123',
        testObjects: [],
        testMeta: {},
        pageId: 'page-1',
      })

      store.submitAnswer(objectId, answer, sendFn)

      expect(sendFn).toHaveBeenCalled()
      const call = sendFn.mock.calls[0][0]
      expect(call.type).toBe('test.answer')
      expect(call.object_id).toBe(objectId)
      expect(call.answer).toBe(answer)
    })
  })

  describe('WS Handlers — test.start', () => {
    it('should handle remote test.start', () => {
      const store = useTestStore()
      const testObjects: WBTestObject[] = [
        { id: 'test-1', type: 'radio', x: 0, y: 0, width: 100, height: 100 } as WBTestObject,
      ]

      store.onRemoteTestStart({
        testSessionId: 'session-123',
        testObjects,
        testMeta: { title: 'Math Test' },
        pageId: 'page-1',
      })

      expect(store.activeTestSessionId).toBe('session-123')
      expect(store.remoteTestObjects).toEqual(testObjects)
      expect(store.remoteTestMeta).toEqual({ title: 'Math Test' })
      expect(store.remotePageId).toBe('page-1')
      expect(store.testPhase).toBe('live')
      expect(store.testMode).toBe(true)
    })

    it('should ignore duplicate test.start (RISK-1 FIX)', () => {
      const store = useTestStore()
      const testObjects1: WBTestObject[] = [
        { id: 'test-1', type: 'input', x: 0, y: 0, width: 100, height: 100 } as WBTestObject,
      ]
      const testObjects2: WBTestObject[] = [
        { id: 'test-2', type: 'radio', x: 0, y: 0, width: 100, height: 100 } as WBTestObject,
      ]

      store.onRemoteTestStart({
        testSessionId: 'session-123',
        testObjects: testObjects1,
        testMeta: {},
        pageId: 'page-1',
      })

      const initialObjects = store.remoteTestObjects

      store.onRemoteTestStart({
        testSessionId: 'session-123',
        testObjects: testObjects2,
        testMeta: {},
        pageId: 'page-1',
      })

      expect(store.remoteTestObjects).toEqual(initialObjects)
      expect(store.remoteTestObjects).not.toEqual(testObjects2)
    })
  })

  describe('WS Handlers — test.answer', () => {
    it('should handle remote test.answer (teacher receives student answer)', () => {
      const store = useTestStore()

      store.onRemoteTestAnswer({
        studentId: 'student-1',
        studentName: 'John Doe',
        objectId: 'test-1',
        answer: '42',
      })

      const progress = store.studentProgress.get('student-1')
      expect(progress).toBeDefined()
      expect(progress?.studentId).toBe('student-1')
      expect(progress?.studentName).toBe('John Doe')
      expect(progress?.answeredCount).toBe(1)
    })

    it('should update existing student progress', () => {
      const store = useTestStore()

      store.onRemoteTestAnswer({
        studentId: 'student-1',
        studentName: 'John Doe',
        objectId: 'test-1',
        answer: '42',
      })

      store.onRemoteTestAnswer({
        studentId: 'student-1',
        studentName: 'John Doe',
        objectId: 'test-2',
        answer: 'Paris',
      })

      const progress = store.studentProgress.get('student-1')
      expect(progress?.answeredCount).toBe(2)
    })

    it('should track multiple students', () => {
      const store = useTestStore()

      store.onRemoteTestAnswer({
        studentId: 'student-1',
        studentName: 'John Doe',
        objectId: 'test-1',
        answer: '42',
      })

      store.onRemoteTestAnswer({
        studentId: 'student-2',
        studentName: 'Jane Smith',
        objectId: 'test-1',
        answer: '43',
      })

      expect(store.studentProgress.size).toBe(2)
      expect(store.studentProgress.get('student-1')?.studentName).toBe('John Doe')
      expect(store.studentProgress.get('student-2')?.studentName).toBe('Jane Smith')
    })
  })


  describe('WS Handlers — test.grade', () => {
    it('should handle remote test.grade with student result', () => {
      const store = useTestStore()
      const pageId = 'page-1'
      const result: GradeResult = {
        earnedPoints: 8,
        totalPoints: 10,
        percentage: 80,
        details: [{ objectId: 'test-1', correct: true, points: 8, studentAnswer: null, correctAnswer: null }],
      }

      store.onRemoteTestGrade({
        results: { 'student-1': result },
      })

      expect(store.testPhase).toBe('review')
    })

    it('should handle remote test.grade without result (teacher view)', () => {
      const store = useTestStore()

      store.onRemoteTestGrade({
        results: {} as Record<string, GradeResult>,
      })

      expect(store.testPhase).toBe('review')
    })
  })

  describe('WS Handlers — test.sync', () => {
    it('should handle remote test.sync and restore state', () => {
      const store = useTestStore()
      const testObjects: WBTestObject[] = [
        { id: 'test-1', type: 'input', x: 0, y: 0, width: 100, height: 100 } as WBTestObject,
      ]
      const myAnswers = { 'test-1': '42' }
      const myResult: GradeResult = {
        earnedPoints: 10,
        totalPoints: 10,
        percentage: 100,
        details: [],
      }

      store.onRemoteTestSync({
        testSessionId: 'session-123',
        testObjects,
        testMeta: { title: 'Synced Test' },
        phase: 'review',
        pageId: 'page-1',
        myAnswers,
        myResult,
      })

      expect(store.activeTestSessionId).toBe('session-123')
      expect(store.remoteTestObjects).toEqual(testObjects)
      expect(store.testPhase).toBe('review')
      expect(store.remotePageId).toBe('page-1')
      expect(store.getPageAnswers('page-1').get('test-1')).toBe('42')
      expect(store.getGradeResult('page-1')).toEqual(myResult)
    })

    it('should handle test.sync without answers (teacher view)', () => {
      const store = useTestStore()

      store.onRemoteTestSync({
        testSessionId: 'session-123',
        testObjects: [],
        testMeta: {},
        phase: 'live',
        pageId: 'page-1',
      })

      expect(store.activeTestSessionId).toBe('session-123')
      expect(store.testPhase).toBe('live')
    })

    it('should overwrite local state (RISK-2 DECISION)', () => {
      const store = useTestStore()
      const pageId = 'page-1'

      store.setAnswer(pageId, 'test-1', 'local-answer')

      store.onRemoteTestSync({
        testSessionId: 'session-123',
        testObjects: [],
        testMeta: {},
        phase: 'live',
        pageId,
        myAnswers: { 'test-1': 'server-answer' },
      })

      expect(store.getPageAnswers(pageId).get('test-1')).toBe('server-answer')
    })
  })

  describe('WS Handlers — test.end', () => {
    it('should handle remote test.end and cleanup state', () => {
      const store = useTestStore()

      store.activeTestSessionId = 'session-123'
      store.remoteTestObjects = [{ id: 'test-1' } as WBTestObject]
      store.remotePageId = 'page-1'
      store.testMode = true
      store.testPhase = 'review'

      store.onRemoteTestEnd()

      expect(store.activeTestSessionId).toBeNull()
      expect(store.remoteTestObjects).toEqual([])
      expect(store.remotePageId).toBeNull()
      expect(store.testMode).toBe(false)
      expect(store.testPhase).toBe('edit')
      expect(store.studentProgress.size).toBe(0)
    })
  })

  describe('Edge Cases', () => {
    it('should handle empty test objects', () => {
      const store = useTestStore()

      store.onRemoteTestStart({
        testSessionId: 'session-123',
        testObjects: [],
        testMeta: {},
        pageId: 'page-1',
      })

      expect(store.remoteTestObjects).toEqual([])
      expect(store.activeTestSessionId).toBe('session-123')
    })

    it('should handle student progress with zero total count', () => {
      const store = useTestStore()

      store.onRemoteTestAnswer({
        studentId: 'student-1',
        studentName: 'John Doe',
        objectId: 'test-1',
        answer: '42',
      })

      const progress = store.studentProgress.get('student-1')
      expect(progress?.totalCount).toBe(0)
    })

    it('should maintain reactivity for studentProgress Map', () => {
      const store = useTestStore()

      expect(store.studentProgress.size).toBe(0)

      store.onRemoteTestAnswer({
        studentId: 'student-1',
        studentName: 'John Doe',
        objectId: 'test-1',
        answer: '42',
      })

      expect(store.studentProgress.size).toBe(1)
    })
  })

  describe('Integration Scenarios', () => {
    it('should handle full teacher flow: start → receive answers → grade → end', () => {
      const store = useTestStore()
      const sendFn = vi.fn()
      const testObjects: WBTestObject[] = [
        { id: 'test-1', type: 'input', x: 0, y: 0, width: 100, height: 100 } as WBTestObject,
      ]

      store.startLiveTest('page-1', testObjects, {}, sendFn)

      store.onRemoteTestAnswer({
        studentId: 'student-1',
        studentName: 'John Doe',
        objectId: 'test-1',
        answer: '42',
      })

      expect(store.studentProgress.size).toBe(1)

      store.requestGrade(sendFn)

      store.onRemoteTestGrade({ results: {} })
      expect(store.testPhase).toBe('review')

      store.endLiveTest(sendFn)
      store.onRemoteTestEnd()

      expect(store.activeTestSessionId).toBeNull()
      expect(store.testMode).toBe(false)
    })

    it('should handle full student flow: receive → answer → refresh → see results', () => {
      const store = useTestStore()
      const sendFn = vi.fn()
      const testObjects: WBTestObject[] = [
        { id: 'test-1', type: 'input', x: 0, y: 0, width: 100, height: 100 } as WBTestObject,
      ]

      store.onRemoteTestStart({
        testSessionId: 'session-123',
        testObjects,
        testMeta: {},
        pageId: 'page-1',
      })

      store.submitAnswer('test-1', '42', sendFn)

      store.onRemoteTestSync({
        testSessionId: 'session-123',
        testObjects,
        testMeta: {},
        phase: 'live',
        pageId: 'page-1',
        myAnswers: { 'test-1': '42' },
      })

      expect(store.getPageAnswers('page-1').get('test-1')).toBe('42')

      const result: GradeResult = {
        earnedPoints: 10,
        totalPoints: 10,
        percentage: 100,
        details: [],
      }

      store.onRemoteTestGrade({
        results: { 'student-1': result },
      })

      expect(store.testPhase).toBe('review')
    })
  })
})
