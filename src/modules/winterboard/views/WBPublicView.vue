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
      <router-link to="/winterboard/boards" class="wb-public-view__back-btn">
        {{ t('winterboard.public.goBack') }}
      </router-link>
    </div>

    <!-- Read-only canvas — store is SSOT -->
    <template v-else-if="isHydrated">
      <!-- UX FIX (2026-04-08): спрощений header. Прибрано toggle "Переглянути replay /
           Статичний вигляд" — публічне посилання = replay за замовчуванням.
           Download прихована в іконку-меню (не конкурує з play). -->
      <header class="wb-public-view__header">
        <!-- MASH brand — clickable link to homepage (navigation + brand entry point) -->
        <router-link
          to="/"
          class="wb-public-view__brand"
          :aria-label="t('publicLesson.header.backToHome', 'MASH — на головну')"
        >
          <div class="wb-public-view__logo" aria-hidden="true">M4</div>
          <span class="wb-public-view__brand-name">M4SH</span>
        </router-link>
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
        >
          <div class="wb-public-view__hero-eye" ref="heroEyeWrapRef" @click="handleHeroPlay">
            <!-- EyePlayer v1.1 — живе око з жмурінням, lerp-трекінгом, touch -->
            <svg
              ref="heroEyeSvgRef"
              viewBox="0 0 360 240"
              class="wb-public-view__hero-svg"
              aria-hidden="true"
            >
              <defs>
                <radialGradient id="ep-irisG" cx="42%" cy="38%" r="58%">
                  <stop offset="0%" stop-color="#7ee8c8" />
                  <stop offset="25%" stop-color="#2db88a" />
                  <stop offset="55%" stop-color="#0f7a58" />
                  <stop offset="85%" stop-color="#085041" />
                  <stop offset="100%" stop-color="#043028" />
                </radialGradient>
                <radialGradient id="ep-pupilG" cx="38%" cy="32%" r="62%">
                  <stop offset="0%" stop-color="#4a4a4a" />
                  <stop offset="40%" stop-color="#1a1a1a" />
                  <stop offset="100%" stop-color="#000" />
                </radialGradient>
                <radialGradient id="ep-scleraG" cx="50%" cy="42%" r="55%">
                  <stop offset="0%" stop-color="#ffffff" />
                  <stop offset="65%" stop-color="#f2f0ec" />
                  <stop offset="100%" stop-color="#ddd8d0" />
                </radialGradient>
                <linearGradient id="ep-lidSkinG" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stop-color="#c8956a" />
                  <stop offset="55%" stop-color="#d4a882" />
                  <stop offset="100%" stop-color="#b8896a" />
                </linearGradient>
                <radialGradient id="ep-shadowG" cx="50%" cy="50%" r="50%">
                  <stop offset="0%" stop-color="#1D9E75" stop-opacity="0.2" />
                  <stop offset="100%" stop-color="#1D9E75" stop-opacity="0" />
                </radialGradient>
                <radialGradient id="ep-glintG" cx="30%" cy="30%" r="70%">
                  <stop offset="0%" stop-color="#fff" stop-opacity="0.95" />
                  <stop offset="100%" stop-color="#fff" stop-opacity="0" />
                </radialGradient>
                <clipPath id="ep-eyeClip">
                  <path d="M16 120 Q88 22 180 22 Q272 22 344 120 Q272 218 180 218 Q88 218 16 120 Z" />
                </clipPath>
                <clipPath id="ep-irisClip">
                  <circle ref="epIrisClipCRef" cx="180" cy="120" r="60" />
                </clipPath>
              </defs>

              <!-- Тінь під оком -->
              <ellipse cx="180" cy="150" rx="155" ry="26" fill="url(#ep-shadowG)" opacity="0.9" />

              <g class="eye-player-glow">
                <!-- Білок -->
                <path d="M16 120 Q88 22 180 22 Q272 22 344 120 Q272 218 180 218 Q88 218 16 120 Z"
                      fill="url(#ep-scleraG)" />

                <!-- Прожилки -->
                <g clip-path="url(#ep-eyeClip)" opacity="0.15">
                  <line x1="85" y1="92" x2="138" y2="114" stroke="#c0392b" stroke-width="0.7" stroke-linecap="round" />
                  <line x1="80" y1="110" x2="126" y2="120" stroke="#c0392b" stroke-width="0.5" stroke-linecap="round" />
                  <line x1="258" y1="96" x2="218" y2="114" stroke="#c0392b" stroke-width="0.7" stroke-linecap="round" />
                  <line x1="264" y1="114" x2="224" y2="122" stroke="#c0392b" stroke-width="0.5" stroke-linecap="round" />
                </g>

                <!-- Яблучко -->
                <g>
                  <circle ref="epIrisRef" cx="180" cy="120" r="60" fill="url(#ep-irisG)" clip-path="url(#ep-eyeClip)" />
                  <g ref="epIrisRaysRef" clip-path="url(#ep-irisClip)" opacity="0.55" />
                  <circle ref="epLimbusRef" cx="180" cy="120" r="59.5" fill="none" stroke="#032018" stroke-width="2.5" opacity="0.7" />
                  <circle ref="epIrisRingRef" cx="180" cy="120" r="42" fill="none" stroke="#085041" stroke-width="1" opacity="0.4" />
                  <circle ref="epPupilRef" cx="180" cy="120" r="22" fill="url(#ep-pupilG)" />
                  <polygon ref="epPlayRef" points="171,108 171,132 195,120" fill="white" opacity="0.9" />
                  <ellipse ref="epGlint1Ref" cx="164" cy="103" rx="11" ry="7"
                           fill="url(#ep-glintG)" opacity="0.88" transform="rotate(-22 164 103)" />
                  <ellipse ref="epGlint2Ref" cx="192" cy="134" rx="4.5" ry="2.8"
                           fill="white" opacity="0.3" transform="rotate(-15 192 134)" />
                </g>

                <!-- Верхнє повіко -->
                <path ref="epLidSkinRef"
                      d="M16 120 Q88 22 180 22 Q272 22 344 120 Q272 22 180 22 Q88 22 16 120 Z"
                      fill="url(#ep-lidSkinG)" clip-path="url(#ep-eyeClip)" />

                <!-- Складка повіка -->
                <path ref="epLidFoldRef" d="M40 120 Q180 22 320 120"
                      fill="none" stroke="#9a6040" stroke-width="1.4"
                      stroke-linecap="round" opacity="0" />

                <!-- Контур ока -->
                <path d="M16 120 Q88 22 180 22 Q272 22 344 120 Q272 218 180 218 Q88 218 16 120 Z"
                      fill="none" stroke="#1a1a1a" stroke-width="3.2" stroke-linecap="round" />

                <!-- Складка шкіри -->
                <path d="M38 98 Q180 8 322 98" fill="none" stroke="#555" stroke-width="1.3" opacity="0.2" stroke-linecap="round" />

                <!-- Вії верхні (рухаються з повіком) -->
                <g ref="epLashGroupRef">
                  <g stroke="#1a1a1a" stroke-linecap="round">
                    <line x1="66"  y1="55" x2="52"  y2="36" stroke-width="2.5" />
                    <line x1="98"  y1="38" x2="90"  y2="18" stroke-width="2.4" />
                    <line x1="134" y1="27" x2="130" y2="7"  stroke-width="2.3" />
                    <line x1="170" y1="22" x2="169" y2="2"  stroke-width="2.3" />
                    <line x1="206" y1="23" x2="208" y2="3"  stroke-width="2.3" />
                    <line x1="242" y1="30" x2="248" y2="10" stroke-width="2.4" />
                    <line x1="272" y1="46" x2="286" y2="28" stroke-width="2.5" />
                    <line x1="82"  y1="45" x2="72"  y2="26" stroke-width="1.6" opacity="0.6" />
                    <line x1="116" y1="30" x2="112" y2="10" stroke-width="1.6" opacity="0.6" />
                    <line x1="152" y1="23" x2="151" y2="3"  stroke-width="1.6" opacity="0.6" />
                    <line x1="188" y1="23" x2="190" y2="3"  stroke-width="1.6" opacity="0.6" />
                    <line x1="224" y1="27" x2="228" y2="7"  stroke-width="1.6" opacity="0.6" />
                    <line x1="258" y1="38" x2="268" y2="20" stroke-width="1.6" opacity="0.6" />
                  </g>
                </g>

                <!-- Вії нижні -->
                <g stroke="#1a1a1a" stroke-linecap="round" opacity="0.65">
                  <line x1="82"  y1="186" x2="68"  y2="202" stroke-width="2.0" />
                  <line x1="118" y1="202" x2="111" y2="218" stroke-width="1.9" />
                  <line x1="156" y1="212" x2="155" y2="229" stroke-width="1.9" />
                  <line x1="180" y1="217" x2="180" y2="234" stroke-width="1.9" />
                  <line x1="204" y1="212" x2="206" y2="229" stroke-width="1.9" />
                  <line x1="240" y1="202" x2="248" y2="218" stroke-width="1.9" />
                  <line x1="276" y1="186" x2="290" y2="201" stroke-width="2.0" />
                </g>

                <!-- Брова -->
                <path ref="epBrowRef" d="M58 18 Q180 -10 302 18"
                      fill="none" stroke="#1a1a1a" stroke-width="5" stroke-linecap="round" opacity="0.8" />
              </g>
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
        :current-index="replay?.currentIndex.value ?? 0"
        :total-operations="replay?.totalOperations.value ?? 0"
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
          @click="handlePageNav(store.currentPageIndex - 1)"
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
          @click="handlePageNav(store.currentPageIndex + 1)"
        >
          &rarr;
        </button>
      </footer>
    </template>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, nextTick, onMounted, onBeforeUnmount } from 'vue'
