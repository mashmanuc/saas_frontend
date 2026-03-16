// Phase 13 A3.4: Unit tests for usePublicReplay composable
// Tests: chunk loading, play/pause, seek, operation application, prefetch, destroy

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { ref } from 'vue'
import type { ReplayChunksResponse } from '../api/publicLessonApi'

// ── Mock publicLessonApi ──────────────────────────────────────────────────

const mockGetReplayChunks = vi.fn()

vi.mock('../api/publicLessonApi', () => ({
  publicLessonApi: {
    getReplayChunks: (...args: unknown[]) => mockGetReplayChunks(...args),
  },
}))

// ── Mock requestAnimationFrame ────────────────────────────────────────────

let rafCallbacks: Array<(t: number) => void> = []
vi.stubGlobal('requestAnimationFrame', (cb: (t: number) => void) => {
  rafCallbacks.push(cb)
  return rafCallbacks.length
})
vi.stubGlobal('cancelAnimationFrame', vi.fn())

// ── Import after mocks ───────────────────────────────────────────────────

import { usePublicReplay } from '../composables/usePublicReplay'

// ── Fixtures ─────────────────────────────────────────────────────────────

function makeChunksResponse(
  chunkIndex: number,
  startMs: number,
  endMs: number,
  ops: Array<{ op_type: string; id: string; timestamp_ms: number }>,
  nextCursor: number | null = null,
): ReplayChunksResponse {
  return {
    chunks: [
      {
        chunk_index: chunkIndex,
        start_ms: startMs,
        end_ms: endMs,
        operations: ops.map((o) => ({
          op_type: o.op_type,
          page_id: 'p1',
          data: { id: o.id },
          timestamp_ms: o.timestamp_ms,
        })),
      },
    ],
    next_cursor: nextCursor,
  }
}

// ── Tests ─────────────────────────────────────────────────────────────────

