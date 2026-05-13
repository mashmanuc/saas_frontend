// ReplayV2: WBReplayEngineV2 — timer-based playback engine.
//
// INV-V2-1: НЕ extends WBReplayEngine, НЕ імпортує V1 internals.
// Fresh implementation з тим самим public API що V1.
//
// Відповідальність:
//   - Timer scheduling (setTimeout, burst mode)
//   - Playback state (playing/paused/ended/idle)
//   - Position tracking (currentIndex)
//   - Time-axis helpers (findIndexByTimeMs, getOperationTimeMs)
//
// НЕ відповідає за:
//   - Board state mutations (це composable через _onOp callback)
//   - Snapshot fetching (це SnapshotProvider через composable)

import type { BoardOperation, ReplayTimeline } from '../types/replay'

export type ReplayStateV2 = 'idle' | 'playing' | 'paused' | 'ended'
export type ReplaySpeedV2 = 0.5 | 1 | 2 | 4 | 10

export interface ReplayEngineV2Callbacks {
  onOperation: (op: BoardOperation, index: number) => void
  onProgress: (current: number, total: number) => void
  onStateChange: (state: ReplayStateV2) => void
  onComplete: () => void
}

export class WBReplayEngineV2 {
  private operations: BoardOperation[] = []
  private currentIndex: number = 0
  private speed: ReplaySpeedV2 = 1
  private state: ReplayStateV2 = 'idle'
  private playTimer: ReturnType<typeof setTimeout> | null = null
  private firstOpAtMs: number = 0

  private callbacks: Partial<ReplayEngineV2Callbacks> = {}

  constructor(timeline: ReplayTimeline) {
    this.operations = [...timeline.operations]
    if (this.operations.length > 0) {
      const t = new Date(this.operations[0].created_at).getTime()
      this.firstOpAtMs = isNaN(t) ? 0 : t
    }
  }

  // ─── Callbacks ─────────────────────────────────────────────────────────────

  on<K extends keyof ReplayEngineV2Callbacks>(
    event: K,
    cb: ReplayEngineV2Callbacks[K],
  ): this {
    this.callbacks[event] = cb
    return this
  }

  // ─── Accessors ─────────────────────────────────────────────────────────────

  getState(): ReplayStateV2 { return this.state }
  getCurrentIndex(): number { return this.currentIndex }
  getTotalOperations(): number { return this.operations.length }
  getOperationAt(index: number): BoardOperation | null { return this.operations[index] ?? null }
  getFirstOpAtMs(): number { return this.firstOpAtMs }

  /**
   * Бінарний пошук O(log n): перший індекс з offset ≥ targetMs.
   * (REPLAY_MANIFEST §1: ops як часова координата)
   */
  findIndexByTimeMs(targetMs: number): number {
    const n = this.operations.length
    if (n === 0 || targetMs <= 0) return 0
    let lo = 0, hi = n - 1
    while (lo < hi) {
      const mid = (lo + hi) >>> 1
      const t = new Date(this.operations[mid].created_at).getTime() - this.firstOpAtMs
      if (isNaN(t) || t < targetMs) lo = mid + 1
      else hi = mid
    }
    const tLo = new Date(this.operations[lo].created_at).getTime() - this.firstOpAtMs
    if (isNaN(tLo) || tLo < targetMs) return n - 1
    return lo
  }

  /** Offset (мс) між op[index] і першою op. 0 якщо invalid. */
  getOperationTimeMs(index: number): number {
    const op = this.operations[index]
    if (!op) return 0
    const t = new Date(op.created_at).getTime()
    if (isNaN(t)) return 0
    return Math.max(0, t - this.firstOpAtMs)
  }

  // ─── Playback control ──────────────────────────────────────────────────────

  play(): void {
    if (this.state === 'playing') return
    if (this.currentIndex >= this.operations.length) this.currentIndex = 0
    this.setState('playing')
    this._scheduleNext()
  }

  pause(): void {
    if (this.state !== 'playing') return
    this._clearTimer()
    this.setState('paused')
  }