import { useRoute, useRouter, onBeforeRouteLeave } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { winterboardApi } from '../api/winterboardApi'
import { useWBStore } from '../board/state/boardStore'
import { useReplay } from '../composables/useReplay'
import { useReplayAudio } from '../composables/useReplayAudio'
import { audioManager } from '../utils/audioManager'
import { createReplayApplier } from '../engine/applyReplayOperation'
import { collectNewIdsFromOp, applyAppearanceFadeIn } from '../engine/animation/replayFadeIn'
import { useCanvasResize } from '../composables/useCanvasResize'
import WBCanvas from '../components/canvas/WBCanvas.vue'
import PublicReplayPlayer from '../components/public/PublicReplayPlayer.vue'
import PublicMarkersList from '../components/public/PublicMarkersList.vue'
import type { WBSession } from '../types/winterboard'
import type { ReplaySpeed } from '../engine/WBReplayEngine'

const { t } = useI18n()
const route = useRoute()
const router = useRouter()
const store = useWBStore()

// ── UI state (NOT board state — board lives in store) ──
const isLoading = ref(true)
const loadError = ref<{ title: string; message: string } | null>(null)
const isHydrated = ref(false)
const canvasRef = ref<InstanceType<typeof WBCanvas> | null>(null)
const canvasContainerRef = ref<HTMLElement | null>(null)

