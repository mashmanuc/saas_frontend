// Повзунок часу Replay: плавно йде за годинником між op і ВИРІВНЮЄТЬСЯ з дошкою
// на кожній op.
//
// Навіщо: рушій стискає паузи уроку > 2 с до 2 с (WBReplayEngineV2._scheduleNext),
// а повзунок ішов лише за годинником від якоря на старті гри. Дошка забігала
// вперед, повзунок відставав і вже не наздоганяв: локальний запис 608f9901 —
// урок 410 с, 280 с стиснуто; дошка на 3-й хвилині, повзунок на першій
// (REPLAY_SEEK_INVESTIGATION_2026-09-22 §6.1). Тепер кожна op під час гри
// переставляє якір на свій час — повзунок перескакує стиснуту паузу разом із
// дошкою.
//
// v2.3 (2026-09-27): джерело дає ЧАС ПЕРЕГЛЯДУ (replayViewTime) — на кожній op якір стає
// туди, де тікер уже й так стоїть, тож повзунок іде рівно, без стрибків. Після останньої op
// рушій тримає витримку: повзунок плавно доходить до кінця зі швидкості, з якою їхав, і
// м'яко зупиняється рівно на 100 % у мить 'ended'.
//
// Лише UI: не пише ops і не чіпає стан дошки.

import { ref, watch } from 'vue'

export interface ReplayPlayheadSource {
  state: () => string
  /** Позиція останньої показаної op на шкалі, мс (v2.3 — час перегляду). */
  currentTimeMs: () => number
  totalMs: () => number
  /** performance.now() початку витримки після останньої op; null — витримки немає. */
  epilogueStartedAt?: () => number | null
  /** Тривалість витримки в реальному часі, мс. */
  epilogueMs?: number
}

/**
 * Крива доходу до кінця: h(0)=0, h(1)=1, h'(0)=a (швидкість, з якою повзунок їхав), h'(1)=0
 * (м'яка зупинка). При a ≤ 3 монотонна; a обмежується 0…3.
 */
export function epilogueCurve(u: number, a: number): number {
  const x = Math.max(0, Math.min(1, u))
  const k = Math.max(0, Math.min(3, a))
  return k * x + (3 - 2 * k) * x * x + (k - 2) * x * x * x
}

export function useReplayPlayhead() {
  const playheadMs = ref(0)
  let src: ReplayPlayheadSource | null = null
  let raf: number | null = null
  let anchorWall = 0
  let anchorReplay = 0
  let speed = 1
  let stopWatches: (() => void) | null = null
  // Дохід до кінця під час витримки: з якої точки й з якою початковою швидкістю.
  let glideKey: number | null = null
  let glideFrom = 0
  let glideSlope = 1

  function anchor(atMs: number): void {
    anchorWall = performance.now()
    anchorReplay = atMs
  }

  function stopTick(): void {
    if (raf !== null) {
      cancelAnimationFrame(raf)
      raf = null
    }
  }

  function tick(): void {
    if (!src || src.state() !== 'playing') {
      raf = null
      return
    }
    const total = src.totalMs()
    const epilogueAt = src.epilogueStartedAt?.() ?? null
    const epilogueMs = src.epilogueMs ?? 0
    if (epilogueAt !== null && epilogueMs > 0) {
      if (glideKey !== epilogueAt) {
        glideKey = epilogueAt
        glideFrom = playheadMs.value
        const distance = Math.max(1, total - glideFrom)
        glideSlope = (speed * epilogueMs) / distance
      }
      const u = (performance.now() - epilogueAt) / epilogueMs
      playheadMs.value = glideFrom + (total - glideFrom) * epilogueCurve(u, glideSlope)
    } else {
      glideKey = null
      const elapsed = performance.now() - anchorWall
      playheadMs.value = Math.min(anchorReplay + elapsed * speed, total)
    }
    raf = requestAnimationFrame(tick)
  }

  function startTick(): void {
    stopTick()
    raf = requestAnimationFrame(tick)
  }

  /** Під'єднати до джерела (useReplay / useReplayV2). Попереднє — від'єднується. */
  function attach(source: ReplayPlayheadSource): void {
    detach()
    src = source
    const stopState = watch(source.state, (s) => {
      if (s === 'playing') {
        anchor(source.currentTimeMs())
        startTick()
      } else {
        stopTick()
        glideKey = null
        // Кінець — рівно 100 %: шкала включає витримку після останньої op.
        playheadMs.value = s === 'ended' ? source.totalMs() : source.currentTimeMs()
      }
    })
    const stopOp = watch(source.currentTimeMs, (t) => {
      if (source.state() !== 'playing') return
      anchor(t)
      playheadMs.value = Math.min(t, source.totalMs())
    })
    stopWatches = () => { stopState(); stopOp() }
  }

  function detach(): void {
    stopWatches?.()
    stopWatches = null
    stopTick()
    glideKey = null
    src = null
  }

  /** Клік по повзунку: показати ціль одразу, не чекаючи перебудови дошки. */
  function jumpTo(ms: number): void {
    playheadMs.value = ms
    anchor(ms)
  }

  /** Після seek: стати туди, де реально стоїть рушій. */
  function resyncToEngine(): void {
    if (src) anchor(src.currentTimeMs())
  }

  /** Зміна швидкості — продовжити з поточної позиції повзунка, без стрибка назад. */
  function setSpeed(s: number): void {
    anchor(playheadMs.value)
    speed = s
  }

  function reset(): void {
    stopTick()
    glideKey = null
    playheadMs.value = 0
  }

  return { playheadMs, attach, detach, jumpTo, resyncToEngine, setSpeed, reset }
}
