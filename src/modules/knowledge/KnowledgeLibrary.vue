<template>
  <div class="knowledge-page">
    <div class="knowledge-page__header">
      <h1 class="knowledge-page__title">{{ $t('knowledge.title') }}</h1>
      <p class="knowledge-page__subtitle">
        Завантажуйте файли, організовуйте класи та матеріали до уроків
      </p>
    </div>

    <!-- ══════════ TWO-COLUMN LAYOUT ══════════ -->
    <div class="knowledge-page__layout">

      <!-- ──── LEFT: Students list ──── -->
      <aside class="knowledge-page__sidebar">

        <!-- Нова дошка (solo, без студента) — прихована коли вибрано учня -->
        <button
          v-if="!selectedRelation"
          class="knowledge-page__new-board-btn"
          title="Відкрити нову дошку для самостійної підготовки (без студента)"
          @click="handleOpenNewBoard"
        >
          🖊 {{ $t('knowledge.newBoard') }}
        </button>

        <div class="knowledge-page__sidebar-divider" />

        <div class="knowledge-page__sidebar-section-header">
          <h2 class="knowledge-page__sidebar-title">{{ $t('knowledge.myStudents') }}</h2>
          <span v-if="!studentsLoading && studentRelations.length > 0" class="knowledge-page__sidebar-count">
            {{ studentRelations.length }}
          </span>
        </div>

        <div v-if="studentsLoading" class="knowledge-page__sidebar-loading">
          <div v-for="i in 3" :key="i" class="h-10 rounded bg-gray-100 animate-pulse mb-2" />
        </div>

        <div v-else-if="studentRelations.length === 0" class="knowledge-page__sidebar-empty">
          <span class="knowledge-page__sidebar-empty-icon">🎓</span>
          Учні з'являться після першого бронювання уроку
        </div>

        <button
          v-for="rel in studentRelations"
          :key="rel.id"
          class="knowledge-page__student-btn"
          :class="{ 'knowledge-page__student-btn--active': selectedRelation?.id === rel.id }"
          @click="selectRelation(rel)"
        >
          <span class="knowledge-page__student-name">
            {{ rel.student?.is_demo ? $t('knowledge.sandbox') : `${rel.student?.first_name || ''} ${(rel.student?.last_name || '').charAt(0)}.` }}
          </span>
          <span v-if="rel.student?.is_demo" class="knowledge-page__demo-badge">demo</span>
        </button>

        <!-- ── МОЇ КЛАСИ (Explicit Groups) ── -->
        <div class="knowledge-page__sidebar-divider" style="margin-top: 0.75rem" />
        <div class="knowledge-page__sidebar-section-header">
          <h2 class="knowledge-page__sidebar-title">{{ $t('knowledge.myClasses') }}</h2>
          <span v-if="groupStore.explicitGroups.length > 0" class="knowledge-page__sidebar-count">
            {{ groupStore.explicitGroups.length }}
          </span>
          <!-- Кнопка "Створити клас" -->
          <button
            type="button"
            class="knowledge-page__sidebar-add-btn"
            title="Створити клас"
            @click="isCreatingGroup = true"
          >+</button>
        </div>

        <!-- Inline: форма створення класу -->
        <div v-if="isCreatingGroup" class="knowledge-page__group-create-row">
          <input
            v-model="newGroupTitle"
            class="knowledge-page__group-create-input"
            placeholder="Назва класу..."
            autofocus
            @keydown.enter="submitCreateGroup"
            @keydown.esc="isCreatingGroup = false; newGroupTitle = ''"
          />
          <button type="button" class="knowledge-page__group-del-confirm" title="Зберегти" @click="submitCreateGroup">✓</button>
          <button type="button" class="knowledge-page__group-del-cancel" title="Скасувати" @click="isCreatingGroup = false; newGroupTitle = ''">✕</button>
        </div>

        <div v-if="groupStore.explicitGroups.length === 0 && !isCreatingGroup" class="knowledge-page__sidebar-empty">
          <span class="knowledge-page__sidebar-empty-icon">🏫</span>
          Натисніть «+» щоб створити перший клас
        </div>

        <div
          v-for="group in groupStore.explicitGroups"
          :key="group.id"
          class="knowledge-page__group-row"
          :class="{ 'knowledge-page__group-row--active': selectedGroupId === String(group.id) && !selectedRelation }"
        >
          <!-- Режим перейменування -->
          <template v-if="renamingGroupId === String(group.id)">
            <input
              v-model="renamingGroupTitle"
              class="knowledge-page__group-create-input"
              @keydown.enter="submitRenameGroup(group.id)"
              @keydown.esc="renamingGroupId = null"
            />
            <button type="button" class="knowledge-page__group-del-confirm" @click="submitRenameGroup(group.id)">✓</button>
            <button type="button" class="knowledge-page__group-del-cancel" @click="renamingGroupId = null">✕</button>
          </template>

          <!-- Режим підтвердження видалення -->
          <template v-else-if="deletingGroupId === String(group.id)">
            <span class="knowledge-page__group-del-prompt">Видалити «{{ group.title }}»?</span>
            <button type="button" class="knowledge-page__group-del-confirm" @click.stop="confirmDeleteGroup(group.id)">✓</button>
            <button type="button" class="knowledge-page__group-del-cancel" @click.stop="deletingGroupId = null">✕</button>
          </template>

          <!-- Звичайний режим -->
          <template v-else>
            <button class="knowledge-page__group-btn" @click="selectExplicitGroup(group.id)">
              <span class="knowledge-page__student-name">{{ group.title }}</span>
              <span class="knowledge-page__group-count">{{ group.lesson_plan_count ?? 0 }}</span>
            </button>
            <button
              type="button"
              class="knowledge-page__group-edit"
              title="Перейменувати клас"
              @click.stop="startRenameGroup(group)"
            >✎</button>
            <button
              type="button"
              class="knowledge-page__group-del"
              title="Видалити клас"
              @click.stop="deletingGroupId = String(group.id)"
            >×</button>
          </template>
        </div>
      </aside>

      <!-- ──── RIGHT: Main content area ──── -->
      <main class="knowledge-page__main">

        <!-- ── Tutor Library: upload (завжди видима, порядок — знизу) ── -->
        <section class="knowledge-page__section knowledge-page__section--library">
          <div class="knowledge-page__section-header">
            <div>
              <h3 class="knowledge-page__section-title">
                📚 {{ $t('knowledge.tutorLibrary') }}
                <span
                  v-if="myFiles.length > 0"
                  class="knowledge-page__file-count"
                  :title="`${myFiles.length} файлів у бібліотеці`"
                >{{ myFiles.length }}</span>
              </h3>
              <!-- Підказка: що додавати до класу -->
              <p v-if="selectedGroupId && currentGroupTitle && myFiles.length > 0" class="knowledge-page__section-hint">
                Натисніть «+» щоб додати файл до «{{ currentGroupTitle }}»
              </p>
            </div>
            <label
              class="knowledge-page__upload-btn"
              :class="{ 'opacity-50 pointer-events-none': isUploading }"
              :title="isUploading ? 'Йде завантаження…' : 'Завантажити файли: зображення, PDF, відео, аудіо, PPTX (до 200 MB)'"
            >
              <input
                ref="fileInput"
                type="file"
                multiple
                accept="image/*,.pdf,audio/*,video/*,.pptx,.ppt"
                class="sr-only"
                @change="handleFileUpload"
              />
              {{ isUploading ? $t('knowledge.uploading') : $t('knowledge.uploadFiles') }}
            </label>
          </div>

          <!-- Storage quota -->
          <div v-if="storageQuota" class="knowledge-page__quota">
            <div class="knowledge-page__quota-bar">
              <div
                class="knowledge-page__quota-fill"
                :style="{ width: Math.min(storageQuota.usage_percent, 100) + '%' }"
                :class="{
                  'knowledge-page__quota-fill--warning': storageQuota.usage_percent > 80,
                  'knowledge-page__quota-fill--critical': storageQuota.usage_percent > 95,
                }"
              />
            </div>
            <span class="knowledge-page__quota-text">
              {{ formatBytes(storageQuota.used_bytes) }} / {{ formatBytes(storageQuota.total_quota_bytes) }}
            </span>
          </div>

          <!-- Upload error -->
          <div v-if="uploadError" class="knowledge-page__upload-error">
            ⚠️ {{ uploadError }}
          </div>

          <!-- ── Tabs фільтрації бібліотеки ── -->
          <div v-if="myFiles.length > 0" class="knowledge-page__lib-tabs">
            <button
              v-for="tab in LIBRARY_TABS"
              :key="tab.key"
              type="button"
              class="knowledge-page__lib-tab"
              :class="{ 'knowledge-page__lib-tab--active': libraryTab === tab.key }"
              @click="libraryTab = tab.key"
            >
              {{ tab.label }}
              <span
                v-if="tab.key !== 'all' && tabCounts[tab.key]"
                class="knowledge-page__lib-tab-count"
              >{{ tabCounts[tab.key] }}</span>
            </button>
          </div>

          <!-- ── Список файлів бібліотеки тьютора ── -->
          <div v-if="isLoadingMyFiles" class="knowledge-page__lib-loading">
            Завантаження файлів…
          </div>
          <div v-else-if="myFiles.length === 0 && !isUploading" class="knowledge-page__lib-empty knowledge-page__lib-empty--onboard">
            <span class="knowledge-page__lib-empty-icon">📂</span>
            <span class="knowledge-page__lib-empty-title">Бібліотека порожня</span>
            <span class="knowledge-page__lib-empty-hint">
              Завантажте PDF, зображення або відео — вони з'являться тут і будуть доступні у всіх ваших класах
            </span>
          </div>
          <div v-else-if="filteredMyFiles.length === 0" class="knowledge-page__lib-empty knowledge-page__lib-empty--filter">
            <span class="knowledge-page__lib-empty-icon">🔍</span>
            <span class="knowledge-page__lib-empty-title">Немає файлів у цій категорії</span>
          </div>
          <div v-else class="knowledge-page__lib-list">
            <div
              v-for="item in filteredMyFiles"
              :key="item.id"
              class="knowledge-page__lib-item"
            >
              <!-- Тип файлу -->
              <span class="knowledge-page__catalog-badge" :class="`kct-${item.type}`">
                {{ typeLabel(item.type) }}
              </span>
              <!-- Назва файлу -->
              <span class="knowledge-page__lib-name" :title="item.title">{{ item.title }}</span>

              <!-- Додати до класу (тільки якщо клас вибраний) -->
              <button
                v-if="selectedGroupId"
                class="knowledge-page__lib-add"
                :class="{ 'knowledge-page__lib-add--done': addedFromLibrary.has(item.id) }"
                :title="addedFromLibrary.has(item.id) ? 'Вже додано до цього класу' : 'Додати до поточного класу'"
                :disabled="addedFromLibrary.has(item.id)"
                @click="addLibraryItem(item)"
              >
                <svg v-if="addedFromLibrary.has(item.id)" width="11" height="11" viewBox="0 0 12 12" fill="none">
                  <path d="M2 6l3 3 5-5" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                </svg>
                <span v-else style="font-size:14px;line-height:1">+</span>
              </button>

              <!-- Inline delete confirmation -->
              <template v-if="pendingDeleteFileId === item.id">
                <span class="knowledge-page__lib-del-text">Видалити файл?</span>
                <button
                  type="button"
                  class="knowledge-page__lib-del-confirm"
                  title="Так, видалити назавжди"
                  @click="deleteFile(item.id)"
                >Так</button>
                <button
                  type="button"
                  class="knowledge-page__lib-del-cancel"
                  title="Скасувати"
                  @click="pendingDeleteFileId = null"
                >Ні</button>
              </template>

              <!-- Кнопка видалення файлу -->
              <button
                v-else
                type="button"
                class="knowledge-page__lib-del"
                title="Видалити файл з бібліотеки (назавжди)"
                @click="pendingDeleteFileId = item.id"
              >
                <svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                    d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/>
                </svg>
              </button>
            </div>
          </div>
        </section>

        <!-- Нічого не вибрано — onboarding steps -->
        <div v-if="!selectedRelation && !selectedGroupId" class="knowledge-page__placeholder">
          <div class="knowledge-page__placeholder-inner">
            <p class="knowledge-page__placeholder-emoji">👈</p>
            <p class="knowledge-page__placeholder-title">{{ $t('knowledge.emptyState.title') }}</p>
            <p class="knowledge-page__placeholder-hint">{{ $t('knowledge.emptyState.hint') }}</p>
            <div class="knowledge-page__placeholder-steps">
              <div class="knowledge-page__placeholder-step">
                <span class="knowledge-page__placeholder-step-num">1</span>
                <span>{{ $t('knowledge.emptyState.step1') }}</span>
              </div>
              <div class="knowledge-page__placeholder-step">
                <span class="knowledge-page__placeholder-step-num">2</span>
                <span>{{ $t('knowledge.emptyState.step2') }}</span>
              </div>
              <div class="knowledge-page__placeholder-step">
                <span class="knowledge-page__placeholder-step-num">3</span>
                <span>{{ $t('knowledge.emptyState.step3') }}</span>
              </div>
              <div class="knowledge-page__placeholder-step">
                <span class="knowledge-page__placeholder-step-num">4</span>
                <span>{{ $t('knowledge.emptyState.step4') }}</span>
              </div>
            </div>
          </div>
        </div>

        <template v-else>

          <!-- ══════════════════════════════════════════════════════════
               УРОКИ ГРУПИ (Teacher OS: Group → Lesson → Board)
               Показується коли вибрано клас (не студента)
          ═══════════════════════════════════════════════════════════ -->
          <section v-if="selectedGroupId && !selectedRelation" class="knowledge-page__section">
            <div class="knowledge-page__section-header">
              <div>
                <h3 class="knowledge-page__section-title">
                  📋 Уроки
                  <span v-if="lessonPlans.length > 0" class="knowledge-page__file-count">{{ lessonPlans.length }}</span>
                </h3>
                <p class="knowledge-page__section-hint">Підготуйте урок заздалегідь — матеріали, план, завдання</p>
              </div>
              <button type="button" class="knowledge-page__upload-btn" title="Створити урок" @click="startCreatePlan">
                + Урок
              </button>
            </div>

            <!-- Inline: створення нового уроку -->
            <div v-if="isCreatingPlan" class="knowledge-page__group-create-row" style="margin-bottom:0.75rem">
              <input
                v-model="newPlanTitle"
                class="knowledge-page__group-create-input"
                placeholder="Назва уроку…"
                autofocus
                @keydown.enter="submitCreatePlan"
                @keydown.esc="isCreatingPlan = false; newPlanTitle = ''"
              />
              <button type="button" class="knowledge-page__group-del-confirm" @click="submitCreatePlan">✓</button>
              <button type="button" class="knowledge-page__group-del-cancel" @click="isCreatingPlan = false; newPlanTitle = ''">✕</button>
            </div>

            <!-- Завантаження -->
            <div v-if="isLoadingPlans" class="knowledge-page__lessons-list">
              <div v-for="i in 2" :key="i" class="knowledge-page__plan-skeleton animate-pulse" />
            </div>

            <!-- Порожній стан -->
            <div v-else-if="lessonPlans.length === 0 && !isCreatingPlan" class="knowledge-page__empty-materials">
              <span style="font-size:1.75rem;display:block;margin-bottom:0.5rem">📋</span>
              Ще немає уроків — натисніть «+ Урок» щоб створити перший
            </div>

            <!-- Список уроків -->
            <div v-else class="knowledge-page__plan-list">
              <div
                v-for="plan in lessonPlans"
                :key="plan.id"
                class="knowledge-page__plan-card"
                :class="{ 'knowledge-page__plan-card--expanded': expandedPlanId === plan.id }"
              >
                <!-- Заголовок картки -->
                <div class="knowledge-page__plan-card-head">
                  <template v-if="renamingPlanId === plan.id">
                    <input
                      v-model="renamingPlanTitle"
                      class="knowledge-page__group-create-input"
                      style="flex:1"
                      @keydown.enter="submitRenamePlan(plan.id)"
                      @keydown.esc="renamingPlanId = null"
                    />
                    <button type="button" class="knowledge-page__group-del-confirm" @click="submitRenamePlan(plan.id)">✓</button>
                    <button type="button" class="knowledge-page__group-del-cancel" @click="renamingPlanId = null">✕</button>
                  </template>
                  <template v-else>
                    <span class="knowledge-page__plan-title">{{ plan.title }}</span>
                    <span v-if="plan.material_count > 0" class="knowledge-page__plan-mat-count">
                      {{ plan.material_count }} матер.
                    </span>
                    <button
                      type="button" class="knowledge-page__group-edit"
                      title="Перейменувати урок"
                      @click="startRenamePlan(plan)"
                    >✎</button>
                    <button
                      type="button" class="knowledge-page__group-del"
                      title="Видалити урок"
                      style="opacity:0.5"
                      @click="deletePlan(plan.id)"
                    >×</button>
                  </template>
                </div>

                <!-- Кнопки дій -->
                <div class="knowledge-page__plan-card-actions">
                  <button
                    type="button"
                    class="knowledge-page__board-btn knowledge-page__board-btn--sm"
                    title="Відкрити підготовчу дошку для цього уроку"
                    @click="startLessonPlan(plan)"
                  >
                    🖊 Підготувати урок
                  </button>
                </div>

                <!-- Матеріали уроку (завжди видимі) -->
                <div class="knowledge-page__plan-materials">
                  <div v-if="!plan.materials?.length" style="font-size:0.8125rem;color:#94a3b8;padding:0.25rem 0">
                    Натисніть «+» у бібліотеці знизу, щоб додати матеріал до цього уроку
                  </div>
                  <div
                    v-for="mat in (plan.materials ?? [])"
                    :key="mat.id"
                    class="knowledge-page__plan-mat-row"
                  >
                    <span class="knowledge-page__catalog-badge" :class="`kct-${mat.content_item.type}`">{{ mat.content_item.type }}</span>
                    <span class="knowledge-page__plan-mat-name">{{ mat.content_item.title }}</span>
                    <button
                      type="button" class="knowledge-page__group-del"
                      title="Прибрати з уроку"
                      style="opacity:1"
                      @click="removePlanMaterial(plan.id, mat.id)"
                    >×</button>
                  </div>
                </div>
              </div>
            </div>
          </section>

          <!-- ── GroupMaterialsManager: матеріали групи/учня ── -->
          <GroupMaterialsManager :external-group-id="selectedGroupId" />

          <!-- ── Catalog: ПРИХОВАНО — платформа поки не має власного контенту ── -->
          <section v-if="false" class="knowledge-page__section knowledge-page__catalog-section">
            <button
              type="button"
              class="knowledge-page__catalog-toggle"
              @click="showCatalog = !showCatalog"
            >
              <span class="knowledge-page__catalog-toggle-label">
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                  <circle cx="7" cy="7" r="5" stroke="currentColor" stroke-width="1.5"/>
                  <path d="M11 11l3 3" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
                </svg>
                Знайти матеріали в каталозі
              </span>
              <svg
                class="knowledge-page__catalog-chevron"
                :class="{ 'knowledge-page__catalog-chevron--open': showCatalog }"
                width="16" height="16" viewBox="0 0 16 16" fill="none"
              >
                <path d="M4 6l4 4 4-4" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
              </svg>
            </button>

            <div v-if="showCatalog" class="knowledge-page__catalog-body">
              <input
                v-model="catalogQuery"
                type="text"
                class="knowledge-page__catalog-input"
                placeholder="Шукай: квадратні рівняння, теорія, тест…"
                autofocus
                @input="onCatalogInput"
              />
              <div v-if="isCatalogSearching" class="knowledge-page__catalog-status">
                Шукаємо…
              </div>
              <div v-else-if="catalogQuery.trim() && !catalogResults.length" class="knowledge-page__catalog-status">
                Нічого не знайдено — спробуй інший запит
              </div>
              <div v-else-if="!catalogQuery.trim()" class="knowledge-page__catalog-hint">
                💡 Введи назву теми — побачиш задачі, тести, теорію з платформи
              </div>
              <div v-else class="knowledge-page__catalog-list">
                <div
                  v-for="item in catalogResults.slice(0, 25)"
                  :key="item.id"
                  class="knowledge-page__catalog-item"
                >
                  <span class="knowledge-page__catalog-badge" :class="`kct-${item.type}`">
                    {{ item.type === 'problem' ? 'Задача' : item.type === 'theory' ? 'Теорія' : item.type === 'test' ? 'Тест' : item.type === 'presentation' ? 'Слайди' : item.type === 'video' ? 'Відео' : item.type }}
                  </span>
                  <span class="knowledge-page__catalog-name">{{ item.title }}</span>
                  <button
                    class="knowledge-page__catalog-add-btn"
                    :class="{ 'knowledge-page__catalog-add-btn--added': addedItemIds.has(item.id) }"
                    :title="addedItemIds.has(item.id) ? 'Вже додано' : 'Додати до бібліотеки'"
                    :aria-label="addedItemIds.has(item.id) ? 'Вже додано' : `Додати: ${item.title}`"
                    @click="addCatalogItem(item)"
                  >
                    <svg v-if="addedItemIds.has(item.id)" width="12" height="12" viewBox="0 0 12 12" fill="none">
                      <path d="M2 6l3 3 5-5" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>
                    </svg>
                    <span v-else style="font-size:16px;line-height:1">+</span>
                  </button>
                </div>
              </div>
            </div>
          </section>

          <!-- ── Open Board button (тільки для режиму учня) ── -->
          <section v-if="selectedRelation" class="knowledge-page__section">
            <button
              class="knowledge-page__board-btn knowledge-page__board-btn--lesson"
              :disabled="isCreatingLesson"
              :title="`Почати заняття з ${studentDisplayName}`"
              @click="handleOpenBoardForStudent()"
            >
              {{ isCreatingLesson ? $t('knowledge.creatingLesson') : '🎓 Почати заняття' }}
            </button>
          </section>

          <!-- ── Lessons with this student (тільки для учнів) ── -->
          <section v-if="selectedRelation" class="knowledge-page__section">
            <h3 class="knowledge-page__section-title">
              {{ $t('knowledge.lessonsWithStudent') }}
              <span class="text-gray-500">({{ studentLessons.length }})</span>
            </h3>
            <div v-if="studentLessons.length === 0" class="knowledge-page__empty-materials">
              {{ $t('knowledge.noLessons') }}
            </div>
            <div v-else class="knowledge-page__lessons-list">
              <div
                v-for="lesson in studentLessons"
                :key="lesson.id"
                class="knowledge-page__lesson-item"
              >
                <div class="knowledge-page__lesson-info">
                  <span
                    class="knowledge-page__lesson-status"
                    :class="`knowledge-page__lesson-status--${lesson.status.toLowerCase()}`"
                  >{{ lesson.status }}</span>
                  <span class="knowledge-page__lesson-date">{{ formatDate(lesson.start) }}</span>
                  <span v-if="lesson.content_count" class="text-gray-400 text-xs">
                    · {{ lesson.content_count }} {{ $t('knowledge.materials') }}
                  </span>
                </div>
                <div class="knowledge-page__lesson-actions">
                  <button
                    v-if="lesson.has_board && lesson.session_uuid"
                    class="knowledge-page__action-btn"
                    @click="openBoardSession(lesson.session_uuid)"
                  >{{ $t('knowledge.openBoard') }}</button>
                  <button
                    class="knowledge-page__action-btn knowledge-page__action-btn--primary"
                    :title="'Повторити цей урок для іншого учня або на іншу дату'"
                    @click="showCloneLessonModal(lesson)"
                  >🔁 Повторити для…</button>
                  <button
                    class="knowledge-page__action-btn"
                    @click="handleSaveAsTemplate(lesson.id)"
                  >{{ $t('template.saveAsTemplate') }}</button>
                </div>
              </div>
            </div>
          </section>

          <!-- ── Templates tab (тільки для учнів) ── -->
          <section v-if="selectedRelation && templates.length" class="knowledge-page__section">
            <h3 class="knowledge-page__section-title">
              {{ $t('knowledge.tabTemplates') }}
              <span class="text-gray-500">({{ templates.length }})</span>
            </h3>
            <div class="knowledge-page__lessons-list">
              <SavedTemplateCard
                v-for="tmpl in templates"
                :key="tmpl.id"
                :template="toSavedTemplate(tmpl)"
                @create-lesson="handleCreateFromTemplate"
                @delete="handleDeleteTemplate"
              />
            </div>
          </section>
        </template>
      </main>
    </div>

    <!-- Save As Template Modal -->
    <SaveAsTemplateModal
      v-model="showTemplateModal"
      :lesson-id="selectedLessonId"
      @saved="onTemplateSaved"
    />

    <!-- Clone Lesson Modal — "Повторити для іншого учня" -->
    <CloneLessonModal
      v-if="cloneLessonData"
      v-model="showCloneModal"
      :lesson-id="cloneLessonData.id"
      :lesson-title="cloneLessonData.title"
      :students="studentRelations"
      :current-student-id="selectedRelation?.student?.id"
      @cloned="onLessonCloned"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'
