<template>
  <div class="solo-public">
    <!-- Loading -->
    <div v-if="isLoading" class="solo-public__loading">
      <span class="spinner">⏳</span>
      <p>{{ $t('common.loading') }}</p>
    </div>

    <!-- Error -->
    <div v-else-if="error" class="solo-public__error">
      <span class="icon">⚠️</span>
      <h2>{{ $t('solo.public.notFound') }}</h2>
      <p>{{ error }}</p>
    </div>

    <!-- Content -->
    <div v-else-if="session" class="solo-public__content">
      <header class="solo-public__header">
        <h1>{{ session.name }}</h1>
        <p class="solo-public__meta">
          {{ session.page_count }} {{ $t('solo.pages') }}
        </p>
      </header>

      <!-- Read-only canvas (Konva BoardDock) -->
      <div class="solo-public__canvas">
        <BoardDock
          :board-state="boardState"
          :permissions="readonlyPermissions"
          :readonly="true"
        />
      </div>

      <!-- Page navigation -->
      <footer class="solo-public__footer">
        <div class="page-nav">
          <button
            class="btn btn-ghost"
            :disabled="currentPageIndex === 0"
            @click="prevPage"
          >
            ←
          </button>
          <span>{{ currentPageIndex + 1 }} / {{ pages.length }}</span>
          <button
            class="btn btn-ghost"
            :disabled="currentPageIndex === pages.length - 1"
            @click="nextPage"
          >
            →
          </button>
        </div>

        <div v-if="allowDownload" class="download-actions">
          <button class="btn btn-primary" @click="downloadPng">
            {{ $t('solo.public.download') }}
          </button>
        </div>
      </footer>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useRoute } from 'vue-router'
import { soloApi } from '../api/soloApi'
import BoardDock from '@/modules/classroom/components/board/BoardDock.vue'
import type { RoomPermissions } from '@/modules/classroom/api/classroom'
import type { SoloSession, PageState } from '../types/solo'

const route = useRoute()

// State
const session = ref<SoloSession | null>(null)
const isLoading = ref(true)
const error = ref<string | null>(null)
const currentPageIndex = ref(0)
const allowDownload = ref(false)

// Readonly permissions
const readonlyPermissions: RoomPermissions = {
  can_draw: false,
  can_erase: false,
  can_add_layers: false,
  can_delete_layers: false,
  can_upload_images: false,
  can_clear_board: false,
  can_toggle_video: false,
  can_terminate: false,
}

// Computed
const pages = computed<PageState[]>(() => {
  const state = session.value?.state as { pages?: PageState[] } | undefined
  return state?.pages || []
})
const activePage = computed(() => pages.value[currentPageIndex.value])

const boardState = computed(() => ({
  strokes: activePage.value?.strokes || [],
  assets: [],
  pages: pages.value,
  currentPageIndex: currentPageIndex.value,
}))

// Methods
function prevPage(): void {
  if (currentPageIndex.value > 0) {
    currentPageIndex.value--
  }
}

function nextPage(): void {
  if (currentPageIndex.value < pages.value.length - 1) {
    currentPageIndex.value++
  }
}

async function downloadPng(): Promise<void> {
  // TODO: Implement Konva export
  console.log('[SoloPublicView] Download PNG not yet implemented for Konva')
}

// Load session
onMounted(async () => {
  const token = route.params.token as string

  try {
    const response = await soloApi.getPublicSession(token)
    session.value = response
    // Check if download is allowed (would come from share token)
    allowDownload.value = true
  } catch (err) {
    error.value = 'This board is not available or the link has expired.'
  } finally {
    isLoading.value = false
  }
})
</script>

<style scoped>
.solo-public {
  min-height: 100vh;
  background: var(--bg-primary, #f9fafb);
}

.solo-public__loading,
.solo-public__error {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  min-height: 100vh;
  text-align: center;
}

.solo-public__loading .spinner {
  font-size: 2rem;
  animation: spin 1s linear infinite;
}

@keyframes spin {
  from {
    transform: rotate(0deg);
  }
  to {
    transform: rotate(360deg);
  }
}

.solo-public__error .icon {
  font-size: 4rem;
  margin-bottom: 1rem;
}

.solo-public__content {
  display: flex;
  flex-direction: column;
  height: 100vh;
}

.solo-public__header {
  padding: 1rem 2rem;
  background: var(--card-bg, #fff);
  border-bottom: 1px solid var(--border-color, #e5e7eb);
}

.solo-public__header h1 {
  margin: 0 0 0.25rem;
  font-size: 1.25rem;
}

.solo-public__meta {
  margin: 0;
  font-size: 0.875rem;
  color: var(--text-secondary, #6b7280);
}

.solo-public__canvas {
  flex: 1;
  position: relative;
  overflow: hidden;
}

.solo-public__footer {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 1rem 2rem;
  background: var(--card-bg, #fff);
  border-top: 1px solid var(--border-color, #e5e7eb);
}

.page-nav {
  display: flex;
  align-items: center;
  gap: 1rem;
}

.btn {
  padding: 0.5rem 1rem;
  border: none;
  border-radius: 6px;
  font-weight: 500;
  cursor: pointer;
}

.btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.btn-primary {
  background: var(--accent-color, #3b82f6);
  color: white;
}

.btn-ghost {
  background: transparent;
  border: 1px solid var(--border-color, #e5e7eb);
}
</style>
