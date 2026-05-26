<!-- WB: Студія уроків — Library (board grid/list) + Constructor (placeholder, TBD by parallel agent)
     Ref: LESSON_CONSTRUCTOR_ARCHITECTURE_2026-05-21.md §0, TASK_BOARD.md B13
     Modes: 'library' (current) | 'constructor' (parallel agent builds)
     Sub-components: WBBoardCard (grid), WBBoardListItem (list), BoardFolderTree (sidebar)
     Deploy: Phase 6 responsive -->
<template>
  <div class="wb-board-list" :class="{ 'wb-board-list--with-sidebar': showSidebar && studioMode === 'library' }">
    <!-- Mode switcher: Library | Constructor
         Ref: LESSON_CONSTRUCTOR_ARCHITECTURE_2026-05-21.md §0 — один UX-простір, перемикання вкладками.
         Constructor панель будує паралельний агент; поки placeholder. -->
    <div class="wb-studio-mode-bar">
      <button
        type="button"
        class="wb-studio-mode-bar__btn"
        :class="{ 'wb-studio-mode-bar__btn--active': studioMode === 'library' }"
        :aria-pressed="studioMode === 'library'"
        @click="studioMode = 'library'"
      >
        <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
          <rect x="1" y="2" width="12" height="10" rx="1.5" stroke="currentColor" stroke-width="1.4"/>
          <path d="M4 5h6M4 7.5h4" stroke="currentColor" stroke-width="1.2" stroke-linecap="round"/>
        </svg>
        {{ t('winterboard.boards.modeLibrary') }}
      </button>
      <button
        v-if="lessonConstructorEnabled"
        type="button"
        class="wb-studio-mode-bar__btn"
        :class="{ 'wb-studio-mode-bar__btn--active': studioMode === 'constructor' }"
        :aria-pressed="studioMode === 'constructor'"
        @click="studioMode = 'constructor'"
      >
        <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
          <path d="M7 1.5 L12 4.5 L12 9.5 L7 12.5 L2 9.5 L2 4.5 Z" stroke="currentColor" stroke-width="1.4" fill="none"/>
          <circle cx="7" cy="7" r="1.5" stroke="currentColor" stroke-width="1.2"/>
        </svg>
        {{ t('winterboard.boards.modeConstructor') }}
      </button>
    </div>

    <!-- ── Constructor mode (Lesson Constructor wizard, dev-only via isLessonConstructorEnabled) ── -->
    <LessonConstructorPage
      v-if="studioMode === 'constructor' && lessonConstructorEnabled"
      class="wb-studio-constructor-embedded"
    />

    <!-- ── Library mode (existing board list) ─────────────────────────── -->
    <template v-if="studioMode === 'library'">

    <!-- Sidebar (folders) -->
    <aside v-if="showSidebar" class="wb-board-list__sidebar">
      <BoardFolderTree
        :folders="folderTree"
        :selected-folder-id="selectedFolderId"
        :root-only="rootOnly"
        :loading="foldersLoading"
        @select="selectFolder"
        @select-root="selectRoot"
        @create="handleCreateFolder"
        @rename="handleRenameFolder"
        @delete="handleDeleteFolder"
        @drop="handleDropToFolder"
      />
    </aside>

    <!-- Main content -->
    <div class="wb-board-list__main">
      <!-- Header -->
      <div class="wb-board-list__header">
        <div class="wb-board-list__header-left">
          <!-- Toggle sidebar (mobile) -->
          <button
            type="button"
            class="wb-board-list__sidebar-toggle"
            :title="showSidebar ? 'Сховати папки' : 'Показати папки'"
            @click="showSidebar = !showSidebar"
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <rect x="2" y="4" width="12" height="10" rx="1.5" stroke="currentColor" stroke-width="1.4"/>
              <path d="M4 4V3a1 1 0 011-1h2.5l1.5 2H4z" stroke="currentColor" stroke-width="1.4" fill="none"/>
            </svg>
          </button>
          <div>
            <h1 class="wb-board-list__title">{{ t('winterboard.boards.myBoards') }}</h1>
            <p class="wb-board-list__subtitle">{{ t('winterboard.boards.myBoardsSubtitle') }}</p>
          </div>
        </div>

        <div class="wb-board-list__header-actions">
          <!-- View toggle -->
          <div class="wb-view-toggle" role="group" :aria-label="t('winterboard.boards.viewToggleLabel')">
            <button
              type="button"
              class="wb-view-toggle__btn"
              :class="{ 'wb-view-toggle__btn--active': viewMode === 'grid' }"
              :aria-pressed="viewMode === 'grid'"
              :title="t('winterboard.boards.viewGrid')"
              @click="setViewMode('grid')"
            >
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                <rect x="1" y="1" width="6" height="6" rx="1" stroke="currentColor" stroke-width="1.5" />
                <rect x="9" y="1" width="6" height="6" rx="1" stroke="currentColor" stroke-width="1.5" />
                <rect x="1" y="9" width="6" height="6" rx="1" stroke="currentColor" stroke-width="1.5" />
                <rect x="9" y="9" width="6" height="6" rx="1" stroke="currentColor" stroke-width="1.5" />
              </svg>
            </button>
            <button
              type="button"
              class="wb-view-toggle__btn"
              :class="{ 'wb-view-toggle__btn--active': viewMode === 'list' }"
              :aria-pressed="viewMode === 'list'"
              :title="t('winterboard.boards.viewList')"
              @click="setViewMode('list')"
            >
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                <path d="M5 4h10M5 8h10M5 12h10" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" />
                <circle cx="2" cy="4" r="1" fill="currentColor" />
                <circle cx="2" cy="8" r="1" fill="currentColor" />
                <circle cx="2" cy="12" r="1" fill="currentColor" />
              </svg>
            </button>
          </div>

          <!-- New board.
               Lesson-first: створює draft KnowledgeLesson + prep WBSession,
               веде у конструктор шаблону (constructorMode). Усі дошки
               тепер — шаблони уроків. -->
          <button
            type="button"
            class="wb-board-list__new-btn"
            :disabled="creatingNewBoard"
            @click="createNewTemplate"
          >
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
              <path d="M7 1v12M1 7h12" stroke="currentColor" stroke-width="2" stroke-linecap="round" />
            </svg>
            {{ creatingNewBoard ? t('winterboard.boards.creating') : t('winterboard.boards.newBoard') }}
          </button>
        </div>
      </div>

      <!-- Tabs + Search bar -->
      <div class="wb-board-list__toolbar">
        <div class="wb-board-list__tabs" role="tablist">
          <button
            v-for="tab in tabs"
            :key="tab.value"
            type="button"
            role="tab"
            class="wb-board-list__tab"
            :class="{ 'wb-board-list__tab--active': activeTab === tab.value }"
            :aria-selected="activeTab === tab.value"
            @click="setTab(tab.value)"
          >
            {{ tab.label }}
            <span v-if="tab.value === activeTab && total > 0" class="wb-board-list__tab-count">{{ total }}</span>
          </button>
        </div>

        <input
          v-model="searchQuery"
          type="search"
          class="wb-board-list__search"
          :placeholder="t('winterboard.boards.searchPlaceholder')"
          :aria-label="t('winterboard.boards.searchPlaceholder')"
        />
      </div>

      <!-- Folder breadcrumb -->
      <div v-if="breadcrumbPath.length > 0" class="wb-board-list__breadcrumb">
        <button type="button" class="wb-board-list__breadcrumb-btn" @click="selectFolder(null)">
          {{ t('winterboard.folders.allBoards') }}
        </button>
        <template v-for="crumb in breadcrumbPath" :key="crumb.id">
          <span class="wb-board-list__breadcrumb-sep">/</span>
          <button
            v-if="crumb.id !== selectedFolderId"
            type="button"
            class="wb-board-list__breadcrumb-btn"
            @click="selectFolder(crumb.id)"
          >{{ crumb.name }}</button>
          <span v-else class="wb-board-list__breadcrumb-current">{{ crumb.name }}</span>
        </template>
      </div>
      <div v-else-if="rootOnly" class="wb-board-list__breadcrumb">
        <button type="button" class="wb-board-list__breadcrumb-btn" @click="selectFolder(null)">
          {{ t('winterboard.folders.allBoards') }}
        </button>
        <span class="wb-board-list__breadcrumb-sep">/</span>
        <span class="wb-board-list__breadcrumb-current">{{ t('winterboard.folders.noFolder') }}</span>
      </div>

      <!-- INV-KNOW (Knowledge plan 2026-05-02 PR-5): info-block (onboarding).
           STATIC layer — short bullet list + dismiss button. Persisted у
           localStorage: dismissed once → never shown again. NOT sticky, NOT
           reactive to layout, NOT computed. Pure presentation. -->
      <aside v-if="showInfoBlock" class="wb-board-list__info" role="note">
        <p class="wb-board-list__info-title">{{ t('winterboard.boards.infoTitle') }}</p>
        <ul class="wb-board-list__info-list">
          <li>{{ t('winterboard.boards.infoBullet1') }}</li>
          <li>{{ t('winterboard.boards.infoBullet2') }}</li>
          <li>{{ t('winterboard.boards.infoBullet3') }}</li>
        </ul>
        <button
          type="button"
          class="wb-board-list__info-dismiss"
          :aria-label="t('winterboard.boards.infoDismiss')"
          @click="dismissInfoBlock"
        >
          <span aria-hidden="true">×</span>
          <span class="wb-board-list__info-dismiss-text">{{ t('winterboard.boards.infoDismiss') }}</span>
        </button>
      </aside>

      <!-- Loading: skeleton cards -->
      <div v-if="loading" class="wb-board-list__grid" aria-busy="true">
        <div v-for="i in 6" :key="i" class="wb-board-card wb-board-card--skeleton">
          <div class="wb-board-card__thumb wb-skeleton-pulse" />
          <div class="wb-board-card__body">
            <div class="wb-skeleton-pulse wb-skeleton-line wb-skeleton-line--title" />
            <div class="wb-skeleton-pulse wb-skeleton-line wb-skeleton-line--meta" />
          </div>
        </div>
      </div>

      <!-- Error state -->
      <div v-else-if="loadError" class="wb-board-list__empty" role="alert">
        <svg width="48" height="48" viewBox="0 0 48 48" fill="none" aria-hidden="true">
          <circle cx="24" cy="24" r="22" stroke="#ef4444" stroke-width="2" />
          <path d="M24 14v12M24 30v2" stroke="#ef4444" stroke-width="2" stroke-linecap="round" />
        </svg>
        <p class="wb-board-list__empty-title">{{ t('winterboard.boards.loadError') }}</p>
        <button type="button" class="wb-board-list__cta-btn" @click="fetchBoards">
          {{ t('winterboard.error.retry') }}
        </button>
      </div>

      <!-- Empty state -->
      <div v-else-if="boards.length === 0" class="wb-board-list__empty">
        <svg width="64" height="64" viewBox="0 0 64 64" fill="none" aria-hidden="true">
          <rect x="8" y="12" width="48" height="40" rx="4" stroke="#94a3b8" stroke-width="2" />
          <path d="M20 28h24M20 36h16" stroke="#94a3b8" stroke-width="2" stroke-linecap="round" />
          <circle cx="32" cy="8" r="4" fill="#94a3b8" />
        </svg>
        <p class="wb-board-list__empty-title">{{ t('winterboard.boards.empty') }}</p>
        <p class="wb-board-list__empty-message">{{ t('winterboard.boards.emptyMessage') }}</p>
        <button
          type="button"
          class="wb-board-list__cta-btn"
          :disabled="creatingNewBoard"
          @click="createNewTemplate"
        >
          {{ creatingNewBoard ? t('winterboard.boards.creating') : t('winterboard.boards.createFirst') }}
        </button>
      </div>

      <!-- Grid view -->
      <div v-else-if="viewMode === 'grid'" class="wb-board-list__grid" role="list">
        <WBBoardCard
          v-for="board in boards"
          :key="board.id"
          :board="board"
          :folders="flatFolders"
          role="listitem"
          draggable="true"
          @dragstart="onBoardDragStart($event, board.id)"
          @open="openBoard(board)"
          @duplicate="handleDuplicate(board.id)"
          @share="handleShare(board.id)"
          @delete="confirmDelete(board)"
          @move-to-folder="handleMoveToFolder(board.id, $event)"
        />
      </div>

      <!-- List view -->
      <div v-else class="wb-board-list__list" role="list">
        <WBBoardListItem
          v-for="board in boards"
          :key="board.id"
          :board="board"
          role="listitem"
          draggable="true"
          @dragstart="onBoardDragStart($event, board.id)"
          @open="openBoard(board)"
          @duplicate="handleDuplicate(board.id)"
          @share="handleShare(board.id)"
          @delete="confirmDelete(board)"
        />
      </div>

      <!-- Pagination -->
      <nav
        v-if="total > LIMIT && !loading"
        class="wb-board-list__pagination"
        :aria-label="t('winterboard.boards.pagination')"
      >
        <button
          type="button"
          class="wb-board-list__page-btn"
          :disabled="offset === 0"
          @click="prevPage"
        >
          ← {{ t('winterboard.boards.prevPage') }}
        </button>
        <span class="wb-board-list__page-info">
          {{ currentPage }} / {{ totalPages }}
        </span>
        <button
          type="button"
          class="wb-board-list__page-btn"
          :disabled="offset + LIMIT >= total"
          @click="nextPage"
        >
          {{ t('winterboard.boards.nextPage') }} →
        </button>
      </nav>
    </div>

    <!-- Delete confirmation dialog -->
    <Teleport to="body">
      <Transition name="wb-dialog-fade">
        <div
          v-if="deleteTarget"
          class="wb-dialog-overlay"
          role="dialog"
          aria-modal="true"
          :aria-label="t('winterboard.boards.confirmDelete.title')"
          @click.self="deleteTarget = null"
        >
          <div class="wb-dialog">
            <h2 class="wb-dialog__title">{{ t('winterboard.boards.confirmDelete.title') }}</h2>
            <p class="wb-dialog__message">
              {{ t('winterboard.boards.confirmDelete.message', { name: deleteTarget.name || t('winterboard.boards.untitled') }) }}
            </p>
            <div class="wb-dialog__actions">
              <button type="button" class="wb-dialog__btn wb-dialog__btn--cancel" @click="deleteTarget = null">
                {{ t('winterboard.boards.confirmDelete.cancel') }}
              </button>
              <button
                type="button"
                class="wb-dialog__btn wb-dialog__btn--danger"
                :disabled="deleting"
                @click="handleDelete"
              >
                {{ deleting ? '…' : t('winterboard.boards.confirmDelete.confirm') }}
              </button>
            </div>
          </div>
        </div>
      </Transition>
    </Teleport>

    <!-- Share dialog (lazy loaded) -->
    <WBShareDialog
      v-if="shareSessionId"
      :session-id="shareSessionId"
      :is-open="!!shareSessionId"
      @close="shareSessionId = null"
    />

    <!-- Export dialog (lazy loaded) -->
    <WBExportDialog
      v-if="exportSessionId"
      :session-id="exportSessionId"
      :is-open="!!exportSessionId"
      @close="exportSessionId = null"
    />

    </template><!-- /library mode -->
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, defineAsyncComponent, onMounted, onUnmounted } from 'vue'
import { useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { winterboardApi, type WBSessionListItem, type ListSessionsQuery, type BoardFolderTree as BoardFolderTreeType } from '../api/winterboardApi'
// Toast: використовуємо глобальний notify (PageShell рендерить <ToastContainer>).
// `useToast` з composables — не mounted (legacy), повідомлення туди "в нікуди".
// Міграція стандартна: showToast(msg,'success') → notifySuccess(msg).
import { notifyError, notifySuccess } from '@/utils/notify'
import { isLessonConstructorEnabled } from '../config/featureFlags'
import WBBoardCard from '../components/boards/WBBoardCard.vue'
import WBBoardListItem from '../components/boards/WBBoardListItem.vue'
import BoardFolderTree from '../components/boards/BoardFolderTree.vue'

const WBShareDialog = defineAsyncComponent(() => import('../components/sharing/WBShareDialog.vue'))
const WBExportDialog = defineAsyncComponent(() => import('../components/export/WBExportDialog.vue'))
// Lesson Constructor — dev-only wizard (gated by isLessonConstructorEnabled())
const LessonConstructorPage = defineAsyncComponent(
  () => import('../../lesson_constructor/views/LessonConstructorPage.vue'),
)

// ─── Constants ────────────────────────────────────────────────────────────────

const STORAGE_KEY = 'wb_board_view_mode'
const STUDIO_MODE_KEY = 'wb_studio_mode'
const LIMIT = 24

// ─── Feature flags ────────────────────────────────────────────────────────────
// Оцінюється один раз при монтуванні (env + localStorage статичні).
const lessonConstructorEnabled = isLessonConstructorEnabled()

// ─── Composables ──────────────────────────────────────────────────────────────

const { t } = useI18n()
const router = useRouter()

// ─── Studio mode: Library | Constructor ──────────────────────────────────────
// Ref: LESSON_CONSTRUCTOR_ARCHITECTURE_2026-05-21.md §0 — один простір, дві вкладки.
// Constructor — placeholder; реальна панель будується паралельним агентом.

type StudioMode = 'library' | 'constructor'

function _loadStudioMode(): StudioMode {
  // Якщо конструктор вимкнено (prod) — завжди 'library',
  // щоб застарілий localStorage не ставив порожню вкладку.
  if (!isLessonConstructorEnabled()) return 'library'
  try {
    const saved = localStorage.getItem(STUDIO_MODE_KEY)
    if (saved === 'library' || saved === 'constructor') return saved
  } catch {
    // localStorage unavailable
  }
  return 'library'
}

const studioMode = ref<StudioMode>(_loadStudioMode())

watch(studioMode, (m) => {
  try {
    localStorage.setItem(STUDIO_MODE_KEY, m)
  } catch {
    // ignore
  }
})

// ─── Tabs ────────────────────────────────────────────────────────────────────

type TabValue = 'all' | 'lesson' | 'standalone'

const tabs = computed(() => [
  { value: 'all' as TabValue, label: t('winterboard.boards.tabAll') },
  { value: 'lesson' as TabValue, label: t('winterboard.boards.tabLessons') },
  { value: 'standalone' as TabValue, label: t('winterboard.boards.tabStandalone') },
])

// ─── State ────────────────────────────────────────────────────────────────────

const boards = ref<WBSessionListItem[]>([])
const total = ref(0)
const loading = ref(true)
const loadError = ref(false)
const viewMode = ref<'grid' | 'list'>(_loadViewMode())
const activeTab = ref<TabValue>('all')
const searchQuery = ref('')
const offset = ref(0)
const deleteTarget = ref<WBSessionListItem | null>(null)
const deleting = ref(false)
const shareSessionId = ref<string | null>(null)
const exportSessionId = ref<string | null>(null)

// ─── Folder state ─────────────────────────────────────────────────────────────

const showSidebar = ref(true)
const folderTree = ref<BoardFolderTreeType[]>([])
const foldersLoading = ref(true)
const selectedFolderId = ref<number | null>(null)
const rootOnly = ref(false)

// ─── PR-5: info-block (onboarding) ────────────────────────────────────────────
// STATIC state — initialized once from localStorage, no watchers.
// Dismiss persists per-browser; cleared by clearing site data.
const INFO_BLOCK_DISMISSED_KEY = 'wb.boards.infoDismissed'
function readInfoBlockDismissed(): boolean {
  try {
    return window.localStorage.getItem(INFO_BLOCK_DISMISSED_KEY) === '1'
  } catch {
    return false  // SSR / disabled storage → show by default
  }
}
const showInfoBlock = ref(!readInfoBlockDismissed())
function dismissInfoBlock(): void {
  try {
    window.localStorage.setItem(INFO_BLOCK_DISMISSED_KEY, '1')
  } catch {
    // localStorage unavailable — accept transient dismiss only.
  }
  showInfoBlock.value = false
}

/** Lesson-first "+ Нова дошка": створює draft KnowledgeLesson + prep
 *  WBSession і веде в конструктор. Замість попереднього router-link на
 *  /winterboard/new (scratch соло). Race-guard `creatingNewBoard`. */
const creatingNewBoard = ref(false)
async function createNewTemplate() {
  if (creatingNewBoard.value) return
  creatingNewBoard.value = true
  try {
    const { lessonViewApi } = await import('@/modules/knowledge/api/lessonViewApi')
    const { wb_session_id } = await lessonViewApi.createDraftWithPrep()
    await router.push({ name: 'winterboard-prepare', params: { id: wb_session_id } })
  } catch (err) {
    console.error('[WBBoardList] createNewTemplate failed:', err)
    notifyError(t('winterboard.boards.createError'))
  } finally {
    creatingNewBoard.value = false
  }
}

/** Build breadcrumb path: [root, ..., current] */
const breadcrumbPath = computed(() => {
  if (selectedFolderId.value === null) return []
  const path: { id: number; name: string }[] = []
  function find(nodes: BoardFolderTreeType[], id: number): boolean {
    for (const node of nodes) {
      if (node.id === id) {
        path.push({ id: node.id, name: node.name })
        return true
      }
      if (node.children?.length && find(node.children, id)) {
        path.unshift({ id: node.id, name: node.name })
        return true
      }
    }
    return false
  }
  find(folderTree.value, selectedFolderId.value)
  return path
})

/** Flat list of folders for "Move to folder" menu in cards */
const flatFolders = computed(() => {
  const result: { id: number; name: string; depth: number }[] = []
  function flatten(nodes: BoardFolderTreeType[], depth = 0) {
    for (const node of nodes) {
      result.push({ id: node.id, name: node.name, depth })
      if (node.children?.length) flatten(node.children, depth + 1)
    }
  }
  flatten(folderTree.value)
  return result
})

// ─── Pagination computed ──────────────────────────────────────────────────────

const currentPage = computed(() => Math.floor(offset.value / LIMIT) + 1)
const totalPages = computed(() => Math.ceil(total.value / LIMIT))

function prevPage(): void {
  offset.value = Math.max(0, offset.value - LIMIT)
}

function nextPage(): void {
  offset.value += LIMIT
}

// ─── localStorage persistence ─────────────────────────────────────────────────

function _loadViewMode(): 'grid' | 'list' {
  try {
    const saved = localStorage.getItem(STORAGE_KEY)
    if (saved === 'grid' || saved === 'list') return saved
  } catch {
    // localStorage unavailable (SSR, private mode)
  }
  return 'grid'
}

function setViewMode(mode: 'grid' | 'list'): void {
  viewMode.value = mode
  try {
    localStorage.setItem(STORAGE_KEY, mode)
  } catch {
    // ignore write failures
  }
}

// ─── Tab switch ──────────────────────────────────────────────────────────────

function setTab(tab: TabValue): void {
  activeTab.value = tab
  offset.value = 0
}

// ─── Folder actions ─────────────────────────────────────────────────────────

function selectFolder(folderId: number | null): void {
  selectedFolderId.value = folderId
  rootOnly.value = false
  offset.value = 0
}

function selectRoot(): void {
  selectedFolderId.value = null
  rootOnly.value = true
  offset.value = 0
}

async function fetchFolders(): Promise<void> {
  foldersLoading.value = true
  try {
    folderTree.value = await winterboardApi.listBoardFolders()
  } catch (err) {
    console.error('[WB:BoardList] Failed to load folders', err)
  } finally {
    foldersLoading.value = false
  }
}

async function handleCreateFolder(name: string, parentId: number | null): Promise<void> {
  try {
    await winterboardApi.createBoardFolder({ name, parent: parentId })
    await fetchFolders()
    notifySuccess(t('winterboard.folders.created'))
  } catch (err: any) {
    if (err?.response?.status === 409) {
      notifyError(t('winterboard.folders.duplicateName'))
    } else {
      notifyError(t('winterboard.folders.createError'))
    }
  }
}

async function handleRenameFolder(folderId: number, name: string): Promise<void> {
  try {
    await winterboardApi.updateBoardFolder(folderId, { name })
    await fetchFolders()
  } catch (err: any) {
    if (err?.response?.status === 409) {
      notifyError(t('winterboard.folders.duplicateName'))
    } else {
      notifyError(t('winterboard.folders.renameError'))
    }
  }
}

async function handleDeleteFolder(folderId: number): Promise<void> {
  try {
    await winterboardApi.deleteBoardFolder(folderId)
    if (selectedFolderId.value === folderId) {
      selectedFolderId.value = null
      rootOnly.value = false
    }
    await fetchFolders()
    await fetchBoards()
    notifySuccess(t('winterboard.folders.deleted'))
  } catch {
    notifyError(t('winterboard.folders.deleteError'))
  }
}

async function handleMoveToFolder(sessionId: string, folderId: number | null): Promise<void> {
  try {
    await winterboardApi.moveSessionToFolder(sessionId, folderId)
    await fetchFolders()
    await fetchBoards()
    notifySuccess(t('winterboard.folders.moved'))
  } catch {
    notifyError(t('winterboard.folders.moveError'))
  }
}

async function handleDropToFolder(folderId: number, sessionId: string): Promise<void> {
  await handleMoveToFolder(sessionId, folderId)
}

function onBoardDragStart(event: DragEvent, sessionId: string): void {
  event.dataTransfer?.setData('text/wb-session-id', sessionId)
}

// ─── Fetch with AbortController ──────────────────────────────────────────────

let fetchAbort: AbortController | null = null

async function fetchBoards(): Promise<void> {
  // Cancel previous in-flight request
  fetchAbort?.abort()
  fetchAbort = new AbortController()

  loading.value = true
  loadError.value = false

  const query: ListSessionsQuery = {
    limit: LIMIT,
    offset: offset.value,
  }
  if (activeTab.value !== 'all') {
    query.category = activeTab.value
  }
  if (searchQuery.value.trim()) {
    query.search = searchQuery.value.trim()
  }
  // Folder filter
  if (rootOnly.value) {
    query.folder = 'root'
  } else if (selectedFolderId.value !== null) {
    query.folder = selectedFolderId.value
  }

  try {
    const res = await winterboardApi.listSessions(query)
    boards.value = res.results ?? []
    total.value = res.count ?? 0
  } catch (err: any) {
    // Ignore aborted requests
    if (err?.name === 'CanceledError' || err?.code === 'ERR_CANCELED') return
    console.error('[WB:BoardList] Failed to load boards', err)
    loadError.value = true
  } finally {
    loading.value = false
  }
}

onUnmounted(() => fetchAbort?.abort())

// ─── Watchers: refetch on tab/search/offset/folder change ────────────────────

watch(offset, fetchBoards)
watch(activeTab, fetchBoards)
watch(selectedFolderId, fetchBoards)
watch(rootOnly, fetchBoards)

// Search with debounce
let searchTimer: ReturnType<typeof setTimeout> | null = null
watch(searchQuery, () => {
  if (searchTimer) clearTimeout(searchTimer)
  searchTimer = setTimeout(() => {
    offset.value = 0
    fetchBoards()
  }, 300)
})

// ─── CRUD actions ─────────────────────────────────────────────────────────────

// Студія уроків: всі дошки відкриваються через WBConstructorRoom (редактор).
function openBoard(board: WBSessionListItem): void {
  router.push({ name: 'winterboard-prepare', params: { id: board.id } })
}

async function handleDuplicate(id: string): Promise<void> {
  try {
    const dup = await winterboardApi.duplicateSession(id)
    notifySuccess(t('winterboard.boards.duplicated'))
    // Додаємо копію в список без навігації — юзер відкриє сам коли захоче
    await fetchBoards()
  } catch (err) {
    console.error('[WB:BoardList] Duplicate failed', err)
    notifyError(t('winterboard.boards.duplicateError'))
  }
}

function handleShare(id: string): void {
  shareSessionId.value = id
}

function handleExport(id: string): void {
  exportSessionId.value = id
}

function confirmDelete(board: WBSessionListItem): void {
  deleteTarget.value = board
}

async function handleDelete(): Promise<void> {
  if (!deleteTarget.value) return
  deleting.value = true
  try {
    await winterboardApi.deleteSession(deleteTarget.value.id)
    boards.value = boards.value.filter((b) => b.id !== deleteTarget.value!.id)
    total.value = Math.max(0, total.value - 1)
    notifySuccess(t('winterboard.sessions.deleted'))
    deleteTarget.value = null
    // Refresh folder counts
    fetchFolders()
  } catch (err) {
    console.error('[WB:BoardList] Delete failed', err)
    // Backend для 409 віддає {error, detail, active_replays, trashed_replays}.
    // `detail` вже локалізований на UA — показуємо його, інакше fallback.
    // Типовий сценарій: session має Replay → видалення PROTECT-нуто (R3).
    const anyErr = err as { response?: { data?: { detail?: string } } }
    const backendDetail = anyErr?.response?.data?.detail
    notifyError(backendDetail || t('winterboard.sessions.deleteError'))
  } finally {
    deleting.value = false
  }
}

// ─── Lifecycle ────────────────────────────────────────────────────────────────

onMounted(() => {
  fetchBoards()
  fetchFolders()
})
</script>

<style scoped>
.wb-board-list {
  max-width: 1280px;
  margin: 0 auto;
  padding: 32px 24px;
}

.wb-board-list--with-sidebar {
  display: grid;
  grid-template-columns: 220px 1fr;
  gap: 24px;
  grid-template-rows: auto;
}

.wb-board-list__sidebar {
  border-right: 1px solid var(--wb-toolbar-border, #e2e8f0);
  padding-right: 16px;
  min-height: 400px;
}

.wb-board-list__main {
  min-width: 0;
}

/* ── Studio mode bar ─────────────────────────────────────────────────── */

.wb-studio-mode-bar {
  display: flex;
  gap: 4px;
  background: var(--wb-canvas-bg, #f1f5f9);
  border: 1px solid var(--wb-toolbar-border, #e2e8f0);
  border-radius: 10px;
  padding: 3px;
  width: fit-content;
  margin-bottom: 24px;
  /* span full grid width коли немає sidebar */
  grid-column: 1 / -1;
}

.wb-studio-mode-bar__btn {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 8px 18px;
  border: none;
  border-radius: 7px;
  font-size: 13px;
  font-weight: 500;
  color: var(--wb-fg-secondary, #64748b);
  background: none;
  cursor: pointer;
  transition: background 0.12s, color 0.12s, box-shadow 0.12s;
  white-space: nowrap;
}

.wb-studio-mode-bar__btn:hover {
  color: var(--wb-fg, #0f172a);
}

.wb-studio-mode-bar__btn--active {
  background: var(--wb-card-bg, #ffffff);
  color: var(--wb-fg, #0f172a);
  font-weight: 600;
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.1);
}

/* ── Constructor embedded panel ──────────────────────────────────────── */

.wb-studio-constructor-embedded {
  /* Span full grid width in sidebar-grid layout (lib mode only, no-op in constructor mode) */
  grid-column: 1 / -1;
}

/* ── Constructor placeholder (legacy — залишено для безпечного fallback) */

.wb-studio-constructor {
  grid-column: 1 / -1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 80px 24px;
  border: 2px dashed var(--wb-toolbar-border, #e2e8f0);
  border-radius: 16px;
  text-align: center;
  gap: 12px;
}

.wb-studio-constructor__icon {
  margin-bottom: 4px;
}

.wb-studio-constructor__title {
  font-size: 20px;
  font-weight: 700;
  color: var(--wb-fg, #0f172a);
  margin: 0;
}

.wb-studio-constructor__desc {
  font-size: 14px;
  color: var(--wb-fg-secondary, #64748b);
  max-width: 440px;
  line-height: 1.55;
  margin: 0;
}

.wb-studio-constructor__badge {
  display: inline-block;
  padding: 4px 12px;
  background: var(--wb-brand, #0066ff);
  color: #ffffff;
  border-radius: 20px;
  font-size: 12px;
  font-weight: 600;
  letter-spacing: 0.02em;
  margin-top: 4px;
}

/* ── Header ──────────────────────────────────────────────────────────── */

.wb-board-list__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 28px;
  gap: 12px;
  flex-wrap: wrap;
}

.wb-board-list__header-left {
  display: flex;
  align-items: center;
  gap: 8px;
}

.wb-board-list__sidebar-toggle {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  border: 1px solid var(--wb-toolbar-border, #e2e8f0);
  border-radius: 6px;
  background: var(--wb-card-bg, #ffffff);
  cursor: pointer;
  color: var(--wb-fg-secondary, #64748b);
  transition: background 0.1s;
}

.wb-board-list__sidebar-toggle:hover {
  background: var(--wb-canvas-bg, #f1f5f9);
  color: var(--wb-fg, #0f172a);
}

.wb-board-list__title {
  font-size: 24px;
  font-weight: 700;
  color: var(--wb-fg, #0f172a);
  margin: 0;
}

.wb-board-list__subtitle {
  font-size: 13px;
  color: var(--wb-fg-secondary, #94a3b8);
  margin: 2px 0 0;
}

.wb-board-list__header-actions {
  display: flex;
  align-items: center;
  gap: 10px;
}

/* ── View toggle ─────────────────────────────────────────────────────── */

.wb-view-toggle {
  display: flex;
  align-items: center;
  gap: 2px;
  background: var(--wb-canvas-bg, #f1f5f9);
  border: 1px solid var(--wb-toolbar-border, #e2e8f0);
  border-radius: 8px;
  padding: 2px;
}

.wb-view-toggle__btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 30px;
  height: 30px;
  background: none;
  border: none;
  border-radius: 6px;
  cursor: pointer;
  color: var(--wb-fg-secondary, #64748b);
  transition: background 0.1s, color 0.1s;
}

.wb-view-toggle__btn--active {
  background: var(--wb-card-bg, #ffffff);
  color: var(--wb-fg, #0f172a);
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.08);
}

.wb-view-toggle__btn:not(.wb-view-toggle__btn--active):hover {
  color: var(--wb-fg, #0f172a);
}

/* ── New board button ────────────────────────────────────────────────── */

.wb-board-list__new-btn {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 9px 18px;
  background: var(--wb-brand, #0066ff);
  color: #ffffff;
  border: none;
  border-radius: 8px;
  font-size: 14px;
  font-weight: 600;
  text-decoration: none;
  cursor: pointer;
  transition: background 0.15s;
  min-height: 40px;
}

.wb-board-list__new-btn:hover {
  background: var(--wb-brand-hover, #0052cc);
}

/* ── Toolbar (tabs + search) ─────────────────────────────────────────── */

.wb-board-list__toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 20px;
  flex-wrap: wrap;
}

.wb-board-list__tabs {
  display: flex;
  gap: 4px;
  background: var(--wb-canvas-bg, #f1f5f9);
  border-radius: 8px;
  padding: 3px;
}

.wb-board-list__tab {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 7px 16px;
  border: none;
  border-radius: 6px;
  font-size: 13px;
  font-weight: 500;
  color: var(--wb-fg-secondary, #64748b);
  background: none;
  cursor: pointer;
  transition: background 0.1s, color 0.1s;
  white-space: nowrap;
}

.wb-board-list__tab:hover {
  color: var(--wb-fg, #0f172a);
}

.wb-board-list__tab--active {
  background: var(--wb-card-bg, #ffffff);
  color: var(--wb-fg, #0f172a);
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.08);
  font-weight: 600;
}

.wb-board-list__tab-count {
  font-size: 11px;
  background: var(--wb-brand, #0066ff);
  color: #ffffff;
  border-radius: 10px;
  padding: 1px 7px;
  min-width: 18px;
  text-align: center;
}

.wb-board-list__search {
  padding: 8px 14px;
  border: 1px solid var(--wb-toolbar-border, #e2e8f0);
  border-radius: 8px;
  font-size: 13px;
  color: var(--wb-fg, #0f172a);
  background: var(--wb-card-bg, #ffffff);
  outline: none;
  min-width: 200px;
  transition: border-color 0.15s;
}

.wb-board-list__search:focus {
  border-color: var(--wb-brand, #0066ff);
  box-shadow: 0 0 0 2px rgba(0, 102, 255, 0.15);
}

.wb-board-list__search::placeholder {
  color: var(--wb-fg-secondary, #94a3b8);
}

/* ── Breadcrumb ──────────────────────────────────────────────────────── */

.wb-board-list__breadcrumb {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-bottom: 16px;
  font-size: 13px;
  color: var(--wb-fg-secondary, #64748b);
}

.wb-board-list__breadcrumb-btn {
  background: none;
  border: none;
  color: var(--wb-brand, #0066ff);
  cursor: pointer;
  font-size: 13px;
  padding: 0;
}

.wb-board-list__breadcrumb-btn:hover {
  text-decoration: underline;
}

.wb-board-list__breadcrumb-sep {
  color: var(--wb-fg-secondary, #94a3b8);
}

.wb-board-list__breadcrumb-current {
  color: var(--wb-fg, #0f172a);
  font-weight: 600;
}

/* ── PR-5: Info-block (onboarding) ──────────────────────────────────── */
/* STATIC layer. NOT sticky. Bounded width per recommended #6 to avoid
 * inflating sidebar / wide screens. Bullets line-clamp implicitly via
 * max-width + word-break. */
.wb-board-list__info {
  position: relative;
  max-width: 480px;
  margin: 0 0 20px;
  padding: 14px 18px;
  background: var(--wb-canvas-bg, #f8fafc);
  border: 1px solid var(--wb-toolbar-border, #e2e8f0);
  border-radius: 10px;
  font-size: 13px;
  line-height: 1.45;
  color: var(--wb-fg-secondary, #475569);
}

.wb-board-list__info-title {
  margin: 0 0 6px;
  font-weight: 600;
  color: var(--wb-fg, #0f172a);
}

.wb-board-list__info-list {
  margin: 0;
  padding-left: 18px;
  list-style: disc;
}

.wb-board-list__info-list li {
  margin: 2px 0;
  /* line-clamp safety on tiny widths (i18n very-long translations) */
  overflow: hidden;
  text-overflow: ellipsis;
}

.wb-board-list__info-dismiss {
  position: absolute;
  top: 6px;
  right: 8px;
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 4px 8px;
  background: none;
  border: 1px solid transparent;
  border-radius: 6px;
  color: var(--wb-fg-secondary, #94a3b8);
  font-size: 12px;
  cursor: pointer;
  transition: background 0.1s, color 0.1s, border-color 0.1s;
}

.wb-board-list__info-dismiss:hover,
.wb-board-list__info-dismiss:focus-visible {
  background: var(--wb-card-bg, #ffffff);
  border-color: var(--wb-toolbar-border, #e2e8f0);
  color: var(--wb-fg, #0f172a);
}

.wb-board-list__info-dismiss-text {
  /* Hide label on narrow screens; native [×] enough */
}

@media (max-width: 480px) {
  .wb-board-list__info-dismiss-text {
    display: none;
  }
}

/* ── Pagination ─────────────────────────────────────────────────────── */

.wb-board-list__pagination {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 16px;
  margin-top: 32px;
  padding: 16px 0;
}

.wb-board-list__page-btn {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 8px 16px;
  border: 1px solid var(--wb-toolbar-border, #e2e8f0);
  border-radius: 8px;
  background: var(--wb-card-bg, #ffffff);
  color: var(--wb-fg, #0f172a);
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  transition: background 0.1s, border-color 0.1s;
}

.wb-board-list__page-btn:hover:not(:disabled) {
  border-color: var(--wb-brand, #0066ff);
  background: var(--wb-canvas-bg, #f1f5f9);
}

.wb-board-list__page-btn:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

.wb-board-list__page-info {
  font-size: 13px;
  color: var(--wb-fg-secondary, #64748b);
  font-weight: 500;
}

/* ── Grid layout ─────────────────────────────────────────────────────── */

.wb-board-list__grid {
  /* Phase WB-Responsive-11: auto-fill з мінімальною шириною картки.
     Однією формулою replaces 3-step responsive ladder (1→2→3 col cap).
     Тепер: 1 col на mobile, 2 на ~580+, 3 на ~860+, 4 на ~1140+,
     5 на ~1420+, 6 на ~1700+ — використовує доступну ширину повністю.
     Refs: WB_RESPONSIVE_GRID_GAP_2026-05-02.md, INV-WB-3 (one render path). */
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(var(--wb-card-min, 280px), 1fr));
  gap: 20px;
}

/* ── List layout ─────────────────────────────────────────────────────── */

.wb-board-list__list {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

/* ── Empty / Error state ─────────────────────────────────────────────── */

.wb-board-list__empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 80px 24px;
  border: 2px dashed var(--wb-toolbar-border, #e2e8f0);
  border-radius: 12px;
  text-align: center;
}

.wb-board-list__empty-title {
  font-size: 18px;
  font-weight: 600;
  color: var(--wb-fg, #0f172a);
  margin: 16px 0 8px;
}

.wb-board-list__empty-message {
  font-size: 14px;
  color: var(--wb-fg-secondary, #94a3b8);
  margin: 0 0 24px;
}

.wb-board-list__cta-btn {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 10px 24px;
  background: var(--wb-brand, #0066ff);
  color: #ffffff;
  border: none;
  border-radius: 8px;
  font-size: 14px;
  font-weight: 600;
  text-decoration: none;
  cursor: pointer;
  transition: background 0.15s;
  min-height: 44px;
}

.wb-board-list__cta-btn:hover {
  background: var(--wb-brand-hover, #0052cc);
}

/* ── Skeleton ────────────────────────────────────────────────────────── */

.wb-board-card--skeleton {
  cursor: default;
  pointer-events: none;
}

.wb-skeleton-pulse {
  background: linear-gradient(
    90deg,
    var(--wb-toolbar-border, #e2e8f0) 25%,
    var(--wb-canvas-bg, #f1f5f9) 50%,
    var(--wb-toolbar-border, #e2e8f0) 75%
  );
  background-size: 200% 100%;
  animation: wb-skeleton-shimmer 1.5s ease-in-out infinite;
  border-radius: 4px;
}

.wb-skeleton-line {
  height: 14px;
  margin-bottom: 8px;
}

.wb-skeleton-line--title {
  width: 70%;
}

.wb-skeleton-line--meta {
  width: 40%;
  height: 12px;
}

@keyframes wb-skeleton-shimmer {
  0% { background-position: 200% 0; }
  100% { background-position: -200% 0; }
}

/* ── Delete dialog ───────────────────────────────────────────────────── */

.wb-dialog-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.4);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}

.wb-dialog {
  background: var(--wb-card-bg, #ffffff);
  border-radius: 12px;
  padding: 24px;
  max-width: 420px;
  width: 90%;
  box-shadow: 0 16px 48px rgba(0, 0, 0, 0.16);
}

.wb-dialog__title {
  font-size: 18px;
  font-weight: 700;
  color: var(--wb-fg, #0f172a);
  margin: 0 0 8px;
}

.wb-dialog__message {
  font-size: 14px;
  color: var(--wb-fg-secondary, #64748b);
  margin: 0 0 20px;
  line-height: 1.5;
}

.wb-dialog__actions {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
}

.wb-dialog__btn {
  padding: 8px 16px;
  border-radius: 6px;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  border: none;
  transition: background 0.15s;
  min-height: 36px;
}

.wb-dialog__btn--cancel {
  background: var(--wb-canvas-bg, #f1f5f9);
  color: var(--wb-fg, #0f172a);
}

.wb-dialog__btn--cancel:hover {
  background: var(--wb-toolbar-border, #e2e8f0);
}

.wb-dialog__btn--danger {
  background: #ef4444;
  color: #ffffff;
}

.wb-dialog__btn--danger:hover {
  background: #dc2626;
}

.wb-dialog__btn--danger:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.wb-dialog-fade-enter-active,
.wb-dialog-fade-leave-active {
  transition: opacity 0.2s ease;
}

.wb-dialog-fade-enter-from,
.wb-dialog-fade-leave-to {
  opacity: 0;
}

/* ── Mobile responsive ───────────────────────────────────────────────── */

@media (max-width: 768px) {
  .wb-board-list {
    padding: 16px 12px;
  }

  .wb-board-list--with-sidebar {
    grid-template-columns: 1fr;
  }

  .wb-board-list__sidebar {
    display: none;
  }

  .wb-board-list__title {
    font-size: 20px;
  }

  .wb-board-list__new-btn {
    padding: 8px 14px;
    font-size: 13px;
  }

  .wb-dialog-overlay {
    align-items: flex-end;
  }

  .wb-dialog {
    width: 100%;
    max-width: 100%;
    border-radius: 16px 16px 0 0;
    padding: 20px 16px calc(env(safe-area-inset-bottom, 0px) + 16px);
  }

  .wb-dialog__actions {
    flex-direction: column-reverse;
    gap: 8px;
  }

  .wb-dialog__btn {
    min-height: 44px;
    padding: 10px 20px;
  }

  .wb-board-list__empty {
    padding: 40px 16px;
  }
}

/* ── Reduced motion ──────────────────────────────────────────────────── */

@media (prefers-reduced-motion: reduce) {
  .wb-board-list__new-btn,
  .wb-board-list__cta-btn,
  .wb-view-toggle__btn,
  .wb-dialog__btn {
    transition: none;
  }

  .wb-skeleton-pulse {
    animation: none;
  }

  .wb-dialog-fade-enter-active,
  .wb-dialog-fade-leave-active {
    transition: none;
  }
}
</style>
