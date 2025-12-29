<template>
  <div class="logs-section">
    <div class="section-header">
      <h3>API & WebSocket Logs</h3>
      <div class="section-actions">
        <button @click="clearLogs" class="btn-clear" title="Clear logs">
          <TrashIcon :size="16" />
          Clear
        </button>
        <button @click="copyLogs" class="btn-icon" title="Copy JSON">
          <CopyIcon :size="16" />
        </button>
        <button @click="toggleExpanded" class="btn-icon" title="Toggle expand">
          <ChevronDownIcon :size="16" :class="{ 'rotated': isExpanded }" />
        </button>
      </div>
    </div>

    <div v-if="isExpanded" class="section-content">
      <div class="tabs">
        <button
          :class="['tab', { active: activeLogType === 'api' }]"
          @click="activeLogType = 'api'"
        >
          API Logs ({{ apiLogs.length }})
        </button>
        <button
          :class="['tab', { active: activeLogType === 'ws' }]"
          @click="activeLogType = 'ws'"
        >
          WebSocket Logs ({{ wsLogs.length }})
        </button>
      </div>

      <div v-if="activeLogType === 'api'" class="logs-container">
        <div v-if="apiLogs.length === 0" class="empty-state">
          No API logs recorded yet
        </div>
        <div v-else class="logs-list">
          <div
            v-for="log in apiLogs"
            :key="log.id"
            :class="['log-entry', { error: log.status >= 400 }]"
          >
            <div class="log-header">
              <span :class="['method', log.method.toLowerCase()]">{{ log.method }}</span>
              <span class="url">{{ log.url }}</span>
              <span :class="['status', getStatusClass(log.status)]">{{ log.status }}</span>
              <span class="duration">{{ log.durationMs }}ms</span>
            </div>
            <div class="log-meta">
              <span class="time">{{ formatTime(log.at) }}</span>
              <span class="size">{{ formatSize(log.payloadSize) }}</span>
            </div>
            <div v-if="log.params" class="log-params">
              <strong>Params:</strong> {{ JSON.stringify(log.params) }}
            </div>
            <div v-if="log.error" class="log-error">
              <strong>Error:</strong> {{ log.error }}
            </div>
          </div>
        </div>
      </div>

      <div v-if="activeLogType === 'ws'" class="logs-container">
        <div v-if="wsLogs.length === 0" class="empty-state">
          No WebSocket logs recorded yet
        </div>
        <div v-else class="logs-list">
          <div
            v-for="log in wsLogs"
            :key="log.id"
            :class="['log-entry', { error: log.type === 'error' }]"
          >
            <div class="log-header">
              <span :class="['ws-type', log.type]">{{ log.type }}</span>
              <span class="time">{{ formatTime(log.at) }}</span>
            </div>
            <div v-if="log.payload" class="log-payload">
              <pre>{{ JSON.stringify(log.payload, null, 2) }}</pre>
            </div>
            <div v-if="log.error" class="log-error">
              <strong>Error:</strong> {{ log.error }}
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { Copy as CopyIcon, ChevronDown as ChevronDownIcon, Trash as TrashIcon } from 'lucide-vue-next'
import type { ApiLogEntry, WebSocketLogEntry } from '../types/calendarDebug'

interface Props {
  apiLogs: ApiLogEntry[]
  wsLogs: WebSocketLogEntry[]
}

const props = defineProps<Props>()
const emit = defineEmits<{
  clearLogs: []
}>()

const isExpanded = ref(true)
const activeLogType = ref<'api' | 'ws'>('api')

function toggleExpanded() {
  isExpanded.value = !isExpanded.value
}

async function copyLogs() {
  try {
    const logs = activeLogType.value === 'api' ? props.apiLogs : props.wsLogs
    await navigator.clipboard.writeText(JSON.stringify(logs, null, 2))
  } catch (err) {
    console.error('Failed to copy:', err)
  }
}

function clearLogs() {
  emit('clearLogs')
}

