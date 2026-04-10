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
          <span class="wb-public-view__brand-name">M4SH</span>
        </div>
        <h1 class="wb-public-view__title">{{ displayTitle }}</h1>
        <span v-if="ownerName" class="wb-public-view__author">{{ ownerName }}</span>
      </header>

      <div ref="canvasContainerRef" class="wb-public-view__canvas-area">
        <div class="wb-public-view__canvas-frame">
          <WBCanvas
            ref="canvasRef"
            :strokes="store.currentStrokes"
            :assets="store.currentAssets"
            :page-id="store.currentPage?.id ?? ''"
            :background="store.currentPage?.background"
            :width="store.pageWidth"
            :height="store.pageHeight"
            :zoom="store.zoom"
            :read-only="true"
            color="#000000"
            tool="select"
            :size="2"
            @audio-badge-click="handleAudioBadgeClick"
          />
        </div>

        <!-- Hero overlay: big Play button — public replay starts paused.
             Positioned in canvas-area (not canvas-frame) for guaranteed dimensions.
             canvas-area has flex:1 + position:relative → overlay always covers full area. -->
        <div
          v-if="showHeroOverlay && isReplayMode && hasReplayData"
          class="wb-public-view__hero-overlay"
          @click="handleHeroPlay"
        >
          <div class="wb-public-view__hero-eye">
            <!-- SVG Eye icon with Play triangle inside -->
            <svg viewBox="0 0 200 120" class="wb-public-view__hero-svg" aria-hidden="true">
              <!-- Eye outline -->
              <path
                d="M10,60 Q100,-20 190,60 Q100,140 10,60 Z"
                fill="none"
                stroke="currentColor"
                stroke-width="5"
                stroke-linejoin="round"
              />
              <!-- Iris circle -->
              <circle cx="100" cy="60" r="32" fill="none" stroke="currentColor" stroke-width="4" />
              <!-- Play triangle -->
              <polygon points="88,42 88,78 120,60" fill="currentColor" />
            </svg>
          </div>
          <div class="wb-public-view__hero-info">
            <h2 class="wb-public-view__hero-title">{{ displayTitle }}</h2>
            <p v-if="replayDurationSeconds > 0 || store.pageCount > 1" class="wb-public-view__hero-meta">
              <span v-if="replayDurationSeconds > 0">{{ Math.ceil(replayDurationSeconds / 60) }} {{ t('winterboard.replay.statMinutes', 'хв') }}</span>
              <span v-if="replayDurationSeconds > 0 && store.pageCount > 1"> · </span>
              <span v-if="store.pageCount > 1">{{ store.pageCount }} {{ t('winterboard.replay.statPages') }}</span>
            </p>
          </div>
        </div>
      </div>

      <!-- Replay player controls (visible after Play clicked) -->
      <PublicReplayPlayer
        v-if="isReplayMode && hasReplayData && !showHeroOverlay"
        :current-seconds="replayCurrentSeconds"
        :duration-seconds="replayDurationSeconds"
        :is-playing="replay.state.value === 'playing'"
        :markers="replayMarkers"
        @play="handleReplayPlay"
        @pause="handleReplayPause"
        @seek="handleReplaySeek"
        @speed-change="handleSpeedChange"
        @step-forward="handleStepForward"
        @step-backward="handleStepBackward"
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
import { ref, computed, watch, nextTick, onMounted, onBeforeUnmount } from 'vue'
import { useRoute } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { winterboardApi } from '../api/winterboardApi'
import { useWBStore } from '../board/state/boardStore'
import { useReplay } from '../composables/useReplay'
import { useReplayAudio } from '../composables/useReplayAudio'
import { audioManager } from '../utils/audioManager'
import { createReplayApplier } from '../engine/applyReplayOperation'
import { useCanvasResize } from '../composables/useCanvasResize'
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
const canvasContainerRef = ref<HTMLElement | null>(null)

// Auto-fit canvas to container (same as SoloRoom)
useCanvasResize({
  containerRef: canvasContainerRef,
  onResize(w, h) {
    if (w > 0 && h > 0 && store.pageWidth > 0 && store.pageHeight > 0) {
      const fitZoom = Math.min(w / store.pageWidth, h / store.pageHeight, 1)
      store.setZoom(fitZoom)
    }
  },
  debounceMs: 100,
})

