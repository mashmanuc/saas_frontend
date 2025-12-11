/**
 * Virtual List Composable — v0.14.0
 * Virtualized infinite lists для великих наборів даних
 */

import { ref, computed, watch, onMounted, onUnmounted, nextTick } from 'vue'

/**
 * Default configuration
 */
const DEFAULT_CONFIG = {
  itemHeight: 60,
  overscan: 5,
  threshold: 200,
  pageSize: 20,
}

/**
 * Create a virtualized list
 * 
 * @param {object} options - Configuration options
 * @returns {object} Virtual list state and methods
 */
export function useVirtualList(options = {}) {
  const config = { ...DEFAULT_CONFIG, ...options }
  
  // State
  const containerRef = ref(null)
  const items = ref([])
  const scrollTop = ref(0)
  const containerHeight = ref(0)
  const isLoading = ref(false)
  const hasMore = ref(true)
  const error = ref(null)
  
  // Computed
  const totalHeight = computed(() => items.value.length * config.itemHeight)
  
  const visibleRange = computed(() => {
    const start = Math.floor(scrollTop.value / config.itemHeight)
    const visibleCount = Math.ceil(containerHeight.value / config.itemHeight)
    
    return {
      start: Math.max(0, start - config.overscan),
      end: Math.min(items.value.length, start + visibleCount + config.overscan),
    }
  })
  
  const visibleItems = computed(() => {
    const { start, end } = visibleRange.value
    return items.value.slice(start, end).map((item, index) => ({
      ...item,
      _virtualIndex: start + index,
      _virtualTop: (start + index) * config.itemHeight,
    }))
  })
  
  const offsetY = computed(() => visibleRange.value.start * config.itemHeight)
  
  // Methods
  const handleScroll = (event) => {
    const target = event.target
    scrollTop.value = target.scrollTop
    
    // Check if near bottom for infinite scroll
    const distanceFromBottom = totalHeight.value - scrollTop.value - containerHeight.value
    if (distanceFromBottom < config.threshold && hasMore.value && !isLoading.value) {
      loadMore()
    }
  }
  
  const loadMore = async () => {
    if (isLoading.value || !hasMore.value || !options.loadMore) return
    
    isLoading.value = true
    error.value = null
    
    try {
      const newItems = await options.loadMore(items.value.length, config.pageSize)
      
      if (!newItems || newItems.length === 0) {
        hasMore.value = false
      } else {
        items.value = [...items.value, ...newItems]
        if (newItems.length < config.pageSize) {
          hasMore.value = false
        }
      }
    } catch (err) {
      error.value = err.message || 'Failed to load more items'
      console.error('[useVirtualList] loadMore failed:', err)
    } finally {
      isLoading.value = false
    }
  }
  
  const setItems = (newItems) => {
    items.value = [...newItems]
    hasMore.value = true
    scrollTop.value = 0
  }
  
  const appendItems = (newItems) => {
    items.value = [...items.value, ...newItems]
  }
  
  const prependItems = (newItems) => {
    const currentScrollTop = scrollTop.value
    const addedHeight = newItems.length * config.itemHeight
    
    items.value = [...newItems, ...items.value]
    
    // Maintain scroll position
    nextTick(() => {
      if (containerRef.value) {
        containerRef.value.scrollTop = currentScrollTop + addedHeight
      }
    })
  }
  
  const updateItem = (index, updater) => {
    if (index < 0 || index >= items.value.length) return
    
    const updated = typeof updater === 'function' 
      ? updater(items.value[index])
      : { ...items.value[index], ...updater }
    
    items.value = [
      ...items.value.slice(0, index),
      updated,
      ...items.value.slice(index + 1),
    ]
  }
  
  const removeItem = (index) => {
    if (index < 0 || index >= items.value.length) return
    items.value = [
      ...items.value.slice(0, index),
      ...items.value.slice(index + 1),
    ]
  }
  
  const scrollToIndex = (index, behavior = 'smooth') => {
    if (!containerRef.value) return
    
    const targetTop = index * config.itemHeight
    containerRef.value.scrollTo({
      top: targetTop,
      behavior,
    })
  }
  
  const scrollToBottom = (behavior = 'smooth') => {
    scrollToIndex(items.value.length - 1, behavior)
  }
  
  const reset = () => {
    items.value = []
    scrollTop.value = 0
    hasMore.value = true
    error.value = null
    isLoading.value = false
  }
  
  // Setup
  const setupContainer = () => {
    if (!containerRef.value) return
    
    const resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        containerHeight.value = entry.contentRect.height
      }
    })
    
    resizeObserver.observe(containerRef.value)
    containerHeight.value = containerRef.value.clientHeight
    
    return () => {
      resizeObserver.disconnect()
    }
  }
  
  let cleanup = null
  
  onMounted(() => {
    cleanup = setupContainer()
    
    // Initial load
    if (options.loadMore && items.value.length === 0) {
      loadMore()
    }
  })
  
  onUnmounted(() => {
    cleanup?.()
  })
  
  return {
    // Refs
    containerRef,
    items,
    
    // Computed
    visibleItems,
    totalHeight,
    offsetY,
    visibleRange,
    
    // State
    isLoading,
    hasMore,
    error,
    
    // Methods
    handleScroll,
    loadMore,
    setItems,
    appendItems,
    prependItems,
    updateItem,
    removeItem,
    scrollToIndex,
    scrollToBottom,
    reset,
  }
}

