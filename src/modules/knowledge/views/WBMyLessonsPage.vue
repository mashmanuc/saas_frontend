<!-- Phase 21: My Lessons page — list of tutor's saved lessons
     Ref: PHASE21_KNOWLEDGE_CORE.md -->
<template>
  <div class="wb-my-lessons max-w-7xl mx-auto px-4 py-8">
    <!-- Header -->
    <div class="flex items-center justify-between mb-6">
      <h1 class="text-2xl font-bold text-gray-900">{{ $t('winterboard.lesson.myLessonsTitle') }}</h1>
    </div>

    <!-- Tabs: Шаблони | Проведені уроки -->
    <div class="flex border-b border-gray-200 mb-6">
      <button
        type="button"
        :class="[
          'px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors',
          activeTab === 'templates'
            ? 'border-primary text-primary'
            : 'border-transparent text-gray-500 hover:text-gray-700',
        ]"
        @click="setTab('templates')"
      >
        {{ $t('winterboard.lesson.tabs.templates') }}
      </button>
      <button
        type="button"
        :class="[
          'px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors',
          activeTab === 'conducted'
            ? 'border-primary text-primary'
            : 'border-transparent text-gray-500 hover:text-gray-700',
        ]"
        @click="setTab('conducted')"
      >
        {{ $t('winterboard.lesson.tabs.conducted') }}
      </button>
    </div>

    <!-- Tab: Шаблони (existing content) -->
    <div v-if="activeTab === 'templates'">
    <!-- Search & Filters bar -->
    <div class="flex flex-wrap items-center gap-3 mb-4">
      <!-- Search -->
      <div class="flex-1 min-w-[200px]">
        <input
          v-model="searchQuery"
          type="text"
          :placeholder="$t('knowledge.lesson.search.placeholder')"
          class="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
          @input="onSearchInput"
        />
      </div>

      <!-- Status filter -->
      <select
        :value="activeStatus ?? ''"
        class="px-3 py-2 border border-gray-300 rounded-lg text-sm"
        @change="onStatusFilter(($event.target as HTMLSelectElement).value || null)"
      >
        <option value="">{{ $t('knowledge.lesson.search.allStatuses') }}</option>
        <option value="draft">{{ $t('knowledge.lesson.search.draft') }}</option>
        <option value="public">{{ $t('knowledge.lesson.search.public') }}</option>
      </select>

      <!-- Clear filters -->
      <button
        v-if="searchQuery || activeFolder || activeStatus"
        type="button"
        class="px-3 py-2 text-sm text-gray-500 hover:text-gray-700"
        @click="clearFilters"
      >
        {{ $t('knowledge.lesson.search.clearAll') }}
      </button>
    </div>

    <!-- Main layout: sidebar + grid -->
    <div class="flex gap-6">
      <!-- Folder sidebar -->
      <WBLessonFolders
        ref="folderSidebar"
        :active-folder="activeFolder"
        :total-count="total"
        @select="onFolderSelect"
        @changed="onFoldersChanged"
      />

      <!-- Content area -->
      <div class="flex-1 min-w-0">
        <!-- Loading skeleton (Phase 26 D1) -->
        <div v-if="isLoading" class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          <div v-for="i in 6" :key="i" class="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <div class="aspect-video bg-gray-200 animate-pulse" />
            <div class="p-4 space-y-2">
              <div class="h-4 bg-gray-200 rounded animate-pulse w-3/4" />
              <div class="h-3 bg-gray-200 rounded animate-pulse w-1/2" />
              <div class="h-5 bg-gray-200 rounded-full animate-pulse w-16 mt-2" />
            </div>
          </div>
        </div>

        <!-- Empty state: search no results (Phase 26 D3) -->
        <div v-else-if="lessons.length === 0 && searchQuery" class="text-center py-16">
          <div class="text-5xl mb-4">🔍</div>
          <h2 class="text-lg font-semibold text-gray-700">{{ $t('knowledge.lesson.empty.searchNoResults') }}</h2>
          <p class="text-sm text-gray-500 mt-1">{{ $t('knowledge.lesson.empty.tryDifferentQuery') }}</p>
        </div>

        <!-- Empty state: folder empty -->
        <div v-else-if="lessons.length === 0 && activeFolder" class="text-center py-16">
          <div class="text-5xl mb-4">📁</div>
          <h2 class="text-lg font-semibold text-gray-700">{{ $t('knowledge.lesson.empty.folderEmpty') }}</h2>
          <p class="text-sm text-gray-500 mt-1">{{ $t('knowledge.lesson.empty.folderEmptyHint') }}</p>
        </div>

        <!-- Empty state: no lessons at all -->
        <div v-else-if="lessons.length === 0" class="text-center py-16">
          <div class="text-5xl mb-4">📚</div>
          <h2 class="text-lg font-semibold text-gray-700">{{ $t('winterboard.lesson.emptyTitle') }}</h2>
          <p class="text-sm text-gray-500 mt-1">{{ $t('winterboard.lesson.emptySubtitle') }}</p>
          <router-link
            to="/winterboard/boards"
            class="inline-block mt-4 px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90 transition-colors"
          >
            {{ $t('knowledge.lesson.empty.createFirst') }}
          </router-link>
        </div>

        <!-- Grid of lessons -->
        <ErrorBoundary v-else>
          <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <div
              v-for="lesson in lessons"
              :key="lesson.id"
              class="wb-lesson-card bg-white rounded-xl border border-gray-200 overflow-hidden hover:shadow-md transition-shadow"
            >
              <!-- Preview: thumbnail or emoji fallback (Phase 25 BUG-6) -->
              <div class="aspect-video bg-gray-100 flex items-center justify-center overflow-hidden">
                <img
                  v-if="lesson.board_thumbnail_url"
                  :src="lesson.board_thumbnail_url"
                  :alt="lesson.title"
                  class="w-full h-full object-cover"
                  loading="lazy"
                  @error="onThumbnailError($event, lesson)"
                />
                <div v-else class="flex items-center justify-center bg-gradient-to-br from-green-50 to-green-100 w-full h-full">
                  <span class="text-2xl font-bold text-green-600/70">{{ lesson.title?.[0]?.toUpperCase() || '?' }}</span>
                </div>
              </div>

              <!-- Info -->
              <div class="p-4">
                <h3 class="font-semibold text-gray-900 truncate" :title="lesson.title">
                  {{ lesson.title }}
                </h3>
                <div class="flex items-center gap-2 mt-1">
                  <p class="text-xs text-gray-400">
                    {{ formatDate(lesson.created_at) }}
                  </p>
                  <!-- Лічильник сторінок -->
                  <span
                    v-if="lesson.page_count > 1"
                    class="inline-flex items-center gap-0.5 text-xs text-gray-400"
                    :title="`${lesson.page_count} сторінок`"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" class="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                      <path stroke-linecap="round" stroke-linejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                    {{ lesson.page_count }}
                  </span>
                </div>
                <div class="mt-1 inline-flex items-center gap-1">
                  <span
                    class="inline-block px-2 py-0.5 text-xs rounded-full"
                    :class="lesson.status === 'draft'
                      ? 'bg-gray-100 text-gray-600'
                      : 'bg-green-100 text-green-700'"
                  >
                    {{ $t(`knowledge.lesson.statusBadge.${lesson.status}`, lesson.status) }}
                  </span>
                </div>

                <!-- Actions -->
                <div class="mt-3 flex flex-wrap gap-2">
                  <!-- "Провести" — завжди fresh WBSession з KnowledgeLesson.snapshot → WBSoloRoom -->
                  <button
                    type="button"
                    class="px-3 py-1.5 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90 transition-colors disabled:opacity-50"
                    :disabled="openingLessonId === lesson.id"
                    @click="openLesson(lesson)"
                  >
                    {{ openingLessonId === lesson.id
                      ? '...'
                      : $t('knowledge.lesson.prepare.button') }}
                  </button>
                  <button
                    type="button"
                    class="px-3 py-1.5 border border-gray-300 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    :title="$t('knowledge.lesson.share.shareLesson')"
                    :disabled="sharingInProgress[lesson.id]"
                    @click="handleShare(lesson)"
                  >
                    🔗
                  </button>
                  <!-- Move to folder (Phase 25 BUG-4) -->
                  <MoveToFolderDropdown
                    :lesson-id="lesson.id"
                    :current-folder="lesson.folder"
                    @moved="onLessonMoved(lesson, $event)"
                  />
                  <!-- Eye: оновлює snapshot перед переглядом (best-effort), потім навігує -->
                  <button
                    type="button"
                    class="px-3 py-1.5 border border-gray-300 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-50 transition-colors inline-flex items-center disabled:opacity-50 disabled:cursor-wait"
                    :title="$t('knowledge.lesson.startReplay')"
                    :disabled="previewingLessonId === lesson.id"
                    @click="handlePreview(lesson)"
                  >
                    {{ previewingLessonId === lesson.id ? '⏳' : '👁' }}
                  </button>
                  <!-- Edit button (Phase 25 B1) -->
                  <button
                    type="button"
                    class="px-3 py-1.5 border border-gray-300 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-50 transition-colors"
                    :title="$t('knowledge.lesson.edit.editLesson')"
                    @click="openEditDialog(lesson)"
                  >
                    ✏️
                  </button>
                  <!-- Delete button (Phase 25 BUG-2) -->
                  <button
                    type="button"
                    class="px-3 py-1.5 border border-gray-300 text-red-500 rounded-lg text-sm font-medium hover:bg-red-50 hover:border-red-300 transition-colors disabled:opacity-50"
                    :title="$t('knowledge.lesson.delete')"
                    :disabled="deletingId === lesson.id"
                    @click="confirmDelete(lesson)"
                  >
                    🗑
                  </button>
                </div>

                <!-- Status action: Publish / Hide -->
                <div class="mt-2">
                  <button
                    type="button"
                    class="text-xs text-gray-500 hover:text-gray-700 transition-colors disabled:opacity-50"
                    :disabled="togglingId === lesson.id"
                    @click="toggleVisibility(lesson)"
                  >
                    {{ lesson.status === 'public'
                      ? $t('knowledge.lesson.search.hide')
                      : $t('knowledge.lesson.search.publish') }}
                  </button>
                </div>

                <!-- Share link display -->
                <div v-if="shareLinkMap[lesson.id]" class="mt-2 flex items-center gap-1">
                  <input
                    type="text"
                    :value="shareLinkMap[lesson.id]"
                    readonly
                    class="flex-1 text-xs px-2 py-1 bg-gray-50 border border-gray-200 rounded text-gray-600 truncate"
                    @click="($event.target as HTMLInputElement).select()"
                  />
                  <button
                    type="button"
                    class="px-2 py-1 text-xs bg-gray-100 border border-gray-200 rounded hover:bg-gray-200 transition-colors"
                    @click="copyShareLink(lesson.id)"
                  >
                    {{ copiedLessonId === lesson.id ? $t('knowledge.lesson.share.linkCopied') : $t('knowledge.lesson.share.copyLink') }}
                  </button>
                </div>
              </div>
            </div>
          </div>

          <!-- Load more (Phase 25 BUG-7: append mode) -->
          <div v-if="hasMore" class="mt-6 text-center">
            <button
              type="button"
              class="px-6 py-2 text-sm font-medium text-primary border border-primary/30 rounded-lg hover:bg-primary/5 transition-colors"
              @click="loadLessons(true)"
            >
              {{ $t('knowledge.lesson.search.loadMore') }}
            </button>
          </div>
        </ErrorBoundary>

        <!-- Error -->
        <p v-if="loadError" class="mt-4 text-sm text-red-600 text-center" role="alert">{{ loadError }}</p>
      </div>
    </div>
    </div> <!-- /tab: templates -->

    <!-- Tab: Проведені уроки -->
    <div v-else-if="activeTab === 'conducted'">
      <!-- Loading skeleton -->
      <div v-if="conductedLoading" class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <div v-for="i in 6" :key="i" class="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div class="aspect-video bg-gray-200 animate-pulse" />
          <div class="p-4 space-y-2">
            <div class="h-4 bg-gray-200 rounded animate-pulse w-3/4" />
            <div class="h-3 bg-gray-200 rounded animate-pulse w-1/2" />
          </div>
        </div>
      </div>

      <!-- Error -->
      <p v-else-if="conductedError" class="mt-4 text-sm text-red-600 text-center" role="alert">
        {{ conductedError }}
      </p>

      <!-- Empty -->
      <div v-else-if="conductedSessions.length === 0" class="text-center py-16">
        <div class="text-5xl mb-4">🎓</div>
        <h2 class="text-lg font-semibold text-gray-700">
          {{ $t('winterboard.lesson.conducted.emptyTitle') }}
        </h2>
        <p class="text-sm text-gray-500 mt-1">
          {{ $t('winterboard.lesson.conducted.emptySubtitle') }}
        </p>
      </div>

      <!-- Grid + bulk bar (v-else = є сесії) -->
      <div v-else>

      <!-- Bulk action bar — з'являється коли є виділені -->
      <div
        v-if="conductedSelectionMode"
        class="flex items-center justify-between gap-3 px-4 py-2.5 mb-4 bg-blue-50 border border-blue-200 rounded-xl"
      >
        <label class="flex items-center gap-2 cursor-pointer select-none">
          <span
            class="flex items-center justify-center w-5 h-5 rounded-[4px] border-[1.5px] cursor-pointer"
            :class="conductedAllSelected
              ? 'bg-blue-600 border-blue-600 text-white'
              : 'bg-white border-blue-600 text-blue-600'"
            @click="conductedAllSelected ? deselectAllConducted() : selectAllConducted()"
          >
            <svg v-if="conductedAllSelected" width="10" height="10" viewBox="0 0 10 10" fill="none">
              <path d="M1.5 5L4 7.5L8.5 2.5" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>
            </svg>
            <svg v-else width="10" height="10" viewBox="0 0 10 10" fill="none">
              <path d="M2 5h6" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>
            </svg>
          </span>
          <span class="text-sm font-semibold text-blue-700">
            {{ $t('winterboard.lesson.conducted.selectedCount', { n: conductedSelectedIds.length }) }}
          </span>
        </label>
        <div class="flex items-center gap-2">
          <button
            type="button"
            class="px-3 py-1.5 text-sm text-gray-600 border border-gray-300 rounded-lg hover:bg-white transition-colors"
            @click="deselectAllConducted"
          >
            {{ $t('winterboard.lesson.conducted.deselectAll') }}
          </button>
          <button
            type="button"
            class="px-3 py-1.5 text-sm font-semibold text-white bg-red-600 rounded-lg hover:bg-red-700 disabled:opacity-60 transition-colors inline-flex items-center gap-1.5"
            :disabled="conductedBulkDeleting"
            @click="showConductedBulkDeleteConfirm = true"
          >
            <svg width="13" height="13" viewBox="0 0 14 14" fill="none" aria-hidden="true">
              <path d="M1.5 3.5h11M4.5 3.5V2.5a1 1 0 011-1h3a1 1 0 011 1v1M5.5 6.5v4M8.5 6.5v4" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/>
              <path d="M2 3.5l.7 7a1 1 0 001 .9h6.6a1 1 0 001-.9l.7-7" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"/>
            </svg>
            {{ $t('winterboard.lesson.conducted.deleteSelected', { n: conductedSelectedIds.length }) }}
          </button>
        </div>
      </div>

      <!-- Grid of conducted sessions -->
      <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <div
          v-for="session in conductedSessions"
          :key="session.id"
          class="relative bg-white rounded-xl border overflow-hidden hover:shadow-md transition-shadow cursor-pointer"
          :class="conductedSelectedIds.includes(session.id)
            ? 'border-blue-500 bg-blue-50'
            : 'border-gray-200'"
          @click="conductedSelectionMode ? toggleConductedSelect(session.id) : openConductedSession(session)"
        >
          <!-- Checkbox (top-left, visible on hover or when selected) -->
          <div
            class="absolute top-2 left-2 z-10 opacity-0 transition-opacity group-hover:opacity-100"
            :class="{ 'opacity-100': conductedSelectedIds.includes(session.id) || conductedSelectionMode }"
            style="transition: opacity 0.1s"
            @click.stop="toggleConductedSelect(session.id)"
          >
            <span
              class="flex items-center justify-center w-5 h-5 rounded-[4px] shadow-sm cursor-pointer"
              :class="conductedSelectedIds.includes(session.id)
                ? 'bg-blue-600 border-[1.5px] border-blue-600 text-white'
                : 'bg-white/95 border-[1.5px] border-gray-300'"
            >
              <svg v-if="conductedSelectedIds.includes(session.id)" width="10" height="10" viewBox="0 0 10 10" fill="none">
                <path d="M1.5 5L4 7.5L8.5 2.5" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>
              </svg>
            </span>
          </div>

          <!-- Preview -->
          <div class="aspect-video bg-gray-100 flex items-center justify-center overflow-hidden">
            <img
              v-if="session.thumbnail_url"
              :src="session.thumbnail_url"
              :alt="session.name"
              class="w-full h-full object-cover"
              loading="lazy"
            />
            <div v-else class="flex items-center justify-center bg-gradient-to-br from-blue-50 to-blue-100 w-full h-full">
              <span class="text-2xl font-bold text-blue-600/70">{{ session.name?.[0]?.toUpperCase() || '?' }}</span>
            </div>
          </div>

          <!-- Info -->
          <div class="p-4">
            <div class="flex items-start justify-between gap-2">
              <h3 class="font-semibold text-gray-900 truncate flex-1" :title="session.name">
                {{ session.name }}
              </h3>
              <span
                v-if="session.has_recording"
                class="shrink-0 inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium rounded-full bg-red-50 text-red-700"
                :title="$t('winterboard.lesson.conducted.hasRecording')"
              >
                <span class="w-1.5 h-1.5 rounded-full bg-red-500" />
                REC
              </span>
            </div>

            <p
              v-if="session.origin_lesson_title"
              class="text-xs text-gray-500 mt-1 truncate"
              :title="session.origin_lesson_title"
            >
              {{ $t('winterboard.lesson.conducted.fromTemplate') }}: {{ session.origin_lesson_title }}
            </p>

            <div class="flex items-center gap-3 mt-2 text-xs text-gray-500">
              <span>{{ session.page_count }} {{ $t('winterboard.lesson.pagesShort') }}</span>
              <span v-if="session.has_recording">
                ⏱ {{ formatDuration(session.recording_duration_seconds) }}
              </span>
              <span>{{ formatDate(session.created_at) }}</span>
            </div>

            <!-- Actions -->
            <div class="mt-3 flex gap-2" @click.stop>
              <button
                type="button"
                class="px-3 py-1.5 border border-gray-300 text-red-500 rounded-lg text-sm font-medium hover:bg-red-50 hover:border-red-300 transition-colors disabled:opacity-50"
                :title="$t('winterboard.lesson.conducted.delete')"
                :disabled="conductedDeleting && conductedDeleteTarget?.id === session.id"
                @click="conductedDeleteTarget = session"
              >
                🗑
              </button>
            </div>
          </div>
        </div>
      </div>
      </div><!-- /v-else: є сесії -->
    </div>

    <!-- Edit dialog (Phase 25 B1) -->
    <LessonEditDialog
      v-model="showEditDialog"
      :lesson="editTarget"
      @saved="onLessonEdited"
    />

    <!-- Delete confirm dialog (Phase 25) -->
    <Teleport to="body">
      <div
        v-if="deleteTarget"
        class="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
        @click.self="deleteTarget = null"
      >
        <div class="bg-white rounded-xl p-6 w-full max-w-sm shadow-xl">
          <h3 class="text-lg font-semibold text-gray-900 mb-2">
            {{ $t('knowledge.lesson.deleteConfirmTitle') }}
          </h3>
          <p class="text-sm text-gray-600 mb-4">
            {{ $t('knowledge.lesson.deleteConfirmText', { title: deleteTarget.title }) }}
          </p>
          <div class="flex justify-end gap-3">
            <button
              type="button"
              class="px-4 py-2 text-sm text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50"
              @click="deleteTarget = null"
            >
              {{ $t('knowledge.lesson.deleteCancel') }}
            </button>
            <button
              type="button"
              class="px-4 py-2 text-sm text-white bg-red-600 rounded-lg hover:bg-red-700 disabled:opacity-50"
              :disabled="deletingId === deleteTarget?.id"
              @click="executeDelete"
            >
              {{ deletingId === deleteTarget?.id
                ? $t('knowledge.lesson.deleting')
                : $t('knowledge.lesson.deleteConfirm') }}
            </button>
          </div>
        </div>
      </div>
    </Teleport>

    <!-- Conducted: single delete confirm dialog -->
    <Teleport to="body">
      <div
        v-if="conductedDeleteTarget"
        class="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
        @click.self="conductedDeleteTarget = null"
      >
        <div class="bg-white rounded-xl p-6 w-full max-w-sm shadow-xl">
          <h3 class="text-lg font-semibold text-gray-900 mb-2">
            {{ $t('winterboard.lesson.conducted.confirmDelete.title') }}
          </h3>
          <p class="text-sm text-gray-600 mb-4">
            {{ $t('winterboard.lesson.conducted.confirmDelete.message', { name: conductedDeleteTarget.name }) }}
          </p>
          <div class="flex justify-end gap-3">
            <button
              type="button"
              class="px-4 py-2 text-sm text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50"
              @click="conductedDeleteTarget = null"
            >
              {{ $t('winterboard.lesson.conducted.confirmDelete.cancel') }}
            </button>
            <button
              type="button"
              class="px-4 py-2 text-sm text-white bg-red-600 rounded-lg hover:bg-red-700 disabled:opacity-50"
              :disabled="conductedDeleting"
              @click="executeConductedDelete"
            >
              {{ conductedDeleting ? '…' : $t('winterboard.lesson.conducted.confirmDelete.confirm') }}
            </button>
          </div>
        </div>
      </div>
    </Teleport>

    <!-- Conducted: bulk delete confirm dialog -->
    <Teleport to="body">
      <div
        v-if="showConductedBulkDeleteConfirm"
        class="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
        @click.self="showConductedBulkDeleteConfirm = false"
      >
        <div class="bg-white rounded-xl p-6 w-full max-w-sm shadow-xl">
          <h3 class="text-lg font-semibold text-gray-900 mb-2">
            {{ $t('winterboard.lesson.conducted.confirmBulkDelete.title', { n: conductedSelectedIds.length }) }}
          </h3>
          <p class="text-sm text-gray-600 mb-4">
            {{ $t('winterboard.lesson.conducted.confirmBulkDelete.message', { n: conductedSelectedIds.length }) }}
          </p>
          <div class="flex justify-end gap-3">
            <button
              type="button"
              class="px-4 py-2 text-sm text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50"
              @click="showConductedBulkDeleteConfirm = false"
            >
              {{ $t('winterboard.lesson.conducted.confirmBulkDelete.cancel') }}
            </button>
            <button
              type="button"
              class="px-4 py-2 text-sm text-white bg-red-600 rounded-lg hover:bg-red-700 disabled:opacity-50"
              :disabled="conductedBulkDeleting"
              @click="handleConductedBulkDelete"
            >
              {{ conductedBulkDeleting ? '…' : $t('winterboard.lesson.conducted.confirmBulkDelete.confirm') }}
            </button>
          </div>
        </div>
      </div>
    </Teleport>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { lessonSaveApi } from '../api/lessonSaveApi'
