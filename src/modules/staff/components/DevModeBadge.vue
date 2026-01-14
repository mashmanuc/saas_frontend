<template>
  <div v-if="isDev" class="dev-mode-badge" title="Development Mode - Manual finalize available">
    <span class="badge-icon">🔧</span>
    <span class="badge-text">DEV MODE</span>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'

const isDev = computed(() => {
  return import.meta.env.DEV || import.meta.env.MODE === 'development'
})

// Log dev mode status on mount
if (isDev.value) {
  console.log('[BillingOps] Running in DEV MODE - manual finalize operations enabled')
}
</script>

<style scoped>
.dev-mode-badge {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 4px 12px;
  background: linear-gradient(135deg, #ff9800 0%, #f57c00 100%);
  color: white;
  border-radius: 4px;
  font-size: 12px;
  font-weight: 600;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
  animation: pulse 2s ease-in-out infinite;
}

.badge-icon {
  font-size: 14px;
}

.badge-text {
  letter-spacing: 0.5px;
}

@keyframes pulse {
  0%, 100% {
    opacity: 1;
  }
  50% {
    opacity: 0.8;
  }
}
</style>
