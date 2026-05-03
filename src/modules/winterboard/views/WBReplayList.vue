<template>
  <div class="replay-list">
    <header class="replay-list__header">
      <div>
        <h1 class="replay-list__title">{{ t('winterboard.replayList.title') }}</h1>
        <p class="replay-list__subtitle">
          {{ t('winterboard.replayList.subtitle') }}
        </p>
      </div>
      <span v-if="!store.isLoading && store.replays.length > 0" class="replay-list__count">
        {{ store.replays.length }}
      </span>
    </header>

    <div class="replay-list__body">
      <!-- ─── Sidebar: ReplayFolderTree ─────────────────────────────────── -->
      <aside class="replay-list__sidebar" aria-label="Replay folders">
        <ReplayFolderTree
          :folders="store.folders"
          :selected-id="selectedFolderKey"
          :loading="store.isLoading"
          :editable="true"
          @select="onFolderSelect"
          @create="onFolderCreate"
          @rename="onFolderRename"
          @delete="onFolderDelete"
          @drop="onFolderDrop"
        />
      </aside>

      <!-- ─── Main content ─────────────────────────────────────────────── -->
      <section class="replay-list__main">
        <ReplayBreadcrumb
          v-if="breadcrumbItems.length > 1"
          :items="breadcrumbItems"
          @navigate="onBreadcrumbNavigate"
        />

        <!-- Status tabs + view toggle -->
        <div class="replay-list__toolbar">
          <nav class="replay-list__tabs" role="tablist">
            <button
              v-for="tab in statusTabs"
              :key="tab.value"
              type="button"
              role="tab"
              :aria-selected="store.currentStatus === tab.value"
              class="replay-list__tab"
              :class="{
                'replay-list__tab--active': store.currentStatus === tab.value,
                'replay-list__tab--drop-hover': dropHoverTab === tab.value,
              }"
              @click="store.setStatus(tab.value)"
              @dragover.prevent="onTabDragOver(tab.value, $event)"
              @dragleave="onTabDragLeave(tab.value)"
              @drop.prevent="onTabDrop(tab.value, $event)"
            >
              {{ tab.label }}
            </button>
          </nav>

          <div
            class="replay-list__view-toggle"
            role="group"
            :aria-label="t('winterboard.replayList.viewMode.label')"
          >
            <button
              type="button"
              class="replay-list__view-btn"
              :class="{ 'replay-list__view-btn--active': viewMode === 'grid' }"
              :aria-pressed="viewMode === 'grid'"
              :title="t('winterboard.replayList.viewMode.grid')"
              @click="setViewMode('grid')"
            >
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                <rect x="1.5" y="1.5" width="5" height="5" rx="1" stroke="currentColor" stroke-width="1.5" />
                <rect x="9.5" y="1.5" width="5" height="5" rx="1" stroke="currentColor" stroke-width="1.5" />
                <rect x="1.5" y="9.5" width="5" height="5" rx="1" stroke="currentColor" stroke-width="1.5" />
                <rect x="9.5" y="9.5" width="5" height="5" rx="1" stroke="currentColor" stroke-width="1.5" />
              </svg>
              <span class="sr-only">{{ t('winterboard.replayList.viewMode.grid') }}</span>
            </button>
            <button
              type="button"
              class="replay-list__view-btn"
              :class="{ 'replay-list__view-btn--active': viewMode === 'list' }"
              :aria-pressed="viewMode === 'list'"
              :title="t('winterboard.replayList.viewMode.list')"
              @click="setViewMode('list')"
            >
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                <line x1="2" y1="4" x2="14" y2="4" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" />
                <line x1="2" y1="8" x2="14" y2="8" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" />
                <line x1="2" y1="12" x2="14" y2="12" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" />
              </svg>
              <span class="sr-only">{{ t('winterboard.replayList.viewMode.list') }}</span>
            </button>
          </div>
        </div>

        <!-- Error -->
        <div v-if="store.error" class="replay-list__error" role="alert">
          {{ store.error }}
        </div>

        <!-- Loading -->
        <div v-if="store.isLoading" :class="containerClass">
          <div v-for="i in 6" :key="i" class="replay-card replay-card--skeleton" />
        </div>

        <!-- Empty -->
        <div v-else-if="store.replays.length === 0" class="replay-list__empty">
          <div class="replay-list__empty-icon">{{ emptyIcon }}</div>
          <h2 class="replay-list__empty-title">
            {{ emptyTitle }}
          </h2>
          <p class="replay-list__empty-subtitle">
            {{ emptySubtitle }}
          </p>
        </div>

        <!-- Grid / List -->
        <div v-else :class="containerClass">
          <ReplayCard
            v-for="replay in store.replays"
            :key="replay.id"
            :replay="replay"
            :view-mode="viewMode"
            :menu-open="openMenuId === replay.id"
            :copied="copiedId === replay.id"
            @open="handleOpen"
            @share="handleShare"
            @rename="handleRename"
            @visibility="handleVisibility"
            @archive="handleArchive"
            @restore="handleRestore"
            @trash="handleTrash"
            @move="handleMoveOpen"
            @toggle-menu="toggleMenu"
            @close-menu="openMenuId = null"
          />
        </div>
      </section>
    </div>

    <!-- Move dropdown overlay (single global instance) -->
    <MoveReplayDropdown
      v-if="movingReplay"
      :key="movingReplay.id"
      :replay-id="movingReplay.id"
      :current-folder="movingReplay.folder"
      :folders="store.folders"
      :anchor-rect="moveAnchorRect"
      @moved="handleMoveCommit"
      @close="cancelMove"
    />

    <!-- Confirm dialog (trash, folder-delete) — замінює window.confirm -->
    <ConfirmModal
      v-if="confirmState"
      :open="true"
      :title="confirmState.title"
      :message="confirmState.message"
      :confirm-text="confirmState.confirmText"
      :variant="confirmState.variant"
      :loading="confirmLoading"
      @confirm="resolveConfirm(true)"
      @cancel="resolveConfirm(false)"
    />

    <!-- Rename dialog — замінює window.prompt -->
    <Modal
      :open="renameState !== null"
      :title="t('winterboard.replayList.prompts.renameTitle')"
      size="sm"
      @close="resolveRename(null)"
    >
      <Input
        v-if="renameState"
        ref="renameInputRef"
        v-model="renameState.value"
        type="text"
        maxlength="255"
        @keydown.enter="onRenameAccept"
      />
      <template #footer>
        <Button variant="outline" @click="resolveRename(null)">
          {{ t('common.cancel') }}
        </Button>
        <Button variant="primary" @click="onRenameAccept">
          {{ t('common.save') }}
        </Button>
      </template>
    </Modal>
  </div>
