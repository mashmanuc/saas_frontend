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
            to="/winterboard"
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
                <p class="text-xs text-gray-400 mt-1">
                  {{ formatDate(lesson.created_at) }}
                </p>
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
                    class="px-3 py-1.5 border border-gray-300 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-50 transition-colors"
                    :title="$t('knowledge.lesson.share.shareLesson')"
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
                  <router-link
                    :to="{ name: 'LessonView', params: { lessonSlug: lesson.slug } }"
                    class="px-3 py-1.5 border border-gray-300 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-50 transition-colors inline-flex items-center"
                    :title="$t('knowledge.lesson.startReplay')"
                  >
                    👁
                  </router-link>
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
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { lessonSaveApi } from '../api/lessonSaveApi'
import type { MyLesson, MyLessonsParams } from '../api/lessonSaveApi'
import { lessonViewApi } from '../api/lessonViewApi'
import apiClient from '@/utils/apiClient'
import WBLessonFolders from '../components/WBLessonFolders.vue'
import LessonEditDialog from '../components/LessonEditDialog.vue'
import MoveToFolderDropdown from '../components/MoveToFolderDropdown.vue'
import ErrorBoundary from '@/components/ErrorBoundary.vue'

const router = useRouter()
const { t } = useI18n()

const lessons = ref<MyLesson[]>([])
const isLoading = ref(true)
const loadError = ref<string | null>(null)
const loadingLessonId = ref<string | null>(null)
const shareLinkMap = ref<Record<string, string>>({})
const copiedLessonId = ref<string | null>(null)
const togglingId = ref<string | null>(null)

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

// Phase 25: Edit
const showEditDialog = ref(false)
const editTarget = ref<MyLesson | null>(null)

const PAGE_SIZE = 20

onMounted(() => loadLessons())

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
  try {
    const result = await lessonViewApi.generateShareLink(lesson.id)
    shareLinkMap.value[lesson.id] = result.share_url
  } catch (err) {
    console.error('[WBMyLessonsPage] share error:', err)
    loadError.value = t('knowledge.lesson.shareError')
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
    const { session_id } = await lessonViewApi.loadToSession(lesson.id)
    await router.push({ name: 'winterboard-solo', params: { id: session_id } })
  } catch (err) {
    console.error('[WBMyLessonsPage] load lesson error:', err)
    loadError.value = t('knowledge.lesson.reuse.loadError')
  } finally {
    loadingLessonId.value = null
  }
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
