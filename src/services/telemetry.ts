export interface TelemetryEvent {
  name: string
  properties?: Record<string, any>
  timestamp: number
  userId?: string
  sessionId?: string
}

export interface TelemetryConfig {
  enabled: boolean
  endpoint?: string
  batchSize?: number
  flushInterval?: number
}

class TelemetryService {
  private config: TelemetryConfig
  private eventQueue: TelemetryEvent[] = []
  private flushTimer: number | null = null
  private sessionId: string

  constructor(config: TelemetryConfig = { enabled: true }) {
    this.config = {
      batchSize: 10,
      flushInterval: 5000, // 5 seconds
      ...config
    }
    this.sessionId = this.generateSessionId()
    
    if (this.config.enabled && this.config.flushInterval) {
      this.startFlushTimer()
    }
  }

  private generateSessionId(): string {
    return `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
  }

  private startFlushTimer() {
    if (this.flushTimer) {
      clearInterval(this.flushTimer)
    }
    
    this.flushTimer = window.setInterval(() => {
      this.flush()
    }, this.config.flushInterval!)
  }

  logEvent(name: string, properties?: Record<string, any>) {
    if (!this.config.enabled) {
      return
    }

    const event: TelemetryEvent = {
      name,
      properties,
      timestamp: Date.now(),
      sessionId: this.sessionId
    }

    this.eventQueue.push(event)

    // Auto-flush if batch size reached
    if (this.eventQueue.length >= (this.config.batchSize || 10)) {
      this.flush()
    }
  }

  async flush() {
    if (this.eventQueue.length === 0) {
      return
    }

    const events = [...this.eventQueue]
    this.eventQueue = []

    try {
      if (this.config.endpoint) {
        await fetch(this.config.endpoint, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ events })
        })
      } else {
        // Log to console in development
        console.log('[Telemetry]', events)
      }
    } catch (error) {
      console.error('[Telemetry] Failed to send events:', error)
      // Re-queue events on failure
      this.eventQueue.unshift(...events)
    }
  }

  destroy() {
    if (this.flushTimer) {
      clearInterval(this.flushTimer)
    }
    this.flush()
  }
}

// Singleton instance
let telemetryInstance: TelemetryService | null = null

export function initTelemetry(config?: TelemetryConfig) {
  telemetryInstance = new TelemetryService(config)
  return telemetryInstance
}

export function getTelemetry(): TelemetryService {
  if (!telemetryInstance) {
    telemetryInstance = new TelemetryService()
  }
  return telemetryInstance
}

export function logTelemetryEvent(name: string, properties?: Record<string, any>) {
  getTelemetry().logEvent(name, properties)
}

// Slot editing specific telemetry helpers
export function logSlotEditStart(slotId: string, strategy: string) {
  logTelemetryEvent('slot.edit.start', {
    slotId,
    strategy
  })
}

export function logSlotEditSuccess(slotId: string, strategy: string, duration: number, hasConflicts: boolean) {
  logTelemetryEvent('slot.edit.success', {
    slotId,
    strategy,
    duration,
    hasConflicts
  })
}

export function logSlotEditError(slotId: string, strategy: string, duration: number, error: string) {
  logTelemetryEvent('slot.edit.error', {
    slotId,
    strategy,
    duration,
    error
  })
}

export function logSlotBatchEditStart(slotCount: number, strategy: string) {
  logTelemetryEvent('slot.batch_edit.start', {
    slotCount,
    strategy
  })
}

export function logSlotBatchEditSuccess(slotCount: number, strategy: string, duration: number, updatedCount: number, conflictCount: number) {
  logTelemetryEvent('slot.batch_edit.success', {
    slotCount,
    strategy,
    duration,
    updatedCount,
    conflictCount
  })
}

export function logSlotBatchEditError(slotCount: number, strategy: string, duration: number, error: string) {
  logTelemetryEvent('slot.batch_edit.error', {
    slotCount,
    strategy,
    duration,
    error
  })
}

export function logSlotDelete(slotId: number) {
  logTelemetryEvent('slot.delete', {
    slotId
  })
}

export function logSlotConflictDetected(slotId: string, conflictType: string, severity: string) {
  logTelemetryEvent('slot.conflict.detected', {
    slotId,
    conflictType,
    severity
  })
}

export function logSlotUndo() {
  logTelemetryEvent('slot.undo')
}

export function logSlotRedo() {
  logTelemetryEvent('slot.redo')
}

// Legacy export for backward compatibility
export const telemetry = {
  trigger(action: string, metadata: Record<string, any> = {}) {
    logTelemetryEvent(action, metadata)
  }
}
