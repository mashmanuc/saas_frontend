/**
 * Phase 29: WebSocket → TanStack Query invalidation bridge
 *
 * Subscribes to realtime WS events and invalidates relevant query caches.
 * This ensures that when backend emits an event (e.g., relation accepted by other party),
 * the query cache is invalidated and data is refetched automatically.
 *
 * INV-4: WS events do NOT update store directly for Query-managed data.
 *        WS → bridge → invalidateQueries() → Query refetch
 *
 * Supported event types (from Agent C):
 * - relation.updated  → invalidate relations, limits, user-context
 * - relation.created  → invalidate relations, limits
 * - limits.changed    → invalidate limits, user-context
 * - billing.updated   → invalidate billing, user-context
 * - inquiry.updated   → invalidate inquiries
 * - inquiry.created   → invalidate inquiries
 * - dashboard.changed → invalidate student-dashboard, tutor-dashboard
 */
import type { QueryClient } from '@tanstack/vue-query'
import { queryKeys } from '@/api/queryKeys'
import { realtimeService } from '@/services/realtime'

interface BridgeOptions {
  queryClient: QueryClient
  logger?: Pick<Console, 'debug'>
}

const EVENT_INVALIDATION_MAP: Record<string, readonly (readonly string[])[]> = {
  'relation.updated': [
    queryKeys.relations(),
    queryKeys.limits(),
    queryKeys.userContext(),
  ],
  'relation.created': [
    queryKeys.relations(),
    queryKeys.limits(),
  ],
  'limits.changed': [
    queryKeys.limits(),
    queryKeys.userContext(),
  ],
  'billing.updated': [
    queryKeys.billing(),
    queryKeys.userContext(),
  ],
  'inquiry.updated': [
    queryKeys.inquiries(),
  ],
  'inquiry.created': [
    queryKeys.inquiries(),
  ],
  'dashboard.changed': [
    queryKeys.studentDashboard(),
    queryKeys.tutorDashboard(),
  ],
}

let _unsubscribers: (() => void)[] = []

export function setupQueryBridge({ queryClient, logger }: BridgeOptions): void {
  // Cleanup previous subscriptions (HMR safety)
  teardownQueryBridge()

  const isDev = import.meta.env.DEV

  const handleEvent = (data: any) => {
    const eventType = data?.type || data?.event
    if (!eventType) return

    const keysToInvalidate = EVENT_INVALIDATION_MAP[eventType]
    if (!keysToInvalidate) return

    if (isDev) {
      const debugLogger = logger || console
      debugLogger.debug(
        `[QueryBridge] ${eventType} → invalidating:`,
        keysToInvalidate.map(k => k.join('/'))
      )
    }

    for (const queryKey of keysToInvalidate) {
      queryClient.invalidateQueries({ queryKey: queryKey as string[] })
    }
  }

  // Subscribe to relevant channels where Agent C will emit domain events
  const channels = ['notifications', 'tutor', 'student', 'inquiries'] as const

  for (const channel of channels) {
    try {
      const unsub = realtimeService.subscribe(channel, handleEvent)
      _unsubscribers.push(unsub)
    } catch (err) {
      // Channel might not be active yet — that's OK
      if (isDev) {
        console.debug(`[QueryBridge] Skip channel "${channel}":`, (err as Error).message)
      }
    }
  }
}

export function teardownQueryBridge(): void {
  for (const unsub of _unsubscribers) {
    try { unsub() } catch { /* noop */ }
  }
  _unsubscribers = []
}

export { EVENT_INVALIDATION_MAP }
