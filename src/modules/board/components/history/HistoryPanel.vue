<script setup lang="ts">
import { ref } from 'vue'
import { Clock, Save, RotateCcw } from 'lucide-vue-next'
import type { HistoryEntry, BoardVersion } from '@/core/board/types'

interface Props {
  entries: HistoryEntry[]
  versions: BoardVersion[]
}

defineProps<Props>()

const emit = defineEmits<{
  (e: 'create-version', name: string, description?: string): void
  (e: 'restore-version', id: number): void
}>()

const showCreateModal = ref(false)
const versionName = ref('')
const versionDescription = ref('')

function formatTime(timestamp: number): string {
  const date = new Date(timestamp)
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
}

function formatAction(action: string): string {
  const actions: Record<string, string> = {
    create: 'Created',
    update: 'Updated',
    delete: 'Deleted',
    move: 'Moved',
    transform: 'Transformed',
    batch: 'Multiple changes',
  }
  return actions[action] || action
}

function handleCreateVersion() {
  if (!versionName.value.trim()) return
  emit('create-version', versionName.value, versionDescription.value || undefined)
  versionName.value = ''
  versionDescription.value = ''
  showCreateModal.value = false
}
</script>

<template>
  <div class="history-panel">
    <div class="panel-header">
      <h3>History</h3>
      <button class="icon-btn" title="Save Version" @click="showCreateModal = true">
        <Save :size="18" />
      </button>
    </div>

    <!-- Versions -->
    <div v-if="versions.length > 0" class="versions-section">
      <h4>Saved Versions</h4>
      <div class="versions-list">
        <div
          v-for="version in versions"
          :key="version.id"
          class="version-item"
        >
          <div class="version-info">
            <span class="version-name">{{ version.name }}</span>
            <span class="version-date">{{ new Date(version.createdAt).toLocaleDateString() }}</span>
          </div>
          <button
            class="icon-btn small"
            title="Restore"
            @click="emit('restore-version', version.id)"
          >
            <RotateCcw :size="14" />
          </button>
        </div>
      </div>
    </div>

    <!-- History entries -->
    <div class="history-section">
      <h4>Recent Changes</h4>
      <div class="history-list">
        <div
          v-for="entry in entries.slice(-20).reverse()"
          :key="entry.id"
          class="history-item"
        >
          <Clock :size="14" class="history-icon" />
          <div class="history-info">
            <span class="history-action">{{ formatAction(entry.action) }}</span>
            <span class="history-time">{{ formatTime(entry.timestamp) }}</span>
          </div>
        </div>

        <div v-if="entries.length === 0" class="empty-state">
          No history yet
        </div>
      </div>
    </div>

    <!-- Create version modal -->
    <div v-if="showCreateModal" class="modal-overlay" @click.self="showCreateModal = false">
      <div class="modal">
        <h3>Save Version</h3>
        <input
          v-model="versionName"
          type="text"
          placeholder="Version name"
          class="input"
        />
        <textarea
          v-model="versionDescription"
          placeholder="Description (optional)"
          class="input"
          rows="3"
        />
        <div class="modal-actions">
          <button class="btn secondary" @click="showCreateModal = false">Cancel</button>
          <button class="btn primary" @click="handleCreateVersion">Save</button>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.history-panel {
  display: flex;
  flex-direction: column;
  height: 100%;
}

.panel-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0.75rem 1rem;
  border-bottom: 1px solid #e0e0e0;
}

.panel-header h3 {
  font-size: 0.875rem;
  font-weight: 600;
  margin: 0;
}

.versions-section,
.history-section {
  padding: 0.75rem 1rem;
}

.versions-section h4,
.history-section h4 {
  font-size: 0.75rem;
  font-weight: 600;
  color: #666;
  margin: 0 0 0.5rem;
  text-transform: uppercase;
}

.versions-list,
.history-list {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.version-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0.5rem;
  background: #f5f5f5;
  border-radius: 6px;
}

.version-info {
  display: flex;
  flex-direction: column;
}

.version-name {
  font-size: 0.875rem;
  font-weight: 500;
}

.version-date {
  font-size: 0.75rem;
  color: #666;
}

.history-item {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.375rem 0;
}

.history-icon {
  color: #999;
  flex-shrink: 0;
}

.history-info {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  flex: 1;
}

.history-action {
  font-size: 0.8125rem;
}

.history-time {
  font-size: 0.75rem;
  color: #999;
}

.empty-state {
  padding: 1rem;
  text-align: center;
  color: #999;
  font-size: 0.875rem;
}

.icon-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  border: none;
  background: transparent;
  border-radius: 4px;
  cursor: pointer;
  color: #666;
}

.icon-btn:hover {
  background: #e0e0e0;
}

.icon-btn.small {
  width: 24px;
  height: 24px;
}

.modal-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}

.modal {
  background: white;
  padding: 1.5rem;
  border-radius: 12px;
  width: 100%;
  max-width: 400px;
}

.modal h3 {
  margin: 0 0 1rem;
}

.input {
  width: 100%;
  padding: 0.75rem;
  border: 1px solid #e0e0e0;
  border-radius: 6px;
  font-size: 0.875rem;
  margin-bottom: 0.75rem;
}

.input:focus {
  outline: none;
  border-color: #3b82f6;
}

.modal-actions {
  display: flex;
  gap: 0.5rem;
  justify-content: flex-end;
}

.btn {
  padding: 0.5rem 1rem;
  border: none;
  border-radius: 6px;
  font-size: 0.875rem;
  cursor: pointer;
}

.btn.primary {
  background: #3b82f6;
  color: white;
}

.btn.secondary {
  background: #f0f0f0;
  color: #333;
}
</style>