// ── Replay ──
const hasReplayData = ref(false)
const isReplayMode = ref(false)
const showHeroOverlay = ref(true)  // Hero overlay shown until user clicks Play
const replayDurationSeconds = ref(0)
const replaySessionId = ref<string | null>(null)
let replay: ReturnType<typeof useReplay> | null = null
const replayApplier = createReplayApplier()

// Snapshot of board state before entering replay — to restore on exit
let staticSnapshot: { pages: import('../types/winterboard').WBPage[]; currentPageIndex: number } | null = null

// INV-T: recording_start_state from backend — стан дошки на момент Start Recording.
// Зберігаємо, щоб re-apply після resetForReplay (seek-to-start, handleReplaySeek).
let replayStartState: { pages: import('../types/winterboard').WBPage[]; currentPageIndex: number } | null = null

const allowDownload = ref(false)
const ownerName = ref('')
const sessionCreatedAt = ref<string | null>(null)

// Audio interaction layer — pauses replay when audio plays, resumes on end (INV I1-I7)
// `replay` is a plain `let` assigned in enterReplayMode(), closures capture the variable.
const replayAudio = useReplayAudio({
  getReplayState: () => replay?.state.value ?? 'idle',
  pauseReplay: () => replay?.pause(),
  resumeReplay: () => replay?.play(),
})

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

/**
 * DRY helper: reset board + applier, load snapshot, mark pages.
 * Called from every clearState/seekToWithSnapshot callback.
 *
 * CRITICAL: кожен loadSnapshot отримує СВІЖИЙ deep-clone!
 * Бо loadSnapshot робить this.pages = state.pages (посилання),
 * і replay ops мутують store.pages = мутують snapshot якщо не clone.
 */
function resetBoardForReplay(): void {
  store.resetForReplay()
  replayApplier.reset()
  if (replayStartState) {
    store.loadSnapshot(JSON.parse(JSON.stringify(replayStartState)))
    store.goToPage(0)
    const ids = (replayStartState.pages as Array<{ id?: string }>).map(p => p?.id ?? '').filter(Boolean)
    replayApplier.markPagesEnsured(ids)
  }
}

async function enterReplayMode(): Promise<void> {
  if (!replaySessionId.value) return

  // Save static snapshot before replay
  staticSnapshot = store.getSnapshotState()

  // Prepare store for replay
  store.setMode('replay')
  store.resetForReplay()
  replayApplier.reset()  // P0: clean instance page-tracking state

  // Create replay composable — use public token for anonymous access
  const token = route.params.token as string
  replay = useReplay(replaySessionId.value, token)

  // P0 FIX (2026-04-08): INV-T — hydrate з recording_start_state ПЕРЕД накаткою ops.
  // Без цього public replay починав з порожнього листа і показував лише сторінки,
  // створені під час запису, ігноруючи ті, що вже існували до Start Recording.
  // Backend віддає session.recording_start_state у полі timeline.start_state.
  await replay.loadTimeline(
    (op) => {
      replayApplier.apply(store, op)
      // Fade-in new elements via Konva Tween
      const payload = op.payload as Record<string, unknown>
      const newId = op.op_type === 'stroke_add' ? (payload?.stroke as { id?: string })?.id
        : op.op_type === 'asset_add' ? (payload?.asset as { id?: string })?.id
        : null
      if (newId) {
        nextTick(() => {
          const stage = (canvasRef.value as unknown as { getStage?: () => { findOne: (s: string) => { opacity: (v: number) => void; to: (o: Record<string, unknown>) => void } | null; batchDraw: () => void } | null })?.getStage?.()
          const node = stage?.findOne(`#${newId}`)
          if (node) { node.opacity(0); node.to({ opacity: 1, duration: 0.25 }) }
          stage?.batchDraw()
        })
      }
    },
    (state) => {
      // CRITICAL: deep-clone snapshot! loadSnapshot робить this.pages = state.pages (ПОСИЛАННЯ).
      // Без clone replay-операції мутують і snapshot, і store одночасно.
      // На restart "чистий" snapshot вже містить всі replay-додані strokes/assets.
      replayStartState = JSON.parse(JSON.stringify(state)) as { pages: import('../types/winterboard').WBPage[]; currentPageIndex: number }
      store.loadSnapshot(JSON.parse(JSON.stringify(replayStartState)))
      // Починаємо replay завжди з 1-ї сторінки, навіть якщо у snapshot currentPageIndex інший.
      store.goToPage(0)
      // markPagesEnsured — повідомити applier що snapshot-сторінки вже існують.
      const ids = (replayStartState.pages as Array<{ id?: string }>).map(p => p?.id ?? '').filter(Boolean)
      replayApplier.markPagesEnsured(ids)
    },
  )

  // Встановлюємо hasReplayData після loadTimeline (єдиний виклик fetchPublicReplayByToken)
  hasReplayData.value = replay.totalOperations.value > 0
  if (!hasReplayData.value) {
    // Нема replay даних — повертаємось в static mode
    exitReplayMode()
    return
  }

  // Fallback: derive duration from operation timestamps if lesson_time_seconds was missing
  if (replayDurationSeconds.value <= 0 && replay.totalDurationMs.value > 0) {
    replayDurationSeconds.value = Math.ceil(replay.totalDurationMs.value / 1000)
  }

  // Load lesson markers
  await replay.loadMarkers()

  isReplayMode.value = true

  // FIX: Watch replay state for re-showing hero overlay when replay ends.
  // Must be set up HERE (after `replay` is assigned), not at setup level,
  // because `replay` is a plain `let` — Vue can't track its assignment.
  // At setup time, `replay === null` → `replay?.state.value` = undefined → no dependency → watch never fires.
  watch(() => replay!.state.value, (s) => {
    if (s === 'ended') showHeroOverlay.value = true
  })

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
      resetBoardForReplay,
    )
    store.goToPage(0)
  } catch (err) {
    console.warn('[WB:PublicView] seek-to-start failed:', err)
  }

  // Don't auto-play — user clicks hero overlay to start (YouTube-style)
  // replay.play() is called from handleHeroPlay()
}

