<template>
  <div class="modal-overlay" @click.self="$emit('close')">
    <div class="modal-content">
      <div class="modal-header">
        <h2>Історія дошки</h2>
        <button class="close-btn" @click="$emit('close')">
          <X class="w-5 h-5" />
        </button>
      </div>

      <div class="modal-body">
        <!-- Loading -->
        <div v-if="isLoading" class="loading-state">
          <Loader2 class="w-8 h-8 animate-spin" />
          <p>Завантаження історії...</p>
        </div>

        <!-- Empty -->
        <div v-else-if="snapshots.length === 0" class="empty-state">
          <History class="w-12 h-12 text-gray-400" />
          <p>Історія порожня</p>
        </div>

        <!-- Snapshots List -->
        <div v-else class="snapshots-list">
          <div
            v-for="snapshot in snapshots"
            :key="snapshot.id"
            class="snapshot-item"
            :class="{ selected: selectedVersion === snapshot.version }"
            @click="selectedVersion = snapshot.version"
          >
            <div class="snapshot-info">
              <span class="snapshot-version">v{{ snapshot.version }}</span>
              <span class="snapshot-date">{{ formatDate(snapshot.created_at) }}</span>
            </div>
            <div class="snapshot-author">
              {{ snapshot.created_by.name }}
            </div>
          </div>
        </div>
      </div>

      <div class="modal-footer">
        <button class="btn btn-secondary" @click="$emit('close')">
          Скасувати
        </button>
        <button
          class="btn btn-primary"
          :disabled="!selectedVersion"
          @click="handleRestore"
        >
          <RotateCcw class="w-4 h-4 mr-2" />
          Відновити
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { X, Loader2, History, RotateCcw } from 'lucide-vue-next'
import { classroomApi, type BoardSnapshot } from '../../api/classroom'

interface Props {
  sessionId: string
}

const props = defineProps<Props>()

const emit = defineEmits<{
  (e: 'close'): void
  (e: 'restore', version: number): void
}>()

const isLoading = ref(true)
const snapshots = ref<BoardSnapshot[]>([])
const selectedVersion = ref<number | null>(null)

onMounted(async () => {
  try {
    snapshots.value = await classroomApi.getHistory(props.sessionId)
  } catch (error) {
    console.error('Failed to load history:', error)
  } finally {
    isLoading.value = false
  }
})

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleString('uk-UA', {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function handleRestore(): void {
  if (selectedVersion.value) {
    emit('restore', selectedVersion.value)
  }
}
</script>

<style scoped>
.modal-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.7);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 100;
  padding: 24px;
}

.modal-content {
  background: var(--color-bg-primary, #1f2937);
  border-radius: 16px;
  width: 100%;
  max-width: 500px;
  max-height: 80vh;
  display: flex;
  flex-direction: column;
}

.modal-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 20px 24px;
  border-bottom: 1px solid var(--color-border, #374151);
}

.modal-header h2 {
  margin: 0;
  font-size: 1.25rem;
  font-weight: 600;
  color: white;
}

.close-btn {
  background: none;
  border: none;
  color: var(--color-text-secondary, #9ca3af);
  cursor: pointer;
  padding: 4px;
}

.close-btn:hover {
  color: white;
}

.modal-body {
  flex: 1;
  overflow-y: auto;
  padding: 24px;
}

.loading-state,
.empty-state {
  text-align: center;
  padding: 48px 24px;
  color: var(--color-text-secondary, #9ca3af);
}

.loading-state p,
.empty-state p {
  margin: 16px 0 0;
}

.snapshots-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.snapshot-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 16px;
  background: var(--color-bg-secondary, #374151);
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.2s;
  border: 2px solid transparent;
}

.snapshot-item:hover {
  background: var(--color-bg-tertiary, #4b5563);
}

.snapshot-item.selected {
  border-color: var(--color-primary, #3b82f6);
}

.snapshot-info {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.snapshot-version {
  font-weight: 600;
  color: white;
}

.snapshot-date {
  font-size: 12px;
  color: var(--color-text-secondary, #9ca3af);
}

.snapshot-author {
  font-size: 14px;
  color: var(--color-text-secondary, #9ca3af);
}

.modal-footer {
  display: flex;
  justify-content: flex-end;
  gap: 12px;
  padding: 20px 24px;
  border-top: 1px solid var(--color-border, #374151);
}

.btn {
  display: inline-flex;
  align-items: center;
  padding: 10px 20px;
  border-radius: 8px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;
  border: none;
}

.btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.btn-primary {
  background: var(--color-primary, #3b82f6);
  color: white;
}

.btn-primary:hover:not(:disabled) {
  background: var(--color-primary-dark, #2563eb);
}

.btn-secondary {
  background: var(--color-bg-secondary, #374151);
  color: white;
}

.btn-secondary:hover {
  background: var(--color-bg-tertiary, #4b5563);
}

.animate-spin {
  animation: spin 1s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}
</style>
