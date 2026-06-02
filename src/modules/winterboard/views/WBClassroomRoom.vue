<template>
  <!-- B3: Waiting for teacher state -->
  <div v-if="classroomSession.state.value === 'waiting_for_teacher'" class="wb-waiting-screen">
    <div class="wb-waiting-screen__content">
      <div class="wb-waiting-screen__spinner" />
      <h2 class="wb-waiting-screen__title">{{ t('winterboard.classroom.waitingForTeacher') }}</h2>
      <p class="wb-waiting-screen__text">{{ t('winterboard.classroom.waitingForTeacherHint') }}</p>
      <button class="wb-waiting-screen__back" @click="router.push('/winterboard/classroom-hub')">
        {{ t('winterboard.classroom.backToHub') }}
      </button>
    </div>
  </div>

  <!-- Lesson already completed — cannot re-enter classroom -->
  <div v-else-if="classroomSession.state.value === 'lesson_completed'" class="wb-waiting-screen">
    <div class="wb-waiting-screen__content">
      <div class="wb-waiting-screen__icon">✅</div>
      <h2 class="wb-waiting-screen__title">{{ t('winterboard.classroom.lessonCompleted') }}</h2>
      <p class="wb-waiting-screen__text">{{ t('winterboard.classroom.lessonCompletedHint') }}</p>
      <button class="wb-waiting-screen__back" @click="router.push('/winterboard/classroom-hub')">
        {{ t('winterboard.classroom.backToHub') }}
      </button>
    </div>
  </div>

  <div v-else class="wb-classroom-room" :class="{ 'wb-classroom-room--locked': isLocked }">
    <!-- Phase 2 (2026-04-27) per SSOT INV-16/INV-20:
         DesyncRecoveryBanner — sticky top, non-blocking (board still readable).
         ProtocolMismatchModal — full-screen blocking, single Reload button.
         Mutually exclusive by canonical reason taxonomy у opsSyncStore. -->
    <DesyncRecoveryBanner />
    <ProtocolMismatchModal />

    <!-- Skip link for a11y -->
    <a href="#wb-canvas" class="wb-skip-link">{{ t('winterboard.a11y.skipToCanvas') }}</a>

    <!-- ── Header ──────────────────────────────────────────────────────── -->
    <header class="wb-classroom-room__header">
      <!-- Left: Title + role badge -->
      <div class="wb-classroom-room__title">
        <input
          v-if="classroomRole.isTeacher.value"
          v-model="sessionName"
          class="wb-title-input"
          :placeholder="t('winterboard.room.untitled')"
          @blur="handleTitleBlur"
          @keydown.enter="($event.target as HTMLInputElement).blur()"
        />
        <span v-else class="wb-title-text">{{ sessionName }}</span>
        <span class="wb-role-badge" :class="`wb-role-badge--${classroomRole.role.value}`">
          {{ roleBadgeText }}
        </span>
        <span
          v-if="lessonStatus"
          class="wb-lesson-status"
          :class="`wb-lesson-status--${lessonStatus}`"
        >
          {{ t(`lessons.status.${lessonStatus}`) }}
        </span>
        <button
          v-if="classroomRole.isTeacher.value && lessonStatus === 'DRAFT'"
          class="wb-lesson-action-btn wb-lesson-action-btn--start"
          :disabled="lessonRuntime.isLoading"
          @click="handleStartLesson"
        >
          {{ t('winterboard.lesson.start') }}
        </button>
        <!-- B1: Кнопка "Готово" прибрана — завершення уроку через "Завершити сесію" -->
      </div>

      <!-- Center: Save status + lock indicator -->
      <div class="wb-classroom-room__status">
        <span class="wb-save-indicator" :class="`wb-save-indicator--${store.syncStatus}`">
          <span class="wb-save-indicator__dot" />
          <span class="wb-save-indicator__text">{{ saveStatusText }}</span>
        </span>
        <span v-if="isLocked" class="wb-lock-indicator" role="status" aria-live="polite">
          {{ t('winterboard.classroom.locked') }}
        </span>
      </div>

      <!-- Follow mode (students only — teacher should not follow anyone) -->
      <div v-if="classroomRole.isStudent.value && followMode.canFollow.value" class="wb-follow-controls">
        <button
          v-if="!followMode.isFollowing.value"
          type="button"
          class="wb-follow-btn"
          @click="followMode.startFollowing()"
        >
          {{ t('winterboard.room.followTeacher') }}
        </button>
        <div v-else class="wb-follow-indicator">
          <span class="wb-follow-indicator__dot" />
          <span>{{ t('winterboard.room.following', { name: followMode.followingDisplayName.value }) }}</span>
          <button type="button" class="wb-follow-stop-btn" @click="followMode.stopFollowing()">
            {{ t('winterboard.room.stopFollowing') }}
          </button>
        </div>
      </div>

      <!-- Student badge (teacher view, 1:1 model) -->
      <div v-if="classroomRole.isTeacher.value && connectedStudents.length" class="wb-student-badge">
        <span
          class="wb-student-badge__dot"
          :class="connectedStudents[0].is_online ? 'wb-student-badge__dot--online' : 'wb-student-badge__dot--offline'"
        />
        <span class="wb-student-badge__name">{{ connectedStudents[0].display_name }}</span>
        <span class="wb-student-badge__status">
          {{ connectedStudents[0].is_online ? t('winterboard.classroom.online') : t('winterboard.classroom.offline') }}
        </span>
      </div>
      <div v-else-if="classroomRole.isTeacher.value" class="wb-student-badge wb-student-badge--empty">
        <span class="wb-student-badge__dot wb-student-badge__dot--offline" />
        <span class="wb-student-badge__name">{{ t('winterboard.classroom.noStudents') }}</span>
      </div>

      <!-- Right: Actions -->
      <div class="wb-classroom-room__actions">
        <!-- PR1 (2026-05-03): Classroom recording parity з Solo — same WBSession,
             same /start-recording endpoint, same Replay model. SAFE per 7-point
             invariant verification. Handlers below викликають opsSync.flush() +
             autosave.saveNow() ДО POST /start-recording/, щоб backend deepcopy
             session.state містив свіжі ops (INV-T fix). -->
        <WBClassroomRecordingControls
          v-if="classroomRole.isTeacher.value"
          :recording-state="recordingState"
          :is-loading="isRecordingLoading"
          :recording-started-at="recordingStartedAt"
          @start="handleStartRecording"
          @pause="handlePauseRecording"
          @resume="handleResumeRecording"
          @finalize="handleFinalizeRecording"
          @restart="handleRestartRecordingRequest"
        />
        <!-- Lock toggle (teacher only) -->
        <button
          v-if="classroomRole.canLock.value"
          type="button"
          class="wb-header-btn"
          :class="{ 'wb-header-btn--active': isLocked }"
          :title="isLocked ? t('winterboard.classroom.unlock') : t('winterboard.classroom.lock')"
          :aria-pressed="isLocked"
          @click="handleToggleLock"
        >
          {{ isLocked ? '🔒' : '🔓' }}
        </button>

        <button
          type="button"
          class="wb-header-btn"
          :disabled="!store.canUndo || !classroomRole.canDraw.value"
          :title="t('winterboard.room.undoShortcut')"
          @click="handleUndo"
        >
          ↩
        </button>
        <button
          type="button"
          class="wb-header-btn"
          :disabled="!store.canRedo || !classroomRole.canDraw.value"
          :title="t('winterboard.room.redoShortcut')"
          @click="handleRedo"
        >
          ↪
        </button>

        <!-- YouTube insert (Phase 10) -->
        <button
          type="button"
          class="wb-header-btn"
          :disabled="isDrawingDisabled"
          :title="t('winterboard.youtube.insert')"
          @click="showYouTubeModal = true"
        >
          ▶️
        </button>

        <!-- End session + complete lesson (teacher only, B1: single action) -->
        <button
          v-if="classroomRole.canEnd.value"
          type="button"
          class="wb-header-btn wb-header-btn--danger"
          :title="t('winterboard.lesson.completeAndEnd')"
          @click="handleEndSession"
        >
          {{ t('winterboard.lesson.completeAndEnd') }}
        </button>

        <button type="button" class="wb-header-btn wb-header-btn--exit" @click="handleExit">
          {{ t('winterboard.room.exit') }}
        </button>
      </div>
    </header>

    <!-- ── Main: Toolbar + Canvas + Sidebar (teacher) ──────────────────── -->
    <!-- Order mirrors WBSoloRoom: toolbar/thumbnails ліворуч, canvas центр,
         materials sidebar праворуч (consistency tutor UX між prep і classroom). -->
    <div class="wb-classroom-room__main">
      <!-- Toolbar (role-aware) — PR2 (2026-05-04): Solo parity Group A.
           Додано: :has-selection, :has-locked-in-selection, :can-clear-page
           пропси + @lock-selected, @unlock-selected, @clear-page-request events.
           Усі handlers RBAC-guarded через classroomRole permissions. -->
      <aside class="wb-classroom-room__toolbar">
        <WBToolbar
          :current-tool="store.currentTool"
          :current-color="store.currentColor"
          :current-size="store.currentSize"
          :can-undo="store.canUndo"
          :can-redo="store.canRedo"
          :has-selection="store.hasSelection"
          :has-locked-in-selection="hasLockedInSelection"
          :can-clear-page="!isCanvasEmpty"
          :disabled="isDrawingDisabled"
          :hide-clear="!classroomRole.canClear.value"
          :variant="deviceModeState.deviceMode.value"
          @tool-change="handleToolChange"
          @color-change="handleColorChange"
          @size-change="handleSizeChange"
          @undo="handleUndo"
          @redo="handleRedo"
          @clear="handleClear"
          @lock-selected="handleLockSelected"
          @unlock-selected="handleUnlockSelected"
          @clear-page-request="handleClearPageRequest"
          @youtube-insert="showYouTubeModal = true"
        />
      </aside>

      <!-- Page thumbnails: видимі для обох ролей.
           Student бачить read-only: може переключати сторінки (soft-follow:
           тимчасово виходить з teacher sync, наступний teacher page change
           НЕ повертає student назад), але не може add/delete/duplicate/reorder.
           Tutor — повна поведінка (readOnly=false default). -->
      <WBPageThumbnails
        :pages="store.pages"
        :current-index="store.currentPageIndex"
        :read-only="!classroomRole.isTeacher.value"
        @select="handlePageSelect($event)"
        @add="handlePageAdd"
        @delete="handlePageDelete($event)"
        @duplicate="store.duplicatePage($event)"
        @reorder="(from: number, to: number) => store.reorderPages(from, to)"
      />

      <!-- Canvas -->
      <div
        id="wb-canvas"
        ref="canvasContainerRef"
        class="wb-classroom-room__canvas"
        tabindex="-1"
        @dragover.prevent
        @drop="contentDrop.handleCanvasDrop($event)"
      >
        <Transition name="wb-fade">
          <WBCanvasLoader v-if="isLoading" />
        </Transition>

        <WBCanvas
          v-show="!isLoading"
          ref="canvasRef"
          :tool="effectiveTool"
          :color="store.currentColor"
          :size="store.currentSize"
          :strokes="store.currentStrokes"
          :assets="store.currentAssets"
          :width="store.pageWidth"
          :height="store.pageHeight"
          :zoom="store.zoom"
          :read-only="isDrawingDisabled"
          @stroke-add="handleStrokeAdd"
          @stroke-update="handleStrokeUpdate"
          @stroke-delete="handleStrokeDelete"
          @laser-broadcast="handleLaserBroadcast"
          @asset-add="handleAssetAdd"
          @asset-update="handleAssetUpdate"
          @asset-delete="handleAssetDelete"
          @select="handleSelect"
          @cursor-move="handleCursorMove"
          @zoom-change="handleZoomChange"
          @scroll-change="handleScrollChange"
          @presentation-expand="handlePresentationExpand"
        />

        <!-- Remote cursors -->
        <WBRemoteCursors
          :cursors="presence.remoteCursors.value"
          :zoom="store.zoom"
          :current-page-id="store.currentPage?.id ?? ''"
        />
      </div>

      <!-- Teacher sidebar: full-featured materials (same as solo board).
           Праворуч від canvas — дзеркалить WBSoloRoom layout. -->
      <aside
        v-if="classroomRole.isTeacher.value"
        class="wb-classroom-room__sidebar"
        role="complementary"
        :aria-label="t('learningContent.panel.title')"
      >
        <GroupContentSidebar
          :group-id="classroomGroupId"
          :is-tutor="classroomRole.isTeacher.value"
          @place="handleSidebarPlace"
        />
      </aside>
    </div>

    <!-- P2: Selection toolbar — floating actions for selected objects (desktop only) -->
    <WBSelectionToolbar
      :selected-ids="store.selectedIds"
      :zoom="store.zoom"
      :canvas-rect="canvasContainerRef?.getBoundingClientRect() ?? null"
      :mode="'edit'"
      :is-locked="hasLockedInSelection"
      :bbox="selectionBBox"
      :selected-object="selectedObjectForToolbar"
      :session-id="resolvedSessionId ?? ''"
      :is-tutor="classroomRole.isTeacher.value"
      :pages="store.pages"
      :current-page-index="store.currentPageIndex"
      @bring-to-front="store.bringToFront(store.selectedIds[0])"
      @send-to-back="store.sendToBack(store.selectedIds[0])"
      @duplicate="store.copySelectedToClipboard(); store.pasteFromClipboard()"
      @send-to-page="handleSendToPage"
      @lock="locking.lockSelected()"
      @unlock="locking.unlockSelected()"
      @delete="handleDeleteSelected()"
      @text-format="handleTextFormat"
      @audio-uploaded="handleAudioUploaded"
      @audio-deleted="handleAudioDeleted"
      @link-saved="handleLinkSaved"
      @link-removed="handleLinkRemoved"
    />

    <!-- P3: YouTube insert modal -->
    <WBYouTubeModal
      :visible="showYouTubeModal"
      @close="showYouTubeModal = false"
      @submit="handleYouTubeSubmit"
    />

    <!-- PR1 (2026-05-03): Post-record share prompt — порт із WBSoloRoom:721-725.
         Замикає бак "Не знайдено" при відкритті replay-public-URL: вчитель
         одразу обирає visibility (private/unlisted/public) + копіює лінк. -->
    <WBRecordingDonePrompt
      :visible="showRecordingDonePrompt"
      :replay-id="activeReplayId"
      @dismiss="showRecordingDonePrompt = false"
    />


    <!-- INV-22 PR-1b: finalize barrier blocking modal (504 / 429) -->
    <WBFinalizeBarrierModal
      :state="finalizeBarrierState"
      :expected-seq="finalizeBarrierExpectedSeq"
      :current-seq="finalizeBarrierCurrentSeq"
      :retry-after-ms="finalizeBarrierRetryAfterMs"
      @retry="onFinalizeBarrierRetry"
    />

    <!-- Recording restart confirmation: finalized → новий cycle.
         Backend архівує попередній active Replay у /start-recording/. -->
    <WBRecordingRestartConfirmModal
      v-model="showRestartConfirmModal"
      :is-loading="isRestartingRecording"
      @confirm="confirmRestartRecording"
    />

    <!-- Phase 1: Recording controls moved into header -->


    <!-- Phase 38: Test teacher panel -->
    <WBTestTeacherPanel
      v-if="classroomRole.isTeacher.value && testStore.activeTestSessionId"
      @grade="handleTestGrade"
      @end="handleTestEnd"
    />

    <!-- Phase 38: Test student view -->
    <WBTestStudentView
      v-if="classroomRole.isStudent.value && testStore.activeTestSessionId"
    />

    <!-- Phase 3: Upload progress indicator -->
    <WBUploadIndicator
      :is-uploading="boardClipboard.isUploading.value"
      :upload-error="boardClipboard.uploadError.value"
    />

    <!-- ── Footer: Page nav + Zoom ─────────────────────────────────────── -->
    <footer class="wb-classroom-room__footer">
      <div class="wb-page-nav">
        <!-- Grid toggle button -->
        <WBGridButton
          :model-value="gridOverlay.gridType.value"
          :is-grid-active="gridOverlay.isGridActive.value"
          @update:model-value="gridOverlay.setGrid"
        />
        <div class="wb-page-nav__sep"></div>
        <button
          type="button"
          class="wb-page-btn"
          :disabled="store.currentPageIndex <= 0"
          :title="t('winterboard.room.prevPage')"
          @click="handlePagePrev"
        >
          ←
        </button>
        <span class="wb-page-indicator">
          {{ store.currentPageIndex + 1 }} / {{ store.pageCount }}
        </span>
        <button
          type="button"
          class="wb-page-btn"
          :disabled="store.currentPageIndex >= store.pageCount - 1"
          :title="t('winterboard.room.nextPage')"
          @click="handlePageNext"
        >
          →
        </button>
        <button
          v-if="classroomRole.canAddPage.value"
          type="button"
          class="wb-page-btn wb-page-btn--add"
          :disabled="store.pageCount >= 50"
          :title="t('winterboard.room.addPage')"
          @click="handlePageAdd"
        >
          +
        </button>
      </div>

      <div class="wb-zoom-controls">
        <button type="button" class="wb-zoom-btn" :title="t('winterboard.room.zoomOut')" @click="handleZoomOut">−</button>
        <span class="wb-zoom-level">{{ Math.round(store.zoom * 100) }}%</span>
        <button type="button" class="wb-zoom-btn" :title="t('winterboard.room.zoomIn')" @click="handleZoomIn">+</button>
        <button type="button" class="wb-zoom-btn" :title="t('winterboard.room.zoomReset')" @click="handleZoomReset">⊙</button>
      </div>
    </footer>

    <!-- Drag ghost preview — follows cursor while dragging from sidebar -->
    <WBDragGhost />
  </div>
