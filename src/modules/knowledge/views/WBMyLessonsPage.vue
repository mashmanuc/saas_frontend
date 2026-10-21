<!-- Phase 21: My Lessons page — list of tutor's saved lessons
     Ref: PHASE21_KNOWLEDGE_CORE.md -->
<template>
  <div class="wb-my-lessons max-w-7xl mx-auto px-4 py-8">
    <!-- Header -->
    <div class="flex items-center justify-between mb-6">
      <h1 class="text-2xl font-bold text-gray-900">{{ $t('winterboard.lesson.myLessonsTitle') }}</h1>
      <!-- LessonGrant: коди передачі паків між тьюторами (2026-07, Варіант A) -->
      <!-- Підпис у tooltip: сама назва «Передати уроки» не пояснює, кому й що
           саме (візуальний огляд 2026-09-22, п.3). Текст той самий, що перший
           крок у модалці. -->
      <div class="flex flex-wrap items-center justify-end gap-2">
        <!-- «Згенерувати урок історії» (2026-10-09): кнопка існує, лише коли бекенд віддав програму (allowlist). -->
        <button
          v-if="historyProgram"
          type="button"
          class="px-4 py-2 text-sm font-medium rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
          :title="$t('knowledge.historyGen.subtitle')"
          @click="showHistoryGen = true"
        >
          ✨ {{ $t('knowledge.historyGen.headerBtn') }}
        </button>
        <button
          type="button"
          class="px-4 py-2 text-sm font-medium rounded-lg border border-primary text-primary hover:bg-primary hover:text-white transition-colors"
          :title="$t('knowledge.grants.headerBtnHint')"
          @click="showGrantModal = true"
        >
          🎁 {{ $t('knowledge.grants.headerBtn') }}
        </button>
      </div>
    </div>

    <GrantTransferModal v-if="showGrantModal" :initial-grant="quickGrantResult" @close="closeGrantModal" />
    <HistoryGenerateModal
      v-if="showHistoryGen && historyProgram"
      :program="historyProgram"
      @close="showHistoryGen = false"
      @created="onHistoryLessonCreated"
      @conduct="onHistoryLessonConduct"
    />

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

      <!-- Плитки / список (макет «Мої уроки», 2026-10-22). Фільтра «чернетка / опублікований» більше
           немає: це доступ за посиланням, а не готовність уроку, — ярлик прибрано разом з ним. -->
      <div class="ml-view" role="group" :aria-label="$t('winterboard.boards.viewToggleLabel')">
        <button
          type="button"
          class="ml-view__btn"
          :class="{ 'ml-view__btn--on': lessonView === 'tiles' }"
          :aria-pressed="lessonView === 'tiles'"
          :title="$t('winterboard.boards.viewGrid')"
          @click="setLessonView('tiles')"
        >▦</button>
        <button
          type="button"
          class="ml-view__btn"
          :class="{ 'ml-view__btn--on': lessonView === 'list' }"
          :aria-pressed="lessonView === 'list'"
          :title="$t('winterboard.boards.viewList')"
          @click="setLessonView('list')"
        >☰</button>
      </div>

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

    <!-- Телефон: папки згорнуті за кнопкою — розгорнутими вони забирали 115 px
         і перша картка уроку починалась із другого екрана. Той самий вигляд, що
         в Студії й Записах (візуальний огляд 2026-09-22, пп.3–5). -->
    <button
      type="button"
      class="mb-3 flex w-full items-center gap-2 rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm font-medium text-gray-700 md:hidden"
      :aria-expanded="mobileFoldersOpen"
      @click="mobileFoldersOpen = !mobileFoldersOpen"
    >
      📂 {{ t('winterboard.folders.sidebar') }}
      <span class="ml-auto opacity-60" aria-hidden="true">{{ mobileFoldersOpen ? '▴' : '▾' }}</span>
    </button>

    <!-- Main layout: sidebar + grid -->
    <div class="flex flex-col md:flex-row gap-4 md:gap-6">
      <!-- Folder sidebar -->
      <WBLessonFolders
        ref="folderSidebar"
        :class="mobileFoldersOpen ? '' : 'hidden md:block'"
        :active-folder="activeFolder"
        :total-count="allTotal ?? total"
        @select="onFolderSelect"
        @changed="onFoldersChanged"
      />

      <!-- Content area -->
      <div class="flex-1 min-w-0">
        <!-- Відкрита папка (2026-10-13): раніше не було видно, що саме відкрито -->
        <div v-if="activeFolderLabel !== null" class="mb-3 flex items-center gap-2 text-sm" data-testid="folder-heading">
          <span aria-hidden="true">📁</span>
          <span class="font-semibold text-gray-800 truncate">{{ activeFolderLabel }}</span>
          <span v-if="!isLoading" class="text-gray-500 shrink-0">· {{ $t('knowledge.folder.count', { n: total }) }}</span>
        </div>
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
          <!-- Bulk action bar шаблонів -->
          <div
            v-if="templateSelectionMode"
            class="flex items-center justify-between gap-3 px-4 py-2.5 mb-4 bg-blue-50 border border-blue-200 rounded-xl"
          >
            <label class="flex items-center gap-2 cursor-pointer select-none">
              <span
                class="flex items-center justify-center w-5 h-5 rounded-[4px] border-[1.5px] cursor-pointer"
                :class="templateAllSelected
                  ? 'bg-blue-600 border-blue-600 text-white'
                  : 'bg-white border-blue-600 text-blue-600'"
                @click="templateAllSelected ? deselectAllTemplates() : selectAllTemplates()"
              >
                <svg v-if="templateAllSelected" width="10" height="10" viewBox="0 0 10 10" fill="none">
                  <path d="M1.5 5L4 7.5L8.5 2.5" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>
                </svg>
                <svg v-else width="10" height="10" viewBox="0 0 10 10" fill="none">
                  <path d="M2 5h6" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>
                </svg>
              </span>
              <span class="text-sm font-semibold text-blue-700">
                {{ $t('knowledge.lesson.bulkDelete.selectedCount', { n: templateSelectedIds.length }) }}
              </span>
            </label>
            <div class="flex items-center gap-2">
              <button
                type="button"
                class="px-3 py-1.5 text-sm text-gray-600 border border-gray-300 rounded-lg hover:bg-white transition-colors"
                @click="deselectAllTemplates"
              >
                {{ $t('knowledge.lesson.bulkDelete.deselectAll') }}
              </button>
              <!-- Кілька уроків в одну папку (2026-10-13): раніше — лише по одному через «⋯» -->
              <MoveToFolderDropdown
                :lesson-ids="templateSelectedIds"
                :folders="sidebarFolders"
                @moved="onBulkMoved"
              >
                <template #trigger="{ toggle }">
                  <button
                    type="button"
                    class="px-3 py-1.5 text-sm font-medium text-gray-700 border border-gray-300 rounded-lg hover:bg-white transition-colors"
                    data-test="bulk-move"
                    @click="toggle"
                  >
                    📂 {{ $t('knowledge.lesson.move.moveSelected', { n: templateSelectedIds.length }) }}
                  </button>
                </template>
              </MoveToFolderDropdown>
              <button
                type="button"
                class="px-3 py-1.5 text-sm font-semibold text-white bg-red-600 rounded-lg hover:bg-red-700 disabled:opacity-60 transition-colors inline-flex items-center gap-1.5"
                :disabled="templateBulkDeleting"
                @click="showTemplateBulkDeleteConfirm = true"
              >
                <svg width="13" height="13" viewBox="0 0 14 14" fill="none" aria-hidden="true">
                  <path d="M1.5 3.5h11M4.5 3.5V2.5a1 1 0 011-1h3a1 1 0 011 1v1M5.5 6.5v4M8.5 6.5v4" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/>
                  <path d="M2 3.5l.7 7a1 1 0 001 .9h6.6a1 1 0 001-.9l.7-7" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"/>
                </svg>
                {{ $t('knowledge.lesson.bulkDelete.deleteSelected', { n: templateSelectedIds.length }) }}
              </button>
            </div>
          </div>

          <div class="ml-grid" :class="{ 'ml-grid--list': lessonView === 'list' }">
            <!-- ⚠️ Без `overflow-hidden`: на картці живуть випадні меню
                 «Поділитися ▾» і «⋯» (absolute). Картка з обрізанням ховала
                 їх повністю — кнопка натискалась, а меню не було видно
                 (власник 2026-09-24). Кути мініатюри тримає сама мініатюра. -->
            <div
              v-for="(lesson, li) in lessons"
              :key="lesson.id"
              :style="{ '--i': Math.min(li, 12) }"
              class="wb-lesson-card wb-template-card ml-card relative"
              :class="{ 'ml-card--selected': templateSelectedIds.includes(lesson.id) }"
            >
              <!-- Checkbox (top-left) -->
              <div
                class="wb-template-checkbox absolute top-2 left-2 z-10 transition-opacity"
                :class="templateSelectedIds.includes(lesson.id) || templateSelectionMode ? 'opacity-100' : 'opacity-0'"
                @click.stop="toggleTemplateSelect(lesson.id)"
              >
                <span
                  class="flex items-center justify-center w-5 h-5 rounded-[4px] shadow-sm cursor-pointer"
                  :class="templateSelectedIds.includes(lesson.id)
                    ? 'bg-blue-600 border-[1.5px] border-blue-600 text-white'
                    : 'bg-white/95 border-[1.5px] border-gray-300'"
                >
                  <svg v-if="templateSelectedIds.includes(lesson.id)" width="10" height="10" viewBox="0 0 10 10" fill="none">
                    <path d="M1.5 5L4 7.5L8.5 2.5" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>
                  </svg>
                </span>
              </div>

              <!-- Preview: thumbnail or emoji fallback (Phase 25 BUG-6).
                   2026-09-23 (візуальний огляд, п.3): літера на градієнті нічого
                   не каже про урок, а забирала цілий блок 16:9 — на телефоні
                   назва уроку опинялась нижче половини екрана. Справжня
                   мініатюра лишається на всю висоту; заглушка — вузька смужка. -->
              <!-- Обкладинка (макет «Мої уроки», 2026-10-22): знімок дошки, а без нього — знак теми
                   з назви або монограма, як у Студії (utils/boardCover.ts). Статусу «Чернетка/Опублікований»
                   більше немає: поле означає доступ за посиланням, а не готовність уроку. -->
              <div
                class="ml-cover"
                :class="{ 'ml-cover--mono': coverOf(lesson.title).mono }"
                :style="{ '--h': coverOf(lesson.title).hue }"
              >
                <img
                  v-if="lesson.board_thumbnail_url"
                  :src="lesson.board_thumbnail_url"
                  :alt="lesson.title"
                  class="ml-cover__img"
                  loading="lazy"
                  @error="onThumbnailError($event, lesson)"
                />
                <template v-else>{{ coverOf(lesson.title).glyph }}</template>
              </div>

              <!-- Info -->
              <div class="ml-info">
                <div class="ml-text">
                  <p v-if="subjectLabel(lesson.subject_tag)" class="ml-subj">{{ subjectLabel(lesson.subject_tag) }}</p>
                  <h3 class="ml-title" :title="lesson.title">
                    {{ lesson.title }}
                  </h3>
                  <p class="ml-meta">
                    <span>{{ $t('winterboard.boards.pageCount', { n: lesson.page_count }) }}</span>
                    <!-- Власник 2026-10-15: дата І час збереження (кілька збережень за день розрізняються) — не лише день, як у макеті -->
                    <span>{{ formatDate(lesson.created_at) }}</span>
                  </p>
                </div>

                <!-- Actions -->
                <div class="ml-acts">
                  <!-- "Провести" — завжди fresh WBSession з KnowledgeLesson.snapshot → WBSoloRoom -->
                  <button
                    type="button"
                    class="ml-go"
                    :disabled="openingLessonId === lesson.id"
                    @click="openLesson(lesson)"
                  >
                    <span class="ml-go__tri" aria-hidden="true" />
                    {{ openingLessonId === lesson.id
                      ? $t('knowledge.lesson.prepare.starting')
                      : $t('knowledge.lesson.prepare.button') }}
                  </button>
                  <!-- Друга дія і «⋯» — завжди в одному рядку, інакше на
                       вузькій картці кожна кнопка займала свій рядок. -->
                  <div class="flex items-center gap-2">
                  <!-- Одна кнопка «Поділитися ▾»: 👁 Показати (демо-лінк) / 🎁 Передати копію (grant) -->
                  <ShareLessonMenu
                    :busy="sharingInProgress[lesson.id] || quickGrantingId === lesson.id"
                    @share="handleShare(lesson)"
                    @transfer="quickGrant(lesson)"
                  />
                  <!-- Решта дій — в одному меню «…» (візуальний огляд
                       2026-09-22, Топ-10 №8): на картці було вісім елементів
                       керування, і «Провести» тонуло серед іконок. -->
                  <div class="relative" :data-lesson-menu="lesson.id">
                    <button
                      type="button"
                      class="px-3 py-1.5 border border-gray-300 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-50 transition-colors"
                      :title="$t('knowledge.lesson.moreActions')"
                      :aria-label="$t('knowledge.lesson.moreActions')"
                      aria-haspopup="menu"
                      :aria-expanded="openMenuLessonId === lesson.id"
                      data-test="lesson-menu"
                      @click.stop="toggleLessonMenu(lesson.id)"
                    >
                      ⋯
                    </button>

                    <div
                      v-if="openMenuLessonId === lesson.id"
                      class="absolute right-0 z-20 mt-1 w-56 rounded-lg border border-gray-200 bg-white py-1 shadow-lg"
                      role="menu"
                      @click.stop
                    >
                      <button
                        type="button"
                        role="menuitem"
                        class="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-gray-700 hover:bg-gray-50"
                        @click="closeLessonMenu(); openEditDialog(lesson)"
                      >
                        ✏️ {{ $t('knowledge.lesson.edit.editLesson') }}
                      </button>

                      <!-- Той самий випадайник папок, лише рядком у меню -->
                      <MoveToFolderDropdown
                        :lesson-id="lesson.id"
                        :current-folder="lesson.folder"
                        :folders="sidebarFolders"
                        @moved="onLessonMoved(lesson, $event)"
                      >
                        <template #trigger="{ toggle }">
                          <button
                            type="button"
                            role="menuitem"
                            class="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-gray-700 hover:bg-gray-50"
                            @click="toggle"
                          >
                            📂 {{ $t('knowledge.lesson.move.moveToFolder') }}
                          </button>
                        </template>
                      </MoveToFolderDropdown>

                      <button
                        type="button"
                        role="menuitem"
                        class="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-gray-700 hover:bg-gray-50 disabled:opacity-50"
                        :disabled="togglingId === lesson.id"
                        @click="closeLessonMenu(); toggleVisibility(lesson)"
                      >
                        👁 {{ lesson.status === 'public'
                          ? $t('knowledge.lesson.search.hide')
                          : $t('knowledge.lesson.search.publish') }}
                      </button>

                      <div class="my-1 border-t border-gray-100" role="separator" />

                      <button
                        type="button"
                        role="menuitem"
                        class="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-red-600 hover:bg-red-50 disabled:opacity-50"
                        :disabled="deletingId === lesson.id"
                        @click="closeLessonMenu(); confirmDelete(lesson)"
                      >
                        🗑 {{ $t('knowledge.lesson.delete') }}
                      </button>
                    </div>
                  </div>
                  </div>
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

      <!-- Search bar -->
      <div class="mb-4">
        <input
          v-model="conductedSearchQuery"
          type="search"
          class="w-full max-w-xs px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
          :placeholder="$t('winterboard.lesson.conducted.searchPlaceholder')"
          @input="onConductedSearch"
        />
      </div>

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

      <!-- Стрічка проведених за днями (макет «Мої уроки», 2026-10-22). Учень — лише коли урок почали
           «з учнем»; тривалість — лише коли вели запис (кінця уроку сервер не зберігає); «Ще раз» — лише
           коли проведено з готового уроку. Без цього рядок просто коротший. -->
      <div class="ml-tl">
        <template v-for="day in conductedByDay" :key="day.key">
          <div class="ml-tl__day">{{ day.label }}</div>
          <div
            v-for="session in day.items"
            :key="session.id"
            class="wb-conducted-card ml-card ml-row relative"
            :class="{ 'ml-card--selected': conductedSelectedIds.includes(session.id) }"
            :style="{ '--i': Math.min(session._i, 12) }"
            @click="conductedSelectionMode ? toggleConductedSelect(session.id) : openConductedSession(session)"
          >
            <!-- Checkbox (top-left, visible on hover or when selected) -->
            <div
              class="wb-conducted-checkbox ml-check"
              :class="conductedSelectedIds.includes(session.id) || conductedSelectionMode ? 'opacity-100' : 'opacity-0'"
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

            <div
              class="ml-cover ml-cover--small"
              :class="{ 'ml-cover--mono': coverOf(session.origin_lesson_title || session.name).mono }"
              :style="{ '--h': coverOf(session.origin_lesson_title || session.name).hue }"
            >{{ coverOf(session.origin_lesson_title || session.name).glyph }}</div>

            <div class="ml-text">
              <h3 class="ml-title ml-title--one" :title="session.origin_lesson_title || session.name">
                {{ session.origin_lesson_title || session.name }}
              </h3>
              <p class="ml-meta">
                <span>{{ formatTime(session.created_at) }}</span>
                <span v-if="studentName(session)" class="ml-who">
                  <b aria-hidden="true">{{ studentName(session).charAt(0) }}</b>{{ studentName(session) }}
                </span>
                <span v-if="session.has_recording" :title="$t('winterboard.lesson.conducted.hasRecording')">
                  ⏱ {{ formatDuration(session.recording_duration_seconds) }}
                </span>
                <span>{{ $t('winterboard.boards.pageCount', { n: session.page_count }) }}</span>
              </p>
            </div>

            <!-- Actions -->
            <div class="ml-acts" @click.stop>
              <button
                v-if="session.origin_lesson_id"
                type="button"
                class="ml-go ml-go--small"
                :disabled="openingLessonId === session.origin_lesson_id"
                @click="openLesson({ id: session.origin_lesson_id } as MyLesson)"
              >
                <span class="ml-go__tri" aria-hidden="true" />
                {{ openingLessonId === session.origin_lesson_id
                  ? $t('knowledge.lesson.prepare.starting')
                  : $t('winterboard.lesson.conducted.again') }}
              </button>
              <button
                type="button"
                class="ml-ic ml-ic--danger"
                :title="$t('winterboard.lesson.conducted.delete')"
                :disabled="conductedDeleting && conductedDeleteTarget?.id === session.id"
                @click="conductedDeleteTarget = session"
              >
                🗑
              </button>
            </div>
          </div>
        </template>
      </div>

      <!-- Load more -->
      <div v-if="conductedHasMore" class="mt-6 text-center">
        <button
          type="button"
          class="px-6 py-2 text-sm font-medium text-primary border border-primary/30 rounded-lg hover:bg-primary/5 transition-colors disabled:opacity-50"
          :disabled="conductedLoadingMore"
          @click="loadConducted(true)"
        >
          {{ conductedLoadingMore ? '…' : $t('winterboard.lesson.conducted.loadMore') }}
        </button>
      </div>
      </div><!-- /v-else: є сесії -->
    </div>

    <!-- Edit dialog (Phase 25 B1) -->
    <LessonEditDialog
      v-model="showEditDialog"
      :lesson="editTarget"
      @saved="onLessonEdited"
    />

    <!-- «Зберегти як новий шаблон» з підтвердження після «← Мої уроки» (власник 2026-10-03):
         те саме вікно й API, що на дошці уроку; проведення — те, з якого щойно вийшли. -->
    <WBSaveLessonDialog
      v-model="showSaveCopyDialog"
      mode="copy"
      :session-id="saveCopySessionId"
      :default-title="saveCopyDefaultTitle"
      @saved="onCopySaved"
    />

    <!-- Templates: bulk delete confirm dialog -->
    <Teleport to="body">
      <div
        v-if="showTemplateBulkDeleteConfirm"
        class="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
        @click.self="showTemplateBulkDeleteConfirm = false"
      >
        <div class="bg-white rounded-xl p-6 w-full max-w-sm shadow-xl">
          <h3 class="text-lg font-semibold text-gray-900 mb-2">
            {{ $t('knowledge.lesson.bulkDelete.title', { n: templateSelectedIds.length }) }}
          </h3>
          <p class="text-sm text-gray-600 mb-4">
            {{ $t('knowledge.lesson.bulkDelete.message', { n: templateSelectedIds.length }) }}
          </p>
          <div class="flex justify-end gap-3">
            <button
              type="button"
              class="px-4 py-2 text-sm text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50"
              @click="showTemplateBulkDeleteConfirm = false"
            >
              {{ $t('knowledge.lesson.bulkDelete.cancel') }}
            </button>
            <button
              type="button"
              class="px-4 py-2 text-sm text-white bg-red-600 rounded-lg hover:bg-red-700 disabled:opacity-50"
              :disabled="templateBulkDeleting"
              @click="handleTemplateBulkDelete"
            >
              {{ templateBulkDeleting ? '…' : $t('knowledge.lesson.bulkDelete.confirm') }}
            </button>
          </div>
        </div>
      </div>
    </Teleport>

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

