/**
 * TLV2-05B · планувальник кадрів, який можна призупинити.
 *
 * Навіщо: згорнута в трей капсула лишається змонтованою (`display: none`), а
 * `requestAnimationFrame` у схованому елементі працює далі — анімація «доїхала б»
 * до кінця, поки картка в треї, і після відновлення стрибнула б уперед.
 *
 * V-D3.1 уже приймає підмінний планувальник (`FrameScheduler`, для тестів), тому
 * пауза робиться тут, без жодної зміни математики чи сценарію капсули:
 *   • `suspend()` — годинник зупиняється, заплановані кадри відкладаються;
 *   • `resume()`  — час згортання віднімається з годинника, кадри йдуть далі.
 * Для програвача це виглядає так, ніби часу згортання не було: рух продовжується
 * з того самого місця, без стрибка.
 */
import type { FrameScheduler } from '../components/board/objects/visualCapsules/overlayPlayer'

export interface SuspendableFrameScheduler extends FrameScheduler {
  suspend(): void
  resume(): void
  readonly suspended: boolean
}

interface PendingFrame {
  cb: (now: number) => void
  baseId: number | null
}

export function createSuspendableFrameScheduler(base: FrameScheduler): SuspendableFrameScheduler {
  let suspended = false
  let suspendedAt = 0
  /** Сумарний час, проведений у згорнутому стані. */
  let offset = 0
  let nextId = 1
  const frames = new Map<number, PendingFrame>()

  function dispatch(id: number): void {
    const frame = frames.get(id)
    if (!frame) return
    frame.baseId = base.requestFrame((ts) => {
      const current = frames.get(id)
      if (!current) return
      if (suspended) {
        // Кадр прийшов уже після згортання — лишається в черзі до resume().
        current.baseId = null
        return
      }
      frames.delete(id)
      current.cb(ts - offset)
    })
  }

  return {
    get suspended() {
      return suspended
    },

    requestFrame(cb) {
      const id = nextId++
      frames.set(id, { cb, baseId: null })
      if (!suspended) dispatch(id)
      return id
    },

    cancelFrame(id) {
      const frame = frames.get(id)
      if (!frame) return
      if (frame.baseId !== null) base.cancelFrame(frame.baseId)
      frames.delete(id)
    },

    now() {
      return (suspended ? suspendedAt : base.now()) - offset
    },

    suspend() {
      if (suspended) return
      suspended = true
      suspendedAt = base.now()
      for (const frame of frames.values()) {
        if (frame.baseId !== null) {
          base.cancelFrame(frame.baseId)
          frame.baseId = null
        }
      }
    },

    resume() {
      if (!suspended) return
      offset += base.now() - suspendedAt
      suspended = false
      for (const id of [...frames.keys()]) dispatch(id)
    },
  }
}
