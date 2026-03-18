<template>
  <div class="wb-public-view">
    <!-- Loading state -->
    <div v-if="isLoading" class="wb-public-view__loading">
      <div class="wb-public-view__spinner" />
      <p>{{ t('winterboard.public.loading') }}</p>
    </div>

    <!-- Error state -->
    <div v-else-if="loadError" class="wb-public-view__error">
      <h2>{{ loadError.title }}</h2>
      <p>{{ loadError.message }}</p>
      <router-link to="/winterboard" class="wb-public-view__back-btn">
        {{ t('winterboard.public.goBack') }}
      </router-link>
    </div>

    <!-- Read-only canvas — store is SSOT -->
    <template v-else-if="isHydrated">
      <header class="wb-public-view__header">
        <h1 class="wb-public-view__title">{{ store.workspaceName || t('winterboard.room.untitled') }}</h1>
        <span class="wb-public-view__badge">{{ t('winterboard.public.readOnly') }}</span>
        <div class="wb-public-view__header-actions">
          <button
            v-if="hasReplayData"
            type="button"
            class="wb-replay-toggle-btn"
            @click="toggleReplayMode"
          >
            {{ isReplayMode ? t('winterboard.public.staticView') : t('winterboard.public.watchReplay') }}
          </button>
          <button
            v-if="allowDownload"
            type="button"
            class="wb-download-btn"
            @click="handleDownload"
          >
            {{ t('winterboard.public.download') }}
          </button>
        </div>
      </header>

      <div class="wb-public-view__canvas-area">
        <WBCanvas
          ref="canvasRef"
          :strokes="store.currentStrokes"
          :assets="store.currentAssets"
          :page-id="store.currentPage?.id ?? ''"
          :read-only="true"
          color="#000000"
          tool="select"
          :size="2"
        />
      </div>

      <!-- Replay player (above footer) -->
      <PublicReplayPlayer
        v-if="isReplayMode && hasReplayData"
        :current-seconds="replayCurrentSeconds"
        :duration-seconds="replayDurationSeconds"
        :is-playing="replay.state.value === 'playing'"
        :markers="replayMarkers"
        @play="handleReplayPlay"
        @pause="handleReplayPause"
        @seek="handleReplaySeek"
        @speed-change="handleSpeedChange"
      />

      <!-- Markers list (below player) -->
      <PublicMarkersList
        v-if="isReplayMode && replayMarkers.length > 0"
        :markers="replayMarkers"
        :current-time-ms="replayCurrentSeconds * 1000"
        @seek="handleReplaySeek"
      />

      <!-- Page navigation (read-only) -->
      <footer v-if="store.pageCount > 1" class="wb-public-view__footer">
        <button
          type="button"
          class="wb-page-btn"
          :disabled="store.currentPageIndex === 0"
          @click="store.goToPage(store.currentPageIndex - 1)"
        >
          &larr;
        </button>
        <span class="wb-page-indicator">
          {{ store.currentPageIndex + 1 }} / {{ store.pageCount }}
        </span>
        <button
          type="button"
          class="wb-page-btn"
          :disabled="store.currentPageIndex >= store.pageCount - 1"
          @click="store.goToPage(store.currentPageIndex + 1)"
        >
          &rarr;
        </button>
      </footer>
    </template>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onBeforeUnmount } from 'vue'
import { useRoute } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { winterboardApi } from '../api/winterboardApi'
import { useWBStore } from '../board/state/boardStore'
import { useReplay } from '../composables/useReplay'
import { applyReplayOperation } from '../engine/applyReplayOperation'
import WBCanvas from '../components/canvas/WBCanvas.vue'
import PublicReplayPlayer from '../components/public/PublicReplayPlayer.vue'
import PublicMarkersList from '../components/public/PublicMarkersList.vue'
import type { WBSession } from '../types/winterboard'
import type { ReplaySpeed } from '../engine/WBReplayEngine'

const { t } = useI18n()
const route = useRoute()
const store = useWBStore()

// ── UI state (NOT board state — board lives in store) ──
const isLoading = ref(true)
const loadError = ref<{ title: string; message: string } | null>(null)
const isHydrated = ref(false)
const canvasRef = ref<InstanceType<typeof WBCanvas> | null>(null)

// ── Replay ──
const hasReplayData = ref(false)
const isReplayMode = ref(false)
const replayDurationSeconds = ref(0)
const replaySessionId = ref<string | null>(null)
let replay: ReturnType<typeof useReplay> | null = null

// Snapshot of board state before entering replay — to restore on exit
let staticSnapshot: { pages: import('../types/winterboard').WBPage[]; currentPageIndex: number } | null = null

const allowDownload = ref(false)

// Replay current time — derived from engine progress + estimated duration
const replayCurrentSeconds = computed(() => {
  if (!replay || replayDurationSeconds.value <= 0) return 0
  const total = replay.totalOperations.value
  if (total <= 0) return 0
  return (replay.currentIndex.value / total) * replayDurationSeconds.value
})

