<template>
  <div
    class="wb-solo-room"
    :data-device-mode="deviceModeState.deviceMode.value"
    :data-input-mode="deviceModeState.inputMode.value"
    :data-orientation="deviceModeState.orientation.value"
  >
    <!-- B5.1: Skip to canvas link for keyboard/screen reader users -->
    <a href="#wb-canvas" class="wb-skip-link">{{ t('winterboard.a11y.skipToCanvas') }}</a>
    <!-- ── Header ──────────────────────────────────────────────────────────── -->
    <header class="wb-solo-room__header">
      <!-- FIX-5: Logo + hamburger for site navigation -->
      <div class="wb-solo-room__nav">
        <button
          type="button"
          class="wb-header-btn wb-header-btn--hamburger"
          :title="t('winterboard.room.menu')"
          @click="showSidebarOverlay = !showSidebarOverlay"
        >
          <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden="true">
            <path d="M2 4h14M2 9h14M2 14h14" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
          </svg>
        </button>
        <span class="wb-logo" aria-label="M4SH">
          <svg width="60" height="20" viewBox="0 0 200 64" fill="none" xmlns="http://www.w3.org/2000/svg">
            <text x="0" y="48" font-family="'Arial Black', sans-serif" font-weight="900" font-size="52" letter-spacing="-2" fill="#ffffff">M4</text>
            <text x="88" y="48" font-family="'Arial Black', sans-serif" font-weight="900" font-size="52" letter-spacing="-2" fill="#1DB954">SH</text>
          </svg>
        </span>
      </div>

      <!-- Left: Editable title -->
      <div class="wb-solo-room__title">
        <input
          v-model="sessionName"
          class="wb-title-input"
          :placeholder="t('winterboard.room.untitled')"
          @blur="handleTitleBlur"
          @keydown.enter="($event.target as HTMLInputElement).blur()"
        />
      </div>

      <!-- Phase 16 INT-33: Session context bar -->
      <div v-if="sessionContextLabel" class="wb-solo-room__context">
        <span class="wb-solo-room__context-dot" />
        <span class="wb-solo-room__context-label">{{ sessionContextLabel }}</span>
      </div>

      <!-- Center: Save status -->
      <div class="wb-solo-room__status">
        <span class="wb-save-indicator" :class="`wb-save-indicator--${store.syncStatus}`">
          <span class="wb-save-indicator__dot" />
          <span class="wb-save-indicator__text">{{ saveStatusText }}</span>
        </span>
      </div>

      <!-- A5.1: Follow mode indicator -->
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
      <div class="wb-solo-room__actions">
        <!-- A.1: Manual Recording Control — кнопка start/stop + REC таймер -->
        <WBRecordingBanner
          v-if="mode === 'edit' && isSessionOwner"
          :is-recording="isManualRecording"
          :is-frozen="isReplayFrozen"
          :is-loading="isRecordingLoading"
          :recording-started-at="recordingStartedAt"
          @start="handleStartRecording"
          @stop="handleStopRecording"
        />
        <button
          type="button"
          class="wb-header-btn"
          :disabled="!store.canUndo"
          :title="t('winterboard.room.undoShortcut')"
          @click="handleUndo"
        >
          ↩
        </button>
        <button
          type="button"
          class="wb-header-btn"
          :disabled="!store.canRedo"
          :title="t('winterboard.room.redoShortcut')"
          @click="handleRedo"
        >
          ↪
        </button>
        <!-- Phase B: Share replay -->
        <button
          v-if="isSessionOwner"
          type="button"
          class="wb-header-btn"
          :title="t('winterboard.replay.share.title', 'Поділитися записом')"
          @click="showShareModal = true"
        >
          🔗
        </button>
        <button
          type="button"
          class="wb-header-btn"
          :title="t('winterboard.room.export')"
          @click="showExportDialog = true"
        >
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true"><path d="M2 10v3a1 1 0 001 1h10a1 1 0 001-1v-3M8 2v8M5 5l3-3 3 3" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>
        </button>
        <button
          type="button"
          class="wb-header-btn"
          :title="t('winterboard.room.share')"
          @click="showShareDialog = true"
        >
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true"><circle cx="12" cy="4" r="2" stroke="currentColor" stroke-width="1.5"/><circle cx="4" cy="8" r="2" stroke="currentColor" stroke-width="1.5"/><circle cx="12" cy="12" r="2" stroke="currentColor" stroke-width="1.5"/><path d="M5.7 7l4.6-2M5.7 9l4.6 2" stroke="currentColor" stroke-width="1.5"/></svg>
        </button>
        <!-- Phase 21: Save as Lesson button -->
        <button
          v-if="sessionId && isSessionOwner"
          type="button"
          class="wb-header-btn wb-header-btn--save-lesson"
          :title="t('winterboard.lesson.saveButton') || 'Зберегти як урок'"
          @click="openSaveLessonDialog"
        >
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true"><path d="M13 14H3a1 1 0 01-1-1V3a1 1 0 011-1h8l3 3v9a1 1 0 01-1 1z" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/><path d="M11 14V9H5v5M5 2v3h5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>
        </button>
        <!-- Phase 13 A3.3: Publish button — прихована: дублює Save as Lesson flow -->
        <!-- <button
          v-if="sessionId && store.currentStrokes.length > 0"
          type="button"
          class="wb-header-btn wb-header-btn--publish"
          :title="t('winterboard.room.publish') || 'Опублікувати урок'"
          @click="showPublishDialog = true"
        >
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true"><path d="M2 14h12M8 2v9M5 5l3-3 3 3" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>
        </button> -->
        <!-- Phase 14 B2.2: Save as template button — only if lesson already published -->
        <button
          v-if="publishedLessonData"
          type="button"
          class="wb-header-btn wb-header-btn--template"
          :title="t('knowledge.template.saveFromRoom') || 'Зберегти як шаблон'"
          @click="showSaveTemplateDialog = true"
        >
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true"><rect x="2" y="2" width="12" height="12" rx="2" stroke="currentColor" stroke-width="1.5"/><path d="M5 6h6M5 9h4" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>
        </button>
        <button
          type="button"
          class="wb-header-btn wb-header-btn--fullscreen"
          :title="isFullscreen ? t('winterboard.room.exitFullscreen') : t('winterboard.room.fullscreen')"
          @click="toggleFullscreen"
        >
          <svg v-if="!isFullscreen" width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true"><path d="M2 6V2h4M10 2h4v4M14 10v4h-4M6 14H2v-4" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>
          <svg v-else width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true"><path d="M6 2v4H2M10 6h4V2M10 14v-4h4M6 10H2v4" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>
        </button>
        <button type="button" class="wb-header-btn wb-header-btn--exit" @click="handleExit">
          {{ t('winterboard.room.exit') }}
        </button>
      </div>
    </header>

    <!-- FIX-6: Sidebar overlay with autosave on navigation -->
    <Transition name="wb-sidebar">
      <div v-if="showSidebarOverlay" class="wb-sidebar-overlay" @click.self="showSidebarOverlay = false">
        <nav class="wb-sidebar-panel">
          <div class="wb-sidebar-panel__header">
            <div class="wb-sidebar-panel__logo">
              <svg class="wb-sidebar-panel__logo-icon" width="22" height="22" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <rect width="24" height="24" rx="6" fill="currentColor" />
                <path d="M6 17V7l4 5 4-5v10M18 7v10" stroke="#fff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
              </svg>
              <span class="wb-sidebar-panel__logo-text">M4SH</span>
            </div>
            <button type="button" class="wb-sidebar-panel__close" @click="showSidebarOverlay = false">
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M4 4l8 8M12 4l-8 8" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>
            </button>
          </div>
          <div class="wb-sidebar-panel__nav">
            <div class="wb-sidebar-panel__section">
              <ul class="wb-sidebar-panel__links">
                <li>
                  <a href="#" @click.prevent="navigateWithSave('/')">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 21v-8a1 1 0 0 0-1-1h-4a1 1 0 0 0-1 1v8"/><path d="M3 10a2 2 0 0 1 .709-1.528l7-5.999a2 2 0 0 1 2.582 0l7 5.999A2 2 0 0 1 21 10v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/></svg>
                    <span>{{ t('winterboard.sidebar.home') }}</span>
                  </a>
                </li>
              </ul>
            </div>
            <div class="wb-sidebar-panel__section">
              <span class="wb-sidebar-panel__section-label">{{ t('sidebar.section.winterboard') }}</span>
              <ul class="wb-sidebar-panel__links">
                <li>
                  <a href="#" @click.prevent="navigateWithSave('/winterboard')">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="7" height="7" x="3" y="3" rx="1"/><rect width="7" height="7" x="14" y="3" rx="1"/><rect width="7" height="7" x="14" y="14" rx="1"/><rect width="7" height="7" x="3" y="14" rx="1"/></svg>
                    <span>{{ t('winterboard.sidebar.boards') }}</span>
                  </a>
                </li>
                <li>
                  <a href="#" @click.prevent="navigateWithSave('/tutor')">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="7" height="9" x="3" y="3" rx="1"/><rect width="7" height="5" x="14" y="3" rx="1"/><rect width="7" height="9" x="14" y="12" rx="1"/><rect width="7" height="5" x="3" y="16" rx="1"/></svg>
                    <span>{{ t('winterboard.sidebar.dashboard') }}</span>
                  </a>
                </li>
              </ul>
            </div>
            <div class="wb-sidebar-panel__section">
              <span class="wb-sidebar-panel__section-label">{{ t('sidebar.section.system') }}</span>
              <ul class="wb-sidebar-panel__links">
                <li>
                  <a href="#" @click.prevent="navigateWithSave('/settings')">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"/><circle cx="12" cy="12" r="3"/></svg>
                    <span>{{ t('winterboard.sidebar.settings') }}</span>
                  </a>
                </li>
              </ul>
            </div>
          </div>
        </nav>
      </div>
    </Transition>

    <!-- ── Main content: Toolbar + Canvas ──────────────────────────────────── -->
    <div class="wb-solo-room__main">
      <!-- Left Toolbar (AGENT-B: WBToolbar) — приховано в replay-режимі -->
      <aside v-if="mode !== 'replay'" class="wb-solo-room__toolbar">
        <WBToolbar
          :current-tool="store.currentTool"
          :current-color="store.currentColor"
          :current-size="store.currentSize"
          :can-undo="store.canUndo"
          :can-redo="store.canRedo"
          :has-selection="store.hasSelection"
          :has-locked-in-selection="hasLockedInSelection"
          :can-clear-page="!isCanvasEmpty"
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

      <!-- A.2.5: Chapters sidebar в replay-режимі (Розділи уроку).
           UX FIX (2026-04-08): ховаємо панель якщо markers ще не додані —
           порожня панель "Розділів немає" плутала користувачів. -->
      <WBReplayChaptersSidebar
        v-if="mode === 'replay' && sessionId && replayMarkers.length > 0"
        :markers="replayMarkers"
        :active-marker-id="replayActiveMarkerId"
        @seek="handleMarkerSeek"
      />

      <!-- ── Page thumbnails panel (collapsible) — приховано в replay ── -->
      <aside
        v-if="mode !== 'replay'"
        class="wb-solo-room__page-panel"
        :class="{ 'wb-solo-room__page-panel--open': showPagePanel }"
        aria-label="Панель сторінок"
      >
        <WBPageThumbnails
          :pages="store.pages"
          :current-index="store.currentPageIndex"
          @select="handlePageSelect($event)"
          @add="handlePageAdd()"
          @delete="handlePageDelete($event)"
          @duplicate="handlePageDuplicate($event)"
          @reorder="(from: number, to: number) => store.reorderPages(from, to)"
        />
      </aside>

      <!-- Canvas area -->
      <div id="wb-canvas" ref="canvasContainerRef" class="wb-solo-room__canvas" :class="{ 'wb-solo-room__canvas--with-sidebar': showMaterialsSidebar, 'wb-solo-room__canvas--readonly': mode === 'replay' }" tabindex="-1" @dragover.prevent @drop="contentDrop.handleCanvasDrop($event)" @click="onCanvasContainerClick" @mouseup="onCanvasContainerMouseUp">
        <!-- A.4 (INV-X): replay = read-only overlay блокує всі pointer-події по канвасу -->
        <div v-if="mode === 'replay'" class="wb-solo-room__readonly-overlay" aria-hidden="true" />
        <!-- B6.2: Loading state -->
        <Transition name="wb-fade">
          <WBCanvasLoader v-if="isLoading" />
        </Transition>

        <WBCanvas
          v-show="!isLoading"
          ref="canvasRef"
          :tool="store.currentTool"
          :color="store.currentColor"
          :size="store.currentSize"
          :strokes="store.currentStrokes"
          :assets="store.currentAssets"
          :width="store.pageWidth"
          :height="store.pageHeight"
          :zoom="store.zoom"
          :is-tutor="true"
          @stroke-add="handleStrokeAdd"
          @stroke-update="handleStrokeUpdate"
          @stroke-delete="handleStrokeDelete"
          @asset-add="handleAssetAdd"
          @asset-update="handleAssetUpdate"
          @asset-delete="handleAssetDelete"
          @select="handleSelect"
          @cursor-move="handleCursorMove"
          @zoom-change="handleZoomChange"
          @scroll-change="handleScrollChange"
          @presentation-expand="handlePresentationExpand"
        />

        <!-- B6.3: Empty canvas hint — shown when page has no strokes/assets -->
        <Transition name="wb-fade">
          <div
            v-if="!isLoading && isCanvasEmpty"
            class="wb-empty-canvas-hint"
            aria-hidden="true"
          >
            <svg width="40" height="40" viewBox="0 0 40 40" fill="none" class="wb-empty-canvas-hint__icon">
              <path d="M8 32l6-6 4 4-2 2H8v0z" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
              <path d="M30.5 5.5a2.121 2.121 0 013 3L15 27l-4 1 1-4L30.5 5.5z" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
            </svg>
            <span class="wb-empty-canvas-hint__text">{{ t('winterboard.emptyCanvas.hint') }}</span>
          </div>
        </Transition>

        <!-- Phase 37: Test overlay (HTML over canvas, synced with zoom/pan) -->
        <WBTestOverlay
          v-if="testStore.testMode"
          :test-objects="currentTestObjects"
          :zoom="store.zoom"
          :scroll-x="store.scrollX ?? 0"
          :scroll-y="store.scrollY ?? 0"
          :mode="testStore.testPhase"
          :selected-test-id="testStore.selectedTestId"
          :grade-result="currentPageGradeResult"
          :answers="currentPageAnswers"
          :checks="currentPageChecks"
          @select-test="handleTestSelect"
          @update="handleTestObjectUpdate"
          @answer="handleTestAnswer"
          @check="handleTestCheck"
        />

        <!-- Remote cursors overlay (A3.1) -->
        <WBRemoteCursors
          :cursors="presence.remoteCursors.value"
          :zoom="store.zoom"
          :current-page-id="store.currentPage?.id ?? ''"
        />
      </div>

      <!-- Phase 3: Upload progress indicator -->
      <WBUploadIndicator
        :is-uploading="boardClipboard.isUploading.value"
        :upload-error="boardClipboard.uploadError.value"
      />

      <!-- Resize handle for right sidebar -->
      <div
        v-if="showMaterialsSidebar"
        class="wb-solo-room__resize-handle"
        :class="{ 'wb-solo-room__resize-handle--collapsed': sidebarCollapsedBefore !== null }"
        :title="sidebarCollapsedBefore !== null ? t('winterboard.room.sidebarExpand') : t('winterboard.room.sidebarCollapse')"
        @mousedown="startSidebarResize"
        @touchstart.prevent="startSidebarResizeTouch"
        @dblclick="toggleSidebarCollapse"
      >
        <div class="wb-solo-room__resize-grip" />
      </div>
      <!-- Sidebar collapse/expand tab — sits outside sidebar to avoid overflow clip -->
      <button
        v-if="showMaterialsSidebar"
        class="wb-solo-room__sidebar-toggle"
        type="button"
        :aria-label="sidebarCollapsedBefore !== null ? t('winterboard.room.sidebarExpand') : t('winterboard.room.sidebarCollapse')"
        @click="toggleSidebarCollapse"
      >
        {{ sidebarCollapsedBefore !== null ? '\u25B6' : '\u25C0' }}
      </button>

      <!-- Right sidebar — always shows materials (selection toolbar handles object actions inline) -->
      <aside
        v-if="showMaterialsSidebar"
        class="wb-solo-room__content-sidebar"
        :style="sidebarStyle"
      >
        <!-- Phase 37: Test object properties (тест-режим потребує окремої панелі) -->
        <TestObjectProperties
          v-if="testStore.testMode && selectedTestObject"
          :object="selectedTestObject"
          :is-locked="!!selectedTestObject.locked"
          @update="handleTestObjectUpdate"
          @delete="handleTestObjectDelete"
          @duplicate="handleTestObjectDuplicate"
        />
        <GroupContentSidebar
          v-show="!(testStore.testMode && selectedTestObject)"
          :group-id="groupId"
          :is-tutor="true"
          @place="placeItemAtCenter"
          @apply-template="handleApplyTemplate"
        />
      </aside>
    </div>

    <!-- ── Footer: Page nav + Zoom ─────────────────────────────────────────── -->
    <footer class="wb-solo-room__footer">
      <!-- Phase 37: Test mode controls -->
      <div v-if="testStore.testMode" class="wb-test-bar">
        <!-- Інструменти створення тестових об'єктів (тільки в edit фазі) -->
        <div v-if="testStore.testPhase === 'edit'" class="wb-test-bar__tools">
          <button
            v-for="tool in TEST_TOOLS"
            :key="tool.type"
            type="button"
            class="wb-test-bar__btn"
            :class="{ 'wb-test-bar__btn--active': testStore.activeTestTool === tool.type }"
            :title="t(tool.labelKey)"
            @click="handleTestToolSelect(tool.type)"
          >
            {{ tool.icon }} {{ t(tool.labelKey) }}
          </button>
        </div>
        <div v-if="testStore.testPhase === 'edit'" class="wb-test-bar__sep"></div>

        <!-- 3-фазні кнопки переходу -->
        <div class="wb-test-bar__phases">
          <!-- Edit фаза → кнопка "Запустити тест" -->
          <button
            v-if="testStore.testPhase === 'edit'"
            type="button"
            class="wb-test-bar__btn wb-test-bar__btn--launch"
            :disabled="currentTestObjects.length === 0"
            @click="testStore.setTestPhase('live')"
          >
            ▶ {{ t('winterboard.test.launchTest') }}
          </button>

          <!-- Live фаза → кнопки "Здати" та "Назад до редагування" -->
          <template v-if="testStore.testPhase === 'live'">
            <span class="wb-test-bar__phase-label wb-test-bar__phase-label--live">
              🟢 {{ t('winterboard.test.livePhase') }}
            </span>
            <button
              type="button"
              class="wb-test-bar__btn wb-test-bar__btn--grade"
              @click="handleGradeTest"
            >
              ✅ {{ t('winterboard.test.submitGrade') }}
            </button>
            <button
              type="button"
              class="wb-test-bar__btn"
              @click="testStore.setTestPhase('edit')"
            >
              ✏️ {{ t('winterboard.test.backToEdit') }}
            </button>
          </template>

          <!-- Review фаза → кнопки "Повторити" та "Назад до редагування" -->
          <template v-if="testStore.testPhase === 'review'">
            <span class="wb-test-bar__phase-label wb-test-bar__phase-label--review">
              📊 {{ t('winterboard.test.reviewPhase') }}
            </span>
            <button
              type="button"
              class="wb-test-bar__btn wb-test-bar__btn--launch"
              @click="handleRetryTest"
            >
              🔄 {{ t('winterboard.test.retryTest') }}
            </button>
            <button
              type="button"
              class="wb-test-bar__btn"
              @click="testStore.setTestPhase('edit')"
            >
              ✏️ {{ t('winterboard.test.backToEdit') }}
            </button>
          </template>
        </div>

        <div class="wb-test-bar__sep"></div>
        <button type="button" class="wb-test-bar__btn wb-test-bar__btn--exit" @click="testStore.toggleTestMode()">
          {{ t('winterboard.test.exitTest') }}
        </button>
      </div>

      <!-- Page navigation -->
      <div class="wb-page-nav">
        <!-- Phase 37: Test mode toggle button -->
        <button
          type="button"
          class="wb-page-btn"
          :class="{ 'wb-page-btn--active': testStore.testMode }"
          :title="t('winterboard.test.testMode')"
          @click="testStore.toggleTestMode()"
        >
          📝
        </button>
        <div class="wb-page-nav__sep"></div>
        <!-- Grid toggle button -->
        <WBGridButton
          :model-value="gridOverlay.gridType.value"
          :is-grid-active="gridOverlay.isGridActive.value"
          @update:model-value="gridOverlay.setGrid"
        />
        <!-- Phase 35 B5: Grid size dropdown (visible when grid active) -->
        <select
          v-if="gridOverlay.isGridActive.value"
          class="wb-grid-size-select"
          :value="store.gridSize ?? 20"
          @change="onGridSizeChange"
        >
          <option :value="10">10px</option>
          <option :value="20">20px</option>
          <option :value="40">40px</option>
          <option :value="50">50px</option>
          <option :value="100">100px</option>
        </select>
        <!-- Phase 35 B6: Background color picker -->
        <div class="wb-bg-color">
          <label class="wb-bg-color__label">BG</label>
          <input
            type="color"
            class="wb-bg-color__input"
            :value="store.currentPageBgColor"
            @input="onBgColorChange"
            @change="onBgColorChange"
          />
        </div>
        <div class="wb-page-nav__sep"></div>
        <!-- Toggle панелі мініатюр -->
        <button
          type="button"
          class="wb-page-btn wb-page-btn--panel"
          :class="{ 'wb-page-btn--panel-active': showPagePanel }"
          :title="showPagePanel ? t('winterboard.room.hidePagePanel') : t('winterboard.room.showPagePanel')"
          :aria-pressed="showPagePanel"
          @click="showPagePanel = !showPagePanel"
        >
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
            <rect x="1" y="1" width="12" height="3.5" rx="1" fill="currentColor"/>
            <rect x="1" y="5.25" width="12" height="3.5" rx="1" fill="currentColor"/>
            <rect x="1" y="9.5" width="12" height="3.5" rx="1" fill="currentColor"/>
          </svg>
        </button>
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
          type="button"
          class="wb-page-btn wb-page-btn--add"
          :disabled="store.pageCount >= 50"
          :title="t('winterboard.room.addPage')"
          @click="handlePageAdd"
        >
          +
        </button>
      </div>

      <!-- Zoom controls -->
      <div class="wb-zoom-controls">
        <button type="button" class="wb-zoom-btn" :title="t('winterboard.room.zoomOut')" @click="handleZoomOut">−</button>
        <span class="wb-zoom-level">{{ Math.round(store.zoom * 100) }}%</span>
        <button type="button" class="wb-zoom-btn" :title="t('winterboard.room.zoomIn')" @click="handleZoomIn">+</button>
        <button type="button" class="wb-zoom-btn" :title="t('winterboard.room.zoomReset')" @click="handleZoomReset">⊙</button>
        <button type="button" class="wb-zoom-btn" :title="t('winterboard.room.fitToPage')" @click="handleFitToPage">⧉</button>
      </div>
    </footer>

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

    <!-- Phase 13 A3.3: Publish dialog (Knowledge domain) -->
    <WBShareDialog
      v-if="showPublishDialog && sessionId"
      :session-id="sessionId"
      :is-open="showPublishDialog"
      mode="publish"
      @close="showPublishDialog = false"
      @published="handlePublished"
    />

    <!-- Phase 14 B2.2: Save as template dialog -->
    <SaveAsTemplateDialog
      v-if="publishedLessonData"
      v-model="showSaveTemplateDialog"
      :lesson-id="publishedLessonData.id"
      :lesson-title="publishedLessonData.title"
      :subject-tag="publishedLessonData.subject_tag || ''"
      :thumbnail-url="null"
      @saved="handleTemplateSaved"
    />

    <!-- Phase 21: Save as Lesson dialog -->
    <WBSaveLessonDialog
      v-if="sessionId"
      v-model="showSaveLessonDialog"
      :session-id="sessionId"
      :default-title="sessionName"
      @saved="handleLessonSaved"
    />

    <!-- Phase 37: Test grade results modal -->
    <WBTestGradeModal
      v-if="showGradeModal && currentGradeResult"
      :result="currentGradeResult"
      :test-objects="currentTestObjects"
      @close="showGradeModal = false"
    />

    <!-- Board template selector (shown for new sessions) -->
    <BoardTemplateSelector
      :is-open="showTemplateSelector"
      @close="showTemplateSelector = false"
      @apply="applyTemplate"
    />

    <!-- Export dialog -->
    <WBExportDialog
      v-if="showExportDialog && sessionId"
      :session-id="sessionId"
      :is-open="showExportDialog"
      @close="showExportDialog = false"
    />

    <!-- Drag ghost preview — follows cursor while dragging from sidebar -->
    <WBDragGhost />

    <!-- A10: Touch context menu — shown on long-press when objects are selected -->
    <WBTouchContextMenu
      :visible="touchCtxVisible"
      :x="touchCtxX"
      :y="touchCtxY"
      @close="touchCtxVisible = false"
    />

    <!-- P2: Selection toolbar — floating actions for selected objects (desktop only) -->
    <WBSelectionToolbar
      :selected-ids="store.selectedIds"
      :zoom="store.zoom"
      :canvas-rect="selectionCanvasRect"
      :mode="mode"
      :is-locked="hasLockedInSelection"
      :bbox="selectionBBox"
      :selected-object="selectedObjectForToolbar"
      :session-id="sessionId ?? ''"
      :is-tutor="isSessionOwner"
      @bring-to-front="store.bringToFront(store.selectedIds[0])"
      @send-to-back="store.sendToBack(store.selectedIds[0])"
      @duplicate="store.copySelectedToClipboard(); store.pasteFromClipboard()"
      @lock="locking.lockSelected()"
      @unlock="locking.unlockSelected()"
      @delete="handleDeleteSelected()"
      @text-format="handleTextFormat"
      @audio-uploaded="handleAudioUploaded"
      @audio-deleted="handleAudioDeleted"
    />

    <!-- Phase 11: Replay mode banner -->
    <WBReplayBanner
      v-if="mode === 'replay'"
      @exit="exitReplayMode"
    />

    <!-- A12p2: Replay mode controls -->
    <WBReplayControls
      v-if="mode === 'replay' && sessionId"
      ref="replayControlsRef"
      :session-id="sessionId"
      :load-state="(s) => store.loadSnapshot(s as Parameters<typeof store.loadSnapshot>[0])"
      :clear-state="() => { store.resetForReplay(); replayApplier.reset() }"
      :comment-points="commentPoints"
      @exit="exitReplayMode"
      @operation="onReplayOperation"
      @start-state="onReplayStartState"
      @tick="onReplayTick"
    />

    <!-- Phase C: Replay comments sidebar -->
    <WBReplayCommentsSidebar
      v-if="mode === 'replay' && sessionId"
      class="wb-solo-room__comments-sidebar"
      :comments="replayCommentsList"
      :current-op-index="replayCurrentOpIndex"
      :can-comment="!!authStore.user"
      :current-user-id="authStore.user?.id ?? null"
      :session-owner-id="(store.ownerId as number | null) ?? null"
      :submitting="commentSubmitting"
      @jump="onCommentJump"
      @delete="onCommentDelete"
      @submit="onCommentSubmit"
    />

    <!-- A.2.1: Lesson Map sidebar removed in replay mode (markers will move to timeline as chapters) -->

    <!-- P5: Marker create modal -->
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

    <!-- Replay entry: CTA + stats or empty state hint -->
    <div v-if="mode === 'edit' && sessionId" class="wb-solo-room__replay-entry">
      <button
        v-if="hasOperations"
        class="wb-solo-room__replay-btn"
        data-testid="replay-button"
        :aria-label="t('winterboard.replay.viewReplay')"
        @click="enterReplayMode"
      >
        &#9654; {{ isManualRecording ? t('winterboard.replay.viewRecording') : t('winterboard.replay.viewReplay') }}
      </button>
      <span v-if="hasOperations" class="wb-solo-room__replay-stats">
        {{ store.pages.length }} {{ t('winterboard.replay.statPages') }}
      </span>
      <span v-if="!hasOperations && !isManualRecording" class="wb-solo-room__replay-hint">
        {{ t('winterboard.replay.emptyHint') }}
      </span>
    </div>

    <!-- Recording done prompt — teaches user about sharing -->
    <div v-if="showRecordingDonePrompt" class="wb-solo-room__recording-done">
      <span>{{ t('winterboard.replay.recordingDone') }}</span>
      <button class="wb-solo-room__recording-done-share" @click="showShareModal = true; showRecordingDonePrompt = false">
        {{ t('winterboard.replay.shareWithStudent') }}
      </button>
      <button class="wb-solo-room__recording-done-later" @click="showRecordingDonePrompt = false">
        {{ t('winterboard.replay.later') }}
      </button>
    </div>

    <!-- Phase B: Share replay modal — owner only -->
    <WBReplayShareModal
      v-if="sessionId"
      :visible="showShareModal"
      :session-id="sessionId"
      :initial-visibility="'private'"
      :initial-token="null"
      @close="showShareModal = false"
    />

    <!-- Phase 34 B7: Multi-delete confirmation dialog -->
    <Teleport to="body">
      <div v-if="showDeleteConfirm" class="wb-confirm-overlay" @click.self="showDeleteConfirm = false">
        <div class="wb-confirm-dialog">
          <p class="wb-confirm-dialog__title">Delete {{ store.selectedIds.length }} items?</p>
          <p class="wb-confirm-dialog__hint">This action can be undone with Ctrl+Z.</p>
          <div class="wb-confirm-dialog__actions">
            <button
              type="button"
              class="wb-confirm-dialog__btn wb-confirm-dialog__btn--cancel"
              @click="showDeleteConfirm = false"
            >
              Cancel
            </button>
            <button
              type="button"
              class="wb-confirm-dialog__btn wb-confirm-dialog__btn--delete"
              @click="performDelete"
            >
              Delete
            </button>
          </div>
        </div>
      </div>
    </Teleport>
  </div>
