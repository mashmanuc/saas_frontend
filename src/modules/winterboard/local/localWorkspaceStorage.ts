// Local Workspace v1 — персистентність локального робочого столу (ТЗ 2026-07-15).
//
// У local-режимі весь життєвий цикл даних проходить у браузері: жодних REST/WS.
// Ізоляція від бекенду досягається НЕ блокуванням запитів, а тим, що write-шлях
// фізично не під'єднується (opsSync.bootstrap() і replayRecorder.connectToStore()
// не викликаються — див. WBSoloRoom local-гілку). Цей модуль відповідає лише за
// збереження/відновлення стану дошки у сховищі браузера.
//
// Storage-адаптер — свідома абстракція (рішення власника, Точка 2 ТЗ):
// v1 = localStorage (вистачає для векторних штрихів/об'єктів, важкі медіа
// закриті хмарним замком); v2 = IndexedDB підміною адаптера без зміни callsites.

import type { WBWorkspaceState } from '../types/winterboard'

export const LOCAL_WORKSPACE_STATE_KEY = 'm4sh:local-ws:v1'
export const LOCAL_WORKSPACE_SEEDED_KEY = 'm4sh:local-ws:seeded'
export const LOCAL_WORKSPACE_SEED_VERSION_KEY = 'm4sh:local-ws:seed-version'

export interface LocalWorkspaceSnapshot {
  version: 1
  savedAt: number
  name: string
  state: WBWorkspaceState
}

export interface LocalWorkspaceStorageAdapter {
  read(key: string): string | null
  /** @returns false якщо запис не вдався (quota / private mode) — caller показує статус помилки */
  write(key: string, value: string): boolean
  remove(key: string): void
}

const localStorageAdapter: LocalWorkspaceStorageAdapter = {
  read(key: string): string | null {
    if (typeof window === 'undefined') return null
    try {
      return window.localStorage.getItem(key)
    } catch {
      return null
    }
  },
  write(key: string, value: string): boolean {
    if (typeof window === 'undefined') return false
    try {
      window.localStorage.setItem(key, value)
      return true
    } catch (e) {
      console.warn('[LocalWS] storage write failed (quota / private mode?):', e)
      return false
    }
  },
  remove(key: string): void {
    if (typeof window === 'undefined') return
    try {
      window.localStorage.removeItem(key)
    } catch {
      // storage unavailable
    }
  },
}

let _adapter: LocalWorkspaceStorageAdapter = localStorageAdapter

/** Test-only / v2 IndexedDB: підмінити storage-адаптер. */
export function _setLocalWorkspaceStorageAdapter(adapter: LocalWorkspaceStorageAdapter): void {
  _adapter = adapter
}

// ─── Snapshot API ────────────────────────────────────────────────────────────

export function loadLocalWorkspace(): LocalWorkspaceSnapshot | null {
  const raw = _adapter.read(LOCAL_WORKSPACE_STATE_KEY)
  if (!raw) return null
  try {
    const parsed = JSON.parse(raw) as LocalWorkspaceSnapshot
    if (parsed?.version !== 1) return null
    if (!parsed.state || !Array.isArray(parsed.state.pages)) return null
    return parsed
  } catch (e) {
    console.warn('[LocalWS] corrupted snapshot, ignoring:', e)
    return null
  }
}

export function saveLocalWorkspace(name: string, state: WBWorkspaceState): boolean {
  const snapshot: LocalWorkspaceSnapshot = {
    version: 1,
    savedAt: Date.now(),
    name,
    state,
  }
  try {
    return _adapter.write(LOCAL_WORKSPACE_STATE_KEY, JSON.stringify(snapshot))
  } catch (e) {
    // JSON.stringify може впасти на circular refs — не має статись для
    // serializedState, але падіння персистентності не повинно ламати дошку.
    console.warn('[LocalWS] snapshot serialization failed:', e)
    return false
  }
}

export function hasLocalWorkspace(): boolean {
  return _adapter.read(LOCAL_WORKSPACE_STATE_KEY) !== null
}

export function clearLocalWorkspace(): void {
  _adapter.remove(LOCAL_WORKSPACE_STATE_KEY)
}

// ─── Handoff buffer (ТЗ §5 — безшовне перенесення у хмару) ───────────────────
// Життєвий цикл: [Підключити хмару] → stash → реєстрація/логін → /workspace
// (authed) → імпорт у хмарну сесію → clear ЛИШЕ після підтвердженого успіху.
// Retry-safe: ops (з op_id) і cloudSessionId персистяться у буфер при першій
// спробі — повторний імпорт шле ТІ САМІ op_id, дублікати гасить BE
// (INV-IDEMPOTENCY: UNIQUE(session_id, op_id)), сесія вдруге не створюється.

export const LOCAL_WORKSPACE_HANDOFF_KEY = 'm4sh:local-ws:handoff'

