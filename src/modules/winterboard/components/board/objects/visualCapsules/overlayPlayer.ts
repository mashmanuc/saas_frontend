/**
 * V-D3 · програвач капсули накладання: темп, пауза, крок, спочатку — без Vue і без дошки.
 *
 * Межі (ТЗ §4.2, §4.3, §6):
 *  • ЄДИНИЙ активний кадр: `play()` під час програвання нічого не додає — дві анімації
 *    одночасно неможливі за побудовою;
 *  • `destroy()` / `restart()` / `setMode()` синхронно скасовують кадр;
 *  • проміжні кадри нікуди не пишуться: лише `onChange` у пам'яті (жодних ops, REST, WS);
 *  • `prefers-reduced-motion` не вимикає доказ: рух стає одним миттєвим кроком між тими
 *    самими семантичними станами.
 *
 * Планувальник підмінний: у браузері — `requestAnimationFrame`, у тестах — ручний годинник.
 */
import { pose, type Pt, type SourceId } from './trianglesOverlayGeometry'
import {
  advance,
  createEnvelope,
  REVEAL_STEPS,
  SceneContractError,
  withPrediction,
  withReveal,
  type Prediction,
  type SceneEnvelope,
  type SceneMode,
} from './trianglesOverlayMachine'

export interface FrameScheduler {
  requestFrame(cb: (now: number) => void): number
  cancelFrame(id: number): void
  now(): number
}

export const browserScheduler: FrameScheduler = {
  requestFrame: (cb) => window.requestAnimationFrame(cb),
  cancelFrame: (id) => window.cancelAnimationFrame(id),
  now: () => performance.now(),
}

export interface ModeTimings {
  separatedMs: number
  /** `null` — повне пояснення чекає прогнозу чи явного «Продовжити». */
  predictingMs: number | null
  overlayMs: number
  matchedMs: number
  revealStepMs: number
}

/**
 * Темп. Recall — ті самі стани без вступу: питання-прогноз, рух, пари. Весь сценарій recall
 * вкладається в 20–60 с (ТЗ §4.1): тут це 21,25 с без жодної штучної затримки.
 */
export const TIMINGS: Readonly<Record<SceneMode, ModeTimings>> = Object.freeze({
  full: { separatedMs: 5000, predictingMs: null, overlayMs: 6000, matchedMs: 3000, revealStepMs: 2000 },
  recall: { separatedMs: 2000, predictingMs: 10000, overlayMs: 3500, matchedMs: 2000, revealStepMs: 1250 },
})

/** Перша пара відкривається одразу при вході в `correspondence`, тож кроків очікування на один менше. */
export function scriptedDurationMs(mode: SceneMode): number {
  const t = TIMINGS[mode]
  return t.separatedMs + (t.predictingMs ?? 0) + t.overlayMs + t.matchedMs + t.revealStepMs * (REVEAL_STEPS - 1)
}

export type PlayerStatus = 'idle' | 'playing' | 'paused' | 'awaiting_prediction' | 'finished'

export interface PlayerSnapshot {
  envelope: SceneEnvelope
  status: PlayerStatus
  /** Частка руху 0..1 — лише для рендера, не частина конверта. */
  progress: number
  pose: Record<SourceId, Pt>
  revealed: number
}

export interface OverlayPlayerOptions {
  mode: SceneMode
  reducedMotion?: boolean
  scheduler?: FrameScheduler
  onChange?: (snapshot: PlayerSnapshot) => void
}

export class OverlayPlayer {
  private envelope: SceneEnvelope
  private status: PlayerStatus = 'idle'
  private progress = 0
  private revealed = 0
  /** Скільки мс уже минуло в поточному сегменті — переживає паузу. */
  private elapsed = 0
  private segmentStart = 0
  private frameId: number | null = null
  private destroyed = false
  private readonly reducedMotion: boolean
  private readonly scheduler: FrameScheduler
  private readonly onChange?: (snapshot: PlayerSnapshot) => void

  constructor(options: OverlayPlayerOptions) {
    this.envelope = createEnvelope(options.mode)
    this.reducedMotion = Boolean(options.reducedMotion)
    this.scheduler = options.scheduler ?? browserScheduler
    this.onChange = options.onChange
  }

  get snapshot(): PlayerSnapshot {
    return {
      envelope: this.envelope,
      status: this.status,
      progress: this.progress,
      pose: pose(this.progress),
      revealed: this.revealed,
    }
  }

  /** Для тестів і діагностики: чи висить запланований кадр. */
  get hasPendingFrame(): boolean {
    return this.frameId !== null
  }

