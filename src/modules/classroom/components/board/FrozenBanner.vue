<template>
  <div
    v-if="isBoardFrozen"
    class="frozen-banner"
    data-testid="frozen-banner"
  >
    <div class="frozen-banner__content">
      <svg
        class="frozen-banner__icon"
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
        <rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect>
        <path d="M7 11V7a5 5 0 0 1 10 0v4"></path>
      </svg>
      <span class="frozen-banner__text">
        {{ $t('whiteboard.moderation.frozen_notice') }}
      </span>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useWhiteboardStore } from '@/modules/classroom/stores/whiteboardStore'

const whiteboardStore = useWhiteboardStore()
const isBoardFrozen = computed(() => whiteboardStore.isBoardFrozen)
</script>

<style scoped>
.frozen-banner {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  z-index: 1000;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
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

.frozen-banner__content {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 12px;
  max-width: 1200px;
  margin: 0 auto;
}

.frozen-banner__icon {
  flex-shrink: 0;
}

.frozen-banner__text {
  font-size: 14px;
  font-weight: 500;
  letter-spacing: 0.02em;
}

@media (max-width: 768px) {
  .frozen-banner {
    padding: 10px 12px;
  }
  
  .frozen-banner__text {
    font-size: 13px;
  }
}
</style>
