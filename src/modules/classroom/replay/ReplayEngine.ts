// F9: ReplayEngine - Session replay engine
import { ref, computed } from 'vue'
import { classroomApi } from '../api/classroom'

export interface ReplayEvent {
  t: number // timestamp in ms
  type: string
  user?: number
  data?: Record<string, unknown>
}

export interface ReplayManifest {
  session_id: string
  duration_ms: number
  events: ReplayEvent[]
  snapshots: { version: number; t: number }[]
  participants: { id: number; name: string; role: string }[]
}

export interface BoardEngine {
  setReadOnly(readOnly: boolean): void
  clear(): void
  addObject(data: unknown): void
  removeObject(id: string): void
  updateObject(data: unknown): void
  importState(state: Record<string, unknown>): void
}

export class ReplayEngine {
  private manifest: ReplayManifest | null = null
  private boardEngine: BoardEngine | null = null
  private animationFrame: number | null = null
  private lastFrameTime: number = 0
  private eventIndex: number = 0

  // Reactive state
  public readonly isPlaying = ref(false)
  public readonly currentTimeMs = ref(0)
  public readonly speed = ref(1)
  public readonly isLoading = ref(false)
  public readonly error = ref<string | null>(null)

  public readonly duration = computed(() => this.manifest?.duration_ms || 0)
  public readonly progress = computed(() =>
    this.duration.value > 0
      ? (this.currentTimeMs.value / this.duration.value) * 100
      : 0
  )
  public readonly events = computed(() => this.manifest?.events || [])
  public readonly snapshots = computed(() => this.manifest?.snapshots || [])
  public readonly participants = computed(() => this.manifest?.participants || [])

  constructor(private sessionId: string) {}

  /**
   * Initialize replay engine with board engine.
   */
  setBoardEngine(engine: BoardEngine): void {
    this.boardEngine = engine
    this.boardEngine.setReadOnly(true)
  }

  /**
   * Load replay data from server.
   */
  async load(): Promise<void> {
    this.isLoading.value = true
    this.error.value = null

    try {
      const response = await classroomApi.getReplayStream(this.sessionId)
      this.manifest = response

      // Reset state
      this.currentTimeMs.value = 0
      this.eventIndex = 0

      // Render initial state
      this.renderAtCurrentTime()
    } catch (err) {
      this.error.value = 'Не вдалося завантажити replay'
      console.error('[ReplayEngine] Load failed:', err)
    } finally {
      this.isLoading.value = false
    }
  }

  /**
   * Start playback.
   */
  play(): void {
    if (this.isPlaying.value || !this.manifest) return

    this.isPlaying.value = true
    this.lastFrameTime = performance.now()
    this.tick()
  }

  /**
   * Pause playback.
   */
  pause(): void {
    this.isPlaying.value = false
    if (this.animationFrame) {
      cancelAnimationFrame(this.animationFrame)
      this.animationFrame = null
    }
  }

  /**
   * Toggle play/pause.
   */
  toggle(): void {
    if (this.isPlaying.value) {
      this.pause()
    } else {
      this.play()
    }
  }

  /**
   * Seek to specific time.
   */
  seek(timeMs: number): void {
    this.currentTimeMs.value = Math.max(0, Math.min(timeMs, this.duration.value))

    // Find event index for new time
    this.eventIndex = this.findEventIndexAtTime(this.currentTimeMs.value)

    // Re-render board state
    this.renderAtCurrentTime()
  }

  /**
   * Skip forward by seconds.
   */
  skipForward(seconds: number = 10): void {
    this.seek(this.currentTimeMs.value + seconds * 1000)
  }

  /**
   * Skip backward by seconds.
   */
  skipBackward(seconds: number = 10): void {
    this.seek(this.currentTimeMs.value - seconds * 1000)
  }

  /**
   * Set playback speed.
   */
  setSpeed(newSpeed: number): void {
    this.speed.value = Math.max(0.25, Math.min(4, newSpeed))
  }

  /**
   * Go to start.
   */
  goToStart(): void {
    this.seek(0)
  }

  /**
   * Go to end.
   */
  goToEnd(): void {
    this.seek(this.duration.value)
  }

  /**
   * Main animation loop.
   */
  private tick(): void {
    if (!this.isPlaying.value || !this.manifest) return

    const now = performance.now()
    const deltaMs = (now - this.lastFrameTime) * this.speed.value
    this.lastFrameTime = now

    // Update time
    this.currentTimeMs.value += deltaMs

    // Check if reached end
    if (this.currentTimeMs.value >= this.duration.value) {
      this.currentTimeMs.value = this.duration.value
      this.pause()
      return
    }

    // Apply events up to current time
    this.applyEventsUpToCurrentTime()

    // Schedule next frame
    this.animationFrame = requestAnimationFrame(() => this.tick())
  }

  /**
   * Apply all events from current index up to current time.
   */
  private applyEventsUpToCurrentTime(): void {
    if (!this.manifest || !this.boardEngine) return

    while (this.eventIndex < this.manifest.events.length) {
      const event = this.manifest.events[this.eventIndex]

      if (event.t > this.currentTimeMs.value) break

      this.applyEvent(event)
      this.eventIndex++
    }
  }

  /**
   * Apply single event to board.
   */
  private applyEvent(event: ReplayEvent): void {
    if (!this.boardEngine) return

    switch (event.type) {
      case 'board_stroke':
      case 'board_object_create':
        this.boardEngine.addObject(event.data)
        break
      case 'board_object_delete':
        this.boardEngine.removeObject(event.data?.id as string)
        break
      case 'board_object_modify':
        this.boardEngine.updateObject(event.data)
        break
      case 'board_clear':
        this.boardEngine.clear()
        break
      // Other event types don't affect board
    }
  }

  /**
   * Render board state at current time.
   */
  private renderAtCurrentTime(): void {
    if (!this.manifest || !this.boardEngine) return

    // Find nearest snapshot before current time
    const snapshot = this.findNearestSnapshot(this.currentTimeMs.value)

    // Clear and rebuild state
    this.boardEngine.clear()

    if (snapshot) {
      // TODO: Load snapshot state, then apply events from snapshot to current time
      // For now, apply all events from start
      for (let i = 0; i < this.eventIndex; i++) {
        this.applyEvent(this.manifest.events[i])
      }
    } else {
      // Apply all events from start
      for (let i = 0; i < this.eventIndex; i++) {
        this.applyEvent(this.manifest.events[i])
      }
    }
  }

  /**
   * Find event index at given time.
   */
  private findEventIndexAtTime(timeMs: number): number {
    if (!this.manifest) return 0

    for (let i = 0; i < this.manifest.events.length; i++) {
      if (this.manifest.events[i].t > timeMs) {
        return i
      }
    }
    return this.manifest.events.length
  }

  /**
   * Find nearest snapshot before given time.
   */
  private findNearestSnapshot(
    timeMs: number
  ): { version: number; t: number } | null {
    if (!this.manifest) return null

    let nearest = null
    for (const snapshot of this.manifest.snapshots) {
      if (snapshot.t <= timeMs) {
        nearest = snapshot
      } else {
        break
      }
    }
    return nearest
  }

  /**
   * Get current event (for UI display).
   */
  getCurrentEvent(): ReplayEvent | null {
    if (!this.manifest || this.eventIndex === 0) return null
    return this.manifest.events[this.eventIndex - 1] || null
  }

  /**
   * Cleanup.
   */
  destroy(): void {
    this.pause()
    this.manifest = null
    this.boardEngine = null
  }
}