</template>

<script setup lang="ts">
import { computed, nextTick, onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useReplayStore } from '../stores/replayStore'
import type { Replay, ReplayStatus, ReplayVisibility } from '../api/replayLifecycleApi'
import ReplayCard from '../components/replay/ReplayCard.vue'
import ReplayFolderTree from '../components/replay/ReplayFolderTree.vue'
import ReplayBreadcrumb, { type BreadcrumbItem } from '../components/replay/ReplayBreadcrumb.vue'
import MoveReplayDropdown from '../components/replay/MoveReplayDropdown.vue'
import ConfirmModal from '@/ui/ConfirmModal.vue'
import Modal from '@/ui/Modal.vue'
import Button from '@/ui/Button.vue'
import Input from '@/ui/Input.vue'
import { notifyError } from '@/utils/notify'

const props = defineProps<{
  initialStatus?: ReplayStatus
}>()

const { t } = useI18n()
const store = useReplayStore()

const copiedId = ref<string | null>(null)
const openMenuId = ref<string | null>(null)

// Move dropdown state (один активний за раз)
const movingReplay = ref<Replay | null>(null)
const moveAnchorRect = ref<DOMRect | null>(null)

// Drag-over візуалізація для status-табів (drop target)
const dropHoverTab = ref<ReplayStatus | null>(null)

// ─── Promise-based modal helpers ────────────────────────────────
// Замінюють window.confirm / window.prompt / window.alert на компоненти
// дизайн-системи (ConfirmModal + Modal + notifyError). Pattern: handler
// робить `await askConfirm({...})` і продовжує в залежності від boolean/null.

interface ConfirmOptions {
  title: string
  message: string
  confirmText: string
  variant: 'danger' | 'primary'
}