</template>

<script setup lang="ts">
// WB: WBSoloRoom — main solo whiteboard view
// Ref: TASK_BOARD.md A2.1, ManifestWinterboard_v2.md LAW-01/03/08/09

import { ref, computed, onMounted, onBeforeUnmount, watch, nextTick } from 'vue'
import { useRouter, useRoute, onBeforeRouteLeave } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { useWBStore } from '../board/state/boardStore'
import { useHistory } from '../composables/useHistory'
import { useKeyboard } from '../composables/useKeyboard'
import { useBoardClipboard } from '../composables/useBoardClipboard'
import { useAutosave } from '../composables/useAutosave'
import { useOpsBridge } from '../composables/useOpsBridge'
import { usePresence } from '../composables/usePresence'
import { useFollowMode } from '../composables/useFollowMode'
import { useLocking } from '../composables/useLocking'
import { useAnnouncer } from '../composables/useAnnouncer'
import { useContentDrop } from '../composables/useContentDrop'
import { winterboardApi } from '../api/winterboardApi'
import { useAuthStore } from '@/modules/auth/store/authStore'
import { groupApi as learningGroupApi } from '@/modules/groups/api/groupApi'
import type { WBStroke, WBAsset, WBToolType } from '../types/winterboard'

// Components
import WBCanvas from '../components/canvas/WBCanvas.vue'
import WBToolbar from '../components/toolbar/WBToolbar.vue'
import WBRemoteCursors from '../components/cursors/WBRemoteCursors.vue'
import WBCanvasLoader from '../components/loading/WBCanvasLoader.vue'
import WBUploadIndicator from '../components/status/WBUploadIndicator.vue'
import WBShareDialog from '../components/sharing/WBShareDialog.vue'
import WBYouTubeModal from '../components/toolbar/WBYouTubeModal.vue'
import WBExportDialog from '../components/export/WBExportDialog.vue'
import GroupContentSidebar from '../components/sidebar/GroupContentSidebar.vue'
// PropertiesPanel removed — selection toolbar handles all object actions inline
import WBPageThumbnails from '../components/pages/WBPageThumbnails.vue'
import WBDragGhost from '../components/sidebar/WBDragGhost.vue'
import type { AllowedContentItem } from '../types/sidebar'
import BoardTemplateSelector from '../components/templates/BoardTemplateSelector.vue'
import { BOARD_TEMPLATES } from '../data/boardTemplates'
import WBGridButton from '../components/canvas/WBGridButton.vue'
import WBTouchContextMenu from '../components/canvas/WBTouchContextMenu.vue'
import WBSelectionToolbar from '../components/canvas/WBSelectionToolbar.vue'
import WBReplayControls from '../components/replay/WBReplayControls.vue'
import WBReplayShareModal from '../components/replay/WBReplayShareModal.vue'
import WBReplayCommentsSidebar from '../components/replay/WBReplayCommentsSidebar.vue'
import { useReplayComments } from '../composables/useReplayComments'
import WBMarkerCreateModal from '../components/replay/WBMarkerCreateModal.vue'
import WBReplayBanner from '../components/replay/WBReplayBanner.vue'
import WBRecordingBanner from '../components/replay/WBRecordingBanner.vue'
import WBReplayChaptersSidebar from '../components/replay/WBReplayChaptersSidebar.vue'
import SaveAsTemplateDialog from '@/modules/knowledge/components/SaveAsTemplateDialog.vue'
import WBSaveLessonDialog from '@/modules/knowledge/components/WBSaveLessonDialog.vue'
import WBOnboardingHints from '../components/ui/WBOnboardingHints.vue'
import type { BoardOperation } from '../types/replay'
import type { WBLessonMarker } from '../types/winterboard'
import { createLessonMarker, deleteLessonMarker } from '../api/replay'
import { createReplayApplier } from '../engine/applyReplayOperation'
import { useGridOverlay } from '../composables/useGridOverlay'
import { useReplayRecorder } from '../composables/useReplayRecorder'
import { useCanvasResize } from '../composables/useCanvasResize'
import { useTouchGestures } from '../components/gestures/useTouchGestures'
import { useDeviceMode } from '../composables/useDeviceMode'

