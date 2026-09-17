/**
 * Коридори Інтегралика — ОДИН стан предмета й мови матеріалу для палітри й пульта.
 *
 * ТЗ: saas_docs/plans/north_ship/TZ_INTEGRALYK_SUBJECT_CORRIDORS_FOUNDATION_2026-09-17.md §4.
 *
 * • Реєстр (список предметів і мов) приходить із сервера — палітра й пульт
 *   читають той самий список (kill-проби 10 і 13).
 * • «Авто» — за замовчуванням; lock — метадані дошки на сервері (переживає reload).
 * • Інша дошка нічого не успадковує: при зміні дошки стан скидається до «Авто».
 * • Пульт не пише: його намір приходить сюди (`source: 'explicit_remote'`) і
 *   записується тим самим REST, що й клік у палітрі (LAW §9 v1.6).
 * • DESYNC/PAUSED: вибір не записуємо, кажемо чому (ТЗ §9.8, LAW §12 — без retry).
 * • Мова матеріалу НЕ змінює профіль прав і НЕ вмикає англійський провідник:
 *   тут немає жодного звернення до locale/EN_GUIDE (kill-проба 11).
 */
import { reactive } from 'vue'
import * as defaultApi from './corridorApi'

export const AUTO = 'auto'

function statusOf(err) {
  return err?.response?.status ?? err?.status ?? null
}

function autoSubject() {
  return { mode: AUTO, resolved: 'general', locked: null, source: 'fallback' }
}

function autoLanguage(fallback = 'uk') {
  return { mode: AUTO, content: fallback, locked: null, source: 'ui_fallback' }
}

export function createAssistantCorridor(api = defaultApi) {
  const state = reactive({
    enabled: false,          // rollout-гейт: реєстр відповів 200
    registryLoaded: false,
    registry: null,          // {subjects:[{id,labels}], lockable_subjects:[], languages:[{id,labels}]}
    boardId: null,
    subject: autoSubject(),
    language: autoLanguage(),
    readonly: false,
    busy: false,
    error: '',
  })

  async function ensureRegistry(locale = 'uk') {
    if (state.registryLoaded) return state.enabled
    try {
      const reg = await api.fetchCorridorRegistry(locale)
      state.registry = reg
      state.enabled = !!reg?.enabled
    } catch (e) {
      state.enabled = false          // 404 — гейт вимкнений; інше — теж без селектора
      if (statusOf(e) !== 404) state.error = 'corridorUnavailable'
    }
    state.registryLoaded = true
    return state.enabled
  }

  function applyLocks(ctx) {
    const subj = ctx?.subject
    const lang = ctx?.content_language
    if (subj?.value) {
      state.subject = { mode: 'locked', resolved: subj.value, locked: subj.value, source: subj.source }
    } else if (state.subject.mode === 'locked') {
      state.subject = autoSubject()
    }
    if (lang?.value) {
      state.language = { mode: 'locked', content: lang.value, locked: lang.value, source: lang.source }
    } else if (state.language.mode === 'locked') {
      state.language = autoLanguage(state.language.content)
    }
  }

  /** Рішення сервера (відповідь parse або resolve) → стан селектора. */
  function applyCorridor(corridor) {
    if (!corridor || typeof corridor !== 'object') return
    const s = corridor.subject
    if (s && typeof s.resolved_subject === 'string') {
      state.subject = {
        mode: s.mode === 'locked' ? 'locked' : AUTO,
        resolved: s.resolved_subject,
        locked: s.locked_subject ?? null,
        source: s.source || 'fallback',
      }
    }
    const l = corridor.language
    if (l && typeof l.content_language === 'string') {
      state.language = {
        mode: l.content_mode === 'locked' ? 'locked' : AUTO,
        content: l.content_language,
        locked: l.content_mode === 'locked' ? l.content_language : null,
        source: l.content_source || 'ui_fallback',
      }
    }
  }

  /** Вхід на дошку або reload. Інша дошка — стан «Авто» з нуля. */
  async function loadBoard(boardId, { boardSummary = null, conversationId = null, locale = 'uk' } = {}) {
    if (boardId !== state.boardId) {
      state.boardId = boardId || null
      state.subject = autoSubject()
      state.language = autoLanguage(locale === 'en' ? 'en' : 'uk')
      state.readonly = false
      state.error = ''
    }
    if (!boardId || !(await ensureRegistry(locale))) return
    try {
      const ctx = await api.getAssistantContext(boardId)
      if (state.boardId !== boardId) return          // поки чекали — дошку змінили
      state.readonly = !!ctx?.readonly
      applyLocks(ctx?.assistant_context)
    } catch (e) {
      if (statusOf(e) !== 404) state.error = 'corridorUnavailable'
    }
    try {
      const resolved = await api.resolveCorridor({ boardId, boardSummary, conversationId, locale })
      if (state.boardId !== boardId) return
      applyCorridor(resolved)
    } catch (e) {
      if (statusOf(e) !== 404) state.error = 'corridorUnavailable'
    }
  }

  async function write(field, value, source, { syncBlocked = false, refresh } = {}) {
    if (!state.enabled || !state.boardId) return false
    if (state.readonly) { state.error = 'corridorReadonly'; return false }
    if (syncBlocked) { state.error = 'corridorSyncBlocked'; return false }
    if (state.busy) return false
    const boardId = state.boardId
    state.busy = true
    state.error = ''
    try {
      const resp = await api.patchAssistantContext(boardId, { [field]: value, source })
      if (state.boardId !== boardId) return false
      applyLocks(resp?.assistant_context)
      if (value === AUTO && typeof refresh === 'function') await refresh()
      return true
    } catch (e) {
      const st = statusOf(e)
      state.error = st === 403 ? 'corridorReadonly' : st === 400 ? 'corridorInvalid' : 'corridorFailed'
      return false
    } finally {
      state.busy = false
    }
  }

  function setSubject(value, source = 'explicit_palette', opts = {}) {
    return write('subject', value, source, opts)
  }

  function setContentLanguage(value, source = 'explicit_palette', opts = {}) {
    return write('content_language', value, source, opts)
  }

  /** Поле `assistant` для `remote.state` (LAW §9 v1.6). null — пульту нічого показувати. */
  function remoteSnapshot() {
    if (!state.enabled || !state.boardId) return null
    return {
      subject_mode: state.subject.mode,
      subject: state.subject.resolved,
      subject_source: String(state.subject.source || 'fallback').slice(0, 24),
      language_mode: state.language.mode,
      content_language: state.language.content,
    }
  }

  return { state, ensureRegistry, loadBoard, applyCorridor, setSubject, setContentLanguage, remoteSnapshot }
}

let shared = null

/** Спільний екземпляр застосунку: палітра й обробник пульта на ноутбуці. */
export function useAssistantCorridor() {
  if (!shared) shared = createAssistantCorridor()
  return shared
}

/** Лише для тестів. */
export function _resetAssistantCorridor() {
  shared = null
}

// ── Події між пультом (winterboard) і палітрою (intent) ─────────────────────
// Рядки, а не імпорт: той самий взірець, що `m4sh:integralyk-ask` — модулі не
// тягнуть один одного. Тест звіряє імена з `useBoardRemote.ts`.
export const EVENT_COMMAND = 'm4sh:assistant-corridor-command'
export const EVENT_STATE = 'm4sh:assistant-corridor-state'
export const EVENT_STATE_REQUEST = 'm4sh:assistant-corridor-state-request'
