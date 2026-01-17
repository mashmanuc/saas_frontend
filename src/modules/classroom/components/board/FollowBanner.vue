<template>
  <div
    v-if="isFollowModeActive && presenterPageId"
    class="follow-banner"
    data-testid="follow-banner"
  >
    <div class="follow-banner__content">
      <svg
        class="follow-banner__icon"
        xmlns="http://www.w3.org/2000/svg"
        width="20"
        height="20"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="2"
        stroke-linecap="round"
        stroke-linejoin="round"
      >
        <path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z"></path>
      </svg>
      <span class="follow-banner__text">
        {{ $t('whiteboard.followMode.following_presenter') }}
      </span>
      <button
        class="follow-banner__stop"
        @click="stopFollowing"
        data-testid="stop-follow-button"
      >
        {{ $t('whiteboard.followMode.stop_following') }}
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useWhiteboardStore } from '@/modules/classroom/stores/whiteboardStore'

const whiteboardStore = useWhiteboardStore()
const isFollowModeActive = computed(() => whiteboardStore.isFollowModeActive)
const presenterPageId = computed(() => whiteboardStore.presenterPageId)

function stopFollowing() {
  whiteboardStore.toggleFollowMode()
}
</script>

<style scoped>
.follow-banner {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  z-index: 1000;
  background: linear-gradient(135deg, #4facfe 0%, #00f2fe 100%);
  color: white;
  padding: 12px 16px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
  animation: slideDown 0.3s ease-out;
}

@keyframes slideDown {
  from {
    transform: translateY(-100%);
    opacity: 0;
  }
  to {
    transform: translateY(0);
    opacity: 1;
  }
}

.follow-banner__content {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 12px;
  max-width: 1200px;
  margin: 0 auto;
}

.follow-banner__icon {
  flex-shrink: 0;
}

.follow-banner__text {
  font-size: 14px;
  font-weight: 500;
  letter-spacing: 0.02em;
}

.follow-banner__stop {
  background: rgba(255, 255, 255, 0.2);
  border: 1px solid rgba(255, 255, 255, 0.3);
  color: white;
  padding: 6px 16px;
  border-radius: 6px;
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s ease;
}

.follow-banner__stop:hover {
  background: rgba(255, 255, 255, 0.3);
  border-color: rgba(255, 255, 255, 0.5);
}

.follow-banner__stop:active {
  transform: scale(0.98);
}

@media (max-width: 768px) {
  .follow-banner {
    padding: 10px 12px;
  }
  
  .follow-banner__text {
    font-size: 13px;
  }
  
  .follow-banner__stop {
    padding: 5px 12px;
    font-size: 12px;
  }
}
</style>