<style scoped>
/* Checkbox on шаблони cards — visible on hover or when selected/selectionMode */
.wb-template-card:hover .wb-template-checkbox,
.wb-template-card--selected .wb-template-checkbox {
  opacity: 1 !important;
}

/* Checkbox on conducted cards */
.wb-conducted-card:hover .wb-conducted-checkbox,
.wb-conducted-card--selected .wb-conducted-checkbox {
  opacity: 1 !important;
}
/* ── «Мої уроки» за макетом дизайнера (2026-10-22): обкладинки, плитки/список, стрічка проведених ──
   Кольори обкладинки — ті самі --wb-cover-* теми, що в Студії (main.css); картка дає лише відтінок --h. */
.ml-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
  gap: 14px;
}

.ml-card {
  position: relative;
  background: var(--wb-card-bg, #ffffff);
  border: 1px solid transparent;
  border-radius: 18px;
  box-shadow: 0 6px 20px -18px rgba(13, 74, 62, 0.4);
  transition: transform 0.2s, box-shadow 0.2s, border-color 0.15s;
  animation: ml-up 0.45s ease backwards;
  animation-delay: calc(var(--i, 0) * 35ms);
}

@keyframes ml-up {
  from { opacity: 0; transform: translateY(12px); }
}

.ml-card:hover {
  transform: translateY(-1px);
  box-shadow: 0 14px 30px -20px rgba(13, 74, 62, 0.4);
}

.ml-card--selected {
  border-color: var(--wb-brand, #047857);
}

.ml-cover {
  position: relative;
  height: 96px;
  border-radius: 18px 18px 0 0;
  overflow: hidden;
  display: grid;
  place-items: center;
  font-size: 44px;
  font-weight: 700;
  letter-spacing: -0.03em;
  white-space: nowrap;
  background: hsl(var(--h, 165) var(--wb-cover-cs, 70%) var(--wb-cover-cl, 92%));
  color: hsl(var(--h, 165) var(--wb-cover-is, 45%) var(--wb-cover-il, 32%));
}

.ml-cover::after {
  content: "";
  position: absolute;
  inset: auto 0 0 0;
  height: 6px;
  background: hsl(var(--h, 165) 55% 55%);
  opacity: 0.5;
}

.ml-cover--mono {
  font-style: italic;
  font-size: 40px;
}

.ml-cover__img {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  object-fit: cover;
  background: var(--wb-canvas-bg, #ffffff);
}

.ml-info {
  padding: 12px 14px 14px;
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.ml-subj {
  margin: 0 0 2px;
  font-size: 10.5px;
  font-weight: 700;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: var(--wb-fg-secondary, #1f6b5a);
}

.ml-title {
  margin: 0;
  font-size: 15px;
  font-weight: 600;
  line-height: 1.3;
  color: var(--wb-fg, #0d4a3e);
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
  overflow-wrap: anywhere;
  min-height: 39px;
}

.ml-title--one {
  -webkit-line-clamp: 1;
  min-height: 0;
}

.ml-meta {
  margin: 5px 0 0;
  display: flex;
  flex-wrap: wrap;
  gap: 4px 10px;
  white-space: nowrap;
  font-size: 12px;
  color: var(--wb-fg-secondary, #1f6b5a);
}

.ml-acts {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 6px;
}

/* «Провести» — головна дія картки; «Починаємо…» з трикутником, що відлітає, поки відкривається дошка */
.ml-go {
  display: inline-flex;
  flex: 1;
  align-items: center;
  justify-content: center;
  gap: 9px;
  min-height: 40px;
  border: 0;
  border-radius: 12px;
  padding: 9px 16px;
  font-size: 14px;
  font-weight: 700;
  background: var(--wb-brand, #047857);
  color: var(--color-on-accent, #ffffff);
  cursor: pointer;
  transition: filter 0.15s;
}

.ml-go:hover {
  filter: brightness(1.06);
}

.ml-go:disabled {
  opacity: 0.75;
  cursor: progress;
}

.ml-go__tri {
  width: 0;
  height: 0;
  border-left: 9px solid currentColor;
  border-top: 5.5px solid transparent;
  border-bottom: 5.5px solid transparent;
  transition: transform 0.25s;
}

.ml-go:hover .ml-go__tri {
  transform: translateX(3px);
}

.ml-go:disabled .ml-go__tri {
  animation: ml-launch 0.5s ease-in forwards;
}

@keyframes ml-launch {
  to { transform: translateX(26px); opacity: 0; }
}

.ml-go--small {
  flex: 0 0 auto;
  min-height: 36px;
  padding: 7px 14px;
  font-size: 13.5px;
}

.ml-ic {
  width: 36px;
  height: 36px;
  border-radius: 11px;
  border: 1.5px solid var(--wb-border, rgba(5, 150, 105, 0.2));
  background: none;
  display: grid;
  place-items: center;
  cursor: pointer;
}

.ml-ic--danger:hover {
  border-color: #ef4444;
}

.ml-view {
  display: flex;
  gap: 2px;
  background: var(--wb-card-bg, #ffffff);
  border-radius: 10px;
  padding: 3px;
}

.ml-view__btn {
  border: 0;
  background: none;
  border-radius: 8px;
  width: 34px;
  height: 30px;
  font-size: 15px;
  color: var(--wb-fg-secondary, #1f6b5a);
  cursor: pointer;
}

.ml-view__btn--on {
  background: var(--wb-bg-hover, rgba(5, 150, 105, 0.08));
  color: var(--wb-brand, #047857);
}

/* Список: обкладинка-значок зліва, назва посередині, дії справа */
.ml-grid--list {
  grid-template-columns: 1fr;
  gap: 8px;
}

.ml-grid--list .ml-card {
  display: grid;
  grid-template-columns: 52px minmax(0, 1fr);
  align-items: center;
  column-gap: 14px;
  padding: 10px 12px;
  border-radius: 16px;
}

.ml-grid--list .ml-cover,
.ml-cover--small {
  height: 52px;
  border-radius: 13px;
  font-size: 19px;
}

.ml-grid--list .ml-cover--mono,
.ml-cover--small.ml-cover--mono {
  font-size: 20px;
}

.ml-grid--list .ml-cover::after,
.ml-cover--small::after {
  display: none;
}

.ml-grid--list .ml-info {
  padding: 0;
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  align-items: center;
  column-gap: 16px;
  row-gap: 6px;
}

.ml-grid--list .ml-info > :not(.ml-text):not(.ml-acts) {
  grid-column: 1 / -1;
}

.ml-grid--list .ml-title {
  -webkit-line-clamp: 1;
  min-height: 0;
}

.ml-grid--list .ml-go {
  flex: 0 0 auto;
}

/* Проведені: стрічка за днями */
.ml-tl {
  display: flex;
  flex-direction: column;
  border-left: 2px solid var(--wb-border, rgba(5, 150, 105, 0.2));
  margin-left: 8px;
  padding-left: 22px;
}

.ml-tl__day {
  position: relative;
  margin: 16px 0 8px;
  font-size: 13px;
  font-weight: 600;
  color: var(--wb-fg-secondary, #1f6b5a);
}

.ml-tl__day:first-child {
  margin-top: 0;
}

.ml-tl__day::before {
  content: "";
  position: absolute;
  left: -29px;
  top: 4px;
  width: 12px;
  height: 12px;
  border-radius: 50%;
  background: var(--wb-brand, #047857);
  box-shadow: 0 0 0 4px var(--wb-bg-tertiary, #e0f7f4);
}

.ml-row {
  display: grid;
  grid-template-columns: 52px minmax(0, 1fr) auto;
  gap: 14px;
  align-items: center;
  padding: 10px 12px;
  margin-bottom: 8px;
  border-radius: 16px;
  cursor: pointer;
}

.ml-check {
  position: absolute;
  top: 6px;
  left: 6px;
  z-index: 2;
  transition: opacity 0.1s;
}

.ml-who {
  display: inline-flex;
  align-items: center;
  gap: 6px;
}

.ml-who b {
  width: 20px;
  height: 20px;
  border-radius: 50%;
  display: grid;
  place-items: center;
  font-size: 10px;
  background: var(--wb-brand, #047857);
  color: var(--color-on-accent, #ffffff);
}

@media (max-width: 640px) {
  .ml-grid--list .ml-info {
    grid-template-columns: 1fr;
  }

  .ml-row {
    grid-template-columns: 44px minmax(0, 1fr);
  }

  .ml-row .ml-acts {
    grid-column: 1 / -1;
  }
}

/* Сенсорні панелі: картка не підскакує */
@media (pointer: coarse) {
  .ml-card:hover {
    transform: none;
  }
}

@media (prefers-reduced-motion: reduce) {
  .ml-card,
  .ml-card * {
    animation: none !important;
    transition: none !important;
  }
}
</style>

<script setup lang="ts">
import { ref, computed, onMounted, onBeforeUnmount, watch } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { lessonSaveApi } from '../api/lessonSaveApi'
import type { LessonFolder, MyLesson, MyLessonsParams } from '../api/lessonSaveApi'
import { lessonViewApi } from '../api/lessonViewApi'
import type { ConductedLessonItem } from '../api/lessonViewApi'
import { winterboardApi } from '@/modules/winterboard/api/winterboardApi'
import apiClient from '@/utils/apiClient'
import { useNotifyStore } from '@/stores/notifyStore'
import WBLessonFolders from '../components/WBLessonFolders.vue'
import GrantTransferModal from '../components/GrantTransferModal.vue'
import ShareLessonMenu from '../components/ShareLessonMenu.vue'
import { grantsApi, type LessonGrant } from '../api/grantsApi'
import HistoryGenerateModal from '../components/HistoryGenerateModal.vue'
import { fetchHistoryProgram, type HistoryProgram } from '../api/historyGeneratorApi'
import { useAuthStore } from '@/modules/auth/store/authStore'

// «Згенерувати урок історії» (2026-10-09): програма МОН з бекенду; null — генерації для вчителя «не існує».
const historyProgram = ref<HistoryProgram | null>(null)
const showHistoryGen = ref(false)

async function loadHistoryProgram(): Promise<void> {
  // 2026-10-17: питаємо лише коли сервер назвав цей пілот у профілі — інакше кожне відкриття сторінки давало
  // червоний 404 у консолі (генератор сховано 09.10); доступ і далі вирішує лише сервер.
  const pilots = (useAuthStore().user as { pilots?: string[] } | null)?.pilots
  if (!pilots?.includes('history_generator')) return
  try {
    historyProgram.value = await fetchHistoryProgram()
  } catch (err) {
    console.error('[WBMyLessonsPage] history program failed', err)   // кнопки просто немає
  }
}

function onHistoryLessonCreated(): void {
  if (activeTab.value === 'templates') loadLessons()
}

function onHistoryLessonConduct(lessonId: string): void {
  showHistoryGen.value = false
  openLesson({ id: lessonId } as MyLesson)
}

// LessonGrant (2026-07): модалка «Передати уроки»
const showGrantModal = ref(false)
// Швидкий флоу з картки: 1 клік → одноразовий код цього уроку → одразу результат
const quickGrantResult = ref<LessonGrant | null>(null)
const quickGrantingId = ref<string | null>(null)

async function quickGrant(lesson: MyLesson): Promise<void> {
  if (quickGrantingId.value) return
  quickGrantingId.value = lesson.id
  try {
    quickGrantResult.value = await grantsApi.create({
      lesson_ids: [lesson.id],
      max_uses: 1, // одноразовий — для одного отримувача
      expires_days: null,
    })
    showGrantModal.value = true
  } catch (e: unknown) {
    const err = e as { response?: { data?: { detail?: string } } }
    notify.error(err?.response?.data?.detail || t('knowledge.grants.createError'))
  } finally {
    quickGrantingId.value = null
  }
}

function closeGrantModal(): void {
  showGrantModal.value = false
  quickGrantResult.value = null
}
import LessonEditDialog from '../components/LessonEditDialog.vue'
import WBSaveLessonDialog from '../components/WBSaveLessonDialog.vue'
import { SAVE_COPY_QUERY, SAVE_COPY_TITLE_QUERY } from '@/modules/winterboard/board/lessonExitNotice'
import MoveToFolderDropdown from '../components/MoveToFolderDropdown.vue'
import ErrorBoundary from '@/components/ErrorBoundary.vue'
import { getBoardCover } from '@/modules/winterboard/utils/boardCover'

const router = useRouter()
const route = useRoute()
const { t, locale } = useI18n()

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
/** Телефон: чи розгорнуті папки (на md+ клас не діє). */
const mobileFoldersOpen = ref(false)
const activeStatus = ref<string | null>(null)
const total = ref(0)
// Перелік папок бічної панелі — для меню переміщення (без окремого запиту при кожному відкритті).
const sidebarFolders = computed<LessonFolder[] | undefined>(
  () => (folderSidebar.value ? (folderSidebar.value.folders as LessonFolder[]) : undefined))

// Чи лишається урок у відкритому списку після переміщення в `folderId`.
function staysInView(folderId: string | null): boolean {
  return activeFolder.value === null
    || (activeFolder.value === 'root' ? folderId === null : activeFolder.value === folderId)
}

function onBulkMoved(folderId: string | null): void {
  const ids = new Set(templateSelectedIds.value)
  for (const l of lessons.value) {
    if (ids.has(l.id)) l.folder = folderId
  }
  if (!staysInView(folderId)) {
    lessons.value = lessons.value.filter(l => !ids.has(l.id))
    total.value = Math.max(0, total.value - ids.size)
    hasMore.value = lessons.value.length < total.value
  }
  templateSelectedIds.value = []
  folderSidebar.value?.loadFolders?.()
}

// «Всі уроки (N)» — усі уроки вчителя, а не кількість у відкритій папці чи пошуку (2026-10-13).
const allTotal = ref<number | null>(null)
const activeFolderLabel = computed<string | null>(() => {
  if (activeFolder.value === null) return null
  if (activeFolder.value === 'root') return t('knowledge.folder.unfiled')
  const folders = (folderSidebar.value?.folders ?? []) as Array<{ id: string; name: string }>
  return folders.find(f => f.id === activeFolder.value)?.name ?? ''
})

async function refreshAllTotal(): Promise<void> {
  try {
    allTotal.value = (await lessonSaveApi.getMyLessonsFiltered({ limit: 1, offset: 0 })).total
  } catch (err) {
    console.error('[WBMyLessonsPage] all-lessons count failed', err)   // лишається попереднє число
  }
}

// Урок видалено: загальна кількість і лічильник його папки змінились.
function onLessonsRemoved(count: number): void {
  if (allTotal.value !== null) allTotal.value = Math.max(0, allTotal.value - count)
  folderSidebar.value?.loadFolders?.()
}
const hasMore = ref(false)
const folderSidebar = ref<InstanceType<typeof WBLessonFolders> | null>(null)
let searchTimeout: ReturnType<typeof setTimeout> | null = null

// Phase 25: Delete
const deletingId = ref<string | null>(null)
const deleteTarget = ref<MyLesson | null>(null)

// "Провести" — race guard для fresh session open
const openingLessonId = ref<string | null>(null)

// Меню «…» на картці уроку (Топ-10 №8): одночасно відкрите лише одне.
const openMenuLessonId = ref<string | null>(null)
function toggleLessonMenu(id: string): void {
  openMenuLessonId.value = openMenuLessonId.value === id ? null : id
}
function closeLessonMenu(): void {
  openMenuLessonId.value = null
}
function onDocumentClick(): void {
  closeLessonMenu()
}
function onDocumentKeydown(e: KeyboardEvent): void {
  if (e.key === 'Escape') closeLessonMenu()
}

// Preview: loading guard поки оновлюємо snapshot
const previewingLessonId = ref<string | null>(null)

// Phase 25: Edit
const showEditDialog = ref(false)
const editTarget = ref<MyLesson | null>(null)

const PAGE_SIZE = 20

// ── Шаблони: bulk selection ───────────────────────────────────────────
const templateSelectedIds = ref<string[]>([])
const templateSelectionMode = computed(() => templateSelectedIds.value.length > 0)
const templateAllSelected = computed(
  () => lessons.value.length > 0 && lessons.value.every(l => templateSelectedIds.value.includes(l.id)),
)

function toggleTemplateSelect(id: string): void {
  const idx = templateSelectedIds.value.indexOf(id)
  if (idx >= 0) {
    templateSelectedIds.value.splice(idx, 1)
  } else {
    templateSelectedIds.value.push(id)
  }
}

function selectAllTemplates(): void {
  templateSelectedIds.value = lessons.value.map(l => l.id)
}

function deselectAllTemplates(): void {
  templateSelectedIds.value = []
}

const showTemplateBulkDeleteConfirm = ref(false)
const templateBulkDeleting = ref(false)

async function handleTemplateBulkDelete(): Promise<void> {
  if (templateBulkDeleting.value || templateSelectedIds.value.length === 0) return
  templateBulkDeleting.value = true
  const idsToDelete = [...templateSelectedIds.value]
  try {
    await Promise.all(idsToDelete.map(id => lessonSaveApi.deleteLesson(id)))
    lessons.value = lessons.value.filter(l => !idsToDelete.includes(l.id))
    total.value = Math.max(0, total.value - idsToDelete.length)
    hasMore.value = lessons.value.length < total.value
    onLessonsRemoved(idsToDelete.length)
    templateSelectedIds.value = []
    showTemplateBulkDeleteConfirm.value = false
    notify.success(t('knowledge.lesson.bulkDelete.success', { n: idsToDelete.length }))
  } catch {
    notify.error(t('knowledge.lesson.deleteError'))
  } finally {
    templateBulkDeleting.value = false
  }
}

// ── Проведені уроки tab ──────────────────────────────────────────────
// Окремий список lesson-play WBSession з нового endpoint
// GET /api/v1/knowledge/my-lessons/conducted/.
// Існуючий "Шаблони" tab (lessons) залишається без змін.
type TabKey = 'templates' | 'conducted'
const activeTab = ref<TabKey>('templates')
const conductedSessions = ref<ConductedLessonItem[]>([])
const conductedLoading = ref(false)
const conductedLoadingMore = ref(false)
const conductedError = ref<string | null>(null)
const conductedTotal = ref(0)
const conductedOffset = ref(0)
const conductedHasMore = ref(false)
const conductedLoaded = ref(false)
const conductedSearchQuery = ref('')
const CONDUCTED_LIMIT = 24
let conductedSearchTimer: ReturnType<typeof setTimeout> | null = null

// ─── «Мої уроки» за макетом дизайнера (2026-10-22): обкладинки, плитки/список, стрічка проведених ──

function coverOf(name: string | null | undefined) {
  return getBoardCover(name, String(locale.value))
}

// Предмет над назвою — лише відомі коди `subject_tag` (поле буває порожнім або довільним рядком)
const SUBJECT_CODES = new Set(['math', 'physics', 'english', 'ukrainian', 'chemistry', 'biology', 'history', 'geography', 'informatics'])
function subjectLabel(tag: string | null | undefined): string {
  const code = (tag ?? '').split(/[,\s]/)[0].trim().toLowerCase()
  return SUBJECT_CODES.has(code) ? t(`subject.${code}`) : ''
}

function formatTime(iso: string): string {
  try {
    return new Date(iso).toLocaleTimeString(locale.value, { hour: '2-digit', minute: '2-digit' })
  } catch {
    return ''
  }
}

function studentName(session: ConductedLessonItem): string {
  const name = (session.lesson_info as { student_name?: string | null } | null)?.student_name
  return typeof name === 'string' ? name.trim() : ''
}

const LESSON_VIEW_KEY = 'ml-view'
function loadLessonView(): 'tiles' | 'list' {
  try {
    return localStorage.getItem(LESSON_VIEW_KEY) === 'list' ? 'list' : 'tiles'
  } catch {
    return 'tiles'
  }
}
const lessonView = ref<'tiles' | 'list'>(loadLessonView())
function setLessonView(v: 'tiles' | 'list'): void {
  lessonView.value = v
  try {
    localStorage.setItem(LESSON_VIEW_KEY, v)
  } catch {
    // приватний режим — вигляд лише до перезавантаження
  }
}

// Проведені за днями (за місцевою датою), порядок сервера зберігається; _i — затримка появи рядка
const conductedByDay = computed(() => {
  const dayKey = (d: Date) => `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`
  const now = new Date()
  const today = dayKey(now)
  const yesterday = dayKey(new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1))
  const days: { key: string; label: string; items: (ConductedLessonItem & { _i: number })[] }[] = []
  conductedSessions.value.forEach((session, i) => {
    const d = new Date(session.created_at)
    const key = dayKey(d)
    let day = days[days.length - 1]
    if (!day || day.key !== key) {
      const label = key === today
        ? t('winterboard.lesson.conducted.today')
        : key === yesterday
          ? t('winterboard.lesson.conducted.yesterday')
          : d.toLocaleDateString(locale.value, {
            day: 'numeric',
            month: 'long',
            ...(d.getFullYear() !== now.getFullYear() ? { year: 'numeric' as const } : {}),
          })
      day = { key, label, items: [] }
      days.push(day)
    }
    day.items.push({ ...session, _i: i })
  })
  return days
})

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

async function loadConducted(append = false) {
  if (append) {
    conductedLoadingMore.value = true
  } else {
    conductedLoading.value = true
    conductedOffset.value = 0
  }
  conductedError.value = null
  try {
    const res = await lessonViewApi.listConducted({
      limit: CONDUCTED_LIMIT,
      offset: append ? conductedOffset.value : 0,
      q: conductedSearchQuery.value.trim() || undefined,
    })
    if (append) {
      conductedSessions.value = [...conductedSessions.value, ...res.sessions]
    } else {
      conductedSessions.value = res.sessions
    }
    conductedTotal.value = res.total
    conductedHasMore.value = res.has_more
    conductedOffset.value = (append ? conductedOffset.value : 0) + res.sessions.length
    conductedLoaded.value = true
  } catch (err) {
    console.error('[WBMyLessonsPage] loadConducted error:', err)
    conductedError.value = t('winterboard.lesson.conducted.loadError')
  } finally {
    conductedLoading.value = false
    conductedLoadingMore.value = false
  }
}

function onConductedSearch() {
  if (conductedSearchTimer) clearTimeout(conductedSearchTimer)
  conductedSearchTimer = setTimeout(() => {
    deselectAllConducted()
    loadConducted(false)
  }, 300)
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
  loadHistoryProgram()
  document.addEventListener('click', onDocumentClick)
  document.addEventListener('keydown', onDocumentKeydown)
})

onBeforeUnmount(() => {
  document.removeEventListener('click', onDocumentClick)
  document.removeEventListener('keydown', onDocumentKeydown)
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

// «Зберегти як новий шаблон» із підтвердження після «← Мої уроки» (?save_copy=<сесія>,
// winterboard/board/lessonExitNotice.ts). Вікно змонтоване завжди; відкриваємо, коли вже
// підставлено сесію й назву, — тоді воно саме заповнить поле назви.
const showSaveCopyDialog = ref(false)
const saveCopySessionId = ref('')
const saveCopyDefaultTitle = ref('')

watch(
  () => route.query[SAVE_COPY_QUERY],
  async (sid) => {
    if (typeof sid !== 'string' || !sid) return
    const title = route.query[SAVE_COPY_TITLE_QUERY]
    saveCopySessionId.value = sid
    saveCopyDefaultTitle.value = typeof title === 'string' ? title : ''
    // Чистимо query одразу — refresh/back не відкриють вікно вдруге
    await router.replace({ query: { ...route.query, [SAVE_COPY_QUERY]: undefined, [SAVE_COPY_TITLE_QUERY]: undefined } })
    // Відкриваємо лише ПІСЛЯ await вище: сторінка, що відкрилась одразу з ?save_copy, на цей
    // момент уже змонтувала вікно, а воно заповнює назву тільки на переході «закрито → відкрито».
    showSaveCopyDialog.value = true
  },
  { immediate: true },
)

/** Новий шаблон — у вкладці «Уроки»: показуємо її й оновлюємо список. */
function onCopySaved(lesson: { id: string; title: string }): void {
  notify.success(t('winterboard.lesson.copy.savedToast', { title: lesson.title }))
  activeTab.value = 'templates'
  loadLessons()
}

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
    if (!params.q && !params.folder && !params.status) {
      allTotal.value = result.total
    } else {
      void refreshAllTotal()
    }
    hasMore.value = result.has_more
  } catch (err) {
    console.error('[WBMyLessonsPage] fetch error:', err)
    loadError.value = t('winterboard.lesson.fetchError')
  } finally {
    isLoading.value = false
  }
}

/**
 * Дата й час збереження («13 жовт. 2026 р., 14:35»). Власник 2026-10-15: кілька збережень одного
 * уроку за день на картці виглядали однаково — шукати доводилось відкриваючи. Час сервер і так
 * зберігає (`created_at` — повна позначка), картка просто його відкидала.
 */
function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleString(locale.value, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
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
    onLessonsRemoved(1)
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
  closeLessonMenu()          // меню «⋯» закриваємо ПІСЛЯ перенесення, а не кліком, що загубив би `moved`
  lesson.folder = folderId
  folderSidebar.value?.loadFolders()
  // Урок вийшов із відкритого списку — прибрати з екрана (і з «Без папки», коли його поклали в папку)
  if (!staysInView(folderId)) {
    lessons.value = lessons.value.filter(l => l.id !== lesson.id)
    total.value = Math.max(0, total.value - 1)
    hasMore.value = lessons.value.length < total.value
  }
}
</script>
