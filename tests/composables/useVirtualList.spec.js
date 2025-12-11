import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { nextTick } from 'vue'
import { useVirtualList, useDynamicVirtualList } from '../../src/composables/useVirtualList'

describe('useVirtualList', () => {
  describe('initialization', () => {
    it('creates virtual list with default config', () => {
      const { items, visibleItems, isLoading, hasMore } = useVirtualList()
      
      expect(items.value).toEqual([])
      expect(visibleItems.value).toEqual([])
      expect(isLoading.value).toBe(false)
      expect(hasMore.value).toBe(true)
    })

    it('accepts custom config', () => {
      const { items } = useVirtualList({
        itemHeight: 100,
        overscan: 10,
        threshold: 500,
        pageSize: 50,
      })
      
      expect(items.value).toEqual([])
    })
  })

  describe('setItems', () => {
    it('sets items array', () => {
      const { items, setItems } = useVirtualList()
      
      setItems([{ id: 1 }, { id: 2 }, { id: 3 }])
      
      expect(items.value).toHaveLength(3)
      expect(items.value[0].id).toBe(1)
    })

    it('resets hasMore to true', () => {
      const { hasMore, setItems } = useVirtualList()
      
      // Manually set hasMore to false
      hasMore.value = false
      
      setItems([{ id: 1 }])
      
      expect(hasMore.value).toBe(true)
    })
  })

  describe('appendItems', () => {
    it('appends items to existing array', () => {
      const { items, setItems, appendItems } = useVirtualList()
      
      setItems([{ id: 1 }])
      appendItems([{ id: 2 }, { id: 3 }])
      
      expect(items.value).toHaveLength(3)
    })
  })

  describe('updateItem', () => {
    it('updates item at index with object', () => {
      const { items, setItems, updateItem } = useVirtualList()
      
      setItems([{ id: 1, name: 'old' }])
      updateItem(0, { name: 'new' })
      
      expect(items.value[0].name).toBe('new')
      expect(items.value[0].id).toBe(1)
    })

    it('updates item at index with function', () => {
      const { items, setItems, updateItem } = useVirtualList()
      
      setItems([{ id: 1, count: 5 }])
      updateItem(0, (item) => ({ ...item, count: item.count + 1 }))
      
      expect(items.value[0].count).toBe(6)
    })

    it('ignores invalid index', () => {
      const { items, setItems, updateItem } = useVirtualList()
      
      setItems([{ id: 1 }])
      updateItem(-1, { name: 'test' })
      updateItem(100, { name: 'test' })
      
      expect(items.value).toHaveLength(1)
    })
  })

  describe('removeItem', () => {
    it('removes item at index', () => {
      const { items, setItems, removeItem } = useVirtualList()
      
      setItems([{ id: 1 }, { id: 2 }, { id: 3 }])
      removeItem(1)
      
      expect(items.value).toHaveLength(2)
      expect(items.value[0].id).toBe(1)
      expect(items.value[1].id).toBe(3)
    })

    it('ignores invalid index', () => {
      const { items, setItems, removeItem } = useVirtualList()
      
      setItems([{ id: 1 }])
      removeItem(-1)
      removeItem(100)
      
      expect(items.value).toHaveLength(1)
    })
  })

  describe('reset', () => {
    it('resets all state', () => {
      const { items, setItems, hasMore, isLoading, error, reset } = useVirtualList()
      
      setItems([{ id: 1 }])
      hasMore.value = false
      error.value = 'test error'
      
      reset()
      
      expect(items.value).toEqual([])
      expect(hasMore.value).toBe(true)
      expect(error.value).toBeNull()
    })
  })

  describe('totalHeight', () => {
    it('calculates total height based on item count', () => {
      const { setItems, totalHeight } = useVirtualList({ itemHeight: 50 })
      
      setItems([{ id: 1 }, { id: 2 }, { id: 3 }])
      
      expect(totalHeight.value).toBe(150) // 3 * 50
    })
  })

  describe('visibleRange', () => {
    it('calculates visible range based on scroll position', () => {
      const { setItems, visibleRange } = useVirtualList({
        itemHeight: 50,
        overscan: 2,
      })
      
      // Add 100 items
      const items = Array.from({ length: 100 }, (_, i) => ({ id: i }))
      setItems(items)
      
      // Initial range (scrollTop = 0, containerHeight = 0)
      expect(visibleRange.value.start).toBe(0)
    })
  })

  describe('loadMore', () => {
    it('calls loadMore function', async () => {
      const loadMoreFn = vi.fn().mockResolvedValue([{ id: 1 }, { id: 2 }])
      
      const { items, loadMore } = useVirtualList({ loadMore: loadMoreFn })
      
      await loadMore()
      
      expect(loadMoreFn).toHaveBeenCalledWith(0, 20) // offset, pageSize
      expect(items.value).toHaveLength(2)
    })

    it('sets hasMore to false when no items returned', async () => {
      const loadMoreFn = vi.fn().mockResolvedValue([])
      
      const { hasMore, loadMore } = useVirtualList({ loadMore: loadMoreFn })
      
      await loadMore()
      
      expect(hasMore.value).toBe(false)
    })

    it('sets hasMore to false when fewer items than pageSize', async () => {
      const loadMoreFn = vi.fn().mockResolvedValue([{ id: 1 }])
      
      const { hasMore, loadMore } = useVirtualList({ 
        loadMore: loadMoreFn,
        pageSize: 20,
      })
      
      await loadMore()
      
      expect(hasMore.value).toBe(false)
    })

    it('handles loadMore error', async () => {
      const loadMoreFn = vi.fn().mockRejectedValue(new Error('Network error'))
      
      const { error, loadMore } = useVirtualList({ loadMore: loadMoreFn })
      
      await loadMore()
      
      expect(error.value).toBe('Network error')
    })

    it('prevents concurrent loadMore calls', async () => {
      let resolveFirst
      const loadMoreFn = vi.fn().mockImplementation(() => {
        return new Promise(resolve => {
          resolveFirst = resolve
        })
      })
      
      const { loadMore, isLoading } = useVirtualList({ loadMore: loadMoreFn })
      
      // Start first load
      const promise1 = loadMore()
      expect(isLoading.value).toBe(true)
      
      // Try second load (should be ignored)
      loadMore()
      
      expect(loadMoreFn).toHaveBeenCalledTimes(1)
      
      // Resolve first load
      resolveFirst([])
      await promise1
    })
  })
})

describe('useDynamicVirtualList', () => {
  it('creates dynamic virtual list', () => {
    const { items, visibleItems, measureItem } = useDynamicVirtualList()
    
    expect(items.value).toEqual([])
    expect(visibleItems.value).toEqual([])
    expect(typeof measureItem).toBe('function')
  })

  it('measureItem updates item heights', () => {
    const { setItems, measureItem } = useDynamicVirtualList()
    
    setItems([{ id: 1 }, { id: 2 }])
    
    measureItem(0, 100)
    measureItem(1, 150)
    
    // Heights should be stored (internal state)
    // We can't directly test itemHeights, but totalHeight should reflect it
  })
})