  stop(): void {
    this._clearTimer()
    this.currentIndex = 0
    this.setState('idle')
    this.callbacks.onProgress?.(0, this.operations.length)
  }

  setSpeed(speed: ReplaySpeedV2): void {
    this.speed = speed || 1
    if (this.state === 'playing') {
      this._clearTimer()
      this._scheduleNext()
    }
  }

  /** Sync position to index. Returns clamped actual index. */
  seekTo(index: number): number {
    const wasPlaying = this.state === 'playing'
    if (wasPlaying) this._clearTimer()
    const clamped = Math.max(0, Math.min(index, this.operations.length - 1))
    this.currentIndex = clamped
    this.callbacks.onProgress?.(clamped, this.operations.length)
    if (wasPlaying) this._scheduleNext()
    return clamped
  }

  stepForward(): BoardOperation | null {
    if (this.state === 'playing') { this._clearTimer(); this.setState('paused') }
    if (this.currentIndex >= this.operations.length) return null
    const op = this.operations[this.currentIndex]
    this.callbacks.onOperation?.(op, this.currentIndex)
    this.currentIndex++
    this.callbacks.onProgress?.(this.currentIndex, this.operations.length)
    if (this.currentIndex >= this.operations.length) this.setState('ended')
    else if (this.state === 'idle') this.setState('paused')
    return op
  }

  stepBackward(): number {
    if (this.state === 'playing') { this._clearTimer(); this.setState('paused') }
    const newIdx = Math.max(0, this.currentIndex - 1)
    this.currentIndex = newIdx
    this.callbacks.onProgress?.(newIdx, this.operations.length)
    if (this.state === 'ended') this.setState('paused')
    return newIdx
  }

  destroy(): void {
    this._clearTimer()
    this.setState('idle')
    this.callbacks = {}
  }

  // ─── Private ───────────────────────────────────────────────────────────────

  /** Ops з різницею < BURST_THRESHOLD_MS застосовуються атомарно (paste, batch). */
  private static readonly BURST_THRESHOLD_MS = 16

  private setState(s: ReplayStateV2): void {
    this.state = s
    this.callbacks.onStateChange?.(s)
  }

  private _scheduleNext(): void {
    if (this.currentIndex >= this.operations.length) {
      this.setState('ended')
      this.callbacks.onComplete?.()
      return
    }

    const op = this.operations[this.currentIndex]
    const nextOp = this.operations[this.currentIndex + 1]

    let delayMs = 16
    if (nextOp) {
      const t1 = new Date(op.created_at).getTime()
      const t2 = new Date(nextOp.created_at).getTime()
      const diff = (isNaN(t1) || isNaN(t2)) ? 16 : Math.min(Math.max(0, t2 - t1), 2000)
      delayMs = Math.max(4, diff / this.speed)
    }

    this.playTimer = setTimeout(() => {
      if (this.state !== 'playing') return

      this.callbacks.onOperation?.(op, this.currentIndex)
      this.callbacks.onProgress?.(this.currentIndex + 1, this.operations.length)
      this.currentIndex++

      // Burst mode: drain near-zero-diff ops in same tick (atomic paste/batch)
      while (this.currentIndex < this.operations.length) {
        const prev = this.operations[this.currentIndex - 1]
        const cur = this.operations[this.currentIndex]
        const tp = new Date(prev.created_at).getTime()
        const tc = new Date(cur.created_at).getTime()
        if (isNaN(tp) || isNaN(tc) || tc - tp >= WBReplayEngineV2.BURST_THRESHOLD_MS) break
        this.callbacks.onOperation?.(cur, this.currentIndex)
        this.callbacks.onProgress?.(this.currentIndex + 1, this.operations.length)
        this.currentIndex++
      }

      this._scheduleNext()
    }, delayMs)
  }

  private _clearTimer(): void {
    if (this.playTimer !== null) {
      clearTimeout(this.playTimer)
      this.playTimer = null
    }
  }
}
