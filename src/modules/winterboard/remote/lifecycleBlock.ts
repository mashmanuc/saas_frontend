// Lifecycle-409 (INV-23, SSOT §23.12): сервер відхилив запис на дошку, бо
// сесія архівована / запис фіналізований / запис на паузі. Taxonomy B — НЕ DESYNC.
//
// 2026-09-03, борг із живого уроку власника: на дошці з фіналізованим записом
// усе, що пишеться, мовчки відкидалось — тост миготів раз із хибним «перейдіть
// у нову дошку» (правильна дія — «Новий запис», re-record полагоджено ще
// 2026-05-04). Тепер: чесний тост + подія `wb:lifecycle-blocked`, на яку
// кімнати відповідають постійним банером і read-only полотном.

import { notifyWarning, notifyError } from '@/utils/notify'

export type LifecycleBlockCode = 'SESSION_ARCHIVED' | 'REPLAY_FROZEN_NO_WRITE' | 'PAUSED_RECORDING_READ_ONLY'

export interface LifecycleBlockDetail {
  code: LifecycleBlockCode
  recordingState: string | null
  sessionId: string | null
}

export const LIFECYCLE_BLOCK_EVENT = 'wb:lifecycle-blocked'

/** Текст тоста за кодом — узгоджено з SSOT §23.12 («…OR trigger re-record flow»). */
export function lifecycleBlockMessage(code: LifecycleBlockCode): string {
  switch (code) {
    case 'SESSION_ARCHIVED':
      return 'Сесію архівовано — створіть нову дошку'
    case 'REPLAY_FROZEN_NO_WRITE':
      return 'Запис уроку завершено — на цій дошці нічого не зберігається. Натисніть «Новий запис», щоб писати далі'
    case 'PAUSED_RECORDING_READ_ONLY':
      return 'Запис на паузі — продовжте запис перед малюванням'
  }
}

/**
 * Тост + подія для кімнати. Викликається recorder-ом рівно раз на відхилений
 * flush; ніколи не кидає (телеметрія/UI не мають права зламати запис).
 */
export function announceLifecycleBlock(detail: LifecycleBlockDetail): void {
  try {
    const msg = lifecycleBlockMessage(detail.code)
    if (detail.code === 'SESSION_ARCHIVED') notifyError(msg)
    else notifyWarning(msg)
  } catch { /* noop */ }
  try {
    window.dispatchEvent(new CustomEvent<LifecycleBlockDetail>(LIFECYCLE_BLOCK_EVENT, { detail }))
  } catch { /* noop */ }
}
