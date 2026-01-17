<template>
  <div class="layout-mode-switcher">
    <button
      class="mode-btn"
      :class="{ 'mode-btn--active': currentMode === 'board-only' }"
      @click="handleModeChange('board-only')"
      :title="$t('classroom.layout.boardOnly')"
    >
      <svg class="mode-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <rect x="3" y="3" width="18" height="18" rx="2" />
      </svg>
      <span class="mode-label">Board only</span>
    </button>
    
    <button
      class="mode-btn"
      :class="{ 'mode-btn--active': currentMode === 'board-with-tasks' }"
      @click="handleModeChange('board-with-tasks')"
      :title="$t('classroom.layout.boardWithTasks')"
    >
      <svg class="mode-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <rect x="3" y="3" width="11" height="18" rx="2" />
        <rect x="16" y="3" width="5" height="18" rx="2" />
      </svg>
      <span class="mode-label">Board + Tasks</span>
    </button>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useClassroomLayoutStore } from '../../stores/classroomLayoutStore'
import type { LayoutMode } from '../../stores/classroomLayoutStore'

const layoutStore = useClassroomLayoutStore()

const currentMode = computed(() => layoutStore.layoutMode)

function handleModeChange(mode: LayoutMode) {
  // FE-93.X.2: Перемикання режимів не скидає tool/page state
  layoutStore.setLayoutMode(mode)
  console.info('[LayoutModeSwitcher] Mode changed:', mode)
}
</script>

<style scoped>
.layout-mode-switcher {
  display: flex;
  gap: 0.5rem;
  padding: 0.5rem;
  background: var(--color-bg-secondary, #f9fafb);
  border-radius: 8px;
  border: 1px solid var(--color-border, #e5e7eb);
}

.mode-btn {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.5rem 0.75rem;
  border: 1px solid transparent;
  border-radius: 6px;
  background: transparent;
  color: var(--color-text-secondary, #6b7280);
  font-size: 0.875rem;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;
}

.mode-btn:hover {
  background: var(--color-bg-hover, #f3f4f6);
  color: var(--color-text-primary, #111827);
}

.mode-btn--active {
  background: white;
  color: var(--color-primary, #3b82f6);
  border-color: var(--color-primary, #3b82f6);
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.05);
}

.mode-icon {
  width: 1.25rem;
  height: 1.25rem;
}

.mode-label {
  white-space: nowrap;
}

/* Responsive: hide labels on small screens */
@media (max-width: 640px) {
  .mode-label {
    display: none;
  }
  
  .mode-btn {
    padding: 0.5rem;
  }
}
</style>
