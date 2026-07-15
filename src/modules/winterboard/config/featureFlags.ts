// WB: Feature flags for Winterboard rollout
// Ref: TASK_BOARD_PHASES.md A7.2, LAW-14 (Rollout)
//
// Priority order (first match wins):
// 1. URL param: ?wb=true / ?wb=false
// 2. localStorage: wb_enabled=true / wb_enabled=false
// 3. Env variable: VITE_WB_ENABLED=true / VITE_WB_ENABLED=false
// 4. Default: false (disabled)
//
// Nested flag: Yjs only if WB enabled
// 1. VITE_WB_USE_YJS=true
// 2. localStorage: wb_yjs_enabled=true
// 3. Default: false

// ─── Constants ──────────────────────────────────────────────────────────────

const LS_KEY_WB = 'wb_enabled'
const LS_KEY_YJS = 'wb_yjs_enabled'
const URL_PARAM_WB = 'wb'

// ─── Helpers ────────────────────────────────────────────────────────────────

function getUrlParam(key: string): string | null {
  if (typeof window === 'undefined') return null
  try {
    const params = new URLSearchParams(window.location.search)
    return params.get(key)
  } catch {
    return null
  }
}

function getLocalStorage(key: string): string | null {
  if (typeof window === 'undefined') return null
  try {
    return window.localStorage.getItem(key)
  } catch {
    return null
  }
}

function setLocalStorage(key: string, value: string): void {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(key, value)
  } catch {
    // localStorage unavailable (private browsing, quota)
  }
}

function getEnvVar(key: string): string | undefined {
  try {
    return (import.meta.env as Record<string, string | undefined>)?.[key]
  } catch {
    return undefined
  }
}

// ─── Winterboard Master Switch ──────────────────────────────────────────────

/**
 * Check if Winterboard is enabled.
 * Checks URL param → localStorage → env var → default false.
 *
 * URL param also persists to localStorage for session continuity.
 */
export function isWinterboardEnabled(): boolean {
  // Winterboard v4 is now GA — always enabled.
  // Legacy flag logic removed. Yjs sub-flag still gated separately.
  return true
}

// ─── Yjs Collaboration Flag ─────────────────────────────────────────────────

/**
 * Check if Yjs collaboration is enabled.
 * Requires WB to be enabled first (nested flag).
 */
export function isWinterboardYjsEnabled(): boolean {
  if (!isWinterboardEnabled()) return false

  // 1. localStorage override
  const lsValue = getLocalStorage(LS_KEY_YJS)
  if (lsValue !== null) {
    return lsValue === 'true'
  }

  // 2. Env variable
  const envValue = getEnvVar('VITE_WB_USE_YJS')
  if (envValue !== undefined) {
    return envValue === 'true'
  }

  // 3. Default: disabled
  return false
}

// ─── Manual overrides (for dev tools / admin panel) ─────────────────────────

/**
 * Enable/disable Winterboard manually (persists to localStorage).
 */
export function setWinterboardEnabled(enabled: boolean): void {
  setLocalStorage(LS_KEY_WB, String(enabled))
}

/**
 * Enable/disable Yjs manually (persists to localStorage).
 */
export function setWinterboardYjsEnabled(enabled: boolean): void {
  setLocalStorage(LS_KEY_YJS, String(enabled))
}

/**
 * Clear all WB feature flag overrides.
 */
export function clearWinterboardOverrides(): void {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.removeItem(LS_KEY_WB)
    window.localStorage.removeItem(LS_KEY_YJS)
  } catch {
    // ignore
  }
}

// ─── Lesson Constructor Flag ─────────────────────────────────────────────────
// Dev-only за замовчуванням (default: false).
// Щоб увімкнути локально: VITE_LESSON_CONSTRUCTOR_ENABLED=true у .env.local
// або localStorage.setItem('lc_enabled', 'true') у DevTools.

const LS_KEY_LC = 'lc_enabled'

/**
 * Перевірити чи Lesson Constructor увімкнено.
 *
 * Priority (перша умова перемагає):
 * 1. localStorage: lc_enabled=true/false  (QA / manual dev override)
 * 2. Env variable: VITE_LESSON_CONSTRUCTOR_ENABLED=true/false
 * 3. Default: false (прихований у prod)
 */
export function isLessonConstructorEnabled(): boolean {
  // 1. localStorage override
  const lsValue = getLocalStorage(LS_KEY_LC)
  if (lsValue !== null) {
    return lsValue === 'true'
  }

  // 2. Env variable
  const envValue = getEnvVar('VITE_LESSON_CONSTRUCTOR_ENABLED')
  if (envValue !== undefined) {
    return envValue === 'true'
  }

  // 3. Default: disabled
  return false
}

// ─── Unified Overlay Render Flag (Z_ORDER_UNIFIED_PLAN v4.0, PR1) ─────────────
// Перемикає WBCanvas overlay-рендер з 13 per-type блоків (групує за типом →
// cross-type z-order баг) на один ordered WBOverlayLayer (render order = assets[]
// order). OFF default → 0 змін на проді (v-else = старі блоки 1:1).
//
// Priority (перша умова перемагає):
// 1. localStorage: wb_unified_zorder=true/false  (QA / manual dev override)
// 2. Env variable: VITE_UNIFIED_ZORDER=true/false  (prod canary build-time)
// 3. Default: false (OFF)

const LS_KEY_UNIFIED_ZORDER = 'wb_unified_zorder'

/**
 * Перевірити чи увімкнено unified overlay render (single ordered v-for).
 */
export function isUnifiedOverlayRenderEnabled(): boolean {
  // 1. localStorage override
  const lsValue = getLocalStorage(LS_KEY_UNIFIED_ZORDER)
  if (lsValue !== null) {
    return lsValue === 'true'
  }

  // 2. Env variable
  const envValue = getEnvVar('VITE_UNIFIED_ZORDER')
  if (envValue !== undefined) {
    return envValue === 'true'
  }

  // 3. Default: disabled
  return false
}

/**
 * Увімкнути/вимкнути unified overlay render вручну (persists to localStorage).
 */
export function setUnifiedOverlayRenderEnabled(enabled: boolean): void {
  setLocalStorage(LS_KEY_UNIFIED_ZORDER, String(enabled))
}

// ─── Local Workspace Flag (ТЗ LOCAL_WORKSPACE 2026-07-15) ────────────────────
// Локальний робочий стіл без авторизації (route /workspace): дошка живе у
// браузері (localStorage), бекенд не викликається. Dev-ON / prod-OFF до
// окремого рішення власника про rollout.
//
// Priority (перша умова перемагає):
// 1. localStorage: local_ws_enabled=true/false  (QA / manual dev override)
// 2. Env variable: VITE_LOCAL_WORKSPACE=true/false
// 3. Default: false (прихований у prod)

const LS_KEY_LOCAL_WS = 'local_ws_enabled'

/**
 * Перевірити чи Local Workspace увімкнено.
 */
export function isLocalWorkspaceEnabled(): boolean {
  // 1. localStorage override
  const lsValue = getLocalStorage(LS_KEY_LOCAL_WS)
  if (lsValue !== null) {
    return lsValue === 'true'
  }

  // 2. Env variable
  const envValue = getEnvVar('VITE_LOCAL_WORKSPACE')
  if (envValue !== undefined) {
    return envValue === 'true'
  }

  // 3. Default: disabled
  return false
}

/**
 * Увімкнути/вимкнути Local Workspace вручну (persists to localStorage).
 */
export function setLocalWorkspaceEnabled(enabled: boolean): void {
  setLocalStorage(LS_KEY_LOCAL_WS, String(enabled))
}
