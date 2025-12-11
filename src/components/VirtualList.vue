<template>
  <div
    ref="containerRef"
    class="virtual-list-container"
    :style="containerStyle"
    @scroll="handleScroll"
  >
    <div
      class="virtual-list-spacer"
      :style="{ height: `${totalHeight}px` }"
    >
      <div
        class="virtual-list-content"
        :style="{ transform: `translateY(${offsetY}px)` }"
      >
        <div
          v-for="item in visibleItems"
          :key="keyField ? item[keyField] : item._virtualIndex"
          class="virtual-list-item"
          :style="itemStyle"
        >
          <slot :item="item" :index="item._virtualIndex" />
        </div>
      </div>
    </div>
    
    <!-- Loading indicator -->
    <div v-if="isLoading" class="virtual-list-loading">
      <slot name="loading">
        <div class="loading-spinner" />
      </slot>
    </div>
    
    <!-- End of list -->
    <div v-if="!hasMore && items.length > 0" class="virtual-list-end">
      <slot name="end">
        <span class="text-muted">No more items</span>
      </slot>
    </div>
    
    <!-- Empty state -->
    <div v-if="!isLoading && items.length === 0" class="virtual-list-empty">
      <slot name="empty">
        <span class="text-muted">No items</span>
      </slot>
    </div>
  </div>
</template>

<script setup>
/**
 * VirtualList Component — v0.14.0
 * Reusable virtualized list component
 * 
 * Usage:
 * <VirtualList
 *   :items="users"
 *   :item-height="64"
 *   :load-more="fetchMoreUsers"
 *   key-field="id"
 * >
 *   <template #default="{ item, index }">
 *     <UserCard :user="item" />
 *   </template>
 * </VirtualList>
 */

import { computed, toRefs } from 'vue'
import { useVirtualList } from '../composables/useVirtualList'

const props = defineProps({
  /**
   * Initial items array
   */
  items: {
    type: Array,
    default: () => [],
  },
  /**
   * Fixed item height in pixels
   */
  itemHeight: {
    type: Number,
    default: 60,
  },
  /**
   * Number of items to render outside viewport
   */
  overscan: {
    type: Number,
    default: 5,
  },
  /**
   * Distance from bottom to trigger loadMore (px)
   */
  threshold: {
    type: Number,
    default: 200,
  },
  /**
   * Number of items to load per page
   */
  pageSize: {
    type: Number,
    default: 20,
  },
  /**
   * Async function to load more items
   */
  loadMore: {
    type: Function,
    default: null,
  },
  /**
   * Field to use as item key
   */
  keyField: {
    type: String,
    default: 'id',
  },
  /**
   * Container height (CSS value)
   */
  height: {
    type: String,
    default: '100%',
  },
})

const emit = defineEmits(['scroll', 'load-more', 'item-click'])

const virtualList = useVirtualList({
  itemHeight: props.itemHeight,
  overscan: props.overscan,
  threshold: props.threshold,
  pageSize: props.pageSize,
  loadMore: props.loadMore,
})

const {
  containerRef,
  visibleItems,
  totalHeight,
  offsetY,
  isLoading,
  hasMore,
  items,
} = virtualList

// Sync external items
if (props.items.length > 0) {
  virtualList.setItems(props.items)
}

const containerStyle = computed(() => ({
  height: props.height,
  overflow: 'auto',
  position: 'relative',
}))

const itemStyle = computed(() => ({
  height: `${props.itemHeight}px`,
}))

const handleScroll = (event) => {
  virtualList.handleScroll(event)
  emit('scroll', event)
}

// Expose methods
defineExpose({
  scrollToIndex: virtualList.scrollToIndex,
  scrollToBottom: virtualList.scrollToBottom,
  setItems: virtualList.setItems,
  appendItems: virtualList.appendItems,
  prependItems: virtualList.prependItems,
  reset: virtualList.reset,
})
</script>

<style scoped>
.virtual-list-container {
  will-change: transform;
}

.virtual-list-spacer {
  position: relative;
}

.virtual-list-content {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  will-change: transform;
}

.virtual-list-item {
  box-sizing: border-box;
}

.virtual-list-loading {
  display: flex;
  justify-content: center;
  padding: 16px;
}

.virtual-list-end,
.virtual-list-empty {
  display: flex;
  justify-content: center;
  padding: 24px;
  color: var(--text-muted, #6b7280);
}

.loading-spinner {
  width: 24px;
  height: 24px;
  border: 2px solid var(--border-color, #e5e7eb);
  border-top-color: var(--primary-color, #3b82f6);
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}
</style>