import { useKnowledge } from './composables/useKnowledge'
import { useGroupStore } from '@/modules/groups/stores/groupStore'
import GroupMaterialsManager from '@/modules/groups/components/GroupMaterialsManager.vue'
import { learningContentApi } from '@/modules/learning-content/api/learningContentApi'
import type { StorageQuota } from '@/modules/learning-content/api/learningContentApi'
import type { ContentItemSummary } from '@/modules/learning-content/types/learningContent'
import relationsApi from '@/api/relations'
import lessonsApi from '@/api/lessons'
import SavedTemplateCard from '@/modules/lessons/components/SavedTemplateCard.vue'
import type { SavedTemplateItem } from '@/modules/lessons/components/SavedTemplateCard.vue'
import SaveAsTemplateModal from '@/modules/lessons/components/SaveAsTemplateModal.vue'
import CloneLessonModal from '@/modules/lessons/components/CloneLessonModal.vue'
import { lessonPlanApi } from '@/modules/groups/api/lessonPlanApi'
import type { LessonPlan } from '@/modules/groups/api/lessonPlanApi'
import { lessonsTemplateApi } from '@/modules/lessons/api/lessonsTemplateApi'
import type { KnowledgeTemplate } from './api/knowledgeApi'

const { t } = useI18n()
const router = useRouter()
const groupStore = useGroupStore()
const {
  lessons, templates, isLoading, error,
  reload,
} = useKnowledge()

