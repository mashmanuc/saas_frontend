// «Дзеркало» вмикає й завершує запис уроку — НОУТБУК (LAW §9 v1.28, 2026-10-12; ТЗ TZ_MIRROR_AUTO_RECORDING).
//
// Пульт лише просить. Адаптер вирішує за станом запису кімнати й кличе ТІ САМІ обробники, що кнопки
// запису (`handleStartRecording` / `handleResumeRecording` / `handleFinalizeRecording` у WBSoloRoom):
// той самий бар'єр артефакту, ті самі REST, той самий тост чи вікно бар'єра. Повторів кодом немає (§12).
//
// `recording_by_mirror_run` — власник циклу запису: той, хто його УВІМКНУВ (`idle`/`finalized` → `recording`).
// Запуск Дзеркала, що ввімкнув запис, — власник; кнопкою на ноутбуці — власника-Дзеркала немає. Пауза
// власника не скидає, продовження (кнопкою чи «Почати» Дзеркала) — не змінює: цикл, увімкнений кнопкою,
// так і лишається без власника. Скидає лише кінець циклу (будь-яким шляхом) або інша дошка (ТЗ §1.3,
// уточнення 2026-10-12 після стенду).
//
// Дошка не урок «Провести» (INV-LESSON-PLAY: на звичайних дошках запису немає, кнопок запису теж) —
// `recording: 'unavailable'`, а `recording.start` відхиляється з `not_lesson`, обробник не кличемо.

import { ref, watch } from 'vue'
import type { RecordingRefusalReason, RemoteRecordingResult, RemoteRecordingState } from './recordingContract'

/** Стан запису кімнати (як `soloRecordingState` у WBSoloRoom). */
export type RoomRecordingState = 'idle' | 'recording' | 'paused' | 'finalized'

export interface RemoteRecordingDeps {
  /** Стан запису кімнати — реактивний (computed), бо за ним стежимо кінець циклу */
  state: () => RoomRecordingState
  /** Дошка цієї кімнати: інша дошка — інший цикл */
  boardId: () => string | null
  /** Урок «Провести» (`isLessonPlay`): лише тут є запис; інакше — 'unavailable' */
  available: () => boolean
  /** Кімната саме вмикає, ставить на паузу чи завершує запис — друга дія зараз не почнеться */
  busy: () => boolean
  /** «Записати урок» — null: запис іде; інакше причина відмови */
  start: () => Promise<RecordingRefusalReason | null>
  /** «Продовжити» — null: запис іде; інакше причина відмови */
  resume: () => Promise<RecordingRefusalReason | null>
  /** «Завершити запис» — 'saved' / 'empty' (порожній не збережено) або причина відмови */
  finalize: () => Promise<'saved' | 'empty' | RecordingRefusalReason>
}

export interface RemoteRecordingWire {
  recording: RemoteRecordingState
  recording_by_mirror_run: string | null
}

export interface RemoteRecordingAdapter {
  /** Поля для кожного `remote.state` */
  state: () => RemoteRecordingWire
  start: (mirrorRun: string) => Promise<RemoteRecordingResult>
  stop: (mirrorRun: string) => Promise<RemoteRecordingResult>
}

const isGoing = (s: RoomRecordingState) => s === 'recording' || s === 'paused'

export function createRemoteRecordingAdapter(deps: RemoteRecordingDeps): RemoteRecordingAdapter {
  const byMirrorRun = ref<string | null>(null)

  // Кінець циклу — будь-яким шляхом (кнопка на ноутбуці, пульт, сторож сервера, вихід): поле — null.
  // `sync`: між двома станами пульту запис міг закінчитись і початися знову кнопкою — старий запуск
  // не має «прилипнути» до нового циклу.
  watch(deps.state, (s) => { if (!isGoing(s)) byMirrorRun.value = null }, { flush: 'sync' })
  watch(deps.boardId, () => { byMirrorRun.value = null }, { flush: 'sync' })

  function rejected(mirrorRun: string, cmd: 'start' | 'stop', reason: RecordingRefusalReason): RemoteRecordingResult {
    return { mirror_run: mirrorRun, cmd, status: 'rejected', reason }
  }

  async function start(mirrorRun: string): Promise<RemoteRecordingResult> {
    // Не урок — запису тут немає зовсім: ноутбук його не вмикає (і зупинити не зміг би — кнопок немає)
    if (!deps.available()) return rejected(mirrorRun, 'start', 'not_lesson')
    if (deps.busy()) return rejected(mirrorRun, 'start', 'busy')
    const s = deps.state()
    if (s === 'recording') return { mirror_run: mirrorRun, cmd: 'start', status: 'already' }
    if (s === 'paused') {
      // Продовження власника не змінює: чий цикл був — того й лишається
      const reason = await deps.resume()
      if (reason) return rejected(mirrorRun, 'start', reason)
      return { mirror_run: mirrorRun, cmd: 'start', status: 'resumed' }
    }
    const reason = await deps.start()
    if (reason) return rejected(mirrorRun, 'start', reason)
    byMirrorRun.value = mirrorRun
    return { mirror_run: mirrorRun, cmd: 'start', status: 'started' }
  }

  async function stop(mirrorRun: string): Promise<RemoteRecordingResult> {
    // Чужий чи порожній запуск — учитель увімкнув запис сам або вже зупинив: нічого не робимо
    if (!byMirrorRun.value || byMirrorRun.value !== mirrorRun || !isGoing(deps.state())) {
      return { mirror_run: mirrorRun, cmd: 'stop', status: 'skipped' }
    }
    if (deps.busy()) return rejected(mirrorRun, 'stop', 'busy')
    const out = await deps.finalize()
    if (out === 'saved' || out === 'empty') return { mirror_run: mirrorRun, cmd: 'stop', status: out }
    return rejected(mirrorRun, 'stop', out)
  }

  function state(): RemoteRecordingWire {
    if (!deps.available()) return { recording: 'unavailable', recording_by_mirror_run: null }
    const s = deps.state()
    return {
      recording: isGoing(s) ? s as RemoteRecordingState : 'idle',
      recording_by_mirror_run: isGoing(s) ? byMirrorRun.value : null,
    }
  }

  return { state, start, stop }
}
