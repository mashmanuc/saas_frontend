<template>
  <nav class="wb-folder-tree" :aria-label="t('winterboard.library.folders')">
    <!-- All files (root) -->
    <button
      type="button"
      class="wb-folder-tree__item"
      :class="{
        'wb-folder-tree__item--active': selectedId === null,
        'wb-folder-tree__item--dragover': dragOverId === null
      }"
      :aria-current="selectedId === null ? 'true' : undefined"
      @click="emit('select', null)"
      @dragover.prevent="onFolderDragOver(null, $event)"
      @dragleave="onFolderDragLeave(null)"
      @drop.prevent="onFolderDrop(null, $event)"
    >
      <span class="wb-folder-tree__icon" aria-hidden="true">
        <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
          <rect x="1" y="3" width="12" height="9" rx="1.5" stroke="currentColor" stroke-width="1.2"/>
          <path d="M1 5.5h5l1-2h6" stroke="currentColor" stroke-width="1.2" stroke-linecap="round"/>
        </svg>
      </span>
      <span class="wb-folder-tree__label">{{ t('winterboard.library.allFiles') }}</span>
    </button>

    <!-- Favorites shortcut -->
    <button
      type="button"
      class="wb-folder-tree__item"
      :class="{ 'wb-folder-tree__item--active': selectedId === FAVORITES_ID }"
      :aria-current="selectedId === FAVORITES_ID ? 'true' : undefined"
      @click="emit('select', FAVORITES_ID)"
    >
      <span class="wb-folder-tree__icon" aria-hidden="true">
        <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
          <path
            d="M7 1.5l1.545 3.13 3.455.5-2.5 2.435.59 3.435L7 9.25l-3.09 1.75.59-3.435L2 5.13l3.455-.5L7 1.5z"
            fill="currentColor" stroke="currentColor" stroke-width="1.1" stroke-linejoin="round"
          />
        </svg>
      </span>
      <span class="wb-folder-tree__label">{{ t('winterboard.library.favorites') }}</span>
    </button>

    <!-- Recent -->
    <button
      type="button"
      class="wb-folder-tree__item"
      :class="{ 'wb-folder-tree__item--active': selectedId === RECENT_ID }"
      :aria-current="selectedId === RECENT_ID ? 'true' : undefined"
      @click="emit('select', RECENT_ID)"
    >
      <span class="wb-folder-tree__icon" aria-hidden="true">
        <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
          <circle cx="7" cy="7" r="5.5" stroke="currentColor" stroke-width="1.2"/>
          <path d="M7 4v3l2 1.5" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>
      </span>
      <span class="wb-folder-tree__label">{{ t('winterboard.library.recent') }}</span>
    </button>

    <!-- Divider -->
    <div v-if="flatNodes.length > 0 || editable" class="wb-folder-tree__divider" role="separator" />

    <!-- Inline create at root level (editable mode) -->
    <div v-if="editable && creatingParentId === ROOT_PARENT" class="wb-folder-tree__create-row">
      <input
        ref="createInputRef"
        v-model="newFolderName"
        type="text"
        maxlength="255"
        class="wb-folder-tree__inline-input"
        :placeholder="t('winterboard.library.folderName')"
        @keydown.enter="emitCreate"
        @keydown.escape="cancelCreate"
      />
    </div>

    <!-- Folders -->
    <template v-for="{ folder, depth } in flatNodes" :key="folder.id">
      <!-- Rename mode -->
      <div
        v-if="editable && renamingId === folder.id"
        class="wb-folder-tree__item wb-folder-tree__item--folder"
        :style="{ paddingLeft: `${8 + depth * 14}px` }"
      >
        <span class="wb-folder-tree__icon" aria-hidden="true">
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
            <path
              d="M1.5 4A1.5 1.5 0 013 2.5h2.5l1 1.5H11A1.5 1.5 0 0112.5 5.5v5A1.5 1.5 0 0111 12H3A1.5 1.5 0 011.5 10.5V4z"
              fill="none" stroke="currentColor" stroke-width="1.2" stroke-linejoin="round"
            />
          </svg>
        </span>
        <input
          ref="renameInputRef"
          v-model="renameValue"
          type="text"
          maxlength="255"
          class="wb-folder-tree__inline-input"
          @keydown.enter="emitRename"
          @keydown.escape="cancelRename"
        />
      </div>

      <!-- Normal mode -->
      <div
        v-else
        class="wb-folder-tree__item wb-folder-tree__item--folder"
        :class="{
          'wb-folder-tree__item--active': selectedId === folder.id,
          'wb-folder-tree__item--dragover': dragOverId === folder.id
        }"
        :style="{ paddingLeft: `${8 + depth * 14}px` }"
        :aria-current="selectedId === folder.id ? 'true' : undefined"
        @click="emit('select', folder.id)"
        @dblclick.prevent="editable && startRename(folder)"
        @dragover.prevent="onFolderDragOver(folder.id, $event)"
        @dragleave="onFolderDragLeave(folder.id)"
        @drop.prevent="onFolderDrop(folder.id, $event)"
      >
        <span class="wb-folder-tree__icon" aria-hidden="true">
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
            <path
              d="M1.5 4A1.5 1.5 0 013 2.5h2.5l1 1.5H11A1.5 1.5 0 0112.5 5.5v5A1.5 1.5 0 0111 12H3A1.5 1.5 0 011.5 10.5V4z"
              :fill="selectedId === folder.id ? 'currentColor' : 'none'"
              stroke="currentColor" stroke-width="1.2" stroke-linejoin="round"
            />
          </svg>
        </span>
        <span class="wb-folder-tree__label">{{ folder.name }}</span>
        <span v-if="folder.assets_count > 0 && !(editable && hoveredId === folder.id)" class="wb-folder-tree__count">
          {{ folder.assets_count }}
        </span>

        <!-- Hover actions (editable mode only) -->
        <span
          v-if="editable"
          class="wb-folder-tree__actions"
          @mouseenter="hoveredId = folder.id"
          @mouseleave="hoveredId = null"
        >
          <button
            type="button"
            class="wb-folder-tree__action-btn"
            :title="t('winterboard.library.renameFolder')"
            @click.stop="startRename(folder)"
          >✏️</button>
          <button
            type="button"
            class="wb-folder-tree__action-btn"
            :title="t('winterboard.library.createChild')"
            @click.stop="startCreate(folder.id)"
          >+</button>
          <button
            type="button"
            class="wb-folder-tree__action-btn wb-folder-tree__action-btn--danger"
            :title="t('winterboard.library.deleteFolder')"
            @click.stop="emitDelete(folder)"
          >✕</button>
        </span>
      </div>

      <!-- Inline create child (under this folder) -->
      <div
        v-if="editable && creatingParentId === folder.id"
        class="wb-folder-tree__create-row"
        :style="{ paddingLeft: `${8 + (depth + 1) * 14}px` }"
      >
        <input
          ref="createInputRef"
          v-model="newFolderName"
          type="text"
          maxlength="255"
          class="wb-folder-tree__inline-input"
          :placeholder="t('winterboard.library.createChildPlaceholder')"
          @keydown.enter="emitCreate"
          @keydown.escape="cancelCreate"
        />
      </div>
    </template>

    <!-- Empty folders message -->
    <p v-if="flatNodes.length === 0 && !props.loading" class="wb-folder-tree__empty">
      {{ t('winterboard.library.noFolders') }}
    </p>

    <!-- Loading -->
    <div v-if="props.loading" class="wb-folder-tree__loading">
      <div v-for="i in 3" :key="i" class="wb-skeleton-pulse wb-folder-tree__skeleton" />
    </div>

    <!-- Create root folder button (editable mode) -->
    <button
      v-if="editable && creatingParentId === null"
      type="button"
      class="wb-folder-tree__new-btn"
      @click="startCreate(ROOT_PARENT)"
    >
      <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden="true">
        <path d="M6 1v10M1 6h10" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
      </svg>
      {{ t('winterboard.library.newFolder') }}
    </button>
  </nav>
