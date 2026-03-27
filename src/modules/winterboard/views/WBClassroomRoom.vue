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

  <div v-else class="wb-classroom-room" :class="{ 'wb-classroom-room--locked': isLocked }">
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

      <!-- Follow mode (students) -->
      <div v-if="followMode.canFollow.value" class="wb-follow-controls">
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

      <!-- Right: Actions -->
      <div class="wb-classroom-room__actions">
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

        <!-- Share (teacher only) -->
        <button
          v-if="classroomRole.isTeacher.value && sessionId"
          type="button"
          class="wb-header-btn"
          :title="t('winterboard.room.share')"
          @click="showShareDialog = true"
        >
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true"><circle cx="12" cy="4" r="2" stroke="currentColor" stroke-width="1.5"/><circle cx="4" cy="8" r="2" stroke="currentColor" stroke-width="1.5"/><circle cx="12" cy="12" r="2" stroke="currentColor" stroke-width="1.5"/><path d="M5.7 7l4.6-2M5.7 9l4.6 2" stroke="currentColor" stroke-width="1.5"/></svg>
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

    <!-- ── Main: Sidebar (teacher) + Toolbar + Canvas ──────────────────── -->
    <div class="wb-classroom-room__main">
      <!-- Teacher sidebar: tabs (students + materials) -->
      <aside
        v-if="classroomRole.isTeacher.value"
        class="wb-classroom-room__sidebar"
        role="complementary"
        :aria-label="t('winterboard.classroom.studentList')"
      >
        <!-- Tab switcher -->
        <div class="wb-sidebar-tabs">
          <button
            class="wb-sidebar-tab"
            :class="{ 'wb-sidebar-tab--active': activeTab === 'students' }"
            @click="activeTab = 'students'"
          >
            {{ t('winterboard.classroom.students') }}
            <span class="wb-student-list__count">{{ connectedStudents.length }}</span>
          </button>
          <button
            class="wb-sidebar-tab"
            :class="{ 'wb-sidebar-tab--active': activeTab === 'materials' }"
            @click="activeTab = 'materials'"
          >
            {{ t('learningContent.panel.title') }}
          </button>
          <button
            class="wb-sidebar-tab"
            :class="{ 'wb-sidebar-tab--active': activeTab === 'homework' }"
            @click="activeTab = 'homework'"
          >
            {{ t('lessons.homework.title') }}
          </button>
        </div>

        <!-- Students tab — existing HTML preserved fully -->
        <div v-if="activeTab === 'students'" class="wb-student-list">
          <h3 class="wb-student-list__title">
            {{ t('winterboard.classroom.students') }}
            <span class="wb-student-list__count">{{ connectedStudents.length }}</span>
          </h3>
          <ul class="wb-student-list__items" role="list">
            <li
              v-for="user in connectedStudents"
              :key="user.user_id"
              class="wb-student-item"
              :class="{ 'wb-student-item--offline': !user.is_online }"
            >
              <span
                class="wb-student-item__color"
                :style="{ background: user.cursor_color }"
              />
              <span class="wb-student-item__name">{{ user.display_name }}</span>
              <span class="wb-student-item__role">{{ user.role }}</span>
              <button
                v-if="classroomRole.canKick.value && user.role === 'student'"
                type="button"
                class="wb-student-item__kick"
                :title="t('winterboard.classroom.kick')"
                @click="handleKickStudent(user.user_id)"
              >
                ✕
              </button>
            </li>
          </ul>
          <p v-if="connectedStudents.length === 0" class="wb-student-list__empty">
            {{ t('winterboard.classroom.noStudents') }}
          </p>
        </div>

        <!-- Materials tab: sidebar (lesson mode) or library (browse mode) -->
        <ContentSidebar
          ref="contentSidebarRef"
          v-else-if="activeTab === 'materials' && lessonIdNum"
          :lesson-id="props.lessonId"
          :is-tutor="classroomRole.isTeacher.value"
          @youtube-add="handleYouTubeAdd"
        />
        <MaterialsBrowser
          v-else-if="activeTab === 'materials'"
        />

        <!-- Homework tab (C1.1) -->
        <div v-else-if="activeTab === 'homework'" class="wb-homework-tab">
          <LessonHomeworkPanel
            :items="homeworkItems"
            :loading="homeworkLoading"
            @assign="fetchHomework"
          />
        </div>
      </aside>

      <!-- Toolbar (role-aware) -->
      <aside class="wb-classroom-room__toolbar">
        <WBToolbar
          :current-tool="store.currentTool"
          :current-color="store.currentColor"
          :current-size="store.currentSize"
          :can-undo="store.canUndo"
          :can-redo="store.canRedo"
          :disabled="isDrawingDisabled"
          :hide-clear="!classroomRole.canClear.value"
          @tool-change="handleToolChange"
          @color-change="handleColorChange"
          @size-change="handleSizeChange"
          @undo="handleUndo"
          @redo="handleRedo"
          @clear="handleClear"
          @youtube-insert="showYouTubeModal = true"
        />
      </aside>

      <!-- Phase 11 A4: Page thumbnails (teacher only) -->
      <WBPageThumbnails
        v-if="classroomRole.isTeacher.value"
        :pages="store.pages"
        :current-index="store.currentPageIndex"
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
        />

        <!-- Remote cursors -->
        <WBRemoteCursors
          :cursors="presence.remoteCursors.value"
          :zoom="store.zoom"
          :current-page-id="store.currentPage?.id ?? ''"
        />
      </div>
    </div>

    <!-- P2: Selection toolbar — floating actions for selected objects (desktop only) -->
    <WBSelectionToolbar
      :selected-ids="store.selectedIds"
      :zoom="store.zoom"
      :canvas-rect="canvasContainerRef?.getBoundingClientRect() ?? null"
      :mode="mode"
      :is-locked="hasLockedInSelection"
      :bbox="selectionBBox"
      @bring-to-front="store.bringToFront(store.selectedIds[0])"
      @send-to-back="store.sendToBack(store.selectedIds[0])"
      @duplicate="store.copySelectedToClipboard(); store.pasteFromClipboard()"
      @lock="locking.lockSelected()"
      @unlock="locking.unlockSelected()"
      @delete="handleDeleteSelected()"
    />

    <!-- P3: YouTube insert modal -->
    <WBYouTubeModal
      :visible="showYouTubeModal"
      @close="showYouTubeModal = false"
      @submit="handleYouTubeSubmit"
    />

    <!-- Share dialog -->
    <WBShareDialog
      v-if="showShareDialog && sessionId"
      :session-id="sessionId"
      :is-open="showShareDialog"
      @close="showShareDialog = false"
    />

    <!-- Phase 11: Replay mode banner -->
    <WBReplayBanner
      v-if="mode === 'replay'"
      @exit="exitReplayMode"
    />

    <!-- Phase 11: Replay mode controls (teacher only) -->
    <WBReplayControls
      v-if="mode === 'replay' && resolvedSessionId"
      :session-id="resolvedSessionId"
      @exit="exitReplayMode"
      @operation="onReplayOperation"
    />

    <!-- Phase 11: Lesson Map sidebar in replay mode -->
    <WBLessonMap
      v-if="mode === 'replay' && resolvedSessionId"
      :markers="replayMarkers"
      :active-marker-id="replayActiveMarkerId"
      :can-edit="classroomRole.isTeacher.value"
      @seek="handleMarkerSeek"
      @create="showMarkerModal = true"
      @delete="handleMarkerDelete"
    />

    <!-- Phase 11: Marker create modal -->
    <WBMarkerCreateModal
      :visible="showMarkerModal"
      @close="showMarkerModal = false"
      @submit="handleMarkerCreateFromModal"
    />

    <!-- Phase 11 B5: Onboarding hints for empty board -->
    <WBOnboardingHints
      v-if="mode === 'edit' && !isLoading"
      :is-empty="isBoardEmpty"
    />

    <!-- Phase 11: Replay entry button (teacher only, edit mode) -->
    <button
      v-if="mode === 'edit' && resolvedSessionId && (classroomRole.isTeacher.value || lessonEnded) && hasOperations"
      class="wb-classroom-room__replay-btn"
      data-testid="replay-button"
      :aria-label="t('winterboard.replay.viewReplay')"
      @click="enterReplayMode"
    >
      &#9654; {{ t('winterboard.replay.viewReplay') }}
    </button>

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