const confirmState = ref<(ConfirmOptions & { resolve: (v: boolean) => void }) | null>(null)
const confirmLoading = ref(false)

function askConfirm(options: ConfirmOptions): Promise<boolean> {
  return new Promise((resolve) => {
    confirmState.value = { ...options, resolve }
  })
}

function resolveConfirm(result: boolean) {
  if (!confirmState.value) return
  const { resolve } = confirmState.value
  confirmState.value = null
  confirmLoading.value = false
  resolve(result)
}

// Rename modal — Modal + Input inside.
const renameState = ref<{
  initialValue: string
  value: string
  resolve: (v: string | null) => void
} | null>(null)
const renameInputRef = ref<InstanceType<typeof Input> | null>(null)

function askRename(initialValue: string): Promise<string | null> {
  return new Promise((resolve) => {
    renameState.value = { initialValue, value: initialValue, resolve }
    nextTick(() => {
      // Focus + select для швидкого редагування
      const el = (renameInputRef.value as unknown as { $el?: HTMLElement })?.$el
      const input = el?.querySelector?.('input') as HTMLInputElement | null
      input?.focus()
      input?.select()
    })
  })
}

function resolveRename(value: string | null) {
  if (!renameState.value) return
  const { resolve } = renameState.value
  renameState.value = null
  resolve(value)
}

function onRenameAccept() {
  if (!renameState.value) return
  const trimmed = renameState.value.value.trim()
  resolveRename(trimmed || null)
}

// ─── View mode ─────────────────────────────────────────────────────

const VIEW_MODE_KEY = 'winterboard:replays:view-mode'
type ViewMode = 'grid' | 'list'
const viewMode = ref<ViewMode>(loadViewMode())

function loadViewMode(): ViewMode {
  try {
    return localStorage.getItem(VIEW_MODE_KEY) === 'list' ? 'list' : 'grid'
  } catch {
    return 'grid'
  }
}

function setViewMode(mode: ViewMode) {
  viewMode.value = mode
  try {
    localStorage.setItem(VIEW_MODE_KEY, mode)
  } catch {
    /* no-op */
  }
}

const containerClass = computed(() =>
  viewMode.value === 'list' ? 'replay-list__rows' : 'replay-list__grid',
)

// ─── Tabs ─────────────────────────────────────────────────────────

const statusTabs = computed<Array<{ value: ReplayStatus; label: string }>>(() => [
  { value: 'active', label: t('winterboard.replayList.tabs.active') },
  { value: 'archived', label: t('winterboard.replayList.tabs.archived') },
  { value: 'trashed', label: t('winterboard.replayList.tabs.trashed') },
])

const emptyIcon = computed(() => {
  if (store.currentStatus === 'archived') return '📦'
  if (store.currentStatus === 'trashed') return '🗑'
  return '🎬'
})
const emptyTitle = computed(() => {
  if (store.currentStatus === 'archived') return t('winterboard.replayList.empty.archivedTitle')
  if (store.currentStatus === 'trashed') return t('winterboard.replayList.empty.trashedTitle')
  return t('winterboard.replayList.empty.title')
})
const emptySubtitle = computed(() => {
  if (store.currentStatus === 'archived') return t('winterboard.replayList.empty.archivedSubtitle')
  if (store.currentStatus === 'trashed') return t('winterboard.replayList.empty.trashedSubtitle')
  return t('winterboard.replayList.empty.subtitle')
})

// ─── Folder selection ─────────────────────────────────────────────

type FolderKey = string | 'root' | 'all'

const selectedFolderKey = computed<FolderKey>(() => store.currentFolder)

const breadcrumbItems = computed<BreadcrumbItem[]>(() => {
  const cur = store.currentFolder
  if (cur === 'all') {
    return [{ id: null, name: t('winterboard.replayList.folders.all') }]
  }
  const rootItem: BreadcrumbItem = { id: null, name: t('winterboard.replayList.folders.noFolder') }
  if (cur === 'root') return [rootItem]

  // Build path from current folder up to root by following `parent`.
  const byId = new Map(store.folders.map((f) => [f.id, f]))
  const chain: BreadcrumbItem[] = []
  let node = byId.get(cur)
  while (node) {
    chain.unshift({ id: node.id, name: node.name })
    node = node.parent ? byId.get(node.parent) : undefined
  }
  return [rootItem, ...chain]
})

