<template>
  <aside class="task-dock" :class="dockClasses">
    <div class="task-dock__header">
      <h3 class="task-dock__title">Tasks / Materials (dev)</h3>
      <button class="task-dock__toggle" @click="handleToggle" :title="$t('classroom.tasks.toggle')">
        <span v-if="state === 'peek'">→</span>
        <span v-else-if="state === 'expanded'">←</span>
      </button>
    </div>

    <div v-if="state !== 'hidden'" class="task-dock__content">
      <!-- FE-93.X.3: Placeholder tasks for dev-vertical -->
      <div v-if="tasks.length === 0" class="task-dock__placeholder-list">
        <div
          v-for="i in 5"
          :key="`placeholder-${i}`"
          class="task-dock__item task-dock__item--placeholder"
          draggable="true"
        >
          <div class="task-item__icon">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <rect x="3" y="3" width="18" height="18" rx="2" />
              <path d="M9 9h6M9 13h6M9 17h4" />
            </svg>
          </div>
          <div class="task-item__content">
            <h4 class="task-item__title">Task {{ i }}</h4>
            <p class="task-item__description">Placeholder task for drag & drop demo</p>
          </div>
          <div class="task-item__drag-handle">
            <svg viewBox="0 0 24 24" fill="currentColor">
              <circle cx="9" cy="7" r="1.5" />
              <circle cx="15" cy="7" r="1.5" />
              <circle cx="9" cy="12" r="1.5" />
              <circle cx="15" cy="12" r="1.5" />
              <circle cx="9" cy="17" r="1.5" />
              <circle cx="15" cy="17" r="1.5" />
            </svg>
          </div>
        </div>
      </div>

      <div v-else class="task-dock__list">
        <div
          v-for="task in tasks"
          :key="task.id"
          class="task-dock__item"
          draggable="true"
          @dragstart="handleDragStart(task.id)"
          @dragend="handleDragEnd"
        >
          <div class="task-item__content">
            <h4 class="task-item__title">{{ task.title }}</h4>
            <p v-if="task.description" class="task-item__description">{{ task.description }}</p>
          </div>
          <div class="task-item__status">
            <input
              type="checkbox"
              :checked="task.completed"
              @change="handleTaskToggle(task.id)"
            />
          </div>
        </div>
      </div>
    </div>
  </aside>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import type { WhiteboardTask } from '../../types/whiteboard'
import type { TaskDockState } from '../../stores/classroomLayoutStore'

interface Props {
  state: TaskDockState
  tasks: WhiteboardTask[]
}

const props = defineProps<Props>()

const emit = defineEmits<{
  toggle: []
  taskDrop: [taskId: string, pageId: string]
  taskToggle: [taskId: string]
}>()

const dockClasses = computed(() => ({
  'task-dock--hidden': props.state === 'hidden',
  'task-dock--peek': props.state === 'peek',
  'task-dock--expanded': props.state === 'expanded'
}))

function handleToggle() {
  emit('toggle')
}

function handleDragStart(taskId: string) {
  console.log('[TaskDock] Drag start:', taskId)
}

function handleDragEnd() {
  console.log('[TaskDock] Drag end')
}

function handleTaskToggle(taskId: string) {
  emit('taskToggle', taskId)
}
</script>

<style scoped>
.task-dock {
  display: flex;
  flex-direction: column;
  background: var(--color-bg-secondary, #f9fafb);
  border-left: 1px solid var(--color-border, #e5e7eb);
  transition: width 0.3s ease;
}

.task-dock--hidden {
  width: 0;
  overflow: hidden;
}

.task-dock--peek {
  width: 60px;
}

.task-dock--expanded {
  width: 320px;
}

.task-dock__header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 1rem;
  border-bottom: 1px solid var(--color-border, #e5e7eb);
}

.task-dock__title {
  font-size: 0.875rem;
  font-weight: 600;
  margin: 0;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.task-dock--peek .task-dock__title {
  display: none;
}

.task-dock__toggle {
  background: none;
  border: none;
  cursor: pointer;
  padding: 0.25rem;
  color: var(--color-text-secondary, #6b7280);
  font-size: 1.25rem;
  line-height: 1;
}

.task-dock__toggle:hover {
  color: var(--color-text-primary, #111827);
}

.task-dock__content {
  flex: 1;
  overflow-y: auto;
  padding: 1rem;
}

.task-dock__empty {
  text-align: center;
  padding: 2rem 1rem;
  color: var(--color-text-tertiary, #9ca3af);
  font-size: 0.875rem;
}

/* v0.93.1: Placeholder list styling */
.task-dock__placeholder-list {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.task-dock__list {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.task-dock__item {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  background: white;
  border: 1px solid var(--color-border, #e5e7eb);
  border-radius: 6px;
  padding: 0.75rem;
  cursor: move;
  transition: all 0.2s;
}

.task-dock__item:hover {
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
  border-color: var(--color-primary, #3b82f6);
}

/* v0.93.1: Placeholder item styling */
.task-dock__item--placeholder {
  background: linear-gradient(135deg, #ffffff 0%, #f9fafb 100%);
}

.task-dock__item--placeholder:hover {
  background: linear-gradient(135deg, #f9fafb 0%, #f3f4f6 100%);
  transform: translateY(-2px);
}

.task-item__icon {
  flex-shrink: 0;
  width: 2rem;
  height: 2rem;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--color-bg-secondary, #f9fafb);
  border-radius: 4px;
  color: var(--color-text-secondary, #6b7280);
}

.task-item__icon svg {
  width: 1.25rem;
  height: 1.25rem;
}

.task-item__drag-handle {
  flex-shrink: 0;
  width: 1.5rem;
  height: 1.5rem;
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--color-text-tertiary, #9ca3af);
  cursor: grab;
}

.task-item__drag-handle:active {
  cursor: grabbing;
}

.task-item__drag-handle svg {
  width: 1rem;
  height: 1rem;
}

.task-item__content {
  flex: 1;
  min-width: 0;
}

.task-item__title {
  font-size: 0.875rem;
  font-weight: 500;
  margin: 0 0 0.25rem 0;
}

.task-item__description {
  font-size: 0.75rem;
  color: var(--color-text-secondary, #6b7280);
  margin: 0;
}

.task-item__status {
  display: flex;
  justify-content: flex-end;
}

.task-item__status input[type="checkbox"] {
  cursor: pointer;
}
</style>
