/**
 * Canonical Origin — SSOT for frontend origin URL.
 *
 * Problem: when a user registers on a preview/staging domain
 * (e.g. saas-frontend-4ei.pages.dev), `window.location.origin`
 * leaks that domain into email verification links. The user then
 * clicks the link and lands on the wrong domain permanently.
 *
 * Solution: always use the canonical origin from env variable,
 * falling back to window.location.origin only in dev mode.
 */

const CANONICAL = import.meta.env.VITE_APP_ORIGIN as string | undefined

/**
 * Returns the canonical frontend origin (e.g. "https://m4sh.org").
 * In production, always returns VITE_APP_ORIGIN to prevent
 * preview/staging domains from leaking into emails.
 * In dev mode, falls back to window.location.origin.
 */
export function getCanonicalOrigin(): string {
  if (CANONICAL) {
    return CANONICAL.replace(/\/+$/, '')
  }

  // Dev fallback — safe because dev emails go to test accounts
  if (import.meta.env.DEV) {
    return typeof window !== 'undefined' ? window.location.origin : ''
  }

  // Production without VITE_APP_ORIGIN — log warning, use location
  if (typeof window !== 'undefined') {
    console.warn(
      '[canonicalOrigin] VITE_APP_ORIGIN is not set in production. ' +
      'Email verification links will use the current domain, which may be incorrect.'
    )
    return window.location.origin
  }

  return ''
}