// Map lesson markers → replay marker format
const replayMarkers = computed(() => {
  if (!replay) return []
  const totalOps = replay.totalOperations.value
  const duration = replayDurationSeconds.value || 1
  return replay.markers.value.map(m => ({
    id: m.id,
    title: m.title,
    lesson_time_seconds: totalOps > 0
      ? (m.operation_index / totalOps) * duration
      : 0,
    category: m.category,
    page_id: m.page_id,
  }))
})

// ── Replay mode toggle ──

async function toggleReplayMode(): Promise<void> {
  if (isReplayMode.value) {
    exitReplayMode()
  } else {
    await enterReplayMode()
  }
}

async function enterReplayMode(): Promise<void> {
  if (!replaySessionId.value) return

  // Save static snapshot before replay
  staticSnapshot = store.getSnapshotState()

  // Prepare store for replay
  store.setMode('replay')
  store.resetForReplay()

  // Create replay composable
  replay = useReplay(replaySessionId.value)

  // Load timeline — applyReplayOperation feeds ops into store
  await replay.loadTimeline((op) => {
    applyReplayOperation(store, op)
  })

  // Load lesson markers
  await replay.loadMarkers()

  isReplayMode.value = true

  // Handle ?t= URL parameter — auto-seek to time
  const tParam = route.query.t as string | undefined
  if (tParam) {
    const seconds = Number(tParam)
    if (!isNaN(seconds) && seconds > 0) {
      await handleReplaySeek(seconds * 1000)
      return
    }
  }

  // Auto-play
  replay.play()
}

function exitReplayMode(): void {
  // Stop and destroy replay engine
  if (replay) {
    replay.stop()
    replay.destroy()
    replay = null
  }

  // Restore board state from static snapshot
  if (staticSnapshot) {
    store.loadSnapshot(staticSnapshot)
    staticSnapshot = null
  }

  store.setMode('readonly')
  isReplayMode.value = false
}

// ── Replay handlers ──

function handleReplayPlay(): void {
  replay?.play()
}

function handleReplayPause(): void {
  replay?.pause()
}

async function handleReplaySeek(timeMs: number): Promise<void> {
  if (!replay || replayDurationSeconds.value <= 0) return

  const ratio = (timeMs / 1000) / replayDurationSeconds.value
  const targetIndex = Math.round(ratio * replay.totalOperations.value)

  // Use snapshot-based seek for performance
  await replay.seekToWithSnapshot(
    targetIndex,
    (boardState) => {
      store.loadSnapshot(boardState as { pages: import('../types/winterboard').WBPage[]; currentPageIndex: number })
    },
    () => {
      store.resetForReplay()
    },
  )
}

function handleSpeedChange(speed: number): void {
  replay?.setSpeed(speed as ReplaySpeed)
}

// ── Download ──

function handleDownload(): void {
  try {
    const stage = (canvasRef.value as unknown as { getStage?: () => { toDataURL: (opts?: { pixelRatio?: number }) => string } | null })?.getStage?.()
    if (!stage) {
      console.warn('[WB:PublicView] Canvas stage not available for download')
      return
    }
    const dataUrl = stage.toDataURL({ pixelRatio: 2 })
    const link = document.createElement('a')
    link.href = dataUrl
    link.download = `${store.workspaceName || 'winterboard'}-page-${store.currentPageIndex + 1}.png`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  } catch (err) {
    console.error('[WB:PublicView] Download failed:', err)
  }
}

// ── Lifecycle ──

onMounted(async () => {
  const token = route.params.token as string
  if (!token) {
    loadError.value = {
      title: t('winterboard.public.notFound'),
      message: t('winterboard.public.invalidLink'),
    }
    isLoading.value = false
    return
  }

  try {
    // Fetch public session data from API
    const data = await winterboardApi.getPublicSession(token) as unknown as WBSession

    // Hydrate store — store is SSOT, no shadow state
    store.hydrateFromSession(data)
    store.setMode('readonly')

    // allow_download is API-only field, not part of store state
    allowDownload.value = (data as unknown as Record<string, unknown>).allow_download === true

    const sessionId = data.id
    replaySessionId.value = sessionId

    // Check for replay data (non-blocking)
    if (sessionId) {
      try {
        const { fetchReplayTimeline, fetchLessonMarkers } = await import('../api/replay')
        const timeline = await fetchReplayTimeline(sessionId).catch(() => ({ operations: [], total_operations: 0 }))
        hasReplayData.value = timeline.total_operations > 0
        if (timeline.total_operations > 0) {
          const ops = timeline.operations as Array<{ lesson_time_seconds?: number }>
          const lastOp = ops[ops.length - 1]
          if (lastOp?.lesson_time_seconds) {
            replayDurationSeconds.value = lastOp.lesson_time_seconds
          }
        }
      } catch {
        // Replay data optional — don't block static view
      }
    }

    isHydrated.value = true

    // If ?t= is present and replay data exists, auto-enter replay mode
    const tParam = route.query.t as string | undefined
    if (tParam && hasReplayData.value) {
      await enterReplayMode()
    }
  } catch (err: unknown) {
    const status = (err as { response?: { status?: number } })?.response?.status
    if (status === 404) {
      loadError.value = {
        title: t('winterboard.public.notFound'),
        message: t('winterboard.public.sessionNotFound'),
      }
    } else if (status === 410) {
      loadError.value = {
        title: t('winterboard.public.expired'),
        message: t('winterboard.public.linkExpired'),
      }
    } else {
      loadError.value = {
        title: t('winterboard.public.error'),
        message: t('winterboard.public.loadFailed'),
      }
    }
    console.error('[WB:PublicView] Failed to load public session:', err)
  } finally {
    isLoading.value = false
  }
})

