<template>
  <button
    v-if="isDebugMode"
    class="debug-toggle-button"
    @click="togglePanel"
    :title="isPanelOpen ? 'Close debug panel' : 'Open debug panel'"
  >
    <BugIcon :size="18" />
    <span class="button-label">Debug</span>
    <span v-if="logsCount > 0" class="badge">{{ logsCount }}</span>
  </button>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { Bug as BugIcon } from 'lucide-vue-next'
import { useCalendarDebugSnapshot } from '../composables/useCalendarDebugSnapshot'

const { isPanelOpen, togglePanel, isDebugMode, apiLogs, wsLogs } = useCalendarDebugSnapshot()

const logsCount = computed(() => apiLogs.value.length + wsLogs.value.length)
</script>

<style scoped>
.debug-toggle-button {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 12px;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
  border: none;
  border-radius: 8px;
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;
  box-shadow: 0 2px 8px rgba(102, 126, 234, 0.3);
  position: relative;
}

.debug-toggle-button:hover {
  transform: translateY(-1px);
  box-shadow: 0 4px 12px rgba(102, 126, 234, 0.4);
}

.debug-toggle-button:active {
  transform: translateY(0);
}

.button-label {
  font-weight: 600;
}

.badge {
  display: flex;
  align-items: center;
  justify-content: center;
  min-width: 18px;
  height: 18px;
  padding: 0 5px;
  background: rgba(255, 255, 255, 0.3);
  border-radius: 9px;
  font-size: 11px;
  font-weight: 700;
}
</style>