</template>

<script setup lang="ts">
// WB: WBClassroomRoom — classroom whiteboard view with RBAC
// Ref: TASK_BOARD_PHASES.md A3.1, C3.1 RBAC, LAW-05, LAW-16
// Feature flag: VITE_WB_FEATURE_CLASSROOM

import { ref, computed, onMounted, onBeforeUnmount, onUnmounted, watch, nextTick, provide } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { useWBStore } from '../board/state/boardStore'
import { useTestStore } from '../board/state/testStore'
import { useHistory } from '../composables/useHistory'
import { useKeyboard } from '../composables/useKeyboard'
import { useBoardClipboard } from '../composables/useBoardClipboard'
import { useAutosave } from '../composables/useAutosave'
// Phase 2 (2026-04-27): useOpsBridge DELETED — was no-op stub (Phase ops-only 2026-04-15)
// Phase 2 SSOT INV-16/INV-20 UI gates (mutually exclusive by reason taxonomy)
import ProtocolMismatchModal from '../components/dialogs/ProtocolMismatchModal.vue'
import DesyncRecoveryBanner from '../components/dialogs/DesyncRecoveryBanner.vue'
import { usePresence } from '../composables/usePresence'
import { useFollowMode } from '../composables/useFollowMode'
import { useLocking } from '../composables/useLocking'
import { useAnnouncer } from '../composables/useAnnouncer'
import { useClassroomRole } from '../composables/useClassroomRole'
import { useClassroomSession } from '../composables/useClassroomSession'
import { winterboardApi } from '../api/winterboardApi'
import { useAuthStore } from '@/modules/auth/store/authStore'
import { registerAuthDeathCleanup } from '@/core/auth/onAuthDeath'
import type { WBStroke, WBAsset, WBToolType } from '../types/winterboard'
import { useToast } from '../composables/useToast'

// Components
import WBCanvas from '../components/canvas/WBCanvas.vue'
import WBToolbar from '../components/toolbar/WBToolbar.vue'
import WBRemoteCursors from '../components/cursors/WBRemoteCursors.vue'
import WBCanvasLoader from '../components/loading/WBCanvasLoader.vue'
import WBUploadIndicator from '../components/status/WBUploadIndicator.vue'
import WBGridButton from '../components/canvas/WBGridButton.vue'
import WBPageThumbnails from '../components/pages/WBPageThumbnails.vue'
import WBSelectionToolbar from '../components/canvas/WBSelectionToolbar.vue'
import WBYouTubeModal from '../components/toolbar/WBYouTubeModal.vue'
import WBClassroomRecordingControls from '../components/replay/WBClassroomRecordingControls.vue'
import WBRecordingRestartConfirmModal from '../components/replay/WBRecordingRestartConfirmModal.vue'
// PR1 (2026-05-03): post-record share prompt — port із WBSoloRoom для visibility toggle
import WBRecordingDonePrompt from '../components/replay/WBRecordingDonePrompt.vue'
import WBFinalizeBarrierModal from '../components/replay/WBFinalizeBarrierModal.vue'
import WBTestTeacherPanel from '../components/test/WBTestTeacherPanel.vue'
import WBTestStudentView from '../components/test/WBTestStudentView.vue'
import { useGridOverlay } from '../composables/useGridOverlay'
import { useReplayRecorder } from '../composables/useReplayRecorder'
import { useRecordingHeartbeat } from '../composables/useRecordingHeartbeat'
// Phase 2 G-fix (2026-04-28): opsSyncStore bootstrap wiring (single write path)
import { useOpsSyncStore } from '../stores/opsSyncStore'
import { useDeviceMode } from '../composables/useDeviceMode'

// Learning Content integration
import ContentPanel from '@/modules/learning-content/components/ContentPanel.vue'
import GroupContentSidebar from '../components/sidebar/GroupContentSidebar.vue'
import type { AllowedContentItem } from '../types/sidebar'
import { addYouTubeAsset } from '../api/library'
import WBDragGhost from '../components/sidebar/WBDragGhost.vue'
import { useContentDrop } from '../composables/useContentDrop'
import { ADD_TOOL_AT_CLIENT_KEY } from '../composables/useTouchDragFromTray'
import type { ContentDragPayload } from '@/modules/learning-content'

// Lesson Domain integration (Agent B → Agent C)
import LessonHomeworkPanel from '@/modules/lessons/components/LessonHomeworkPanel.vue'
import { lessonsTemplateApi } from '@/modules/lessons/api/lessonsTemplateApi'
import type { LessonHomework, LessonStatus } from '@/modules/lessons/types/lessonTypes'
import lessonsApi from '@/api/lessons'
import { useLessonRuntimeStore } from '@/modules/learning-content/stores/useLessonRuntimeStore'

// ─── Props ──────────────────────────────────────────────────────────────────

const props = defineProps<{
  lessonId: string
  sessionId?: string
}>()

// ─── Store & Composables ────────────────────────────────────────────────────

const router = useRouter()
const route = useRoute()
const store = useWBStore()
const testStore = useTestStore()
const { t } = useI18n()
const { announce } = useAnnouncer()
const { showToast } = useToast()

const history = useHistory({ maxSize: 100 })
const locking = useLocking(store)
const deviceModeState = useDeviceMode()

const resolvedSessionId = ref<string | null>(props.sessionId ?? null)
/** group_id з lesson — для GroupContentSidebar у classroom */
const classroomGroupId = ref<string | null>(null)

// ─── Lesson Domain state (C1.1 homework + C1.2 status) ─────────────────────
const homeworkItems = ref<LessonHomework[]>([])
const homeworkLoading = ref(false)
const lessonStatus = ref<LessonStatus | null>(null)

async function fetchHomework(): Promise<void> {
  const id = props.lessonId
  if (!id) return
  homeworkLoading.value = true
  try {
    homeworkItems.value = await lessonsTemplateApi.getHomework(Number(id))
  } catch {
    // 404 очікуваний якщо feature flag lesson_templates вимкнений
    homeworkItems.value = []
  } finally {
    homeworkLoading.value = false
  }
}

async function fetchLessonStatus(): Promise<void> {
  const id = props.lessonId
  if (!id) return
  try {
    // Спробувати v1 endpoint (active lessons) для отримання статусу
    const res = await lessonsApi.getActiveLessons({ lesson_id: id })
    const lessons = (res as any)?.data?.results ?? (res as any)?.results ?? []
    const lesson = lessons.find((l: any) => String(l.id) === String(id))
    if (lesson) {
      lessonStatus.value = (lesson.status?.toUpperCase() as LessonStatus) ?? null
    } else {
      // Урок не в active — можливо завершений або ще не стартований
      lessonStatus.value = null
    }
  } catch (err) {
    // Не блокуємо роботу дошки через невдалий запит статусу
    lessonStatus.value = null
  }
}

// Phase 0: Student doesn't autosave in classroom (teacher is SSOT for state)
const isStudentInClassroom = computed(() => classroomRole.isStudent.value)

// Phase 4: ops-based persistence only (stream-save removed)
// onSaved callback removed (2026-05-13): session.state_update via WS is deprecated (INV-17).
// Cross-client sync handled by ops broadcast after each /replay/batch/ — no manual WS notify needed.
const autosave = useAutosave(resolvedSessionId, {
  disabled: isStudentInClassroom,
})

// Phase 4a: Bridge — DELETED у Phase 2 (was no-op stub since Phase ops-only 2026-04-15).
// Ops flow: boardStore → useReplayRecorder.record() → opsSyncStore → /replay/batch/.

// REPLAY-INV-2: always-on recording — активний коли store.mode === 'edit'
const isRecording = computed(() => store.mode === 'edit')
// Phase 2 G-fix (2026-04-28): opsSyncStore singleton — bootstrap()-ed у
// initBoardWithSession() після resolvedSessionId set. Без wire-up store stays у
// BOOTSTRAP mode → useReplayRecorder.record() returns false → ops silently dropped.
const opsSync = useOpsSyncStore()

const replayRecorder = useReplayRecorder({
  sessionId: resolvedSessionId,
  getBoardState: () => store.getSnapshotState(),
  enabled: isRecording,
})
// Phase 20: Auto-record all store operations — no manual record() calls needed.
// PR1 fix (2026-05-03 — blank-replay bug): connectToStore moved into onMounted
// AFTER opsSync.bootstrap() — port із WBSoloRoom.vue:899+2531. Без цього listener
// прикручений у setup, до bootstrap → opsSync.mode='BOOTSTRAP' → record() returns
// false (silent drop у opsSyncStore.ts:261) → ops що spilled у вікні bootstrap
// втрачаються → recording_start_state captures stale (empty) state →
// replay плеєр показує чисту дошку. Solo має explicit comment про цю інваріанту
// (line 897 + 2522).
let _unsubRecorder: (() => void) | null = null

// ─── Plan v3: Recording lifecycle через state machine ─────────────────────────
// Server-authoritative recording_state ∈ {idle, recording, paused, finalized}.
// FE syncs from BE responses + initBoardWithSession resume hydrate.
// Buttons emit start/pause/resume/finalize events via WBClassroomRecordingControls.
import type { RecordingState as ApiRecordingState } from '../api/replay'
const recordingState = ref<ApiRecordingState>('idle')
const recordingStartedAt = ref<string | null>(null)
const isRecordingLoading = ref(false)
// Computed: heartbeat ticks while session is recording OR paused (BE expects
// liveness for both states — paused user може resume at any time).
const isSessionActive = computed(
  () => recordingState.value === 'recording' || recordingState.value === 'paused',
)

