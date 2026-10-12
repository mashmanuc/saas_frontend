// «Дзеркало» вмикає й завершує запис уроку (LAW §9 v1.28, 2026-10-12; ТЗ TZ_MIRROR_AUTO_RECORDING) —
// спільний контракт телефона й ноутбука. Пульт лише просить; запис веде ноутбук тими самими REST,
// що кнопки запису. У WS — лише запуск Дзеркала і відповідь ноутбука.

import { PHOTO_REQUEST_ID_RE } from './photoContract'

/** Хто просить запис — закритий набір з одного значення (загальної кнопки запису на пульті немає). */
export const RECORDING_SOURCE = 'mirror'

export type RemoteRecordingCmd = 'recording.start' | 'recording.stop'

/**
 * Стан запису на ноутбуці для пульта; `finalized` іде як 'idle' (запис не йде).
 * 'unavailable' — дошка не урок (INV-LESSON-PLAY: на звичайних дошках запису немає), Дзеркало запис не просить.
 */
export type RemoteRecordingState = 'idle' | 'recording' | 'paused' | 'unavailable'
const RECORDING_STATES: readonly RemoteRecordingState[] = ['idle', 'recording', 'paused', 'unavailable']

/** Причини відмови — закритий набір (сервер відкидає поле з іншою причиною). */
export const RECORDING_REFUSAL_REASONS = [
  // причини бар'єра артефакту (LAW §5 «Остаточні відмови», `composables/artifactBarrier.ts`)
  'save_blocked', 'desync', 'bootstrap', 'paused', 'unconfirmed', 'queue', 'offline',
  'network', 'server', 'busy', 'unsupported',
  // дошка не урок «Провести» — запису тут немає (INV-LESSON-PLAY)
  'not_lesson',
  // бар'єр завершення запису: 504 / 429 (INV-22) — на ноутбуці вікно «Спробувати ще раз»
  'timeout', 'contention',
] as const
export type RecordingRefusalReason = typeof RECORDING_REFUSAL_REASONS[number]

export type RecordingStartStatus = 'started' | 'resumed' | 'already' | 'rejected'
export type RecordingStopStatus = 'saved' | 'empty' | 'skipped' | 'rejected'
const START_STATUSES: readonly string[] = ['started', 'resumed', 'already', 'rejected']
const STOP_STATUSES: readonly string[] = ['saved', 'empty', 'skipped', 'rejected']

/** `remote.state.recording_result` — відповідь на останню команду запису (як `photo`, v1.9). */
export type RemoteRecordingResult =
  | { mirror_run: string; cmd: 'start'; status: Exclude<RecordingStartStatus, 'rejected'> }
  | { mirror_run: string; cmd: 'stop'; status: Exclude<RecordingStopStatus, 'rejected'> }
  | { mirror_run: string; cmd: 'start' | 'stop'; status: 'rejected'; reason: RecordingRefusalReason }

/** Що з `remote.state` знає телефон про запис. Немає поля `recording` — старий ноутбук. */
export interface RemoteRecordingInfo {
  state: RemoteRecordingState
  byMirrorRun: string | null
}

export function isRecordingRefusalReason(v: unknown): v is RecordingRefusalReason {
  return typeof v === 'string' && (RECORDING_REFUSAL_REASONS as readonly string[]).includes(v)
}

const isRun = (v: unknown): v is string => typeof v === 'string' && PHOTO_REQUEST_ID_RE.test(v)

/** Аргументи `recording.start` / `recording.stop` на ноутбуці (сервер уже перевірив, ноутбук не вірить на слово). */
export function readRecordingRequest(args: Record<string, unknown> | undefined): { mirrorRun: string } | null {
  if (!args || args.source !== RECORDING_SOURCE || !isRun(args.mirror_run)) return null
  return { mirrorRun: args.mirror_run }
}

/** Розбір `recording` і `recording_by_mirror_run` на телефоні: немає чи зіпсоване `recording` — undefined. */
export function parseRemoteRecording(msg: Record<string, unknown>): RemoteRecordingInfo | undefined {
  const s = msg.recording
  if (typeof s !== 'string' || !(RECORDING_STATES as readonly string[]).includes(s)) return undefined
  const run = msg.recording_by_mirror_run
  return { state: s as RemoteRecordingState, byMirrorRun: isRun(run) ? run : null }
}

/** Розбір `remote.state.recording_result`: зіпсоване поле — undefined (стан лишається валідним). */
export function parseRemoteRecordingResult(raw: unknown): RemoteRecordingResult | undefined {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return undefined
  const r = raw as Record<string, unknown>
  if (!isRun(r.mirror_run)) return undefined
  if (r.cmd !== 'start' && r.cmd !== 'stop') return undefined
  const statuses = r.cmd === 'start' ? START_STATUSES : STOP_STATUSES
  if (typeof r.status !== 'string' || !statuses.includes(r.status)) return undefined
  if (r.status === 'rejected') {
    if (!isRecordingRefusalReason(r.reason)) return undefined
    return { mirror_run: r.mirror_run, cmd: r.cmd, status: 'rejected', reason: r.reason }
  }
  if (r.reason !== undefined) return undefined
  return { mirror_run: r.mirror_run, cmd: r.cmd, status: r.status } as RemoteRecordingResult
}
