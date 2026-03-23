/**
 * Phase 30: WS Event Tracker — sliding window event counter
 *
 * Uses Approach A: subscribes to the same WS channels as queryBridge
 * via realtimeService.subscribe() (INV-1: read-only, does NOT modify queryBridge).
 *
 * Tracks events in a 5s sliding window for storm detection.
 * Grace period: ignores initial burst after WS connect (first 5s).
 */
import { realtimeService } from '@/services/realtime'

const WINDOW_MS = 5_000
const GRACE_PERIOD_MS = 5_000
let _events: number[] = []
let _totalEvents = 0
let _unsubscribers: (() => void)[] = []
let _attached = false
let _attachedAt = 0

export function recordWsEvent(): void {
  // Ignore initial burst after WS connect (subscribe confirmations, buffered events)
  if (Date.now() - _attachedAt < GRACE_PERIOD_MS) return
  _events.push(Date.now())
  _totalEvents++
}

export function getWsStats() {
  const cutoff = Date.now() - WINDOW_MS
  _events = _events.filter(t => t >= cutoff)
  return {
    eventsInWindow: _events.length,
    totalEvents: _totalEvents,
  }
}

export function resetWsStats(): void {
  _events = []
  _totalEvents = 0
}

export function attachWsTracker(): void {
  if (_attached) return
  _attached = true
  _attachedAt = Date.now()
  teardownWsTracker()

  const channels = ['notifications', 'tutor', 'student', 'inquiries'] as const
  for (const channel of channels) {
    try {
      const unsub = realtimeService.subscribe(channel, () => {
        recordWsEvent()
      })
      _unsubscribers.push(unsub)
    } catch {
      // Channel not active — OK
    }
  }
}

export function teardownWsTracker(): void {
  _unsubscribers.forEach(fn => { try { fn() } catch { /* noop */ } })
  _unsubscribers = []
  _attached = false
}