// Share Layer v1: post-finalize prompt (replay sharing).
const activeReplayId = ref<string | null>(null)
const showRecordingDonePrompt = ref(false)
let _recordingDoneTimer: number | null = null

// На auth death — reset UI state.
const _unregisterRecordingAuthDeath = registerAuthDeathCleanup(() => {
  recordingState.value = 'idle'
  recordingStartedAt.value = null
})

// Phase 2A-3: heartbeat ticker. Plan v2.3: ticks while session active (recording
// OR paused) — BE auto_finalize timeout still fires if user closes tab.
useRecordingHeartbeat({
  sessionId: resolvedSessionId,
  isRecording: isSessionActive,
})

async function handleStartRecording(): Promise<void> {
  const sid = resolvedSessionId.value
  if (!sid || isRecordingLoading.value || recordingState.value === 'recording') return
  isRecordingLoading.value = true
  try {
    // Def 5 (2026-05-13): ensure serverSeq is fresh before /start-recording/.
    // If opsSync is in DESYNC/BOOTSTRAP (e.g. bootstrap failed at mount, or 409
    // during session pushed to DESYNC before Def 1 auto-resync landed), the next
    // flush() after start-recording would use stale seq → 409 → loop.
    // resync() = GET /state/ → correct serverSeq → mode SYNC.
    // Drops pendingOps (absorbed into start-recording snapshot) — acceptable.
    if (opsSync.mode !== 'SYNC') {
      try {
        await opsSync.resync(sid)
        console.info('[WBClassroomRoom] resynced before start-recording (mode was:', opsSync.mode, ')')
      } catch (e) {
        console.warn('[WBClassroomRoom] resync before start-recording failed (continuing):', e)
      }
    }
    try {
      await opsSync.flush()
    } catch (e) {
      console.warn('[WBClassroomRoom] opsSync.flush before start-recording failed', e)
    }
    try {
      await autosave.saveNow()
    } catch (e) {
      console.warn('[WBClassroomRoom] saveNow before start-recording failed', e)
    }
    const result = await import('../api/replay').then(m => m.startRecording(sid))
    recordingState.value = result.recording_state
    if (result.recording_started_at) {
      recordingStartedAt.value = result.recording_started_at
    }
    // Re-record: скинути стан попереднього запису (BE архівував його у start_recording)
    activeReplayId.value = null
    showRecordingDonePrompt.value = false
    if (_recordingDoneTimer) { clearTimeout(_recordingDoneTimer); _recordingDoneTimer = null }
    console.info('[WBClassroomRoom] start-recording', { status: result.status, state: result.recording_state, sid })
  } catch (e) {
    console.error('[WBClassroomRoom] Failed to start recording:', e)
  } finally {
    isRecordingLoading.value = false
  }
}

async function handleResumeRecording(): Promise<void> {
  const sid = resolvedSessionId.value
  if (!sid || isRecordingLoading.value || recordingState.value !== 'paused') return
  isRecordingLoading.value = true
  try {
    await opsSync.flush().catch((e: unknown) => console.warn('[WBClassroomRoom] flush before resume failed', e))
    const result = await import('../api/replay').then(m => m.resumeRecording(sid))
    recordingState.value = result.recording_state
    console.info('[WBClassroomRoom] resume-recording', { state: result.recording_state, sid })
  } catch (e) {
    console.error('[WBClassroomRoom] Failed to resume recording:', e)
  } finally {
    isRecordingLoading.value = false
  }
}

async function handlePauseRecording(): Promise<void> {
  const sid = resolvedSessionId.value
  if (!sid || isRecordingLoading.value || recordingState.value !== 'recording') return
  isRecordingLoading.value = true
  try {
    try {
      await opsSync.flush()
    } catch (e) {
      console.warn('[WBClassroomRoom] opsSync.flush before pause failed', e)
    }
    const result = await import('../api/replay').then(m => m.pauseRecording(sid))
    recordingState.value = result.recording_state  // expect 'paused'
    console.info('[WBClassroomRoom] pause-recording', { state: result.recording_state, sid })
  } catch (e) {
    console.error('[WBClassroomRoom] Failed to pause recording:', e)
  } finally {
    isRecordingLoading.value = false
  }
}

// ── Restart (finalized → новий cycle) — потребує user confirmation ──
// Backend сам архівує попередній active Replay у start_recording логіці —
// тому restart = handleStartRecording() з confirmation modal перед викликом.
const showRestartConfirmModal = ref(false)
const isRestartingRecording = ref(false)

function handleRestartRecordingRequest(): void {
  if (isRecordingLoading.value || isRestartingRecording.value) return
  showRestartConfirmModal.value = true
}

async function confirmRestartRecording(): Promise<void> {
  if (isRestartingRecording.value) return
  isRestartingRecording.value = true
  try {
    await handleStartRecording()
    showRestartConfirmModal.value = false
  } finally {
    isRestartingRecording.value = false
  }
}

// ── INV-22 PR-1b: barrier modal state for Classroom finalize flow ──
type BarrierModalState = 'closed' | 'waiting' | 'timeout' | 'contention'
const finalizeBarrierState = ref<BarrierModalState>('closed')
const finalizeBarrierExpectedSeq = ref<number | null>(null)
const finalizeBarrierCurrentSeq = ref<number | null>(null)
const finalizeBarrierRetryAfterMs = ref<number>(0)

// FE-local single-flight guard (mirror of Solo). Prevents double-click race
// before reactive disable kicks у. 429 from BE = defense-in-depth, not normal.
const _finalizeAttemptInFlight = ref(false)
// Mount-state guard prevents stale state mutation after route change /
// room leave. Reset у onBeforeUnmount.
const _isFinalizeMounted = ref(true)

onBeforeUnmount(() => {
  // INV-22 §22.7 — modal lifecycle cleanup on Classroom unmount.
  _isFinalizeMounted.value = false
  finalizeBarrierState.value = 'closed'
  finalizeBarrierExpectedSeq.value = null
  finalizeBarrierCurrentSeq.value = null
  finalizeBarrierRetryAfterMs.value = 0
  _finalizeAttemptInFlight.value = false
})

async function handleFinalizeRecording(): Promise<void> {
  const sid = resolvedSessionId.value
  if (!sid || isRecordingLoading.value || (recordingState.value !== 'recording' && recordingState.value !== 'paused')) return
  // FE-local single-flight: BEFORE network. 429 from BE remains defense-in-depth.
  if (_finalizeAttemptInFlight.value) return
  isRecordingLoading.value = true
  finalizeBarrierState.value = 'waiting'
  await _attemptFinalizeWithBarrier(sid)
}

/**
 * INV-22 PR-1b — single finalize attempt with barrier confirmation.
 * Mirror of WBSoloRoom._attemptFinalizeWithBarrier — Solo/Classroom parity
 * per FIRST_FIX_SPRINT_PROPOSAL §1.
 *
 * NO auto retry (LAW §12, INV-22 §22.7). NO DESYNC trigger on 429/504.
 * Replaces previous silent `try/catch` swallow of flush errors (per
 * BACKLOG_REPLAY_FINALIZE_FLUSH_RACE.md root cause).
 */
async function _attemptFinalizeWithBarrier(sid: string): Promise<void> {
  if (_finalizeAttemptInFlight.value) return
  _finalizeAttemptInFlight.value = true
  try {
    // Pre-flush: BACKLOG_REPLAY_FINALIZE_FLUSH_RACE explicitly forbids the
    // legacy `try/catch (e) { console.warn() }` swallow here. If flush fails,
    // we surface via fallback path so user knows last actions may not be saved.
    //
    // 2026-05-08 hotfix: MUST use `flushAll()` (drains ALL batches), NOT
    // `flush()` (which processes only first FLUSH_BATCH_SIZE=50 ops).
    // See WBSoloRoom.vue same change для full bug history.
    try {
      await opsSync.flushAll()
    } catch (flushErr) {
      if (!_isFinalizeMounted.value) return
      finalizeBarrierState.value = 'closed'
      _handleFinalizeFailureFallback(sid, flushErr)
      isRecordingLoading.value = false
      return
    }

    if (!_isFinalizeMounted.value) return
    const flushed_last_seq = opsSync.serverSeq
    const replayApi = await import('../api/replay')
    if (!_isFinalizeMounted.value) return
    try {
      const result = await replayApi.finalizeWithBarrier(sid, flushed_last_seq)
      if (!_isFinalizeMounted.value) return
      finalizeBarrierState.value = 'closed'
      recordingState.value = result.recording_state  // expect 'finalized'
      recordingStartedAt.value = null
      activeReplayId.value = result.replay_id

      if (activeReplayId.value) {
        showRecordingDonePrompt.value = true
        if (_recordingDoneTimer) clearTimeout(_recordingDoneTimer)
        _recordingDoneTimer = window.setTimeout(() => { showRecordingDonePrompt.value = false }, 45000)
      }
      console.info('[WBClassroomRoom] finalize-recording', {
        state: result.recording_state, replay_id: result.replay_id, sid,
      })
    } catch (err: unknown) {
      if (!_isFinalizeMounted.value) return
      if (err instanceof replayApi.FinalizeBarrierTimeoutError) {
        finalizeBarrierExpectedSeq.value = err.expected_seq
        finalizeBarrierCurrentSeq.value = err.current_seq
        finalizeBarrierRetryAfterMs.value = 0
        finalizeBarrierState.value = 'timeout'
        return
      }
      if (err instanceof replayApi.FinalizeBarrierContentionError) {
        finalizeBarrierExpectedSeq.value = null
        finalizeBarrierCurrentSeq.value = null
        finalizeBarrierRetryAfterMs.value = err.retry_after_ms
        finalizeBarrierState.value = 'contention'
        return
      }
      if (err instanceof replayApi.FinalizeBarrierNetworkError) {
        // 2026-05-09 parity з WBSoloRoom: CORS-shadowed 504 / network glitch
        // → reuse timeout modal (retry button). Apply pipeline catches up по
        // time of user click. НЕ "Запис не працює" banner.
        console.warn('[WBClassroomRoom] finalize network error (CORS-shadowed?):', err.causeMessage)
        finalizeBarrierExpectedSeq.value = null
        finalizeBarrierCurrentSeq.value = null
        finalizeBarrierRetryAfterMs.value = 0
        finalizeBarrierState.value = 'timeout'
        return
      }
      if (err instanceof replayApi.FinalizeBarrierContractError) {
        console.error('[WBClassroomRoom] FINALIZE_CONTRACT_ERROR:', err)
      }
      finalizeBarrierState.value = 'closed'
      _handleFinalizeFailureFallback(sid, err)
    } finally {
      if (_isFinalizeMounted.value && finalizeBarrierState.value === 'closed') {
        isRecordingLoading.value = false
      }
    }
  } finally {
    _finalizeAttemptInFlight.value = false
  }
}

function onFinalizeBarrierRetry(): void {
  const sid = resolvedSessionId.value
  if (!sid) return
  // FE-local single-flight guard у retry path (double-click protection).
  if (_finalizeAttemptInFlight.value) return
  finalizeBarrierState.value = 'waiting'
  void _attemptFinalizeWithBarrier(sid)
}

function _handleFinalizeFailureFallback(sid: string, e: unknown): void {
  console.error('[WBClassroomRoom] Failed to finalize recording:', e)
  recordingStartedAt.value = null
  import('@/utils/telemetryAgent').then(
    m => m.trackEvent('recording.finalize.failed', { sessionId: sid, error: String(e) }),
  ).catch(() => {})
  try {
    localStorage.setItem(`wb:recording:${sid}:finalize_failed`, String(Date.now()))
  } catch { /* localStorage blocked */ }
}

// Grid overlay (background grid for the canvas)
const gridOverlay = useGridOverlay(resolvedSessionId.value ?? 'default')

const classroomRole = useClassroomRole(resolvedSessionId)
const classroomSession = useClassroomSession()

// Learning Content drop handler
const contentDrop = useContentDrop({
  sessionId: resolvedSessionId,
  canDraw: classroomRole.canDraw,
  onAssetAdd: (asset) => {
    store.addAsset(asset, store.currentPageId)
    const page = store.currentPage
    if (page) {
      try { history.recordAdd(page.id, asset, 'asset') } catch (err) {
        console.warn('[WB:Classroom] history.recordAdd (content-drop asset) failed:', err)
      }
    }
  },
  screenToCanvas: (x, y) => {
    // Matches WBCanvas.vue handleDrop logic (lines 1598-1606):
    // canvasX = (clientX - rect.left) / zoom
    const rect = canvasContainerRef.value?.getBoundingClientRect()
    if (rect) {
      return {
        x: (x - rect.left) / (store.zoom || 1),
        y: (y - rect.top) / (store.zoom || 1),
      }
    }
    return { x: (store.pageWidth ?? 800) / 2, y: 100 }
  },
})

// ── Quick place: sidebar item click → place at canvas center ──
async function handleSidebarPlace(item: AllowedContentItem) {
  await contentDrop.handleSidebarDrop(
    {
      content_item_id: item.content_item_id as number,
      asset_category: item.asset_category,
      content_type: item.content_type,
    },
    {
      x: (store.pageWidth ?? 800) / 2,
      y: (store.pageHeight ?? 600) / 2,
    },
  )
}