/**
 * Create a virtualized list with dynamic item heights
 * 
 * @param {object} options - Configuration options
 */
export function useDynamicVirtualList(options = {}) {
  const config = {
    estimatedItemHeight: 60,
    overscan: 5,
    threshold: 200,
    pageSize: 20,
    ...options,
  }
  
  const containerRef = ref(null)
  const items = ref([])
  const itemHeights = ref(new Map())
  const scrollTop = ref(0)
  const containerHeight = ref(0)
  const isLoading = ref(false)
  const hasMore = ref(true)
  
  // Calculate item positions based on actual heights
  const itemPositions = computed(() => {
    const positions = []
    let currentTop = 0
    
    for (let i = 0; i < items.value.length; i++) {
      const height = itemHeights.value.get(i) || config.estimatedItemHeight
      positions.push({
        index: i,
        top: currentTop,
        height,
        bottom: currentTop + height,
      })
      currentTop += height
    }
    
    return positions
  })
  
  const totalHeight = computed(() => {
    if (itemPositions.value.length === 0) return 0
    const last = itemPositions.value[itemPositions.value.length - 1]
    return last.bottom
  })
  
  const visibleRange = computed(() => {
    const viewportTop = scrollTop.value
    const viewportBottom = viewportTop + containerHeight.value
    
    let start = 0
    let end = items.value.length
    
    // Binary search for start
    let low = 0
    let high = itemPositions.value.length - 1
    
    while (low <= high) {
      const mid = Math.floor((low + high) / 2)
      const pos = itemPositions.value[mid]
      
      if (pos.bottom < viewportTop) {
        low = mid + 1
      } else {
        high = mid - 1
        start = mid
      }
    }
    
    // Find end
    for (let i = start; i < itemPositions.value.length; i++) {
      if (itemPositions.value[i].top > viewportBottom) {
        end = i
        break
      }
    }
    
    return {
      start: Math.max(0, start - config.overscan),
      end: Math.min(items.value.length, end + config.overscan),
    }
  })
  
  const visibleItems = computed(() => {
    const { start, end } = visibleRange.value
    return items.value.slice(start, end).map((item, index) => {
      const pos = itemPositions.value[start + index]
      return {
        ...item,
        _virtualIndex: start + index,
        _virtualTop: pos?.top || 0,
        _virtualHeight: pos?.height || config.estimatedItemHeight,
      }
    })
  })
  
  const measureItem = (index, height) => {
    if (itemHeights.value.get(index) !== height) {
      itemHeights.value.set(index, height)
      // Trigger reactivity
      itemHeights.value = new Map(itemHeights.value)
    }
  }
  
  const handleScroll = (event) => {
    scrollTop.value = event.target.scrollTop
    
    const distanceFromBottom = totalHeight.value - scrollTop.value - containerHeight.value
    if (distanceFromBottom < config.threshold && hasMore.value && !isLoading.value) {
      loadMore()
    }
  }
  
  const loadMore = async () => {
    if (isLoading.value || !hasMore.value || !options.loadMore) return
    
    isLoading.value = true
    
    try {
      const newItems = await options.loadMore(items.value.length, config.pageSize)
      
      if (!newItems || newItems.length === 0) {
        hasMore.value = false
      } else {
        items.value = [...items.value, ...newItems]
        if (newItems.length < config.pageSize) {
          hasMore.value = false
        }
      }
    } catch (err) {
      console.error('[useDynamicVirtualList] loadMore failed:', err)
    } finally {
      isLoading.value = false
    }
  }
  
  const setItems = (newItems) => {
    items.value = [...newItems]
    itemHeights.value = new Map()
    hasMore.value = true
  }
  
  onMounted(() => {
    if (containerRef.value) {
      containerHeight.value = containerRef.value.clientHeight
      
      const resizeObserver = new ResizeObserver((entries) => {
        containerHeight.value = entries[0].contentRect.height
      })
      resizeObserver.observe(containerRef.value)
    }
    
    if (options.loadMore && items.value.length === 0) {
      loadMore()
    }
  })
  
  return {
    containerRef,
    items,
    visibleItems,
    totalHeight,
    visibleRange,
    isLoading,
    hasMore,
    handleScroll,
    loadMore,
    setItems,
    measureItem,
  }
}

export default {
  useVirtualList,
  useDynamicVirtualList,
}