onBeforeUnmount(() => {
  if (replay) {
    replay.stop()
    replay.destroy()
    replay = null
  }
  store.$reset()
})
</script>

<style scoped>
.wb-public-view {
  display: flex;
  flex-direction: column;
  height: 100vh;
  height: 100dvh;
  overflow: hidden;
  background: var(--wb-bg, #f8f9fa);
}

.wb-public-view__loading {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 100%;
  gap: 1rem;
  color: var(--wb-text-muted, #6c757d);
}

.wb-public-view__spinner {
  width: 40px;
  height: 40px;
  border: 3px solid var(--wb-border, #dee2e6);
  border-top-color: var(--wb-primary, #2563eb);
  border-radius: 50%;
  animation: wb-spin 0.8s linear infinite;
}

@keyframes wb-spin {
  to { transform: rotate(360deg); }
}

.wb-public-view__error {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 100%;
  gap: 0.75rem;
  text-align: center;
  padding: 2rem;
}

.wb-public-view__error h2 {
  font-size: 1.25rem;
  color: var(--wb-text, #212529);
}

.wb-public-view__error p {
  color: var(--wb-text-muted, #6c757d);
}

.wb-public-view__back-btn {
  margin-top: 1rem;
  padding: 0.5rem 1.25rem;
  background: var(--wb-primary, #2563eb);
  color: #fff;
  border-radius: 6px;
  text-decoration: none;
  font-size: 0.875rem;
}

.wb-public-view__header {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 0.75rem 1.25rem;
  border-bottom: 1px solid var(--wb-border, #dee2e6);
  background: var(--wb-surface, #fff);
}

.wb-public-view__header-actions {
  margin-left: auto;
  flex-shrink: 0;
}

.wb-download-btn {
  padding: 0.375rem 1rem;
  background: var(--wb-primary, #2563eb);
  color: #fff;
  border: none;
  border-radius: 6px;
  font-size: 0.8125rem;
  font-weight: 500;
  cursor: pointer;
  transition: background 0.15s ease;
}

.wb-download-btn:hover {
  background: var(--wb-primary-hover, #1d4ed8);
}

.wb-replay-toggle-btn {
  padding: 0.375rem 1rem;
  background: var(--wb-primary, #2563eb);
  color: #fff;
  border: none;
  border-radius: 6px;
  font-size: 0.8125rem;
  font-weight: 500;
  cursor: pointer;
  transition: background 0.15s ease;
}

.wb-replay-toggle-btn:hover {
  background: var(--wb-primary-hover, #1d4ed8);
}

.wb-public-view__title {
  font-size: 1.125rem;
  font-weight: 600;
  margin: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.wb-public-view__badge {
  font-size: 0.75rem;
  padding: 0.2rem 0.5rem;
  background: var(--wb-warning-bg, #fff3cd);
  color: var(--wb-warning-text, #856404);
  border-radius: 4px;
  white-space: nowrap;
}

.wb-public-view__canvas-area {
  flex: 1;
  overflow: hidden;
  position: relative;
}

.wb-public-view__footer {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 1rem;
  padding: 0.5rem;
  border-top: 1px solid var(--wb-border, #dee2e6);
  background: var(--wb-surface, #fff);
}

.wb-page-btn {
  padding: 0.25rem 0.75rem;
  border: 1px solid var(--wb-border, #dee2e6);
  border-radius: 4px;
  background: var(--wb-surface, #fff);
  cursor: pointer;
  font-size: 1rem;
}

.wb-page-btn:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

.wb-page-indicator {
  font-size: 0.875rem;
  color: var(--wb-text-muted, #6c757d);
}

/* Mobile responsive */
@media (max-width: 768px) {
  .wb-public-view__header {
    padding: 0.5rem 0.75rem;
    gap: 0.5rem;
  }

  .wb-public-view__title {
    font-size: 0.9375rem;
  }

  .wb-public-view__badge {
    font-size: 0.6875rem;
    padding: 0.15rem 0.375rem;
  }

  .wb-download-btn {
    padding: 0.375rem 0.75rem;
    min-height: 44px;
    font-size: 0.8125rem;
  }

  .wb-public-view__footer {
    padding: 0.375rem 0.5rem calc(env(safe-area-inset-bottom, 0px) + 0.375rem);
  }

  .wb-page-btn {
    min-width: 44px;
    min-height: 44px;
    padding: 0.375rem 1rem;
  }
}

@media (prefers-reduced-motion: reduce) {
  .wb-public-view__spinner {
    animation: none;
  }
}
</style>