// ── Tray touch drag: place tool at touch release position ──
provide(ADD_TOOL_AT_CLIENT_KEY, (mime: string, payloadStr: string, clientX: number, clientY: number) => {
  const rect = canvasContainerRef.value?.getBoundingClientRect()
  if (!rect) return
  const zoom = store.zoom || 1
  contentDrop.addAtPosition(mime, payloadStr, {
    x: (clientX - rect.left) / zoom,
    y: (clientY - rect.top) / zoom,
  })
})

const authStore = useAuthStore()
const lessonRuntime = useLessonRuntimeStore()

const presence = usePresence({
  sessionId: resolvedSessionId,
  userId: String(authStore.user?.id ?? ''),
  displayName: authStore.user?.first_name || authStore.user?.email || 'Anonymous',
  color: '#2563eb',
  token: authStore.access && authStore.access !== '__cookie__' ? authStore.access : undefined,
})

const followMode = useFollowMode({
  remoteCursors: presence.remoteCursors,
  zoom: computed(() => store.zoom),
  scrollX: computed(() => store.scrollX),
  scrollY: computed(() => store.scrollY),
  currentPageIndex: computed(() => store.currentPageIndex),
  pageIds: computed(() => store.pages.map((p) => p.id)),
  setZoom: (z: number) => store.setZoom(z),
  setScroll: (x: number, y: number) => {
    store.setScroll(x, y)
    if (canvasContainerRef.value) {
      canvasContainerRef.value.scrollLeft = x
      canvasContainerRef.value.scrollTop = y
    }
  },
  goToPage: (index: number) => store.goToPage(index),
})

// Viewport sync for presence
watch(
  () => [store.scrollX, store.scrollY, store.zoom, store.currentPageIndex],
  () => {
    if (!resolvedSessionId.value) return
    const pageId = store.currentPage?.id ?? ''
    presence.sendViewport(store.scrollX, store.scrollY, store.zoom, pageId)
  },
)

// ─── Object limit UX (2026-05-13) ───────────────────────────────────────────

// Показуємо blocking toast при кожному хіті ліміту (600 об'єктів).
// objectLimitHitAt — timestamp: кожен новий хіт = нове значення → watch спрацьовує.
watch(
  () => store.objectLimitHitAt,
  (hitAt) => {
    if (!hitAt) return
    showToast(t('wb.objectLimitReached', { limit: 600 }), 'error', { duration: 4000 })
  },
)

// Показуємо одноразовий warning коли дошка заповнена на 80% (480 об'єктів).
// immediate: false — не тригерити при mount якщо вже >= 480 (replay/hydrate).
let nearLimitWarningShown = false
watch(
  () => store.isNearObjectLimit,
  (isNear) => {
    if (!isNear || nearLimitWarningShown) return
    nearLimitWarningShown = true
    showToast(t('wb.objectLimitNear', { pct: 80, limit: 600 }), 'warning', { duration: 6000 })
  },
  { immediate: false },
)

// ─── Refs ───────────────────────────────────────────────────────────────────

const canvasRef = ref<InstanceType<typeof WBCanvas> | null>(null)
const canvasContainerRef = ref<HTMLElement | null>(null)
const sessionName = ref('Untitled')
const selectedId = ref<string | null>(null)
const isLoading = ref(true)
const showYouTubeModal = ref(false)

// ─── Computed ───────────────────────────────────────────────────────────────

const isLocked = computed(() => classroomSession.isLocked.value)

const isDrawingDisabled = computed(() => {
  // Locked by teacher → students can't draw
  if (isLocked.value && !classroomRole.isTeacher.value) return true
  // No draw permission (viewer)
  if (!classroomRole.canDraw.value) return true
  return false
})

const effectiveTool = computed<WBToolType>(() => {
  if (isDrawingDisabled.value) return 'select'
  return store.currentTool
})

const connectedStudents = computed(() =>
  classroomSession.connectedUsers.value.filter((u) => u.role !== 'owner'),
)

const lessonIdNum = computed(() => {
  const id = props.lessonId
  if (!id) return null
  const num = Number(id)
  return Number.isNaN(num) ? null : num
})

// P2: Check if any selected item is locked (for selection toolbar)
const hasLockedInSelection = computed(() => {
  return store.selectedIds.some((id) => store.isItemLocked(id))
})

// PR2 (2026-05-04 — Solo→Classroom toolbar parity, Group A) ────────────────────
// Port із WBSoloRoom.vue:1424-1429 — для :can-clear-page WBToolbar binding.
const isCanvasEmpty = computed(() => {
  const page = store.currentPage
  if (!page) return true
  return page.strokes.length === 0 && page.assets.length === 0
})

// Text formatting: selected object for toolbar (single selection only)
const selectedObjectForToolbar = computed(() => {
  if (store.selectedIds.length !== 1) return null
  return (store.getObjectById(store.selectedIds[0]) as import('../types/winterboard').WBStroke) ?? null
})

function handleTextFormat(updates: Record<string, unknown>) {
  if (store.selectedIds.length !== 1) return
  const id = store.selectedIds[0]
  store.updateObject(id, updates)
  // Re-assert selection after store update (canvas re-render may clear Transformer)
  nextTick(() => {
    if (!store.selectedIds.includes(id)) {
      store.selectedIds = [id]
    }
  })
}

function handleAudioUploaded(objectId: string, audioUrl: string, duration: number | null) {
  const obj = store.getObjectById(objectId)
  if (!obj) return
  const isAsset = 'w' in obj && 'h' in obj && 'type' in obj
  if (isAsset) {
    handleAssetUpdate({ ...(obj as WBAsset), audioUrl, audioDuration: duration ?? undefined })
  } else {
    handleStrokeUpdate({ ...(obj as WBStroke), audioUrl, audioDuration: duration ?? undefined })
  }
}

function handleAudioDeleted(objectId: string) {
  const obj = store.getObjectById(objectId)
  if (!obj) return
  const isAsset = 'w' in obj && 'h' in obj && 'type' in obj
  if (isAsset) {
    const { audioUrl: _a, audioDuration: _d, ...rest } = obj as WBAsset
    handleAssetUpdate({ ...rest, audioUrl: undefined, audioDuration: undefined } as WBAsset)
  } else {
    const { audioUrl: _a, audioDuration: _d, ...rest } = obj as WBStroke
    handleStrokeUpdate({ ...rest, audioUrl: undefined, audioDuration: undefined } as WBStroke)
  }
}

// Object link attachment — RBAC-guarded через classroomRole.canDraw.
// Sync через stroke_update/asset_update (mirror audio pattern, не окремий op).
function handleLinkSaved(objectId: string, url: string, title: string) {
  if (!classroomRole.canDraw.value) return
  const obj = store.getObjectById(objectId)
  if (!obj) return
  const linkTitle = title.trim() || undefined
  const isAsset = 'w' in obj && 'h' in obj && 'type' in obj
  if (isAsset) {
    handleAssetUpdate({ ...(obj as WBAsset), linkUrl: url, linkTitle })
  } else {
    handleStrokeUpdate({ ...(obj as WBStroke), linkUrl: url, linkTitle })
  }
}

function handleLinkRemoved(objectId: string) {
  if (!classroomRole.canDraw.value) return
  const obj = store.getObjectById(objectId)
  if (!obj) return
  const isAsset = 'w' in obj && 'h' in obj && 'type' in obj
  if (isAsset) {
    const { linkUrl: _u, linkTitle: _t, ...rest } = obj as WBAsset
    handleAssetUpdate({ ...rest, linkUrl: undefined, linkTitle: undefined } as WBAsset)
  } else {
    const { linkUrl: _u, linkTitle: _t, ...rest } = obj as WBStroke
    handleStrokeUpdate({ ...rest, linkUrl: undefined, linkTitle: undefined } as WBStroke)
  }
}

// P2: Bounding box of selected objects for WBSelectionToolbar positioning
const selectionBBox = computed(() => {
  if (store.selectedIds.length === 0) return null
  const page = store.currentPage
  if (!page) return null

  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity

  for (const id of store.selectedIds) {
    const asset = page.assets.find(a => a.id === id)
    if (asset) {
      minX = Math.min(minX, asset.x)
      minY = Math.min(minY, asset.y)
      maxX = Math.max(maxX, asset.x + asset.w)
      maxY = Math.max(maxY, asset.y + asset.h)
    }
    const stroke = page.strokes.find(s => s.id === id)
    if (stroke && stroke.points.length > 0) {
      for (const pt of stroke.points) {
        minX = Math.min(minX, pt.x)
        minY = Math.min(minY, pt.y)
        maxX = Math.max(maxX, pt.x)
        maxY = Math.max(maxY, pt.y)
      }
    }
  }

  if (!isFinite(minX)) return null
  return { x: minX, y: minY, w: maxX - minX, h: maxY - minY }
})

const roleBadgeText = computed(() => {
  const r = classroomRole.role.value
  if (r === 'owner' || r === 'host') return t('winterboard.classroom.roleTeacher')
  if (r === 'student') return t('winterboard.classroom.roleStudent')
  return t('winterboard.classroom.roleViewer')
})

const saveStatusText = computed(() => {
  if (autosave.isSaving.value) return t('winterboard.room.saving')
  switch (autosave.status.value) {
    case 'saved': return t('winterboard.room.saved')
    case 'syncing': return t('winterboard.room.saving')
    case 'error': return autosave.lastError.value ?? t('winterboard.room.saveError')
    case 'offline': return t('winterboard.room.offline')
    default: return store.isDirty ? t('winterboard.room.unsavedChanges') : t('winterboard.room.ready')
  }
})

// ─── Board clipboard (unified paste/copy/cut handler) ────────────────────────

const boardClipboard = useBoardClipboard({
  store,
  sessionId: () => resolvedSessionId.value,
  canvasCenter: () => ({
    x: (store.pageWidth ?? 800) / 2,
    y: (store.pageHeight ?? 600) / 2,
  }),
  onAssetAdd: (asset: WBAsset) => {
    store.addAsset(asset, store.currentPageId)
  },
  // Teacher can always paste materials even when drawing is locked for students
  disabled: () => !classroomRole.canDraw.value && !classroomRole.isTeacher.value,
  // Phase 2: dual-write to lesson when content is uploaded
  onContentUploaded: (contentItemId: number) => {
    if (lessonRuntime.isActive) {
      lessonRuntime.addContent(contentItemId)
    }
  },
  // Phase 3: dual-write context
  lessonId: () => lessonIdNum.value,
  groupId: () => null, // Classroom doesn't have direct groupId — lesson.group is used by backend
})

// ─── Keyboard shortcuts ─────────────────────────────────────────────────────

useKeyboard({
  onToolChange: (tool: WBToolType) => {
    if (!isDrawingDisabled.value) store.setTool(tool)
  },
  onUndo: () => handleUndo(),
  onRedo: () => handleRedo(),
  onDelete: () => handleDeleteSelected(),
  onEscape: () => { selectedId.value = null },
  onPagePrev: () => handlePagePrev(),
  onPageNext: () => handlePageNext(),
  onPageFirst: () => handlePageSelect(0),
  onPageLast: () => handlePageSelect(store.pageCount - 1),
  onZoomReset: () => handleZoomReset(),
  onSelectAll: () => handleSelectAll(),
  onCopy: () => boardClipboard.copySelected(),
  onPaste: () => boardClipboard.pasteInternal(),
  onCut: () => boardClipboard.cutSelected(),
})

// ─── Select All (Ctrl+A) ────────────────────────────────────────────────────

function handleSelectAll() {
  const page = store.currentPage
  if (!page) return
  const allIds = [
    ...page.strokes.map(s => s.id),
    ...page.assets.map(a => a.id),
  ]
  store.selectedIds = allIds
  store.setTool('select' as WBToolType)
}

// ─── Handlers: Drawing ──────────────────────────────────────────────────────

function handleStrokeAdd(stroke: WBStroke): void {
  if (isDrawingDisabled.value) return
  store.addStroke(stroke)

  const page = store.currentPage
  if (page) {
    try { history.recordAdd(page.id, stroke, 'stroke') } catch (err) {
      console.warn('[WB:Classroom] history.recordAdd failed:', err)
    }
  }
}

function handleStrokeUpdate(stroke: WBStroke): void {
  if (isDrawingDisabled.value) return
  store.updateStroke(stroke)
}

function handleLaserBroadcast(data: { x: number; y: number; active: boolean; page_id?: string }): void {
  if (presence.isConnected.value) {
    try {
      console.info(`[WB:Sync] laser broadcast x=${data.x?.toFixed(0)} y=${data.y?.toFixed(0)} active=${data.active}`)
      presence.sendMessage({ type: 'laser_pointer', data })
    } catch (e) { /* silently ignore */ }
  }
}


function handleStrokeDelete(strokeId: string): void {
  if (isDrawingDisabled.value) return
  const page = store.currentPage
  const existing = page?.strokes.find((s) => s.id === strokeId)

  store.deleteStroke(strokeId)

  if (page && existing) {
    try { history.recordRemove(page.id, existing, 'stroke') } catch (err) {
      console.warn('[WB:Classroom] history.recordRemove failed:', err)
    }
  }
}

function handleAssetAdd(asset: WBAsset): void {
  if (isDrawingDisabled.value) return
  store.addAsset(asset, store.currentPageId)

  const page = store.currentPage
  if (page) {
    try { history.recordAdd(page.id, asset, 'asset') } catch (err) {
      console.warn('[WB:Classroom] history.recordAdd (asset) failed:', err)
    }
  }
}