import type { MyLesson, MyLessonsParams } from '../api/lessonSaveApi'
import { lessonViewApi } from '../api/lessonViewApi'
import type { ConductedLessonItem } from '../api/lessonViewApi'
import { winterboardApi } from '@/modules/winterboard/api/winterboardApi'
import apiClient from '@/utils/apiClient'
import { useNotifyStore } from '@/stores/notifyStore'
import WBLessonFolders from '../components/WBLessonFolders.vue'
import LessonEditDialog from '../components/LessonEditDialog.vue'
import MoveToFolderDropdown from '../components/MoveToFolderDropdown.vue'
import ErrorBoundary from '@/components/ErrorBoundary.vue'

const router = useRouter()
const route = useRoute()
const { t } = useI18n()

const lessons = ref<MyLesson[]>([])
const isLoading = ref(true)
const loadError = ref<string | null>(null)
const shareLinkMap = ref<Record<string, string>>({})
const copiedLessonId = ref<string | null>(null)
const togglingId = ref<string | null>(null)
// B3 (2026-04-22): race guard — щоб спам-кліки не тригерили дублікати API
const sharingInProgress = ref<Record<string, boolean>>({})
const notify = useNotifyStore()

// Phase 24: search, status filter, folder
const searchQuery = ref('')
const activeFolder = ref<string | null>(null)
const activeStatus = ref<string | null>(null)
const total = ref(0)
const hasMore = ref(false)
const folderSidebar = ref<InstanceType<typeof WBLessonFolders> | null>(null)
let searchTimeout: ReturnType<typeof setTimeout> | null = null

