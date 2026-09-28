// Бар'єр артефакту (LAW §4–§5 «Остаточні відмови»; ТЗ TZ_SAVE_FROM_LIVE_LESSON_AS_TEMPLATE §2):
// урок, шаблон, публікація, запрошення учня й старт запису будуються сервером з ПРИЙНЯТИХ ops.
// Причина відмови — або null, коли всі дії на сервері й синхронізація в SYNC.
//
// 2026-09-28: раніше бар'єр дивився лише на SAVE_BLOCKED і чергу. У DESYNC `record()` —
// no-op, черга порожня, тож артефакт будувався без дій цієї вкладки; PAUSED/BOOTSTRAP теж
// проходили. Виняток `flushAll()` — сам по собі відмова, а не «лог і далі».

import type { OpsSyncMode } from '../stores/opsSyncStore'

export type ArtifactBarrierReason =
  | 'unconfirmed' // flushAll() кинув: не знаємо, що дійшло
  | 'save_blocked'
  | 'desync'
  | 'bootstrap'
  | 'paused'
  | 'queue' // черга не порожня
  | 'offline'

export interface ArtifactBarrierInput {
  flushFailed: boolean
  mode: OpsSyncMode
  pendingCount: number
  online: boolean
}

export function artifactBarrierReason(s: ArtifactBarrierInput): ArtifactBarrierReason | null {
  if (s.mode === 'SAVE_BLOCKED') return 'save_blocked'
  if (s.mode === 'DESYNC') return 'desync'
  if (s.mode === 'BOOTSTRAP') return 'bootstrap'
  if (s.mode === 'PAUSED') return 'paused'
  if (s.flushFailed) return 'unconfirmed'
  if (s.pendingCount > 0) return 'queue'
  if (!s.online) return 'offline'
  return null
}
