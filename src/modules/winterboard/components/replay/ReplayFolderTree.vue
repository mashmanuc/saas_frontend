<template>
  <nav class="wb-replay-folder-tree" :aria-label="t('winterboard.replayList.folders.label')">
    <!-- All replays (root = 'all') -->
    <button
      type="button"
      class="wb-replay-folder-tree__item"
      :class="{ 'wb-replay-folder-tree__item--active': selectedId === 'all' }"
      :aria-current="selectedId === 'all' ? 'true' : undefined"
      @click="emit('select', 'all')"
    >
      <span class="wb-replay-folder-tree__icon" aria-hidden="true">
        <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
          <rect x="1" y="3" width="12" height="9" rx="1.5" stroke="currentColor" stroke-width="1.2" />
          <path d="M1 5.5h12" stroke="currentColor" stroke-width="1.2" />
        </svg>
      </span>
      <span class="wb-replay-folder-tree__label">
        {{ t('winterboard.replayList.folders.all') }}
      </span>
    </button>

    <!-- Root-level (no folder) -->
    <button
      type="button"
      class="wb-replay-folder-tree__item"
      :class="{
        'wb-replay-folder-tree__item--active': selectedId === 'root',
        'wb-replay-folder-tree__item--dragover': dragOverId === 'root',
      }"
      :aria-current="selectedId === 'root' ? 'true' : undefined"
      @click="emit('select', 'root')"
      @dragover.prevent="onDragOver('root', $event)"
      @dragleave="onDragLeave('root')"
      @drop.prevent="onDrop('root', $event)"
    >
      <span class="wb-replay-folder-tree__icon" aria-hidden="true">
        <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
          <rect x="1" y="3" width="12" height="9" rx="1.5" stroke="currentColor" stroke-width="1.2" />
          <path d="M1 5.5h5l1-2h6" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" />
        </svg>
      </span>
      <span class="wb-replay-folder-tree__label">
        {{ t('winterboard.replayList.folders.noFolder') }}
      </span>
    </button>

    <div v-if="flatNodes.length > 0 || editable" class="wb-replay-folder-tree__divider" role="separator" />

    <!-- Inline create at root level -->
    <div v-if="editable && creatingParentId === ROOT_SENTINEL" class="wb-replay-folder-tree__create-row">
      <input
        ref="createInputRef"
        v-model="newFolderName"
        type="text"
        maxlength="255"
        class="wb-replay-folder-tree__inline-input"
        :placeholder="t('winterboard.replayList.folders.name')"
        @keydown.enter="emitCreate"
        @keydown.escape="cancelCreate"
        @blur="emitCreate"
      />
    </div>

    <!-- Folders -->
    <template v-for="{ folder, depth } in flatNodes" :key="folder.id">
      <div
        v-if="editable && renamingId === folder.id"
        class="wb-replay-folder-tree__item wb-replay-folder-tree__item--folder"
        :style="{ paddingLeft: `${8 + depth * 14}px` }"
      >
        <span class="wb-replay-folder-tree__icon" aria-hidden="true">
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
          class="wb-replay-folder-tree__inline-input"
          @keydown.enter="emitRename"
          @keydown.escape="cancelRename"
          @blur="emitRename"
        />
      </div>

      <div
        v-else
        class="wb-replay-folder-tree__item wb-replay-folder-tree__item--folder"
        :class="{
          'wb-replay-folder-tree__item--active': selectedId === folder.id,
          'wb-replay-folder-tree__item--dragover': dragOverId === folder.id,
        }"
        :style="{ paddingLeft: `${8 + depth * 14}px` }"
        :aria-current="selectedId === folder.id ? 'true' : undefined"
        @click="emit('select', folder.id)"
        @dblclick.prevent="editable && startRename(folder)"
        @dragover.prevent="onDragOver(folder.id, $event)"
        @dragleave="onDragLeave(folder.id)"
        @drop.prevent="onDrop(folder.id, $event)"
      >
        <span class="wb-replay-folder-tree__icon" aria-hidden="true">
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
            <path
              d="M1.5 4A1.5 1.5 0 013 2.5h2.5l1 1.5H11A1.5 1.5 0 0112.5 5.5v5A1.5 1.5 0 0111 12H3A1.5 1.5 0 011.5 10.5V4z"
              :fill="selectedId === folder.id ? 'currentColor' : 'none'"
              stroke="currentColor" stroke-width="1.2" stroke-linejoin="round"
            />
          </svg>
        </span>
        <span class="wb-replay-folder-tree__label">{{ folder.name }}</span>

        <span
          v-if="editable"
          class="wb-replay-folder-tree__actions"
          @click.stop
        >
          <button
            type="button"
            class="wb-replay-folder-tree__action-btn"
            :title="t('winterboard.replayList.folders.rename')"
            @click.stop="startRename(folder)"
          >✏️</button>
          <button
            type="button"
            class="wb-replay-folder-tree__action-btn"
            :title="t('winterboard.replayList.folders.createChild')"
            @click.stop="startCreate(folder.id)"
          >+</button>
          <button
            type="button"
            class="wb-replay-folder-tree__action-btn wb-replay-folder-tree__action-btn--danger"
            :title="t('winterboard.replayList.folders.delete')"
            @click.stop="emitDelete(folder)"
          >✕</button>
        </span>
      </div>

      <div
        v-if="editable && creatingParentId === folder.id"
        class="wb-replay-folder-tree__create-row"
        :style="{ paddingLeft: `${8 + (depth + 1) * 14}px` }"
      >
        <input
          ref="createInputRef"
          v-model="newFolderName"
          type="text"
          maxlength="255"
          class="wb-replay-folder-tree__inline-input"
          :placeholder="t('winterboard.replayList.folders.name')"
          @keydown.enter="emitCreate"
          @keydown.escape="cancelCreate"
          @blur="emitCreate"
        />
      </div>
    </template>

    <p v-if="flatNodes.length === 0 && !loading && !editable" class="wb-replay-folder-tree__empty">
      {{ t('winterboard.replayList.folders.empty') }}
    </p>

    <div v-if="loading" class="wb-replay-folder-tree__loading">
      <div v-for="i in 3" :key="i" class="wb-replay-folder-tree__skeleton" />
    </div>

    <button
      v-if="editable && creatingParentId === null"
      type="button"
      class="wb-replay-folder-tree__new-btn"
      @click="startCreate(ROOT_SENTINEL)"
    >
      <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden="true">
        <path d="M6 1v10M1 6h10" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" />
      </svg>
      {{ t('winterboard.replayList.folders.new') }}
    </button>
  </nav>