// Phase 25: Delete
const deletingId = ref<string | null>(null)
const deleteTarget = ref<MyLesson | null>(null)

// "Провести" — race guard для fresh session open
const openingLessonId = ref<string | null>(null)

// Preview: loading guard поки оновлюємо snapshot
const previewingLessonId = ref<string | null>(null)

// Phase 25: Edit
const showEditDialog = ref(false)
const editTarget = ref<MyLesson | null>(null)

const PAGE_SIZE = 20

// ── Проведені уроки tab ──────────────────────────────────────────────
// Окремий список lesson-play WBSession з нового endpoint
// GET /api/v1/knowledge/my-lessons/conducted/.
// Існуючий "Шаблони" tab (lessons) залишається без змін.
type TabKey = 'templates' | 'conducted'
const activeTab = ref<TabKey>('templates')
const conductedSessions = ref<ConductedLessonItem[]>([])
const conductedLoading = ref(false)
const conductedError = ref<string | null>(null)
const conductedTotal = ref(0)
const conductedLoaded = ref(false)

// ── Conducted: bulk selection ────────────────────────────────────────
const conductedSelectedIds = ref<string[]>([])
const conductedSelectionMode = computed(() => conductedSelectedIds.value.length > 0)
const conductedAllSelected = computed(
  () => conductedSessions.value.length > 0 &&
        conductedSessions.value.every(s => conductedSelectedIds.value.includes(s.id)),
)