function handleAssetUpdate(asset: WBAsset): void {
  if (isDrawingDisabled.value) return
  store.updateAsset(asset)
}

// ─── PR2 (2026-05-04): Toolbar handlers parity з Solo (Group A) ──────────────
// Усі handlers RBAC-guarded через classroomRole permissions — student бачить
// toolbar (бо canvas read-only viewing), але дії заблоковані.

function handleLockSelected(): void {
  // canLock = teacher only (per useClassroomRole.ts:78)
  if (!classroomRole.canLock.value) return
  locking.lockSelected()
}

function handleUnlockSelected(): void {
  if (!classroomRole.canLock.value) return
  locking.unlockSelected()
}

function handleClearPageRequest(): void {
  // canClear = teacher only. handleClear() сам визначає що робити.
  if (!classroomRole.canClear.value) return
  handleClear()
}

function handleAssetDelete(assetId: string): void {
  if (isDrawingDisabled.value) return
  const page = store.currentPage
  const existing = page?.assets.find((a) => a.id === assetId)

  store.deleteAsset(assetId)

  if (page && existing) {
    try { history.recordRemove(page.id, existing, 'asset') } catch (err) {
      console.warn('[WB:Classroom] history.recordRemove (asset) failed:', err)
    }
  }
}

function handleSelect(id: string | null): void {
  selectedId.value = id
}

// PLAN_v4: Presentation expand (fullscreen mode for presentation document_viewer)
function handlePresentationExpand(asset: WBAsset): void {
  console.info('[WB:Classroom] Presentation expand requested:', asset.id, asset.content_ref)
  // TODO(PLAN_v4): Implement fullscreen presentation overlay (backlog)
}

function handleCursorMove(payload: { x: number; y: number; tool: WBToolType; color: string }): void {
  const pageId = store.currentPage?.id ?? ''
  presence.sendCursor(payload.x, payload.y, pageId, payload.tool, payload.color)
}

function handleDeleteSelected(): void {
  if (!selectedId.value || isDrawingDisabled.value) return
  const page = store.currentPage
  if (!page) return
  const isStroke = page.strokes.some((s) => s.id === selectedId.value)
  if (isStroke) store.deleteStroke(selectedId.value)
  else store.deleteAsset(selectedId.value)
  selectedId.value = null
}

// Клон виділених об'єктів на іншу сторінку (див. WBSoloRoom.handleSendToPage).
function handleSendToPage(pageIndex: number): void {
  if (isDrawingDisabled.value) return
  if (pageIndex === store.currentPageIndex) return
  const target = store.pages[pageIndex]
  if (!target) return
  const page = store.currentPage
  if (!page) return
  const selected = new Set(store.selectedIds)
  if (selected.size === 0) return

  const rnd = () => Math.random().toString(36).slice(2, 7)
  const now = Date.now()

  const newStrokes = page.strokes
    .filter((s) => selected.has(s.id))
    .map((s) => ({
      ...(JSON.parse(JSON.stringify(s))),
      id: `stroke-${now}-${rnd()}`,
    }))

  const newAssets = page.assets
    .filter((a) => selected.has(a.id))
    .map((a) => ({
      ...(JSON.parse(JSON.stringify(a))),
      id: `${a.type}-${now}-${rnd()}`,
    }))

  if (newStrokes.length > 0) store.addStrokesBatchToPage(pageIndex, newStrokes)
  if (newAssets.length > 0) store.addAssetsBatchToPage(pageIndex, newAssets)
}

// ─── P3: YouTube insert handler ─────────────────────────────────────────────

function handleYouTubeSubmit(payload: { url: string; title?: string }): void {
  showYouTubeModal.value = false
  if (isDrawingDisabled.value) return
  const page = store.currentPage
  if (!page) return
  const id = crypto.randomUUID()
  const asset = {
    id,
    type: 'youtube_player' as const,
    src: '',
    youtubeUrl: payload.url,
    x: (page.width ?? 1920) / 2 - 320,
    y: (page.height ?? 1080) / 2 - 180,
    w: 640,
    h: 360,
    title: payload.title,
    locked: false,
    zIndex: page.assets.length,
  }
  store.addAsset(asset as any, page.id ?? '')
}

// ─── Phase 11 FIX-1: YouTube sidebar add handler ────────────────────────────

async function handleYouTubeAdd(url: string): Promise<void> {
  try {
    await addYouTubeAsset(url)
  } catch (e) {
    console.warn('[WBClassroomRoom] YouTube add failed:', e)
  }
}

// ─── Handlers: Tool / Color / Size ──────────────────────────────────────────

function handleToolChange(tool: WBToolType): void {
  if (isDrawingDisabled.value) return
  store.setTool(tool)
  announce(t('winterboard.a11y.toolSelected', { tool: t(`winterboard.tools.${tool}`) }))
}

function handleColorChange(color: string): void {
  store.setColor(color)
}

function handleSizeChange(size: number): void {
  store.setSize(size)
}

// ─── Handlers: Undo / Redo / Clear ──────────────────────────────────────────

function handleUndo(): void {
  if (!classroomRole.canDraw.value) return
  store.undo()
  announce(t('winterboard.a11y.undoAction', { action: t('winterboard.a11y.strokeRemoved') }))
}

function handleRedo(): void {
  if (!classroomRole.canDraw.value) return
  store.redo()
  announce(t('winterboard.a11y.redoAction', { action: t('winterboard.a11y.strokeRestored') }))
}

function handleClear(): void {
  if (!classroomRole.canClear.value) return
  store.clearPage()
}

// ─── Handlers: Pages ────────────────────────────────────────────────────────

function handlePagePrev(): void {
  if (store.currentPageIndex > 0) {
    store.goToPage(store.currentPageIndex - 1)
  }
}

function handlePageNext(): void {
  if (store.currentPageIndex < store.pageCount - 1) {
    store.goToPage(store.currentPageIndex + 1)
  }
}

function handlePageSelect(index: number): void {
  if (index === store.currentPageIndex) return
  // Student soft-follow: локальна навігація без broadcast page_navigate op.
  // Tutor — broadcast (учні з активним follow синхронізуються).
  // Інваріант: student page change НЕ впливає на teacher і на інших students.
  if (classroomRole.isTeacher.value) {
    store.goToPage(index)
  } else {
    store.goToPageSilent(index)
  }
}

function handlePageAdd(): void {
  if (!classroomRole.canAddPage.value) return
  store.addPage()
}

function handlePageDelete(index: number): void {
  // Defensive guard: button hidden у read-only mode, але це захист
  // від programmatic виклику (console, automation, race).
  if (!classroomRole.canDeletePage.value) return
  if (!store.pages[index]) return
  store.deletePageUndoable(index)
}

// ─── Handlers: Zoom ─────────────────────────────────────────────────────────

function handleZoomIn(): void {
  store.setZoom(store.zoom + 0.25)
  followMode.onUserInteraction()
}

function handleZoomOut(): void {
  store.setZoom(store.zoom - 0.25)
  followMode.onUserInteraction()
}

function handleZoomReset(): void {
  store.setZoom(1)
  followMode.onUserInteraction()
}

function handleZoomChange(zoom: number): void {
  store.setZoom(zoom)
  followMode.onUserInteraction()
}

function handleScrollChange(scrollX: number, scrollY: number): void {
  store.setScroll(scrollX, scrollY)
  followMode.onUserInteraction()
}

// ─── Handlers: Header ───────────────────────────────────────────────────────

function handleTitleBlur(): void {
  if (!sessionName.value.trim()) {
    sessionName.value = t('winterboard.room.untitled')
  }
  store.workspaceName = sessionName.value
  store.markDirty()
}

function handleExit(): void {
  router.push('/winterboard/boards')
}

// ─── Handlers: Classroom controls ───────────────────────────────────────────

async function handleToggleLock(): Promise<void> {
  if (!classroomRole.canLock.value || !resolvedSessionId.value) return
  try {
    const result = await winterboardApi.lockSession(resolvedSessionId.value, !isLocked.value)
    classroomSession.setLocked(result.is_locked)
  } catch (err) {
    console.error('[WB:ClassroomRoom] Lock toggle failed', err)
  }
}

async function handleKickStudent(userId: string): Promise<void> {
  if (!classroomRole.canKick.value || !resolvedSessionId.value) return
  try {
    await winterboardApi.kickStudent(resolvedSessionId.value, userId)
    classroomSession.fetchConnectedUsers()
  } catch (err) {
    console.error('[WB:ClassroomRoom] Kick failed', err)
  }
}

// Content drag-and-drop handlers
function onContentDragStart(_payload: ContentDragPayload): void {
  // Drag data is already set in ContentItemCard via dataTransfer.
  // Future: show drop hint overlay on canvas.
}

async function handleEndSession(): Promise<void> {
  if (!classroomRole.canEnd.value || !resolvedSessionId.value) return
  // Simple confirmation
  if (!window.confirm(t('winterboard.classroom.endSessionConfirm'))) return
  try {
    const res = await winterboardApi.endSession(resolvedSessionId.value)
    // B1: endSession тепер також завершує Lesson (COMPLETED + snapshot)
    const data = (res as any)?.data ?? res
    if (data?.lesson_completed) {
      lessonStatus.value = 'COMPLETED' as LessonStatus
      lessonRuntime.$reset()
    }
    router.push('/winterboard/classroom-hub')
  } catch (err) {
    console.error('[WB:ClassroomRoom] End session failed', err)
  }
}

// ─── Handlers: Lesson lifecycle (Phase 2) ────────────────────────────────────

async function handleStartLesson(): Promise<void> {
  const ok = await lessonRuntime.startLesson()
  if (ok) {
    lessonStatus.value = 'IN_PROGRESS' as LessonStatus
    announce(t('winterboard.lesson.started'))
  }
}

async function handleCompleteLesson(): Promise<void> {
  const ok = await lessonRuntime.completeLesson()
  if (ok) {
    lessonStatus.value = 'COMPLETED' as LessonStatus
    announce(t('winterboard.lesson.completed'))
  }
}

// ─── Classroom sync: refetch state when other participant saves ──────────
let remoteUpdateThrottled = false
function onRemoteStateUpdate(e: Event) {
  const detail = (e as CustomEvent).detail
  if (remoteUpdateThrottled || !resolvedSessionId.value) return

  // In classroom mode: DON'T full-refetch for students.
  // Strokes sync via WS stroke.broadcast in real-time.
  // Teacher is SSOT — full refetch would overwrite student's local strokes.
  if (classroomRole.isStudent.value) {
    // Student only updates rev to track server state version
    if (detail?.rev && detail.rev > store.rev) {
      store.rev = detail.rev
    }
    return
  }

  // Teacher: full refetch (to get student strokes that were saved)
  remoteUpdateThrottled = true
  setTimeout(() => { remoteUpdateThrottled = false }, 2000) // Throttle to max every 2s

  winterboardApi.getSession(resolvedSessionId.value).then((freshState) => {
    if (freshState.state && freshState.rev > store.rev) {
      store.hydrateFromSession({
        id: freshState.id,
        name: freshState.name,
        owner_id: freshState.owner_id ?? '',
        state: freshState.state,
        page_count: freshState.page_count,
        thumbnail_url: freshState.thumbnail_url,
        rev: freshState.rev,
        created_at: freshState.created_at,
        updated_at: freshState.updated_at,
      })
    }
  }).catch(() => { /* Ignore refetch errors */ })
}
window.addEventListener('wb:remote-state-update', onRemoteStateUpdate)

// ─── Phase 0: Stroke broadcast for classroom sync ───────────────────────

// Student: intercept addStroke → send via WS instead of local-only
// Teacher: receive remote strokes → apply to local store → autosave persists
let _unsubStrokeInterceptor: (() => void) | null = null