// ── EyePlayer v1.1 refs ──
const heroEyeWrapRef = ref<HTMLElement | null>(null)
const heroEyeSvgRef = ref<SVGSVGElement | null>(null)
const epIrisRef = ref<SVGCircleElement | null>(null)
const epLimbusRef = ref<SVGCircleElement | null>(null)
const epIrisRingRef = ref<SVGCircleElement | null>(null)
const epIrisClipCRef = ref<SVGCircleElement | null>(null)
const epPupilRef = ref<SVGCircleElement | null>(null)
const epPlayRef = ref<SVGPolygonElement | null>(null)
const epGlint1Ref = ref<SVGEllipseElement | null>(null)
const epGlint2Ref = ref<SVGEllipseElement | null>(null)
const epLidSkinRef = ref<SVGPathElement | null>(null)
const epLidFoldRef = ref<SVGPathElement | null>(null)
const epLashGroupRef = ref<SVGGElement | null>(null)
const epBrowRef = ref<SVGPathElement | null>(null)
const epIrisRaysRef = ref<SVGGElement | null>(null)

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
let _replayStateWatchStop: (() => void) | null = null  // CRITICAL 1: track watch handle to prevent leaks
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

  // CRITICAL 2: Destroy previous engine if re-entering (prevents timer leaks)
  if (replay) {
    replay.stop()
    replay.destroy()
    replay = null
  }
  // CRITICAL 1: Stop previous watch to prevent leak on re-entry
  if (_replayStateWatchStop) {
    _replayStateWatchStop()
    _replayStateWatchStop = null
  }

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
      // P2: skip per-op effects during batch seek — single redraw at end
      if (replay!.isBatchingSeek.value) return
      // Smooth appearance — covers stroke_add / asset_add AND their
      // batch variants (strokes_add_batch / assets_add_batch) emitted by
      // paste. See engine/animation/replayFadeIn.ts.
      const newIds = collectNewIdsFromOp(op)
      if (newIds.length === 0) return
      nextTick(() => {
        const stage = (canvasRef.value as unknown as { getStage?: () => Parameters<typeof applyAppearanceFadeIn>[0] })?.getStage?.()
        applyAppearanceFadeIn(stage, newIds)
      })
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
  // HIGH 21: minimum 1s to prevent division by zero in seek calculations
  if (replayDurationSeconds.value <= 0 && replay.totalDurationMs.value > 0) {
    replayDurationSeconds.value = Math.max(1, Math.ceil(replay.totalDurationMs.value / 1000))
  }

  // Load lesson markers
  await replay.loadMarkers()

  isReplayMode.value = true

  // CRITICAL 1: Track watch handle — stop on re-entry/unmount to prevent leaks.
  // Must be set up HERE (after `replay` is assigned), not at setup level,
  // because `replay` is a plain `let` — Vue can't track its assignment.
  _replayStateWatchStop = watch(() => replay!.state.value, (s) => {
    if (s === 'ended') showHeroOverlay.value = true
  })

  // P2: Single batchDraw at end of batch seek — prevents 1000+ redraws
  watch(() => replay!.seekCompleted.value, (done) => {
    if (!done) return
    requestAnimationFrame(() => {
      const stage = (canvasRef.value as unknown as { getStage?: () => Parameters<typeof applyAppearanceFadeIn>[0] })?.getStage?.()
      stage?.batchDraw?.()
    })
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

/** Hero overlay click → dismiss overlay + start/resume replay */
function handleHeroPlay(): void {
  showHeroOverlay.value = false
  if (!replay) return

  if (replay.state.value === 'ended') {
    // If user seeked via page nav (currentIndex < total), play from that position.
    // Canvas was already rebuilt by seekToWithSnapshot in handlePageNav.
    const atEnd = replay.currentIndex.value >= replay.totalOperations.value
    if (atEnd) {
      // Natural end — restart from beginning
      replay.seekToWithSnapshot(
        0,
        (bs) => store.loadSnapshot(bs as Parameters<typeof store.loadSnapshot>[0]),
        resetBoardForReplay,
      ).then(() => replay?.play())
    } else {
      // Already seeked to a specific position — just play from there
      replay.play()
    }
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
  // CRITICAL 3: guard against div/0 and missing replay
  if (!replay || replayDurationSeconds.value <= 0 || replay.totalOperations.value <= 0) return

  const ratio = Math.max(0, Math.min(1, (timeMs / 1000) / replayDurationSeconds.value))
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
  if (!replay || !hasReplayData.value) return  // CRITICAL 4: null guard
  replayAudio.stopAudio()  // INV I5
  replay.stepForward()
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

// ─── Page navigation with replay seek ────────────────────────────────────────
async function handlePageNav(targetIndex: number): Promise<void> {
  // Outside replay — just switch page
  if (!isReplayMode.value || !replay) {
    store.goToPage(targetIndex)
    return
  }

  const targetPageId = store.pages[targetIndex]?.id
  if (!targetPageId) {
    store.goToPage(targetIndex)
    return
  }

  // Find first op belonging to the target page
  const total = replay.totalOperations.value
  let firstOpIdx = -1
  for (let i = 0; i < total; i++) {
    const op = replay.getOperationAt(i)
    if (op && op.page_id === targetPageId) {
      firstOpIdx = i
      break
    }
  }

  if (firstOpIdx >= 0) {
    replayAudio.stopAudio()
    await replay.seekToWithSnapshot(
      firstOpIdx,
      (boardState) => {
        store.loadSnapshot(boardState as { pages: import('../types/winterboard').WBPage[]; currentPageIndex: number })
      },
      resetBoardForReplay,
    )
  }

  // Ensure correct page is shown (seek may land on a page_navigate op
  // that hasn't been applied yet, or the page may have no ops)
  store.goToPage(targetIndex)

  // Hide hero overlay so user can see the page content.
  // Replay stays paused — user can press Play in the controls bar.
  showHeroOverlay.value = false
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
    if (status === 410) {
      // Share Layer S.3: dedicated 🪦 landing для trashed replay — NOT inline error
      router.replace({ name: 'winterboard-replay-gone' })
      return
    }
    if (status === 404) {
      loadError.value = {
        title: t('winterboard.public.notFound'),
        message: t('winterboard.public.sessionNotFound'),
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

// CRITICAL 5: Route guard — cleanup replay before navigation (prevents callbacks after unmount)
onBeforeRouteLeave(() => {
  if (_replayStateWatchStop) { _replayStateWatchStop(); _replayStateWatchStop = null }
  audioManager.stop()
  replayAudio.destroy()
  if (replay) {
    replay.stop()
    replay.destroy()
    replay = null
  }
})

// ── EyePlayer v1.1 — живе око з жмурінням, lerp, touch ──────────────────────
const EP_CX = 180, EP_CY = 120, EP_MAX = 26
let _epCurX = EP_CX, _epCurY = EP_CY, _epTargetX = EP_CX, _epTargetY = EP_CY
let _epPupilR = 22, _epBasePupilR = 22, _epBreathT = 0
let _epMouseIdle = true, _epIdleTimer: ReturnType<typeof setTimeout> | null = null
let _epIdleSeqTimer: ReturnType<typeof setTimeout> | null = null
let _epIsSquinting = false, _epSquintFrame: number | null = null, _epSquintProgress = 0
let _epDestroyed = false, _epLoopRaf = 0

const _lerp = (a: number, b: number, t: number) => a + (b - a) * t
const _eio = (t: number) => t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t
const _rand = (a: number, b: number) => a + Math.random() * (b - a)

/** Промінці райдужки — генеруються один раз при mount */
function _epBuildIrisRays(): void {
  const g = epIrisRaysRef.value
  if (!g) return
  for (let i = 0; i < 40; i++) {
    const a = (i / 40) * Math.PI * 2
    const r0 = 26 + Math.random() * 7, r1 = 48 + Math.random() * 12
    const sp = 0.018 + Math.random() * 0.022
    const x0 = EP_CX + Math.cos(a) * r0, y0 = EP_CY + Math.sin(a) * r0
    const x1 = EP_CX + Math.cos(a - sp) * r1, y1 = EP_CY + Math.sin(a - sp) * r1
    const x2 = EP_CX + Math.cos(a + sp) * r1, y2 = EP_CY + Math.sin(a + sp) * r1
    const p = document.createElementNS('http://www.w3.org/2000/svg', 'path')
    p.setAttribute('d', `M${x0},${y0} L${x1},${y1} L${x2},${y2} Z`)
    p.setAttribute('fill', Math.random() > 0.5 ? '#9ee8cc' : '#032018')
    p.setAttribute('opacity', (0.10 + Math.random() * 0.24).toFixed(2))
    g.appendChild(p)
  }
}

/** Позиція яблучка */
function _epSetEyeball(nx: number, ny: number, pr: number): void {
  const s = String
  ;[epIrisRef, epLimbusRef, epIrisRingRef, epIrisClipCRef].forEach(r => {
    r.value?.setAttribute('cx', s(nx))
    r.value?.setAttribute('cy', s(ny))
  })
  epPupilRef.value?.setAttribute('cx', s(nx))
  epPupilRef.value?.setAttribute('cy', s(ny))
  epPupilRef.value?.setAttribute('r', s(Math.max(15, pr)))
  epIrisRaysRef.value?.setAttribute('transform', `translate(${nx - EP_CX},${ny - EP_CY})`)
  const px = nx - 9, py = ny - 12
  epPlayRef.value?.setAttribute('points', `${px},${py} ${px},${py + 24} ${px + 24},${py + 12}`)
  epGlint1Ref.value?.setAttribute('cx', s(nx - 16))
  epGlint1Ref.value?.setAttribute('cy', s(ny - 17))
  epGlint2Ref.value?.setAttribute('cx', s(nx + 12))
  epGlint2Ref.value?.setAttribute('cy', s(ny + 14))
}

/** Повіко: p=0 → відкрито, p=1 → жмуриться */
function _epUpdateLid(p: number): void {
  _epSquintProgress = p
  if (p < 0.005) {
    epLidSkinRef.value?.setAttribute('d', 'M16 120 Q88 22 180 22 Q272 22 344 120 Q272 22 180 22 Q88 22 16 120 Z')
    epLidFoldRef.value?.setAttribute('opacity', '0')
    epLashGroupRef.value?.setAttribute('transform', 'translate(0,0)')
    epBrowRef.value?.setAttribute('d', 'M58 18 Q180 -10 302 18')
    return
  }
  const lowY = _lerp(22, 112, p)
  epLidSkinRef.value?.setAttribute('d',
    `M16 120 Q88 22 180 22 Q272 22 344 120 Q272 ${lowY} 180 ${lowY} Q88 ${lowY} 16 120 Z`)
  const foldY = _lerp(22, 72, p)
  epLidFoldRef.value?.setAttribute('d', `M40 120 Q180 ${foldY} 320 120`)
  epLidFoldRef.value?.setAttribute('opacity', String(p * 0.45))
  epLashGroupRef.value?.setAttribute('transform', `translate(0,${p * 22})`)
  epBrowRef.value?.setAttribute('d',
    `M58 ${_lerp(18, 10, p)} Q180 ${_lerp(-10, -24, p)} 302 ${_lerp(18, 10, p)}`)
}

/** Жмуріння (анімація) */
function _epSquint(on: boolean, cb?: () => void): void {
  if (_epIsSquinting === on) { cb?.(); return }
  _epIsSquinting = on
  if (_epSquintFrame) cancelAnimationFrame(_epSquintFrame)
  const startP = _epSquintProgress, endP = on ? 1 : 0
  const steps = 16
  let s = 0
  function run() {
    _epUpdateLid(startP + (endP - startP) * _eio(s / steps))
    s++
    if (s <= steps) _epSquintFrame = requestAnimationFrame(run)
    else { _epSquintFrame = null; cb?.() }
  }
  _epSquintFrame = requestAnimationFrame(run)
}

/** Idle-послідовність: рандомний погляд + іноді жмуріння */
function _epScheduleIdle(): void {
  if (_epDestroyed || !_epMouseIdle) return
  _epIdleSeqTimer = setTimeout(() => {
    if (!_epMouseIdle) return
    const a = Math.random() * Math.PI * 2
    _epTargetX = EP_CX + Math.cos(a) * _rand(8, 20)
    _epTargetY = EP_CY + Math.sin(a) * _rand(5, 12)
    if (Math.random() > 0.45) {
      _epSquint(true, () => {
        if (!_epMouseIdle) { _epSquint(false); return }
        _epIdleSeqTimer = setTimeout(() => {
          _epSquint(false, () => _epScheduleIdle())
        }, _rand(500, 1100))
      })
    } else {
      _epScheduleIdle()
    }
  }, _rand(900, 1800))
}

/** Pointer tracking (mouse + touch) */
function _epHandlePointer(cx: number, cy: number): void {
  const svg = heroEyeSvgRef.value
  if (!svg) return
  const rect = svg.getBoundingClientRect()
  if (rect.width === 0) return
  _epTargetX = (cx - rect.left) * (360 / rect.width)
  _epTargetY = (cy - rect.top) * (240 / rect.height)
  if (_epMouseIdle) {
    _epMouseIdle = false
    if (_epIdleSeqTimer) clearTimeout(_epIdleSeqTimer)
    _epSquint(false)
  }
  if (_epIdleTimer) clearTimeout(_epIdleTimer)
  _epIdleTimer = setTimeout(() => { _epMouseIdle = true; _epScheduleIdle() }, 2000)
}

function _epOnMouseMove(e: MouseEvent): void { _epHandlePointer(e.clientX, e.clientY) }
function _epOnTouchMove(e: TouchEvent): void {
  e.preventDefault()
  _epHandlePointer(e.touches[0].clientX, e.touches[0].clientY)
}
function _epOnSvgEnter(): void { _epBasePupilR = 30 }
function _epOnSvgLeave(): void { _epBasePupilR = 22 }

/** Головний цикл (lerp + breathing) */
function _epLoop(): void {
  if (_epDestroyed) return
  _epCurX = _lerp(_epCurX, _epTargetX, 0.07)
  _epCurY = _lerp(_epCurY, _epTargetY, 0.07)
  const dx = _epCurX - EP_CX, dy = _epCurY - EP_CY
  const lim = Math.min(Math.sqrt(dx * dx + dy * dy), EP_MAX)
  const ang = Math.atan2(dy, dx)
  _epBreathT += 0.022
  _epPupilR = _lerp(_epPupilR, _epBasePupilR + Math.sin(_epBreathT) * 1.8, 0.06)
  _epSetEyeball(EP_CX + Math.cos(ang) * lim, EP_CY + Math.sin(ang) * lim, _epPupilR)
  _epLoopRaf = requestAnimationFrame(_epLoop)
}

/** Start/stop eye when overlay shows/hides */
function _epStart(): void {
  _epDestroyed = false
  _epBuildIrisRays()
  _epUpdateLid(0)
  document.addEventListener('mousemove', _epOnMouseMove)
  document.addEventListener('touchmove', _epOnTouchMove, { passive: false } as AddEventListenerOptions)
  heroEyeWrapRef.value?.addEventListener('mouseenter', _epOnSvgEnter)
  heroEyeWrapRef.value?.addEventListener('mouseleave', _epOnSvgLeave)
  _epLoopRaf = requestAnimationFrame(_epLoop)
  _epIdleTimer = setTimeout(() => { _epMouseIdle = true; _epScheduleIdle() }, 2000)
}

function _epStop(): void {
  _epDestroyed = true
  document.removeEventListener('mousemove', _epOnMouseMove)
  document.removeEventListener('touchmove', _epOnTouchMove)
  heroEyeWrapRef.value?.removeEventListener('mouseenter', _epOnSvgEnter)
  heroEyeWrapRef.value?.removeEventListener('mouseleave', _epOnSvgLeave)
  cancelAnimationFrame(_epLoopRaf)
  if (_epSquintFrame) cancelAnimationFrame(_epSquintFrame)
  if (_epIdleTimer) clearTimeout(_epIdleTimer)
  if (_epIdleSeqTimer) clearTimeout(_epIdleSeqTimer)
  // Очистити промінці при stop, щоб при наступному start не дублювались
  const g = epIrisRaysRef.value
  if (g) while (g.firstChild) g.removeChild(g.firstChild)
}

// Watch actual overlay visibility (all 3 conditions from v-if)
const _heroOverlayVisible = computed(() => showHeroOverlay.value && isReplayMode.value && hasReplayData.value)
watch(_heroOverlayVisible, (show) => {
  if (show) nextTick(() => _epStart())
  else _epStop()
})

onBeforeUnmount(() => {
  // INV I6: Stop audio + destroy watcher on unmount (safety net if route guard didn't fire)
  if (_replayStateWatchStop) { _replayStateWatchStop(); _replayStateWatchStop = null }
  audioManager.stop()
  replayAudio.destroy()
  if (replay) {
    replay.stop()
    replay.destroy()
    replay = null
  }
  // Cleanup EyePlayer
  _epStop()
  store.$reset()
})
</script>

<style scoped>
/* ── M4SH Public Replay — uses global theme tokens ── */
.wb-public-view {
  display: flex;
  flex-direction: column;
  height: calc(var(--wb-vh, 1vh) * 100);
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
  padding: 0 var(--wb-active-spacing, 24px);
  height: var(--wb-header-height, 48px);
  background: var(--wb-header-bg, #047857);
  color: #fff;
  flex-shrink: 0;
}
.wb-public-view__brand {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  flex-shrink: 0;
  color: inherit;
  text-decoration: none;
  transition: opacity 0.12s ease;
}
.wb-public-view__brand:hover,
.wb-public-view__brand:focus-visible {
  opacity: 0.85;
}
.wb-public-view__brand:focus-visible {
  outline: 2px solid rgba(255, 255, 255, 0.6);
  outline-offset: 2px;
  border-radius: 4px;
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
    height: var(--wb-header-height-mobile, 40px);
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

  .wb-public-view__hero-overlay { gap: 16px; }
  .wb-public-view__hero-eye { width: clamp(200px, 60vw, 320px); }
  .wb-public-view__hero-title { font-size: 1.125rem; }
}

/* Display (large screens / multimedia boards) */
@media (min-width: 1920px) {
  .wb-public-view__header {
    height: var(--wb-header-height-display, 56px);
    padding: 0 32px;
  }
  .wb-public-view__hero-title { font-size: 2rem; }
  .wb-public-view__hero-meta { font-size: 1.125rem; }
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
  z-index: 10;
  transition: background 0.3s;
}

.wb-public-view__hero-eye {
  width: clamp(260px, 42vw, 600px);
  cursor: pointer;
}

.wb-public-view__hero-svg {
  width: 100%;
  height: auto;
  overflow: visible;
  pointer-events: none; /* clicks pass through to overlay */
}

/* Glow на очному яблучку — реагує на hover overlay */
.eye-player-glow {
  filter: drop-shadow(0 4px 12px var(--shadow, rgba(5, 150, 105, 0.2)));
  transition: filter 0.35s ease;
}
.wb-public-view__hero-overlay:hover .eye-player-glow {
  filter: drop-shadow(0 0 18px var(--shadow-strong, rgba(5, 150, 105, 0.35)))
          drop-shadow(0 0 42px var(--shadow, rgba(5, 150, 105, 0.2)));
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