function toggleConductedSelect(id: string): void {
  const idx = conductedSelectedIds.value.indexOf(id)
  if (idx >= 0) {
    conductedSelectedIds.value.splice(idx, 1)
  } else {
    conductedSelectedIds.value.push(id)
  }
}

function selectAllConducted(): void {
  conductedSelectedIds.value = conductedSessions.value.map(s => s.id)
}

function deselectAllConducted(): void {
  conductedSelectedIds.value = []
}

// ── Conducted: single delete ─────────────────────────────────────────
const conductedDeleteTarget = ref<ConductedLessonItem | null>(null)
const conductedDeleting = ref(false)

async function executeConductedDelete(): Promise<void> {
  if (!conductedDeleteTarget.value) return
  const id = conductedDeleteTarget.value.id
  conductedDeleting.value = true
  try {
    await winterboardApi.deleteSession(id)
    conductedSessions.value = conductedSessions.value.filter(s => s.id !== id)
    conductedTotal.value = Math.max(0, conductedTotal.value - 1)
    conductedSelectedIds.value = conductedSelectedIds.value.filter(sid => sid !== id)
    conductedDeleteTarget.value = null
  } catch (err) {
    console.error('[WBMyLessonsPage] conducted delete error:', err)
    notify.error(t('winterboard.lesson.conducted.deleteError'))
  } finally {
    conductedDeleting.value = false
  }
}