// ── Students sidebar ────────────────────────────────────────
const studentRelations = ref<any[]>([])
const selectedRelation = ref<any | null>(null)
const studentsLoading = ref(false)

async function loadStudents() {
  studentsLoading.value = true
  try {
    const res = await relationsApi.getTutorRelations({ status: 'active' })
    const data = (res as any)
    studentRelations.value = Array.isArray(data) ? data : (data.results ?? [])
  } catch (e) {
    console.warn('[KnowledgeLibrary] Failed to load students:', e)
  } finally {
    studentsLoading.value = false
  }
}

onMounted(() => {
  loadStudents()
  groupStore.fetchGroups()
  loadMyFiles()
})

// ── Select student → load group + materials ─────────────────
const selectedGroupId = ref<string | null>(null)
const groupMaterials = computed(() => groupStore.materials)

async function selectRelation(rel: any) {
  // НЕ встановлюємо selectedRelation одразу — чекаємо groupId (щоб не було флікера)
  selectedRelation.value = null
  const studentId = rel.student?.id ?? rel.student_id

  // Load LearningGroups and find the implicit one containing this student
  await groupStore.fetchGroups()
  const implicitGroups = groupStore.groups.filter(
    (g: any) => g.group_type === 'IMPLICIT' && g.is_active
  )

  let foundGroupId: string | null = null

  for (const g of implicitGroups) {
    try {
      await groupStore.selectGroup(g.id)
      if (groupStore.students.includes(studentId)) {
        foundGroupId = g.id
        break
      }
    } catch { /* ignore */ }
  }

  // Fallback: if no implicit group found, use first active group
  if (!foundGroupId && groupStore.groups.length) {
    const firstActive = groupStore.groups.find((g: any) => g.is_active)
    if (firstActive) {
      foundGroupId = firstActive.id
      await groupStore.selectGroup(firstActive.id)
    }
  }

  // Встановлюємо обидва після async — без флікера GroupMaterialsManager
  selectedGroupId.value = foundGroupId
  selectedRelation.value = rel
  loadQuota()
}