  play(): void {
    this.assertAlive()
    if (this.status === 'playing' || this.status === 'finished') return
    if (this.status === 'awaiting_prediction') {
      // «Продовжити» без прогнозу — рішення вчителя, а не помилка.
      this.envelope = advance(this.envelope)
      this.elapsed = 0
    }
    this.status = 'playing'
    this.segmentStart = this.scheduler.now() - this.elapsed
    this.schedule()
    this.emit()
  }

  pause(): void {
    this.assertAlive()
    if (this.status !== 'playing') return
    this.cancel()
    this.elapsed = this.scheduler.now() - this.segmentStart
    this.status = 'paused'
    this.emit()
  }

  /** Ручний крок: завершити поточний сегмент миттєво й детерміновано. */
  step(): void {
    this.assertAlive()
    if (this.status === 'finished') return
    this.cancel()
    const { state } = this.envelope
    if (state === 'overlaying') {
      this.progress = 1
      this.envelope = advance(this.envelope)
    } else if (state === 'correspondence') {
      this.reveal(this.revealed + 1)
    } else if (state === 'matched') {
      this.revealed = 1
      this.envelope = advance(this.envelope, this.revealed)
    } else {
      this.envelope = advance(this.envelope)
    }
    this.elapsed = 0
    if (!this.isFinished()) this.status = 'paused'
    this.emit()
  }

  restart(): void {
    this.assertAlive()
    this.cancel()
    this.reset(this.envelope.mode)
    this.emit()
  }

  setMode(mode: SceneMode): void {
    this.assertAlive()
    this.cancel()
    this.reset(mode)
    this.emit()
  }

  setPrediction(prediction: Prediction): void {
    this.assertAlive()
    this.envelope = withPrediction(this.envelope, prediction)
    this.emit()
  }

  destroy(): void {
    this.cancel()
    this.destroyed = true
  }

  // ── внутрішнє ──────────────────────────────────────────────────────────────

  private reset(mode: SceneMode): void {
    this.envelope = createEnvelope(mode)
    this.status = 'idle'
    this.progress = 0
    this.revealed = 0
    this.elapsed = 0
  }

  /** Статус читається методом: `reveal()` міг змінити його після звуження типу. */
  private isFinished(): boolean {
    return this.status === 'finished'
  }

  private assertAlive(): void {
    if (this.destroyed) throw new SceneContractError('програвач уже знищено')
  }

  private schedule(): void {
    if (this.frameId !== null) return
    this.frameId = this.scheduler.requestFrame((now) => this.tick(now))
  }

  private cancel(): void {
    if (this.frameId === null) return
    this.scheduler.cancelFrame(this.frameId)
    this.frameId = null
  }

  private reveal(count: number): void {
    this.revealed = Math.min(REVEAL_STEPS, count)
    this.envelope = withReveal(this.envelope, this.revealed)
    if (this.revealed >= REVEAL_STEPS) this.status = 'finished'
  }

  private nextSegment(now: number): void {
    this.segmentStart = now
    this.elapsed = 0
  }

  private tick(now: number): void {
    this.frameId = null
    if (this.destroyed || this.status !== 'playing') return
    const timings = TIMINGS[this.envelope.mode]
    const elapsed = now - this.segmentStart
    const { state } = this.envelope

    if (state === 'separated') {
      if (elapsed >= timings.separatedMs) {
        this.envelope = advance(this.envelope)
        this.nextSegment(now)
      }
    } else if (state === 'predicting') {
      if (timings.predictingMs === null) {
        this.status = 'awaiting_prediction'
        this.emit()
        return
      }
      if (elapsed >= timings.predictingMs) {
        this.envelope = advance(this.envelope)
        this.nextSegment(now)
      }
    } else if (state === 'overlaying') {
      this.progress = this.reducedMotion ? 1 : Math.min(1, elapsed / timings.overlayMs)
      if (this.progress >= 1) {
        this.envelope = advance(this.envelope)
        this.nextSegment(now)
      }
    } else if (state === 'matched') {
      if (elapsed >= timings.matchedMs) {
        this.revealed = 1
        this.envelope = advance(this.envelope, this.revealed)
        this.nextSegment(now)
      }
    } else if (state === 'correspondence') {
      const due = 1 + Math.floor(elapsed / timings.revealStepMs)
      if (due > this.revealed) this.reveal(due)
      if (this.isFinished()) {
        this.emit()
        return
      }
    }
    this.emit()
    this.schedule()
  }

  private emit(): void {
    this.onChange?.(this.snapshot)
  }
}