function onFolderSelect(id: FolderKey) {
  store.setFolder(id)
}

function onBreadcrumbNavigate(folderId: string | null) {
  store.setFolder(folderId ?? 'root')
}

// ─── Folder CRUD handlers ─────────────────────────────────────────

async function onFolderCreate(name: string, parentId: string | null) {
  try {
    await store.createFolder(name, parentId)
  } catch (err) {
    console.error('[WBReplayList] createFolder failed', err)
  }
}

async function onFolderRename(id: string, newName: string) {
  try {
    await store.renameFolder(id, newName)
  } catch (err) {
    console.error('[WBReplayList] renameFolder failed', err)
  }
}

async function onFolderDelete(id: string, name: string) {
  const ok = await askConfirm({
    title: t('winterboard.replayList.folders.delete'),
    message: t('winterboard.replayList.folders.deleteConfirm', { name }),
    confirmText: t('winterboard.replayList.folders.delete'),
    variant: 'danger',
  })
  if (!ok) return
  try {
    await store.deleteFolder(id)
    // Якщо користувач був у цій папці — скинути в 'all' (бо папки більше немає)
    if (store.currentFolder === id) store.setFolder('all')
  } catch (err) {
    console.error('[WBReplayList] deleteFolder failed', err)
  }
}

async function onFolderDrop(payload: { replayId: string; folderId: string | null }) {
  try {
    await store.moveToFolder(payload.replayId, payload.folderId)
  } catch (err) {
    console.error('[WBReplayList] move via drop failed', err)
  }
}

// ─── Lifecycle ────────────────────────────────────────────────────

onMounted(async () => {
  if (props.initialStatus && store.currentStatus !== props.initialStatus) {
    store.currentStatus = props.initialStatus
  }
  // Load folders + replays у паралелі — незалежні запити.
  await Promise.all([store.loadFolders(), store.loadReplays()])
})

// ─── Card event handlers ──────────────────────────────────────────

function toggleMenu(id: string) {
  openMenuId.value = openMenuId.value === id ? null : id
}

function handleOpen(replay: Replay) {
  openMenuId.value = null
  if (!replay.public_token) {
    notifyError(t('winterboard.replayList.errors.cannotOpen'))
    return
  }
  const url = `${window.location.origin}/winterboard/public/${replay.public_token}`
  window.open(url, '_blank', 'noopener,noreferrer')
}

function handleShare(replay: Replay) {
  openMenuId.value = null
  const token = replay.public_token
  if (!token) return
  const url = `${window.location.origin}/winterboard/public/${token}`
  navigator.clipboard.writeText(url).then(() => {
    copiedId.value = replay.id
    setTimeout(() => {
      if (copiedId.value === replay.id) copiedId.value = null
    }, 2000)
  })
}

async function handleRename(replay: Replay) {
  openMenuId.value = null
  const next = await askRename(replay.title)
  if (!next || next === replay.title) return
  try {
    await store.renameReplay(replay.id, next)
  } catch (err) {
    console.error('[WBReplayList] rename failed', err)
  }
}

async function handleVisibility(replay: Replay, visibility: ReplayVisibility) {
  openMenuId.value = null
  if (replay.visibility === visibility) return
  try {
    await store.changeVisibility(replay.id, visibility)
  } catch (err) {
    console.error('[WBReplayList] visibility failed', err)
  }
}

async function handleArchive(replay: Replay) {
  openMenuId.value = null
  try {
    await store.archive(replay.id)
  } catch (err) {
    console.error('[WBReplayList] archive failed', err)
  }
}

async function handleRestore(replay: Replay) {
  openMenuId.value = null
  try {
    await store.restore(replay.id)
  } catch (err) {
    console.error('[WBReplayList] restore failed', err)
  }
}

