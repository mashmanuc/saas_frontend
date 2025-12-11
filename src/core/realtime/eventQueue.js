/**
 * Realtime Event Queue — v0.15.0
 * Черга подій з підтримкою backpressure, rate smoothing, local buffering
 */

/**
 * Default configuration
 */
const DEFAULT_CONFIG = {
  maxQueueSize: 1000,
  processIntervalMs: 16, // ~60fps
  batchSize: 50,
  backpressureThreshold: 0.8, // 80% of maxQueueSize
  rateSmoothingWindowMs: 1000,
  maxEventsPerSecond: 100,
}

/**
 * Event priority levels
 */
export const EVENT_PRIORITY = {
  CRITICAL: 0,  // Auth, errors
  HIGH: 1,      // Messages, board strokes
  NORMAL: 2,    // Presence, typing
  LOW: 3,       // Analytics, non-critical
}

/**
 * Event types for categorization
 */
export const EVENT_TYPES = {
  CHAT_MESSAGE: 'chat:message',
  CHAT_TYPING: 'chat:typing',
  CHAT_READ: 'chat:read',
  PRESENCE_UPDATE: 'presence:update',
  PRESENCE_ONLINE: 'presence:online',
  PRESENCE_OFFLINE: 'presence:offline',
  BOARD_STROKE: 'board:stroke',
  BOARD_OBJECT: 'board:object',
  BOARD_CLEAR: 'board:clear',
  NOTIFICATION: 'notification',
  SYSTEM: 'system',
}

/**
 * Get priority for event type
 */
function getEventPriority(type) {
  const priorities = {
    [EVENT_TYPES.CHAT_MESSAGE]: EVENT_PRIORITY.HIGH,
    [EVENT_TYPES.CHAT_TYPING]: EVENT_PRIORITY.NORMAL,
    [EVENT_TYPES.CHAT_READ]: EVENT_PRIORITY.LOW,
    [EVENT_TYPES.PRESENCE_UPDATE]: EVENT_PRIORITY.NORMAL,
    [EVENT_TYPES.PRESENCE_ONLINE]: EVENT_PRIORITY.NORMAL,
    [EVENT_TYPES.PRESENCE_OFFLINE]: EVENT_PRIORITY.NORMAL,
    [EVENT_TYPES.BOARD_STROKE]: EVENT_PRIORITY.HIGH,
    [EVENT_TYPES.BOARD_OBJECT]: EVENT_PRIORITY.HIGH,
    [EVENT_TYPES.BOARD_CLEAR]: EVENT_PRIORITY.CRITICAL,
    [EVENT_TYPES.NOTIFICATION]: EVENT_PRIORITY.NORMAL,
    [EVENT_TYPES.SYSTEM]: EVENT_PRIORITY.CRITICAL,
  }
  return priorities[type] ?? EVENT_PRIORITY.NORMAL
}

/**
 * Priority Queue implementation
 */
class PriorityQueue {
  constructor() {
    this.queues = new Map()
    for (const priority of Object.values(EVENT_PRIORITY)) {
      this.queues.set(priority, [])
    }
  }

  enqueue(item, priority = EVENT_PRIORITY.NORMAL) {
    const queue = this.queues.get(priority)
    if (queue) {
      queue.push(item)
    }
  }

  dequeue() {
    for (const priority of Object.values(EVENT_PRIORITY).sort((a, b) => a - b)) {
      const queue = this.queues.get(priority)
      if (queue && queue.length > 0) {
        return queue.shift()
      }
    }
    return null
  }

  dequeueBatch(count) {
    const batch = []
    for (let i = 0; i < count; i++) {
      const item = this.dequeue()
      if (item === null) break
      batch.push(item)
    }
    return batch
  }

  get size() {
    let total = 0
    for (const queue of this.queues.values()) {
      total += queue.length
    }
    return total
  }

  clear() {
    for (const queue of this.queues.values()) {
      queue.length = 0
    }
  }
}

/**
 * Rate Limiter with sliding window
 */
class RateLimiter {
  constructor(maxEvents, windowMs) {
    this.maxEvents = maxEvents
    this.windowMs = windowMs
    this.timestamps = []
  }

  canProcess() {
    this.cleanup()
    return this.timestamps.length < this.maxEvents
  }

  record() {
    this.timestamps.push(Date.now())
  }

  cleanup() {
    const cutoff = Date.now() - this.windowMs
    this.timestamps = this.timestamps.filter(t => t > cutoff)
  }

  get currentRate() {
    this.cleanup()
    return this.timestamps.length
  }
}

/**
 * Realtime Event Queue
 */