import { ref, computed, onMounted, onBeforeUnmount, onUnmounted, watch } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { useWBStore } from '../board/state/boardStore'
import { useHistory } from '../composables/useHistory'
import { useKeyboard } from '../composables/useKeyboard'
import { useBoardClipboard } from '../composables/useBoardClipboard'
import { useAutosave } from '../composables/useAutosave'
import { usePresence } from '../composables/usePresence'
import { useFollowMode } from '../composables/useFollowMode'
import { useLocking } from '../composables/useLocking'
import { useAnnouncer } from '../composables/useAnnouncer'
import { useClassroomRole } from '../composables/useClassroomRole'
import { useClassroomSession } from '../composables/useClassroomSession'
import { winterboardApi } from '../api/winterboardApi'
import { useAuthStore } from '@/modules/auth/store/authStore'
import type { WBStroke, WBAsset, WBToolType } from '../types/winterboard'

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
import WBShareDialog from '../components/sharing/WBShareDialog.vue'
import WBReplayControls from '../components/replay/WBReplayControls.vue'
import WBLessonMap from '../components/replay/WBLessonMap.vue'
import WBReplayBanner from '../components/replay/WBReplayBanner.vue'
import WBMarkerCreateModal from '../components/replay/WBMarkerCreateModal.vue'
import WBOnboardingHints from '../components/ui/WBOnboardingHints.vue'
import type { BoardOperation } from '../types/replay'
import type { WBLessonMarker } from '../types/winterboard'
import { createLessonMarker, deleteLessonMarker } from '../api/replay'
import { applyReplayOperation } from '../engine/applyReplayOperation'
import { useGridOverlay } from '../composables/useGridOverlay'
import { useReplayRecorder } from '../composables/useReplayRecorder'
import { useDeviceMode } from '../composables/useDeviceMode'

