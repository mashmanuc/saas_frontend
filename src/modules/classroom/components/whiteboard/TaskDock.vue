<template>
  <aside class="task-dock" :class="dockClasses">
    <div class="task-dock__header">
      <h3 class="task-dock__title">{{ $t('classroom.tasks.title') }}</h3>
      <button class="task-dock__toggle" @click="handleToggle" :title="$t('classroom.tasks.toggle')">
        <span v-if="state === 'peek'">→</span>
        <span v-else-if="state === 'expanded'">←</span>
      </button>
    </div>

    <div v-if="state !== 'hidden'" class="task-dock__content">
      <div v-if="tasks.length === 0" class="task-dock__empty">
        <p>{{ $t('classroom.tasks.empty') }}</p>
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

.task-dock__list {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.task-dock__item {
  background: white;
  border: 1px solid var(--color-border, #e5e7eb);
  border-radius: 6px;
  padding: 0.75rem;
  cursor: move;
  transition: box-shadow 0.2s;
}

.task-dock__item:hover {
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
}

.task-item__content {
  margin-bottom: 0.5rem;
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
