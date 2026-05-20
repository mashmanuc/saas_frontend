<!-- Phase 21: My Lessons page — list of tutor's saved lessons
     Ref: PHASE21_KNOWLEDGE_CORE.md -->
<template>
  <div class="wb-my-lessons max-w-7xl mx-auto px-4 py-8">
    <!-- Header -->
    <div class="flex items-center justify-between mb-6">
      <h1 class="text-2xl font-bold text-gray-900">{{ $t('winterboard.lesson.myLessonsTitle') }}</h1>
    </div>

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
            class="inline-block mt-4 px-4 py-2 bg-primary-600 text-white rounded-lg text-sm font-medium hover:bg-primary-700 transition-colors"
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
                    {{ lesson.status }}
                  </span>
                </div>

                <!-- Actions -->
                <div class="mt-3 flex flex-wrap gap-2">
                  <!-- Провести урок (Classroom Hub shortcut) -->
                  <button
                    type="button"
                    class="px-3 py-1.5 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700 transition-colors disabled:opacity-50"
                    :disabled="conductingLessonId === lesson.id"
                    @click="conductLesson(lesson)"
                  >
                    {{ conductingLessonId === lesson.id
                      ? '...'
                      : $t('winterboard.classroomHub.conductLesson') }}
                  </button>
                  <button
                    type="button"
                    class="px-3 py-1.5 bg-primary-600 text-white rounded-lg text-sm font-medium hover:bg-primary-700 transition-colors disabled:opacity-50"
                    :disabled="loadingLessonId === lesson.id"
                    @click="openLesson(lesson)"
                  >
                    {{ loadingLessonId === lesson.id
                      ? $t('knowledge.lesson.reuse.loading')
                      : $t('knowledge.lesson.reuse.useLesson') }}
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
              class="px-6 py-2 text-sm font-medium text-primary-600 border border-primary-300 rounded-lg hover:bg-primary-50 transition-colors"
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

    <!-- Edit dialog (Phase 25 B1) -->
    <LessonEditDialog
      v-model="showEditDialog"
      :lesson="editTarget"
      @saved="onLessonEdited"
    />

    <!-- Conduct lesson: mode picker (Solo / Classroom) + optional student dialog -->
    <Teleport to="body">
      <div
        v-if="conductTarget"
        class="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
        @click.self="conductTarget = null"
      >
        <div class="bg-white rounded-xl p-6 w-full max-w-sm shadow-xl">
          <h3 class="text-lg font-semibold text-gray-900 mb-1">
            {{ $t('winterboard.classroomHub.conductLesson') }}
          </h3>
          <p class="text-sm text-gray-500 mb-4 truncate">{{ conductTarget.title }}</p>

          <!-- Mode picker: Solo (default, no student, lighter load) / Classroom (with student) -->
          <label class="block text-sm font-medium text-gray-700 mb-2">
            {{ $t('winterboard.classroomHub.modePickerTitle') }}
          </label>
          <div class="space-y-2 mb-4">
            <label
              class="flex items-start gap-2 p-2 border rounded-lg cursor-pointer transition"
              :class="conductMode === 'solo'
                ? 'border-primary-500 bg-primary-50'
                : 'border-gray-300 hover:bg-gray-50'"
              data-mode="solo"
            >
              <input
                type="radio"
                v-model="conductMode"
                value="solo"
                class="mt-1"
              />
              <div class="flex-1">
                <div class="text-sm font-medium text-gray-900">
                  {{ $t('winterboard.classroomHub.modeSolo') }}
                </div>
                <div class="text-xs text-gray-500">
                  {{ $t('winterboard.classroomHub.modeSoloHint') }}
                </div>
              </div>
            </label>
            <label
              class="flex items-start gap-2 p-2 border rounded-lg cursor-pointer transition"
              :class="conductMode === 'classroom'
                ? 'border-primary-500 bg-primary-50'
                : 'border-gray-300 hover:bg-gray-50'"
              data-mode="classroom"
            >
              <input
                type="radio"
                v-model="conductMode"
                value="classroom"
                class="mt-1"
              />
              <div class="flex-1">
                <div class="text-sm font-medium text-gray-900">
                  {{ $t('winterboard.classroomHub.modeClassroom') }}
                </div>
                <div class="text-xs text-gray-500">
                  {{ $t('winterboard.classroomHub.modeClassroomHint') }}
                </div>
              </div>
            </label>
          </div>

          <!-- Student picker shown ONLY when classroom mode is selected -->
          <template v-if="conductMode === 'classroom'">
            <label class="block text-sm font-medium text-gray-700 mb-1">
              {{ $t('winterboard.classroomHub.selectStudent') }}
            </label>
            <select
              v-if="conductStudents.length > 0"
              v-model="conductStudentId"
              class="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 mb-4"
            >
              <option :value="null" disabled>{{ $t('winterboard.classroomHub.chooseStudent') }}</option>
              <option v-for="s in conductStudents" :key="s.id" :value="s.id">{{ s.name }}</option>
            </select>
            <p
              v-else
              class="text-sm text-amber-600 mb-4"
            >
              {{ $t('winterboard.classroomHub.noStudents') }}
            </p>
          </template>

          <div class="flex justify-end gap-3">
            <button
              type="button"
              class="px-4 py-2 text-sm text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50"
              @click="conductTarget = null"
            >
              {{ $t('common.cancel') }}
            </button>
            <button
              type="button"
              class="px-4 py-2 text-sm text-white bg-green-600 rounded-lg hover:bg-green-700 disabled:opacity-50"
              :disabled="isStartDisabled"
              @click="executeConductLesson"
            >
              {{ isStartLoading ? '...' : $t('winterboard.classroomHub.startLesson') }}
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
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { lessonSaveApi } from '../api/lessonSaveApi'
import type { MyLesson, MyLessonsParams } from '../api/lessonSaveApi'
import { lessonViewApi } from '../api/lessonViewApi'
import { lessonsTemplateApi } from '@/modules/lessons/api/lessonsTemplateApi'
import { ordersApi } from '@/modules/booking/api/ordersApi'
import type { Order } from '@/modules/booking/api/ordersApi'
import lessonsApi from '@/api/lessons'
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
const loadingLessonId = ref<string | null>(null)
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

