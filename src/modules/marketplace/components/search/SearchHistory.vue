<script setup lang="ts">
// TASK F6: Search History Component
import { Clock, X } from 'lucide-vue-next'

defineProps<{
  history: string[]
  selectedIndex: number
}>()

const emit = defineEmits<{
  select: [query: string]
  remove: [query: string]
}>()
</script>

<template>
  <ul class="history-list">
    <li
      v-for="(query, index) in history"
      :key="query"
      class="history-item"
      :class="{ 'is-selected': index === selectedIndex }"
      @click="emit('select', query)"
    >
      <Clock :size="16" class="icon" />
      <span class="history-text">{{ query }}</span>
      <button
        class="remove-btn"
        type="button"
        @click.stop="emit('remove', query)"
      >
        <X :size="14" />
      </button>
    </li>
  </ul>
</template>

<style scoped>
.history-list {
  list-style: none;
  margin: 0;
  padding: 0;
}

.history-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 10px 16px;
  cursor: pointer;
  transition: background-color 0.15s;
}

.history-item:hover,
.history-item.is-selected {
  background: var(--color-bg-secondary, #f5f5f5);
}

.icon {
  color: var(--color-text-secondary, #9ca3af);
  flex-shrink: 0;
}

.history-text {
  flex: 1;
  font-size: 14px;
  color: var(--color-text-primary, #111827);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.remove-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  background: none;
  border: none;
  padding: 4px;
  cursor: pointer;
  color: var(--color-text-secondary, #9ca3af);
  border-radius: 4px;
  transition: all 0.15s;
  opacity: 0;
}

.history-item:hover .remove-btn {
  opacity: 1;
}

.remove-btn:hover {
  background: var(--color-bg-tertiary, #e5e7eb);
  color: var(--color-text-primary, #111827);
}
</style>
