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
      <!-- UX FIX (2026-04-08): спрощений header. Прибрано toggle "Переглянути replay /
           Статичний вигляд" — публічне посилання = replay за замовчуванням.
           Download прихована в іконку-меню (не конкурує з play). -->
      <header class="wb-public-view__header">
        <div class="wb-public-view__brand">
          <div class="wb-public-view__logo" aria-hidden="true">M4</div>
          <div class="wb-public-view__brand-text">
            <span class="wb-public-view__brand-name">M4SH</span>
            <span class="wb-public-view__brand-tag">Winterboard</span>
          </div>
        </div>
        <div class="wb-public-view__title-block">
          <h1 class="wb-public-view__title">{{ displayTitle }}</h1>
          <span class="wb-public-view__badge">{{ t('winterboard.public.readOnly') }}</span>
        </div>
        <div class="wb-public-view__header-actions">
          <button
            v-if="allowDownload"
            type="button"
            class="wb-download-icon-btn"
            :title="t('winterboard.public.download')"
            :aria-label="t('winterboard.public.download')"
            @click="handleDownload"
          >
            ⬇
          </button>
        </div>
      </header>

      <div class="wb-public-view__canvas-area">
        <div class="wb-public-view__canvas-frame">
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

// INV-T: recording_start_state from backend — стан дошки на момент Start Recording.
// Зберігаємо, щоб re-apply після resetForReplay (seek-to-start, handleReplaySeek).
let replayStartState: { pages: import('../types/winterboard').WBPage[]; currentPageIndex: number } | null = null

const allowDownload = ref(false)
const sessionCreatedAt = ref<string | null>(null)

// UX FIX (2026-04-08): fallback "Урок від {дата}" якщо назви немає.
const displayTitle = computed(() => {
  if (store.workspaceName && store.workspaceName.trim()) return store.workspaceName
  if (sessionCreatedAt.value) {
    try {
      const d = new Date(sessionCreatedAt.value)
      const formatted = d.toLocaleDateString(undefined, {
        day: '2-digit', month: '2-digit', year: 'numeric',
      })
      return t('winterboard.public.lessonFromDate', { date: formatted })
    } catch {
      /* fall through */
    }
  }
  return t('winterboard.room.untitled')
})

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

  // P0 FIX (2026-04-08): INV-T — hydrate з recording_start_state ПЕРЕД накаткою ops.
  // Без цього public replay починав з порожнього листа і показував лише сторінки,
  // створені під час запису, ігноруючи ті, що вже існували до Start Recording.
  // Backend віддає session.recording_start_state у полі timeline.start_state.
  await replay.loadTimeline(
    (op) => {
      applyReplayOperation(store, op)
    },
    (state) => {
      replayStartState = state as { pages: import('../types/winterboard').WBPage[]; currentPageIndex: number }
      store.loadSnapshot(replayStartState)
      // Починаємо replay завжди з 1-ї сторінки, навіть якщо у snapshot currentPageIndex інший.
      store.goToPage(0)
    },
  )

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

  // UX FIX (2026-04-08): форсуємо старт з 0 (перша сторінка, початок уроку).
  // Без цього replay міг починатися з середини, бо store був гідратований
  // фінальним snapshot-ом, а currentIndex не скидався явно.
  try {
    await replay.seekToWithSnapshot(
      0,
      (boardState) => {
        store.loadSnapshot(boardState as { pages: import('../types/winterboard').WBPage[]; currentPageIndex: number })
      },
      () => {
        // INV-T: reset = повернутись до стану на момент Start Recording, а не до пустої дошки.
        store.resetForReplay()
        if (replayStartState) {
          store.loadSnapshot(replayStartState)
          store.goToPage(0)
        }
      },
    )
    store.goToPage(0)
  } catch (err) {
    console.warn('[WB:PublicView] seek-to-start failed:', err)
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
      // INV-T: reset → re-apply recording_start_state перед накаткою ops від 0.
      store.resetForReplay()
      if (replayStartState) {
        store.loadSnapshot(replayStartState)
      }
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
    sessionCreatedAt.value = (data as unknown as { created_at?: string }).created_at ?? null

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

    // UX FIX (2026-04-08): публічне посилання = replay-плеєр за замовчуванням.
    // Якщо є replay-дані — одразу входимо в replay mode (як YouTube).
    // ?t= deep-link seek обробляється всередині enterReplayMode().
    if (hasReplayData.value) {
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
  gap: 1rem;
  padding: 0.75rem 1.25rem;
  border-bottom: 1px solid var(--wb-border, #dee2e6);
  background: linear-gradient(135deg, #0f172a 0%, #1e3a8a 60%, #2563eb 100%);
  color: #fff;
  box-shadow: 0 2px 12px rgba(15, 23, 42, 0.15);
}
.wb-public-view__brand {
  display: flex;
  align-items: center;
  gap: 0.625rem;
  flex-shrink: 0;
}
.wb-public-view__logo {
  width: 38px;
  height: 38px;
  border-radius: 10px;
  background: linear-gradient(135deg, #38bdf8, #2563eb);
  color: #fff;
  font-weight: 800;
  font-size: 0.95rem;
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 4px 12px rgba(37, 99, 235, 0.35);
  letter-spacing: 0.5px;
}
.wb-public-view__brand-text {
  display: flex;
  flex-direction: column;
  line-height: 1.1;
}
.wb-public-view__brand-name {
  font-weight: 700;
  font-size: 1rem;
  letter-spacing: 0.5px;
}
.wb-public-view__brand-tag {
  font-size: 0.6875rem;
  opacity: 0.75;
  text-transform: uppercase;
  letter-spacing: 0.8px;
}
.wb-public-view__title-block {
  display: flex;
  align-items: center;
  gap: 0.625rem;
  min-width: 0;
  flex: 1;
  padding-left: 1rem;
  border-left: 1px solid rgba(255, 255, 255, 0.15);
}
.wb-public-view__canvas-frame {
  position: absolute;
  inset: 16px;
  border-radius: 14px;
  background: #fff;
  border: 1px solid var(--wb-border, #e2e8f0);
  box-shadow: 0 10px 30px rgba(15, 23, 42, 0.08), 0 2px 6px rgba(15, 23, 42, 0.04);
  overflow: hidden;
}

.wb-public-view__header-actions {
  margin-left: auto;
  flex-shrink: 0;
}

.wb-download-icon-btn {
  width: 34px;
  height: 34px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  background: transparent;
  color: var(--wb-text-muted, #64748b);
  border: 1px solid var(--wb-border, #e2e8f0);
  border-radius: 8px;
  font-size: 16px;
  cursor: pointer;
  transition: background 0.15s ease, color 0.15s ease, border-color 0.15s ease;
}
.wb-download-icon-btn:hover {
  background: var(--wb-surface-alt, #f1f5f9);
  color: var(--wb-text, #0f172a);
  border-color: var(--wb-border-strong, #cbd5e1);
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
  font-size: 1.0625rem;
  font-weight: 600;
  margin: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  color: #fff;
}

.wb-public-view__badge {
  font-size: 0.6875rem;
  padding: 0.2rem 0.55rem;
  background: rgba(255, 255, 255, 0.15);
  color: #fff;
  border: 1px solid rgba(255, 255, 255, 0.25);
  border-radius: 999px;
  white-space: nowrap;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}
.wb-download-icon-btn {
  color: #fff !important;
  border-color: rgba(255, 255, 255, 0.3) !important;
  background: rgba(255, 255, 255, 0.08) !important;
}
.wb-download-icon-btn:hover {
  background: rgba(255, 255, 255, 0.18) !important;
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