// Phase 37: Test system
import { useTestStore } from '../board/state/testStore'
import WBTestOverlay from '../components/test/WBTestOverlay.vue'
import WBTestGradeModal from '../components/test/WBTestGradeModal.vue'
import TestObjectProperties from '../components/sidebar/properties/TestObjectProperties.vue'
import type { WBTestObject, WBTestInput, WBTestRadio, WBTestCheckbox, WBTestDropdown, WBTestGapFill, WBTestMatching } from '../types/winterboard'
import type { GradeResult } from '../utils/testGrading'

// ─── Store & Composables ────────────────────────────────────────────────────

const router = useRouter()
const route = useRoute()
const store = useWBStore()
const testStore = useTestStore()

// Responsive Phase 1 B2: Device mode detection for layout data-attributes
const deviceModeState = useDeviceMode()
const { t } = useI18n()
const { announce } = useAnnouncer()

const history = useHistory({ maxSize: 100 })
const locking = useLocking(store)

// Session ID ref for autosave + presence
const sessionId = ref<string | null>(null)

// Autosave (AGENT-C: C2.1)
const autosave = useAutosave(sessionId)

// Phase 4a: Bridge — boardStore operations → diff ops → autosave.queueDiffOp
const opsBridge = useOpsBridge(autosave)

// A.1: Manual Recording Control
// Ops ЗАВЖДИ записуються (append-only log) — кнопка start/stop тільки встановлює
// recording_started_seq / recording_stopped_seq boundaries для replay.
// Recorder працює коли mode === 'edit' (зупиняється при replay).
// Phase B: Share modal
const showShareModal = ref(false)

const isManualRecording = ref(false)
const recordingStartedAt = ref<string | null>(null)
const isReplayFrozen = ref(false)
const isRecordingLoading = ref(false)
const showRecordingDonePrompt = ref(false)
let _recordingDoneTimer: number | null = null

// Recorder enabled = edit mode (ЗАВЖДИ записує ops, не залежить від isManualRecording)
const isRecorderEnabled = computed(() => store.mode === 'edit')
const replayRecorder = useReplayRecorder({
  sessionId,
  getBoardState: () => store.getSnapshotState(),
  enabled: isRecorderEnabled,
})
// Phase 20: connectToStore moved to onMounted (after hydrateFromSession)
// to prevent stale listeners from previous session
let _unsubRecorder: (() => void) | null = null

// Lifecycle: idempotent cleanup for both route-leave and unmount
let _recorderCleaned = false
function cleanupRecorder(): void {
  if (_recorderCleaned) return
  _recorderCleaned = true
  _unsubRecorder?.()
  replayRecorder.destroy()
}

async function handleStartRecording(): Promise<void> {
  const sid = sessionId.value
  if (!sid || isManualRecording.value || isReplayFrozen.value) return
  isRecordingLoading.value = true
  try {
    // INV-T fix: flush pending autosave щоб session.state на backend містив актуальний
    // board state (фон/асети/страйки) ДО того як backend зробить deepcopy у recording_start_state.
    try { await autosave.saveNow() } catch (e) { console.warn('[WBSoloRoom] saveNow before start-recording failed', e) }
    const result = await import('../api/replay').then(m => m.startRecording(sid))
    isManualRecording.value = true
    recordingStartedAt.value = result.recording_started_at
    isReplayFrozen.value = false

    // GUARD: Pipeline health check — verify recorder is alive.
    // After 5s, check if any ops reached the buffer. If not, the pipeline is broken.
    setTimeout(() => {
      if (isManualRecording.value && replayRecorder.opCount.value === 0) {
        console.error(
          '[WB:PIPELINE] Recording started but 0 ops recorded after 5s! ' +
          `store.mode=${store.mode} sessionId=${sessionId.value} enabled=${isRecorderEnabled.value}`,
        )
      }
    }, 5000)
  } catch (e) {
    console.error('[WBSoloRoom] Failed to start recording:', e)
  } finally {
    isRecordingLoading.value = false
  }
}

async function handleStopRecording(): Promise<void> {
  const sid = sessionId.value
  if (!sid || !isManualRecording.value) return
  isRecordingLoading.value = true
  try {
    const result = await import('../api/replay').then(m => m.stopRecording(sid))
    isManualRecording.value = false
    recordingStartedAt.value = null
    isReplayFrozen.value = result.is_replay_frozen

    // Show "Recording done" prompt — teach user about sharing
    showRecordingDonePrompt.value = true
    _recordingDoneTimer = window.setTimeout(() => { showRecordingDonePrompt.value = false }, 15000)
  } catch (e) {
    console.error('[WBSoloRoom] Failed to stop recording:', e)
  } finally {
    isRecordingLoading.value = false
  }
}

// Grid overlay (background grid for the canvas)
const gridOverlay = useGridOverlay(sessionId.value ?? 'default')

// Presence / remote cursors (A3.2)
const authStore = useAuthStore()
const presence = usePresence({
  sessionId,
  userId: String(authStore.user?.id ?? ''),
  displayName: authStore.user?.first_name || authStore.user?.email || 'Anonymous',
  color: '#2563eb',
  token: authStore.access && authStore.access !== '__cookie__' ? authStore.access : undefined,
})

// A5.1: Follow mode composable
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
    // Apply scroll to canvas container
    if (canvasContainerRef.value) {
      canvasContainerRef.value.scrollLeft = x
      canvasContainerRef.value.scrollTop = y
    }
  },
  goToPage: (index: number) => store.goToPage(index),
})

// A5.2: Send viewport updates when scroll/zoom changes
watch(
  () => [store.scrollX, store.scrollY, store.zoom, store.currentPageIndex],
  () => {
    if (!sessionId.value) return
    const pageId = store.currentPage?.id ?? ''
    presence.sendViewport(store.scrollX, store.scrollY, store.zoom, pageId)
  },
)

// ─── Refs ───────────────────────────────────────────────────────────────────────

const canvasRef = ref<InstanceType<typeof WBCanvas> | null>(null)
const canvasContainerRef = ref<HTMLElement | null>(null)
const sessionName = ref('Untitled')
const selectedId = ref<string | null>(null)
const isLoading = ref(true)
const showShareDialog = ref(false)
const showPublishDialog = ref(false)
const showSaveTemplateDialog = ref(false)
const publishedLessonData = ref<{ id: string; title: string; subject_tag?: string } | null>(null)
const showExportDialog = ref(false)
const showSaveLessonDialog = ref(false)
const showYouTubeModal = ref(false)
const showMarkerModal = ref(false)
const replayMarkers = ref<WBLessonMarker[]>([])
const replayActiveMarkerId = ref<string | null>(null)
const isSessionOwner = computed(() => {
  if (!store.ownerId || !authStore.user) return false
  return String(store.ownerId) === String(authStore.user.id)
})

// Phase C: Replay comments
const _commentsInstance = ref<ReturnType<typeof useReplayComments> | null>(null)
const replayCommentsList = computed(() => _commentsInstance.value?.comments.value || [])
const replayCurrentOpIndex = ref(0)
const replayCurrentTotalOps = ref(0)
const commentSubmitting = ref(false)
const replayControlsRef = ref<InstanceType<typeof WBReplayControls> | null>(null)

const commentPoints = computed(() => {
  const total = Math.max(1, replayCurrentTotalOps.value)
  return replayCommentsList.value.map((c) => ({
    id: c.id,
    operation_index: c.operation_index,
    percent: Math.max(0, Math.min(100, (c.operation_index / total) * 100)),
    text: c.text,
  }))
})

async function loadReplayComments(): Promise<void> {
  if (!sessionId.value) return
  _commentsInstance.value = useReplayComments(sessionId.value)
  await _commentsInstance.value.load()
}
async function onCommentSubmit(text: string): Promise<void> {
  if (!_commentsInstance.value) return
  commentSubmitting.value = true
  try {
    await _commentsInstance.value.add(replayCurrentOpIndex.value, text)
  } finally {
    commentSubmitting.value = false
  }
}
async function onCommentDelete(c: { id: string }): Promise<void> {
  if (!_commentsInstance.value) return
  await _commentsInstance.value.remove(c.id)
}
function onCommentJump(c: { operation_index: number }): void {
  replayControlsRef.value?.jumpTo(c.operation_index)
}

const showTemplateSelector = ref(false)
const showSidebarOverlay = ref(false)
const isFullscreen = ref(false)

async function toggleFullscreen() {
  try {
    if (!document.fullscreenElement) {
      await document.documentElement.requestFullscreen()
      isFullscreen.value = true
    } else {
      await document.exitFullscreen()
      isFullscreen.value = false
    }
  } catch { /* Fullscreen not supported or denied */ }
}

// Listen for fullscreen changes (Esc key exits fullscreen)
onMounted(() => {
  document.addEventListener('fullscreenchange', () => {
    isFullscreen.value = !!document.fullscreenElement
  })
})