function formatTime(isoString: string): string {
  try {
    const date = new Date(isoString)
    return date.toLocaleTimeString('uk-UA', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
  } catch {
    return isoString
  }
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes}B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)}MB`
}

function getStatusClass(status: number): string {
  if (status >= 200 && status < 300) return 'success'
  if (status >= 400 && status < 500) return 'client-error'
  if (status >= 500) return 'server-error'
  return 'unknown'
}
</script>

<style scoped>
.logs-section {
  background: white;
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  overflow: hidden;
}

.section-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px 16px;
  background: #f9fafb;
  border-bottom: 1px solid #e5e7eb;
}

.section-header h3 {
  margin: 0;
  font-size: 14px;
  font-weight: 600;
  color: #111827;
}

.section-actions {
  display: flex;
  gap: 8px;
}

.btn-icon,
.btn-clear {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 4px;
  height: 28px;
  padding: 0 8px;
  border: none;
  background: white;
  border-radius: 4px;
  cursor: pointer;
  transition: background-color 0.2s;
  font-size: 12px;
  color: #374151;
}

.btn-icon {
  width: 28px;
  padding: 0;
}

.btn-icon:hover,
.btn-clear:hover {
  background: #e5e7eb;
}

.btn-clear {
  color: #dc2626;
}

.rotated {
  transform: rotate(180deg);
  transition: transform 0.2s;
}

.section-content {
  padding: 0;
}

.tabs {
  display: flex;
  border-bottom: 1px solid #e5e7eb;
  background: #f9fafb;
}

.tab {
  flex: 1;
  padding: 10px 16px;
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
  color: #3b82f6;
  border-bottom-color: #3b82f6;
  background: white;
}

.logs-container {
  padding: 16px;
  max-height: 500px;
  overflow-y: auto;
}

.empty-state {
  text-align: center;
  padding: 32px;
  color: #9ca3af;
  font-size: 13px;
}

.logs-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.log-entry {
  background: #f9fafb;
  border: 1px solid #e5e7eb;
  border-radius: 6px;
  padding: 12px;
  transition: border-color 0.2s;
}

.log-entry:hover {
  border-color: #d1d5db;
}

.log-entry.error {
  background: #fef2f2;
  border-color: #fecaca;
}

.log-header {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 6px;
}

.method,
.ws-type {
  padding: 2px 8px;
  border-radius: 4px;
  font-size: 11px;
  font-weight: 600;
  text-transform: uppercase;
}

.method.get {
  background: #dbeafe;
  color: #1e40af;
}

.method.post {
  background: #d1fae5;
  color: #065f46;
}

.method.put,
.method.patch {
  background: #fef3c7;
  color: #92400e;
}

.method.delete {
  background: #fee2e2;
  color: #991b1b;
}

.ws-type {
  background: #e0e7ff;
  color: #3730a3;
}

.ws-type.error {
  background: #fee2e2;
  color: #991b1b;
}

.url {
  flex: 1;
  font-size: 12px;
  color: #374151;
  font-family: 'Courier New', monospace;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.status {
  padding: 2px 6px;
  border-radius: 3px;
  font-size: 11px;
  font-weight: 600;
}

.status.success {
  background: #d1fae5;
  color: #065f46;
}

.status.client-error {
  background: #fef3c7;
  color: #92400e;
}

.status.server-error {
  background: #fee2e2;
  color: #991b1b;
}

.duration {
  font-size: 11px;
  color: #6b7280;
  font-family: 'Courier New', monospace;
}

.log-meta {
  display: flex;
  gap: 12px;
  font-size: 11px;
  color: #9ca3af;
  margin-bottom: 6px;
}

.log-params,
.log-error {
  font-size: 12px;
  margin-top: 8px;
  padding: 8px;
  background: white;
  border-radius: 4px;
}

.log-error {
  color: #dc2626;
}

.log-payload pre {
  margin: 8px 0 0 0;
  padding: 8px;
  background: #1f2937;
  border-radius: 4px;
  font-size: 11px;
  color: #d1d5db;
  overflow-x: auto;
}
</style>