</template>

<script lang="ts">
export const FAVORITES_ID = -1
export const RECENT_ID = -2
</script>

<script setup lang="ts">
import { computed, ref, nextTick } from 'vue'
import { useI18n } from 'vue-i18n'
import { isAssetDrag, getAssetDragData } from '../../utils/dragHelpers'
import type { LibraryFolderTree as FolderTreeNode } from '../../types/library'

// Sentinel value for "create at root level" (distinct from null = "not creating")
const ROOT_PARENT = -999

// ─── Props & Emits ────────────────────────────────────────────────────────────

interface Props {
  folders: FolderTreeNode[]
  selectedId: number | null
  loading?: boolean
  editable?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  loading: false,
  editable: false,
})

const emit = defineEmits<{
  select: [id: number | null]
  create: [name: string, parentId: number | null]
  rename: [id: number, newName: string]
  delete: [id: number, name: string]
  drop: [data: { assetId: number; folderId: number | null }]
}>()

// ─── i18n ─────────────────────────────────────────────────────────────────────

const { t } = useI18n()

// ─── Flatten tree for rendering ───────────────────────────────────────────────

interface FlatNode {
  folder: FolderTreeNode
  depth: number
}

function flattenTree(nodes: FolderTreeNode[], depth = 0): FlatNode[] {
  const result: FlatNode[] = []
  for (const node of nodes) {
    result.push({ folder: node, depth })
    if (node.children.length > 0) {
      result.push(...flattenTree(node.children, depth + 1))
    }
  }
  return result
}

