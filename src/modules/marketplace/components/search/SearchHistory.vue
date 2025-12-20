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
  background: var(--surface-card-muted);
}

.icon {
  color: var(--text-muted);
  flex-shrink: 0;
}

.history-text {
  flex: 1;
  font-size: 14px;
  color: var(--text-primary);
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
  color: var(--text-muted);
  border-radius: 4px;
  transition: all 0.15s;
  opacity: 0;
}

.history-item:hover .remove-btn {
  opacity: 1;
}

.remove-btn:hover {
  background: color-mix(in srgb, var(--border-color) 65%, transparent);
  color: var(--text-primary);
}
</style>
