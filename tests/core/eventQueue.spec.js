import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import {
  RealtimeEventQueue,
  createEventQueue,
  EVENT_PRIORITY,
  EVENT_TYPES,
} from '../../src/core/realtime/eventQueue'

describe('RealtimeEventQueue', () => {
  let queue

  beforeEach(() => {
    vi.useFakeTimers()
    queue = createEventQueue({
      maxQueueSize: 100,
      processIntervalMs: 16,
      batchSize: 10,
    })
  })

  afterEach(() => {
    queue.destroy()
    vi.useRealTimers()
  })

  describe('EVENT_PRIORITY', () => {
    it('has correct priority values', () => {
      expect(EVENT_PRIORITY.CRITICAL).toBe(0)
      expect(EVENT_PRIORITY.HIGH).toBe(1)
      expect(EVENT_PRIORITY.NORMAL).toBe(2)
      expect(EVENT_PRIORITY.LOW).toBe(3)
    })
  })

  describe('EVENT_TYPES', () => {
    it('has all expected event types', () => {
      expect(EVENT_TYPES.CHAT_MESSAGE).toBe('chat:message')
      expect(EVENT_TYPES.PRESENCE_UPDATE).toBe('presence:update')
      expect(EVENT_TYPES.BOARD_STROKE).toBe('board:stroke')
    })
  })

  describe('enqueue', () => {
    it('enqueues events', () => {
      const result = queue.enqueue({
        type: EVENT_TYPES.CHAT_MESSAGE,
        payload: { text: 'Hello' },
      })

      expect(result).toBe(true)
      expect(queue.getStats().enqueued).toBe(1)
    })

    it('respects max queue size', () => {
      for (let i = 0; i < 100; i++) {
        queue.enqueue({ type: EVENT_TYPES.CHAT_MESSAGE, payload: { i } })
      }

      // Queue is full, next should be dropped
      const result = queue.enqueue({
        type: EVENT_TYPES.CHAT_MESSAGE,
        payload: { text: 'overflow' },
      })

      expect(result).toBe(false)
      expect(queue.getStats().dropped).toBe(1)
    })
  })

  describe('on', () => {
    it('registers event handlers', () => {
      const handler = vi.fn()
      const unsubscribe = queue.on(EVENT_TYPES.CHAT_MESSAGE, handler)

      expect(typeof unsubscribe).toBe('function')
    })

    it('unsubscribes correctly', () => {
      const handler = vi.fn()
      const unsubscribe = queue.on(EVENT_TYPES.CHAT_MESSAGE, handler)

      unsubscribe()

      queue.enqueue({ type: EVENT_TYPES.CHAT_MESSAGE, payload: {} })
      queue.flush()

      expect(handler).not.toHaveBeenCalled()
    })
  })

  describe('processing', () => {
    it('processes events in batches', () => {
      const handler = vi.fn()
      queue.on(EVENT_TYPES.CHAT_MESSAGE, handler)

      for (let i = 0; i < 5; i++) {
        queue.enqueue({ type: EVENT_TYPES.CHAT_MESSAGE, payload: { i } })
      }

      // Advance timer to trigger processing
      vi.advanceTimersByTime(20)

      expect(handler).toHaveBeenCalledTimes(5)
    })

    it('processes higher priority events first', () => {
      const order = []
      
      queue.on(EVENT_TYPES.CHAT_MESSAGE, (payload) => {
        order.push(`msg-${payload.id}`)
      })
      queue.on(EVENT_TYPES.SYSTEM, (payload) => {
        order.push(`sys-${payload.id}`)
      })

      queue.enqueue({
        type: EVENT_TYPES.CHAT_MESSAGE,
        payload: { id: 1 },
        priority: EVENT_PRIORITY.NORMAL,
      })
      queue.enqueue({
        type: EVENT_TYPES.SYSTEM,
        payload: { id: 2 },
        priority: EVENT_PRIORITY.CRITICAL,
      })

      queue.flush()

      expect(order[0]).toBe('sys-2')
      expect(order[1]).toBe('msg-1')
    })
  })

  describe('flush', () => {
    it('processes all pending events immediately', () => {
      const handler = vi.fn()
      queue.on(EVENT_TYPES.CHAT_MESSAGE, handler)

      for (let i = 0; i < 10; i++) {
        queue.enqueue({ type: EVENT_TYPES.CHAT_MESSAGE, payload: { i } })
      }

      queue.flush()

      expect(handler).toHaveBeenCalledTimes(10)
      expect(queue.getStats().queueSize).toBe(0)
    })
  })

  describe('clear', () => {
    it('clears queue without processing', () => {
      const handler = vi.fn()
      queue.on(EVENT_TYPES.CHAT_MESSAGE, handler)

      for (let i = 0; i < 10; i++) {
        queue.enqueue({ type: EVENT_TYPES.CHAT_MESSAGE, payload: { i } })
      }

      queue.clear()

      expect(handler).not.toHaveBeenCalled()
      expect(queue.getStats().queueSize).toBe(0)
    })
  })

  describe('getStats', () => {
    it('returns correct statistics', () => {
      queue.enqueue({ type: EVENT_TYPES.CHAT_MESSAGE, payload: {} })
      queue.enqueue({ type: EVENT_TYPES.CHAT_MESSAGE, payload: {} })
      queue.flush()

      const stats = queue.getStats()

      expect(stats.enqueued).toBe(2)
      expect(stats.processed).toBe(2)
      expect(stats.queueSize).toBe(0)
    })
  })

  describe('backpressure', () => {
    it('triggers backpressure callback', () => {
      const onBackpressure = vi.fn()
      queue.onBackpressure = onBackpressure

      // Fill queue to 80% (backpressure threshold)
      for (let i = 0; i < 85; i++) {
        queue.enqueue({ type: EVENT_TYPES.CHAT_MESSAGE, payload: { i } })
      }

      expect(onBackpressure).toHaveBeenCalled()
    })
  })

  describe('wildcard handler', () => {
    it('receives all events', () => {
      const handler = vi.fn()
      queue.on('*', handler)

      queue.enqueue({ type: EVENT_TYPES.CHAT_MESSAGE, payload: { a: 1 } })
      queue.enqueue({ type: EVENT_TYPES.PRESENCE_UPDATE, payload: { b: 2 } })
      queue.flush()

      expect(handler).toHaveBeenCalledTimes(2)
    })
  })
})