const flatNodes = computed<FlatNode[]>(() => flattenTree(props.folders))

// ─── Hover tracking ──────────────────────────────────────────────────────────

const hoveredId = ref<number | null>(null)

// ─── Inline create ────────────────────────────────────────────────────────────

const creatingParentId = ref<number | null>(null) // null = not creating, ROOT_PARENT = root, >0 = child
const newFolderName = ref('')
const createInputRef = ref<HTMLInputElement | null>(null)

function startCreate(parentId: number): void {
  cancelRename()
  creatingParentId.value = parentId
  newFolderName.value = ''
  nextTick(() => {
    // createInputRef може бути масивом (v-for) або одиничним ref
    const el = Array.isArray(createInputRef.value) ? createInputRef.value[0] : createInputRef.value
    el?.focus()
  })
}

function cancelCreate(): void {
  creatingParentId.value = null
  newFolderName.value = ''
}

function emitCreate(): void {
  const name = newFolderName.value.trim()
  if (!name) return
  const parentId = creatingParentId.value === ROOT_PARENT ? null : creatingParentId.value
  emit('create', name, parentId)
  cancelCreate()
}

// ─── Inline rename ────────────────────────────────────────────────────────────

const renamingId = ref<number | null>(null)
const renameValue = ref('')
const renameInputRef = ref<HTMLInputElement | null>(null)

function startRename(folder: FolderTreeNode): void {
  cancelCreate()
  renamingId.value = folder.id
  renameValue.value = folder.name
  nextTick(() => {
    const el = Array.isArray(renameInputRef.value) ? renameInputRef.value[0] : renameInputRef.value
    el?.focus()
    el?.select()
  })
}

function cancelRename(): void {
  renamingId.value = null
  renameValue.value = ''
}

function emitRename(): void {
  const name = renameValue.value.trim()
  if (!name || renamingId.value === null) {
    cancelRename()
    return
  }
  emit('rename', renamingId.value, name)
  cancelRename()
}

// ─── Delete ───────────────────────────────────────────────────────────────────

function emitDelete(folder: FolderTreeNode): void {
  emit('delete', folder.id, folder.name)
}

// ─── Drag-drop handlers (Phase 33 B3) ────────────────────────────────────────

const dragOverId = ref<number | null | false>(false) // false = no drag

function onFolderDragOver(folderId: number | null, e: DragEvent): void {
  if (!isAssetDrag(e)) return
  // INV-5: НЕ дозволяти drop на FAVORITES/RECENT
  if (folderId === FAVORITES_ID || folderId === RECENT_ID) return
  dragOverId.value = folderId
}

function onFolderDragLeave(folderId: number | null): void {
  if (dragOverId.value === folderId) {
    dragOverId.value = false
  }
}

function onFolderDrop(folderId: number | null, e: DragEvent): void {
  dragOverId.value = false
  const assetId = getAssetDragData(e)
  if (assetId === null) return
  // INV-5: НЕ дозволяти drop на virtual folders
  if (folderId === FAVORITES_ID || folderId === RECENT_ID) return
  emit('drop', { assetId, folderId })
}
</script>

<style scoped>
.wb-folder-tree {
  display: flex;
  flex-direction: column;
  gap: 2px;
  padding: 8px 0;
}