// Learning Content integration
import ContentPanel from '@/modules/learning-content/components/ContentPanel.vue'
import ContentSidebar from '../components/sidebar/ContentSidebar.vue'
import MaterialsBrowser from '../components/sidebar/MaterialsBrowser.vue'
import { addYouTubeAsset } from '../api/library'
import WBDragGhost from '../components/sidebar/WBDragGhost.vue'
import { useContentDrop } from '../composables/useContentDrop'
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
const { t } = useI18n()
const { announce } = useAnnouncer()

const history = useHistory({ maxSize: 100 })
const locking = useLocking(store)
const deviceModeState = useDeviceMode()

const resolvedSessionId = ref<string | null>(props.sessionId ?? null)

// P2: edit/replay mode — synced to URL query for shareable links
const mode = computed<'edit' | 'replay'>({
  get: () => (route.query.mode === 'replay' ? 'replay' : 'edit'),
  set: (value: 'edit' | 'replay') => {
    const query = { ...route.query }
    if (value === 'replay') {
      query.mode = 'replay'
    } else {
      delete query.mode
    }
    router.replace({ query })
  },
})

// Sidebar tabs: 'students' | 'materials' | 'homework'
const activeTab = ref<'students' | 'materials' | 'homework'>('materials')

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

const autosave = useAutosave(resolvedSessionId, {
  disabled: isStudentInClassroom,
  // Classroom sync: after each save, notify other participants via WS
  onSaved: () => {
    if (presence.isConnected.value && resolvedSessionId.value) {
      try {
        presence.sendMessage({
          type: 'session.state_update',
          rev: store.rev,
          pageIndex: store.currentPageIndex ?? 0,
          action: 'autosave',
        })
      } catch { /* WS may be closed */ }
    }
  },
})

