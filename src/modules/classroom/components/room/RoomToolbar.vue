<template>
  <div class="room-toolbar">
    <!-- Layout switcher -->
    <div class="toolbar-group">
      <button
        v-for="layout in layouts"
        :key="layout.id"
        class="toolbar-btn"
        :class="{ 'toolbar-btn--active': layoutMode === layout.id }"
        :title="$t(`classroom.layouts.${layout.id}`)"
        @click="$emit('layout-change', layout.id)"
      >
        <span class="icon">{{ layout.icon }}</span>
      </button>
    </div>

    <!-- Separator -->
    <div class="toolbar-separator"></div>

    <!-- Actions -->
    <div class="toolbar-group">
      <!-- Save Snapshot -->
      <button
        v-if="isHost"
        class="toolbar-btn"
        title="Зберегти знімок"
        @click="$emit('save-snapshot')"
      >
        <span class="icon">💾</span>
      </button>

      <!-- History -->
      <button
        class="toolbar-btn"
        title="Історія дошки"
        @click="$emit('show-history')"
      >
        <span class="icon">📜</span>
      </button>

      <!-- Settings -->
      <button
        class="toolbar-btn"
        title="Налаштування"
        @click="showSettings = true"
      >
        <span class="icon">⚙️</span>
      </button>

      <!-- Fullscreen -->
      <button
        class="toolbar-btn"
        title="Повноекранний режим"
        @click="toggleFullscreen"
      >
        <span class="icon">{{ isFullscreen ? '⊙' : '⛶' }}</span>
      </button>
    </div>

    <!-- Host actions -->
    <template v-if="isHost">
      <div class="toolbar-separator"></div>

      <div class="toolbar-group">
        <!-- Pause/Resume -->
        <button
          v-if="!isPaused"
          class="toolbar-btn toolbar-btn--warning"
          title="Призупинити урок"
          @click="$emit('pause')"
        >
          <span class="icon">⏸️</span>
          <span class="label">Пауза</span>
        </button>
        <button
          v-else
          class="toolbar-btn toolbar-btn--success"
          title="Продовжити урок"
          @click="$emit('resume')"
        >
          <span class="icon">▶️</span>
          <span class="label">Продовжити</span>
        </button>

        <!-- Terminate -->
        <button
          v-if="canTerminate"
          class="toolbar-btn toolbar-btn--danger"
          title="Завершити урок"
          @click="$emit('terminate')"
        >
          <span class="icon">⏹️</span>
          <span class="label">Завершити</span>
        </button>
      </div>
    </template>

    <!-- Leave button (for non-hosts) -->
    <template v-else>
      <div class="toolbar-separator"></div>

      <div class="toolbar-group">
        <button
          class="toolbar-btn toolbar-btn--warning"
          :title="$t('classroom.toolbar.leave')"
          @click="$emit('leave')"
        >
          <span class="icon">🚪</span>
          <span class="label">{{ $t('classroom.toolbar.leave') }}</span>
        </button>
      </div>
    </template>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import type { LayoutMode } from '../../stores/roomStore'

interface Props {
  isHost?: boolean
  layoutMode?: LayoutMode
  canTerminate?: boolean
  isPaused?: boolean
}

withDefaults(defineProps<Props>(), {
  isHost: false,
  layoutMode: 'side-by-side',
  canTerminate: false,
  isPaused: false,
})

defineEmits<{
  'layout-change': [mode: string]
  terminate: []
  leave: []
  pause: []
  resume: []
  'save-snapshot': []
  'show-history': []
}>()

// State
const showSettings = ref(false)
const isFullscreen = ref(false)

// Layouts
const layouts = [
  { id: 'side-by-side', icon: '⬜⬜' },
  { id: 'pip', icon: '🖼️' },
  { id: 'board-focus', icon: '📋' },
  { id: 'video-focus', icon: '📹' },
]

// Methods
function toggleFullscreen(): void {
  if (!document.fullscreenElement) {
    document.documentElement.requestFullscreen()
    isFullscreen.value = true
  } else {
    document.exitFullscreen()
    isFullscreen.value = false
  }
}
</script>

<style scoped>
.room-toolbar {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 0.75rem 1rem;
  background: var(--color-bg-secondary);
  border-top: 1px solid var(--color-border);
}

.toolbar-group {
  display: flex;
  align-items: center;
  gap: 4px;
}

.toolbar-separator {
  width: 1px;
  height: 24px;
  background: var(--color-border);
  margin: 0 8px;
}

.toolbar-btn {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.5rem 0.75rem;
  background: transparent;
  border: 1px solid var(--color-border);
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.2s;
  color: var(--color-text-primary);
}

.toolbar-btn:hover {
  background: var(--color-bg-hover);
}

.toolbar-btn--active {
  background: var(--color-primary-light);
  border-color: var(--color-primary);
}

.toolbar-btn--danger {
  border-color: var(--color-error);
  color: var(--color-error);
}

.toolbar-btn--danger:hover {
  background: var(--color-error-light);
}

.toolbar-btn--warning {
  border-color: var(--color-warning);
  color: var(--color-warning);
}

.toolbar-btn--warning:hover {
  background: var(--color-warning-light);
}

.toolbar-btn--success {
  border-color: var(--color-success, #10b981);
  color: var(--color-success, #10b981);
}

.toolbar-btn--success:hover {
  background: var(--color-success-light, rgba(16, 185, 129, 0.1));
}

.icon {
  font-size: 1.25rem;
}

.label {
  font-size: 0.875rem;
  font-weight: 500;
}
</style>