// ── Conducted: bulk delete ────────────────────────────────────────────
const showConductedBulkDeleteConfirm = ref(false)
const conductedBulkDeleting = ref(false)

async function handleConductedBulkDelete(): Promise<void> {
  if (conductedBulkDeleting.value || conductedSelectedIds.value.length === 0) return
  conductedBulkDeleting.value = true
  const idsToDelete = [...conductedSelectedIds.value]
  try {
    await Promise.all(idsToDelete.map(id => winterboardApi.deleteSession(id)))
    conductedSessions.value = conductedSessions.value.filter(s => !idsToDelete.includes(s.id))
    conductedTotal.value = Math.max(0, conductedTotal.value - idsToDelete.length)
    conductedSelectedIds.value = []
    showConductedBulkDeleteConfirm.value = false
    notify.success(t('winterboard.lesson.conducted.deleteSelected', { n: idsToDelete.length }))
  } catch {
    notify.error(t('winterboard.lesson.conducted.deleteError'))
  } finally {
    conductedBulkDeleting.value = false
  }
}

async function loadConducted() {
  conductedLoading.value = true
  conductedError.value = null
  try {
    const res = await lessonViewApi.listConducted({ limit: 50 })
    conductedSessions.value = res.sessions
    conductedTotal.value = res.total
    conductedLoaded.value = true
  } catch (err) {
    console.error('[WBMyLessonsPage] loadConducted error:', err)
    conductedError.value = t('winterboard.lesson.conducted.loadError')
  } finally {
    conductedLoading.value = false
  }
}

