/**
 * Build a WebSocket URL for a given path.
 *
 * Uses VITE_WS_URL env variable (set in .env.production) to derive the
 * backend host. Falls back to window.location for local dev.
 *
 * @param path - WebSocket path, e.g. "/ws/calendar/"
 */
export function buildWsUrl(path: string): string {
  const envWsUrl = (import.meta as any).env?.VITE_WS_URL as string | undefined

  if (envWsUrl && (envWsUrl.startsWith('ws://') || envWsUrl.startsWith('wss://'))) {
    // Extract origin from VITE_WS_URL (e.g. "wss://host.fly.dev/ws/gateway/" -> "wss://host.fly.dev")
    try {
      const parsed = new URL(envWsUrl.replace(/^ws/, 'http'))
      const scheme = envWsUrl.startsWith('wss') ? 'wss:' : 'ws:'
      return `${scheme}//${parsed.host}${path}`
    } catch {
      // fall through to origin-based fallback
    }
  }

  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
  const host = window.location.host
  return `${protocol}//${host}${path}`
}