// P4: Replay recorder — batch records operations for replay timeline
const replayRecorder = useReplayRecorder({
  sessionId: resolvedSessionId,
  getBoardState: () => store.getSnapshotState(),
})
// Phase 20: Auto-record all store operations — no manual record() calls needed
const _unsubRecorder = replayRecorder.connectToStore(store)

// Grid overlay (background grid for the canvas)
const gridOverlay = useGridOverlay(resolvedSessionId.value ?? 'default')

const classroomRole = useClassroomRole(resolvedSessionId)
const classroomSession = useClassroomSession()

// Learning Content drop handler
const contentDrop = useContentDrop({
  sessionId: resolvedSessionId,
  canDraw: classroomRole.canDraw,
  onAssetAdd: (asset) => {
    store.addAsset(asset)
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

// ─── Refs ───────────────────────────────────────────────────────────────────

const canvasRef = ref<InstanceType<typeof WBCanvas> | null>(null)
const canvasContainerRef = ref<HTMLElement | null>(null)
const sessionName = ref('Untitled')
const selectedId = ref<string | null>(null)
const isLoading = ref(true)
const showYouTubeModal = ref(false)
const showShareDialog = ref(false)
const replayMarkers = ref<WBLessonMarker[]>([])
const replayActiveMarkerId = ref<string | null>(null)
const showMarkerModal = ref(false)
const contentSidebarRef = ref<InstanceType<typeof ContentSidebar> | null>(null)

// Phase 11 B5: Board empty check for onboarding hints
const isBoardEmpty = computed(() => {
  const page = store.currentPage
  if (!page) return true
  return page.assets.length === 0 && page.strokes.length === 0
})

// A1.4: Hide replay button on empty boards (check all pages)
const hasOperations = computed(() => {
  return store.pages.some(p => p.strokes.length > 0 || p.assets.length > 0)
})

// A1.5: Detect lesson end — students can replay after lesson is completed/archived
const lessonEnded = computed(() => {
  return lessonStatus.value === 'COMPLETED' || lessonStatus.value === 'ARCHIVED'
})

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
    store.addAsset(asset)
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
  onCopy: () => boardClipboard.copySelected(),
  onPaste: () => boardClipboard.pasteInternal(),
  onCut: () => boardClipboard.cutSelected(),
})

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
  store.addAsset(asset)

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
  store.addAsset(asset as any)
}

// ─── Phase 11 FIX-1: YouTube sidebar add handler ────────────────────────────

async function handleYouTubeAdd(url: string): Promise<void> {
  try {
    await addYouTubeAsset(url)
    contentSidebarRef.value?.reload()
  } catch (e) {
    console.warn('[WBClassroomRoom] YouTube add failed:', e)
  }
}

// ─── Phase 11: Replay mode (teacher can review the lesson) ──────────────────

function enterReplayMode(): void {
  if (!classroomRole.isTeacher.value && !lessonEnded.value) return
  mode.value = 'replay'
}

function exitReplayMode(): void {
  mode.value = 'edit'
}

// R5: Delegate to shared applyReplayOperation (DRY)
function onReplayOperation(op: BoardOperation): void {
  applyReplayOperation(store, op)
}

function handleMarkerSeek(marker: WBLessonMarker): void {
  if (marker.page_id) {
    const pageIdx = store.pages.findIndex(p => p.id === marker.page_id)
    if (pageIdx >= 0) store.goToPage(pageIdx)
  }
  if (marker.board_position?.x !== undefined) {
    store.setScroll(marker.board_position.x, marker.board_position.y)
  }
}