function setTab(tab: TabKey) {
  activeTab.value = tab
  if (tab === 'conducted' && !conductedLoaded.value) {
    loadConducted()
  }
}

function openConductedSession(session: ConductedLessonItem) {
  // Відкриваємо існуючу lesson-play WBSession — той же route що loadToSession
  // використовує. Жодних нових створень.
  router.push({ name: 'winterboard-solo', params: { id: session.id } })
}

function formatDuration(seconds: number | null): string {
  if (!seconds || seconds <= 0) return '—'
  const m = Math.floor(seconds / 60)
  const s = Math.floor(seconds % 60)
  return m > 0 ? `${m}хв ${s}с` : `${s}с`
}

onMounted(() => {
  loadLessons()
})

// 1-click auto-open для resume_last_lesson CTA (?open=<lessonId>).
// Викликає openLesson() → loadToSession → WBSoloRoom (fresh session, template незмінний).
//
// Watch-sources: [lessons, isLoading, route.query.open]
//   - [lessons, isLoading] — чекаємо поки API відповів (slow network safe)
//   - route.query.open — ловить повторний захід у той самий route
const openedIds = new Set<string>()

watch(
  [lessons, isLoading, () => route.query.open],
  async () => {
    if (isLoading.value) return

    const openId = route.query.open
    if (!openId || typeof openId !== 'string') return
    if (openedIds.has(openId)) return

    openedIds.add(openId)

    const target = lessons.value.find((l) => l.id === openId)

    // Чистимо query одразу — refresh/back не повторить open
    await router.replace({ query: { ...route.query, open: undefined } })

    if (!target) {
      console.info('[WBMyLessonsPage] open=%s not found in loaded lessons', openId)
      return
    }

    // Провести: завжди fresh session від template → WBSoloRoom
    await openLesson(target)
  },
  { immediate: true },
)

