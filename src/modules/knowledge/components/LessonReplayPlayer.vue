<!-- Phase 22: Lesson Replay Player wrapper
     Lazy-loads board state from snapshot_url and renders in read-only mode.
     Uses PublicBoardViewer for rendering.
     Ref: PHASE22_LESSON_CONSUMPTION.md §Frontend Components -->
<template>
  <div class="lesson-replay-player">
    <!-- Controls bar -->
    <div class="lesson-replay-player__controls">
      <button @click="$emit('exit')" class="lesson-replay-player__exit-btn">
        ← {{ $t('knowledge.lesson.exitReplay') }}
      </button>
      <span class="lesson-replay-player__title">{{ lessonTitle }}</span>
    </div>

    <!-- Loading state -->
    <div v-if="loading" class="lesson-replay-player__loading">
      <div class="lesson-replay-player__spinner"></div>
      <p>{{ $t('knowledge.lesson.loadingReplay') }}</p>
    </div>

    <!-- Error state -->
    <div v-else-if="error" class="lesson-replay-player__error">
      <p>{{ error }}</p>
      <button @click="loadSnapshot" class="lesson-replay-player__retry-btn">
        {{ $t('knowledge.lesson.retry') }}
      </button>
    </div>

    <!-- Board viewer -->
    <div v-else class="lesson-replay-player__board">
      <PublicBoardViewer
        :board-state="boardState"
        :read-only="true"
      />
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import PublicBoardViewer from './PublicBoardViewer.vue'

const props = defineProps({
  snapshotUrl: {
    type: String,
    required: true,
  },
  lessonTitle: {
    type: String,
    default: '',
  },
})

defineEmits(['exit'])

const loading = ref(true)
const error = ref(null)
const boardState = ref(null)

async function loadSnapshot() {
  loading.value = true
  error.value = null
  try {
    const response = await fetch(props.snapshotUrl)
    if (!response.ok) {
      throw new Error(`Failed to load snapshot: ${response.status}`)
    }
    boardState.value = await response.json()
  } catch (err) {
    error.value = err.message || 'Failed to load lesson content'
  } finally {
    loading.value = false
  }
}

onMounted(() => {
  loadSnapshot()
})
</script>

<style scoped>
.lesson-replay-player {
  display: flex;
  flex-direction: column;
  height: 100vh;
  background: #f8f9fa;
}

.lesson-replay-player__controls {
  display: flex;
  align-items: center;
  gap: 1rem;
  padding: 0.75rem 1.5rem;
  background: #fff;
  border-bottom: 1px solid var(--color-border, #e5e7eb);
  flex-shrink: 0;
}

.lesson-replay-player__exit-btn {
  padding: 0.375rem 0.75rem;
  border-radius: 6px;
  font-size: 0.875rem;
  font-weight: 500;
  cursor: pointer;
  border: 1px solid var(--color-border, #ddd);
  background: #fff;
  color: var(--color-text-primary, #111);
  transition: background 0.15s;
}

.lesson-replay-player__exit-btn:hover {
  background: var(--color-bg-secondary, #f5f5f5);
}

.lesson-replay-player__title {
  font-weight: 600;
  font-size: 0.9375rem;
  color: var(--color-text-primary, #111);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.lesson-replay-player__loading {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 1rem;
  color: var(--color-text-secondary, #666);
}

.lesson-replay-player__spinner {
  width: 40px;
  height: 40px;
  border: 3px solid var(--color-border, #e5e7eb);
  border-top-color: var(--color-accent, #6366f1);
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

.lesson-replay-player__error {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 1rem;
  color: var(--color-text-secondary, #666);
}

.lesson-replay-player__retry-btn {
  padding: 0.5rem 1.25rem;
  border-radius: 6px;
  font-size: 0.875rem;
  font-weight: 600;
  cursor: pointer;
  border: none;
  background: var(--color-accent, #6366f1);
  color: #fff;
}

.lesson-replay-player__board {
  flex: 1;
  position: relative;
  overflow: hidden;
}
</style>
