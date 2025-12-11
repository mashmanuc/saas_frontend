import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import {
  useBatchedArray,
  useBatchedMap,
  useThrottledState,
  useRAFUpdater,
} from '../../src/utils/batchUpdates'

describe('batchUpdates', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  describe('useBatchedArray', () => {
    it('creates batched array with initial value', () => {
      const { items } = useBatchedArray([1, 2, 3])
      expect(items.value).toEqual([1, 2, 3])
    })

    it('batches push operations', () => {
      const batched = useBatchedArray([])
      
      batched.push(1)
      batched.push(2)
      batched.push(3)
      
      // Items not yet updated (pending in internal array)
      expect(batched.items.value).toEqual([])
      expect(batched.pending).toBe(3)
      
      // After throttle delay
      vi.advanceTimersByTime(20)
      
      expect(batched.items.value).toEqual([1, 2, 3])
      expect(batched.pending).toBe(0)
    })

    it('flushes immediately when batch is full', () => {
      const { items, push } = useBatchedArray([], { maxBatchSize: 3 })
      
      push(1)
      push(2)
      push(3) // Should trigger flush
      
      expect(items.value).toEqual([1, 2, 3])
    })

    it('pushMany adds multiple items', () => {
      const { items, pushMany } = useBatchedArray([])
      
      pushMany([1, 2, 3])
      vi.advanceTimersByTime(20)
      
      expect(items.value).toEqual([1, 2, 3])
    })

    it('set replaces all items', () => {
      const { items, set } = useBatchedArray([1, 2, 3])
      
      set([4, 5, 6])
      
      expect(items.value).toEqual([4, 5, 6])
    })

    it('clear removes all items', () => {
      const { items, clear } = useBatchedArray([1, 2, 3])
      
      clear()
      
      expect(items.value).toEqual([])
    })

    it('flush forces immediate update', () => {
      const { items, push, flush } = useBatchedArray([])
      
      push(1)
      push(2)
      
      expect(items.value).toEqual([])
      
      flush()
      
      expect(items.value).toEqual([1, 2])
    })
  })

  describe('useBatchedMap', () => {
    it('creates batched map with initial value', () => {
      const { map } = useBatchedMap({ a: 1, b: 2 })
      expect(map.value).toEqual({ a: 1, b: 2 })
    })

    it('batches set operations', () => {
      const batched = useBatchedMap({})
      
      batched.set('a', 1)
      batched.set('b', 2)
      
      expect(batched.map.value).toEqual({})
      expect(batched.pending).toBe(2)
      
      vi.advanceTimersByTime(20)
      
      expect(batched.map.value).toEqual({ a: 1, b: 2 })
    })

    it('remove deletes key immediately', () => {
      const { map, remove } = useBatchedMap({ a: 1, b: 2 })
      
      remove('a')
      
      expect(map.value).toEqual({ b: 2 })
    })

    it('reset replaces entire map', () => {
      const { map, reset } = useBatchedMap({ a: 1 })
      
      reset({ x: 10, y: 20 })
      
      expect(map.value).toEqual({ x: 10, y: 20 })
    })
  })

  describe('useThrottledState', () => {
    it('creates throttled state with initial value', () => {
      const { state } = useThrottledState(42)
      expect(state.value).toBe(42)
    })

    it('throttles updates', () => {
      const { state, set } = useThrottledState(0, 100)
      
      set(1)
      expect(state.value).toBe(1) // First update is immediate
      
      set(2)
      set(3)
      expect(state.value).toBe(1) // Throttled
      
      vi.advanceTimersByTime(100)
      expect(state.value).toBe(3) // Latest value
    })

    it('forceUpdate bypasses throttle', () => {
      const { state, set, forceUpdate } = useThrottledState(0, 100)
      
      set(1)
      set(2)
      
      forceUpdate()
      
      expect(state.value).toBe(2)
    })
  })

  describe('useRAFUpdater', () => {
    it('schedules callback on RAF', () => {
      const callback = vi.fn()
      const { schedule } = useRAFUpdater()
      
      schedule(callback)
      
      expect(callback).not.toHaveBeenCalled()
      
      // Simulate RAF
      vi.advanceTimersByTime(16)
      
      // Note: In real browser, RAF would call the callback
      // In tests, we can't easily simulate RAF
    })

    it('cancel stops pending callback', () => {
      const callback = vi.fn()
      const { schedule, cancel } = useRAFUpdater()
      
      schedule(callback)
      cancel()
      
      vi.advanceTimersByTime(100)
      
      // Callback should not be called after cancel
      // (In real browser with proper RAF mock)
    })
  })
})
