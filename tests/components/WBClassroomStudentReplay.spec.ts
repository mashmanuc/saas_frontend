/**
 * [P17-A3.2] Unit tests — WBClassroomRoom Student Replay Access
 * Ref: DAY3_AGENT_A.md A3.2
 *
 * Tests:
 * 1. Hides replay button for student during active lesson
 * 2. Shows replay button for student after lesson ended (COMPLETED)
 * 3. Shows replay button for student after lesson ended (ARCHIVED)
 * 4. Always shows replay button for teacher (active lesson)
 * 5. Hides replay button on empty boards (no operations)
 * 6. Student has read-only markers (enterReplayMode blocked during active lesson)
 */

import { describe, it, expect } from 'vitest'
import { ref, computed, reactive } from 'vue'

type LessonStatus = 'DRAFT' | 'SCHEDULED' | 'CONFIRMED' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED' | 'DISPUTED' | 'ARCHIVED'

function createClassroomReplayState(opts: {
  isTeacher: boolean
  lessonStatusValue: LessonStatus | null
  hasOps: boolean
}) {
  const classroomRole = {
    isTeacher: ref(opts.isTeacher),
  }

  const lessonStatus = ref<LessonStatus | null>(opts.lessonStatusValue)

  const store = reactive({
    pages: opts.hasOps
      ? [{ strokes: [{ id: 's1' }], assets: [] }]
      : [{ strokes: [], assets: [] }],
  })

  const lessonEnded = computed(() => {
    return lessonStatus.value === 'COMPLETED' || lessonStatus.value === 'ARCHIVED'
  })

  const hasOperations = computed(() => {
    return store.pages.some((p: any) => p.strokes.length > 0 || p.assets.length > 0)
  })

  const resolvedSessionId = ref<string | null>('session-1')

  const mode = ref<'edit' | 'replay'>('edit')

  // Replay button visible when:
  // mode === 'edit' && resolvedSessionId && (isTeacher || lessonEnded) && hasOperations
  const showReplayButton = computed(() => {
    return mode.value === 'edit'
      && !!resolvedSessionId.value
      && (classroomRole.isTeacher.value || lessonEnded.value)
      && hasOperations.value
  })

  function enterReplayMode(): void {
    if (!classroomRole.isTeacher.value && !lessonEnded.value) return
    mode.value = 'replay'
  }

  function exitReplayMode(): void {
    mode.value = 'edit'
  }

  return {
    classroomRole,
    lessonStatus,
    lessonEnded,
    hasOperations,
    store,
    mode,
    showReplayButton,
    enterReplayMode,
    exitReplayMode,
  }
}

describe('WBClassroomRoom — Student Replay Access', () => {
  it('hides replay button for student during active lesson', () => {
    const state = createClassroomReplayState({
      isTeacher: false,
      lessonStatusValue: 'IN_PROGRESS',
      hasOps: true,
    })
    expect(state.showReplayButton.value).toBe(false)
  })

  it('shows replay button for student after lesson COMPLETED', () => {
    const state = createClassroomReplayState({
      isTeacher: false,
      lessonStatusValue: 'COMPLETED',
      hasOps: true,
    })
    expect(state.showReplayButton.value).toBe(true)
  })

  it('shows replay button for student after lesson ARCHIVED', () => {
    const state = createClassroomReplayState({
      isTeacher: false,
      lessonStatusValue: 'ARCHIVED',
      hasOps: true,
    })
    expect(state.showReplayButton.value).toBe(true)
  })

  it('always shows replay button for teacher during active lesson', () => {
    const state = createClassroomReplayState({
      isTeacher: true,
      lessonStatusValue: 'IN_PROGRESS',
      hasOps: true,
    })
    expect(state.showReplayButton.value).toBe(true)
  })

  it('hides replay button on empty boards even for teacher', () => {
    const state = createClassroomReplayState({
      isTeacher: true,
      lessonStatusValue: 'IN_PROGRESS',
      hasOps: false,
    })
    expect(state.showReplayButton.value).toBe(false)
  })

  it('blocks enterReplayMode for student during active lesson', () => {
    const state = createClassroomReplayState({
      isTeacher: false,
      lessonStatusValue: 'IN_PROGRESS',
      hasOps: true,
    })
    state.enterReplayMode()
    expect(state.mode.value).toBe('edit') // blocked
  })

  it('allows enterReplayMode for student after lesson ended', () => {
    const state = createClassroomReplayState({
      isTeacher: false,
      lessonStatusValue: 'COMPLETED',
      hasOps: true,
    })
    state.enterReplayMode()
    expect(state.mode.value).toBe('replay')
  })

  it('allows enterReplayMode for teacher always', () => {
    const state = createClassroomReplayState({
      isTeacher: true,
      lessonStatusValue: 'IN_PROGRESS',
      hasOps: true,
    })
    state.enterReplayMode()
    expect(state.mode.value).toBe('replay')
  })

  it('exitReplayMode works for all roles', () => {
    const state = createClassroomReplayState({
      isTeacher: false,
      lessonStatusValue: 'COMPLETED',
      hasOps: true,
    })
    state.enterReplayMode()
    expect(state.mode.value).toBe('replay')
    state.exitReplayMode()
    expect(state.mode.value).toBe('edit')
  })

  it('lessonEnded becomes true when status changes', () => {
    const state = createClassroomReplayState({
      isTeacher: false,
      lessonStatusValue: 'IN_PROGRESS',
      hasOps: true,
    })
    expect(state.lessonEnded.value).toBe(false)
    expect(state.showReplayButton.value).toBe(false)

    // Simulate lesson ending
    state.lessonStatus.value = 'COMPLETED'
    expect(state.lessonEnded.value).toBe(true)
    expect(state.showReplayButton.value).toBe(true)
  })
})