// Preview: loading guard поки оновлюємо snapshot
const previewingLessonId = ref<string | null>(null)

// Phase 25: Edit
const showEditDialog = ref(false)
const editTarget = ref<MyLesson | null>(null)

// Conduct lesson: mode picker (solo without student / classroom with student)
// + student id (only used when mode='classroom')
type ConductMode = 'solo' | 'classroom'
const conductTarget = ref<MyLesson | null>(null)
const conductMode = ref<ConductMode>('solo')   // default: lighter solo path
const conductStudentId = ref<number | null>(null)
const conductingLessonId = ref<string | null>(null)
const conductStudents = ref<Array<{ id: number; name: string }>>([])

// Start button — disabled while any flow is in progress, OR if classroom
// mode is selected and no student picked yet.
const isStartLoading = computed<boolean>(() => {
  return conductingLessonId.value !== null
    || loadingLessonId.value === conductTarget.value?.id
})
const isStartDisabled = computed<boolean>(() => {
  if (isStartLoading.value) return true
  if (conductMode.value === 'classroom' && !conductStudentId.value) return true
  return false
})

const PAGE_SIZE = 20

onMounted(() => {
  loadLessons()
  loadConductStudents()
})

// Phase 1.5: 1-click auto-open для resume_draft / resume_last_lesson CTA.
//
// Watch-sources: [lessons, isLoading, route.query.open]
//   - [lessons, isLoading] — чекаємо поки API відповів (slow network safe)
//   - route.query.open — ловить другий заход у той самий route з іншим ?open=
//     (user back-ається, натискає інший CTA — компонент не remount'иться, але
//     query змінюється, watcher знову спрацьовує з новим id)
//
// Race/dup protection:
//   - openedIds: Set<id> — НЕ відкриваємо ту ж чернетку повторно навіть
//     якщо watcher retrigger'иться до того як openLesson завершиться
//   - openLesson має власний guard loadingLessonId → захист від паралельних викликів
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
      // Lesson не знайдено на першій сторінці — мовчки залишаємось на списку
      // (lesson міг бути видалений або є на наступних сторінках пагінації)
      console.info('[WBMyLessonsPage] open=%s not found in loaded lessons', openId)
      return
    }

    // Auto-open: те ж саме, що ручний клік. openLesson має власний
    // loadingLessonId guard — швидкі повторні кліки безпечні.
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