function setupStrokeBroadcast(): void {
  // Both teacher and student broadcast their strokes for real-time sync
  const origAddStroke = store.addStroke.bind(store)
  const origDeleteStroke = store.deleteStroke.bind(store)
  const origDeleteSelected = store.deleteSelected.bind(store)
  const origUndo = store.undo.bind(store)
  const origRedo = store.redo.bind(store)
  const origClearCurrentPage = store.clearCurrentPage.bind(store)
  const myRole = classroomRole.isTeacher.value ? 'teacher' : 'student'
  console.info(`[WB:Sync] setupStrokeBroadcast role=${myRole} wsConnected=${presence.isConnected.value}`)

  function wsBroadcast(msg: Record<string, unknown>) {
    if (!presence.isConnected.value) return
    try { presence.sendMessage(msg) } catch (e) { console.warn('[WB:Sync] broadcast failed', e) }
  }

  // ── addStroke ──
  store.addStroke = (stroke: any, opts?: any) => {
    origAddStroke(stroke, opts)
    if (opts?._remote) return
    wsBroadcast({
      type: 'stroke.broadcast',
      stroke,
      pageIndex: store.currentPageIndex ?? 0,
      action: 'stroke_add',
    })
  }

  // ── deleteStroke ──
  store.deleteStroke = (strokeId: string, opts?: any) => {
    origDeleteStroke(strokeId, opts)
    if (opts?._remote) return
    wsBroadcast({
      type: 'stroke.broadcast',
      strokeId,
      pageIndex: store.currentPageIndex ?? 0,
      action: 'stroke_delete',
    })
  }

  // ── clearCurrentPage ──
  store.clearCurrentPage = () => {
    origClearCurrentPage()
    wsBroadcast({
      type: 'stroke.broadcast',
      pageIndex: store.currentPageIndex ?? 0,
      action: 'page_clear',
    })
  }

  // ── deleteSelected (selection + Delete) ──
  store.deleteSelected = () => {
    // Capture selected stroke IDs before delete clears them
    const selectedIds = [...store.selectedIds]
    origDeleteSelected()
    const pageIndex = store.currentPageIndex ?? 0
    for (const id of selectedIds) {
      wsBroadcast({
        type: 'stroke.broadcast',
        strokeId: id,
        pageIndex,
        action: 'stroke_delete',
      })
    }
  }

  // ── updateStroke — monkey-patch (reliable for Options API stores) ──
  const origUpdateStroke = store.updateStroke.bind(store)
  store.updateStroke = (stroke: any, opts?: any) => {
    origUpdateStroke(stroke, opts)
    if (opts?._remote) return
    console.info(`[WB:Sync] updateStroke broadcast id=${stroke?.id?.slice?.(0, 8)}`)
    wsBroadcast({
      type: 'stroke.broadcast',
      stroke,
      pageIndex: store.currentPageIndex ?? 0,
      action: 'stroke_update',
    })
  }

  // ── moveSelectedUnlocked — monkey-patch + debounce ──
  let _moveBroadcastTimer: ReturnType<typeof setTimeout> | null = null
  const origMoveSelectedUnlocked = store.moveSelectedUnlocked.bind(store)
  store.moveSelectedUnlocked = (dx: number, dy: number) => {
    // Capture selectedIds BEFORE the move (they stay valid)
    const capturedIds = [...store.selectedIds]
    origMoveSelectedUnlocked(dx, dy)
    if (_moveBroadcastTimer) clearTimeout(_moveBroadcastTimer)
    _moveBroadcastTimer = setTimeout(() => {
      const page = store.currentPage
      if (!page || capturedIds.length === 0) return
      const ids = new Set(capturedIds)
      const movedStrokes = page.strokes.filter((s: any) => ids.has(s.id))
      console.info(`[WB:Sync] moveSelectedUnlocked broadcasting ${movedStrokes.length} strokes`)
      const pageIndex = store.currentPageIndex ?? 0
      for (const s of movedStrokes) {
        wsBroadcast({
          type: 'stroke.broadcast',
          stroke: s,
          pageIndex,
          action: 'stroke_update',
        })
      }
    }, 150)
  }

  // ── moveSelected (legacy) — same pattern ──
  const origMoveSelected = store.moveSelected.bind(store)
  store.moveSelected = (dx: number, dy: number) => {
    const capturedIds = [...store.selectedIds]
    origMoveSelected(dx, dy)
    if (_moveBroadcastTimer) clearTimeout(_moveBroadcastTimer)
    _moveBroadcastTimer = setTimeout(() => {
      const page = store.currentPage
      if (!page || capturedIds.length === 0) return
      const ids = new Set(capturedIds)
      const movedStrokes = page.strokes.filter((s: any) => ids.has(s.id))
      console.info(`[WB:Sync] moveSelected broadcasting ${movedStrokes.length} strokes`)
      const pageIndex = store.currentPageIndex ?? 0
      for (const s of movedStrokes) {
        wsBroadcast({
          type: 'stroke.broadcast',
          stroke: s,
          pageIndex,
          action: 'stroke_update',
        })
      }
    }, 150)
  }

  // ── Asset sync: addAsset ──
  // TASK 1 (2026-04-29): signature changed → addAsset(asset, pageId, opts).
  // Monkey-patch адаптується під new signature; remote ops завжди мають pageId.
  const origAddAsset = store.addAsset.bind(store)
  store.addAsset = (asset: any, pageId: string, opts?: any) => {
    origAddAsset(asset, pageId, opts)
    if (opts?._remote) return
    wsBroadcast({
      type: 'stroke.broadcast',
      stroke: asset,
      pageIndex: store.currentPageIndex ?? 0,
      action: 'asset_add',
    })
  }

  // ── Asset sync: updateAsset ──
  const origUpdateAsset = store.updateAsset.bind(store)
  store.updateAsset = (asset: any, opts?: any) => {
    origUpdateAsset(asset, opts)
    if (opts?._remote) return
    console.info(`[WB:Sync] updateAsset broadcast id=${asset?.id?.slice?.(0, 8)}`)
    wsBroadcast({
      type: 'stroke.broadcast',
      stroke: asset,
      pageIndex: store.currentPageIndex ?? 0,
      action: 'asset_update',
    })
  }

  // ── Asset sync: deleteAsset ──
  const origDeleteAsset = store.deleteAsset.bind(store)
  store.deleteAsset = (assetId: string, opts?: any) => {
    origDeleteAsset(assetId, opts)
    if (opts?._remote) return
    wsBroadcast({
      type: 'stroke.broadcast',
      strokeId: assetId,
      pageIndex: store.currentPageIndex ?? 0,
      action: 'asset_delete',
    })
  }

  // ── undo ── broadcast the net effect of undo
  store.undo = () => {
    const entry = store.undoStack[store.undoStack.length - 1]
    origUndo()
    if (!entry) return
    broadcastUndoRedoEffect(entry, 'undo')
  }

  // ── redo ── broadcast the net effect of redo
  store.redo = () => {
    const entry = store.redoStack[store.redoStack.length - 1]
    origRedo()
    if (!entry) return
    broadcastUndoRedoEffect(entry, 'redo')
  }

  function broadcastUndoRedoEffect(entry: any, direction: 'undo' | 'redo') {
    const pageIndex = entry.pageIndex ?? store.currentPageIndex ?? 0
    if (direction === 'undo') {
      switch (entry.type) {
        case 'addStroke':
          // Undo add → stroke removed
          wsBroadcast({ type: 'stroke.broadcast', strokeId: entry.stroke?.id, pageIndex, action: 'stroke_delete' })
          break
        case 'deleteStroke':
          // Undo delete → stroke restored
          wsBroadcast({ type: 'stroke.broadcast', stroke: entry.stroke, pageIndex, action: 'stroke_add' })
          break
        case 'clearPage':
        case 'clearCurrentPage':
          // Undo clear → many strokes restored; send each one
          for (const s of (entry.prevStrokes ?? entry.clearedStrokes ?? [])) {
            wsBroadcast({ type: 'stroke.broadcast', stroke: s, pageIndex, action: 'stroke_add' })
          }
          break
        case 'updateStroke':
          // Undo update → restore prev version
          if (entry.prev) wsBroadcast({ type: 'stroke.broadcast', stroke: entry.prev, pageIndex, action: 'stroke_update' })
          break
        case 'addAsset':
          wsBroadcast({ type: 'stroke.broadcast', strokeId: entry.asset?.id, pageIndex, action: 'asset_delete' })
          break
        case 'deleteAsset':
          wsBroadcast({ type: 'stroke.broadcast', stroke: entry.asset, pageIndex, action: 'asset_add' })
          break
        case 'updateAsset':
          if (entry.prev) wsBroadcast({ type: 'stroke.broadcast', stroke: entry.prev, pageIndex, action: 'asset_update' })
          break
      }
    } else {
      // redo = re-apply the original operation
      switch (entry.type) {
        case 'addStroke':
          wsBroadcast({ type: 'stroke.broadcast', stroke: entry.stroke, pageIndex, action: 'stroke_add' })
          break
        case 'deleteStroke':
          wsBroadcast({ type: 'stroke.broadcast', strokeId: entry.stroke?.id, pageIndex, action: 'stroke_delete' })
          break
        case 'clearPage':
        case 'clearCurrentPage':
          wsBroadcast({ type: 'stroke.broadcast', pageIndex, action: 'page_clear' })
          break
        case 'updateStroke':
          if (entry.next) wsBroadcast({ type: 'stroke.broadcast', stroke: entry.next, pageIndex, action: 'stroke_update' })
          break
        case 'addAsset':
          wsBroadcast({ type: 'stroke.broadcast', stroke: entry.asset, pageIndex, action: 'asset_add' })
          break
        case 'deleteAsset':
          wsBroadcast({ type: 'stroke.broadcast', strokeId: entry.asset?.id, pageIndex, action: 'asset_delete' })
          break
        case 'updateAsset':
          if (entry.next) wsBroadcast({ type: 'stroke.broadcast', stroke: entry.next, pageIndex, action: 'asset_update' })
          break
      }
    }
  }

  _unsubStrokeInterceptor = () => {
    store.addStroke = origAddStroke
    store.deleteStroke = origDeleteStroke
    store.deleteSelected = origDeleteSelected
    store.updateStroke = origUpdateStroke
    store.moveSelectedUnlocked = origMoveSelectedUnlocked
    store.moveSelected = origMoveSelected
    store.addAsset = origAddAsset
    store.updateAsset = origUpdateAsset
    store.deleteAsset = origDeleteAsset
    store.undo = origUndo
    store.redo = origRedo
    store.clearCurrentPage = origClearCurrentPage
    if (_moveBroadcastTimer) clearTimeout(_moveBroadcastTimer)
  }
}

// Teacher/Student: receive remote strokes from WS
// Dedup set to prevent processing same stroke multiple times (WS reconnect/re-delivery)
const _receivedStrokeIds = new Set<string>()
const RECEIVED_STROKE_CACHE_MAX = 500

function onRemoteStroke(e: Event) {
  const detail = (e as CustomEvent).detail
  if (!detail) return

  const action = detail.action ?? 'stroke_add'
  const targetPageIndex = detail.pageIndex ?? 0
  const page = store.pages[targetPageIndex]
  if (!page) return

  // ── page_clear: remove all unlocked strokes on the page ──
  if (action === 'page_clear') {
    console.info(`[WB:Sync] onRemoteStroke PAGE_CLEAR from=${detail.userId} page=${targetPageIndex}`)
    store.pages[targetPageIndex] = {
      ...page,
      strokes: page.strokes.filter((s: any) => s.locked),
      assets: page.assets.filter((a: any) => a.locked),
    }
    store.markDirty()
    return
  }

  // ── asset_add: add asset from remote ──
  if (action === 'asset_add' && detail.stroke) {
    const asset = detail.stroke
    const aid = asset.id
    if (aid && page.assets.some((a: any) => a.id === aid)) return // dedup
    console.info(`[WB:Sync] onRemoteStroke ASSET_ADD from=${detail.userId} assetId=${aid?.slice?.(0, 8)} page=${targetPageIndex}`)
    store.pages[targetPageIndex] = { ...page, assets: [...page.assets, asset] }
    store.markDirty()
    return
  }

  // ── asset_update: replace asset with new version ──
  if (action === 'asset_update' && detail.stroke) {
    const asset = detail.stroke
    const aid = asset.id
    console.info(`[WB:Sync] onRemoteStroke ASSET_UPDATE from=${detail.userId} assetId=${aid?.slice?.(0, 8)} page=${targetPageIndex}`)
    const idx = page.assets.findIndex((a: any) => a.id === aid)
    if (idx !== -1) {
      const assets = [...page.assets]
      assets[idx] = asset
      store.pages[targetPageIndex] = { ...page, assets }
      store.markDirty()
    }
    return
  }

  // ── asset_delete: remove asset by ID ──
  if (action === 'asset_delete') {
    const aid = detail.strokeId ?? detail.stroke?.id
    if (!aid) return
    console.info(`[WB:Sync] onRemoteStroke ASSET_DELETE from=${detail.userId} assetId=${aid?.slice?.(0, 8)} page=${targetPageIndex}`)
    const filtered = page.assets.filter((a: any) => a.id !== aid)
    if (filtered.length !== page.assets.length) {
      store.pages[targetPageIndex] = { ...page, assets: filtered }
      store.markDirty()
    }
    return
  }

  // ── stroke_delete: remove stroke by ID ──
  if (action === 'stroke_delete') {
    const sid = detail.strokeId ?? detail.stroke?.id
    if (!sid) return
    console.info(`[WB:Sync] onRemoteStroke DELETE from=${detail.userId} strokeId=${sid?.slice?.(0, 8)} page=${targetPageIndex}`)
    const filtered = page.strokes.filter((s: any) => s.id !== sid)
    if (filtered.length !== page.strokes.length) {
      store.pages[targetPageIndex] = { ...page, strokes: filtered }
      store.markDirty()
    }
    return
  }

  // ── stroke_update: replace stroke with new version ──
  if (action === 'stroke_update' && detail.stroke) {
    const sid = detail.stroke.id
    console.info(`[WB:Sync] onRemoteStroke UPDATE from=${detail.userId} strokeId=${sid?.slice?.(0, 8)} page=${targetPageIndex}`)
    const idx = page.strokes.findIndex((s: any) => s.id === sid)
    if (idx !== -1) {
      const strokes = [...page.strokes]
      strokes[idx] = detail.stroke
      store.pages[targetPageIndex] = { ...page, strokes }
      store.markDirty()
    }
    return
  }

  // ── stroke_add (default) ──
  if (!detail.stroke) return

  const strokeId = detail.stroke?.id
  if (strokeId && _receivedStrokeIds.has(strokeId)) return
  if (strokeId) {
    _receivedStrokeIds.add(strokeId)
    if (_receivedStrokeIds.size > RECEIVED_STROKE_CACHE_MAX) {
      const arr = [..._receivedStrokeIds]
      _receivedStrokeIds.clear()
      for (let i = arr.length - 400; i < arr.length; i++) {
        if (i >= 0) _receivedStrokeIds.add(arr[i])
      }
    }
  }

  // Check if stroke already exists on the page
  if (strokeId && page.strokes.some((s: any) => s.id === strokeId)) return

  console.info(`[WB:Sync] onRemoteStroke ADD from=${detail.userId} strokeId=${strokeId?.slice?.(0, 8)} page=${targetPageIndex}`)

  const currentPageIndex = store.currentPageIndex
  if (targetPageIndex === currentPageIndex) {
    store.addStroke(detail.stroke, { skipHistory: true } as any)
  } else {
    store.pages[targetPageIndex] = {
      ...page,
      strokes: [...page.strokes, detail.stroke],
    }
  }
  store.markDirty()
}