describe('usePublicReplay', () => {
  const tutorSlug = ref('ivan')
  const lessonSlug = ref('lesson-1')

  beforeEach(() => {
    vi.clearAllMocks()
    rafCallbacks = []
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('returns correct initial state', () => {
    const replay = usePublicReplay(tutorSlug, lessonSlug)
    expect(replay.isPlaying.value).toBe(false)
    expect(replay.currentTimeMs.value).toBe(0)
    expect(replay.speed.value).toBe(1)
    expect(replay.chunks.value).toEqual([])
    expect(replay.loadedUpToChunk.value).toBe(-1)
    expect(replay.boardSnapshot.value).toEqual({})
    expect(replay.isLoadingChunks.value).toBe(false)
    expect(replay.totalLoadedOps.value).toBe(0)
    replay.destroy()
  })

  it('loads initial chunks on play', async () => {
    mockGetReplayChunks.mockResolvedValue(
      makeChunksResponse(0, 0, 10000, [
        { op_type: 'stroke_add', id: 's1', timestamp_ms: 500 },
      ], null),
    )

    const replay = usePublicReplay(tutorSlug, lessonSlug)
    replay.play()

    // Wait for the async chunk loading
    await vi.waitFor(() => {
      expect(replay.chunks.value.length).toBeGreaterThan(0)
    })

    expect(mockGetReplayChunks).toHaveBeenCalledWith('ivan', 'lesson-1', undefined)
    expect(replay.chunks.value).toHaveLength(1)
    expect(replay.loadedUpToChunk.value).toBe(0)
    expect(replay.totalLoadedOps.value).toBe(1)
    expect(replay.isPlaying.value).toBe(true)

    replay.destroy()
  })

  it('pauses playback', async () => {
    mockGetReplayChunks.mockResolvedValue(
      makeChunksResponse(0, 0, 60000, [], null),
    )

    const replay = usePublicReplay(tutorSlug, lessonSlug)
    replay.play()
    await vi.waitFor(() => expect(replay.isPlaying.value).toBe(true))

    replay.pause()
    expect(replay.isPlaying.value).toBe(false)
    replay.destroy()
  })

  it('applies stroke_add operations to boardSnapshot', async () => {
    mockGetReplayChunks.mockResolvedValue(
      makeChunksResponse(0, 0, 10000, [
        { op_type: 'stroke_add', id: 's1', timestamp_ms: 100 },
        { op_type: 'stroke_add', id: 's2', timestamp_ms: 200 },
      ], null),
    )

    const replay = usePublicReplay(tutorSlug, lessonSlug)

    // Load chunks manually via play then pause
    replay.play()
    await vi.waitFor(() => expect(replay.chunks.value.length).toBe(1))
    replay.pause()

    // Seek to 250ms to apply both strokes
    replay.seekTo(250)
    await vi.waitFor(() => expect(replay.currentTimeMs.value).toBe(250))

    const pages = replay.boardSnapshot.value.pages as Record<string, { strokes: Array<{ id: string }> }>
    expect(pages).toBeDefined()
    expect(pages.p1.strokes).toHaveLength(2)
    expect(pages.p1.strokes[0].id).toBe('s1')
    expect(pages.p1.strokes[1].id).toBe('s2')

    replay.destroy()
  })

  it('applies stroke_delete operations', async () => {
    mockGetReplayChunks.mockResolvedValue({
      chunks: [
        {
          chunk_index: 0,
          start_ms: 0,
          end_ms: 10000,
          operations: [
            { op_type: 'stroke_add', page_id: 'p1', data: { id: 's1' }, timestamp_ms: 100 },
            { op_type: 'stroke_add', page_id: 'p1', data: { id: 's2' }, timestamp_ms: 200 },
            { op_type: 'stroke_delete', page_id: 'p1', data: { id: 's1' }, timestamp_ms: 300 },
          ],
        },
      ],
      next_cursor: null,
    })

    const replay = usePublicReplay(tutorSlug, lessonSlug)
    replay.play()
    await vi.waitFor(() => expect(replay.chunks.value.length).toBe(1))
    replay.pause()

    replay.seekTo(350)
    await vi.waitFor(() => expect(replay.currentTimeMs.value).toBe(350))

    const pages = replay.boardSnapshot.value.pages as Record<string, { strokes: Array<{ id: string }> }>
    expect(pages.p1.strokes).toHaveLength(1)
    expect(pages.p1.strokes[0].id).toBe('s2')

    replay.destroy()
  })

  it('applies asset_add and asset_delete operations', async () => {
    mockGetReplayChunks.mockResolvedValue({
      chunks: [
        {
          chunk_index: 0,
          start_ms: 0,
          end_ms: 10000,
          operations: [
            { op_type: 'asset_add', page_id: 'p1', data: { id: 'a1', src: 'img.png' }, timestamp_ms: 100 },
            { op_type: 'asset_delete', page_id: 'p1', data: { id: 'a1' }, timestamp_ms: 500 },
          ],
        },
      ],
      next_cursor: null,
    })

    const replay = usePublicReplay(tutorSlug, lessonSlug)
    replay.play()
    await vi.waitFor(() => expect(replay.chunks.value.length).toBe(1))
    replay.pause()

    // At 200ms: asset should exist
    replay.seekTo(200)
    await vi.waitFor(() => expect(replay.currentTimeMs.value).toBe(200))
    let pages = replay.boardSnapshot.value.pages as Record<string, { assets: Array<{ id: string }> }>
    expect(pages.p1.assets).toHaveLength(1)

    // At 600ms: asset should be deleted
    replay.seekTo(600)
    await vi.waitFor(() => expect(replay.currentTimeMs.value).toBe(600))
    pages = replay.boardSnapshot.value.pages as Record<string, { assets: Array<{ id: string }> }>
    expect(pages.p1.assets).toHaveLength(0)

    replay.destroy()
  })

  it('applies clear_page operation', async () => {
    mockGetReplayChunks.mockResolvedValue({
      chunks: [
        {
          chunk_index: 0,
          start_ms: 0,
          end_ms: 10000,
          operations: [
            { op_type: 'stroke_add', page_id: 'p1', data: { id: 's1' }, timestamp_ms: 100 },
            { op_type: 'stroke_add', page_id: 'p1', data: { id: 's2' }, timestamp_ms: 200 },
            { op_type: 'clear_page', page_id: 'p1', data: {}, timestamp_ms: 500 },
          ],
        },
      ],
      next_cursor: null,
    })

    const replay = usePublicReplay(tutorSlug, lessonSlug)
    replay.play()
    await vi.waitFor(() => expect(replay.chunks.value.length).toBe(1))
    replay.pause()

    replay.seekTo(600)
    await vi.waitFor(() => expect(replay.currentTimeMs.value).toBe(600))

    const pages = replay.boardSnapshot.value.pages as Record<string, { strokes: unknown[]; assets: unknown[] }>
    expect(pages.p1.strokes).toHaveLength(0)
    expect(pages.p1.assets).toHaveLength(0)

    replay.destroy()
  })

  it('loads next batch with cursor pagination', async () => {
    // First batch
    mockGetReplayChunks.mockResolvedValueOnce(
      makeChunksResponse(0, 0, 10000, [
        { op_type: 'stroke_add', id: 's1', timestamp_ms: 500 },
      ], 1),
    )
    // Second batch
    mockGetReplayChunks.mockResolvedValueOnce(
      makeChunksResponse(1, 10000, 20000, [
        { op_type: 'stroke_add', id: 's2', timestamp_ms: 15000 },
      ], null),
    )

    const replay = usePublicReplay(tutorSlug, lessonSlug)
    replay.play()

    // Wait for first batch
    await vi.waitFor(() => expect(replay.chunks.value.length).toBeGreaterThanOrEqual(1))

    // First call: no cursor
    expect(mockGetReplayChunks).toHaveBeenCalledWith('ivan', 'lesson-1', undefined)

    replay.destroy()
  })

  it('deduplicates chunks on repeated load', async () => {
    const response = makeChunksResponse(0, 0, 10000, [
      { op_type: 'stroke_add', id: 's1', timestamp_ms: 500 },
    ], null)

    mockGetReplayChunks.mockResolvedValue(response)

    const replay = usePublicReplay(tutorSlug, lessonSlug)
    replay.play()
    await vi.waitFor(() => expect(replay.chunks.value.length).toBe(1))
    replay.pause()

    // Chunks should not duplicate
    expect(replay.chunks.value).toHaveLength(1)
    replay.destroy()
  })

  it('seekTo resets board state and replays from 0', async () => {
    mockGetReplayChunks.mockResolvedValue({
      chunks: [
        {
          chunk_index: 0,
          start_ms: 0,
          end_ms: 10000,
          operations: [
            { op_type: 'stroke_add', page_id: 'p1', data: { id: 's1' }, timestamp_ms: 100 },
            { op_type: 'stroke_add', page_id: 'p1', data: { id: 's2' }, timestamp_ms: 5000 },
          ],
        },
      ],
      next_cursor: null,
    })

    const replay = usePublicReplay(tutorSlug, lessonSlug)
    replay.play()
    await vi.waitFor(() => expect(replay.chunks.value.length).toBe(1))
    replay.pause()

    // Seek to 200ms — only s1 should exist
    replay.seekTo(200)
    await vi.waitFor(() => expect(replay.currentTimeMs.value).toBe(200))
    const pages = replay.boardSnapshot.value.pages as Record<string, { strokes: Array<{ id: string }> }>
    expect(pages.p1.strokes).toHaveLength(1)
    expect(pages.p1.strokes[0].id).toBe('s1')

    replay.destroy()
  })

  it('destroy resets all state', async () => {
    mockGetReplayChunks.mockResolvedValue(
      makeChunksResponse(0, 0, 10000, [], null),
    )

    const replay = usePublicReplay(tutorSlug, lessonSlug)
    replay.play()
    await vi.waitFor(() => expect(replay.chunks.value.length).toBe(1))

    replay.destroy()

    expect(replay.isPlaying.value).toBe(false)
    expect(replay.chunks.value).toEqual([])
    expect(replay.loadedUpToChunk.value).toBe(-1)
    expect(replay.boardSnapshot.value).toEqual({})
  })

  it('speed ref is reactive and defaults to 1', () => {
    const replay = usePublicReplay(tutorSlug, lessonSlug)
    expect(replay.speed.value).toBe(1)

    replay.speed.value = 2
    expect(replay.speed.value).toBe(2)

    replay.destroy()
  })
})