// Назва поточного вибраного класу (для contextual hints)
const currentGroupTitle = computed<string>(() => {
  if (!selectedGroupId.value) return ''
  return (
    groupStore.selectedGroup?.title
    ?? groupStore.explicitGroups.find((g: any) => g.id === selectedGroupId.value)?.title
    ?? ''
  )
})

// Вибір явної групи (класу) — без relation
async function selectExplicitGroup(groupId: string) {
  deletingGroupId.value = null
  selectedRelation.value = null
  selectedGroupId.value = groupId
  await groupStore.selectGroup(groupId)
  loadQuota()
}

// ── Delete group ─────────────────────────────────────────────
const deletingGroupId = ref<string | null>(null)

async function confirmDeleteGroup(groupId: string) {
  try {
    await groupStore.deleteGroup(groupId)
    if (selectedGroupId.value === groupId) {
      selectedGroupId.value = null
      selectedRelation.value = null
    }
  } catch (e) {
    console.warn('[KnowledgeLibrary] deleteGroup failed:', e)
  } finally {
    deletingGroupId.value = null
  }
}

// ── Create group ──────────────────────────────────────────────
const isCreatingGroup = ref(false)
const newGroupTitle = ref('')

async function submitCreateGroup() {
  const title = newGroupTitle.value.trim()
  if (!title) return
  try {
    await groupStore.createGroup({ title })
    newGroupTitle.value = ''
    isCreatingGroup.value = false
  } catch (e) {
    console.warn('[KnowledgeLibrary] createGroup failed:', e)
  }
}

// ── Rename group ──────────────────────────────────────────────
const renamingGroupId = ref<string | null>(null)
const renamingGroupTitle = ref('')

function startRenameGroup(group: any) {
  deletingGroupId.value = null
  renamingGroupId.value = group.id
  renamingGroupTitle.value = group.title
}

async function submitRenameGroup(groupId: string) {
  const title = renamingGroupTitle.value.trim()
  if (!title) { renamingGroupId.value = null; return }
  try {
    await groupStore.updateGroup(groupId, { title })
  } catch (e) {
    console.warn('[KnowledgeLibrary] updateGroup failed:', e)
  } finally {
    renamingGroupId.value = null
  }
}

// ── Lesson Plans (Teacher OS: Group → Lesson → Board) ────────
const lessonPlans = ref<LessonPlan[]>([])
const isLoadingPlans = ref(false)
const isCreatingPlan = ref(false)
const newPlanTitle = ref('')
const renamingPlanId = ref<string | null>(null)
const renamingPlanTitle = ref('')
const expandedPlanId = ref<string | null>(null)

async function loadLessonPlans(groupId: string) {
  isLoadingPlans.value = true
  try {
    lessonPlans.value = await lessonPlanApi.list(groupId)
  } catch (e) {
    console.warn('[KnowledgeLibrary] loadLessonPlans failed:', e)
    lessonPlans.value = []
  } finally {
    isLoadingPlans.value = false
  }
}

function startCreatePlan() {
  isCreatingPlan.value = true
  newPlanTitle.value = ''
}

async function submitCreatePlan() {
  const title = newPlanTitle.value.trim()
  if (!title || !selectedGroupId.value) return
  const gid = selectedGroupId.value
  try {
    const plan = await lessonPlanApi.create(gid, { title })
    lessonPlans.value.push(plan)
    newPlanTitle.value = ''
    isCreatingPlan.value = false
  } catch (e) {
    console.warn('[KnowledgeLibrary] submitCreatePlan failed:', e)
  }
}

function startRenamePlan(plan: LessonPlan) {
  renamingPlanId.value = plan.id
  renamingPlanTitle.value = plan.title
}

async function submitRenamePlan(planId: string) {
  const title = renamingPlanTitle.value.trim()
  if (!title || !selectedGroupId.value) { renamingPlanId.value = null; return }
  try {
    const updated = await lessonPlanApi.update(selectedGroupId.value, planId, { title })
    const idx = lessonPlans.value.findIndex((p) => p.id === planId)
    if (idx !== -1) lessonPlans.value[idx] = updated
  } catch (e) {
    console.warn('[KnowledgeLibrary] submitRenamePlan failed:', e)
  } finally {
    renamingPlanId.value = null
  }
}

async function deletePlan(planId: string) {
  if (!selectedGroupId.value) return
  try {
    await lessonPlanApi.delete(selectedGroupId.value, planId)
    lessonPlans.value = lessonPlans.value.filter((p) => p.id !== planId)
    if (expandedPlanId.value === planId) expandedPlanId.value = null
  } catch (e) {
    console.warn('[KnowledgeLibrary] deletePlan failed:', e)
  }
}

async function removePlanMaterial(planId: string, materialId: string) {
  if (!selectedGroupId.value) return
  try {
    await lessonPlanApi.removeMaterial(selectedGroupId.value, planId, materialId)
    const plan = lessonPlans.value.find((p) => p.id === planId)
    if (plan) {
      plan.materials = plan.materials.filter((m) => m.id !== materialId)
      plan.material_count = plan.materials.length
    }
  } catch (e) {
    console.warn('[KnowledgeLibrary] removePlanMaterial failed:', e)
  }
}

function togglePlanExpand(planId: string) {
  expandedPlanId.value = expandedPlanId.value === planId ? null : planId
}

function startLessonPlan(plan: LessonPlan) {
  const query: Record<string, string> = {}
  if (selectedGroupId.value) query.groupId = selectedGroupId.value
  query.lessonName = plan.title
  query.lessonPlanId = plan.id
  router.push({ path: '/winterboard/new', query })
}

// Підвантажуємо плани при виборі групи
watch(
  () => selectedGroupId.value,
  (gid) => {
    if (gid && !selectedRelation.value) {
      loadLessonPlans(gid)
    } else {
      lessonPlans.value = []
      expandedPlanId.value = null
    }
  },
)

// ── File Upload ─────────────────────────────────────────────
const fileInput = ref<HTMLInputElement | null>(null)
const isUploading = ref(false)
const uploadError = ref<string | null>(null)

// Ліміти відповідають бекенду (ContentItemUploadView.UPLOAD_SIZE_LIMITS_MB)
const UPLOAD_LIMITS_MB: Record<string, number> = {
  image: 10, pdf: 50, audio: 50, video: 200, presentation: 50,
}

const PRESENTATION_MIMES = new Set([
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'application/vnd.ms-powerpoint',
])

function getContentType(file: File): string {
  if (file.type.startsWith('image/')) return 'image'
  if (file.type === 'application/pdf') return 'pdf'
  if (file.type.startsWith('audio/')) return 'audio'
  if (file.type.startsWith('video/')) return 'video'
  if (PRESENTATION_MIMES.has(file.type)) return 'presentation'
  return 'image'
}

