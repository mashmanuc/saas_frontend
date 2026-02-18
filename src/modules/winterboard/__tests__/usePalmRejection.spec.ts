// WB: Unit tests for usePalmRejection composable (Phase 4: A4.2)
// Tests: pen active → touch ignored, pen timeout, large contact, config persistence

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

// ── Mock localStorage ───────────────────────────────────────────────────

const localStorageMock: Record<string, string> = {}
vi.stubGlobal('localStorage', {
  getItem: vi.fn((key: string) => localStorageMock[key] ?? null),
  setItem: vi.fn((key: string, value: string) => { localStorageMock[key] = value }),
  removeItem: vi.fn((key: string) => { delete localStorageMock[key] }),
})

import { usePalmRejection, PEN_TIMEOUT_MS, LARGE_CONTACT_RADIUS } from '../composables/usePalmRejection'

// ── Helpers ─────────────────────────────────────────────────────────────

function createPointerEvent(
  type: string,
  pointerType: string,
  overrides: Partial<PointerEvent> = {},
): PointerEvent {
  return {
    type,
    pointerType,
    pressure: 0.5,
    width: 1,
    height: 1,
    offsetX: 500,
    offsetY: 500,
    ...overrides,
  } as unknown as PointerEvent
}

// ── Tests ───────────────────────────────────────────────────────────────

describe('usePalmRejection', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.useFakeTimers()
    for (const key of Object.keys(localStorageMock)) {
      delete localStorageMock[key]
    }
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  // ── Pen active → touch ignored ────────────────────────────────────

  describe('pen active → touch rejected', () => {
    it('rejects touch when pen is active', () => {
      const palm = usePalmRejection()

      // Pen down
      palm.onPenDown()

      // Touch should be rejected
      const touchEvent = createPointerEvent('pointerdown', 'touch')
      const result = palm.shouldReject(touchEvent)

      expect(result.rejected).toBe(true)
      expect(result.reason).toBe('pen_active')
    })

    it('allows pen events always', () => {
      const palm = usePalmRejection()
      palm.onPenDown()

      const penEvent = createPointerEvent('pointermove', 'pen')
      const result = palm.shouldReject(penEvent)

      expect(result.rejected).toBe(false)
    })

    it('allows mouse events always', () => {
      const palm = usePalmRejection()
      palm.onPenDown()

      const mouseEvent = createPointerEvent('pointermove', 'mouse')
      const result = palm.shouldReject(mouseEvent)

      expect(result.rejected).toBe(false)
    })
  })

  // ── Pen timeout → touch re-enabled ────────────────────────────────

  describe('pen timeout → touch re-enabled', () => {
    it('rejects touch within timeout after pen up', () => {
      const palm = usePalmRejection()

      palm.onPenDown()
      palm.onPenUp()

      // Immediately after pen up — still within timeout
      const touchEvent = createPointerEvent('pointerdown', 'touch')
      const result = palm.shouldReject(touchEvent)

      expect(result.rejected).toBe(true)
      expect(result.reason).toBe('pen_active')
    })

    it('allows touch after timeout expires', () => {
      const palm = usePalmRejection()

      palm.onPenDown()
      palm.onPenUp()

      // Advance past timeout
      vi.advanceTimersByTime(PEN_TIMEOUT_MS + 50)

      const touchEvent = createPointerEvent('pointerdown', 'touch')
      const result = palm.shouldReject(touchEvent)

      expect(result.rejected).toBe(false)
    })
  })

  // ── Large contact area → rejected ─────────────────────────────────

  describe('large contact area → rejected', () => {
    it('rejects touch with large contact area (palm)', () => {
      const palm = usePalmRejection()
      // Need pen detected first for auto mode
      palm.onPenDown()
      palm.onPenUp()
      vi.advanceTimersByTime(PEN_TIMEOUT_MS + 50)

      const palmTouch = createPointerEvent('pointerdown', 'touch', {
        width: LARGE_CONTACT_RADIUS + 5,
        height: LARGE_CONTACT_RADIUS + 5,
      })

      const result = palm.shouldReject(palmTouch)

      expect(result.rejected).toBe(true)
      expect(result.reason).toBe('large_contact')
    })

    it('allows touch with normal contact area', () => {
      const palm = usePalmRejection()
      palm.onPenDown()
      palm.onPenUp()
      vi.advanceTimersByTime(PEN_TIMEOUT_MS + 50)

      const normalTouch = createPointerEvent('pointerdown', 'touch', {
        width: 5,
        height: 5,
      })

      const result = palm.shouldReject(normalTouch)

      expect(result.rejected).toBe(false)
    })
  })

  // ── Config persistence ────────────────────────────────────────────

  describe('config persistence', () => {
    it('defaults to auto mode', () => {
      const palm = usePalmRejection()
      expect(palm.mode.value).toBe('auto')
    })

    it('saves mode to localStorage', () => {
      const palm = usePalmRejection()
      palm.setMode('always')

      expect(localStorageMock['wb:palmRejection:mode']).toBe('always')
      expect(palm.mode.value).toBe('always')
    })

    it('loads mode from localStorage', () => {
      localStorageMock['wb:palmRejection:mode'] = 'never'

      const palm = usePalmRejection()
      expect(palm.mode.value).toBe('never')
    })

    it('mode=never allows all touch events', () => {
      const palm = usePalmRejection()
      palm.setMode('never')
      palm.onPenDown() // pen active

      const touchEvent = createPointerEvent('pointerdown', 'touch')
      const result = palm.shouldReject(touchEvent)

      expect(result.rejected).toBe(false)
    })

    it('mode=always rejects all touch events', () => {
      const palm = usePalmRejection()
      palm.setMode('always')

      const touchEvent = createPointerEvent('pointerdown', 'touch')
      const result = palm.shouldReject(touchEvent)

      expect(result.rejected).toBe(true)
      expect(result.reason).toBe('mode_always')
    })
  })

  // ── filterEvent convenience ───────────────────────────────────────

  describe('filterEvent', () => {
    it('auto-tracks pen state on pointerdown', () => {
      const palm = usePalmRejection()

      const penDown = createPointerEvent('pointerdown', 'pen')
      palm.filterEvent(penDown)

      expect(palm.isPenActive.value).toBe(true)
      expect(palm.penDetected.value).toBe(true)
    })

    it('auto-tracks pen state on pointerup', () => {
      const palm = usePalmRejection()

      palm.filterEvent(createPointerEvent('pointerdown', 'pen'))
      palm.filterEvent(createPointerEvent('pointerup', 'pen'))

      expect(palm.isPenActive.value).toBe(false)
    })

    it('returns false for rejected touch', () => {
      const palm = usePalmRejection()

      palm.filterEvent(createPointerEvent('pointerdown', 'pen'))

      const allowed = palm.filterEvent(createPointerEvent('pointerdown', 'touch'))
      expect(allowed).toBe(false)
    })

    it('returns true for allowed events', () => {
      const palm = usePalmRejection()

      const allowed = palm.filterEvent(createPointerEvent('pointermove', 'mouse'))
      expect(allowed).toBe(true)
    })
  })

  // ── Reset ─────────────────────────────────────────────────────────

  describe('reset', () => {
    it('clears pen state', () => {
      const palm = usePalmRejection()
      palm.onPenDown()

      palm.reset()

      expect(palm.isPenActive.value).toBe(false)
      expect(palm.activeTouchCount.value).toBe(0)
    })
  })
})
