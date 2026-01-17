<template>
  <div v-if="visible" class="whiteboard-debug-panel" :class="{ 'debug-panel--collapsed': collapsed }">
    <div class="debug-panel__header">
      <h4 class="debug-panel__title">Whiteboard Debug</h4>
      <div class="debug-panel__actions">
        <button @click="collapsed = !collapsed" class="debug-btn" :title="collapsed ? 'Expand' : 'Collapse'">
          {{ collapsed ? '▼' : '▲' }}
        </button>
        <button @click="visible = false" class="debug-btn" title="Close">×</button>
      </div>
    </div>

    <div v-if="!collapsed" class="debug-panel__content">
      <section class="debug-section">
        <h5 class="debug-section__title">Layout</h5>
        <div class="debug-row">
          <span class="debug-label">Vertical Layout:</span>
          <span class="debug-value" :class="{ 'debug-value--active': metrics.verticalLayoutEnabled }">
            {{ metrics.verticalLayoutEnabled ? 'Enabled' : 'Disabled' }}
          </span>
        </div>
        <div class="debug-row">
          <span class="debug-label">Task Dock:</span>
          <span class="debug-value">{{ metrics.taskDockState }}</span>
        </div>
        <div class="debug-row">
          <span class="debug-label">Sidebar:</span>
          <span class="debug-value">{{ metrics.sidebarCollapsed ? 'Collapsed' : 'Expanded' }}</span>
        </div>
      </section>

      <section class="debug-section">
        <h5 class="debug-section__title">Pages</h5>
        <div class="debug-row">
          <span class="debug-label">Total Pages:</span>
          <span class="debug-value">{{ metrics.totalPages }}</span>
        </div>
        <div class="debug-row">
          <span class="debug-label">Active Page:</span>
          <span class="debug-value">{{ metrics.activePageId || 'None' }}</span>
        </div>
        <div class="debug-row">
          <span class="debug-label">Visible Pages:</span>
          <span class="debug-value">{{ metrics.visiblePagesCount }}</span>
        </div>
      </section>

      <section class="debug-section">
        <h5 class="debug-section__title">Follow Mode</h5>
        <div class="debug-row">
          <span class="debug-label">Active:</span>
          <span class="debug-value" :class="{ 'debug-value--active': metrics.followModeActive }">
            {{ metrics.followModeActive ? 'Yes' : 'No' }}
          </span>
        </div>
        <div class="debug-row">
          <span class="debug-label">Presenter Page:</span>
          <span class="debug-value">{{ metrics.presenterPageId || 'None' }}</span>
        </div>
        <div class="debug-row">
          <span class="debug-label">Scroll Latency:</span>
          <span class="debug-value" :class="getLatencyClass(metrics.scrollLatency)">
            {{ metrics.scrollLatency }}ms
          </span>
        </div>
      </section>

      <section class="debug-section">
        <h5 class="debug-section__title">Performance</h5>
        <div class="debug-row">
          <span class="debug-label">Scroll Desync:</span>
          <span class="debug-value" :class="getDesyncClass(metrics.scrollDesync)">
            {{ metrics.scrollDesync.toFixed(2) }}%
          </span>
        </div>
        <div class="debug-row">
          <span class="debug-label">Render Count:</span>
          <span class="debug-value">{{ metrics.renderCount }}</span>
        </div>
        <div class="debug-row">
          <span class="debug-label">Last Update:</span>
          <span class="debug-value">{{ formatTimestamp(metrics.lastUpdate) }}</span>
        </div>
      </section>

      <section class="debug-section">
        <h5 class="debug-section__title">Actions</h5>
        <button @click="resetMetrics" class="debug-btn debug-btn--primary">Reset Metrics</button>
        <button @click="exportMetrics" class="debug-btn debug-btn--secondary">Export JSON</button>
      </section>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'

interface DebugMetrics {
  verticalLayoutEnabled: boolean
  taskDockState: string
  sidebarCollapsed: boolean
  totalPages: number
  activePageId: string | null
  visiblePagesCount: number
  followModeActive: boolean
  presenterPageId: string | null
  scrollLatency: number
  scrollDesync: number
  renderCount: number
  lastUpdate: number
}