async function handleFileUpload(event: Event) {
  const input = event.target as HTMLInputElement
  const files = Array.from(input?.files ?? [])
  if (!files.length) return

  uploadError.value = null
  isUploading.value = true
  try {
    for (const file of files) {
      const contentType = getContentType(file)
      const limitMb = UPLOAD_LIMITS_MB[contentType] ?? 10
      if (file.size > limitMb * 1024 * 1024) {
        uploadError.value = `Файл "${file.name}" завеликий. Максимум ${limitMb} MB.`
        continue
      }
      const formData = new FormData()
      formData.append('file', file)
      formData.append('title', file.name)
      const result: any = await learningContentApi.uploadFile(formData)
      // Прикріплюємо до групи тільки якщо студент вибраний (є groupId)
      if (result?.id && selectedGroupId.value) {
        await groupStore.addMaterial(selectedGroupId.value, result.id)
      }
    }
    if (selectedGroupId.value) {
      await groupStore.fetchMaterials(selectedGroupId.value)
    }
    loadQuota()
    loadMyFiles()  // Оновлюємо список файлів бібліотеки
  } catch (e: any) {
    const errData = e?.response?.data
    if (errData?.error === 'file_too_large') {
      uploadError.value = `Файл завеликий. Максимум ${errData.limit_mb} MB (файл ${errData.actual_mb} MB).`
    } else if (errData?.error === 'unsupported_format') {
      uploadError.value = `Формат не підтримується: ${errData.mime || 'невідомий'}. Підтримуються: зображення, PDF, аудіо, відео, PPTX.`
    } else {
      uploadError.value = 'Помилка завантаження. Спробуйте ще раз.'
    }
  } finally {
    isUploading.value = false
    if (input) input.value = ''
  }
}

// ── Remove material ─────────────────────────────────────────
async function handleRemoveMaterial(materialId: string) {
  await groupStore.removeMaterial(materialId)
}

// ── Catalog search (ПРИХОВАНО: платформа поки не має контенту) ──────
// Змінні і функції збережено для майбутнього використання
const showCatalog = ref(false)
const catalogQuery = ref('')
const catalogResults = ref<ContentItemSummary[]>([])
const isCatalogSearching = ref(false)
const addedItemIds = ref(new Set<number>())
// stub-функції для прихованого шаблону (vue-tsc перевіряє навіть v-if="false")
function onCatalogInput() { /* платформний каталог тимчасово вимкнено */ }
async function addCatalogItem(_item: ContentItemSummary) { /* платформний каталог тимчасово вимкнено */ }

// ── Моя бібліотека: список файлів тьютора ───────────────────
const myFiles = ref<ContentItemSummary[]>([])
const isLoadingMyFiles = ref(false)

// Фільтрація бібліотеки за типом файлу
const libraryTab = ref<string>('all')
const LIBRARY_TABS = [
  { key: 'all',          label: 'Всі' },
  { key: 'pdf',          label: 'PDF' },
  { key: 'image',        label: 'Фото' },
  { key: 'presentation', label: 'Слайди' },
  { key: 'audio',        label: 'Аудіо' },
  { key: 'video',        label: 'Відео' },
] as const

const tabCounts = computed<Record<string, number>>(() => {
  const counts: Record<string, number> = {}
  for (const f of myFiles.value) {
    counts[f.type] = (counts[f.type] ?? 0) + 1
  }
  return counts
})

const filteredMyFiles = computed(() => {
  if (libraryTab.value === 'all') return myFiles.value
  return myFiles.value.filter(f => f.type === libraryTab.value)
})
const addedFromLibrary = ref(new Set<number>())
const pendingDeleteFileId = ref<number | null>(null)

async function loadMyFiles() {
  isLoadingMyFiles.value = true
  try {
    const res: any = await learningContentApi.searchItems({
      ownership_type: 'TUTOR',
      q: '',
    })
    myFiles.value = res.items ?? []
  } catch {
    myFiles.value = []
  } finally {
    isLoadingMyFiles.value = false
  }
}

async function addLibraryItem(item: ContentItemSummary) {
  if (!selectedGroupId.value || addedFromLibrary.value.has(item.id)) return
  try {
    await groupStore.addMaterial(selectedGroupId.value, item.id)
    addedFromLibrary.value = new Set([...addedFromLibrary.value, item.id])
    if (selectedGroupId.value) await groupStore.fetchMaterials(selectedGroupId.value)
  } catch (e: any) {
    console.warn('[KnowledgeLibrary] addLibraryItem failed:', e)
  }
}

async function deleteFile(itemId: number) {
  try {
    await learningContentApi.deleteContentItem(itemId)
    myFiles.value = myFiles.value.filter(f => f.id !== itemId)
    // Якщо файл був у групі — оновлюємо список матеріалів групи
    if (selectedGroupId.value) await groupStore.fetchMaterials(selectedGroupId.value)
    loadQuota()
  } catch (e: any) {
    console.warn('[KnowledgeLibrary] deleteFile failed:', e)
  } finally {
    pendingDeleteFileId.value = null
  }
}

function typeLabel(type: string): string {
  const map: Record<string, string> = {
    problem: 'Задача', theory: 'Теорія', test: 'Тест',
    presentation: 'Слайди', video: 'Відео', pdf: 'PDF',
    image: 'Фото', audio: 'Аудіо', link: 'Посилання',
  }
  return map[type] ?? type
}

// Скидаємо стан "додано" при зміні класу
watch(selectedGroupId, () => {
  addedItemIds.value = new Set()
  catalogQuery.value = ''
  catalogResults.value = []
  showCatalog.value = false
  addedFromLibrary.value = new Set()
  pendingDeleteFileId.value = null
})

// ── Storage quota ───────────────────────────────────────────
const storageQuota = ref<StorageQuota | null>(null)

async function loadQuota() {
  try {
    storageQuota.value = await learningContentApi.getStorageQuota()
  } catch { /* ignore */ }
}

onMounted(loadQuota)

// ── Lessons filtered by selected student ────────────────────
const studentLessons = computed(() => {
  if (!selectedRelation.value) return []
  const studentId = selectedRelation.value.student?.id ?? selectedRelation.value.student_id
  return lessons.value.filter((l: any) => l.student === studentId)
})

// ── Відображуване ім'я обраного учня ────────────────────────
const studentDisplayName = computed((): string => {
  if (!selectedRelation.value?.student) return ''
  const s = selectedRelation.value.student
  if (s.is_demo) return 'Демо'
  return `${s.first_name || ''} ${(s.last_name || '').charAt(0) ? (s.last_name || '').charAt(0) + '.' : ''}`.trim()
})

// ── Open Board ──────────────────────────────────────────────
const isCreatingLesson = ref(false)

// "Нова дошка" — solo session без студента (підготовка / пісочниця)
function handleOpenNewBoard() {
  router.push({
    path: '/winterboard/new',
    query: selectedGroupId.value ? { groupId: selectedGroupId.value } : {},
  })
}

async function handleOpenBoardForStudent() {
  if (!selectedRelation.value) return

  // Reuse existing DRAFT/IN_PROGRESS lesson (Правило 3: 1 DRAFT per student)
  const active = studentLessons.value.find(
    (l: any) => ['DRAFT', 'draft', 'IN_PROGRESS', 'in_progress'].includes(l.status)
  )
  if (active) {
    if (active.session_uuid) {
      // Pass groupId so sidebar shows materials on the board
      router.push({
        path: `/winterboard/${active.session_uuid}`,
        query: selectedGroupId.value ? { groupId: selectedGroupId.value } : {},
      })
    } else {
      router.push(`/winterboard/classroom/${active.id}`)
    }
    return
  }

  // No active lesson — відкриваємо нову дошку; передаємо ім'я учня для авто-назви сесії
  const query: Record<string, string> = {}
  if (selectedGroupId.value) query.groupId = selectedGroupId.value
  if (studentDisplayName.value) query.studentName = studentDisplayName.value
  router.push({ path: '/winterboard/new', query })
}

function openBoardSession(sessionUuid: string) {
  router.push({
    path: `/winterboard/${sessionUuid}`,
    query: selectedGroupId.value ? { groupId: selectedGroupId.value } : {},
  })
}

// ── Clone via modal ─────────────────────────────────────────
const showCloneModal = ref(false)
const cloneLessonData = ref<{ id: number; title: string } | null>(null)

function showCloneLessonModal(lesson: any) {
  cloneLessonData.value = {
    id: lesson.id,
    title: formatDate(lesson.start) || `Урок #${lesson.id}`,
  }
  showCloneModal.value = true
}

function onLessonCloned() {
  reload()
}

// ── Template, Delete (preserved from original) ───────────────
const showTemplateModal = ref(false)
const selectedLessonId = ref<number | null>(null)

function handleSaveAsTemplate(lessonId: number) {
  selectedLessonId.value = lessonId
  showTemplateModal.value = true
}

function onTemplateSaved() {
  reload()
}

function toSavedTemplate(tmpl: KnowledgeTemplate): SavedTemplateItem {
  return {
    id: tmpl.id,
    title: tmpl.title,
    content_count: tmpl.content_count,
    has_board: tmpl.has_board,
    source_lesson_id: tmpl.source_lesson_id,
    created_at: tmpl.created_at,
  }
}

function handleCreateFromTemplate(templateId: number) {
  router.push({ name: 'lesson-create', query: { template_id: String(templateId) } })
}

async function handleDeleteTemplate(templateId: number) {
  try {
    await lessonsTemplateApi.deleteTemplate(templateId)
    reload()
  } catch (e) {
    console.warn('[KnowledgeLibrary] Delete failed:', e)
  }
}

