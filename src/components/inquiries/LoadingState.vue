<template>
  <div class="loading-state">
    <div class="spinner">
      <svg class="spinner-icon" viewBox="0 0 50 50">
        <circle
          class="spinner-path"
          cx="25"
          cy="25"
          r="20"
          fill="none"
          stroke-width="4"
        />
      </svg>
    </div>
    <p v-if="message" class="loading-message">{{ message }}</p>
  </div>
</template>

<script setup lang="ts">
/**
 * LoadingState Component (Phase 1 v0.86)
 * 
 * Відображає стан завантаження для inquiries
 */

defineProps<{
  message?: string
}>()
</script>

<style scoped>
.loading-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 48px 24px;
}

.spinner {
  width: 48px;
  height: 48px;
  margin-bottom: 16px;
}

.spinner-icon {
  animation: rotate 2s linear infinite;
  width: 100%;
  height: 100%;
}

.spinner-path {
  stroke: #4F46E5;
  stroke-linecap: round;
  animation: dash 1.5s ease-in-out infinite;
}

@keyframes rotate {
  100% {
    transform: rotate(360deg);
  }
}

@keyframes dash {
  0% {
    stroke-dasharray: 1, 150;
    stroke-dashoffset: 0;
  }
  50% {
    stroke-dasharray: 90, 150;
    stroke-dashoffset: -35;
  }
  100% {
    stroke-dasharray: 90, 150;
    stroke-dashoffset: -124;
  }
}

.loading-message {
  margin: 0;
  font-size: 14px;
  color: #6B7280;
}
</style>