// ── Responsive canvas resize: auto-fit zoom when container changes size ──
const { width: canvasContainerWidth, height: canvasContainerHeight, recalculate: recalculateCanvas } = useCanvasResize({
  containerRef: canvasContainerRef,
  onResize(w, h) {
    // Auto-fit: if current zoom makes stage larger than container, adjust zoom down
    if (w > 0 && h > 0 && store.pageWidth > 0 && store.pageHeight > 0) {
      const maxZoomX = w / store.pageWidth
      const maxZoomY = h / store.pageHeight
      const fitZoom = Math.min(maxZoomX, maxZoomY, 1) // Don't zoom above 1 on auto-fit
      if (store.zoom > fitZoom + 0.01) {
        store.setZoom(fitZoom)
      }
    }
  },
  debounceMs: 100,
})

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

// ── Touch gestures: pinch-zoom, 2-finger pan, 3-finger undo/redo, double-tap, edge swipe ──
const touchGestureMode = computed<'drawing' | 'selection'>(() =>
  store.currentTool === 'select' ? 'selection' : 'drawing',
)

// A12p2: Replay mode — synced to URL query for shareable links
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

// Зберігаємо стан дошки перед входом в replay — відновлюємо при виході
let _savedBoardState: ReturnType<typeof store.getSnapshotState> | null = null

// REPLAY-FIX-4: Sync store.mode with route query on navigation.
// enterReplayMode() only runs on button click. For page reload with ?mode=replay
// or route navigation, this watcher ensures store.mode is synced.
// NOTE: resetForReplay() is NOT called here — it runs in onMounted after hydrateFromSession
// to avoid the hydration race (hydrate overwrites the reset).
watch(mode, (newMode, oldMode) => {
  // Skip initial — handled in onMounted after hydration
  if (oldMode === undefined) return
  if (newMode === 'replay' && store.mode !== 'replay') {
    if (!_savedBoardState) {
      _savedBoardState = store.getSnapshotState()
    }
    store.setMode('replay')
    store.resetForReplay()
    replayCurrentOpIndex.value = 0
    replayCurrentTotalOps.value = 0
    void loadReplayComments()
  } else if (newMode === 'edit' && store.mode !== 'edit') {
    store.setMode('edit')
  }
})

function enterReplayMode(): void {
  if (!_savedBoardState) {
    _savedBoardState = store.getSnapshotState()  // snapshot поточного стану (guard: no overwrite)
  }
  store.setMode('replay')    // REPLAY-INV-9: _emitOperation стає NO-OP
  store.resetForReplay()     // чистий стан — replay накладає ops з нуля (REPLAY-INV-11)
  replayApplier.reset()      // P0: clean instance page-tracking state
  replayCurrentOpIndex.value = 0   // reset stale replay position
  replayCurrentTotalOps.value = 0
  mode.value = 'replay'      // URL sync
  void loadReplayComments()
}

function exitReplayMode(): void {
  store.setMode('edit')      // REPLAY-INV-9: відновлюємо emitter
  if (_savedBoardState) {
    store.loadSnapshot(_savedBoardState)  // відновлюємо стан до replay
    _savedBoardState = null
  }
  replayCurrentOpIndex.value = 0   // cleanup stale replay state
  replayCurrentTotalOps.value = 0
  mode.value = 'edit'        // URL sync
}

// Phase 10 P5: Lesson Map marker handlers
function handleMarkerSeek(marker: WBLessonMarker): void {
  // Marker seek: navigate to page + scroll to board position
  if (marker.page_id) {
    const pageIdx = store.pages.findIndex(p => p.id === marker.page_id)
    if (pageIdx >= 0) store.goToPage(pageIdx)
  }
  if (marker.board_position?.x !== undefined) {
    store.setScroll(marker.board_position.x, marker.board_position.y)
  }
}

async function handleMarkerCreate(data: { title: string; category: string }): Promise<void> {
  if (!sessionId.value) return
  await createLessonMarker(sessionId.value, {
    title: data.title,
    operation_index: 0,
    page_id: store.currentPage?.id ?? '',
    board_position: { x: store.scrollX, y: store.scrollY },
    thumbnail_url: '',
    category: data.category as WBLessonMarker['category'],
    order: 0,
  })
}

async function handleMarkerCreateFromModal(data: { title: string; category: string }): Promise<void> {
  showMarkerModal.value = false
  await handleMarkerCreate(data)
}

async function handleMarkerDelete(id: string): Promise<void> {
  replayMarkers.value = replayMarkers.value.filter(m => m.id !== id)
  if (sessionId.value) {
    deleteLessonMarker(sessionId.value, id).catch(() => {})
  }
}

// P0 FIX: Instance-scoped replay applier — no global state leak between sessions.
const replayApplier = createReplayApplier()

// INV-T: hydrate з recording_start_state ПЕРЕД накаткою ops.
// Це повертає фон/асети/страйки які існували до натискання Start Recording.
function onReplayStartState(state: { pages?: unknown[]; currentPageIndex?: number }): void {
  if (state && Array.isArray(state.pages) && state.pages.length > 0) {
    store.loadSnapshot(state as Parameters<typeof store.loadSnapshot>[0])
    // INV-T: replay завжди починає з першої сторінки, незалежно від currentPageIndex snapshot
    store.goToPage(0)
    const ids = (state.pages as Array<{ id?: string }>).map(p => p?.id ?? '').filter(Boolean)
    replayApplier.markPagesEnsured(ids)
  }
}

// Phase C: tick handler — named function to avoid Vue template ref unwrapping.
// Inline `@tick="({ index, total }) => { ref.value = x }"` breaks because
// Vue templates auto-unwrap refs, turning ref(0) into plain `0`.
function onReplayTick({ index, total }: { index: number; total: number }): void {
  replayCurrentOpIndex.value = index
  replayCurrentTotalOps.value = total
}

// R5: Instance-scoped replay operation applier (DRY)
function onReplayOperation(op: BoardOperation): void {
  replayApplier.apply(store, op)
  // REPLAY-FIX-6: Force Konva redraw after replay operations.
  // Vue-Konva may not auto-trigger batchDraw when store changes via Pinia.
  if (['stroke_add', 'stroke_update', 'stroke_delete', 'asset_add', 'asset_update', 'asset_delete', 'clear_page', 'page_navigate', 'page_change'].includes(op.op_type)) {
    nextTick(() => {
      const stage = canvasRef.value?.getStage?.()
      if (stage) stage.batchDraw()
    })
  }
}

// A10: Touch context menu state
const touchCtxVisible = ref(false)
const touchCtxX = ref(0)
const touchCtxY = ref(0)

const touchGestures = useTouchGestures(canvasContainerRef, {
  onPan(dx, dy) {
    store.setScroll(store.scrollX + dx, store.scrollY + dy)
    followMode.onUserInteraction()
  },
  onPanEnd() {
    // Inertia finished — no action needed
  },
  onZoom(zoom, _centerX, _centerY) {
    store.setZoom(zoom)
    followMode.onUserInteraction()
  },
  onUndo() {
    handleUndo()
  },
  onRedo() {
    handleRedo()
  },
  onDoubleTap(_x, _y) {
    // Double-tap: toggle between fit-to-page and 1x zoom
    if (store.zoom < 0.95 || store.zoom > 1.05) {
      store.setZoom(1)
    } else {
      canvasRef.value?.fitToPage?.()
    }
    followMode.onUserInteraction()
  },
  onLongPress(_x, _y) {
    // Long press: switch to select tool for touch users
    if (store.currentTool !== 'select') {
      store.setTool('select')
    }
  },
  // A10: Object-aware long press — show touch context menu
  onObjectLongPress(x, y) {
    touchCtxX.value = x
    touchCtxY.value = y
    touchCtxVisible.value = true
  },
  // A10: 2-finger pinch on selected object → resize
  onObjectPinch(scaleDelta) {
    const id = store.selectedIds[0]
    if (id) store.resizeSelectedObject(id, scaleDelta, scaleDelta)
  },
  // A10: 2-finger rotation on selected object → rotate
  onObjectRotate(angleDelta) {
    const id = store.selectedIds[0]
    if (id) store.rotateSelectedObject(id, angleDelta)
  },
  onEdgeSwipeLeft() {
    // Edge swipe from left: toggle page thumbnails panel
    showPagePanel.value = !showPagePanel.value
  },
  onEdgeSwipeRight() {
    // Edge swipe from right: toggle materials sidebar (if available)
    // Sidebar visibility is driven by groupId — no toggle action here
  },
}, {
  mode: touchGestureMode,
  currentZoom: computed(() => store.zoom),
  // A10: Route 2-finger pinch to object mode when selection is active
  hasSelection: () => store.selectedIds.length > 0,
})

// Attach touch gestures after mount
onMounted(() => {
  touchGestures.attach()
})

// ── Page thumbnails panel: два режими (compact / panel), стан у localStorage ──
function _loadPagePanel(): boolean {
  try { return localStorage.getItem('wb:pagePanel') === 'true' } catch { return false }
}
const showPagePanel = ref(_loadPagePanel())
watch(showPagePanel, (v) => { try { localStorage.setItem('wb:pagePanel', String(v)) } catch { /* Safari private */ } })

// ── Group sidebar: materials panel ──
// groupId: explicit ?groupId= from URL → group materials; null → tutor's Library files
const explicitGroupId = computed(() => {
  const qg = route.query.groupId
  return typeof qg === 'string' ? qg : null
})

// Phase 16 INT-33: Session context label — shows student/lesson name from URL query
const sessionContextLabel = computed<string | null>(() => {
  const student = typeof route.query.studentName === 'string' ? route.query.studentName.trim() : ''
  const lesson = typeof route.query.lessonName === 'string' ? route.query.lessonName.trim() : ''
  if (student && lesson) return `${student} · ${lesson}`
  if (student) return student
  if (lesson) return lesson
  return null
})
const autoGroupId = ref<string | null>(null)
const groupId = computed(() => explicitGroupId.value || autoGroupId.value)
const showMaterialsSidebar = computed(() => mode.value !== 'replay' && _showMaterialsSidebar.value)
const _showMaterialsSidebar = ref(true)

async function detectTutorGroup() {
  if (explicitGroupId.value) return
  try {
    const groups = await learningGroupApi.listGroups()
    if (groups && groups.length > 0) {
      // Prefer IMPLICIT group (auto-created per student), fallback to first group
      const implicit = groups.find((g) => g.group_type === 'IMPLICIT')
      autoGroupId.value = String((implicit || groups[0]).id)
    }
  } catch (e) {
    console.warn('[WBSoloRoom] Could not auto-detect tutor group:', e)
  }
}

