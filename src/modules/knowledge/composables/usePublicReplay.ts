// Phase 13 A2.2: usePublicReplay — public replay composable
// Reads ReplayChunks (NOT raw WBBoardOperation) — INV-SCALE-1
// Lazy chunk loading with cursor pagination — INV-SCALE-5
// Prefetches next chunks ahead of playback position
// Ref: AGENT_A_FE_CORE.md A2.2

import { ref, computed, type Ref, type ComputedRef } from 'vue'
import { publicLessonApi, type ReplayChunk, type ReplayOperation } from '../api/publicLessonApi'

// ─── Constants ──────────────────────────────────────────────────────────────

const PREFETCH_AHEAD_MS = 30_000
const TICK_INTERVAL_MS = 16 // ~60fps via requestAnimationFrame

// ─── Types ──────────────────────────────────────────────────────────────────

export interface UsePublicReplayReturn {
  isPlaying: Ref<boolean>
  currentTimeMs: Ref<number>
  speed: Ref<number>
  chunks: Ref<ReplayChunk[]>
  loadedUpToChunk: Ref<number>
  boardSnapshot: Ref<Record<string, unknown>>
  isLoadingChunks: Ref<boolean>
  totalLoadedOps: ComputedRef<number>
  play: () => void
  pause: () => void
  seekTo: (timeMs: number) => void
  destroy: () => void
}

// ─── Composable ─────────────────────────────────────────────────────────────

