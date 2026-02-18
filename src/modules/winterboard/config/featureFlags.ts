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
  // 1. URL param override (also persists to localStorage)
  const urlParam = getUrlParam(URL_PARAM_WB)
  if (urlParam !== null) {
    const enabled = urlParam === 'true' || urlParam === '1'
    setLocalStorage(LS_KEY_WB, String(enabled))
    return enabled
  }

  // 2. localStorage override
  const lsValue = getLocalStorage(LS_KEY_WB)
  if (lsValue !== null) {
    return lsValue === 'true'
  }

  // 3. Env variable
  const envValue = getEnvVar('VITE_WB_ENABLED')
  if (envValue !== undefined) {
    return envValue === 'true'
  }

  // 4. Default: disabled
  return false
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