// ── Content drop: D&D from sidebar onto canvas ──
const contentDrop = useContentDrop({
  sessionId,
  canDraw: computed(() => true),
  onAssetAdd: (asset: WBAsset) => {
    store.addAsset(asset)
  },
  screenToCanvas: (x: number, y: number) => {
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

// ── Quick Gallery: dblclick places item at canvas center ──
async function placeItemAtCenter(item: AllowedContentItem) {
  const center = contentDrop.handleSidebarDrop(
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
  await center
}

// ── Phase 34 B7: Multi-delete confirm dialog ──
const showDeleteConfirm = ref(false)

function handleMultiDeleteConfirm() {
  const count = store.selectedIds.length
  if (count > 3) {
    showDeleteConfirm.value = true
  } else {
    performDelete()
  }
}

function performDelete() {
  showDeleteConfirm.value = false
  const unlocked = store.selectedIds.filter(id => !store.isItemLocked(id))
  if (unlocked.length > 0) {
    store.selectItems(unlocked)
    store.deleteSelected()
    store.removeItemsFromGroups(unlocked)
  }
  store.clearSelection()
}

// ── Phase 34 B6: Handle template application from sidebar ──
function handleApplyTemplate(templateId: string) {
  // Phase 34 A4: Check object limit before applying template
  if (!store.canAddObject) {
    console.warn('[WB] Cannot add template: object limit reached (300)')
    return
  }
  applyTemplate(templateId)
}

// ── Board Templates: apply pre-built layout ──
function applyTemplate(templateId: string) {
  const tmpl = BOARD_TEMPLATES.find(t => t.id === templateId)
  if (!tmpl) return

  // Phase 34 fix: generator-based templates (coordinate_plane, number_line, table)
  if (tmpl.generator) {
    const strokes = tmpl.generator()
    for (const stroke of strokes) {
      store.addStroke(stroke)
    }
    return
  }

  // Asset-based templates (blank, two_columns, grid_2x2, timeline)
  if (!tmpl.assets || tmpl.assets.length === 0) return
  for (const assetData of tmpl.assets) {
    const asset: WBAsset = {
      ...assetData,
      id: `tmpl-${templateId}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    }
    store.addAsset(asset)
  }
}

// ── Resizable sidebar ──
const SIDEBAR_MIN = 240
const SIDEBAR_MAX = 800
const SIDEBAR_DEFAULT = 320
/** Snap points (px): sidebar snaps to these widths when dragging within ±30px */
const SNAP_WIDTHS = [320, 480, 640] as const
const SNAP_THRESHOLD = 30

const SIDEBAR_WIDTH_KEY = 'wb-sidebar-width'
let _savedWidth: string | null = null
try { _savedWidth = localStorage.getItem(SIDEBAR_WIDTH_KEY) } catch { /* Safari private */ }
const sidebarWidth = ref(_savedWidth ? Math.max(SIDEBAR_MIN, Math.min(SIDEBAR_MAX, parseInt(_savedWidth, 10))) : SIDEBAR_DEFAULT)
/** Width saved before double-click collapse; null = sidebar is expanded */
const sidebarCollapsedBefore = ref<number | null>(null)
let isSidebarResizing = false

/** Computed style: disables min-width when collapsed so sidebar can hide fully */
const sidebarStyle = computed(() => ({
  width: sidebarCollapsedBefore.value !== null ? '0px' : sidebarWidth.value + 'px',
  ...(sidebarCollapsedBefore.value !== null ? { minWidth: '0', overflow: 'visible', borderLeft: 'none' } : {}),
}))

/** Snaps value to nearest SNAP_WIDTHS entry if within SNAP_THRESHOLD */
function snapWidth(w: number): number {
  for (const snap of SNAP_WIDTHS) {
    if (Math.abs(w - snap) <= SNAP_THRESHOLD) return snap
  }
  return w
}

function startSidebarResize(e: MouseEvent) {
  isSidebarResizing = true
  document.body.style.cursor = 'col-resize'
  document.body.style.userSelect = 'none'
  document.addEventListener('mousemove', onSidebarResize)
  document.addEventListener('mouseup', stopSidebarResize)
}

function startSidebarResizeTouch(e: TouchEvent) {
  isSidebarResizing = true
  document.body.style.userSelect = 'none'
  document.addEventListener('touchmove', onSidebarResizeTouch)
  document.addEventListener('touchend', stopSidebarResize)
}

function onSidebarResize(e: MouseEvent) {
  if (!isSidebarResizing) return
  const raw = Math.min(SIDEBAR_MAX, Math.max(SIDEBAR_MIN, window.innerWidth - e.clientX))
  sidebarWidth.value = snapWidth(raw)
  // Dragging always restores from collapsed state
  if (sidebarCollapsedBefore.value !== null) sidebarCollapsedBefore.value = null
}

function onSidebarResizeTouch(e: TouchEvent) {
  if (!isSidebarResizing || !e.touches[0]) return
  const raw = Math.min(SIDEBAR_MAX, Math.max(SIDEBAR_MIN, window.innerWidth - e.touches[0].clientX))
  sidebarWidth.value = snapWidth(raw)
  if (sidebarCollapsedBefore.value !== null) sidebarCollapsedBefore.value = null
}

function stopSidebarResize() {
  isSidebarResizing = false
  document.body.style.cursor = ''
  document.body.style.userSelect = ''
  document.removeEventListener('mousemove', onSidebarResize)
  document.removeEventListener('mouseup', stopSidebarResize)
  document.removeEventListener('touchmove', onSidebarResizeTouch)
  document.removeEventListener('touchend', stopSidebarResize)
}

/** Double-click resize handle: collapse sidebar / restore to previous width */
function toggleSidebarCollapse() {
  if (sidebarCollapsedBefore.value !== null) {
    // Restore
    sidebarWidth.value = sidebarCollapsedBefore.value
    sidebarCollapsedBefore.value = null
  } else {
    // Collapse
    sidebarCollapsedBefore.value = sidebarWidth.value
    sidebarWidth.value = 0
  }
  // Notify ResizeObserver about container size change after CSS transition ends
  setTimeout(() => recalculateCanvas(), 220)
}

// Persist sidebar width to localStorage (debounced)
let _sidebarSaveTimer: ReturnType<typeof setTimeout> | null = null
watch(sidebarWidth, (w) => {
  if (w > 0) {
    if (_sidebarSaveTimer) clearTimeout(_sidebarSaveTimer)
    _sidebarSaveTimer = setTimeout(() => {
      try { localStorage.setItem(SIDEBAR_WIDTH_KEY, String(w)) } catch { /* Safari private */ }
    }, 300)
  }
})

// ─── Computed ───────────────────────────────────────────────────────────────

// B6.3: Check if current page is empty (no strokes, no assets)
const isCanvasEmpty = computed(() => {
  const page = store.currentPage
  if (!page) return true
  return page.strokes.length === 0 && page.assets.length === 0
})

// PROB-1 FIX: Check if any selected item is locked (for lock/unlock toggle in toolbar)
const hasLockedInSelection = computed(() => {
  return store.selectedIds.some((id) => store.isItemLocked(id))
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
    handleAssetUpdate({ ...(obj as import('../types/winterboard').WBAsset), audioUrl, audioDuration: duration ?? undefined })
  } else {
    handleStrokeUpdate({ ...(obj as import('../types/winterboard').WBStroke), audioUrl, audioDuration: duration ?? undefined })
  }
}

function handleAudioDeleted(objectId: string) {
  const obj = store.getObjectById(objectId)
  if (!obj) return
  const isAsset = 'w' in obj && 'h' in obj && 'type' in obj
  if (isAsset) {
    const { audioUrl: _a, audioDuration: _d, ...rest } = obj as import('../types/winterboard').WBAsset
    handleAssetUpdate({ ...rest, audioUrl: undefined, audioDuration: undefined } as import('../types/winterboard').WBAsset)
  } else {
    const { audioUrl: _a, audioDuration: _d, ...rest } = obj as import('../types/winterboard').WBStroke
    handleStrokeUpdate({ ...rest, audioUrl: undefined, audioDuration: undefined } as import('../types/winterboard').WBStroke)
  }
}

// P2: Canvas rect for WBSelectionToolbar — recalculated when selection changes
const selectionCanvasRect = computed(() => {
  // Depend on selectedIds so rect is recalculated on selection change
  if (store.selectedIds.length === 0) return null
  return canvasContainerRef.value?.getBoundingClientRect() ?? null
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

const saveStatusText = computed(() => {
  // Prefer autosave status when active
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
  sessionId: () => sessionId.value,
  canvasCenter: () => ({
    x: (store.pageWidth ?? 800) / 2,
    y: (store.pageHeight ?? 600) / 2,
  }),
  onAssetAdd: (asset: WBAsset) => {
    store.addAsset(asset)
  },
})

// ─── Keyboard shortcuts (AGENT-B: useKeyboard) ─────────────────────────────

useKeyboard({
  onToolChange: (tool: WBToolType) => store.setTool(tool),
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
  store.addStroke(stroke)

  // Record in external history (AGENT-B composable, non-critical)
  const page = store.currentPage
  if (page) {
    try {
      history.recordAdd(page.id, stroke, 'stroke')
    } catch (err) {
      console.warn('[WB:Room] history.recordAdd failed:', err)
    }
  }
}

function handleStrokeUpdate(stroke: WBStroke): void {
  store.updateStroke(stroke)
}

function handleStrokeDelete(strokeId: string): void {
  // Find stroke before deleting for history
  const page = store.currentPage
  const existing = page?.strokes.find((s) => s.id === strokeId)

  // Delete first — store action must succeed even if history recording fails
  store.deleteStroke(strokeId)

  // Record in history (non-critical — wrapped in try-catch)
  if (page && existing) {
    try {
      history.recordRemove(page.id, existing, 'stroke')
    } catch (err) {
      console.warn('[WB:Room] history.recordRemove failed:', err)
    }
  }
}

function handleAssetAdd(asset: WBAsset): void {
  store.addAsset(asset)

  // A4.3: Record in history for undo/redo (non-critical)
  const page = store.currentPage
  if (page) {
    try {
      history.recordAdd(page.id, asset, 'asset')
    } catch (err) {
      console.warn('[WB:Room] history.recordAdd (asset) failed:', err)
    }
  }
}

function handleAssetUpdate(asset: WBAsset): void {
  store.updateAsset(asset)
}

function handleAssetDelete(assetId: string): void {
  const page = store.currentPage
  const existing = page?.assets.find((a) => a.id === assetId)

  // Delete first — store action must succeed even if history recording fails
  store.deleteAsset(assetId)

  // A4.3: Record in history for undo/redo (non-critical)
  if (page && existing) {
    try {
      history.recordRemove(page.id, existing, 'asset')
    } catch (err) {
      console.warn('[WB:Room] history.recordRemove (asset) failed:', err)
    }
  }
}

function handleSelect(id: string | null): void {
  selectedId.value = id
}

// PLAN_v4: Presentation expand (fullscreen mode for presentation document_viewer)
function handlePresentationExpand(asset: WBAsset): void {
  // MVP: log + future: open fullscreen overlay
  console.info('[WB:Room] Presentation expand requested:', asset.id, asset.content_ref)
  // TODO(PLAN_v4): Implement fullscreen presentation overlay (backlog)
}

// ─── Handlers: Presence / Cursors (A3.2) ─────────────────────────────────────

function handleCursorMove(payload: { x: number; y: number; tool: WBToolType; color: string }): void {
  const pageId = store.currentPage?.id ?? ''
  presence.sendCursor(payload.x, payload.y, pageId, payload.tool, payload.color)
}

function handleDeleteSelected(): void {
  if (!selectedId.value) return
  // Try stroke first, then asset
  const page = store.currentPage
  if (!page) return

  const isStroke = page.strokes.some((s) => s.id === selectedId.value)
  if (isStroke) {
    store.deleteStroke(selectedId.value)
  } else {
    store.deleteAsset(selectedId.value)
  }
  selectedId.value = null
}

// ─── P3: YouTube insert handler ─────────────────────────────────────────────

function handleYouTubeSubmit(payload: { url: string; title?: string }): void {
  showYouTubeModal.value = false
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

// ─── Handlers: Tool / Color / Size ──────────────────────────────────────────

function handleToolChange(tool: WBToolType): void {
  store.setTool(tool)
  // B5.1: Announce tool change to screen readers
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
  store.undo()
  // B5.1: Announce undo to screen readers
  announce(t('winterboard.a11y.undoAction', { action: t('winterboard.a11y.strokeRemoved') }))
}

function handleRedo(): void {
  store.redo()
  // B5.1: Announce redo to screen readers
  announce(t('winterboard.a11y.redoAction', { action: t('winterboard.a11y.strokeRestored') }))
}

function handleClear(): void {
  store.clearPage()
}

// PROB-1 FIX: Lock/Unlock handlers
function handleLockSelected(): void {
  locking.lockSelected()
}

function handleUnlockSelected(): void {
  locking.unlockSelected()
}

// PROB-3 FIX: Clear page request handler (safe — clears only current page)
function handleClearPageRequest(): void {
  handleClear()
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
  store.addPage()
}

function handlePageDuplicate(index: number): void {
  store.duplicatePage(index)
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

// Phase 35 B5: Grid size change
function onGridSizeChange(e: Event) {
  const val = Number((e.target as HTMLSelectElement).value)
  if (store.setGridSize) store.setGridSize(val)
}

// Phase 35 B6: Background color change
function onBgColorChange(e: Event) {
  const color = (e.target as HTMLInputElement).value
  if (store.setBackgroundColor) store.setBackgroundColor(color)
}

function handleZoomOut(): void {
  store.setZoom(store.zoom - 0.25)
  followMode.onUserInteraction()
}

function handleZoomReset(): void {
  store.setZoom(1)
  followMode.onUserInteraction()
}

// A5.3: Handle zoom/scroll from WBCanvas (Ctrl+scroll, pinch, etc.)
function handleZoomChange(zoom: number): void {
  store.setZoom(zoom)
  followMode.onUserInteraction()
}

function handleScrollChange(scrollX: number, scrollY: number): void {
  store.setScroll(scrollX, scrollY)
  followMode.onUserInteraction()
}

function handleFitToPage(): void {
  canvasRef.value?.fitToPage?.()
}

// ─── Phase 37: Test System ─────────────────────────────────────────────────

const TEST_TOOLS = [
  { type: 'input' as const, icon: '📝', labelKey: 'winterboard.test.input' },
  { type: 'radio' as const, icon: '⭕', labelKey: 'winterboard.test.radio' },
  { type: 'checkbox' as const, icon: '☑️', labelKey: 'winterboard.test.checkbox' },
  { type: 'dropdown' as const, icon: '📋', labelKey: 'winterboard.test.dropdown' },
  { type: 'gap-fill' as const, icon: '🔤', labelKey: 'winterboard.test.gapFill' },
  { type: 'matching' as const, icon: '🔗', labelKey: 'winterboard.test.matching' },
]

const currentTestObjects = computed<WBTestObject[]>(() => store.currentPage?.testObjects ?? [])
const selectedTestObject = computed<WBTestObject | null>(() => {
  const id = testStore.selectedTestId
  if (!id) return null
  return store.getTestObjectById(id)
})
const showGradeModal = ref(false)
const currentGradeResult = ref<GradeResult | null>(null)

/** Grade result для поточної сторінки (для WBTestOverlay review mode) */
const currentPageGradeResult = computed(() => {
  const pageId = store.currentPage?.id
  if (!pageId) return null
  return testStore.getGradeResult(pageId)
})

/** Відповіді поточної сторінки (для передачі в WBTestOverlay → WBTestElement) */
const currentPageAnswers = computed(() => {
  const pageId = store.currentPage?.id
  if (!pageId) return undefined
  return testStore.getPageAnswers(pageId)
})

/** Phase 38: inline check results для поточної сторінки */
const currentPageChecks = computed(() => {
  const pageId = store.currentPage?.id
  if (!pageId) return undefined
  return testStore.getPageChecks(pageId)
})

function handleTestToolSelect(type: 'input' | 'radio' | 'checkbox' | 'dropdown' | 'gap-fill' | 'matching') {
  if (testStore.activeTestTool === type) {
    testStore.setActiveTestTool(null)
  } else {
    testStore.setActiveTestTool(type)
  }
}

function handleTestSelect(id: string) {
  testStore.selectTestObject(id)
  store.clearSelection() // FIX-9: deselect board objects
}

function handleTestDeselect() {
  testStore.selectTestObject(null)
}

function handleTestObjectUpdate(payload: { id: string; updates: Record<string, unknown> }) {
  store.updateTestObject(payload.id, payload.updates)
}

function handleTestAnswer(payload: { objectId: string; answer: unknown }) {
  const pageId = store.currentPage?.id
  if (pageId) {
    testStore.setAnswer(pageId, payload.objectId, payload.answer)
  }
}

/** Phase 38: Inline перевірка одного тестового елемента */
function handleTestCheck(objectId: string) {
  const pageId = store.currentPage?.id
  if (!pageId) return
  const testObj = currentTestObjects.value.find(o => o.id === objectId)
  if (!testObj) return
  testStore.checkSingleAnswer(pageId, objectId, testObj)
}

function handleTestObjectDelete(id: string) {
  store.deleteTestObject(id)
  testStore.selectTestObject(null)
}

function handleTestObjectDuplicate(id: string) {
  const newId = store.duplicateTestObject(id)
  if (newId) {
    testStore.selectTestObject(newId)
  }
}

function handleGradeTest() {
  const pageId = store.currentPage?.id
  if (!pageId) return
  const result = testStore.gradePage(pageId, currentTestObjects.value)
  currentGradeResult.value = result
  showGradeModal.value = true
  // Перехід у review фазу — зелене/червоне підсвічування на елементах
  testStore.setTestPhase('review')
}

/** Повторити тест — очистити відповіді та повернутись у live */
function handleRetryTest() {
  const pageId = store.currentPage?.id
  if (pageId) {
    testStore.clearPageAnswers(pageId)
  }
  currentGradeResult.value = null
  testStore.setTestPhase('live')
}

/** Dedup guard — prevents double creation from both click + mouseup firing */
let _lastTestClickTs = 0
let _pendingLabelEditId: string | null = null

/** Convert DOM click to canvas coordinates and dispatch to test handler */
function onCanvasContainerClick(e: MouseEvent) {
  // Phase 38: deselect тестового об'єкту при кліку на canvas (overlay = pointer-events:none)
  // НЕ десілектимо якщо клік був на самому тестовому елементі
  const target = e.target as HTMLElement | null
  const clickedTestEl = target?.closest('.wb-test-element')
  if (testStore.selectedTestId && !clickedTestEl) {
    testStore.selectTestObject(null)
  }

  _dispatchTestClick(e)
}

/**
 * Mouseup fallback — Konva canvas може поглинати click event, але mouseup
 * завжди спрацьовує. Використовуємо для тест-об'єктів.
 */
function onCanvasContainerMouseUp(e: MouseEvent) {
  if (!testStore.testMode || !testStore.activeTestTool) return
  _dispatchTestClick(e)
}

/** Спільна логіка створення тестового об'єкта по кліку */
function _dispatchTestClick(e: MouseEvent) {
  if (!testStore.testMode || !testStore.activeTestTool) return
  if (testStore.testPhase !== 'edit') return

  // Dedup: не створювати двічі з click + mouseup в межах 200ms
  const now = Date.now()
  if (now - _lastTestClickTs < 200) return
  _lastTestClickTs = now

  const container = canvasContainerRef.value
  if (!container) return

  const rect = container.getBoundingClientRect()
  const canvasX = (e.clientX - rect.left) / store.zoom + (store.scrollX ?? 0)
  const canvasY = (e.clientY - rect.top) / store.zoom + (store.scrollY ?? 0)

  handleTestCanvasClick(canvasX, canvasY)
}

/** Create test object when canvas is clicked in test mode with active tool */
function handleTestCanvasClick(canvasX: number, canvasY: number) {
  const tool = testStore.activeTestTool
  if (!tool) return

  const id = `test-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`
  const base: WBTestObject = {
    id,
    type: tool,
    x: Math.round(canvasX),
    y: Math.round(canvasY),
    width: 250,
    height: 40,
    points: 1,
    createdBy: 'local',
    createdAt: Date.now(),
  }

  let obj: WBTestObject
  switch (tool) {
    case 'input':
      obj = { ...base, type: 'input', inputType: 'text', placeholder: '', caseSensitive: false, label: t('winterboard.test.props.labelQuestion'), correctAnswer: '' } as WBTestInput
      break
    case 'radio':
      obj = { ...base, type: 'radio', options: ['A', 'B', 'C'], correctIndex: 0, layout: 'vertical', label: t('winterboard.test.radio'), height: 120 } as WBTestRadio
      break
    case 'checkbox':
      obj = { ...base, type: 'checkbox', options: ['A', 'B', 'C'], correctIndices: [0], layout: 'vertical', label: t('winterboard.test.checkbox'), height: 120 } as WBTestCheckbox
      break
    case 'dropdown':
      obj = { ...base, type: 'dropdown', options: ['A', 'B', 'C'], correctIndex: 0, label: t('winterboard.test.dropdown') } as WBTestDropdown
      break
    case 'gap-fill':
      obj = { ...base, type: 'gap-fill', template: '___ — ___', gaps: [{ position: 0, correctAnswer: '', caseSensitive: false }, { position: 5, correctAnswer: '', caseSensitive: false }], label: t('winterboard.test.gapFill'), height: 80 } as WBTestGapFill
      break
    case 'matching':
      obj = { ...base, type: 'matching', leftItems: ['1', '2', '3'], rightItems: ['A', 'B', 'C'], correctPairs: [0, 1, 2], label: t('winterboard.test.matching'), width: 400, height: 160 } as WBTestMatching
      break
    default:
      return
  }

  store.addTestObject(obj)
  testStore.selectTestObject(id)
  testStore.setActiveTestTool(null)
  // Quick create: auto-focus label для швидкого введення запитання
  _pendingLabelEditId = id
  nextTick(() => {
    nextTick(() => {
      // Подвійний nextTick щоб DOM встиг відрендерити WBTestElement
      if (_pendingLabelEditId) {
        const el = document.querySelector(
          `.wb-test-element__label[data-test-id="${_pendingLabelEditId}"]`
        ) as HTMLElement | null
        if (el) {
          // Імітуємо dblclick для запуску inline edit
          el.dispatchEvent(new MouseEvent('dblclick', { bubbles: true }))
        }
        _pendingLabelEditId = null
      }
    })
  })
}

// ─── Handlers: Header ───────────────────────────────────────────────────────

function handleTitleBlur(): void {
  if (!sessionName.value.trim()) {
    sessionName.value = t('winterboard.room.untitled')
  }
  store.workspaceName = sessionName.value
  store.markDirty()
  // BUG-1 FIX: Persist name immediately via API (non-blocking)
  if (sessionId.value) {
    winterboardApi.updateSession(sessionId.value, { name: sessionName.value }).catch((err) => {
      console.warn('[WBSoloRoom] Failed to persist session name:', err)
    })
  }
}

// Phase 13 A3.3: Handle published lesson — navigate to public page
// Phase 14 B2.2: Extended to store lesson data for SaveAsTemplate flow
function handlePublished(publicUrl: string, lessonData?: { id: string; title: string; subject_tag?: string }): void {
  showPublishDialog.value = false
  if (lessonData) {
    publishedLessonData.value = lessonData
  }
  window.open(publicUrl, '_blank')
}

// Phase 14 B2.2: Handle template saved
function handleTemplateSaved(): void {
  showSaveTemplateDialog.value = false
}

// Phase 21: Force autosave before opening save dialog to ensure latest state is persisted
async function openSaveLessonDialog(): Promise<void> {
  await autosave.saveNow()
  showSaveLessonDialog.value = true
}

// Phase 21: Handle lesson saved
function handleLessonSaved(lesson: { id: string; title: string }): void {
  showSaveLessonDialog.value = false
  console.info('[WBSoloRoom] Lesson saved:', lesson.id, lesson.title)
}

// BUG-1 FIX: Save all pending changes before exiting
async function handleExit(): Promise<void> {
  await saveBeforeLeave()
  router.push('/winterboard')
}

// FIX-6: Navigate with autosave — used by sidebar overlay links
async function navigateWithSave(path: string): Promise<void> {
  showSidebarOverlay.value = false
  await saveBeforeLeave()
  router.push(path)
}

// BUG-1 FIX: Shared save logic for exit and route leave
async function saveBeforeLeave(): Promise<void> {
  if (!sessionId.value) return
  try {
    // FIX (2026-04-07): name persistence перенесено повністю в handleTitleBlur.
    // Раніше тут робився save з hardcoded чеком `!== 'Untitled'` (англійський
    // string), який не ловив локалізоване "Без назви" і зберігав сміттєві
    // значення зі store.workspaceName (включно з UI-текстом, який міг туди
    // потрапити з автотестів або race-у). Назву має зберігати тільки blur.
    // Flush all pending drawing changes
    await autosave.saveNow()
  } catch (err) {
    console.warn('[WBSoloRoom] Save before leave failed (best-effort):', err)
  }
}

// ─── Presence: graceful WebSocket connect ────────────────────────────────────

async function connectPresenceSafe(sid: string): Promise<void> {
  try {
    // CRITICAL: Wait for auth bootstrap to get real JWT token in memory
    // In production, authStore.access = '__cookie__' on page load
    // Bootstrap calls refreshAccess() which sets real JWT needed for WS auth
    await authStore.bootstrap()
    presence.connect(sid)
  } catch (err) {
    console.warn('[WBSoloRoom] Presence WebSocket unavailable (non-blocking):', err)
  }
}

// ─── Lifecycle ──────────────────────────────────────────────────────────────

onMounted(async () => {
  const id = route.params.id as string | undefined

  // New session flow: /winterboard/new → create via API → redirect to /winterboard/:id
  if (!id || route.name === 'winterboard-new') {
    try {
      // Якщо тьютор відкрив дошку для конкретного учня — використовуємо ім'я учня як назву сесії
      // щоб дошка була впізнаваною у списку "Мої дошки"
      // Якщо тьютор запустив урок з плану → використовуємо назву плану
      // Якщо тьютор відкрив дошку для учня → використовуємо ім'я учня
      const lessonNameParam = typeof route.query.lessonName === 'string' ? route.query.lessonName.trim() : null
      const studentNameParam = typeof route.query.studentName === 'string' ? route.query.studentName.trim() : null
      const initialName = lessonNameParam
        ? lessonNameParam
        : studentNameParam
          ? `Заняття — ${studentNameParam}`
          : t('winterboard.room.untitled')
      const created = await winterboardApi.createSession({ name: initialName })
      // Hydrate store immediately with created session data to avoid re-fetch flicker
      store.workspaceId = created.id
      sessionId.value = created.id
      if (created.state) {
        store.hydrateFromSession({
          id: created.id,
          name: created.name,
          owner_id: created.owner_id ?? '',
          state: created.state,
          page_count: created.page_count,
          thumbnail_url: created.thumbnail_url,
          rev: created.rev,
          created_at: created.created_at,
          updated_at: created.updated_at,
        })
      } else {
        store.workspaceName = created.name || t('winterboard.room.untitled')
        store.rev = created.rev ?? 0
      }
      sessionName.value = created.name || t('winterboard.room.untitled')
      isLoading.value = false
      // Template selector modal removed — grid overlay button replaces it
      // Phase 1: replayRecorder.start() removed — controlled by isRecording ref via watch
      await connectPresenceSafe(created.id)
      // Preserve explicit groupId in query params if present
      const query = explicitGroupId.value ? { ...route.query, groupId: explicitGroupId.value } : route.query
      router.replace({ name: 'winterboard-solo', params: { id: created.id }, query })
      return
    } catch (err: unknown) {
      const status = (err as Record<string, Record<string, number>>)?.response?.status
      if (status === 401) {
        router.push('/auth/login')
        return
      }
      console.error('[WBSoloRoom] Failed to create session:', err)
      router.push({ name: 'winterboard-sessions' })
      return
    }
  }

  if (id) {
    store.workspaceId = id
    // NOTE: sessionId is set AFTER hydrateFromSession to prevent a race condition
    // where beaconSave / handleVisibilityChange fires with empty pages before hydration.
    // The grid overlay immediate watch marks isDirty=true at setup (on the initial empty page).
    // If sessionId were set here and the tab were hidden during API loading (~200ms window),
    // beaconSave would overwrite the server-side session with empty content.

    // Load session from API
    try {
      const detail = await winterboardApi.getSession(id)
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
      // A.1: hydrate recording state from session detail
      if (detail.recording_started_seq != null && detail.recording_stopped_seq == null) {
        isManualRecording.value = true
        recordingStartedAt.value = detail.recording_started_at ?? null
      }
      isReplayFrozen.value = detail.is_replay_frozen ?? false

      // Set sessionId AFTER hydration — autosave is now safe to run
      sessionId.value = id
      sessionName.value = detail.name || t('winterboard.room.untitled')

      // Connect recorder to store AFTER hydration — prevents stale listeners
      _unsubRecorder = replayRecorder.connectToStore(store)
    } catch (err: unknown) {
      const status = (err as Record<string, Record<string, number>>)?.response?.status
      if (status === 401) {
        router.push('/auth/login')
        return
      }
      if (status === 404) {
        router.push({ name: 'winterboard-sessions', query: { error: 'not_found' } })
        return
      }
      if (status === 409) {
        window.location.reload()
        return
      }
      if (!navigator.onLine || !status) {
        store.setSyncStatus('offline')
      }
      console.error('[WBSoloRoom] Failed to load session:', err)
    } finally {
      // Always stop loading — even on error, show the canvas
      isLoading.value = false
      // Phase 1: replayRecorder.start() removed — controlled by isRecording ref via watch

      // REPLAY-FIX-5: Reset store AFTER hydration when entering replay via URL.
      // Must happen after hydrateFromSession, otherwise hydration overwrites the reset.
      if (mode.value === 'replay' && store.mode !== 'replay') {
        _savedBoardState = store.getSnapshotState()
        store.setMode('replay')
        store.resetForReplay()
      }

      // Connect presence (waits for auth bootstrap internally)
      await connectPresenceSafe(id)
    }
  }

  sessionName.value = store.workspaceName
})

// ── Keyboard shortcuts ──
function onGlobalKeyDown(e: KeyboardEvent) {
  // A.4 (INV-X): у replay-режимі канвас read-only — блокуємо всі mutate-shortcuts
  if (mode.value === 'replay') {
    return
  }
  if ((e.ctrlKey || e.metaKey) && e.key === 'b') {
    e.preventDefault()
    if (showMaterialsSidebar.value) toggleSidebarCollapse()
  }

  // Ctrl+D для дублювання тестового об'єкта (коли вибраний test object)
  if ((e.ctrlKey || e.metaKey) && e.key === 'd') {
    if (testStore.testMode && testStore.testPhase === 'edit' && testStore.selectedTestId) {
      e.preventDefault()
      e.stopPropagation()
      const newId = store.duplicateTestObject(testStore.selectedTestId)
      if (newId) {
        testStore.selectTestObject(newId)
      }
    }
  }

  // Delete/Backspace для видалення тестового об'єкта
  if ((e.key === 'Delete' || e.key === 'Backspace') && !e.ctrlKey && !e.metaKey) {
    // Не видаляти якщо фокус у полі вводу
    const tag = (e.target as HTMLElement)?.tagName?.toLowerCase()
    if (tag === 'input' || tag === 'textarea' || tag === 'select') return

    if (testStore.testMode && testStore.testPhase === 'edit' && testStore.selectedTestId) {
      const obj = store.getTestObjectById(testStore.selectedTestId)
      if (obj && !obj.locked) {
        e.preventDefault()
        e.stopPropagation()
        store.deleteTestObject(testStore.selectedTestId)
        testStore.selectTestObject(null)
      }
    }
  }
}
document.addEventListener('keydown', onGlobalKeyDown, true) // capture: перехоплює РАНІШЕ за WBCanvas

// B.6: Best-effort replay buffer flush on tab close via sendBeacon
function _handleBeforeUnload(e: BeforeUnloadEvent): void {
  replayRecorder.flushViaSendBeacon()
  if (isManualRecording.value) {
    e.preventDefault()
    e.returnValue = ''
  }
}
window.addEventListener('beforeunload', _handleBeforeUnload)

onBeforeUnmount(async () => {
  window.removeEventListener('beforeunload', _handleBeforeUnload)
  document.removeEventListener('keydown', onGlobalKeyDown, true)
  if (_recordingDoneTimer) { clearTimeout(_recordingDoneTimer); _recordingDoneTimer = null }
  cleanupRecorder()  // idempotent — may already be cleaned by onBeforeRouteLeave
  // BUG-1 FIX: Use shared save logic on unmount
  await saveBeforeLeave()
  autosave.destroy()
  presence.disconnect()
  stopSidebarResize()
})

// BUG-1 FIX: Route leave guard — saves before any SPA navigation away
// Also cleanup recorder BEFORE navigation (prevents timer leaks during SPA transition)
onBeforeRouteLeave(async (_to, _from, next) => {
  cleanupRecorder()
  await saveBeforeLeave()
  next()
})

watch(() => store.workspaceName, (name) => {
  sessionName.value = name
})
</script>

<style scoped>
/* WB: Solo room layout — header + toolbar + canvas + footer
   Ref: classroom/views/SoloRoom.vue (adapted with WB prefix) */

.wb-solo-room {
  display: flex;
  flex-direction: column;
  height: 100vh;
  height: 100dvh; /* dynamic viewport height — accounts for mobile browser chrome */
  overflow: hidden;
  background: var(--wb-bg-tertiary, #f1f5f9);
}

/* ── Header ────────────────────────────────────────────────────────────────── */

.wb-solo-room__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 24px;
  background: var(--wb-header-bg, #0f172a);
  color: white;
  height: 56px;
  flex-shrink: 0;
  z-index: 30;
}

@media (max-width: 1024px) {
  .wb-solo-room__header {
    padding: 0 16px;
  }
}

.wb-solo-room__title {
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

.wb-title-input::placeholder {
  color: rgba(255, 255, 255, 0.5);
}

.wb-title-input:focus {
  outline: none;
  background: rgba(255, 255, 255, 0.18);
  border-color: var(--wb-brand, #2563eb);
}

/* Phase 16 INT-33: Session context bar */
.wb-solo-room__context {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 2px 10px;
  background: rgba(99, 102, 241, 0.1);
  border-radius: 6px;
  flex-shrink: 0;
}

.wb-solo-room__context-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: #6366f1;
  flex-shrink: 0;
}

.wb-solo-room__context-label {
  font-size: 12px;
  font-weight: 600;
  color: #6366f1;
  white-space: nowrap;
  max-width: 180px;
  overflow: hidden;
  text-overflow: ellipsis;
}

.wb-solo-room__status {
  flex-shrink: 0;
  margin: 0 16px;
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

.wb-save-indicator--saved .wb-save-indicator__dot {
  background: #22c55e;
}

.wb-save-indicator--syncing .wb-save-indicator__dot {
  background: #eab308;
  animation: wb-pulse 1s infinite;
}

.wb-save-indicator--error .wb-save-indicator__dot {
  background: #ef4444;
}

.wb-save-indicator--offline .wb-save-indicator__dot {
  background: #f97316;
}

@keyframes wb-pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.4; }
}

/* ── A5.1: Follow mode ─────────────────────────────────────────────────────── */

.wb-follow-controls {
  flex-shrink: 0;
  margin: 0 12px;
}

.wb-follow-btn {
  padding: 4px 14px;
  background: rgba(37, 99, 235, 0.8);
  border: none;
  border-radius: 6px;
  color: white;
  font-size: 0.75rem;
  font-weight: 500;
  cursor: pointer;
  transition: background 0.15s ease;
  white-space: nowrap;
}

.wb-follow-btn:hover {
  background: rgba(37, 99, 235, 1);
}

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
  white-space: nowrap;
}

.wb-follow-indicator__dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: #22c55e;
  animation: wb-pulse 1.5s infinite;
}

.wb-follow-stop-btn {
  margin-left: 4px;
  padding: 2px 8px;
  background: rgba(255, 255, 255, 0.15);
  border: none;
  border-radius: 4px;
  color: white;
  font-size: 0.6875rem;
  cursor: pointer;
  transition: background 0.15s ease;
}

.wb-follow-stop-btn:hover {
  background: rgba(239, 68, 68, 0.6);
}

.wb-solo-room__actions {
  display: flex;
  align-items: center;
  gap: 6px;
}

.wb-header-btn {
  width: 32px;
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(255, 255, 255, 0.1);
  border: none;
  border-radius: 6px;
  color: white;
  cursor: pointer;
  font-size: 0.875rem;
  transition: background 0.15s ease;
}

.wb-header-btn:hover:not(:disabled) {
  background: rgba(255, 255, 255, 0.2);
}

.wb-header-btn:disabled {
  opacity: 0.35;
  cursor: not-allowed;
}

.wb-header-btn--exit {
  width: auto;
  padding: 0 12px;
  font-size: 0.8125rem;
  font-weight: 500;
}

/* ── Main ──────────────────────────────────────────────────────────────────── */

.wb-solo-room__main {
  display: flex;
  flex: 1;
  overflow: hidden;
  position: relative;
}

.wb-solo-room__toolbar {
  flex-shrink: 0;
  z-index: 20;
}

/* ── Page thumbnails panel (collapsible) ──────────────────────────────────── */
.wb-solo-room__page-panel {
  flex-shrink: 0;
  width: 0;
  overflow: hidden;
  transition: width 0.2s ease;
  background: var(--wb-bg-secondary, #f8fafc);
  border-right: 1px solid var(--wb-border, #e2e8f0);
  z-index: 15;
}
.wb-solo-room__page-panel--open {
  width: 156px; /* 140px thumbnail + 8px padding × 2 */
}

/* A.4 (INV-X): read-only overlay в replay-режимі */
.wb-solo-room__readonly-overlay {
  position: absolute;
  inset: 0;
  z-index: 20;
  background: transparent;
  cursor: default;
  pointer-events: auto;
  /* блокує context-menu (right-click) */
  user-select: none;
  -webkit-user-select: none;
}

.wb-solo-room__canvas {
  flex: 1;
  min-width: 0;
  min-height: 0;
  overflow: hidden;
  display: flex;
  align-items: center;
  justify-content: center;
  position: relative;
  background: var(--wb-canvas-area-bg, #e2e8f0);
}

/* ── Resize handle for right sidebar ────────────────────────────────────── */

.wb-solo-room__resize-handle {
  width: 6px;
  flex-shrink: 0;
  cursor: col-resize;
  background: var(--wb-border, #e2e8f0);
  display: flex;
  align-items: center;
  justify-content: center;
  transition: background 0.15s;
  position: relative;
  z-index: 16;
}
.wb-solo-room__resize-handle:hover,
.wb-solo-room__resize-handle:active {
  background: #94a3b8;
}
.wb-solo-room__resize-grip {
  width: 2px;
  height: 32px;
  border-radius: 1px;
  background: #94a3b8;
}
.wb-solo-room__resize-handle:hover .wb-solo-room__resize-grip,
.wb-solo-room__resize-handle:active .wb-solo-room__resize-grip {
  background: white;
}
/* Collapsed state — handle stays visible with a subtle arrow hint */
.wb-solo-room__resize-handle--collapsed {
  background: #cbd5e1;
}
.wb-solo-room__resize-handle--collapsed .wb-solo-room__resize-grip {
  width: 0;
  height: 0;
  border: 5px solid transparent;
  border-left-color: #64748b;
  border-radius: 0;
  background: none;
  margin-left: 2px;
}
.wb-solo-room__resize-handle--collapsed:hover .wb-solo-room__resize-grip {
  border-left-color: white;
  background: none;
}
.wb-solo-room__sidebar-toggle {
  flex-shrink: 0;
  width: 20px;
  border: none;
  border-left: 1px solid var(--wb-border, #e2e8f0);
  background: var(--wb-bg-secondary, #f8fafc);
  color: var(--wb-text-secondary, #64748b);
  font-size: 10px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 17;
  transition: background 0.15s, color 0.15s;
  padding: 0;
}
.wb-solo-room__sidebar-toggle:hover {
  background: var(--wb-bg-hover, #f1f5f9);
  color: var(--wb-text-primary, #334155);
}

/* ── Right content sidebar (materials from LearningGroup, resizable) ───── */

.wb-solo-room__content-sidebar {
  flex-shrink: 0;
  min-width: 240px;
  max-width: 800px;
  border-left: 1px solid var(--wb-border, #e2e8f0);
  background: var(--wb-bg-primary, #ffffff);
  overflow-y: auto;
  overflow-x: hidden;
  z-index: 15;
  transition: width 200ms ease;
}

@media (max-width: 768px) {
  .wb-solo-room__content-sidebar {
    position: absolute;
    right: 0;
    top: 56px;
    bottom: 44px;
    min-width: 240px;
    width: 240px !important;
    box-shadow: -4px 0 12px rgba(0, 0, 0, 0.1);
  }
  .wb-solo-room__resize-handle {
    display: none;
  }
}

/* ── Footer ────────────────────────────────────────────────────────────────── */

.wb-solo-room__footer {
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

.wb-page-nav {
  display: flex;
  align-items: center;
  gap: 8px;
}

/* Phase 35 B5: Grid size select */
.wb-grid-size-select {
  height: 28px;
  border: 1px solid var(--wb-border, #e2e8f0);
  border-radius: 6px;
  padding: 0 6px;
  font-size: 12px;
  background: var(--wb-bg-primary, #fff);
  color: var(--wb-fg, #0f172a);
  cursor: pointer;
}

/* Phase 35 B6: Background color */
.wb-bg-color {
  display: flex;
  align-items: center;
  gap: 4px;
}
.wb-bg-color__label {
  font-size: 11px;
  color: var(--wb-text-secondary, #6b7280);
}
.wb-bg-color__input {
  width: 24px;
  height: 24px;
  border: 1px solid var(--wb-border, #e2e8f0);
  border-radius: 4px;
  padding: 1px;
  cursor: pointer;
  background: none;
}

.wb-page-btn {
  width: 28px;
  height: 28px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--wb-bg-secondary, #f8fafc);
  border: 1px solid var(--wb-border, #e2e8f0);
  border-radius: 6px;
  cursor: pointer;
  font-size: 0.875rem;
  color: var(--wb-fg, #0f172a);
  transition: background 0.15s ease;
}

.wb-page-btn:hover:not(:disabled) {
  background: var(--wb-bg-hover, #f1f5f9);
}

.wb-page-btn:disabled {
  opacity: 0.35;
  cursor: not-allowed;
}

.wb-page-btn--add {
  font-weight: 600;
  color: var(--wb-brand, #2563eb);
}

/* Toggle кнопка панелі сторінок */
.wb-page-btn--panel {
  color: var(--wb-fg-secondary, #475569);
}
.wb-page-btn--panel-active {
  background: var(--wb-brand, #2563eb);
  color: #fff;
  border-color: var(--wb-brand, #2563eb);
}
.wb-page-btn--panel-active:hover {
  background: #1d4ed8;
  border-color: #1d4ed8;
}

/* Роздільник між toggle і стрілками */
.wb-page-nav__sep {
  width: 1px;
  height: 20px;
  background: var(--wb-border, #e2e8f0);
  flex-shrink: 0;
}

.wb-page-indicator {
  font-size: 0.8125rem;
  color: var(--wb-fg-secondary, #475569);
  min-width: 48px;
  text-align: center;
}

.wb-zoom-controls {
  display: flex;
  align-items: center;
  gap: 6px;
}

.wb-zoom-btn {
  width: 28px;
  height: 28px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--wb-bg-secondary, #f8fafc);
  border: 1px solid var(--wb-border, #e2e8f0);
  border-radius: 6px;
  cursor: pointer;
  font-size: 1rem;
  font-weight: 600;
  color: var(--wb-fg, #0f172a);
  transition: background 0.15s ease;
}

.wb-zoom-btn:hover {
  background: var(--wb-bg-hover, #f1f5f9);
}

.wb-zoom-level {
  font-size: 0.8125rem;
  color: var(--wb-fg-secondary, #475569);
  min-width: 48px;
  text-align: center;
}

/* ── A6.3: Responsive — Mobile (<768px) ───────────────────────────────────── */

@media (max-width: 768px) {
  .wb-solo-room__header {
    height: 44px;
    padding: 0 8px;
    gap: 4px;
  }

  .wb-solo-room__title {
    max-width: 100px;
  }

  .wb-title-input {
    max-width: 100px;
    font-size: 0.75rem;
    padding: 2px 6px;
  }

  .wb-solo-room__status {
    display: none;
  }

  .wb-follow-controls {
    margin: 0 4px;
  }

  .wb-follow-btn {
    font-size: 0.6875rem;
    padding: 3px 8px;
  }

  .wb-follow-indicator {
    font-size: 0.6875rem;
    padding: 3px 6px;
    gap: 4px;
  }

  .wb-solo-room__actions {
    gap: 4px;
  }

  .wb-header-btn {
    width: 36px;
    height: 36px;
    min-width: 44px;
    min-height: 44px;
  }

  .wb-header-btn--exit {
    min-width: 44px;
    padding: 0 8px;
    font-size: 0.75rem;
  }

  /* Mobile: toolbar at bottom, canvas takes full width */
  .wb-solo-room__main {
    flex-direction: column;
  }

  .wb-solo-room__toolbar {
    order: 2;
    width: 100%;
    overflow-x: auto;
    overflow-y: hidden;
    -webkit-overflow-scrolling: touch;
  }

  .wb-solo-room__canvas {
    order: 1;
    flex: 1;
    min-height: 0;
  }

  .wb-solo-room__footer {
    height: 40px;
    padding: 0 8px;
  }

  .wb-page-nav {
    gap: 4px;
  }

  .wb-page-btn {
    width: 36px;
    height: 36px;
    min-width: 44px;
    min-height: 44px;
  }

  .wb-page-indicator {
    font-size: 0.75rem;
    min-width: 36px;
  }

  .wb-zoom-controls {
    gap: 4px;
  }

  .wb-zoom-btn {
    width: 36px;
    height: 36px;
    min-width: 44px;
    min-height: 44px;
  }

  .wb-zoom-level {
    font-size: 0.75rem;
    min-width: 36px;
  }
}

/* ── A6.3: Responsive — Tablet (768px–1024px) ────────────────────────────── */

@media (min-width: 769px) and (max-width: 1024px) {
  .wb-solo-room__header {
    height: 52px;
    padding: 0 16px;
  }

  .wb-title-input {
    max-width: 180px;
  }
}

/* ── B6.3: Empty canvas hint ───────────────────────────────────────────────── */

.wb-empty-canvas-hint {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  pointer-events: none;
  opacity: 0.15;
  user-select: none;
}

.wb-empty-canvas-hint__icon {
  width: 40px;
  height: 40px;
  color: var(--wb-fg-secondary, #64748b);
}

.wb-empty-canvas-hint__text {
  font-size: 14px;
  font-weight: 500;
  color: var(--wb-fg-secondary, #64748b);
}

/* ── B6.2: Fade transition for canvas loader ──────────────────────────────── */

.wb-fade-enter-active,
.wb-fade-leave-active {
  transition: opacity 0.3s ease;
}

.wb-fade-enter-from,
.wb-fade-leave-to {
  opacity: 0;
}

/* ── B5.1: Skip to canvas link ─────────────────────────────────────────────── */

.wb-skip-link {
  position: absolute;
  top: -100%;
  left: 16px;
  z-index: 100;
  padding: 8px 16px;
  background: var(--wb-brand, #0066FF);
  color: #ffffff;
  border-radius: 0 0 8px 8px;
  font-size: 14px;
  font-weight: 600;
  text-decoration: none;
  transition: top 0.2s ease;
}

.wb-skip-link:focus {
  top: 0;
  outline: 2px solid #ffffff;
  outline-offset: 2px;
}

/* ── FIX-5: Compact header nav (logo + hamburger) ─────────────────────────── */

.wb-solo-room__nav {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-right: 12px;
}

.wb-header-btn--hamburger {
  width: 36px;
  height: 36px;
}

.wb-logo {
  display: flex;
  align-items: center;
  pointer-events: none;
  user-select: none;
}

/* ── FIX-6: Sidebar overlay ───────────────────────────────────────────────── */

.wb-sidebar-overlay {
  position: fixed;
  inset: 0;
  z-index: 200;
  background: rgba(0, 0, 0, 0.4);
  backdrop-filter: blur(2px);
}

.wb-sidebar-panel {
  position: absolute;
  top: 0;
  left: 0;
  bottom: 0;
  width: 280px;
  background: var(--wb-bg, #ffffff);
  box-shadow: 4px 0 16px rgba(0, 0, 0, 0.12);
  display: flex;
  flex-direction: column;
  overflow-y: auto;
}

.wb-sidebar-panel__header {
  height: 64px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 16px;
  border-bottom: 1px solid var(--wb-border, #e2e8f0);
  flex-shrink: 0;
}

.wb-sidebar-panel__logo {
  display: flex;
  align-items: center;
  gap: 8px;
}

.wb-sidebar-panel__logo-icon {
  flex-shrink: 0;
  color: var(--wb-brand, #047857);
}

.wb-sidebar-panel__logo-text {
  font-weight: 700;
  font-size: 15px;
  letter-spacing: 0.02em;
  color: var(--wb-fg, #0f172a);
}

.wb-sidebar-panel__close {
  width: 28px;
  height: 28px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: none;
  border: 1px solid var(--wb-border, #e2e8f0);
  border-radius: 6px;
  cursor: pointer;
  color: var(--wb-fg-secondary, #64748b);
  transition: all 0.15s ease;
}

.wb-sidebar-panel__close:hover {
  background: var(--wb-btn-hover, #f1f5f9);
  color: var(--wb-fg, #0f172a);
}

.wb-sidebar-panel__nav {
  flex: 1;
  overflow-y: auto;
  padding: 8px 0;
  scrollbar-width: thin;
  scrollbar-color: var(--wb-border, #e2e8f0) transparent;
}

.wb-sidebar-panel__section {
  padding: 4px 0;
}

.wb-sidebar-panel__section + .wb-sidebar-panel__section {
  border-top: 1px solid var(--wb-border, #e2e8f0);
  margin-top: 4px;
  padding-top: 8px;
}

.wb-sidebar-panel__section-label {
  display: block;
  padding: 4px 16px;
  font-size: 0.6875rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: var(--wb-fg-secondary, #64748b);
  opacity: 0.7;
}

.wb-sidebar-panel__links {
  list-style: none;
  margin: 0;
  padding: 0;
}

.wb-sidebar-panel__links li a {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px 16px;
  margin: 1px 8px;
  border-radius: 6px;
  font-size: 14px;
  font-weight: 500;
  color: var(--wb-fg-secondary, #64748b);
  text-decoration: none;
  transition: all 0.15s ease;
  min-height: 40px;
}

.wb-sidebar-panel__links li a svg {
  flex-shrink: 0;
  opacity: 0.7;
}

.wb-sidebar-panel__links li a:hover {
  color: var(--wb-fg, #0f172a);
  background: var(--wb-btn-hover, #f1f5f9);
}

.wb-sidebar-panel__links li a:hover svg {
  opacity: 1;
}

.wb-sidebar-panel__links li a:active {
  background: color-mix(in srgb, var(--wb-brand, #047857) 10%, transparent);
  color: var(--wb-brand, #047857);
}

/* Sidebar slide-in transition */
.wb-sidebar-enter-active {
  transition: opacity 0.2s ease;
}
.wb-sidebar-enter-active .wb-sidebar-panel {
  transition: transform 0.25s ease;
}
.wb-sidebar-leave-active {
  transition: opacity 0.2s ease 0.05s;
}
.wb-sidebar-leave-active .wb-sidebar-panel {
  transition: transform 0.2s ease;
}
.wb-sidebar-enter-from {
  opacity: 0;
}
.wb-sidebar-enter-from .wb-sidebar-panel {
  transform: translateX(-100%);
}
.wb-sidebar-leave-to {
  opacity: 0;
}
.wb-sidebar-leave-to .wb-sidebar-panel {
  transform: translateX(-100%);
}

/* ── Display mode (>1920px) — interactive whiteboards, projectors ─────────── */

@media (min-width: 1920px) {
  .wb-solo-room__header {
    height: 56px;
    padding: 0 28px;
  }

  .wb-header-btn {
    width: 40px;
    height: 40px;
    font-size: 1.125rem;
  }

  .wb-title-input {
    font-size: 1rem;
  }

  .wb-page-btn {
    width: 36px;
    height: 36px;
  }

  .wb-zoom-btn {
    width: 36px;
    height: 36px;
  }

  .wb-zoom-level {
    font-size: 0.9375rem;
  }
}

/* Display mode + touch (interactive whiteboard) */
@media (min-width: 1920px) and (pointer: coarse) {
  .wb-header-btn {
    width: 48px;
    height: 48px;
    min-width: 64px;
    min-height: 64px;
  }

  .wb-header-btn--exit {
    min-width: 64px;
    min-height: 64px;
    padding: 0 16px;
    font-size: 1rem;
  }

  .wb-page-btn {
    width: 44px;
    height: 44px;
    min-width: 64px;
    min-height: 64px;
  }

  .wb-zoom-btn {
    width: 44px;
    height: 44px;
    min-width: 64px;
    min-height: 64px;
  }

  .wb-sidebar-panel__links li a {
    padding: 16px 24px;
    font-size: 16px;
    min-height: 64px;
    gap: 12px;
  }
}

/* ── Fullscreen button highlight ─────────────────────────────────────────── */

.wb-header-btn--fullscreen:hover {
  background: rgba(255, 255, 255, 0.2);
}

/* ── Reduced motion ────────────────────────────────────────────────────────── */

@media (prefers-reduced-motion: reduce) {
  .wb-save-indicator__dot,
  .wb-header-btn,
  .wb-page-btn,
  .wb-zoom-btn,
  .wb-title-input,
  .wb-skip-link {
    transition: none;
  }

  .wb-fade-enter-active,
  .wb-fade-leave-active {
    transition: none;
  }

  @keyframes wb-pulse {
    0%, 100% { opacity: 1; }
  }
}

/* Phase 34 B7: Multi-delete confirmation dialog */
.wb-confirm-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.4);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1100;
}

.wb-confirm-dialog {
  background: var(--wb-bg-primary, #ffffff);
  border-radius: 12px;
  padding: 24px;
  min-width: 320px;
  max-width: 400px;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.2);
}

.wb-confirm-dialog__title {
  font-size: 16px;
  font-weight: 600;
  color: var(--wb-text-primary, #111827);
  margin: 0 0 8px 0;
}

.wb-confirm-dialog__hint {
  color: var(--wb-text-secondary, #6b7280);
  font-size: 13px;
  margin: 0 0 16px 0;
}

.wb-confirm-dialog__actions {
  display: flex;
  gap: 8px;
  justify-content: flex-end;
}

.wb-confirm-dialog__btn {
  padding: 8px 16px;
  border-radius: 8px;
  border: none;
  cursor: pointer;
  font-size: 14px;
  font-weight: 500;
  transition: background 0.15s ease;
}

.wb-confirm-dialog__btn--cancel {
  background: var(--wb-bg-secondary, #f3f4f6);
  color: var(--wb-text-primary, #111827);
}

.wb-confirm-dialog__btn--cancel:hover {
  background: var(--wb-bg-tertiary, #e5e7eb);
}

.wb-confirm-dialog__btn--delete {
  background: #ef4444;
  color: white;
}

.wb-confirm-dialog__btn--delete:hover {
  background: #dc2626;
}

.wb-confirm-dialog__btn--delete:active {
  background: #b91c1c;
}

/* Replay entry: CTA + stats row */
.wb-solo-room__replay-entry {
  position: fixed;
  bottom: 80px;
  right: 16px;
  display: flex;
  align-items: center;
  gap: 10px;
  z-index: 40;
}

.wb-solo-room__replay-btn {
  background: var(--wb-brand, #6366f1);
  color: white;
  border: none;
  padding: 10px 20px;
  border-radius: 10px;
  cursor: pointer;
  font-size: 0.875rem;
  font-weight: 600;
  box-shadow: 0 4px 12px rgba(99, 102, 241, 0.35);
  transition: background 0.15s, transform 0.1s;
  white-space: nowrap;
}

.wb-solo-room__replay-btn:hover {
  background: var(--primary-hover, #4f46e5);
  transform: translateY(-1px);
}

.wb-solo-room__replay-stats {
  font-size: 0.75rem;
  color: var(--color-text-muted, #64748b);
  background: var(--color-surface, #ffffff);
  padding: 6px 10px;
  border-radius: 8px;
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.08);
  white-space: nowrap;
}

.wb-solo-room__replay-hint {
  font-size: 0.75rem;
  color: var(--color-text-muted, #94a3b8);
  background: var(--color-surface, #ffffff);
  padding: 6px 12px;
  border-radius: 8px;
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.08);
}

/* Recording done prompt — green banner after Stop Recording */
.wb-solo-room__recording-done {
  position: fixed;
  bottom: 80px;
  left: 50%;
  transform: translateX(-50%);
  display: flex;
  align-items: center;
  gap: 12px;
  background: #ecfdf5;
  border: 1px solid #6ee7b7;
  color: #065f46;
  padding: 10px 20px;
  border-radius: 12px;
  font-size: 0.875rem;
  font-weight: 500;
  z-index: 50;
  box-shadow: 0 4px 16px rgba(16, 185, 129, 0.2);
  animation: wb-recording-done-in 0.3s ease-out;
}
.wb-solo-room__recording-done-share {
  background: #10b981;
  color: white;
  border: none;
  padding: 6px 14px;
  border-radius: 8px;
  font-size: 0.8125rem;
  font-weight: 600;
  cursor: pointer;
  white-space: nowrap;
  transition: background 0.15s;
}
.wb-solo-room__recording-done-share:hover {
  background: #059669;
}
.wb-solo-room__recording-done-later {
  background: transparent;
  border: 1px solid #a7f3d0;
  color: #065f46;
  padding: 6px 12px;
  border-radius: 8px;
  font-size: 0.8125rem;
  cursor: pointer;
  white-space: nowrap;
}
.wb-solo-room__recording-done-later:hover {
  background: #d1fae5;
}
@keyframes wb-recording-done-in {
  from { opacity: 0; transform: translateX(-50%) translateY(10px); }
  to { opacity: 1; transform: translateX(-50%) translateY(0); }
}

@keyframes wb-replay-pulse {
  0%, 100% { box-shadow: 0 4px 12px rgba(99, 102, 241, 0.35); }
  50% { box-shadow: 0 4px 24px rgba(99, 102, 241, 0.6); }
}

/* Phase 37: Test mode bar — clear EDIT → LIVE → REVIEW flow */
.wb-test-bar {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 14px;
  background: linear-gradient(to right, #eef2ff, #f5f3ff);
  border-bottom: 1.5px solid #c7d2fe;
  box-shadow: 0 1px 4px rgba(99, 102, 241, 0.08);
}
.wb-test-bar__tools {
  display: flex;
  gap: 4px;
}
.wb-test-bar__btn {
  padding: 5px 12px;
  border: 1.5px solid #c7d2fe;
  border-radius: 8px;
  background: #fff;
  font-size: 12px;
  font-weight: 500;
  cursor: pointer;
  white-space: nowrap;
  transition: all 0.15s ease;
}
.wb-test-bar__btn:hover {
  background: #e0e7ff;
  border-color: #a5b4fc;
}
.wb-test-bar__btn:active {
  transform: scale(0.97);
}
.wb-test-bar__btn--active {
  background: #6366f1;
  color: #fff;
  border-color: #6366f1;
  box-shadow: 0 2px 6px rgba(99, 102, 241, 0.25);
}
.wb-test-bar__btn--grade {
  background: #059669;
  color: #fff;
  border-color: #059669;
  font-weight: 600;
  box-shadow: 0 2px 6px rgba(5, 150, 105, 0.25);
}
.wb-test-bar__btn--grade:hover {
  background: #047857;
}
.wb-test-bar__btn--exit {
  margin-left: auto;
  color: #ef4444;
  border-color: #fca5a5;
  font-weight: 500;
}
.wb-test-bar__btn--exit:hover {
  background: #fee2e2;
  border-color: #f87171;
}
.wb-test-bar__sep {
  width: 1px;
  height: 22px;
  background: #c7d2fe;
  margin: 0 4px;
}
.wb-test-bar__phases {
  display: flex;
  align-items: center;
  gap: 8px;
}
.wb-test-bar__phase-label {
  font-size: 12px;
  font-weight: 700;
  padding: 5px 12px;
  border-radius: 8px;
  white-space: nowrap;
  letter-spacing: 0.2px;
  animation: phase-appear 0.25s ease-out;
}
@keyframes phase-appear {
  from { opacity: 0; transform: scale(0.9); }
  to { opacity: 1; transform: scale(1); }
}
.wb-test-bar__phase-label--live {
  background: #dcfce7;
  color: #166534;
  box-shadow: 0 0 0 2px rgba(34, 197, 94, 0.12);
}
.wb-test-bar__phase-label--review {
  background: #fef3c7;
  color: #92400e;
  box-shadow: 0 0 0 2px rgba(245, 158, 11, 0.12);
}
.wb-test-bar__btn--launch {
  background: #6366f1;
  color: #fff;
  border-color: #6366f1;
  font-weight: 600;
  box-shadow: 0 2px 8px rgba(99, 102, 241, 0.3);
  padding: 5px 16px;
}
.wb-test-bar__btn--launch:hover {
  background: #4f46e5;
  box-shadow: 0 3px 12px rgba(99, 102, 241, 0.35);
}
.wb-test-bar__btn--launch:disabled {
  opacity: 0.5;
  cursor: not-allowed;
  box-shadow: none;
}

/* Phase 37: Test mode toggle in page nav */
.wb-page-btn--active {
  background: #6366f1;
  color: #fff;
  border-color: #6366f1;
}
</style>