// ── Helpers ─────────────────────────────────────────────────
function formatDate(dt: string): string {
  if (!dt) return '—'
  return new Date(dt).toLocaleDateString('uk-UA', {
    day: 'numeric', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i]
}

function getTypeIcon(type: string): string {
  if (!type) return '📄'
  if (type.startsWith('image')) return '🖼️'
  if (type.includes('pdf')) return '📄'
  if (type.startsWith('audio')) return '🎵'
  if (type.startsWith('video')) return '🎬'
  return '📄'
}
</script>

<style scoped>
.knowledge-page {
  max-width: 1200px;
  margin: 0 auto;
  padding: 1.5rem;
}
.knowledge-page__header {
  margin-bottom: 1.5rem;
}
.knowledge-page__title {
  font-size: 1.5rem;
  font-weight: 700;
  color: #1a202c;
  margin-bottom: 0.25rem;
}
.knowledge-page__subtitle {
  font-size: 0.875rem;
  color: #64748b;
}
.knowledge-page__layout {
  display: grid;
  grid-template-columns: 240px 1fr;
  gap: 1.5rem;
  min-height: calc(100vh - 200px);
}
@media (max-width: 768px) {
  .knowledge-page__layout {
    grid-template-columns: 1fr;
  }
}

/* ── New Board button ── */
.knowledge-page__new-board-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.375rem;
  width: 100%;
  padding: 0.625rem 0.75rem;
  font-size: 0.875rem;
  font-weight: 600;
  color: #ffffff;
  background: #10b981;
  border: none;
  border-radius: 8px;
  cursor: pointer;
  transition: background 0.15s;
  margin-bottom: 0.75rem;
}
.knowledge-page__new-board-btn:hover {
  background: #059669;
}
.knowledge-page__sidebar-divider {
  height: 1px;
  background: #e2e8f0;
  margin-bottom: 0.75rem;
}

/* ── Sidebar ── */
.knowledge-page__sidebar {
  background: #f8fafc;
  border-radius: 12px;
  padding: 1rem;
  border: 1px solid #e2e8f0;
}
.knowledge-page__sidebar-section-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 0.75rem;
}
.knowledge-page__sidebar-title {
  font-size: 0.875rem;
  font-weight: 600;
  color: #475569;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  margin-bottom: 0; /* reset: тепер margin на wrapper */
}
.knowledge-page__sidebar-count {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 20px;
  height: 18px;
  padding: 0 5px;
  font-size: 0.6875rem;
  font-weight: 700;
  color: #475569;
  background: #e2e8f0;
  border-radius: 20px;
}
.knowledge-page__sidebar-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.25rem;
  font-size: 0.8125rem;
  color: #94a3b8;
  text-align: center;
  padding: 1.25rem 0.5rem;
  line-height: 1.45;
}
.knowledge-page__sidebar-empty-icon {
  font-size: 1.5rem;
  margin-bottom: 0.125rem;
}
.knowledge-page__student-btn {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  width: 100%;
  padding: 0.625rem 0.75rem;
  border-radius: 8px;
  border: 1px solid transparent;
  background: transparent;
  cursor: pointer;
  text-align: left;
  transition: all 0.15s;
  margin-bottom: 0.25rem;
}
.knowledge-page__student-btn:hover {
  background: #e2e8f0;
}
.knowledge-page__student-btn--active {
  background: #ffffff;
  border-color: #3b82f6;
  box-shadow: 0 1px 3px rgba(59, 130, 246, 0.15);
}
.knowledge-page__student-name {
  font-size: 0.875rem;
  font-weight: 500;
  color: #1e293b;
}
.knowledge-page__group-count {
  font-size: 0.6875rem;
  font-weight: 600;
  padding: 1px 6px;
  border-radius: 4px;
  background: #e0f2fe;
  color: #0369a1;
  margin-left: auto;
}
.knowledge-page__demo-badge {
  font-size: 0.6875rem;
  font-weight: 600;
  padding: 1px 6px;
  border-radius: 4px;
  background: #f3e8ff;
  color: #7c3aed;
}

