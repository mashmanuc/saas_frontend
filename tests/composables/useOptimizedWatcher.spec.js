import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { ref, nextTick } from 'vue'
import { mount } from '@vue/test-utils'
import { defineComponent, h } from 'vue'

// Mock debounce/throttle
vi.mock('../../src/utils/debounce', () => ({
  debounce: vi.fn((fn, delay) => {
    const debounced = (...args) => fn(...args)
    debounced.cancel = vi.fn()
    return debounced
  }),
  throttle: vi.fn((fn, delay) => {
    const throttled = (...args) => fn(...args)
    throttled.cancel = vi.fn()
    return throttled
  }),
}))

import {
  useDebouncedWatch,
  useThrottledWatch,
  useDistinctWatch,
  useMemoizedComputed,
} from '../../src/composables/useOptimizedWatcher'

describe('useOptimizedWatcher', () => {
  describe('useDebouncedWatch', () => {
    it('creates debounced watcher', async () => {
      const callback = vi.fn()
      const source = ref(0)
      
      const TestComponent = defineComponent({
        setup() {
          useDebouncedWatch(source, callback, { debounceMs: 100 })
          return {}
        },
        render() {
          return h('div')
        },
      })
      
      mount(TestComponent)
      
      source.value = 1
      await nextTick()
      
      expect(callback).toHaveBeenCalled()
    })
  })

  describe('useThrottledWatch', () => {
    it('creates throttled watcher', async () => {
      const callback = vi.fn()
      const source = ref(0)
      
      const TestComponent = defineComponent({
        setup() {
          useThrottledWatch(source, callback, { throttleMs: 100 })
          return {}
        },
        render() {
          return h('div')
        },
      })
      
      mount(TestComponent)
      
      source.value = 1
      await nextTick()
      
      expect(callback).toHaveBeenCalled()
    })
  })

  describe('useDistinctWatch', () => {
    it('only triggers on distinct values', async () => {
      const callback = vi.fn()
      const source = ref(1)
      
      const TestComponent = defineComponent({
        setup() {
          useDistinctWatch(source, callback, { immediate: true })
          return {}
        },
        render() {
          return h('div')
        },
      })
      
      mount(TestComponent)
      await nextTick()
      
      // Initial call with immediate: true
      expect(callback).toHaveBeenCalledTimes(1)
      
      // First change
      source.value = 2
      await nextTick()
      expect(callback).toHaveBeenCalledTimes(2)
      
      // Same value - should not trigger
      source.value = 2
      await nextTick()
      expect(callback).toHaveBeenCalledTimes(2)
      
      // Different value
      source.value = 3
      await nextTick()
      expect(callback).toHaveBeenCalledTimes(3)
    })

    it('uses custom compare function', async () => {
      const callback = vi.fn()
      const source = ref({ id: 1, name: 'test' })
      
      const TestComponent = defineComponent({
        setup() {
          useDistinctWatch(
            source,
            callback,
            { compareFn: (a, b) => a?.id === b?.id }
          )
          return {}
        },
        render() {
          return h('div')
        },
      })
      
      mount(TestComponent)
      
      // Change name but same id
      source.value = { id: 1, name: 'changed' }
      await nextTick()
      
      // Should not trigger because id is same
      expect(callback).toHaveBeenCalledTimes(1) // Only initial
    })
  })

  describe('useMemoizedComputed', () => {
    it('memoizes computed based on key', () => {
      const expensiveCalc = vi.fn(() => Math.random())
      const key = ref('key1')
      
      const TestComponent = defineComponent({
        setup() {
          const result = useMemoizedComputed(
            expensiveCalc,
            () => key.value
          )
          return { result }
        },
        render() {
          return h('div', this.result)
        },
      })
      
      const wrapper = mount(TestComponent)
      const firstResult = wrapper.vm.result
      
      // Access again with same key
      expect(wrapper.vm.result).toBe(firstResult)
      expect(expensiveCalc).toHaveBeenCalledTimes(1)
    })
  })
})