</template>

<script setup lang="ts">
import { computed, nextTick, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { buildReplayFolderTree, type ReplayFolder, type ReplayFolderTreeNode } from '../../api/replayFoldersApi'

// Sentinel-значення "створити у корені" (відрізняється від null = не створюємо).
// `__ROOT__` не може бути реальним UUID, тому колізія неможлива.
const ROOT_SENTINEL = '__ROOT__' as const

interface Props {
  folders: ReplayFolder[]             // плоский список зі store
  selectedId: string | 'root' | 'all'
  loading?: boolean
  editable?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  loading: false,
  editable: true,
})

const emit = defineEmits<{
  select: [id: string | 'root' | 'all']
  create: [name: string, parentId: string | null]
  rename: [id: string, newName: string]
  delete: [id: string, name: string]
  drop: [payload: { replayId: string; folderId: string | null }]
}>()

const { t } = useI18n()

// ─── Tree build ─────────────────────────────────────────────────────

interface FlatNode {
  folder: ReplayFolderTreeNode
  depth: number
}

function flattenTree(nodes: ReplayFolderTreeNode[], depth = 0): FlatNode[] {
  const out: FlatNode[] = []
  for (const n of nodes) {
    out.push({ folder: n, depth })
    if (n.children.length > 0) out.push(...flattenTree(n.children, depth + 1))
  }
  return out
}

const tree = computed(() => buildReplayFolderTree(props.folders))
const flatNodes = computed<FlatNode[]>(() => flattenTree(tree.value))

// ─── Inline create ──────────────────────────────────────────────────

const creatingParentId = ref<string | null>(null) // null = не створюємо, ROOT_SENTINEL = root, UUID = child
const newFolderName = ref('')
const createInputRef = ref<HTMLInputElement | HTMLInputElement[] | null>(null)

