// A12: WBReplayEngine — client-side replay engine for board operation timeline
// Ref: DAY17_AGENT-A.md
// Zone: AGENT-A (engine/)
//
// Architecture note:
//   - Engine is ISOLATED from real board state — replay is read-only simulation
//   - Caller provides onOperation callback to render each op on a shadow canvas
//   - Real board store is NEVER mutated by this engine
//   - Delay between ops is derived from actual timestamps (capped at 2s), divided by speed

import type { BoardOperation, ReplayTimeline } from '../types/replay'

export type ReplayState = 'idle' | 'playing' | 'paused' | 'ended'
export type ReplaySpeed = 0.5 | 1 | 2 | 4 | 10

export interface ReplayEngineCallbacks {
  onOperation: (op: BoardOperation, index: number) => void
  onProgress: (current: number, total: number) => void
  onStateChange: (state: ReplayState) => void
  onComplete: () => void
}

export class WBReplayEngine {
  private operations: BoardOperation[] = []
  private currentIndex: number = 0
  private speed: ReplaySpeed = 1
  private state: ReplayState = 'idle'
  private playTimer: ReturnType<typeof setTimeout> | null = null

  private callbacks: Partial<ReplayEngineCallbacks> = {}

  constructor(timeline: ReplayTimeline) {
    this.operations = [...timeline.operations]
  }

  // ─── Callbacks ─────────────────────────────────────────────────────────────

  on<K extends keyof ReplayEngineCallbacks>(
    event: K,
    cb: ReplayEngineCallbacks[K],
  ): this {
    this.callbacks[event] = cb
    return this
  }

  // ─── State accessors ───────────────────────────────────────────────────────

  getState(): ReplayState { return this.state }
  getCurrentIndex(): number { return this.currentIndex }
  getTotalOperations(): number { return this.operations.length }

  // A.3: для seek-with-snapshot потрібно мапити index ↔ seq
  getOperationAt(index: number): BoardOperation | null {
    return this.operations[index] ?? null
  }

  findIndexBySeq(seq: number): number {
    // Operations sorted ASC by created_at; seq must also be monotonic.
    // Linear scan достатньо швидкий до ~10k ops; binary search можна додати пізніше.
    for (let i = 0; i < this.operations.length; i++) {
      const opSeq = (this.operations[i] as { seq?: number }).seq
      if (typeof opSeq === 'number' && opSeq >= seq) return i
    }
    return Math.max(0, this.operations.length - 1)
  }

  private setState(s: ReplayState): void {
    this.state = s
    this.callbacks.onStateChange?.(s)
  }

  // ─── Playback control ──────────────────────────────────────────────────────

  play(): void {
    if (this.state === 'playing') return
    if (this.currentIndex >= this.operations.length) {
      this.currentIndex = 0  // restart from beginning
    }
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

  setSpeed(speed: ReplaySpeed): void {
    this.speed = speed || 1  // guard: never allow 0 (would cause Infinity delay)
    // If already playing — reschedule with new speed immediately
    if (this.state === 'playing') {
      this._clearTimer()
      this._scheduleNext()
    }
  }

  /** Seek to index. Returns actual (clamped) position. */
  seekTo(index: number): number {
    const wasPlaying = this.state === 'playing'
    if (wasPlaying) this._clearTimer()

    // Clamp to valid range
    const clamped = Math.max(0, Math.min(index, this.operations.length - 1))
    this.currentIndex = clamped

    this.callbacks.onProgress?.(clamped, this.operations.length)

    if (wasPlaying) {
      this._scheduleNext()
    }
    return clamped
  }

  /** Step forward by 1 operation. Pauses if playing. Returns op at new index (or null). */
  stepForward(): BoardOperation | null {
    if (this.state === 'playing') {
      this._clearTimer()
      this.setState('paused')
    }
    if (this.currentIndex >= this.operations.length) return null
    const op = this.operations[this.currentIndex]
    this.callbacks.onOperation?.(op, this.currentIndex)
    this.currentIndex++
    this.callbacks.onProgress?.(this.currentIndex, this.operations.length)
    if (this.currentIndex >= this.operations.length) {
      this.setState('ended')
    } else if (this.state === 'idle') {
      this.setState('paused')
    }
    return op
  }

  /**
   * Step backward by 1 operation. Returns target index.
   * NOTE: Caller must handle board state reset (snapshot-based seek),
   * because operations are not reversible.
   */
  stepBackward(): number {
    if (this.state === 'playing') {
      this._clearTimer()
      this.setState('paused')
    }
    const newIdx = Math.max(0, this.currentIndex - 1)
    this.currentIndex = newIdx
    this.callbacks.onProgress?.(newIdx, this.operations.length)
    if (this.state === 'ended') {
      this.setState('paused')
    }
    return newIdx
  }

  /** Clean up all timers and callbacks — call when component unmounts */
  destroy(): void {
    this._clearTimer()
    this.setState('idle')
    this.callbacks = {}
  }

  // ─── Private ───────────────────────────────────────────────────────────────

  private _scheduleNext(): void {
    if (this.currentIndex >= this.operations.length) {
      this.setState('ended')
      this.callbacks.onComplete?.()
      return
    }

    const op = this.operations[this.currentIndex]
    const nextOp = this.operations[this.currentIndex + 1]

    // Derive inter-op delay from real timestamps, capped at 2s, scaled by speed
    let delayMs = 16  // minimum frame interval
    if (nextOp) {
      const diff = new Date(nextOp.created_at).getTime() - new Date(op.created_at).getTime()
      const realDiff = Math.max(16, Math.min(diff, 2000))
      delayMs = realDiff / this.speed
    }

    this.playTimer = setTimeout(() => {
      if (this.state !== 'playing') return

      this.callbacks.onOperation?.(op, this.currentIndex)
      this.callbacks.onProgress?.(this.currentIndex + 1, this.operations.length)

      this.currentIndex++
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