window.addEventListener('wb:remote-stroke', onRemoteStroke)

// ─── Phase 38: Test WS Handlers ─────────────────────────────────────────────

function onRemoteTestStart(e: Event) {
  const detail = (e as CustomEvent).detail
  testStore.onRemoteTestStart({
    testSessionId: detail.test_session_id,
    testObjects: detail.test_objects,
    testMeta: detail.test_meta,
    pageId: detail.page_id,
  })

  // RISK-3 FIX: Smart navigation - тільки якщо НЕ на test page
  const pageIndex = store.pages.findIndex((p) => p.id === detail.page_id)
  if (pageIndex !== -1 && pageIndex !== store.currentPageIndex) {
    console.info('[WB:test] Auto-navigating to test page', pageIndex)
    store.goToPage(pageIndex)
  }
}

function onRemoteTestAnswer(e: Event) {
  const detail = (e as CustomEvent).detail
  // Teacher receives student answers
  if (classroomRole.isTeacher.value) {
    testStore.onRemoteTestAnswer({
      studentId: detail.student_id,
      studentName: detail.student_name,
      objectId: detail.object_id,
      answer: detail.answer,
    })
  }
}

function onRemoteTestPhase(e: Event) {
  const detail = (e as CustomEvent).detail
  testStore.setTestPhase(detail.phase)
}

function onRemoteTestGrade(e: Event) {
  const detail = (e as CustomEvent).detail
  testStore.onRemoteTestGrade({
    results: detail.results,
  })
}

function onRemoteTestSync(e: Event) {
  const detail = (e as CustomEvent).detail
  testStore.onRemoteTestSync({
    testSessionId: detail.test_session_id,
    testObjects: detail.test_objects,
    testMeta: detail.test_meta,
    phase: detail.phase,
    pageId: detail.page_id,
    myAnswers: detail.my_answers,
    myResult: detail.my_result,
    allAnswers: detail.all_answers,
    allResults: detail.all_results,
  })

  // RISK-3 FIX: Smart navigation - тільки якщо НЕ на test page
  const pageIndex = store.pages.findIndex((p) => p.id === detail.page_id)
  if (pageIndex !== -1 && pageIndex !== store.currentPageIndex) {
    console.info('[WB:test] Auto-navigating to test page (sync)', pageIndex)
    store.goToPage(pageIndex)
  }
}

function onRemoteTestEnd(e: Event) {
  testStore.onRemoteTestEnd()
}

window.addEventListener('wb:test-start', onRemoteTestStart)
window.addEventListener('wb:test-answer', onRemoteTestAnswer)
window.addEventListener('wb:test-phase', onRemoteTestPhase)
window.addEventListener('wb:test-grade', onRemoteTestGrade)
window.addEventListener('wb:test-sync', onRemoteTestSync)
window.addEventListener('wb:test-end', onRemoteTestEnd)

onUnmounted(() => {
  window.removeEventListener('wb:remote-state-update', onRemoteStateUpdate)
  window.removeEventListener('wb:remote-stroke', onRemoteStroke)
  window.removeEventListener('wb:test-start', onRemoteTestStart)
  window.removeEventListener('wb:test-answer', onRemoteTestAnswer)
  window.removeEventListener('wb:test-phase', onRemoteTestPhase)
  window.removeEventListener('wb:test-grade', onRemoteTestGrade)
  window.removeEventListener('wb:test-sync', onRemoteTestSync)
  window.removeEventListener('wb:test-end', onRemoteTestEnd)
  _unsubStrokeInterceptor?.()
})

// ─── Lifecycle ──────────────────────────────────────────────────────────────

onMounted(async () => {
  const lessonId = props.lessonId

  // Init classroom session (fetch or create)
  const init = await classroomSession.initClassroomSession(lessonId)

  if (!init) {
    // No access or error
    if (classroomSession.state.value === 'no_access') {
      router.push('/winterboard/boards')
    }
    // B3: Waiting for teacher — show waiting UI, listen for session-ready
    if (classroomSession.state.value === 'waiting_for_teacher') {
      isLoading.value = false
      const onReady = async (e: Event) => {
        const detail = (e as CustomEvent).detail
        if (detail) {
          await initBoardWithSession(detail)
        }
      }
      window.addEventListener('wb:session-ready', onReady, { once: true })
      return
    }
    // Lesson completed — show info screen (no redirect, user reads the message first)
    if (classroomSession.state.value === 'lesson_completed') {
      isLoading.value = false
      return
    }
    isLoading.value = false
    return
  }

  await initBoardWithSession(init)
})

// ─── Phase 38: Test Action Handlers ────────────────────────────────────────

function handleTestGrade() {
  if (presence.connectionState.value !== 'connected') {
    console.warn('[WB:test] Cannot grade - not connected')
    return
  }

  testStore.requestGrade((msg) => {
    presence.sendMessage(msg as Record<string, unknown>)
  })
}

function handleTestEnd() {
  if (presence.connectionState.value !== 'connected') {
    console.warn('[WB:test] Cannot end test - not connected')
    return
  }

  testStore.endLiveTest((msg) => {
    presence.sendMessage(msg as Record<string, unknown>)
  })
}

// B3: Extracted init logic so waiting_for_teacher can call it when teacher starts
// Mount guard: ROOT-CAUSE protection проти repeated bootstrap. Якщо
// функцію викликають кілька разів (HMR, race у двох callerах onMounted+wb:session-ready,
// або re-render trigger) → re-fetch session, re-bootstrap opsSync, re-startUserPolling
// → 429 cascade на ВСІ endpoints. Single-shot = safety floor.
let _classroomInitialized = false

async function initBoardWithSession(init: { sessionId: string; role: any; permissions: any; isLocked: boolean; groupId?: string | null }): Promise<void> {
  if (_classroomInitialized) {
    console.warn('[WB:ClassroomRoom] initBoardWithSession called twice — guarded (root-cause fix vs 429 storm)')
    return
  }
  _classroomInitialized = true
  console.info('[WB:ClassroomRoom] initBoardWithSession START', { sessionId: init.sessionId, ts: Date.now() })

  // Set resolved session ID
  resolvedSessionId.value = init.sessionId
  store.workspaceId = init.sessionId
  // Зберігаємо group_id для sidebar матеріалів
  if (init.groupId) classroomGroupId.value = init.groupId

  // Phase 2 G-fix (2026-04-28): bootstrap opsSyncStore (single write path).
  // MUST be called BEFORE recorder.connectToStore + first record/flush. Sets
  // mode SYNC + serverSeq=last_seq від BE. Без цього store stays у BOOTSTRAP →
  // record() returns false → drawing produces 0 ops persisted.
  try {
    await opsSync.bootstrap(init.sessionId)
  } catch (bootErr) {
    console.error('[WB:ClassroomRoom] opsSync.bootstrap failed (non-fatal):', bootErr)
  }

  // PR1 fix (2026-05-03): Connect recorder to store AFTER bootstrap (port із
  // WBSoloRoom.vue:2531). Inside setup-block це ламало запис: ops що йшли через
  // _emitOperation під час 'BOOTSTRAP' mode → opsSync.record() returns false →
  // silent drop → recording_start_state captures empty state → blank replay.
  // Idempotent: cleanupRecorder() handles повторний виклик safely.
  if (!_unsubRecorder) {
    _unsubRecorder = replayRecorder.connectToStore(store)
  }

  // Set role + permissions
  classroomRole.setRole(init.role, init.permissions)

  // Load session state
  try {
    const detail = await winterboardApi.getSession(init.sessionId)
    if (detail.state) {
      store.hydrateFromSession({
        id: detail.id,
        name: detail.name,
        owner_id: detail.owner_id ?? '',
        state: detail.state,
        page_count: detail.page_count,
        thumbnail_url: detail.thumbnail_url,
        rev: detail.rev,
        created_at: detail.created_at,
        updated_at: detail.updated_at,
      })
    }
    sessionName.value = detail.name || t('winterboard.room.untitled')

    // ─── Plan v2.3 (2026-05-05): Resume recording per INV-REC-SESSION ────────
    // recording_state з BE — server-authoritative. FE syncs directly:
    //   - 'recording' → REC banner + Pause button + heartbeat ticks
    //   - 'paused' → PAUSED banner + Resume + Finalize buttons + heartbeat continues
    //   - 'idle' / 'finalized' → 2 start buttons
    // Без resume: nav back протягом 90s heartbeat window → button visibility
    // wrong, BE thinks active, FE thinks idle → state desync.
    const beRecordingState = detail.recording_state ?? 'idle'
    recordingState.value = beRecordingState
    if (beRecordingState === 'recording' || beRecordingState === 'paused') {
      recordingStartedAt.value = detail.recording_started_at ?? null
      announce(t('winterboard.recording.resumed'))
    } else {
      recordingStartedAt.value = null
    }
  } catch (err) {
    console.error('[WB:ClassroomRoom] Failed to load session state', err)
  }

  isLoading.value = false
  // Phase 1: replayRecorder.start() removed — controlled by isRecording ref via watch

  // Fetch lesson status + homework (C1.1 + C1.2)
  fetchLessonStatus()
  fetchHomework()

  // Phase 2: Initialize lesson runtime store
  if (lessonIdNum.value) {
    await lessonRuntime.init(lessonIdNum.value)
    if (lessonRuntime.lessonStatus) {
      lessonStatus.value = lessonRuntime.lessonStatus as LessonStatus
    }
  }

  // Connect presence (wait for auth bootstrap to get real JWT token)
  await authStore.bootstrap()
  presence.connect(init.sessionId)

  // Start polling connected users (teacher only)
  if (classroomRole.isTeacher.value) {
    classroomSession.startUserPolling()
  }

  // Students auto-follow teacher
  if (classroomRole.isStudent.value) {
    followMode.startFollowing()
  }

  // Phase 0: Setup stroke broadcast for classroom sync
  setupStrokeBroadcast()
}

onBeforeUnmount(async () => {
  // PR1 fix (2026-05-03): null-safe — initBoardWithSession може не дочекатися
  // bootstrap (race на early unmount).
  _unsubRecorder?.()
  _unsubRecorder = null
  replayRecorder.destroy()
  // PR1: cleanup auth-death listener for recording UI state
  _unregisterRecordingAuthDeath()
  // PR1: cleanup post-record prompt timer
  if (_recordingDoneTimer) {
    clearTimeout(_recordingDoneTimer)
    _recordingDoneTimer = null
  }
  try {
    await autosave.saveNow()
  } catch {
    // Best-effort
  }
  autosave.destroy()
  presence.disconnect()
  classroomSession.stopUserPolling()
  classroomSession.reset()
  classroomRole.reset()
  lessonRuntime.$reset()
})
</script>

<style scoped>
/* WB: Classroom room layout — extends solo room with sidebar */