async function handleTrash(replay: Replay) {
  openMenuId.value = null
  const viewsWarning =
    replay.view_count > 0
      ? t('winterboard.replayList.prompts.trashWithViews', { count: replay.view_count }) + '\n\n'
      : ''
  const ok = await askConfirm({
    title: t('winterboard.replayList.menu.trash'),
    message: viewsWarning + t('winterboard.replayList.prompts.trashConfirm'),
    confirmText: t('winterboard.replayList.menu.trash'),
    variant: 'danger',
  })
  if (!ok) return
  try {
    await store.trash(replay.id)
  } catch (err) {
    console.error('[WBReplayList] trash failed', err)
  }
}

// ─── Move dropdown ────────────────────────────────────────────────

function handleMoveOpen(replay: Replay, anchorRect: DOMRect | null) {
  openMenuId.value = null
  movingReplay.value = replay
  moveAnchorRect.value = anchorRect
}

async function handleMoveCommit(replayId: string, newFolderId: string | null) {
  try {
    await store.moveToFolder(replayId, newFolderId)
  } catch (err) {
    console.error('[WBReplayList] moveToFolder failed', err)
  } finally {
    cancelMove()
  }
}

function cancelMove() {
  movingReplay.value = null
  moveAnchorRect.value = null
}

// ─── Drag-drop onto status tabs ──────────────────────────────────
// Карти можна кидати не тільки у папки, а й на таби "Архів"/"Кошик"/"Усі".
// Маршрутизація за target tab:
//   active   → restore  (для archived/trashed — повертає у основний список)
//   archived → archive  (якщо source=trashed, спочатку restore, потім archive)
//   trashed  → trash + confirm dialog (успадкований з menu-action)

function isReplayDrag(e: DragEvent): boolean {
  return Array.from(e.dataTransfer?.types ?? []).includes('application/x-wb-replay')
}

function onTabDragOver(tab: ReplayStatus, e: DragEvent) {
  if (!isReplayDrag(e)) return
  // Не підсвічуємо свій же таб — це no-op target
  if (store.currentStatus === tab) return
  dropHoverTab.value = tab
  if (e.dataTransfer) e.dataTransfer.dropEffect = 'move'
}

function onTabDragLeave(tab: ReplayStatus) {
  if (dropHoverTab.value === tab) dropHoverTab.value = null
}

async function onTabDrop(tab: ReplayStatus, e: DragEvent) {
  dropHoverTab.value = null
  const replayId = e.dataTransfer?.getData('application/x-wb-replay')
  if (!replayId) return
  const replay = store.replays.find((r) => r.id === replayId)
  if (!replay || replay.status === tab) return

  try {
    if (tab === 'active') {
      await store.restore(replay.id)
    } else if (tab === 'archived') {
      // Backend забороняє archive з trashed напряму — треба спочатку restore.
      if (replay.status === 'trashed') {
        await store.restore(replay.id)
      }
      await store.archive(replay.id)
    } else if (tab === 'trashed') {
      // Reuse menu-action щоб зберегти confirm-діалог з view_count warning
      await handleTrash(replay)
    }
  } catch (err) {
    console.error('[WBReplayList] tab-drop action failed', err)
  }
}
</script>

<style scoped>
.replay-list {
  max-width: 1280px;
  margin: 0 auto;
  padding: clamp(16px, 3vw, 32px);
}

.replay-list__header {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  gap: var(--space-md, 16px);
  margin-bottom: var(--space-md, 16px);
  flex-wrap: wrap;
}

.replay-list__title {
  margin: 0 0 4px;
  font-size: clamp(1.5rem, 3vw, 2rem);
  font-weight: 700;
  color: var(--text-primary);
}

.replay-list__subtitle {
  margin: 0;
  font-size: 0.9375rem;
  color: var(--text-secondary);
}

.replay-list__count {
  font-size: 0.875rem;
  color: var(--text-secondary);
  background: var(--bg-secondary);
  padding: 4px 10px;
  border-radius: 999px;
}

/* ─── 2-column layout: sidebar + main ─────────────────────────────── */

.replay-list__body {
  display: grid;
  grid-template-columns: 240px 1fr;
  gap: var(--space-lg, 24px);
  align-items: start;
}