async function loadLessons(append = false) {
  if (!append) {
    isLoading.value = true
  }
  loadError.value = null
  try {
    const params: MyLessonsParams = {
      limit: PAGE_SIZE,
    }
    if (searchQuery.value.trim()) params.q = searchQuery.value.trim()
    if (activeFolder.value) params.folder = activeFolder.value
    if (activeStatus.value) params.status = activeStatus.value

    // Phase 25 BUG-7 FIX: use current length as offset for "load more"
    if (append) {
      params.offset = lessons.value.length
    } else {
      params.offset = 0
    }

    const result = await lessonSaveApi.getMyLessonsFiltered(params)

    if (append) {
      lessons.value = [...lessons.value, ...result.lessons]
    } else {
      lessons.value = result.lessons
    }
    total.value = result.total
    hasMore.value = result.has_more
  } catch (err) {
    console.error('[WBMyLessonsPage] fetch error:', err)
    loadError.value = t('winterboard.lesson.fetchError')
  } finally {
    isLoading.value = false
  }
}

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    })
  } catch {
    return iso
  }
}

async function handleShare(lesson: MyLesson): Promise<void> {
  // B3 (2026-04-22): race guard — ігнор повторних кліків поки йде запит.
  if (sharingInProgress.value[lesson.id]) return
  sharingInProgress.value[lesson.id] = true
  try {
    const result = await lessonViewApi.generateShareLink(lesson.id)
    shareLinkMap.value[lesson.id] = result.share_url

    // Auto-copy + visible feedback — раніше inline input знизу картки був
    // занадто непомітним, user не розумів що клік спрацював (B3 evidence
    // 2026-04-22: "натискаю Поділитися — нічого не відбувається").
    try {
      await navigator.clipboard.writeText(result.share_url)
      copiedLessonId.value = lesson.id
      setTimeout(() => { copiedLessonId.value = null }, 2000)
      notify.success(t('knowledge.lesson.share.linkCopied'))
    } catch {
      // Clipboard fail (permissions / insecure context / http) — fallback
      // toast з повідомленням про створення (input все одно видно на картці).
      notify.success(t('knowledge.lesson.share.linkCreated'))
    }
  } catch (err) {
    console.error('[WBMyLessonsPage] share error:', err)
    const status = (err as { response?: { status?: number } })?.response?.status
    if (status === 400) {
      notify.warning(t('knowledge.lesson.share.publishFirst'))
    } else {
      notify.error(t('knowledge.lesson.shareError'))
    }
  } finally {
    sharingInProgress.value[lesson.id] = false
  }
}

function copyShareLink(lessonId: string): void {
  const link = shareLinkMap.value[lessonId]
  if (!link) return
  navigator.clipboard.writeText(link).then(() => {
    copiedLessonId.value = lessonId
    setTimeout(() => { copiedLessonId.value = null }, 2000)
  })
}

// Phase 24: Search (debounced 300ms)
function onSearchInput() {
  if (searchTimeout) clearTimeout(searchTimeout)
  searchTimeout = setTimeout(() => loadLessons(), 300)
}

// Phase 24: Folder selection
// Phase 26 A2: reset search when switching folders to avoid desync
function onFolderSelect(folderId: string | null) {
  activeFolder.value = folderId
  searchQuery.value = ''
  loadLessons()
}

// Phase 26 A1 + INV-P26-6: Folder changed (rename/create/delete)
// Reload folders to get fresh counts, validate activeFolder, then reload lessons
async function onFoldersChanged() {
  await folderSidebar.value?.loadFolders()
  // INV-P26-6: if activeFolder is stale (deleted), reset to root
  if (activeFolder.value && folderSidebar.value) {
    const folders = (folderSidebar.value as any).folders as Array<{ id: string }>
    if (folders && !folders.some(f => f.id === activeFolder.value)) {
      activeFolder.value = null
    }
  }
  await loadLessons()
}

// Phase 24: Filter by status
function onStatusFilter(status: string | null) {
  activeStatus.value = status
  loadLessons()
}

// Phase 24: Clear all filters
function clearFilters() {
  searchQuery.value = ''
  activeFolder.value = null
  activeStatus.value = null
  loadLessons()
}