/* ── Group row з кнопкою видалення ── */
.knowledge-page__group-row {
  display: flex;
  align-items: center;
  gap: 2px;
  border-radius: 8px;
  border: 1px solid transparent;
  margin-bottom: 0.25rem;
  transition: border-color 0.15s, background 0.15s;
}
.knowledge-page__group-row:hover {
  background: #e2e8f0;
}
.knowledge-page__group-row--active {
  background: #ffffff;
  border-color: #3b82f6;
  box-shadow: 0 1px 3px rgba(59, 130, 246, 0.15);
}
.knowledge-page__group-btn {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  flex: 1;
  min-width: 0;
  padding: 0.625rem 0.5rem 0.625rem 0.75rem;
  background: transparent;
  border: none;
  cursor: pointer;
  text-align: left;
}
/* Кнопка "×" — прихована, з'являється при ховері */
.knowledge-page__group-del {
  flex-shrink: 0;
  width: 22px;
  height: 22px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 1rem;
  line-height: 1;
  color: #94a3b8;
  background: none;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  opacity: 0;
  transition: opacity 0.15s, color 0.15s, background 0.15s;
  margin-right: 4px;
}
.knowledge-page__group-row:hover .knowledge-page__group-del {
  opacity: 1;
}
.knowledge-page__group-del:hover {
  color: #ef4444;
  background: #fee2e2;
}
/* ── Кнопка "+" в заголовку класів ── */
.knowledge-page__sidebar-add-btn {
  margin-left: auto;
  width: 22px;
  height: 22px;
  border-radius: 6px;
  border: 1.5px solid #d1d5db;
  background: transparent;
  color: #6b7280;
  font-size: 18px;
  line-height: 1;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.15s;
  flex-shrink: 0;
}
.knowledge-page__sidebar-add-btn:hover {
  border-color: #2563eb;
  color: #2563eb;
  background: #eff6ff;
}
/* ── Рядок створення/перейменування класу ── */
.knowledge-page__group-create-row {
  display: flex;
  align-items: center;
  gap: 4px;
  margin-bottom: 4px;
}
.knowledge-page__group-create-input {
  flex: 1;
  padding: 4px 8px;
  font-size: 0.875rem;
  border: 1.5px solid #2563eb;
  border-radius: 6px;
  outline: none;
  background: #fff;
  min-width: 0;
}
/* ── Кнопка перейменування (олівець) ── */
.knowledge-page__group-edit {
  flex-shrink: 0;
  width: 22px;
  height: 22px;
  border: none;
  background: transparent;
  color: #9ca3af;
  font-size: 14px;
  cursor: pointer;
  border-radius: 4px;
  padding: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  opacity: 0;
  transition: opacity 0.15s, color 0.15s;
}
.knowledge-page__group-row:hover .knowledge-page__group-edit {
  opacity: 1;
}
.knowledge-page__group-edit:hover {
  color: #2563eb;
  background: #eff6ff;
}
/* ── Текст-підказка при видаленні ── */
.knowledge-page__group-del-prompt {
  flex: 1;
  font-size: 0.75rem;
  color: #ef4444;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
/* Кнопки confirm / cancel */
.knowledge-page__group-del-confirm,
.knowledge-page__group-del-cancel {
  flex-shrink: 0;
  width: 22px;
  height: 22px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 0.75rem;
  font-weight: 700;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  transition: background 0.15s;
}
.knowledge-page__group-del-confirm {
  color: #fff;
  background: #ef4444;
  margin-right: 2px;
}
.knowledge-page__group-del-confirm:hover {
  background: #dc2626;
}
.knowledge-page__group-del-cancel {
  color: #64748b;
  background: #f1f5f9;
  margin-right: 4px;
}
.knowledge-page__group-del-cancel:hover {
  background: #e2e8f0;
}

/* ── Main area ── */
.knowledge-page__main {
  min-width: 0;
  display: flex;
  flex-direction: column;
}
/* Бібліотека завжди знизу — Уроки та матеріали груп важливіші */
.knowledge-page__section--library {
  order: 10;
}
.knowledge-page__placeholder {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 320px;
  padding: 2rem;
  background: #f8fafc;
  border-radius: 12px;
  border: 1px dashed #cbd5e1;
  margin-bottom: 1rem;
}
.knowledge-page__placeholder-inner {
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
  max-width: 340px;
}
.knowledge-page__placeholder-emoji {
  font-size: 2.5rem;
  margin-bottom: 0.75rem;
  animation: kb-wave 2s ease-in-out infinite;
}
@keyframes kb-wave {
  0%, 100% { transform: rotate(0deg); }
  25% { transform: rotate(-10deg); }
  75% { transform: rotate(10deg); }
}
.knowledge-page__placeholder-title {
  font-size: 1.0625rem;
  font-weight: 600;
  color: #475569;
  margin-bottom: 0.25rem;
}
.knowledge-page__placeholder-hint {
  font-size: 0.8125rem;
  color: #94a3b8;
  margin-bottom: 1.5rem;
  line-height: 1.5;
}
.knowledge-page__placeholder-steps {
  display: flex;
  flex-direction: column;
  gap: 0.625rem;
  text-align: left;
  width: 100%;
}
.knowledge-page__placeholder-step {
  display: flex;
  align-items: flex-start;
  gap: 0.625rem;
  font-size: 0.8125rem;
  color: #64748b;
  line-height: 1.4;
}
.knowledge-page__placeholder-step-num {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  width: 20px;
  height: 20px;
  font-size: 0.6875rem;
  font-weight: 700;
  color: #ffffff;
  background: #3b82f6;
  border-radius: 50%;
  margin-top: 1px;
}
.knowledge-page__section {
  background: #ffffff;
  border: 1px solid #e2e8f0;
  border-radius: 12px;
  padding: 1rem 1.25rem;
  margin-bottom: 1rem;
}
.knowledge-page__section-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 0.75rem;
}
.knowledge-page__section-title {
  font-size: 0.9375rem;
  font-weight: 600;
  color: #1e293b;
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

/* Лічильник файлів у заголовку бібліотеки */
.knowledge-page__file-count {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 22px;
  height: 20px;
  padding: 0 6px;
  font-size: 0.6875rem;
  font-weight: 700;
  color: #3b82f6;
  background: #eff6ff;
  border-radius: 20px;
  border: 1px solid #bfdbfe;
}

/* Contextual hint під заголовком бібліотеки */
.knowledge-page__section-hint {
  font-size: 0.75rem;
  color: #6366f1;
  margin-top: 0.25rem;
  font-weight: 500;
}

/* ── Upload button ── */
.knowledge-page__upload-btn {
  display: inline-flex;
  align-items: center;
  padding: 0.5rem 1rem;
  font-size: 0.8125rem;
  font-weight: 600;
  color: #ffffff;
  background: #3b82f6;
  border-radius: 8px;
  cursor: pointer;
  transition: background 0.15s;
}
.knowledge-page__upload-btn:hover {
  background: #2563eb;
}

/* ── Quota bar ── */
.knowledge-page__quota {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  margin-bottom: 0.75rem;
}
.knowledge-page__quota-bar {
  flex: 1;
  height: 6px;
  background: #e2e8f0;
  border-radius: 3px;
  overflow: hidden;
}
.knowledge-page__quota-fill {
  height: 100%;
  background: #3b82f6;
  border-radius: 3px;
  transition: width 0.3s;
}
.knowledge-page__quota-fill--warning {
  background: #f59e0b;
}
.knowledge-page__quota-fill--critical {
  background: #ef4444;
}
.knowledge-page__quota-text {
  font-size: 0.75rem;
  color: #64748b;
  white-space: nowrap;
}

/* ── Upload error ── */
.knowledge-page__upload-error {
  font-size: 0.8125rem;
  color: #b91c1c;
  background: #fef2f2;
  border: 1px solid #fecaca;
  border-radius: 6px;
  padding: 0.5rem 0.75rem;
  margin-bottom: 0.5rem;
}

/* ── Materials list ── */
.knowledge-page__empty-materials {
  text-align: center;
  color: #94a3b8;
  font-size: 0.8125rem;
  padding: 1.5rem 0;
}
.knowledge-page__materials-list {
  display: flex;
  flex-direction: column;
  gap: 2px;
}
.knowledge-page__material-item {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.5rem 0.625rem;
  border-radius: 6px;
  transition: background 0.1s;
}
.knowledge-page__material-item:hover {
  background: #f1f5f9;
}
.knowledge-page__material-icon {
  font-size: 1rem;
  flex-shrink: 0;
}
.knowledge-page__material-title {
  font-size: 0.8125rem;
  color: #334155;
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.knowledge-page__material-remove {
  font-size: 0.75rem;
  color: #94a3b8;
  background: none;
  border: none;
  cursor: pointer;
  padding: 2px 4px;
  border-radius: 4px;
  opacity: 0;
  transition: opacity 0.1s, color 0.1s;
}
.knowledge-page__material-item:hover .knowledge-page__material-remove {
  opacity: 1;
}
.knowledge-page__material-remove:hover {
  color: #ef4444;
  background: #fef2f2;
}

/* ══════════════════════════════════════════
   LIBRARY FILE LIST
   ══════════════════════════════════════════ */
.knowledge-page__lib-loading {
  font-size: 0.8125rem;
  color: #94a3b8;
  text-align: center;
  padding: 0.75rem 0 0.25rem;
}
.knowledge-page__lib-empty {
  font-size: 0.8125rem;
  color: #94a3b8;
  text-align: center;
  padding: 0.75rem 0 0.25rem;
}
.knowledge-page__lib-empty--onboard {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.25rem;
  padding: 1.25rem 1rem 0.75rem;
}
.knowledge-page__lib-empty--filter {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.25rem;
  padding: 0.75rem 1rem;
}

/* ── Library type tabs ─────────────────────────────────── */
.knowledge-page__lib-tabs {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
  margin-bottom: 8px;
}
.knowledge-page__lib-tab {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 3px 10px;
  border-radius: 20px;
  border: 1px solid #e2e8f0;
  background: #f8fafc;
  color: #64748b;
  font-size: 0.8125rem;
  font-weight: 500;
  cursor: pointer;
  transition: background 0.12s, border-color 0.12s, color 0.12s;
  white-space: nowrap;
  line-height: 1.5;
}
.knowledge-page__lib-tab:hover {
  background: #e2e8f0;
  color: #1e293b;
}
.knowledge-page__lib-tab--active {
  background: #2563eb;
  border-color: #2563eb;
  color: #fff;
}
.knowledge-page__lib-tab--active:hover {
  background: #1d4ed8;
}
.knowledge-page__lib-tab-count {
  font-size: 0.6875rem;
  font-weight: 700;
  background: rgba(255,255,255,0.25);
  color: inherit;
  border-radius: 20px;
  padding: 0 5px;
  min-width: 16px;
  text-align: center;
  line-height: 1.6;
}
.knowledge-page__lib-empty-icon {
  font-size: 2rem;
  margin-bottom: 0.25rem;
}
.knowledge-page__lib-empty-title {
  font-size: 0.875rem;
  font-weight: 600;
  color: #64748b;
}
.knowledge-page__lib-empty-hint {
  font-size: 0.75rem;
  color: #94a3b8;
  line-height: 1.5;
  max-width: 280px;
}
.knowledge-page__lib-list {
  display: flex;
  flex-direction: column;
  gap: 1px;
  margin-top: 0.5rem;
  max-height: 280px;
  overflow-y: auto;
}
.knowledge-page__lib-item {
  display: flex;
  align-items: center;
  gap: 0.375rem;
  padding: 0.375rem 0.25rem;
  border-radius: 6px;
  transition: background 0.1s;
}
.knowledge-page__lib-item:hover {
  background: #f8fafc;
}
.knowledge-page__lib-name {
  flex: 1;
  font-size: 0.8125rem;
  color: #334155;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

/* [+] Додати до класу */
.knowledge-page__lib-add {
  flex-shrink: 0;
  width: 24px;
  height: 24px;
  border-radius: 50%;
  border: 1.5px solid #c7d2fe;
  background: #eef2ff;
  color: #4f46e5;
  font-weight: 700;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.15s;
}
.knowledge-page__lib-add:hover:not(:disabled) {
  background: #4f46e5;
  border-color: #4f46e5;
  color: #fff;
}
.knowledge-page__lib-add--done {
  background: #dcfce7;
  border-color: #86efac;
  color: #16a34a;
  cursor: default;
}

/* Inline delete confirm */
.knowledge-page__lib-del-text {
  font-size: 0.75rem;
  color: #dc2626;
  font-weight: 500;
  white-space: nowrap;
}
.knowledge-page__lib-del-confirm {
  padding: 2px 8px;
  font-size: 0.75rem;
  font-weight: 600;
  color: #fff;
  background: #ef4444;
  border: none;
  border-radius: 4px;
  cursor: pointer;
}
.knowledge-page__lib-del-confirm:hover { background: #dc2626; }
.knowledge-page__lib-del-cancel {
  padding: 2px 8px;
  font-size: 0.75rem;
  color: #64748b;
  background: #f1f5f9;
  border: 1px solid #e2e8f0;
  border-radius: 4px;
  cursor: pointer;
}
.knowledge-page__lib-del-cancel:hover { background: #e2e8f0; }

/* [🗑️] кнопка видалення */
.knowledge-page__lib-del {
  flex-shrink: 0;
  width: 24px;
  height: 24px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: none;
  border: none;
  border-radius: 4px;
  color: #cbd5e1;
  cursor: pointer;
  opacity: 0;
  transition: opacity 0.15s, color 0.15s, background 0.15s;
}
.knowledge-page__lib-item:hover .knowledge-page__lib-del {
  opacity: 1;
}
.knowledge-page__lib-del:hover {
  color: #ef4444;
  background: #fef2f2;
}

/* ── Board button ── */
.knowledge-page__board-btn {
  width: 100%;
  padding: 0.75rem;
  font-size: 0.9375rem;
  font-weight: 600;
  color: #ffffff;
  background: #10b981;
  border: none;
  border-radius: 10px;
  cursor: pointer;
  transition: background 0.15s;
}
.knowledge-page__board-btn:hover:not(:disabled) {
  background: #059669;
}
.knowledge-page__board-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}
/* "Почати заняття" — синя brand-кнопка коли вибрано учня */
.knowledge-page__board-btn--lesson {
  background: #2563eb;
}
.knowledge-page__board-btn--lesson:hover:not(:disabled) {
  background: #1d4ed8;
}

/* ── Lessons list ── */
.knowledge-page__lessons-list {
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.knowledge-page__lesson-item {
  padding: 0.625rem 0.5rem;
  border-bottom: 1px solid #f1f5f9;
}
.knowledge-page__lesson-info {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  flex-wrap: wrap;
  margin-bottom: 0.375rem;
}
.knowledge-page__lesson-status {
  font-size: 0.6875rem;
  font-weight: 600;
  padding: 2px 6px;
  border-radius: 4px;
  text-transform: uppercase;
}
.knowledge-page__lesson-status--completed { background: #dcfce7; color: #166534; }
.knowledge-page__lesson-status--in_progress { background: #dbeafe; color: #1e40af; }
.knowledge-page__lesson-status--draft { background: #f1f5f9; color: #475569; }
.knowledge-page__lesson-status--cancelled { background: #fef2f2; color: #991b1b; }
.knowledge-page__lesson-date {
  font-size: 0.75rem;
  color: #64748b;
}
.knowledge-page__lesson-actions {
  display: flex;
  gap: 0.375rem;
}
.knowledge-page__action-btn {
  padding: 0.25rem 0.625rem;
  font-size: 0.75rem;
  font-weight: 500;
  color: #374151;
  background: none;
  border: 1px solid #e5e7eb;
  border-radius: 6px;
  cursor: pointer;
  transition: background 0.15s;
}
.knowledge-page__action-btn:hover {
  background: #f3f4f6;
  border-color: #d1d5db;
}
.knowledge-page__action-btn--primary {
  color: #2563eb;
  border-color: #bfdbfe;
  background: #eff6ff;
}
.knowledge-page__action-btn--primary:hover {
  background: #dbeafe;
  border-color: #93c5fd;
}

/* ══════════════════════════════════════════
   CATALOG SECTION — пошук + додавання
   ══════════════════════════════════════════ */
.knowledge-page__catalog-section {
  padding: 0;
  overflow: hidden;
}

/* Toggle header */
.knowledge-page__catalog-toggle {
  display: flex;
  align-items: center;
  justify-content: space-between;
  width: 100%;
  padding: 0.75rem 1.25rem;
  font-size: 0.875rem;
  font-weight: 500;
  color: #4f46e5;
  background: none;
  border: none;
  cursor: pointer;
  text-align: left;
  transition: background 0.15s;
  border-radius: 12px;
}
.knowledge-page__catalog-toggle:hover {
  background: #f5f3ff;
}
.knowledge-page__catalog-toggle-label {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}
.knowledge-page__catalog-chevron {
  transition: transform 0.2s ease;
  color: #9ca3af;
  flex-shrink: 0;
}
.knowledge-page__catalog-chevron--open {
  transform: rotate(180deg);
}

/* Expanded body */
.knowledge-page__catalog-body {
  padding: 0 1.25rem 1rem;
  border-top: 1px solid #f0f0f0;
}
.knowledge-page__catalog-input {
  width: 100%;
  border: 1.5px solid #e5e7eb;
  border-radius: 8px;
  padding: 0.5rem 0.75rem;
  font-size: 0.875rem;
  outline: none;
  margin: 0.75rem 0 0.5rem;
  transition: border-color 0.15s, box-shadow 0.15s;
  box-sizing: border-box;
  color: #1e293b;
}
.knowledge-page__catalog-input:focus {
  border-color: #4f46e5;
  box-shadow: 0 0 0 3px rgba(79, 70, 229, 0.1);
}
.knowledge-page__catalog-status {
  text-align: center;
  font-size: 0.8125rem;
  color: #9ca3af;
  padding: 1rem 0;
}
.knowledge-page__catalog-hint {
  font-size: 0.8125rem;
  color: #94a3b8;
  padding: 0.5rem 0 0.25rem;
  text-align: center;
}

/* Results list */
.knowledge-page__catalog-list {
  display: flex;
  flex-direction: column;
  gap: 1px;
  max-height: 280px;
  overflow-y: auto;
  margin-top: 0.25rem;
}
.knowledge-page__catalog-item {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.4rem 0.375rem;
  border-radius: 7px;
  transition: background 0.1s;
}
.knowledge-page__catalog-item:hover {
  background: #f8fafc;
}

/* Type badge */
.knowledge-page__catalog-badge {
  font-size: 9px;
  font-weight: 700;
  padding: 1px 5px;
  border-radius: 3px;
  text-transform: uppercase;
  flex-shrink: 0;
  white-space: nowrap;
}
.kct-problem     { background: #ede9fe; color: #6d28d9; }
.kct-test        { background: #fef3c7; color: #92400e; }
.kct-theory      { background: #dbeafe; color: #1e40af; }
.kct-video       { background: #fce7f3; color: #9d174d; }
.kct-presentation{ background: #d1fae5; color: #065f46; }
.kct-pdf         { background: #fee2e2; color: #991b1b; }
.kct-image       { background: #f0fdf4; color: #166534; }
.kct-audio       { background: #fdf4ff; color: #7e22ce; }
.kct-link        { background: #e0e7ff; color: #3730a3; }

/* Item name */
.knowledge-page__catalog-name {
  flex: 1;
  font-size: 0.8125rem;
  color: #374151;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

/* Add button */
.knowledge-page__catalog-add-btn {
  width: 26px;
  height: 26px;
  border-radius: 50%;
  border: 1.5px solid #c7d2fe;
  background: #eef2ff;
  color: #4f46e5;
  font-weight: 700;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  transition: all 0.15s;
}
.knowledge-page__catalog-add-btn:hover:not(.knowledge-page__catalog-add-btn--added) {
  background: #4f46e5;
  border-color: #4f46e5;
  color: #fff;
  transform: scale(1.1);
}
.knowledge-page__catalog-add-btn--added {
  background: #dcfce7;
  border-color: #86efac;
  color: #16a34a;
  cursor: default;
}

/* ══════════════════════════════════════════
   LESSON PLAN CARDS (Teacher OS: Group → Lesson → Board)
   ══════════════════════════════════════════ */

/* Skeleton-заглушка під час завантаження */
.knowledge-page__plan-skeleton {
  height: 72px;
  border-radius: 8px;
  background: #f1f5f9;
  margin-bottom: 6px;
}

/* Список карток уроків */
.knowledge-page__plan-list {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

/* Картка одного уроку */
.knowledge-page__plan-card {
  border: 1px solid #e2e8f0;
  border-radius: 8px;
  background: #fafcff;
  overflow: hidden;
  transition: border-color 0.15s, box-shadow 0.15s;
}
.knowledge-page__plan-card:hover {
  border-color: #93c5fd;
  box-shadow: 0 1px 4px rgba(59, 130, 246, 0.1);
}
.knowledge-page__plan-card--expanded {
  border-color: #3b82f6;
  box-shadow: 0 1px 6px rgba(59, 130, 246, 0.15);
}

/* Заголовок картки: назва + кількість матеріалів + кнопки */
.knowledge-page__plan-card-head {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 0.5rem 0.75rem;
  min-height: 40px;
}
/* ✎ і × завжди видимі на картці уроку (не приховати hover) */
.knowledge-page__plan-card-head .knowledge-page__group-edit,
.knowledge-page__plan-card-head .knowledge-page__group-del {
  opacity: 1;
}

/* Назва уроку */
.knowledge-page__plan-title {
  flex: 1;
  min-width: 0;
  font-size: 0.875rem;
  font-weight: 600;
  color: #1e293b;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

/* Лічильник матеріалів */
.knowledge-page__plan-mat-count {
  flex-shrink: 0;
  font-size: 0.6875rem;
  font-weight: 600;
  padding: 1px 7px;
  border-radius: 20px;
  background: #e0f2fe;
  color: #0369a1;
}

/* Кнопки дій під заголовком */
.knowledge-page__plan-card-actions {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 0 0.75rem 0.625rem;
}

/* "🎓 Почати урок" — менша версія board-btn */
.knowledge-page__board-btn--sm {
  padding: 0.375rem 0.875rem;
  font-size: 0.8125rem;
  border-radius: 7px;
  width: auto;
}

/* Розкрита панель матеріалів уроку */
.knowledge-page__plan-materials {
  border-top: 1px solid #e2e8f0;
  padding: 0.5rem 0.75rem;
  background: #f8fafc;
  display: flex;
  flex-direction: column;
  gap: 3px;
}

/* Рядок одного матеріалу */
.knowledge-page__plan-mat-row {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 3px 2px;
  border-radius: 5px;
  transition: background 0.1s;
}
.knowledge-page__plan-mat-row:hover {
  background: #e2e8f0;
}

/* Назва матеріалу */
.knowledge-page__plan-mat-name {
  flex: 1;
  min-width: 0;
  font-size: 0.8125rem;
  color: #374151;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
</style>