/** Форма = OpsSyncOp (opsSyncStore) — дублюємо структурно, без імпорту стора. */
export interface LocalHandoffOp {
  op_id: string
  op_type: string
  page_id?: string
  payload: Record<string, unknown>
}

export interface LocalWorkspaceHandoff {
  version: 1
  savedAt: number
  name: string
  state: WBWorkspaceState
  /** Згенеровані ops (заповнюється при першій спробі імпорту). */
  ops?: LocalHandoffOp[]
  /** Створена хмарна сесія (заповнюється при першій спробі імпорту). */
  cloudSessionId?: string
}

export function stashHandoff(name: string, state: WBWorkspaceState): boolean {
  const buffer: LocalWorkspaceHandoff = {
    version: 1,
    savedAt: Date.now(),
    name,
    state,
  }
  try {
    return _adapter.write(LOCAL_WORKSPACE_HANDOFF_KEY, JSON.stringify(buffer))
  } catch (e) {
    console.warn('[LocalWS] handoff stash failed:', e)
    return false
  }
}

export function loadHandoff(): LocalWorkspaceHandoff | null {
  const raw = _adapter.read(LOCAL_WORKSPACE_HANDOFF_KEY)
  if (!raw) return null
  try {
    const parsed = JSON.parse(raw) as LocalWorkspaceHandoff
    if (parsed?.version !== 1) return null
    if (!parsed.state || !Array.isArray(parsed.state.pages)) return null
    return parsed
  } catch (e) {
    console.warn('[LocalWS] corrupted handoff buffer, ignoring:', e)
    return null
  }
}

/** Дозаписати ops/cloudSessionId у буфер (retry-safe checkpoint). */
export function updateHandoff(patch: Partial<Pick<LocalWorkspaceHandoff, 'ops' | 'cloudSessionId'>>): void {
  const current = loadHandoff()
  if (!current) return
  try {
    _adapter.write(LOCAL_WORKSPACE_HANDOFF_KEY, JSON.stringify({ ...current, ...patch }))
  } catch (e) {
    console.warn('[LocalWS] handoff update failed:', e)
  }
}

export function clearHandoff(): void {
  _adapter.remove(LOCAL_WORKSPACE_HANDOFF_KEY)
}

// ─── First-visit seed flag («подарунок», ТЗ §3) ──────────────────────────────

export function isLocalWorkspaceSeeded(): boolean {
  return _adapter.read(LOCAL_WORKSPACE_SEEDED_KEY) === '1'
}

/**
 * Версія «подарунка», яку бачив цей браузер.
 *   0 — не бачив нічого (перший візит);
 *   1 — legacy: заходив ДО версіонування (був лише boolean-флаг).
 * Дозволяє оновити вітрину при bump LOCAL_SEED_VERSION.
 */
export function getLocalWorkspaceSeedVersion(): number {
  const raw = _adapter.read(LOCAL_WORKSPACE_SEED_VERSION_KEY)
  if (raw !== null) {
    const parsed = Number(raw)
    if (Number.isFinite(parsed) && parsed > 0) return parsed
  }
  return isLocalWorkspaceSeeded() ? 1 : 0
}

export function markLocalWorkspaceSeeded(version = 1): void {
  // Boolean-ключ лишаємо для зворотної сумісності (старі збірки читають його).
  _adapter.write(LOCAL_WORKSPACE_SEEDED_KEY, '1')
  _adapter.write(LOCAL_WORKSPACE_SEED_VERSION_KEY, String(version))
}

// ─── Throttled saver ─────────────────────────────────────────────────────────
// Trailing-throttle персистентності: серія мутацій → один запис за вікно.
// Це перформанс-патерн збереження, НЕ debounce-fix логіки (LAW §12 не стосується:
// local-режим не створює ops і не взаємодіє з ops-протоколом).

export interface ThrottledSaver {
  /** Запланувати збереження (trailing edge вікна). */
  schedule(): void
  /** Негайно зберегти, якщо є запланований запис (unload/visibility/unmount). */
  flush(): void
  /** Скасувати заплановане без збереження. */
  cancel(): void
}

export function createThrottledSaver(saveFn: () => void, intervalMs = 800): ThrottledSaver {
  let timer: ReturnType<typeof setTimeout> | null = null
  let dirty = false

  function run(): void {
    timer = null
    if (!dirty) return
    dirty = false
    saveFn()
  }

  return {
    schedule(): void {
      dirty = true
      if (timer === null) {
        timer = setTimeout(run, intervalMs)
      }
    },
    flush(): void {
      if (timer !== null) {
        clearTimeout(timer)
        timer = null
      }
      if (dirty) {
        dirty = false
        saveFn()
      }
    },
    cancel(): void {
      if (timer !== null) {
        clearTimeout(timer)
        timer = null
      }
      dirty = false
    },
  }
}
