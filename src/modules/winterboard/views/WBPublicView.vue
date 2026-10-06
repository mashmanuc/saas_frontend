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
        <!-- «← Мої записи» — лише власнику (публічний глядач такого списку не
             має). Раніше з програвача не було видимого виходу, крім логотипа,
             що веде на головну (візуальний огляд 2026-09-22, п.5а). -->
        <router-link
          v-if="isOwnerView"
          to="/winterboard/replays"
          class="wb-public-view__to-list"
        >
          ← {{ t('winterboard.replayList.title') }}
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
          <!-- EyePlayer v1.1 — живе око; 2026-09-27 винесено в компонент, щоб те саме
               око стояло і на лендингу. touch — як і раніше: реплей повноекранний. -->
          <EyePlayer class="wb-public-view__hero-eye" capture-touch @click="handleHeroPlay" />
          <div class="wb-public-view__hero-info">
            <h2 class="wb-public-view__hero-title">{{ displayTitle }}</h2>
            <p v-if="heroMetaParts.length > 0" class="wb-public-view__hero-meta">
              {{ heroMetaParts.join(' · ') }}
            </p>
          </div>
        </div>

        <!-- Кінець запису (власник 2026-09-27): дошка й шкала лишаються, ненав'язливі дії
             з'являються після витримки готової дошки. Стартова заставка «кінцем» не буває. -->
        <Transition name="wb-replay-end">
          <div
            v-if="showEndActions && isReplayMode && hasReplayData && !showHeroOverlay"
            class="wb-public-view__end-actions"
            role="group"
            :aria-label="t('winterboard.replay.end.label')"
          >
            <button type="button" class="wb-public-view__end-btn" @click="restartReplay">
              {{ t('winterboard.replay.end.watchAgain') }}
            </button>
            <button v-if="canShareReplay" type="button" class="wb-public-view__end-btn" @click="shareReplay">
              {{ t('winterboard.replay.end.share') }}
            </button>
          </div>
        </Transition>
        <Transition name="wb-replay-end">
          <div v-if="showLinkCopied" class="wb-public-view__end-toast" role="status" aria-live="polite">
            {{ t('winterboard.replay.end.linkCopied') }}
          </div>
        </Transition>
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
        :lesson-seconds="replayLessonSeconds"
        :lesson-duration-seconds="lessonDurationSeconds"
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
import { getReplay } from '../api/replayLifecycleApi'
import { useWBStore } from '../board/state/boardStore'
import { useReplay } from '../composables/useReplay'
import { useReplayV2 } from '../composables/useReplayV2'
import { REPLAY_EPILOGUE_MS } from '../engine/replayViewTime'
import { useReplayPlayhead } from '../composables/useReplayPlayhead'
import { useReplayAudio } from '../composables/useReplayAudio'
import { audioManager } from '../utils/audioManager'
import { createReplayApplier } from '../engine/applyReplayOperation'
import { flushPendingUpdates } from '../board/state/assetUpdateBatcher'
import { collectNewIdsFromOp, applyAppearanceFadeIn } from '../engine/animation/replayFadeIn'
import { useCanvasResize } from '../composables/useCanvasResize'
import WBCanvas from '../components/canvas/WBCanvas.vue'
import PublicReplayPlayer from '../components/public/PublicReplayPlayer.vue'
import PublicMarkersList from '../components/public/PublicMarkersList.vue'
import EyePlayer from '../components/public/EyePlayer.vue'
import type { WBSession } from '../types/winterboard'
import type { ReplaySpeed } from '../engine/WBReplayEngine'
import { activeLocale } from '@/utils/i18nDate'

const { t } = useI18n()
const route = useRoute()
/** Свій запис (маршрут `/winterboard/replay/:replayId`), а не публічне посилання. */
const isOwnerView = computed(() => route.name === 'winterboard-replay-owner')
const router = useRouter()
const store = useWBStore()

// ── UI state (NOT board state — board lives in store) ──
const isLoading = ref(true)
const loadError = ref<{ title: string; message: string } | null>(null)
const isHydrated = ref(false)
const canvasRef = ref<InstanceType<typeof WBCanvas> | null>(null)
const canvasContainerRef = ref<HTMLElement | null>(null)

