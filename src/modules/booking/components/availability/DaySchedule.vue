<script setup lang="ts">
// F20: Day Schedule Component
import { Plus, X } from 'lucide-vue-next'
import TimeRangeInput from './TimeRangeInput.vue'

interface TimeWindow {
  start: string
  end: string
}

defineProps<{
  windows: TimeWindow[]
}>()

const emit = defineEmits<{
  add: []
  remove: [index: number]
  update: [index: number, field: 'start' | 'end', value: string]
}>()
</script>

<template>
  <div class="day-schedule">
    <!-- Time windows -->
    <div v-if="windows.length > 0" class="windows-list">
      <div v-for="(window, index) in windows" :key="index" class="window-item">
        <TimeRangeInput
          :start="window.start"
          :end="window.end"
          @update:start="(v) => emit('update', index, 'start', v)"
          @update:end="(v) => emit('update', index, 'end', v)"
        />
        <button class="remove-btn" @click="emit('remove', index)">
          <X :size="16" />
        </button>
      </div>
    </div>

    <!-- Empty state -->
    <div v-else class="empty-state">
      <span>Not available</span>
    </div>

    <!-- Add button -->
    <button class="add-btn" @click="emit('add')">
      <Plus :size="16" />
      Add Time
    </button>
  </div>
</template>

<style scoped>
.day-schedule {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.windows-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.window-item {
  display: flex;
  align-items: center;
  gap: 8px;
}

.remove-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  background: none;
  border: none;
  border-radius: 6px;
  color: var(--color-text-secondary, #6b7280);
  cursor: pointer;
  transition: all 0.15s;
}

.remove-btn:hover {
  background: var(--color-danger-light, #fee2e2);
  color: var(--color-danger, #ef4444);
}

.empty-state {
  padding: 8px 0;
  font-size: 13px;
  color: var(--color-text-secondary, #6b7280);
}

.add-btn {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 6px 12px;
  background: none;
  border: 1px dashed var(--color-border, #d1d5db);
  border-radius: 6px;
  font-size: 13px;
  color: var(--color-text-secondary, #6b7280);
  cursor: pointer;
  transition: all 0.15s;
  align-self: flex-start;
}

.add-btn:hover {
  border-color: var(--color-primary, #3b82f6);
  color: var(--color-primary, #3b82f6);
}
</style>
