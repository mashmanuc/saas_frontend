<!-- WB: Board list view — grid/list toggle, thumbnail preview, CRUD
     Ref: TASK_BOARD.md B13
     Sub-components: WBBoardCard (grid), WBBoardListItem (list)
     Deploy: Phase 6 responsive -->
<template>
  <div class="wb-board-list">
    <!-- Header -->
    <div class="wb-board-list__header">
      <h1 class="wb-board-list__title">{{ t('winterboard.boards.myBoards') }}</h1>

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

        <!-- New board -->
        <router-link
          :to="{ name: 'winterboard-new' }"
          class="wb-board-list__new-btn"
        >
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
            <path d="M7 1v12M1 7h12" stroke="currentColor" stroke-width="2" stroke-linecap="round" />
          </svg>
          {{ t('winterboard.boards.newBoard') }}
        </router-link>
      </div>
    </div>

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
      <router-link :to="{ name: 'winterboard-new' }" class="wb-board-list__cta-btn">
        {{ t('winterboard.boards.createFirst') }}
      </router-link>
    </div>

    <!-- Grid view -->
    <div v-else-if="viewMode === 'grid'" class="wb-board-list__grid" role="list">
      <WBBoardCard
        v-for="board in boards"
        :key="board.id"
        :board="board"
        role="listitem"
        @open="openBoard(board.id)"
        @duplicate="handleDuplicate(board.id)"
        @share="handleShare(board.id)"
        @delete="confirmDelete(board)"
      />
    </div>

    <!-- List view -->
    <div v-else class="wb-board-list__list" role="list">
      <WBBoardListItem
        v-for="board in boards"
        :key="board.id"
        :board="board"
        role="listitem"
        @open="openBoard(board.id)"
        @duplicate="handleDuplicate(board.id)"
        @share="handleShare(board.id)"
        @delete="confirmDelete(board)"
      />
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
  </div>
</template>

<script setup lang="ts">
import { ref, defineAsyncComponent, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { winterboardApi, type WBSessionListItem } from '../api/winterboardApi'
import { useToast } from '../composables/useToast'
import WBBoardCard from '../components/boards/WBBoardCard.vue'
import WBBoardListItem from '../components/boards/WBBoardListItem.vue'

const WBShareDialog = defineAsyncComponent(() => import('../components/sharing/WBShareDialog.vue'))
const WBExportDialog = defineAsyncComponent(() => import('../components/export/WBExportDialog.vue'))

// ─── Constants ────────────────────────────────────────────────────────────────

const STORAGE_KEY = 'wb_board_view_mode'

// ─── Composables ──────────────────────────────────────────────────────────────

const { t } = useI18n()
const router = useRouter()
const { showToast } = useToast()

// ─── State ────────────────────────────────────────────────────────────────────

const boards = ref<WBSessionListItem[]>([])
const loading = ref(true)
const loadError = ref(false)
const viewMode = ref<'grid' | 'list'>(_loadViewMode())
const deleteTarget = ref<WBSessionListItem | null>(null)
const deleting = ref(false)
const shareSessionId = ref<string | null>(null)
const exportSessionId = ref<string | null>(null)

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

// ─── Fetch ────────────────────────────────────────────────────────────────────

async function fetchBoards(): Promise<void> {
  loading.value = true
  loadError.value = false
  try {
    const res = await winterboardApi.listSessions()
    boards.value = (res.results ?? []).sort(
      (a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime(),
    )
  } catch (err) {
    console.error('[WB:BoardList] Failed to load boards', err)
    loadError.value = true
  } finally {
    loading.value = false
  }
}

// ─── CRUD actions ─────────────────────────────────────────────────────────────

function openBoard(id: string): void {
  const resolved = router.resolve({ name: 'winterboard-solo', params: { id } })
  window.open(resolved.href, '_blank', 'noopener')
}

async function handleDuplicate(id: string): Promise<void> {
  try {
    const dup = await winterboardApi.duplicateSession(id)
    showToast(t('winterboard.boards.duplicated'), 'success')
    const resolved = router.resolve({ name: 'winterboard-solo', params: { id: dup.id } })
    window.open(resolved.href, '_blank', 'noopener')
  } catch (err) {
    console.error('[WB:BoardList] Duplicate failed', err)
    showToast(t('winterboard.boards.duplicateError'), 'error')
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
    showToast(t('winterboard.sessions.deleted'), 'success')
    deleteTarget.value = null
  } catch (err) {
    console.error('[WB:BoardList] Delete failed', err)
    showToast(t('winterboard.sessions.deleteError'), 'error')
  } finally {
    deleting.value = false
  }
}

// ─── Lifecycle ────────────────────────────────────────────────────────────────

onMounted(fetchBoards)
</script>

<style scoped>
.wb-board-list {
  max-width: 1080px;
  margin: 0 auto;
  padding: 32px 24px;
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

.wb-board-list__title {
  font-size: 24px;
  font-weight: 700;
  color: var(--wb-fg, #0f172a);
  margin: 0;
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

/* ── Grid layout ─────────────────────────────────────────────────────── */

.wb-board-list__grid {
  display: grid;
  grid-template-columns: 1fr;
  gap: 20px;
}

@media (min-width: 640px) {
  .wb-board-list__grid {
    grid-template-columns: repeat(2, 1fr);
  }
}

@media (min-width: 960px) {
  .wb-board-list__grid {
    grid-template-columns: repeat(3, 1fr);
  }
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