function exitReplayMode(): void {
  replayAudio.stopAudio()  // INV I6: stop audio on exit replay
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

/** Hero overlay click → dismiss overlay + start replay (or restart if ended) */
function handleHeroPlay(): void {
  showHeroOverlay.value = false
  if (replay?.state.value === 'ended') {
    // Restart from beginning
    replay.seekToWithSnapshot(
      0,
      (bs) => store.loadSnapshot(bs as Parameters<typeof store.loadSnapshot>[0]),
      resetBoardForReplay,
    ).then(() => replay?.play())
  } else {
    replay?.play()
  }
}

// NOTE: watch for replay.state → showHeroOverlay is set up inside enterReplayMode()
// (after `replay` object is created) — see FIX comment there.

function handleReplayPlay(): void {
  replay?.play()
}

function handleReplayPause(): void {
  replay?.pause()
}

async function handleReplaySeek(timeMs: number): Promise<void> {
  replayAudio.stopAudio()  // INV I5: stop audio on seek
  if (!replay || replayDurationSeconds.value <= 0) return

  const ratio = (timeMs / 1000) / replayDurationSeconds.value
  const targetIndex = Math.round(ratio * replay.totalOperations.value)

  // Use snapshot-based seek for performance
  await replay.seekToWithSnapshot(
    targetIndex,
    (boardState) => {
      store.loadSnapshot(boardState as { pages: import('../types/winterboard').WBPage[]; currentPageIndex: number })
    },
    resetBoardForReplay,
  )
}

function handleSpeedChange(speed: number): void {
  replay?.setSpeed(speed as ReplaySpeed)
}

function handleStepForward(): void {
  replayAudio.stopAudio()  // INV I5
  replay?.stepForward()
}

async function handleStepBackward(): Promise<void> {
  replayAudio.stopAudio()  // INV I5
  if (replay) {
    await replay.stepBackward(
      (boardState) => {
        store.loadSnapshot(boardState as { pages: import('../types/winterboard').WBPage[]; currentPageIndex: number })
      },
      resetBoardForReplay,
    )
  }
}

// ─── Audio interaction layer (INV I2: click only) ────────────────────────────
function handleAudioBadgeClick(url: string): void {
  if (isReplayMode.value) {
    replayAudio.playObjectAudio(url)
  }
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
    ownerName.value = (data as unknown as Record<string, string>).owner ?? ''
    sessionCreatedAt.value = (data as unknown as { created_at?: string }).created_at ?? null

    const sessionId = data.id
    replaySessionId.value = sessionId

    isHydrated.value = true

    // INV: fetchPublicReplayByToken викликається ОДИН раз — всередині enterReplayMode() →
    // loadTimeline(). Попередній pre-check був дублюванням (duplicate request).
    // hasReplayData та replayDurationSeconds встановлюються після loadTimeline().
    //
    // UX: публічне посилання = replay-плеєр за замовчуванням (як YouTube).
    // ?t= deep-link seek обробляється всередині enterReplayMode().
    if (replaySessionId.value) {
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
  // INV I6: Stop audio + destroy watcher on unmount
  audioManager.stop()
  replayAudio.destroy()
  if (replay) {
    replay.stop()
    replay.destroy()
    replay = null
  }
  store.$reset()
})
</script>

<style scoped>
/* ── M4SH Public Replay — uses global theme tokens ── */
.wb-public-view {
  display: flex;
  flex-direction: column;
  height: 100vh;
  height: 100dvh;
  overflow: hidden;
  background: var(--wb-canvas-area-bg, #f0fdf4);
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
  border: 3px solid var(--wb-border, #e2e8f0);
  border-top-color: var(--wb-brand, #047857);
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
  background: var(--wb-brand, #047857);
  color: #fff;
  border-radius: 6px;
  text-decoration: none;
  font-size: 0.875rem;
}

.wb-public-view__header {
  display: flex;
  align-items: center;
  gap: 1rem;
  padding: 0 24px;
  height: 56px;
  background: var(--wb-header-bg, #047857);
  color: #fff;
  flex-shrink: 0;
}
.wb-public-view__brand {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  flex-shrink: 0;
}
.wb-public-view__logo {
  width: 32px;
  height: 32px;
  border-radius: 8px;
  background: rgba(255, 255, 255, 0.2);
  color: #fff;
  font-weight: 800;
  font-size: 0.8rem;
  display: flex;
  align-items: center;
  justify-content: center;
}
.wb-public-view__brand-name {
  font-weight: 700;
  font-size: 0.9375rem;
}
.wb-public-view__title {
  flex: 1;
  font-size: 0.9375rem;
  font-weight: 600;
  margin: 0;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.wb-public-view__author {
  font-size: 0.8125rem;
  opacity: 0.8;
  white-space: nowrap;
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
  position: relative;
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
  min-width: 0;
  min-height: 0;
  overflow: hidden;
  display: flex;
  align-items: center;
  justify-content: center;
  position: relative;
  background: var(--wb-canvas-area-bg, #f0fdf4);
}

.wb-public-view__footer {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 1rem;
  padding: 0.5rem;
  border-top: 1px solid var(--wb-border, #e2e8f0);
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

/* ── Hero overlay: big Play button (M4SH brand, theme-aware) ── */
.wb-public-view__hero-overlay {
  position: absolute;
  inset: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 28px;
  background: rgba(0, 0, 0, 0.3);
  cursor: pointer;
  z-index: 10;
  transition: background 0.3s;
}
.wb-public-view__hero-overlay:hover {
  background: rgba(0, 0, 0, 0.2);
}
.wb-public-view__hero-overlay:hover .wb-public-view__hero-svg {
  transform: scale(1.15);
  filter: drop-shadow(0 0 48px var(--wb-brand-glow, rgba(4, 120, 87, 0.7)));
}

.wb-public-view__hero-eye {
  width: 320px;
  height: 200px;
}

.wb-public-view__hero-svg {
  width: 100%;
  height: 100%;
  color: var(--wb-brand, #047857);
  filter: drop-shadow(0 8px 32px var(--wb-brand-glow, rgba(4, 120, 87, 0.4)));
  transition: transform 0.3s ease, filter 0.3s ease;
  animation: wb-eye-pulse 2.5s ease-in-out infinite;
}

@keyframes wb-eye-pulse {
  0%, 100% { transform: scale(1); }
  50% { transform: scale(1.05); }
}

.wb-public-view__hero-info {
  text-align: center;
  color: white;
  text-shadow: 0 2px 12px rgba(0, 0, 0, 0.4);
}
.wb-public-view__hero-title {
  font-size: 1.5rem;
  font-weight: 700;
  margin: 0 0 6px;
}
.wb-public-view__hero-meta {
  font-size: 0.9375rem;
  opacity: 0.9;
  margin: 0;
}
</style>