async function handleMarkerCreate(data: { title: string; category: string }): Promise<void> {
  if (!resolvedSessionId.value) return
  await createLessonMarker(resolvedSessionId.value, {
    title: data.title,
    operation_index: 0,
    page_id: store.currentPage?.id ?? '',
    board_position: { x: store.scrollX, y: store.scrollY },
    thumbnail_url: '',
    category: data.category as WBLessonMarker['category'],
    order: replayMarkers.value.length,
  })
}

async function handleMarkerCreateFromModal(data: { title: string; category: string }): Promise<void> {
  showMarkerModal.value = false
  await handleMarkerCreate(data)
}

async function handleMarkerDelete(id: string): Promise<void> {
  replayMarkers.value = replayMarkers.value.filter(m => m.id !== id)
  if (resolvedSessionId.value) {
    deleteLessonMarker(resolvedSessionId.value, id).catch(() => {})
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
  store.goToPage(index)
}

function handlePageAdd(): void {
  if (!classroomRole.canAddPage.value) return
  store.addPage()
}

function handlePageDelete(index: number): void {
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
  router.push('/winterboard')
}

// ─── Handlers: Classroom controls ───────────────────────────────────────────

async function handleToggleLock(): Promise<void> {
  if (!classroomRole.canLock.value || !resolvedSessionId.value) return
  try {
    const result = await winterboardApi.lockSession(resolvedSessionId.value, !isLocked.value)
    classroomSession.setLocked(result.locked)
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

  // ── updateStroke + moveSelected via $onAction (reliable Pinia API) ──
  let _moveBroadcastTimer: ReturnType<typeof setTimeout> | null = null

  const _unsubOnAction = store.$onAction(({ name, args, after }) => {
    // updateStroke (resize, transform)
    if (name === 'updateStroke') {
      after(() => {
        const [stroke, opts] = args as [any, any]
        if (opts?._remote) return
        wsBroadcast({
          type: 'stroke.broadcast',
          stroke,
          pageIndex: store.currentPageIndex ?? 0,
          action: 'stroke_update',
        })
      })
    }

    // moveSelected / moveSelectedUnlocked (drag) — debounced
    if (name === 'moveSelected' || name === 'moveSelectedUnlocked') {
      after(() => {
        if (_moveBroadcastTimer) clearTimeout(_moveBroadcastTimer)
        _moveBroadcastTimer = setTimeout(() => {
          const page = store.currentPage
          if (!page) return
          const ids = new Set(store.selectedIds)
          const movedStrokes = page.strokes.filter((s: any) => ids.has(s.id))
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
      })
    }
  })

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
      }
    }
  }

  _unsubStrokeInterceptor = () => {
    store.addStroke = origAddStroke
    store.deleteStroke = origDeleteStroke
    store.deleteSelected = origDeleteSelected
    store.undo = origUndo
    store.redo = origRedo
    store.clearCurrentPage = origClearCurrentPage
    _unsubOnAction()
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
    store.addStroke(detail.stroke, { skipHistory: true, _remote: true })
  } else {
    store.pages[targetPageIndex] = {
      ...page,
      strokes: [...page.strokes, detail.stroke],
    }
  }
  store.markDirty()
}

window.addEventListener('wb:remote-stroke', onRemoteStroke)

onUnmounted(() => {
  window.removeEventListener('wb:remote-state-update', onRemoteStateUpdate)
  window.removeEventListener('wb:remote-stroke', onRemoteStroke)
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
      router.push('/winterboard')
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
    isLoading.value = false
    return
  }

  await initBoardWithSession(init)
})