// Auto-fit canvas to container (same as SoloRoom).
// Читає актуальний розмір контейнера і виставляє zoom так, щоб уся сторінка
// (1920×1080) вмістилась у viewport. Cap at 1 → не зумимо понад 100%.
function applyReplayFit(): void {
  const el = canvasContainerRef.value
  if (!el) return
  const rect = el.getBoundingClientRect()
  const w = Math.floor(rect.width)
  const h = Math.floor(rect.height)
  if (w > 0 && h > 0 && store.pageWidth > 0 && store.pageHeight > 0) {
    const fitZoom = Math.min(w / store.pageWidth, h / store.pageHeight, 1)
    store.setZoom(fitZoom)
  }
}

useCanvasResize({
  containerRef: canvasContainerRef,
  onResize() {
    applyReplayFit()
  },
  debounceMs: 100,
})

// ── Replay ──
const hasReplayData = ref(false)
const isReplayMode = ref(false)
const showHeroOverlay = ref(true)  // Hero overlay shown until user clicks Play — лише ДО першої гри
// Кінець запису: дії «Переглянути ще раз / Поділитися» поверх видимої дошки (не заставка).
const showEndActions = ref(false)
const showLinkCopied = ref(false)
// Довжина шкали, с. V2 — час перегляду (паузи стиснуто, + витримка); V1 (?replay=v1) — реальний.
const replayDurationSeconds = ref(0)
// Реальна тривалість уроку (перша → остання op), с — окремий підпис, не шкала.
const lessonDurationSeconds = ref(0)
const replaySessionId = ref<string | null>(null)
let replay: ReturnType<typeof useReplay> | null = null
type ReplayV2Api = ReturnType<typeof useReplayV2>
/** V2 — шкала перегляду; V1 (аварійний ?replay=v1) — стара шкала реального часу. */
function viewApi(): ReplayV2Api | null {
  return replay && 'currentViewMs' in replay ? (replay as unknown as ReplayV2Api) : null
}
let _replayStateWatchStop: (() => void) | null = null  // CRITICAL 1: track watch handle to prevent leaks
// Повзунок часу: плавно за годинником між op, вирівнюється з дошкою на кожній op
// (рушій стискає паузи > 2 с — без вирівнювання повзунок відставав назавжди).
const playhead = useReplayPlayhead()
const playheadMs = playhead.playheadMs
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
      const formatted = d.toLocaleDateString(activeLocale(), {
        day: '2-digit', month: '2-digit', year: 'numeric',
      })
      return t('winterboard.public.lessonFromDate', { date: formatted })
    } catch {
      /* fall through */
    }
  }
  return t('winterboard.room.untitled')
})

// Позиція на шкалі (REPLAY_MANIFEST v2.3): у V2 — час перегляду, та сама формула, що й
// затримки рушія (replayViewTime), тож повзунок іде рівно й доходить до кінця разом з дошкою.
const replayCurrentSeconds = computed(() => Math.max(0, playheadMs.value / 1000))
// Час уроку в точці повзунка — для `?t=`: старі посилання несуть час уроку, нові — теж.
const replayLessonSeconds = computed(() => {
  const ms = playheadMs.value
  const v = viewApi()
  return Math.max(0, (v ? v.lessonMsAtView(ms) : ms) / 1000)
})

function formatClock(sec: number): string {
  const total = Math.max(0, Math.floor(sec))
  const h = Math.floor(total / 3600)
  const m = Math.floor((total % 3600) / 60)
  const s = total % 60
  return h > 0 ? `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}` : `${m}:${String(s).padStart(2, '0')}`
}

const heroMetaParts = computed(() => {
  const parts: string[] = []
  if (replayDurationSeconds.value > 0) parts.push(formatClock(replayDurationSeconds.value))
  if (lessonDurationSeconds.value > 0) {
    parts.push(t('winterboard.replay.lessonDuration', { time: formatClock(lessonDurationSeconds.value) }))
  }
  if (store.pageCount > 1) parts.push(`${store.pageCount} ${t('winterboard.replay.statPages')}`)
  return parts
})

