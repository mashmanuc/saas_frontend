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
// Лише UI: не пише ops і не чіпає стан дошки.

import { ref, watch } from 'vue'

export interface ReplayPlayheadSource {
  state: () => string
  /** Час останньої показаної op від початку запису, мс. */
  currentTimeMs: () => number
  totalMs: () => number
}

export function useReplayPlayhead() {
  const playheadMs = ref(0)
  let src: ReplayPlayheadSource | null = null
  let raf: number | null = null
  let anchorWall = 0
  let anchorReplay = 0
  let speed = 1
  let stopWatches: (() => void) | null = null

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
    const elapsed = performance.now() - anchorWall
    playheadMs.value = Math.min(anchorReplay + elapsed * speed, src.totalMs())
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
        playheadMs.value = source.currentTimeMs()
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
    playheadMs.value = 0
  }

  return { playheadMs, attach, detach, jumpTo, resyncToEngine, setSpeed, reset }
}