.wb-classroom-room {
  display: flex;
  flex-direction: column;
  height: 100vh;
  background: var(--wb-bg-tertiary, #f1f5f9);
}

.wb-classroom-room--locked {
  --wb-canvas-area-bg: #fef2f2;
}

/* ── Header ──────────────────────────────────────────────────────────────── */

.wb-classroom-room__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 24px;
  background: var(--wb-header-bg, #0f172a);
  color: white;
  height: 56px;
  flex-shrink: 0;
  z-index: 30;
  gap: 12px;
}

.wb-classroom-room__title {
  display: flex;
  align-items: center;
  gap: 8px;
  flex: 1;
  min-width: 0;
}

.wb-title-input {
  width: 100%;
  max-width: 220px;
  padding: 4px 10px;
  background: rgba(255, 255, 255, 0.1);
  border: 1px solid transparent;
  border-radius: 6px;
  color: white;
  font-size: 0.875rem;
  font-weight: 500;
  transition: background 0.15s ease, border-color 0.15s ease;
}

.wb-title-input::placeholder { color: rgba(255, 255, 255, 0.5); }
.wb-title-input:focus {
  outline: none;
  background: rgba(255, 255, 255, 0.18);
  border-color: var(--wb-brand, #2563eb);
}

.wb-title-text {
  font-size: 0.875rem;
  font-weight: 500;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.wb-role-badge {
  padding: 2px 8px;
  border-radius: 4px;
  font-size: 0.6875rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.03em;
  flex-shrink: 0;
}

.wb-role-badge--owner,
.wb-role-badge--host {
  background: rgba(37, 99, 235, 0.3);
  color: #93c5fd;
}

.wb-role-badge--student {
  background: rgba(34, 197, 94, 0.3);
  color: #bbf7d0;
}

.wb-role-badge--viewer {
  background: rgba(148, 163, 184, 0.3);
  color: #cbd5e1;
}

.wb-classroom-room__status {
  display: flex;
  align-items: center;
  gap: 12px;
  flex-shrink: 0;
}

.wb-lock-indicator {
  padding: 2px 8px;
  background: rgba(239, 68, 68, 0.3);
  border-radius: 4px;
  font-size: 0.6875rem;
  font-weight: 600;
  color: #fca5a5;
}

.wb-save-indicator {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 0.75rem;
  /* Solid white instead of rgba(255,255,255,0.7) — на зеленому header (#047857)
     alpha blend давав greenish tint. */
  color: #ffffff;
}

.wb-save-indicator__dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: #cbd5e1;
  /* White ring навколо dot щоб він був видимим на ЛЮБОМУ кольоровому header
     (зеленому, фіолетовому, темному). */
  box-shadow: 0 0 0 1.5px rgba(255, 255, 255, 0.85);
  transition: background 0.3s ease;
  flex-shrink: 0;
}

/* Lighter dot colors + white ring → видимі на зеленому header (#047857). */
.wb-save-indicator--saved .wb-save-indicator__dot { background: #86efac; }
.wb-save-indicator--syncing .wb-save-indicator__dot { background: #fde047; animation: wb-pulse 1s infinite; }
.wb-save-indicator--error .wb-save-indicator__dot { background: #fca5a5; }
.wb-save-indicator--offline .wb-save-indicator__dot { background: #fdba74; }

@keyframes wb-pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.4; }
}

/* ── Follow mode (reuse from solo) ───────────────────────────────────────── */

.wb-follow-controls { flex-shrink: 0; margin: 0 12px; }
.wb-follow-btn {
  padding: 4px 14px;
  background: rgba(37, 99, 235, 0.8);
  border: none;
  border-radius: 6px;
  color: white;
  font-size: 0.75rem;
  cursor: pointer;
}
.wb-follow-btn:hover { background: rgba(37, 99, 235, 1); }
.wb-follow-indicator {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 4px 10px;
  background: rgba(34, 197, 94, 0.15);
  border: 1px solid rgba(34, 197, 94, 0.4);
  border-radius: 6px;
  font-size: 0.75rem;
  color: #bbf7d0;
}
.wb-follow-indicator__dot {
  width: 6px; height: 6px; border-radius: 50%; background: #22c55e;
  animation: wb-pulse 1.5s infinite;
}
.wb-follow-stop-btn {
  margin-left: 4px; padding: 2px 8px;
  background: rgba(255, 255, 255, 0.15);
  border: none; border-radius: 4px; color: white;
  font-size: 0.6875rem; cursor: pointer;
}
.wb-follow-stop-btn:hover { background: rgba(239, 68, 68, 0.6); }

/* ── Student badge (header) ──────────────────────────────────────────────── */

.wb-student-badge {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 4px 10px;
  /* Slightly stronger background opacity для better separation від green header. */
  background: rgba(255, 255, 255, 0.15);
  border-radius: 8px;
  font-size: 0.8125rem;
  /* Solid white — alpha blend на #047857 давав greenish tint для status text. */
  color: #ffffff;
  white-space: nowrap;
}
.wb-student-badge--empty {
  color: rgba(255, 255, 255, 0.7);
}
.wb-student-badge__dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  flex-shrink: 0;
  /* White ring → dot видимий на зеленому header. */
  box-shadow: 0 0 0 1.5px rgba(255, 255, 255, 0.85);
}
.wb-student-badge__dot--online {
  /* Lighter green з white ring → contrasts з #047857. */
  background: #86efac;
}
.wb-student-badge__dot--offline {
  background: #cbd5e1;
}
.wb-student-badge__name {
  font-weight: 500;
}
.wb-student-badge__status {
  font-size: 0.6875rem;
  /* Solid light gray (instead of rgba alpha) — no greenish tint. */
  color: #e2e8f0;
}

/* ── Actions ─────────────────────────────────────────────────────────────── */

.wb-classroom-room__actions {
  display: flex;
  align-items: center;
  gap: 6px;
}

.wb-header-btn {
  min-width: 32px;
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0 8px;
  background: rgba(255, 255, 255, 0.1);
  border: none;
  border-radius: 6px;
  color: white;
  cursor: pointer;
  font-size: 0.875rem;
  transition: background 0.15s ease;
}

.wb-header-btn:hover:not(:disabled) { background: rgba(255, 255, 255, 0.2); }
.wb-header-btn:disabled { opacity: 0.35; cursor: not-allowed; }
.wb-header-btn--active { background: rgba(239, 68, 68, 0.4); }
.wb-header-btn--danger {
  background: rgba(239, 68, 68, 0.3);
  font-size: 0.75rem;
  font-weight: 500;
  white-space: nowrap;
}
.wb-header-btn--danger:hover { background: rgba(239, 68, 68, 0.6); }
.wb-header-btn--exit {
  width: auto;
  min-width: 56px;
  padding: 0 14px;
  font-size: 0.8125rem;
  font-weight: 500;
  white-space: nowrap;
  line-height: 1;
  overflow: hidden;
}

/* ── Main layout ─────────────────────────────────────────────────────────── */

.wb-classroom-room__main {
  display: flex;
  flex: 1;
  overflow: hidden;
}

.wb-classroom-room__sidebar {
  width: 320px;
  flex-shrink: 0;
  background: var(--wb-bg-secondary, #f8fafc);
  border-left: 1px solid var(--wb-border, #e2e8f0);
  overflow-y: auto;
  touch-action: pan-y;
  z-index: 20;
  display: flex;
  flex-direction: column;
}

.wb-sidebar-header {
  padding: 10px 12px;
  border-bottom: 1px solid var(--wb-border, #e2e8f0);
  flex-shrink: 0;
}
.wb-sidebar-header__title {
  margin: 0;
  font-size: 12px;
  font-weight: 600;
  color: var(--wb-text-secondary, #64748b);
  text-transform: uppercase;
  letter-spacing: 0.04em;
}

.wb-classroom-room__toolbar {
  flex-shrink: 0;
  z-index: 20;
  /* Constrain height so WBToolbar overflow-y:auto can scroll */
  overflow: hidden;
  display: flex;
  flex-direction: column;
}

/* A.4 (INV-X): read-only overlay в replay-режимі */
.wb-classroom-room__readonly-overlay {
  position: absolute;
  inset: 0;
  z-index: 20;
  background: transparent;
  cursor: default;
  pointer-events: auto;
  user-select: none;
  -webkit-user-select: none;
}

.wb-classroom-room__canvas {
  flex: 1;
  overflow: hidden;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--wb-canvas-area-bg, #e2e8f0);
  position: relative;
}


/* ── Student list ────────────────────────────────────────────────────────── */

/* ── Footer ──────────────────────────────────────────────────────────────── */

.wb-classroom-room__footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 20px;
  height: 44px;
  background: var(--wb-footer-bg, #ffffff);
  border-top: 1px solid var(--wb-border, #e2e8f0);
  flex-shrink: 0;
  z-index: 20;
}

.wb-page-nav { display: flex; align-items: center; gap: 8px; }
.wb-page-btn {
  width: 28px; height: 28px;
  display: flex; align-items: center; justify-content: center;
  background: var(--wb-bg-secondary, #f8fafc);
  border: 1px solid var(--wb-border, #e2e8f0);
  border-radius: 6px; cursor: pointer;
  font-size: 0.875rem; color: var(--wb-fg, #0f172a);
  transition: background 0.15s ease;
}
.wb-page-btn:hover:not(:disabled) { background: var(--wb-bg-hover, #f1f5f9); }
.wb-page-btn:disabled { opacity: 0.35; cursor: not-allowed; }
.wb-page-btn--add { font-weight: 600; color: var(--wb-brand, #2563eb); }
.wb-page-indicator {
  font-size: 0.8125rem; color: var(--wb-fg-secondary, #475569);
  min-width: 48px; text-align: center;
}

.wb-zoom-controls { display: flex; align-items: center; gap: 6px; }
.wb-zoom-btn {
  width: 28px; height: 28px;
  display: flex; align-items: center; justify-content: center;
  background: var(--wb-bg-secondary, #f8fafc);
  border: 1px solid var(--wb-border, #e2e8f0);
  border-radius: 6px; cursor: pointer;
  font-size: 1rem; font-weight: 600; color: var(--wb-fg, #0f172a);
  transition: background 0.15s ease;
}
.wb-zoom-btn:hover { background: var(--wb-bg-hover, #f1f5f9); }
.wb-zoom-level {
  font-size: 0.8125rem; color: var(--wb-fg-secondary, #475569);
  min-width: 48px; text-align: center;
}

/* ── Skip link ───────────────────────────────────────────────────────────── */

.wb-skip-link {
  position: absolute;
  top: -100px;
  left: 0;
  padding: 8px 16px;
  background: var(--wb-brand, #2563eb);
  color: white;
  z-index: 100;
  border-radius: 0 0 6px 0;
}
.wb-skip-link:focus { top: 0; }

/* ── Fade transition ─────────────────────────────────────────────────────── */

.wb-fade-enter-active,
.wb-fade-leave-active { transition: opacity 0.2s ease; }
.wb-fade-enter-from,
.wb-fade-leave-to { opacity: 0; }

/* ── Lesson action buttons (Phase 2) ────────────────────────────────────── */

.wb-lesson-action-btn {
  padding: 3px 12px;
  border: none;
  border-radius: 5px;
  font-size: 0.6875rem;
  font-weight: 600;
  cursor: pointer;
  flex-shrink: 0;
  transition: background 0.15s ease, opacity 0.15s ease;
}
.wb-lesson-action-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
.wb-lesson-action-btn--start {
  background: rgba(34, 197, 94, 0.8);
  color: white;
}
.wb-lesson-action-btn--start:hover:not(:disabled) {
  background: rgba(34, 197, 94, 1);
}
.wb-lesson-action-btn--complete {
  background: rgba(251, 191, 36, 0.8);
  color: #1e293b;
}
.wb-lesson-action-btn--complete:hover:not(:disabled) {
  background: rgba(251, 191, 36, 1);
}

/* ── Lesson status badge (C1.2) ─────────────────────────────────────────── */

.wb-lesson-status {
  font-size: 11px;
  padding: 2px 8px;
  border-radius: 4px;
  font-weight: 600;
  text-transform: uppercase;
  flex-shrink: 0;
}
.wb-lesson-status--DRAFT { background: rgba(243, 244, 246, 0.2); color: #d1d5db; }
.wb-lesson-status--SCHEDULED { background: rgba(219, 234, 254, 0.2); color: #93c5fd; }
.wb-lesson-status--CONFIRMED { background: rgba(209, 250, 229, 0.2); color: #6ee7b7; }
.wb-lesson-status--IN_PROGRESS { background: rgba(254, 243, 199, 0.2); color: #fcd34d; }
.wb-lesson-status--COMPLETED { background: rgba(209, 250, 229, 0.2); color: #6ee7b7; }
.wb-lesson-status--CANCELLED { background: rgba(254, 226, 226, 0.2); color: #fca5a5; }
.wb-lesson-status--DISPUTED { background: rgba(254, 226, 226, 0.2); color: #f87171; }
.wb-lesson-status--ARCHIVED { background: rgba(243, 244, 246, 0.2); color: #9ca3af; }

/* ── Homework tab container (C1.1) ──────────────────────────────────────── */

.wb-homework-tab {
  padding: 12px;
  overflow-y: auto;
  touch-action: pan-y;
  flex: 1;
}

/* ── Phase 11: Replay entry button ─────────────────────────────────────── */

.wb-classroom-room__replay-btn {
  position: fixed;
  bottom: 80px;
  right: 16px;
  padding: 10px 20px;
  background: var(--wb-brand, #6366f1);
  color: white;
  border: none;
  border-radius: 10px;
  font-size: 0.875rem;
  font-weight: 600;
  cursor: pointer;
  z-index: 40;
  box-shadow: 0 4px 12px rgba(99, 102, 241, 0.35);
  transition: background 0.15s, transform 0.1s;
  animation: wb-replay-pulse 2s ease-in-out 3;
}

.wb-classroom-room__replay-btn:hover {
  background: var(--primary-hover, #4f46e5);
  transform: translateY(-1px);
}

@keyframes wb-replay-pulse {
  0%, 100% { box-shadow: 0 4px 12px rgba(99, 102, 241, 0.35); }
  50% { box-shadow: 0 4px 24px rgba(99, 102, 241, 0.6); }
}

/* ── B3: Waiting for teacher screen ─────────────────────────────────────── */

.wb-waiting-screen {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 100vh;
  background: var(--wb-bg-tertiary, #f1f5f9);
}

.wb-waiting-screen__content {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 16px;
  text-align: center;
  padding: 40px;
}

.wb-waiting-screen__spinner {
  width: 48px;
  height: 48px;
  border: 4px solid var(--wb-toolbar-border, #e2e8f0);
  border-top-color: var(--wb-brand, #0066ff);
  border-radius: 50%;
  animation: wb-spin 1s linear infinite;
}

@keyframes wb-spin {
  to { transform: rotate(360deg); }
}

.wb-waiting-screen__title {
  font-size: 22px;
  font-weight: 600;
  color: var(--wb-fg, #0f172a);
  margin: 0;
}

.wb-waiting-screen__text {
  font-size: 14px;
  color: var(--wb-fg-secondary, #94a3b8);
  margin: 0;
  max-width: 320px;
}

.wb-waiting-screen__back {
  margin-top: 12px;
  padding: 8px 20px;
  border: 1px solid var(--wb-toolbar-border, #e2e8f0);
  border-radius: 8px;
  background: transparent;
  color: var(--wb-fg-secondary, #64748b);
  font-size: 13px;
  cursor: pointer;
  transition: border-color 0.15s;
}

.wb-waiting-screen__back:hover {
  border-color: var(--wb-brand, #0066ff);
  color: var(--wb-brand, #0066ff);
}

.wb-waiting-screen__icon {
  font-size: 48px;
  line-height: 1;
  margin-bottom: 8px;
}
</style>
