// Phase 10 Day 5: Unit tests for useReplay composable (markers integration)
// Ref: DAY4_AGENT_A.md — A.T3

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { useReplay } from '@/modules/winterboard/composables/useReplay'

// ─── Mocks ──────────────────────────────────────────────────────────────

const { mockTimeline, mockMarkers } = vi.hoisted(() => {
  const mockTimeline = {
    session_id: 'sess-1',
    total_operations: 3,
    operations: [
      { id: 1, op_type: 'stroke_add', page_id: 'p1', payload: { stroke: { id: 's1' } }, created_at: '2026-01-01T00:00:00Z' },
      { id: 2, op_type: 'stroke_add', page_id: 'p1', payload: { stroke: { id: 's2' } }, created_at: '2026-01-01T00:01:00Z' },
      { id: 3, op_type: 'asset_add', page_id: 'p1', payload: { asset: { id: 'a1' } }, created_at: '2026-01-01T00:02:00Z' },
    ],
  }

  const mockMarkers = {
    markers: [
      { id: 'm1', title: 'Intro', operation_index: 0, page_id: 'p1', board_position: { x: 0, y: 0 }, thumbnail_url: '', category: 'theory' as const, order: 0, created_at: '2026-01-01T00:00:00Z' },
      { id: 'm2', title: 'Formula', operation_index: 2, page_id: 'p1', board_position: { x: 100, y: 100 }, thumbnail_url: '', category: 'formula' as const, order: 1, created_at: '2026-01-01T00:01:00Z' },
    ],
  }

  return { mockTimeline, mockMarkers }
})

vi.mock('@/modules/winterboard/api/replay', () => ({
  fetchReplayTimeline: vi.fn().mockResolvedValue(mockTimeline),
  fetchNearestSnapshot: vi.fn().mockResolvedValue(null),
  fetchLessonMarkers: vi.fn().mockResolvedValue(mockMarkers),
}))

vi.mock('@/modules/winterboard/engine/WBReplayEngine', () => {
  return {
    WBReplayEngine: vi.fn().mockImplementation(() => ({
      on: vi.fn().mockReturnThis(),
      play: vi.fn(),
      pause: vi.fn(),
      stop: vi.fn(),
      setSpeed: vi.fn(),
      seekTo: vi.fn(),
      destroy: vi.fn(),
    })),
  }
})

describe('useReplay', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('loadTimeline sets totalOperations', async () => {
    const replay = useReplay('sess-1')
    const onOp = vi.fn()

    await replay.loadTimeline(onOp)

    expect(replay.totalOperations.value).toBe(3)
    expect(replay.error.value).toBeNull()
    expect(replay.isLoading.value).toBe(false)
  })

  it('loadMarkers populates markers ref', async () => {
    const replay = useReplay('sess-1')

    await replay.loadMarkers()

    expect(replay.markers.value).toHaveLength(2)
    expect(replay.markers.value[0].id).toBe('m1')
    expect(replay.markers.value[1].title).toBe('Formula')
  })

  it('markers are readonly', async () => {
    const replay = useReplay('sess-1')
    await replay.loadMarkers()

    // Attempting direct mutation should be blocked by readonly
    // @ts-expect-error testing readonly enforcement
    replay.markers.value = []
    // readonly ref silently ignores assignment; original data should remain
    expect(replay.markers.value).toHaveLength(2)
  })

  it('destroy clears markers', async () => {
    const replay = useReplay('sess-1')
    await replay.loadMarkers()
    expect(replay.markers.value).toHaveLength(2)

    replay.destroy()

    expect(replay.markers.value).toHaveLength(0)
    expect(replay.activeMarkerId.value).toBeNull()
  })

  it('progress computes correctly', async () => {
    const replay = useReplay('sess-1')
    const onOp = vi.fn()
    await replay.loadTimeline(onOp)

    // currentIndex starts at 0, total is 3
    expect(replay.progress.value).toBe(0)
  })

  it('loadMarkers handles API failure gracefully', async () => {
    const { fetchLessonMarkers } = await import('@/modules/winterboard/api/replay')
    vi.mocked(fetchLessonMarkers).mockRejectedValueOnce(new Error('Network'))

    const replay = useReplay('sess-1')
    await replay.loadMarkers()

    // Should NOT throw, markers remain empty
    expect(replay.markers.value).toHaveLength(0)
  })
})