async function openLesson(lesson: MyLesson): Promise<void> {
  if (loadingLessonId.value) return
  loadingLessonId.value = lesson.id
  loadError.value = null

  try {
    const { session_id, lesson_id } = await lessonViewApi.loadToSession(lesson.id)
    await router.push({
      name: 'winterboard-solo',
      params: { id: session_id },
      query: { source_lesson: lesson_id },
    })
  } catch (err) {
    console.error('[WBMyLessonsPage] load lesson error:', err)
    loadError.value = t('knowledge.lesson.reuse.loadError')
  } finally {
    loadingLessonId.value = null
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

// ── Conduct lesson: template → student → classroom ──────────────────
async function loadConductStudents(): Promise<void> {
  try {
    const res = await ordersApi.listOrders()
    const orders: Order[] = res.results ?? []
    const seen = new Set<number>()
    conductStudents.value = orders
      .filter((o) => {
        if (seen.has(o.student.id)) return false
        seen.add(o.student.id)
        return true
      })
      .map((o) => ({
        id: o.student.id,
        name: o.student.fullName || `${o.student.firstName} ${o.student.lastName}`.trim() || o.student.email,
      }))
  } catch (err) {
    console.error('[WBMyLessonsPage] loadStudents failed', err)
  }
}

function conductLesson(lesson: MyLesson): void {
  // Modal opens for BOTH modes — student-list emptiness is surfaced inside
  // the classroom branch of the modal, not as a hard guard. Solo path does
  // not require any students.
  conductTarget.value = lesson
  conductMode.value = 'solo'           // default to lighter path
  conductStudentId.value = null
}

async function executeConductLesson(): Promise<void> {
  if (!conductTarget.value) return

  // Solo branch: reuse existing openLesson() — orphaned WBSession via
  // lessonViewApi.loadToSession + redirect to /winterboard/{sessionId}.
  if (conductMode.value === 'solo') {
    const lesson = conductTarget.value
    conductTarget.value = null
    await openLesson(lesson)
    return
  }

  // Classroom branch — student must be picked, lessonsApi.quickStart
  // creates Lesson + WBSession + classroom redirect.
  if (!conductStudentId.value) return
  conductingLessonId.value = conductTarget.value.id

  try {
    // Quick Start: один виклик створює Lesson + WBSession + IN_PROGRESS
    // Використовує TutorStudentRelation замість ClassroomMembership
    const now = new Date()
    const end = new Date(now.getTime() + 60 * 60 * 1000)

    const res = await lessonsApi.quickStart({
      student_id: conductStudentId.value,
      start: now.toISOString(),
      end: end.toISOString(),
      // Передаємо UUID knowledge lesson для копіювання board state
      source_knowledge_lesson_id: conductTarget.value.id,
    } as any)

    const data = (res as any)?.data ?? res
    const lessonId = data?.lesson_id
    const roomUrl = data?.room_url

    // Перехід у дошку
    conductTarget.value = null
    if (roomUrl) {
      router.push(roomUrl)
    } else if (lessonId) {
      router.push(`/winterboard/classroom/${lessonId}`)
    }
  } catch (err: any) {
    console.error('[WBMyLessonsPage] conductLesson failed', err)
    const detail = err?.response?.data?.detail || err?.response?.data?.error || err?.message
    loadError.value = detail || t('winterboard.classroomHub.startError')
  } finally {
    conductingLessonId.value = null
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
