<template>
  <div v-if="isDebugMode && isPanelOpen" class="calendar-debug-panel">
    <div class="panel-header">
      <div class="panel-title">
        <BugIcon :size="18" />
        <h2>Calendar Debug Panel</h2>
        <span class="version-badge">v0.55</span>
      </div>
      <div class="panel-actions">
        <button @click="captureNow" class="btn-action" title="Capture snapshot now">
          <CameraIcon :size="16" />
          Capture
        </button>
        <button @click="downloadDebugBundle" class="btn-action" title="Download debug bundle">
          <DownloadIcon :size="16" />
          Export
        </button>
        <button @click="copyDebugBundle" class="btn-action" title="Copy to clipboard">
          <CopyIcon :size="16" />
          Copy
        </button>
        <button @click="closePanel" class="btn-close" title="Close panel">
          <XIcon :size="18" />
        </button>
      </div>
    </div>

    <div class="panel-tabs">
      <button
        v-for="tab in tabs"
        :key="tab.id"
        :class="['tab', { active: activeTab === tab.id }]"
        @click="setActiveTab(tab.id as 'snapshot' | 'metadata' | 'logs')"
      >
        {{ tab.label }}
      </button>
    </div>

    <div class="panel-content">
      <SnapshotSection
        v-if="activeTab === 'snapshot'"
        :snapshot="v055Snapshot"
      />
      <MetadataSection
        v-if="activeTab === 'metadata'"
        :meta="v055Snapshot.meta"
        :dictionaries="v055Snapshot.dictionaries"
        :stats="stats"
      />
      <LogsSection
        v-if="activeTab === 'logs'"
        :api-logs="apiLogs"
        :ws-logs="wsLogs"
        @clear-logs="clearAllLogs"
      />
    </div>

    <div class="panel-footer">
      <div class="footer-info">
        <span class="info-item">
          <ActivityIcon :size="14" />
          Recording: <strong>{{ isDebugMode ? 'Active' : 'Inactive' }}</strong>
        </span>
        <span class="info-item">
          <DatabaseIcon :size="14" />
          Bundle size: <strong>{{ formatSize(bundleSize) }}</strong>
        </span>
        <span class="info-item">
          <ClockIcon :size="14" />
          Last update: <strong>{{ lastUpdateTime }}</strong>
        </span>
      </div>
      <button @click="clearAllLogs" class="btn-clear-all">
        <TrashIcon :size="14" />
        Clear All
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, onUnmounted } from 'vue'
import {
  Bug as BugIcon,
  Camera as CameraIcon,
  Download as DownloadIcon,
  Copy as CopyIcon,
  X as XIcon,
  Activity as ActivityIcon,
  Database as DatabaseIcon,
  Clock as ClockIcon,
  Trash as TrashIcon,
} from 'lucide-vue-next'
import { useCalendarDebugSnapshot } from '../composables/useCalendarDebugSnapshot'
import SnapshotSection from './SnapshotSection.vue'
import MetadataSection from './MetadataSection.vue'
import LogsSection from './LogsSection.vue'

const {
  isPanelOpen,
  activeTab,
  isDebugMode,
  v055Snapshot,
  apiLogs,
  wsLogs,
  stats,
  downloadDebugBundle,
  copyDebugBundle,
  clearAllLogs,
  closePanel,
  openPanel,
  setActiveTab,
  captureNow,
} = useCalendarDebugSnapshot()

// Global event handlers for window.__M4_DEBUG__.calendar
onMounted(() => {
  window.addEventListener('calendar-debug:open', openPanel)
  window.addEventListener('calendar-debug:close', closePanel)
  window.addEventListener('calendar-debug:export', downloadDebugBundle)
  window.addEventListener('calendar-debug:capture', captureNow)
})

onUnmounted(() => {
  window.removeEventListener('calendar-debug:open', openPanel)
  window.removeEventListener('calendar-debug:close', closePanel)
  window.removeEventListener('calendar-debug:export', downloadDebugBundle)
  window.removeEventListener('calendar-debug:capture', captureNow)
})

const tabs = [
  { id: 'snapshot', label: 'V0.55 Snapshot' },
  { id: 'metadata', label: 'Metadata' },
  { id: 'logs', label: 'Logs' },
]

const bundleSize = computed(() => {
  try {
    const bundle = {
      v055: v055Snapshot.value,
      apiLogs: apiLogs.value,
      wsLogs: wsLogs.value,
    }
    return JSON.stringify(bundle).length
  } catch {
    return 0
  }
})

const lastUpdateTime = computed(() => {
  const now = new Date()
  return now.toLocaleTimeString('uk-UA', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
})

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes}B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}KB`
  return `${(bytes / (1024 * 1024)).toFixed(2)}MB`
}
</script>

<style scoped>
.calendar-debug-panel {
  position: fixed;
  top: 0;
  right: 0;
  width: 600px;
  height: 100vh;
  background: white;
  border-left: 1px solid #e5e7eb;
  box-shadow: -4px 0 24px rgba(0, 0, 0, 0.1);
  display: flex;
  flex-direction: column;
  z-index: 9999;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
}

.panel-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16px 20px;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
  border-bottom: 1px solid rgba(255, 255, 255, 0.1);
}

.panel-title {
  display: flex;
  align-items: center;
  gap: 10px;
}

.panel-title h2 {
  margin: 0;
  font-size: 16px;
  font-weight: 600;
}

.version-badge {
  padding: 2px 8px;
  background: rgba(255, 255, 255, 0.2);
  border-radius: 12px;
  font-size: 11px;
  font-weight: 600;
}

.panel-actions {
  display: flex;
  gap: 8px;
}

.btn-action,
.btn-close {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 6px 12px;
  border: 1px solid rgba(255, 255, 255, 0.3);
  background: rgba(255, 255, 255, 0.1);
  color: white;
  border-radius: 6px;
  font-size: 12px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;
}

.btn-action:hover {
  background: rgba(255, 255, 255, 0.2);
  border-color: rgba(255, 255, 255, 0.4);
}

.btn-close {
  padding: 6px;
}

.btn-close:hover {
  background: rgba(255, 255, 255, 0.2);
}

.panel-tabs {
  display: flex;
  background: #f9fafb;
  border-bottom: 1px solid #e5e7eb;
}

.tab {
  flex: 1;
  padding: 12px 16px;
  border: none;
  background: transparent;
  font-size: 13px;
  font-weight: 500;
  color: #6b7280;
  cursor: pointer;
  transition: all 0.2s;
  border-bottom: 2px solid transparent;
}

.tab:hover {
  color: #111827;
  background: #f3f4f6;
}

.tab.active {
  color: #667eea;
  border-bottom-color: #667eea;
  background: white;
}

.panel-content {
  flex: 1;
  overflow-y: auto;
  padding: 16px;
  background: #fafafa;
}

.panel-footer {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px 20px;
  background: #f9fafb;
  border-top: 1px solid #e5e7eb;
}

.footer-info {
  display: flex;
  gap: 16px;
  flex-wrap: wrap;
}

.info-item {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  color: #6b7280;
}

.info-item strong {
  color: #111827;
}

.btn-clear-all {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 6px 12px;
  border: 1px solid #fecaca;
  background: #fee2e2;
  color: #dc2626;
  border-radius: 6px;
  font-size: 12px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;
}

.btn-clear-all:hover {
  background: #fecaca;
  border-color: #fca5a5;
}
</style>
