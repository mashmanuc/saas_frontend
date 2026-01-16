<template>
  <div
    v-if="canModerate"
    class="moderation-controls"
    data-testid="moderation-controls"
  >
    <button
      class="moderation-btn"
      :class="{ 'moderation-btn--active': isBoardFrozen }"
      @click="toggleFreeze"
      :title="isBoardFrozen ? $t('whiteboard.moderation.freeze_off') : $t('whiteboard.moderation.freeze_on')"
      data-testid="freeze-toggle"
    >
      <svg
        xmlns="http://www.w3.org/2000/svg"
        width="18"
        height="18"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="2"
        stroke-linecap="round"
        stroke-linejoin="round"
      >
        <rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect>
        <path d="M7 11V7a5 5 0 0 1 10 0v4"></path>
      </svg>
      <span class="moderation-btn__label">
        {{ isBoardFrozen ? $t('whiteboard.moderation.freeze_off') : $t('whiteboard.moderation.freeze_on') }}
      </span>
    </button>

    <button
      class="moderation-btn"
      @click="clearPage"
      :title="$t('whiteboard.moderation.clear_page')"
      data-testid="clear-page-btn"
    >
      <svg
        xmlns="http://www.w3.org/2000/svg"
        width="18"
        height="18"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="2"
        stroke-linecap="round"
        stroke-linejoin="round"
      >
        <polyline points="3 6 5 6 21 6"></polyline>
        <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
      </svg>
      <span class="moderation-btn__label">
        {{ $t('whiteboard.moderation.clear_page') }}
      </span>
    </button>

    <button
      class="moderation-btn"
      @click="openPresenterMenu"
      :title="$t('whiteboard.presenter.follow_on')"
      data-testid="presenter-menu-btn"
    >
      <svg
        xmlns="http://www.w3.org/2000/svg"
        width="18"
        height="18"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="2"
        stroke-linecap="round"
        stroke-linejoin="round"
      >
        <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path>
        <circle cx="9" cy="7" r="4"></circle>
        <path d="M23 21v-2a4 4 0 0 0-3-3.87"></path>
        <path d="M16 3.13a4 4 0 0 1 0 7.75"></path>
      </svg>
      <span class="moderation-btn__label">Set Presenter</span>
    </button>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useWhiteboardStore } from '@/modules/classroom/stores/whiteboardStore'

const whiteboardStore = useWhiteboardStore()

const canModerate = computed(() => whiteboardStore.canModerate)
const isBoardFrozen = computed(() => whiteboardStore.isBoardFrozen)

async function toggleFreeze() {
  await whiteboardStore.sendFreeze(!isBoardFrozen.value)
}

async function clearPage() {
  if (!whiteboardStore.activePageId) return
  
  if (confirm('Clear this page? This action cannot be undone.')) {
    await whiteboardStore.sendClearPage(whiteboardStore.activePageId)
  }
}

function openPresenterMenu() {
  // TODO: Implement presenter selection menu
  console.log('[ModerationControls] Presenter menu not yet implemented')
}
</script>

<style scoped>
.moderation-controls {
  display: flex;
  gap: 8px;
  padding: 8px;
  background: rgba(255, 255, 255, 0.95);
  border-radius: 8px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
}

.moderation-btn {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 8px 12px;
  background: white;
  border: 1px solid #e0e0e0;
  border-radius: 6px;
  cursor: pointer;
  transition: all 0.2s ease;
  font-size: 13px;
  color: #333;
}

.moderation-btn:hover {
  background: #f5f5f5;
  border-color: #d0d0d0;
  transform: translateY(-1px);
}

.moderation-btn:active {
  transform: translateY(0);
}

.moderation-btn--active {
  background: #667eea;
  color: white;
  border-color: #667eea;
}

.moderation-btn--active:hover {
  background: #5568d3;
  border-color: #5568d3;
}

.moderation-btn__label {
  font-weight: 500;
}

@media (max-width: 768px) {
  .moderation-controls {
    gap: 6px;
    padding: 6px;
  }

  .moderation-btn {
    padding: 6px 10px;
    font-size: 12px;
  }

  .moderation-btn__label {
    display: none;
  }
}
</style>