// Map lesson markers → replay marker format.
// lesson_time_seconds беремо з реального timestamp op[operation_index], а не з лінійного idx/total,
// інакше крапка маркера на тайлайні і момент, куди веде клік, розʼїжджаються.
const replayMarkers = computed(() => {
  if (!replay) return []
  const v = viewApi()
  return replay.markers.value.map(m => ({
    id: m.id,
    title: m.title,
    // Позиція на шкалі: V2 — момент перегляду op мітки; V1 — реальний час.
    lesson_time_seconds: (v ? v.viewMsAtIndex(m.operation_index) : replay!.getOperationTimeMs(m.operation_index)) / 1000,
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
  // CRITICAL 1: Stop previous watches to prevent leaks on re-entry
  if (_replayStateWatchStop) {
    _replayStateWatchStop()
    _replayStateWatchStop = null
  }
  playhead.detach()
  playhead.reset()

  // Save static snapshot before replay
  staticSnapshot = store.getSnapshotState()

  // Prepare store for replay
  store.setMode('replay')
  flushPendingUpdates()    // P2: drain any pending live-edit RAF updates before replay entry
  store.resetForReplay()
  replayApplier.reset()  // P0: clean instance page-tracking state

  // Create replay composable — Phase C (2026-05-14): V2 is now the default.
  // INV-V2-5: feature flag runtime-only, no build-time env check.
  //
  // Flag routing:
  //   (no flag)       → V2 + PublicSnapshotProvider  [DEFAULT — snapshot-accelerated seek]
  //   ?replay=v2      → V2 + AuthSnapshotProvider / NullProvider (explicit: no public snap)
  //   ?replay=v2-public → V2 + PublicSnapshotProvider (explicit Phase B — same as default now)
  //   ?replay=v1      → V1 legacy engine [ROLLBACK ESCAPE HATCH — remove after Phase C soak]
  const token = route.params.token as string | undefined
  const ownerReplayId = route.params.replayId as string | undefined
  const replayFlag = route.query['replay']
  const useV1 = replayFlag === 'v1'  // explicit rollback only
  // Public snapshots = on by default; off only for explicit ?replay=v2 (auth owner view)
  const usePublicSnapshots = !ownerReplayId && !useV1 && replayFlag !== 'v2'
  replay = useV1 && !ownerReplayId
    ? useReplay(replaySessionId.value, token)
    : useReplayV2(replaySessionId.value!, token, { usePublicSnapshots, ownerReplayId })

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
  const v2 = viewApi()
  if (v2) {
    replayDurationSeconds.value = v2.totalViewMs.value / 1000
    lessonDurationSeconds.value = v2.lessonDurationMs.value / 1000
  } else if (replayDurationSeconds.value <= 0 && replay.totalDurationMs.value > 0) {
    replayDurationSeconds.value = Math.max(1, Math.ceil(replay.totalDurationMs.value / 1000))
  }

  // Load lesson markers
  await replay.loadMarkers()

  isReplayMode.value = true

  // Replay metrics audit (помічник 2026-04-29 round 2): tiered thresholds
  // щоб уникнути шуму на legacy ops/edge cases.
  //   ratio >= 0.95 → silent (acceptable)
  //   0.8 <= ratio < 0.95 → console.warn (degraded)
  //   ratio < 0.8 → console.error (broken — surface для investigation)
  const replayStats = replayApplier.getStats()
  if (replayStats.total > 0 && replayStats.ratio < 0.95) {
    const ctx = {
      applied: replayStats.applied,
      skipped: replayStats.skipped,
      total: replayStats.total,
      ratio: replayStats.ratio.toFixed(3),
      sessionId: replaySessionId.value,
    }
    if (replayStats.ratio < 0.8) {
      console.error('[Replay] CRITICAL: applied/total < 0.8 — replay broken', ctx)
    } else {
      console.warn('[Replay] degraded: applied/total < 0.95', ctx)
    }
  }

  // CRITICAL 1: Track watch handle — stop on re-entry/unmount to prevent leaks.
  // Must be set up HERE (after `replay` is assigned), not at setup level,
  // because `replay` is a plain `let` — Vue can't track its assignment.
  _replayStateWatchStop = watch(() => replay!.state.value, (s) => {
    // Кінець: готова дошка вже постояла витримку (рушій), тепер — ненав'язливі дії; дошка й
    // шкала лишаються. Раніше тут вмикалась стартова заставка з затемненням у ту саму мить,
    // що й остання op, — «обрізалось» (власник 2026-09-27).
    showEndActions.value = s === 'ended'
  })

  // P2: Single batchDraw at end of batch seek — prevents 1000+ redraws
  watch(() => replay!.seekCompleted.value, (done) => {
    if (!done) return
    requestAnimationFrame(() => {
      const stage = (canvasRef.value as unknown as { getStage?: () => Parameters<typeof applyAppearanceFadeIn>[0] })?.getStage?.()
      stage?.batchDraw?.()
    })
  })

  // Повзунок: тікер на старті гри + вирівнювання з дошкою на кожній op.
  playhead.attach(v2 ? {
    state: () => replay!.state.value,
    currentTimeMs: () => v2.currentViewMs.value,
    totalMs: () => v2.totalViewMs.value,
    epilogueStartedAt: () => v2.epilogueStartedAt.value,
    epilogueMs: REPLAY_EPILOGUE_MS,
  } : {
    state: () => replay!.state.value,
    currentTimeMs: () => replay!.currentTimeMs.value,
    totalMs: () => replay!.totalDurationMs.value,
  })

  // Handle ?t= URL parameter — auto-seek to time
  const tParam = route.query.t as string | undefined
  if (tParam) {
    const seconds = Number(tParam)
    if (!isNaN(seconds) && seconds > 0) {
      // `t` — час уроку (так його писали й старі посилання), не час перегляду.
      await seekToLessonMs(seconds * 1000)
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
  playhead.detach()
  playhead.reset()
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
  // Natural end — з початку; якщо після кінця перемотали (page nav / шкала) — грати звідти.
  if (isAtNaturalEnd()) {
    void restartReplay()
    return
  }
  replay.play()
}

function isAtNaturalEnd(): boolean {
  return !!replay && replay.state.value === 'ended' && replay.currentIndex.value >= replay.totalOperations.value
}

/**
 * З початку: спершу скинути дошку, потім грати. Просте play() після кінця запускало рушій
 * з op[0] поверх ГОТОВОЇ дошки — ops лягли б удруге (досі не було видно, бо панель після
 * кінця ховалась під заставкою).
 */
async function restartReplay(): Promise<void> {
  if (!replay) return
  await seekToIndex(0, 0)
  replay?.play()
}

// «Поділитися» в кінці — лише для публічного посилання; власник ділиться записом зі списку.
const canShareReplay = computed(() => Boolean(route.params.token))

async function shareReplay(): Promise<void> {
  const url = new URL(window.location.href)
  url.search = ''   // увесь запис, без ?t= і службових прапорців
  url.hash = ''
  const text = url.toString()
  try {
    await navigator.clipboard.writeText(text)
  } catch (err) {
    // Буфер недоступний (http, політика браузера) — запасний шлях, як у «Поділитися моментом».
    console.info('[WB:PublicView] clipboard.writeText недоступний, копіюємо через поле:', err)
    const input = document.createElement('input')
    input.value = text
    document.body.appendChild(input)
    input.select()
    document.execCommand('copy')
    document.body.removeChild(input)
  }
  showLinkCopied.value = true
  setTimeout(() => { showLinkCopied.value = false }, 2500)
}

// NOTE: watch for replay.state → showHeroOverlay is set up inside enterReplayMode()
// (after `replay` object is created) — see FIX comment there.

function handleReplayPlay(): void {
  if (isAtNaturalEnd()) {
    void restartReplay()
    return
  }
  showEndActions.value = false
  replay?.play()
}

function handleReplayPause(): void {
  replay?.pause()
}

/** Клік по шкалі, ←/→, мітки: `timelineMs` — позиція на шкалі (V2 — час перегляду). */
async function handleReplaySeek(timelineMs: number): Promise<void> {
  // CRITICAL 3: guard against missing replay / empty timeline
  if (!replay || replay.totalOperations.value <= 0) return
  // Бінарний пошук першої op з позицією ≥ цілі. Лінійне ratio*totalOps було причиною
  // "стрибків" повзунка — ops розподілені у часі нерівномірно.
  const target = Math.max(0, timelineMs)
  const v = viewApi()
  const targetIndex = v ? v.findIndexByViewMs(target) : replay.findIndexByTimeMs(target)
  await seekToIndex(targetIndex, target)
}

/** `?t=` — час уроку (старі посилання): op за реальним часом, повзунок — на її момент перегляду. */
async function seekToLessonMs(lessonMs: number): Promise<void> {
  if (!replay || replay.totalOperations.value <= 0) return
  const targetIndex = replay.findIndexByTimeMs(Math.max(0, lessonMs))
  await seekToIndex(targetIndex, timelineMsAtIndex(targetIndex))
}

/** Позиція op на шкалі: V2 — момент перегляду, V1 — реальний час. */
function timelineMsAtIndex(index: number): number {
  const v = viewApi()
  return v ? v.viewMsAtIndex(index) : (replay?.getOperationTimeMs(index) ?? 0)
}

async function seekToIndex(targetIndex: number, displayMs: number): Promise<void> {
  if (!replay) return
  replayAudio.stopAudio()  // INV I5: stop audio on seek
  showEndActions.value = false

  // Snap playhead to target immediately so slider responds before canvas catches up.
  playhead.jumpTo(displayMs)

  await replay.seekToWithSnapshot(
    targetIndex,
    (boardState) => {
      store.loadSnapshot(boardState as { pages: import('../types/winterboard').WBPage[]; currentPageIndex: number })
    },
    resetBoardForReplay,
  )

  // Resync anchor to actual seeked position (currentTimeMs updated by finalizeSeek).
  playhead.resyncToEngine()
}

function handleSpeedChange(speed: number): void {
  playhead.setSpeed(speed)
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
    // Той самий шлях, що й клік по шкалі: повзунок стає на момент op, дії кінця ховаються
    // (інакше після кінця «Переглянути ще раз» висіла б над дошкою іншої сторінки на 100 %).
    await seekToIndex(firstOpIdx, timelineMsAtIndex(firstOpIdx))
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
  const token = route.params.token as string | undefined
  const ownerReplayId = route.params.replayId as string | undefined
  if (!token && !ownerReplayId) {
    loadError.value = {
      title: t('winterboard.public.notFound'),
      message: t('winterboard.public.invalidLink'),
    }
    isLoading.value = false
    return
  }

  try {
    // Private replay іде тільки авторизованим owner route. Публічний token
    // як і раніше не несе cookie/Authorization і лишається CDN-cacheable.
    const replayMeta = ownerReplayId ? await getReplay(ownerReplayId) : null
    const data = ownerReplayId
      ? await winterboardApi.getSession(replayMeta!.source_session!) as unknown as WBSession
      : await winterboardApi.getPublicSession(token!) as unknown as WBSession

    // Hydrate store — store is SSOT, no shadow state
    store.hydrateFromSession(data)
    store.setMode('readonly')

    // allow_download is API-only field, not part of store state
    allowDownload.value = (data as unknown as Record<string, unknown>).allow_download === true
    ownerName.value = ownerReplayId
      ? ''
      : (data as unknown as Record<string, string>).owner ?? ''
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
    // FIX (tablet/touch crop): canvasContainerRef рендериться лише ПІСЛЯ isLoading=false
    // (v-if guard). На момент component-mount контейнера не було → ResizeObserver у
    // useCanvasResize не приліпився, а hydrateFromSession() скинув zoom=1.
    // Тому явно fit'имо після того як canvas з'явився у DOM.
    await nextTick()
    applyReplayFit()
  }
})

// CRITICAL 5: Route guard — cleanup replay before navigation (prevents callbacks after unmount)
onBeforeRouteLeave(() => {
  if (_replayStateWatchStop) { _replayStateWatchStop(); _replayStateWatchStop = null }
  playhead.detach()
  audioManager.stop()
  replayAudio.destroy()
  if (replay) {
    replay.stop()
    replay.destroy()
    replay = null
  }
})

onBeforeUnmount(() => {
  // INV I6: Stop audio + destroy watcher on unmount (safety net if route guard didn't fire)
  if (_replayStateWatchStop) { _replayStateWatchStop(); _replayStateWatchStop = null }
  playhead.detach()
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
  color: var(--color-on-accent);
  border-radius: 6px;
  text-decoration: none;
  font-size: 0.875rem;
}

/* 2026-09-23 (FIRST USER GATE, п.6): було `color: var(--wb-brand)` — той самий
   зелений, що й тло шапки (`--wb-header-bg`, rgb(4,120,87)), тож посилання
   було на місці, але невидиме. Шапка біла по зеленому — посилання теж біле,
   з рамкою, щоб читалось як кнопка. */
.wb-public-view__to-list {
  flex-shrink: 0;
  margin-right: 0.75rem;
  padding: 3px 10px;
  border: 1px solid rgba(255, 255, 255, 0.55);
  border-radius: 999px;
  color: #fff;
  font-size: 0.8125rem;
  font-weight: 600;
  text-decoration: none;
  white-space: nowrap;
  transition: background 0.15s ease;
}

.wb-public-view__to-list:hover {
  background: rgba(255, 255, 255, 0.15);
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
  background: var(--color-surface-sunken, #f1f5f9);
  color: var(--wb-text, #0f172a);
  border-color: var(--color-border-strong, #cbd5e1);
}
.wb-download-btn {
  padding: 0.375rem 1rem;
  background: var(--wb-primary, #2563eb);
  color: var(--color-on-accent);
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
  color: var(--color-on-accent);
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

/* ── Кінець запису: ненав'язливі дії поверх готової дошки (власник 2026-09-27).
      Палітра — як у панелі програвача (PublicReplayPlayer), що теж лише світла. ── */
.wb-public-view__end-actions {
  position: absolute;
  left: 50%;
  bottom: 20px;
  transform: translateX(-50%);
  display: flex;
  gap: 4px;
  padding: 4px;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.94);
  box-shadow: 0 4px 16px rgba(15, 23, 42, 0.12);
  z-index: 5;
}
.wb-public-view__end-btn {
  border: 0;
  background: transparent;
  padding: 8px 16px;
  border-radius: 999px;
  font-size: 14px;
  font-weight: 600;
  color: #334155;
  cursor: pointer;
  white-space: nowrap;
}
.wb-public-view__end-btn:hover,
.wb-public-view__end-btn:focus-visible {
  background: #f1f5f9;
}
.wb-public-view__end-toast {
  position: absolute;
  left: 50%;
  bottom: 72px;
  transform: translateX(-50%);
  padding: 6px 12px;
  border-radius: 8px;
  background: rgba(15, 23, 42, 0.85);
  color: #fff;
  font-size: 13px;
  z-index: 6;
}
.wb-replay-end-enter-active,
.wb-replay-end-leave-active {
  transition: opacity 0.5s ease;
}
.wb-replay-end-enter-from,
.wb-replay-end-leave-to {
  opacity: 0;
}
@media (prefers-reduced-motion: reduce) {
  .wb-replay-end-enter-active,
  .wb-replay-end-leave-active {
    transition: none;
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

/* Glow на очному яблучку — реагує на hover overlay */
.wb-public-view__hero-overlay:hover :deep(.eye-player-glow) {
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

/* ── Темна тема (Б-156, фаза 2): ті самі селектори, що вище, — кольори токенами теми.
   Згенеровано з правил цього файлу; світла й класична не змінюються. ── */
[data-theme="dark"] .wb-public-view__to-list {
  border-color: var(--color-border);
}
[data-theme="dark"] .wb-download-icon-btn {
  border-color: var(--color-border) !important;
}
[data-theme="dark"] .wb-public-view__end-actions {
  background: var(--color-surface);
}
[data-theme="dark"] .wb-public-view__end-btn {
  color: var(--color-text);
}
[data-theme="dark"] .wb-public-view__end-btn:hover,
[data-theme="dark"] .wb-public-view__end-btn:focus-visible {
  background: var(--color-border);
}
[data-theme="dark"] .wb-public-view__end-toast {
  background: var(--color-surface-elevated);
}
</style>