async function toggleVisibility(lesson: MyLesson): Promise<void> {
  togglingId.value = lesson.id
  try {
    const endpoint = lesson.status === 'public'
      ? `/v1/knowledge/my-lessons/${lesson.id}/unpublish/`
      : `/v1/knowledge/my-lessons/${lesson.id}/republish/`
    const res = await apiClient.post(endpoint) as { status: string }
    lesson.status = res.status ?? (lesson.status === 'public' ? 'draft' : 'public')
  } catch (err) {
    console.error('[WBMyLessonsPage] toggle visibility error:', err)
    loadError.value = t('knowledge.lesson.toggleVisibilityError')
  } finally {
    togglingId.value = null
  }
}

// ── Preview: auto-refresh snapshot перед переглядом ──────────────────
// source_session_id є в серіалайзері → оновлюємо snapshot з поточного
// стану WBSession. Best-effort: помилка не блокує навігацію.
async function handlePreview(lesson: MyLesson): Promise<void> {
  if (previewingLessonId.value) return
  previewingLessonId.value = lesson.id
  try {
    if (lesson.source_session_id) {
      await lessonViewApi.updateSnapshot(lesson.id, lesson.source_session_id)
    }
  } catch {
    // best-effort: якщо snapshot не оновився — відкриємо наявний
  } finally {
    previewingLessonId.value = null
  }
  router.push({
    name: 'LessonView',
    params: { lessonSlug: lesson.slug },
    query: { preview: '1' },
  })
}

// ── Phase 25: Delete ─────────────────────────────────────────────────
function confirmDelete(lesson: MyLesson): void {
  deleteTarget.value = lesson
}

async function executeDelete(): Promise<void> {
  if (!deleteTarget.value) return
  const id = deleteTarget.value.id
  deletingId.value = id
  try {
    await lessonSaveApi.deleteLesson(id)
    lessons.value = lessons.value.filter(l => l.id !== id)
    total.value = Math.max(0, total.value - 1)
    hasMore.value = lessons.value.length < total.value
    deleteTarget.value = null
  } catch (err) {
    console.error('[WBMyLessonsPage] Delete failed:', err)
    loadError.value = t('knowledge.lesson.deleteError')
  } finally {
    deletingId.value = null
  }
}

// ── Phase 25: Edit ───────────────────────────────────────────────────
function openEditDialog(lesson: MyLesson): void {
  editTarget.value = lesson
  showEditDialog.value = true
}

function onLessonEdited(updated: MyLesson): void {
  const idx = lessons.value.findIndex(l => l.id === updated.id)
  if (idx >= 0) {
    lessons.value[idx] = { ...lessons.value[idx], ...updated }
  }
}

// ── Phase 25: Thumbnail error fallback ───────────────────────────────
function onThumbnailError(event: Event, lesson: MyLesson): void {
  const img = event.target as HTMLImageElement
  img.style.display = 'none'
  lesson.board_thumbnail_url = ''
}

// ── "Провести" — завжди fresh WBSession з KnowledgeLesson.snapshot ────
// loadToSession: кожного разу нова сесія → template незмінний → урок повторюваний.
// Сесія зберігається в "проведені уроки" після закриття.
async function openLesson(lesson: MyLesson): Promise<void> {
  if (openingLessonId.value) return
  openingLessonId.value = lesson.id
  loadError.value = null
  try {
    const { session_id } = await lessonViewApi.loadToSession(lesson.id)
    await router.push({
      name: 'winterboard-solo',
      params: { id: session_id },
    })
  } catch (err) {
    console.error('[WBMyLessonsPage] openLesson error:', err)
    notify.error(t('knowledge.lesson.prepare.error'))
  } finally {
    openingLessonId.value = null
  }
}

// ── "Конструктор" — persistent prep session (кнопка буде додана окремо) ──
// getOrCreate: повертає існуючу prep сесію або seedить нову з snapshot.
// INV-CONSTR-5: накопичення = очікувана поведінка в constructor.
async function openConstructor(lesson: MyLesson): Promise<void> {
  if (openingLessonId.value) return
  openingLessonId.value = lesson.id
  try {
    const { wb_session_id } = await lessonViewApi.prepareLesson(lesson.id)
    await router.push({
      name: 'winterboard-prepare',
      params: { id: wb_session_id },
    })
  } catch (err) {
    console.error('[WBMyLessonsPage] openConstructor error:', err)
    notify.error(t('knowledge.lesson.prepare.error'))
  } finally {
    openingLessonId.value = null
  }
}

// ── Phase 25: Move to folder (BUG-4) ────────────────────────────────
function onLessonMoved(lesson: MyLesson, folderId: string | null): void {
  lesson.folder = folderId
  folderSidebar.value?.loadFolders()
  // If filtering by folder and lesson moved out — remove from view
  if (activeFolder.value && activeFolder.value !== folderId && activeFolder.value !== 'root') {
    lessons.value = lessons.value.filter(l => l.id !== lesson.id)
    total.value = Math.max(0, total.value - 1)
    hasMore.value = lessons.value.length < total.value
  }
}
</script>
