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
  // Кеш timestamp першої операції — основа часової координати (REPLAY_MANIFEST §1).
  private firstOpAtMs: number = 0

  private callbacks: Partial<ReplayEngineCallbacks> = {}

  constructor(timeline: ReplayTimeline) {
    this.operations = [...timeline.operations]
    if (this.operations.length > 0) {
      const t = new Date(this.operations[0].created_at).getTime()
      this.firstOpAtMs = isNaN(t) ? 0 : t
    }
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

  /** Timestamp першої операції (анкор часової шкали). 0 якщо ops порожні. */
  getFirstOpAtMs(): number { return this.firstOpAtMs }

  /**
   * Знайти індекс першої операції, чий offset (created_at − firstOpAt) ≥ targetMs.
   * Бінарний пошук O(log n). Використовується для seek-by-time та позиціонування маркерів.
   *
   * Edge cases:
   *  - ops порожні → 0
   *  - targetMs ≤ 0 → 0
   *  - targetMs ≥ duration → останній індекс
   */
  findIndexByTimeMs(targetMs: number): number {
    const n = this.operations.length
    if (n === 0) return 0
    if (targetMs <= 0) return 0
    let lo = 0
    let hi = n - 1
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

  /** Offset (мс) між op[index] та першою операцією. 0 якщо index невалідний. */
  getOperationTimeMs(index: number): number {
    const op = this.operations[index]
    if (!op) return 0
    const t = new Date(op.created_at).getTime()
    if (isNaN(t)) return 0
    return Math.max(0, t - this.firstOpAtMs)
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

  /**
   * Ops emitted within BURST_THRESHOLD_MS of each other are treated as one
   * atomic user action (paste, batch, group drag). They play in a single
   * timer tick with 0 delay → one Vue render → no "typing" effect.
   */
  private static readonly BURST_THRESHOLD_MS = 16

  private _scheduleNext(): void {
    if (this.currentIndex >= this.operations.length) {
      this.setState('ended')
      this.callbacks.onComplete?.()
      return
    }

    const op = this.operations[this.currentIndex]
    const nextOp = this.operations[this.currentIndex + 1]

    // Derive inter-op delay from real timestamps, capped at 2s, scaled by speed.
    // NO artificial 16ms floor — atomic ops (paste/batch) have diff ≈ 0 and must
    // replay together. Only 4ms floor on final delay prevents timer storm at 10x.
    let delayMs = 16
    if (nextOp) {
      const t1 = new Date(op.created_at).getTime()
      const t2 = new Date(nextOp.created_at).getTime()
      const diff = (isNaN(t1) || isNaN(t2)) ? 16 : Math.min(Math.max(0, t2 - t1), 2000)
      delayMs = Math.max(4, diff / this.speed)
    }

    this.playTimer = setTimeout(() => {
      if (this.state !== 'playing') return

      // Apply current op
      this.callbacks.onOperation?.(op, this.currentIndex)
      this.callbacks.onProgress?.(this.currentIndex + 1, this.operations.length)
      this.currentIndex++

      // BURST MODE: drain consecutive ops with near-zero diff in SAME tick.
      // This is what makes paste/batch appear atomic in replay (one Vue render).
      while (this.currentIndex < this.operations.length) {
        const prevOp = this.operations[this.currentIndex - 1]
        const curOp = this.operations[this.currentIndex]
        const tp = new Date(prevOp.created_at).getTime()
        const tc = new Date(curOp.created_at).getTime()
        if (isNaN(tp) || isNaN(tc)) break
        if (tc - tp >= WBReplayEngine.BURST_THRESHOLD_MS) break
        // Within burst threshold — apply in same tick (no setTimeout between)
        this.callbacks.onOperation?.(curOp, this.currentIndex)
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