function startCreate(parentId: string): void {
  cancelRename()
  creatingParentId.value = parentId
  newFolderName.value = ''
  nextTick(() => {
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
  if (!name) {
    cancelCreate()
    return
  }
  const parentId = creatingParentId.value === ROOT_SENTINEL ? null : creatingParentId.value
  emit('create', name, parentId)
  cancelCreate()
}

// ─── Inline rename ──────────────────────────────────────────────────

const renamingId = ref<string | null>(null)
const renameValue = ref('')
const renameInputRef = ref<HTMLInputElement | HTMLInputElement[] | null>(null)

function startRename(folder: ReplayFolderTreeNode): void {
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
  const folder = props.folders.find((f) => f.id === renamingId.value)
  if (folder && folder.name === name) {
    cancelRename()
    return
  }
  emit('rename', renamingId.value, name)
  cancelRename()
}

function emitDelete(folder: ReplayFolderTreeNode): void {
  emit('delete', folder.id, folder.name)
}

// ─── Drag & drop ────────────────────────────────────────────────────

const dragOverId = ref<string | null>(null)

function isReplayDrag(e: DragEvent): boolean {
  return Array.from(e.dataTransfer?.types ?? []).includes('application/x-wb-replay')
}

function onDragOver(folderId: string, e: DragEvent): void {
  if (!isReplayDrag(e)) return
  dragOverId.value = folderId
}

function onDragLeave(folderId: string): void {
  if (dragOverId.value === folderId) dragOverId.value = null
}

function onDrop(folderId: string, e: DragEvent): void {
  dragOverId.value = null
  const replayId = e.dataTransfer?.getData('application/x-wb-replay')
  if (!replayId) return
  emit('drop', {
    replayId,
    folderId: folderId === 'root' ? null : folderId,
  })
}
</script>

<style scoped>
.wb-replay-folder-tree {
  display: flex;
  flex-direction: column;
  gap: 2px;
  padding: 8px 0;
}

.wb-replay-folder-tree__item {
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
  color: var(--text-primary, #374151);
  transition: background 0.1s, color 0.1s;
  white-space: nowrap;
  min-height: 34px;
  position: relative;
}

.wb-replay-folder-tree__item:hover {
  background: var(--bg-secondary, #f1f5f9);
}

.wb-replay-folder-tree__item--active {
  background: var(--accent, #0066ff);
  color: #fff;
}

/* Active + hover: :hover має вищу специфічність за single class,
   тому без цього правила білий текст стає нечитабельним на світлому фоні. */
.wb-replay-folder-tree__item--active:hover {
  background: color-mix(in srgb, var(--accent, #0066ff) 88%, #000);
  color: #fff;
}

.wb-replay-folder-tree__item--dragover {
  outline: 2px dashed var(--accent, #6366f1);
  outline-offset: -2px;
  background: color-mix(in srgb, var(--accent, #6366f1) 10%, transparent);
}

.wb-replay-folder-tree__icon {
  display: flex;
  align-items: center;
  flex-shrink: 0;
  opacity: 0.7;
}

.wb-replay-folder-tree__item--active .wb-replay-folder-tree__icon {
  opacity: 1;
}

.wb-replay-folder-tree__label {
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
}

.wb-replay-folder-tree__actions {
  display: none;
  align-items: center;
  gap: 2px;
  flex-shrink: 0;
  margin-left: auto;
}

.wb-replay-folder-tree__item--folder:hover .wb-replay-folder-tree__actions {
  display: flex;
}

.wb-replay-folder-tree__action-btn {
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
  color: var(--text-secondary, #94a3b8);
  padding: 0;
  line-height: 1;
  transition: background 0.1s, color 0.1s;
}

.wb-replay-folder-tree__action-btn:hover {
  background: var(--border-color, #e2e8f0);
  color: var(--accent, #0066ff);
}

.wb-replay-folder-tree__action-btn--danger:hover {
  color: var(--color-error, #ef4444);
}

.wb-replay-folder-tree__item--active .wb-replay-folder-tree__action-btn {
  color: rgba(255, 255, 255, 0.7);
}

.wb-replay-folder-tree__item--active .wb-replay-folder-tree__action-btn:hover {
  background: rgba(255, 255, 255, 0.2);
  color: #fff;
}

.wb-replay-folder-tree__inline-input {
  flex: 1;
  min-width: 0;
  padding: 4px 8px;
  font-size: 13px;
  border: 1px solid var(--accent, #0066ff);
  border-radius: 5px;
  outline: none;
  background: var(--card-bg, #fff);
  color: var(--text-primary, #374151);
}

.wb-replay-folder-tree__inline-input:focus {
  box-shadow: 0 0 0 2px color-mix(in srgb, var(--accent, #0066ff) 20%, transparent);
}

.wb-replay-folder-tree__create-row {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 4px 12px;
}

.wb-replay-folder-tree__new-btn {
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
  color: var(--text-secondary, #94a3b8);
  transition: background 0.1s, color 0.1s;
  margin-top: 4px;
}

.wb-replay-folder-tree__new-btn:hover {
  background: var(--bg-secondary, #f1f5f9);
  color: var(--accent, #0066ff);
}

.wb-replay-folder-tree__divider {
  height: 1px;
  background: var(--border-color, #e2e8f0);
  margin: 6px 8px;
}

.wb-replay-folder-tree__empty {
  font-size: 12px;
  color: var(--text-secondary, #94a3b8);
  padding: 8px 12px;
  margin: 0;
}

.wb-replay-folder-tree__loading {
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding: 4px 8px;
}

.wb-replay-folder-tree__skeleton {
  height: 30px;
  border-radius: 7px;
  background: linear-gradient(
    90deg,
    var(--border-color, #e2e8f0) 25%,
    var(--bg-secondary, #f1f5f9) 50%,
    var(--border-color, #e2e8f0) 75%
  );
  background-size: 200% 100%;
  animation: wb-replay-folder-shimmer 1.5s ease-in-out infinite;
}

@keyframes wb-replay-folder-shimmer {
  0% { background-position: 200% 0; }
  100% { background-position: -200% 0; }
}

@media (prefers-reduced-motion: reduce) {
  .wb-replay-folder-tree__item,
  .wb-replay-folder-tree__skeleton {
    animation: none;
    transition: none;
  }
}
</style>