// B3: Extracted init logic so waiting_for_teacher can call it when teacher starts
async function initBoardWithSession(init: { sessionId: string; role: any; permissions: any; isLocked: boolean }): Promise<void> {
  // Set resolved session ID
  resolvedSessionId.value = init.sessionId
  store.workspaceId = init.sessionId

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
  } catch (err) {
    console.error('[WB:ClassroomRoom] Failed to load session state', err)
  }

  isLoading.value = false
  replayRecorder.start()

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
  _unsubRecorder()
  replayRecorder.destroy()
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
  color: rgba(255, 255, 255, 0.7);
}

.wb-save-indicator__dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: #94a3b8;
  transition: background 0.3s ease;
}

.wb-save-indicator--saved .wb-save-indicator__dot { background: #22c55e; }
.wb-save-indicator--syncing .wb-save-indicator__dot { background: #eab308; animation: wb-pulse 1s infinite; }
.wb-save-indicator--error .wb-save-indicator__dot { background: #ef4444; }
.wb-save-indicator--offline .wb-save-indicator__dot { background: #f97316; }

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
  font-size: 0.8125rem;
  font-weight: 500;
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
  border-right: 1px solid var(--wb-border, #e2e8f0);
  overflow-y: auto;
  z-index: 20;
  display: flex;
  flex-direction: column;
}

.wb-sidebar-tabs {
  display: flex;
  border-bottom: 1px solid var(--wb-border, #e2e8f0);
  flex-shrink: 0;
}

.wb-sidebar-tab {
  flex: 1;
  padding: 10px 8px;
  font-size: 12px;
  font-weight: 500;
  color: var(--wb-text-secondary, #64748b);
  background: none;
  border: none;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 4px;
  transition: color 0.15s;
}

.wb-sidebar-tab--active {
  color: var(--wb-accent, #4F46E5);
  border-bottom: 2px solid var(--wb-accent, #4F46E5);
}

.wb-sidebar-tab:hover:not(.wb-sidebar-tab--active) {
  color: var(--wb-text-primary, #1e293b);
  background: var(--wb-bg-hover, #f1f5f9);
}

.wb-classroom-room__toolbar {
  flex-shrink: 0;
  z-index: 20;
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

.wb-student-list {
  padding: 16px 12px;
}

.wb-student-list__title {
  font-size: 0.8125rem;
  font-weight: 600;
  color: var(--wb-fg, #0f172a);
  margin: 0 0 12px;
  display: flex;
  align-items: center;
  gap: 6px;
}

.wb-student-list__count {
  padding: 1px 6px;
  background: var(--wb-brand, #2563eb);
  color: white;
  border-radius: 10px;
  font-size: 0.6875rem;
  font-weight: 700;
}

.wb-student-list__items {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.wb-student-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 8px;
  border-radius: 6px;
  transition: background 0.15s ease;
}

.wb-student-item:hover {
  background: var(--wb-bg-hover, #f1f5f9);
}

.wb-student-item--offline {
  opacity: 0.5;
}

.wb-student-item__color {
  width: 10px;
  height: 10px;
  border-radius: 50%;
  flex-shrink: 0;
}

.wb-student-item__name {
  flex: 1;
  font-size: 0.8125rem;
  color: var(--wb-fg, #0f172a);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.wb-student-item__role {
  font-size: 0.625rem;
  color: var(--wb-fg-secondary, #475569);
  text-transform: uppercase;
}

.wb-student-item__kick {
  width: 20px;
  height: 20px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: transparent;
  border: none;
  border-radius: 4px;
  color: var(--wb-fg-secondary, #475569);
  cursor: pointer;
  font-size: 0.75rem;
  opacity: 0;
  transition: opacity 0.15s ease, background 0.15s ease;
}

.wb-student-item:hover .wb-student-item__kick {
  opacity: 1;
}

.wb-student-item__kick:hover {
  background: rgba(239, 68, 68, 0.15);
  color: #ef4444;
}

.wb-student-list__empty {
  font-size: 0.75rem;
  color: var(--wb-fg-secondary, #475569);
  text-align: center;
  padding: 20px 0;
}

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
</style>
