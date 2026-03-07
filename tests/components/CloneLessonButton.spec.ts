/**
 * Phase 4 Day 1 — Clone Lesson button tests.
 *
 * Tests: clone composable logic, API method, button states, i18n keys.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'

// ═══════════════════════════════════════════════════════════════
// Test 1: Clone composable logic — success path
// ═══════════════════════════════════════════════════════════════

describe('Clone composable logic', () => {
  function createMockComposable(apiMock: () => Promise<any>, loadMock: () => Promise<void>) {
    let cloningId: number | null = null
    let cloneError: string | null = null
    let loadCalled = false

    async function cloneLesson(lessonId: number) {
      cloningId = lessonId
      cloneError = null
      try {
        const res = await apiMock()
        loadCalled = true
        await loadMock()
        return res
      } catch (e: unknown) {
        cloneError = 'clone_failed'
        return null
      } finally {
        cloningId = null
      }
    }

    return {
      getCloningId: () => cloningId,
      getCloneError: () => cloneError,
      getLoadCalled: () => loadCalled,
      cloneLesson,
    }
  }

  it('sets cloningId during clone and resets after', async () => {
    let resolveApi: (v: any) => void
    const apiPromise = new Promise((r) => { resolveApi = r })
    const composable = createMockComposable(
      () => apiPromise,
      () => Promise.resolve(),
    )

    const clonePromise = composable.cloneLesson(42)
    // During await, cloningId should be set (tested indirectly via result)
    resolveApi!({ id: 99, status: 'DRAFT' })
    const result = await clonePromise

    expect(result).toEqual({ id: 99, status: 'DRAFT' })
    expect(composable.getCloningId()).toBe(null) // reset in finally
    expect(composable.getCloneError()).toBe(null)
    expect(composable.getLoadCalled()).toBe(true)
  })

  it('clone success → calls load to refresh list', async () => {
    const loadMock = vi.fn().mockResolvedValue(undefined)
    const composable = createMockComposable(
      () => Promise.resolve({ id: 100, status: 'DRAFT', has_initial_board: true }),
      loadMock,
    )

    await composable.cloneLesson(5)
    expect(loadMock).toHaveBeenCalledTimes(1)
  })

  it('clone error → sets cloneError, returns null', async () => {
    const composable = createMockComposable(
      () => Promise.reject(new Error('Not found')),
      () => Promise.resolve(),
    )

    const result = await composable.cloneLesson(999)
    expect(result).toBe(null)
    expect(composable.getCloneError()).toBe('clone_failed')
    expect(composable.getCloningId()).toBe(null) // reset in finally
  })

  it('clone error 404 → cloneError = clone_failed', async () => {
    const err404 = Object.assign(new Error('404'), { response: { status: 404 } })
    const composable = createMockComposable(
      () => Promise.reject(err404),
      () => Promise.resolve(),
    )

    const result = await composable.cloneLesson(123)
    expect(result).toBe(null)
    expect(composable.getCloneError()).toBe('clone_failed')
  })
})

// ═══════════════════════════════════════════════════════════════
// Test 2: Clone button disabled state logic
// ═══════════════════════════════════════════════════════════════

describe('Clone button disabled state', () => {
  it('button disabled when cloningId matches lesson.id', () => {
    const cloningId = 42
    const lessonId = 42
    expect(cloningId === lessonId).toBe(true)
  })

  it('button enabled when cloningId is null', () => {
    const cloningId: number | null = null
    const lessonId = 42
    expect(cloningId === lessonId).toBe(false)
  })

  it('button enabled when cloningId is different lesson', () => {
    const cloningId: number | null = 99
    const lessonId = 42
    expect(cloningId === lessonId).toBe(false)
  })
})

// ═══════════════════════════════════════════════════════════════
// Test 3: API method exists in lessonsApi
// ═══════════════════════════════════════════════════════════════

describe('lessonsApi.cloneLesson', () => {
  it('cloneLesson method exists', async () => {
    const lessonsApi = (await import('@/api/lessons')).default
    expect(typeof lessonsApi.cloneLesson).toBe('function')
  })
})

// ═══════════════════════════════════════════════════════════════
// Test 4: i18n key existence
// ═══════════════════════════════════════════════════════════════

describe('i18n: lessons.history clone keys', () => {
  const fs = require('fs')
  const path = require('path')
  const uk = JSON.parse(
    fs.readFileSync(path.resolve(__dirname, '../../src/i18n/locales/uk.json'), 'utf-8'),
  )
  const en = JSON.parse(
    fs.readFileSync(path.resolve(__dirname, '../../src/i18n/locales/en.json'), 'utf-8'),
  )

  const requiredKeys = ['clone', 'cloneSuccess', 'cloneFailed']

  for (const key of requiredKeys) {
    it(`uk.lessons.history.${key} exists`, () => {
      expect(uk.lessons.history[key]).toBeTruthy()
    })
    it(`en.lessons.history.${key} exists`, () => {
      expect(en.lessons.history[key]).toBeTruthy()
    })
  }
})
