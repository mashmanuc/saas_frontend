<template>
  <div v-if="safeMode" class="safe-mode-banner" data-testid="safe-mode-banner">
    <div class="safe-mode-content">
      <div class="safe-mode-icon">
        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
          <line x1="12" y1="9" x2="12" y2="13"/>
          <line x1="12" y1="17" x2="12.01" y2="17"/>
        </svg>
      </div>
      <div class="safe-mode-text">
        <strong>{{ t('whiteboard.safe_mode_title') }}</strong>
        <span>{{ t('whiteboard.safe_mode_message') }}</span>
      </div>
      <div class="safe-mode-stats">
        <span class="stat-badge">
          {{ t('whiteboard.safe_mode_pending_ops', { count: pendingOpsCount }) }}
        </span>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { useWhiteboardStore } from '../../stores/whiteboardStore'

const { t } = useI18n()
const store = useWhiteboardStore()

const safeMode = computed(() => store.safeMode)
const pendingOpsCount = computed(() => store.pendingOps.size)
</script>

<style scoped>
.safe-mode-banner {
  position: fixed;
  top: 60px;
  left: 0;
  right: 0;
  z-index: 1000;
  background: linear-gradient(135deg, #ff6b6b 0%, #ee5a6f 100%);
  color: white;
  padding: 12px 20px;
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

.safe-mode-content {
  display: flex;
  align-items: center;
  gap: 12px;
  max-width: 1200px;
  margin: 0 auto;
}

.safe-mode-icon {
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  background: rgba(255, 255, 255, 0.2);
  border-radius: 50%;
  animation: pulse 2s ease-in-out infinite;
}

@keyframes pulse {
  0%, 100% {
    transform: scale(1);
    opacity: 1;
  }
  50% {
    transform: scale(1.05);
    opacity: 0.9;
  }
}

.safe-mode-text {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.safe-mode-text strong {
  font-size: 14px;
  font-weight: 600;
}

.safe-mode-text span {
  font-size: 13px;
  opacity: 0.95;
}

.safe-mode-stats {
  display: flex;
  gap: 8px;
}

.stat-badge {
  padding: 4px 12px;
  background: rgba(255, 255, 255, 0.25);
  border-radius: 12px;
  font-size: 12px;
  font-weight: 500;
  white-space: nowrap;
}

@media (max-width: 768px) {
  .safe-mode-banner {
    padding: 10px 16px;
  }
  
  .safe-mode-content {
    flex-wrap: wrap;
  }
  
  .safe-mode-stats {
    width: 100%;
    margin-top: 4px;
  }
}
</style>