.wb-folder-tree__item {
  display: flex;
  align-items: center;
  gap: 8px;
  width: 100%;
  padding: 8px 12px;
  background: none;
  border: none;
  border-radius: 7px;
  cursor: pointer;
  text-align: left;
  font-size: 13px;
  color: var(--wb-fg, #374151);
  transition: background 0.1s, color 0.1s;
  white-space: nowrap;
  min-height: 34px;
  position: relative;
}

.wb-folder-tree__item:hover {
  background: var(--wb-canvas-bg, #f1f5f9);
}

.wb-folder-tree__item--active {
  background: var(--wb-brand, #0066ff);
  color: #ffffff;
}

.wb-folder-tree__item--active:hover {
  background: var(--wb-brand-hover, #0052cc);
}

.wb-folder-tree__item--dragover {
  background: rgba(99, 102, 241, 0.1);
  border: 1px dashed #6366f1;
  border-radius: 4px;
}

.wb-folder-tree__icon {
  display: flex;
  align-items: center;
  flex-shrink: 0;
  color: currentColor;
  opacity: 0.7;
}

.wb-folder-tree__item--active .wb-folder-tree__icon {
  opacity: 1;
}

.wb-folder-tree__label {
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
}

.wb-folder-tree__count {
  font-size: 11px;
  background: var(--wb-toolbar-border, #e2e8f0);
  color: var(--wb-fg-secondary, #64748b);
  border-radius: 10px;
  padding: 1px 6px;
  flex-shrink: 0;
}

.wb-folder-tree__item--active .wb-folder-tree__count {
  background: rgba(255, 255, 255, 0.25);
  color: #ffffff;
}

/* ─── Hover actions ─────────────────────────────────────────────────── */

.wb-folder-tree__actions {
  display: none;
  align-items: center;
  gap: 2px;
  flex-shrink: 0;
  margin-left: auto;
}

.wb-folder-tree__item--folder:hover .wb-folder-tree__actions {
  display: flex;
}

.wb-folder-tree__action-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 20px;
  height: 20px;
  border: none;
  background: none;
  border-radius: 4px;
  cursor: pointer;
  font-size: 11px;
  color: var(--wb-fg-secondary, #94a3b8);
  padding: 0;
  line-height: 1;
  transition: background 0.1s, color 0.1s;
}

.wb-folder-tree__action-btn:hover {
  background: var(--wb-toolbar-border, #e2e8f0);
  color: var(--wb-brand, #0066ff);
}

.wb-folder-tree__action-btn--danger:hover {
  color: #ef4444;
}

.wb-folder-tree__item--active .wb-folder-tree__action-btn {
  color: rgba(255, 255, 255, 0.6);
}

.wb-folder-tree__item--active .wb-folder-tree__action-btn:hover {
  background: rgba(255, 255, 255, 0.2);
  color: #ffffff;
}

/* ─── Inline inputs ─────────────────────────────────────────────────── */

.wb-folder-tree__inline-input {
  flex: 1;
  min-width: 0;
  padding: 4px 8px;
  font-size: 13px;
  border: 1px solid var(--wb-brand, #0066ff);
  border-radius: 5px;
  outline: none;
  background: #fff;
  color: var(--wb-fg, #374151);
}

.wb-folder-tree__inline-input:focus {
  box-shadow: 0 0 0 2px rgba(0, 102, 255, 0.2);
}

.wb-folder-tree__create-row {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 4px 12px;
}

/* ─── New folder button ─────────────────────────────────────────────── */

.wb-folder-tree__new-btn {
  display: flex;
  align-items: center;
  gap: 6px;
  width: 100%;
  padding: 8px 12px;
  background: none;
  border: none;
  border-radius: 7px;
  cursor: pointer;
  text-align: left;
  font-size: 12px;
  color: var(--wb-fg-secondary, #94a3b8);
  transition: background 0.1s, color 0.1s;
  margin-top: 4px;
}

.wb-folder-tree__new-btn:hover {
  background: var(--wb-canvas-bg, #f1f5f9);
  color: var(--wb-brand, #0066ff);
}

/* ─── Misc ──────────────────────────────────────────────────────────── */

.wb-folder-tree__divider {
  height: 1px;
  background: var(--wb-toolbar-border, #e2e8f0);
  margin: 6px 8px;
}

.wb-folder-tree__empty {
  font-size: 12px;
  color: var(--wb-fg-secondary, #94a3b8);
  padding: 8px 12px;
  margin: 0;
}

.wb-folder-tree__loading {
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding: 4px 8px;
}

.wb-folder-tree__skeleton {
  height: 30px;
  border-radius: 7px;
}

.wb-skeleton-pulse {
  background: linear-gradient(
    90deg,
    var(--wb-toolbar-border, #e2e8f0) 25%,
    var(--wb-canvas-bg, #f1f5f9) 50%,
    var(--wb-toolbar-border, #e2e8f0) 75%
  );
  background-size: 200% 100%;
  animation: wb-shimmer 1.5s ease-in-out infinite;
}

@keyframes wb-shimmer {
  0% { background-position: 200% 0; }
  100% { background-position: -200% 0; }
}

@media (prefers-reduced-motion: reduce) {
  .wb-folder-tree__item,
  .wb-skeleton-pulse {
    animation: none;
    transition: none;
  }
}
</style>