interface Props {
  metrics: DebugMetrics
}

const props = defineProps<Props>()

const emit = defineEmits<{
  reset: []
  export: []
}>()

const visible = ref(import.meta.env.DEV)
const collapsed = ref(false)

function getLatencyClass(latency: number): string {
  if (latency < 50) return 'debug-value--success'
  if (latency < 100) return 'debug-value--warning'
  return 'debug-value--error'
}

function getDesyncClass(desync: number): string {
  if (desync < 1) return 'debug-value--success'
  if (desync < 5) return 'debug-value--warning'
  return 'debug-value--error'
}

function formatTimestamp(ts: number): string {
  if (!ts) return 'Never'
  const now = Date.now()
  const diff = now - ts
  if (diff < 1000) return 'Just now'
  if (diff < 60000) return `${Math.floor(diff / 1000)}s ago`
  return `${Math.floor(diff / 60000)}m ago`
}

function resetMetrics() {
  emit('reset')
}

function exportMetrics() {
  emit('export')
  const json = JSON.stringify(props.metrics, null, 2)
  const blob = new Blob([json], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `whiteboard-metrics-${Date.now()}.json`
  a.click()
  URL.revokeObjectURL(url)
}

// Expose visibility toggle for external control
defineExpose({
  show: () => { visible.value = true },
  hide: () => { visible.value = false },
  toggle: () => { visible.value = !visible.value }
})
</script>

<style scoped>
.whiteboard-debug-panel {
  position: fixed;
  bottom: 1rem;
  right: 1rem;
  width: 320px;
  background: rgba(0, 0, 0, 0.9);
  color: #fff;
  border-radius: 8px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
  font-family: 'Courier New', monospace;
  font-size: 0.75rem;
  z-index: 9999;
  backdrop-filter: blur(10px);
}

.debug-panel--collapsed {
  width: auto;
}

.debug-panel__header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 0.75rem;
  border-bottom: 1px solid rgba(255, 255, 255, 0.1);
}

.debug-panel__title {
  margin: 0;
  font-size: 0.875rem;
  font-weight: 600;
}

.debug-panel__actions {
  display: flex;
  gap: 0.5rem;
}

.debug-btn {
  background: rgba(255, 255, 255, 0.1);
  border: none;
  color: #fff;
  padding: 0.25rem 0.5rem;
  border-radius: 4px;
  cursor: pointer;
  font-size: 0.75rem;
  transition: background 0.2s;
}

.debug-btn:hover {
  background: rgba(255, 255, 255, 0.2);
}

.debug-btn--primary {
  background: rgba(59, 130, 246, 0.3);
  padding: 0.5rem 1rem;
  width: 100%;
}

.debug-btn--primary:hover {
  background: rgba(59, 130, 246, 0.5);
}

.debug-btn--secondary {
  background: rgba(107, 114, 128, 0.3);
  padding: 0.5rem 1rem;
  width: 100%;
  margin-top: 0.5rem;
}

.debug-btn--secondary:hover {
  background: rgba(107, 114, 128, 0.5);
}

.debug-panel__content {
  padding: 0.75rem;
  max-height: 500px;
  overflow-y: auto;
}

.debug-section {
  margin-bottom: 1rem;
  padding-bottom: 1rem;
  border-bottom: 1px solid rgba(255, 255, 255, 0.1);
}

.debug-section:last-child {
  border-bottom: none;
  margin-bottom: 0;
}

.debug-section__title {
  margin: 0 0 0.5rem 0;
  font-size: 0.75rem;
  text-transform: uppercase;
  color: rgba(255, 255, 255, 0.6);
  letter-spacing: 0.05em;
}

.debug-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 0.25rem 0;
}

.debug-label {
  color: rgba(255, 255, 255, 0.7);
}

.debug-value {
  font-weight: 600;
  color: #fff;
}

.debug-value--active {
  color: #10b981;
}

.debug-value--success {
  color: #10b981;
}

.debug-value--warning {
  color: #f59e0b;
}

.debug-value--error {
  color: #ef4444;
}
</style>