.replay-list__sidebar {
  border-right: 1px solid var(--border-color, #e5e7eb);
  padding-right: var(--space-md, 16px);
  position: sticky;
  top: var(--space-md, 16px);
  max-height: calc(100vh - 48px);
  overflow-y: auto;
}

.replay-list__main {
  min-width: 0;
}

@media (max-width: 768px) {
  .replay-list__body {
    grid-template-columns: 1fr;
  }
  .replay-list__sidebar {
    border-right: none;
    border-bottom: 1px solid var(--border-color, #e5e7eb);
    padding-right: 0;
    padding-bottom: var(--space-md, 16px);
    position: static;
    max-height: none;
  }
}

.replay-list__toolbar {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  gap: var(--space-md, 16px);
  margin-bottom: var(--space-lg, 24px);
  border-bottom: 1px solid var(--border-color, #e5e7eb);
  flex-wrap: wrap;
}

.replay-list__tabs {
  display: flex;
  gap: 4px;
}

.replay-list__view-toggle {
  display: inline-flex;
  align-items: stretch;
  margin-bottom: 4px;
  border: 1px solid var(--border-color, #e5e7eb);
  border-radius: var(--radius-md, 8px);
  overflow: hidden;
  background: var(--card-bg, #fff);
}

.replay-list__view-btn {
  padding: 6px 10px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border: none;
  background: transparent;
  color: var(--text-secondary);
  cursor: pointer;
  transition: background 0.15s, color 0.15s;
}

.replay-list__view-btn + .replay-list__view-btn {
  border-left: 1px solid var(--border-color, #e5e7eb);
}

.replay-list__view-btn:hover {
  color: var(--text-primary);
  background: var(--bg-secondary, #f3f4f6);
}

.replay-list__view-btn--active {
  background: color-mix(in srgb, var(--accent) 12%, transparent);
  color: var(--accent);
}

.sr-only {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
  border: 0;
}

.replay-list__tab {
  padding: 10px 16px;
  border: none;
  background: transparent;
  color: var(--text-secondary);
  font-size: 0.9375rem;
  font-weight: 600;
  cursor: pointer;
  border-bottom: 2px solid transparent;
  transition: color 0.15s, border-color 0.15s;
}

.replay-list__tab:hover {
  color: var(--text-primary);
}

.replay-list__tab--active {
  color: var(--accent);
  border-bottom-color: var(--accent);
}

/* Drop-target візуалізація: коли на таб тягнуть картку реплею */
.replay-list__tab--drop-hover {
  color: var(--accent);
  background: color-mix(in srgb, var(--accent) 12%, transparent);
  border-radius: var(--radius-md, 8px) var(--radius-md, 8px) 0 0;
  outline: 2px dashed var(--accent);
  outline-offset: -3px;
}

.replay-list__error {
  padding: 12px 16px;
  background: color-mix(in srgb, var(--color-error, #dc2626) 8%, transparent);
  color: var(--color-error, #dc2626);
  border-radius: var(--radius-md, 8px);
  margin-bottom: var(--space-md, 16px);
}

.replay-list__grid {
  /* Phase WB-Responsive-11: уніфіковано з WBBoardList/WBSessionList through --wb-card-min. */
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(var(--wb-card-min, 280px), 1fr));
  gap: var(--space-md, 16px);
}

.replay-list__rows {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

/* Skeleton placeholder (до завантаження) — використовується до того, як
   з'являться ReplayCard-компоненти. Стилі ReplayCard інкапсульовані у
   своєму SFC. */
.replay-card--skeleton {
  min-height: 280px;
  background: linear-gradient(
    90deg,
    var(--bg-secondary, #f3f4f6) 0%,
    var(--border-color, #e5e7eb) 50%,
    var(--bg-secondary, #f3f4f6) 100%
  );
  background-size: 200% 100%;
  animation: replay-skel 1.4s infinite;
  border-radius: var(--radius-lg, 12px);
}

@keyframes replay-skel {
  0% { background-position: 200% 0; }
  100% { background-position: -200% 0; }
}

.replay-list__empty {
  text-align: center;
  padding: 80px 20px;
}

.replay-list__empty-icon {
  font-size: 3rem;
  margin-bottom: 12px;
}

.replay-list__empty-title {
  margin: 0 0 4px;
  font-size: 1.125rem;
  font-weight: 600;
  color: var(--text-primary);
}

.replay-list__empty-subtitle {
  margin: 0;
  color: var(--text-secondary);
}
</style>
