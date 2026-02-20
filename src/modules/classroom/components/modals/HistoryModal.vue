<template>
  <Modal :open="true" title="Історія дошки" size="sm" @close="$emit('close')">
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

    <template #footer>
      <Button variant="ghost" @click="$emit('close')">
        Скасувати
      </Button>
      <Button
        variant="primary"
        :disabled="!selectedVersion"
        @click="handleRestore"
      >
        <template #iconLeft><RotateCcw class="w-4 h-4" /></template>
        Відновити
      </Button>
    </template>
  </Modal>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { Loader2, History, RotateCcw } from 'lucide-vue-next'
import Modal from '@/ui/Modal.vue'
import Button from '@/ui/Button.vue'
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
.loading-state,
.empty-state {
  text-align: center;
  padding: 48px 24px;
  color: var(--text-secondary);
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
  background: var(--bg-secondary);
  border-radius: var(--radius-md);
  cursor: pointer;
  transition: all 0.2s;
  border: 2px solid transparent;
}

.snapshot-item:hover {
  background: var(--bg-tertiary, #4b5563);
}

.snapshot-item.selected {
  border-color: var(--accent);
}

.snapshot-info {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.snapshot-version {
  font-weight: 600;
  color: var(--text-primary);
}

.snapshot-date {
  font-size: 12px;
  color: var(--text-secondary);
}

.snapshot-author {
  font-size: 14px;
  color: var(--text-secondary);
}

.animate-spin {
  animation: spin 1s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}
</style>
