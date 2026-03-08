// Phase 2: Unit tests for useLessonRuntimeStore
// Ref: TASK_BOARD_PHASE_1a_2.md §9

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { useLessonRuntimeStore } from '../useLessonRuntimeStore'

// ─── Mock learningContentApi ─────────────────────────────────────────────────

const mockApi = {
  getLessonAllowedItems: vi.fn(),
  getLessonParticipants: vi.fn(),
  startLesson: vi.fn(),
  completeLesson: vi.fn(),
  addAllowedContent: vi.fn(),
}

vi.mock('../../api/learningContentApi', () => ({
  learningContentApi: {
    getLessonAllowedItems: (...args: unknown[]) => mockApi.getLessonAllowedItems(...args),
    getLessonParticipants: (...args: unknown[]) => mockApi.getLessonParticipants(...args),
    startLesson: (...args: unknown[]) => mockApi.startLesson(...args),
    completeLesson: (...args: unknown[]) => mockApi.completeLesson(...args),
    addAllowedContent: (...args: unknown[]) => mockApi.addAllowedContent(...args),
  },
}))

// ─── Test data ───────────────────────────────────────────────────────────────

const LESSON_ID = 42

const ALLOWED_CONTENT = [
  { id: 1, type: 'problem', title: 'Problem 1', difficulty: 2, version: 1 },
  { id: 2, type: 'theory', title: 'Theory 1', difficulty: 1, version: 1 },
]

const PARTICIPANTS = [
  { user_id: 10, role: 'student' },
  { user_id: 20, role: 'student' },
]

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('useLessonRuntimeStore', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  // ── Test 1: init loads allowed content and participants ────────────

  it('test_init_loads_allowed_content_and_participants', async () => {
    mockApi.getLessonAllowedItems.mockResolvedValue(ALLOWED_CONTENT)
    mockApi.getLessonParticipants.mockResolvedValue(PARTICIPANTS)

    const store = useLessonRuntimeStore()
    await store.init(LESSON_ID)

    expect(store.lessonId).toBe(LESSON_ID)
    expect(store.status).toBe('active')
    expect(store.allowedContent).toEqual(ALLOWED_CONTENT)
    expect(store.participants).toEqual(PARTICIPANTS)
    expect(store.isLoading).toBe(false)
    expect(store.error).toBeNull()
    expect(store.hasAllowedContent).toBe(true)
    expect(store.allowedContentIds.has(1)).toBe(true)
    expect(store.allowedContentIds.has(2)).toBe(true)
  })

  // ── Test 2: startLesson transitions to active ─────────────────────

  it('test_start_lesson_transitions_to_active', async () => {
    mockApi.getLessonAllowedItems.mockResolvedValue(ALLOWED_CONTENT)
    mockApi.getLessonParticipants.mockResolvedValue(PARTICIPANTS)
    mockApi.startLesson.mockResolvedValue({ status: 'IN_PROGRESS' })

    const store = useLessonRuntimeStore()
    await store.init(LESSON_ID)

    const result = await store.startLesson()

    expect(result).toBe(true)
    expect(store.lessonStatus).toBe('IN_PROGRESS')
    expect(store.isActive).toBe(true)
    expect(store.status).toBe('active')
    expect(mockApi.startLesson).toHaveBeenCalledWith(LESSON_ID)
    // Should re-fetch allowed content after start
    expect(mockApi.getLessonAllowedItems).toHaveBeenCalledTimes(2)
  })

  // ── Test 3: completeLesson transitions to completed ───────────────

  it('test_complete_lesson_transitions_to_completed', async () => {
    mockApi.getLessonAllowedItems.mockResolvedValue(ALLOWED_CONTENT)
    mockApi.getLessonParticipants.mockResolvedValue(PARTICIPANTS)
    mockApi.completeLesson.mockResolvedValue({ status: 'COMPLETED' })

    const store = useLessonRuntimeStore()
    await store.init(LESSON_ID)

    const result = await store.completeLesson()

    expect(result).toBe(true)
    expect(store.lessonStatus).toBe('COMPLETED')
    expect(store.isCompleted).toBe(true)
    expect(store.status).toBe('completed')
    expect(mockApi.completeLesson).toHaveBeenCalledWith(LESSON_ID)
  })

  // ── Test 4: addContent refreshes list ─────────────────────────────

  it('test_add_content_refreshes_list', async () => {
    mockApi.getLessonAllowedItems.mockResolvedValue(ALLOWED_CONTENT)
    mockApi.getLessonParticipants.mockResolvedValue(PARTICIPANTS)
    mockApi.addAllowedContent.mockResolvedValue({ id: 3, content_item_id: 99, created: true })

    const store = useLessonRuntimeStore()
    await store.init(LESSON_ID)
    store.lessonStatus = 'IN_PROGRESS'

    const updatedContent = [...ALLOWED_CONTENT, { id: 99, type: 'video', title: 'Video 1', difficulty: 3, version: 1 }]
    mockApi.getLessonAllowedItems.mockResolvedValue(updatedContent)

    const result = await store.addContent(99)

    expect(result).toBe(true)
    expect(mockApi.addAllowedContent).toHaveBeenCalledWith(LESSON_ID, 99)
    // Should re-fetch after successful add
    expect(store.allowedContent).toEqual(updatedContent)
  })

  // ── Test 5: $reset clears state ───────────────────────────────────

  it('test_reset_clears_state', async () => {
    mockApi.getLessonAllowedItems.mockResolvedValue(ALLOWED_CONTENT)
    mockApi.getLessonParticipants.mockResolvedValue(PARTICIPANTS)

    const store = useLessonRuntimeStore()
    await store.init(LESSON_ID)

    // Verify state is populated
    expect(store.lessonId).toBe(LESSON_ID)
    expect(store.allowedContent.length).toBe(2)

    // Reset
    store.$reset()

    expect(store.lessonId).toBeNull()
    expect(store.status).toBe('idle')
    expect(store.lessonStatus).toBeNull()
    expect(store.allowedContent).toEqual([])
    expect(store.participants).toEqual([])
    expect(store.error).toBeNull()
    expect(store.isLoading).toBe(false)
    expect(store.hasAllowedContent).toBe(false)
  })
})