export class RealtimeEventQueue {
  constructor(config = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config }
    this.queue = new PriorityQueue()
    this.rateLimiter = new RateLimiter(
      this.config.maxEventsPerSecond,
      this.config.rateSmoothingWindowMs
    )
    this.handlers = new Map()
    this.isProcessing = false
    this.processTimer = null
    this.stats = {
      enqueued: 0,
      processed: 0,
      dropped: 0,
      backpressureEvents: 0,
    }
    this.onBackpressure = null
    this.onDrain = null
  }

  /**
   * Register handler for event type
   */
  on(eventType, handler) {
    if (!this.handlers.has(eventType)) {
      this.handlers.set(eventType, [])
    }
    this.handlers.get(eventType).push(handler)
    
    return () => {
      const handlers = this.handlers.get(eventType)
      if (handlers) {
        const index = handlers.indexOf(handler)
        if (index > -1) {
          handlers.splice(index, 1)
        }
      }
    }
  }

  /**
   * Enqueue an event
   */
  enqueue(event) {
    const { type, payload, priority: explicitPriority } = event
    const priority = explicitPriority ?? getEventPriority(type)
    
    // Check backpressure
    if (this.isBackpressured()) {
      if (priority > EVENT_PRIORITY.HIGH) {
        // Drop low priority events during backpressure
        this.stats.dropped++
        return false
      }
      this.stats.backpressureEvents++
      this.onBackpressure?.()
    }
    
    // Check queue size limit
    if (this.queue.size >= this.config.maxQueueSize) {
      this.stats.dropped++
      return false
    }
    
    this.queue.enqueue({
      type,
      payload,
      priority,
      timestamp: Date.now(),
    }, priority)
    
    this.stats.enqueued++
    
    // Start processing if not already
    if (!this.isProcessing) {
      this.startProcessing()
    }
    
    return true
  }

  /**
   * Check if queue is under backpressure
   */
  isBackpressured() {
    const threshold = this.config.maxQueueSize * this.config.backpressureThreshold
    return this.queue.size >= threshold
  }

  /**
   * Start processing queue
   */
  startProcessing() {
    if (this.isProcessing) return
    
    this.isProcessing = true
    this.processTimer = setInterval(() => {
      this.processBatch()
    }, this.config.processIntervalMs)
  }

  /**
   * Stop processing queue
   */
  stopProcessing() {
    if (this.processTimer) {
      clearInterval(this.processTimer)
      this.processTimer = null
    }
    this.isProcessing = false
  }

  /**
   * Process a batch of events
   */
  processBatch() {
    if (this.queue.size === 0) {
      this.stopProcessing()
      this.onDrain?.()
      return
    }
    
    // Rate limiting
    const availableSlots = this.config.maxEventsPerSecond - this.rateLimiter.currentRate
    const batchSize = Math.min(this.config.batchSize, availableSlots, this.queue.size)
    
    if (batchSize <= 0) return
    
    const batch = this.queue.dequeueBatch(batchSize)
    
    for (const event of batch) {
      this.processEvent(event)
      this.rateLimiter.record()
      this.stats.processed++
    }
  }

  /**
   * Process single event
   */
  processEvent(event) {
    const handlers = this.handlers.get(event.type) || []
    const wildcardHandlers = this.handlers.get('*') || []
    
    const allHandlers = [...handlers, ...wildcardHandlers]
    
    for (const handler of allHandlers) {
      try {
        handler(event.payload, event)
      } catch (error) {
        console.error('[eventQueue] handler error:', error)
      }
    }
  }

  /**
   * Flush all pending events immediately
   */
  flush() {
    while (this.queue.size > 0) {
      const event = this.queue.dequeue()
      if (event) {
        this.processEvent(event)
        this.stats.processed++
      }
    }
    this.stopProcessing()
  }

  /**
   * Clear queue without processing
   */
  clear() {
    this.queue.clear()
    this.stopProcessing()
  }

  /**
   * Get queue statistics
   */
  getStats() {
    return {
      ...this.stats,
      queueSize: this.queue.size,
      isProcessing: this.isProcessing,
      isBackpressured: this.isBackpressured(),
      currentRate: this.rateLimiter.currentRate,
    }
  }

  /**
   * Destroy queue
   */
  destroy() {
    this.clear()
    this.handlers.clear()
    this.onBackpressure = null
    this.onDrain = null
  }
}

/**
 * Create event queue with default handlers
 */
export function createEventQueue(config = {}) {
  return new RealtimeEventQueue(config)
}

/**
 * Singleton instance for global use
 */
let globalQueue = null

export function getGlobalEventQueue() {
  if (!globalQueue) {
    globalQueue = createEventQueue()
  }
  return globalQueue
}

export default {
  RealtimeEventQueue,
  createEventQueue,
  getGlobalEventQueue,
  EVENT_PRIORITY,
  EVENT_TYPES,
}