export function usePublicReplay(
  tutorSlug: Ref<string> | ComputedRef<string>,
  lessonSlug: Ref<string> | ComputedRef<string>,
): UsePublicReplayReturn {
  const isPlaying = ref(false)
  const currentTimeMs = ref(0)
  const speed = ref(1)
  const chunks = ref<ReplayChunk[]>([])
  const loadedUpToChunk = ref(-1)
  const boardSnapshot = ref<Record<string, unknown>>({})
  const isLoadingChunks = ref(false)

  let nextCursor: number | null = 0
  let animFrameId: number | null = null
  let lastFrameTime: number | null = null
  let _destroyed = false
  let _loadingPromise: Promise<void> | null = null

  const totalLoadedOps = computed(() =>
    chunks.value.reduce((sum, c) => sum + c.operations.length, 0),
  )

  // ── Chunk loading ───────────────────────────────────────────────────────

  async function loadNextBatch(): Promise<void> {
    if (nextCursor === null || isLoadingChunks.value || _destroyed) return

    isLoadingChunks.value = true
    try {
      const res = await publicLessonApi.getReplayChunks(
        tutorSlug.value,
        lessonSlug.value,
        nextCursor || undefined,
      )
      if (_destroyed) return

      for (const chunk of res.chunks) {
        // Deduplicate: skip if chunk already loaded
        if (!chunks.value.some(c => c.chunk_index === chunk.chunk_index)) {
          chunks.value.push(chunk)
          if (chunk.chunk_index > loadedUpToChunk.value) {
            loadedUpToChunk.value = chunk.chunk_index
          }
        }
      }

      // Sort chunks by index for correct playback
      chunks.value.sort((a, b) => a.chunk_index - b.chunk_index)
      nextCursor = res.next_cursor
    } catch (err) {
      console.error('[usePublicReplay] Failed to load chunks:', err)
    } finally {
      isLoadingChunks.value = false
    }
  }

  /**
   * Ensure chunks are loaded up to the given time.
   * Prefetches ahead by PREFETCH_AHEAD_MS.
   */
  async function ensureChunksUpTo(timeMs: number): Promise<void> {
    const targetMs = timeMs + PREFETCH_AHEAD_MS
    const lastChunk = chunks.value[chunks.value.length - 1]

    if (lastChunk && lastChunk.end_ms >= targetMs) return
    if (nextCursor === null) return // All chunks loaded

    if (!_loadingPromise) {
      _loadingPromise = loadNextBatch().finally(() => {
        _loadingPromise = null
      })
    }
    await _loadingPromise

    // Recursive check: if still not enough, load more
    const lastAfterLoad = chunks.value[chunks.value.length - 1]
    if (lastAfterLoad && lastAfterLoad.end_ms < targetMs && nextCursor !== null) {
      await ensureChunksUpTo(timeMs)
    }
  }

  // ── Operation application ─────────────────────────────────────────────

  /**
   * Apply all operations from chunks that fall within [fromMs, toMs].
   * Updates boardSnapshot with operation data.
   */
  function applyOperationsInRange(fromMs: number, toMs: number): void {
    for (const chunk of chunks.value) {
      if (chunk.end_ms < fromMs) continue
      if (chunk.start_ms > toMs) break

      for (const op of chunk.operations) {
        if (op.timestamp_ms >= fromMs && op.timestamp_ms <= toMs) {
          applyOperation(op)
        }
      }
    }
  }

  /**
   * Apply a single replay operation to the board snapshot.
   * This builds up the board state incrementally.
   */
  function applyOperation(op: ReplayOperation): void {
    const state = { ...boardSnapshot.value }
    const pageId = op.page_id || 'default'

    if (!state.pages) {
      state.pages = {}
    }
    const pages = state.pages as Record<string, { strokes: Record<string, unknown>[]; assets: Record<string, unknown>[] }>
    if (!pages[pageId]) {
      pages[pageId] = { strokes: [], assets: [] }
    }

    switch (op.op_type) {
      case 'stroke_add': {
        const stroke = op.data as Record<string, unknown>
        pages[pageId].strokes.push(stroke)
        break
      }
      case 'stroke_update': {
        const data = op.data as Record<string, unknown>
        const idx = pages[pageId].strokes.findIndex(s => s.id === data.id)
        if (idx >= 0) pages[pageId].strokes[idx] = { ...pages[pageId].strokes[idx], ...data }
        break
      }
      case 'stroke_delete': {
        const id = (op.data as Record<string, unknown>).id
        pages[pageId].strokes = pages[pageId].strokes.filter(s => s.id !== id)
        break
      }
      case 'asset_add': {
        const asset = op.data as Record<string, unknown>
        pages[pageId].assets.push(asset)
        break
      }
      case 'asset_update': {
        const data = op.data as Record<string, unknown>
        const idx = pages[pageId].assets.findIndex(a => a.id === data.id)
        if (idx >= 0) pages[pageId].assets[idx] = { ...pages[pageId].assets[idx], ...data }
        break
      }
      case 'asset_delete': {
        const id = (op.data as Record<string, unknown>).id
        pages[pageId].assets = pages[pageId].assets.filter(a => a.id !== id)
        break
      }
      case 'clear_page': {
        pages[pageId].strokes = []
        pages[pageId].assets = []
        break
      }
      default:
        // Unknown op type — ignore for forward compatibility
        break
    }

    state.pages = pages
    boardSnapshot.value = state
  }

  // ── Playback loop ─────────────────────────────────────────────────────

  function tick(timestamp: number): void {
    if (!isPlaying.value || _destroyed) return

    if (lastFrameTime === null) {
      lastFrameTime = timestamp
      animFrameId = requestAnimationFrame(tick)
      return
    }

    const deltaMs = (timestamp - lastFrameTime) * speed.value
    lastFrameTime = timestamp

    const prevTime = currentTimeMs.value
    const newTime = prevTime + deltaMs
    currentTimeMs.value = newTime

    // Apply operations in this time slice
    applyOperationsInRange(prevTime, newTime)

    // Prefetch more chunks if needed
    ensureChunksUpTo(newTime)

    // Check if we've reached the end of all loaded chunks
    const lastChunk = chunks.value[chunks.value.length - 1]
    if (lastChunk && newTime >= lastChunk.end_ms && nextCursor === null) {
      isPlaying.value = false
      lastFrameTime = null
      return
    }

    animFrameId = requestAnimationFrame(tick)
  }

  // ── Public API ────────────────────────────────────────────────────────

  function play(): void {
    if (isPlaying.value) return
    isPlaying.value = true
    lastFrameTime = null

    // Ensure initial chunks are loaded
    ensureChunksUpTo(currentTimeMs.value)
    animFrameId = requestAnimationFrame(tick)
  }

  function pause(): void {
    isPlaying.value = false
    lastFrameTime = null
    if (animFrameId !== null) {
      cancelAnimationFrame(animFrameId)
      animFrameId = null
    }
  }

  function seekTo(timeMs: number): void {
    const wasPlaying = isPlaying.value
    if (wasPlaying) pause()

    // Reset board state and replay from beginning to target time
    boardSnapshot.value = {}
    currentTimeMs.value = 0

    // Apply all operations up to timeMs
    ensureChunksUpTo(timeMs).then(() => {
      applyOperationsInRange(0, timeMs)
      currentTimeMs.value = timeMs

      if (wasPlaying) play()
    })
  }

  function destroy(): void {
    _destroyed = true
    pause()
    chunks.value = []
    loadedUpToChunk.value = -1
    boardSnapshot.value = {}
    nextCursor = 0
  }

  return {
    isPlaying,
    currentTimeMs,
    speed,
    chunks,
    loadedUpToChunk,
    boardSnapshot,
    isLoadingChunks,
    totalLoadedOps,
    play,
    pause,
    seekTo,
    destroy,
  }
}
