<!-- BoardFolderTree — sidebar folder tree for board organization (Level 2) -->
<template>
  <div class="wb-folder-tree">
    <!-- All boards (virtual) -->
    <button
      type="button"
      class="wb-folder-tree__item"
      :class="{ 'wb-folder-tree__item--active': selectedFolderId === null && !rootOnly }"
      @click="$emit('select', null)"
    >
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none" class="wb-folder-tree__icon">
        <rect x="1" y="3" width="14" height="11" rx="2" stroke="currentColor" stroke-width="1.5"/>
        <path d="M1 5h14" stroke="currentColor" stroke-width="1.5"/>
      </svg>
      <span class="wb-folder-tree__label">{{ t('winterboard.folders.allBoards') }}</span>
    </button>

    <!-- Root (no folder) -->
    <button
      type="button"
      class="wb-folder-tree__item"
      :class="{ 'wb-folder-tree__item--active': rootOnly }"
      @click="$emit('select-root')"
    >
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none" class="wb-folder-tree__icon">
        <rect x="2" y="4" width="12" height="10" rx="1.5" stroke="currentColor" stroke-width="1.4"/>
        <path d="M4 4V3a1 1 0 011-1h2.5l1.5 2H4z" stroke="currentColor" stroke-width="1.4" fill="none"/>
      </svg>
      <span class="wb-folder-tree__label">{{ t('winterboard.folders.noFolder') }}</span>
    </button>

    <!-- Separator -->
    <div class="wb-folder-tree__separator" />

    <!-- Loading skeleton -->
    <div v-if="loading" class="wb-folder-tree__loading">
      <div v-for="i in 3" :key="i" class="wb-skeleton-pulse wb-folder-tree__skeleton" />
    </div>

    <!-- Folder tree -->
    <template v-else>
      <div
        v-for="folder in folders"
        :key="folder.id"
        class="wb-folder-tree__branch"
      >
        <div
          class="wb-folder-tree__item"
          :class="{
            'wb-folder-tree__item--active': selectedFolderId === folder.id,
            'wb-folder-tree__item--drop': dragOverId === folder.id,
          }"
          @click="$emit('select', folder.id)"
          @mouseenter="hoveredId = folder.id"
          @mouseleave="hoveredId = null"
          @dragover.prevent="onDragOver(folder.id)"
          @dragleave="onDragLeave(folder.id)"
          @drop.prevent="onDrop(folder.id)"
        >
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" class="wb-folder-tree__icon">
            <rect x="2" y="4" width="12" height="10" rx="1.5" stroke="currentColor" stroke-width="1.4"/>
            <path d="M4 4V3a1 1 0 011-1h2.5l1.5 2H4z" stroke="currentColor" stroke-width="1.4" fill="none"/>
          </svg>

          <!-- Inline rename -->
          <input
            v-if="renamingId === folder.id"
            ref="renameInputRef"
            v-model="renameValue"
            class="wb-folder-tree__inline-input"
            @keydown.enter="confirmRename(folder.id)"
            @keydown.escape="cancelRename"
            @blur="confirmRename(folder.id)"
          />
          <span v-else class="wb-folder-tree__label">{{ folder.name }}</span>

          <span class="wb-folder-tree__count">{{ folder.sessions_count }}</span>

          <!-- Actions (hover) -->
          <div v-if="hoveredId === folder.id && renamingId !== folder.id" class="wb-folder-tree__actions">
            <button type="button" class="wb-folder-tree__action" :title="t('winterboard.folders.newSubfolder')" @click.stop="startCreateChild(folder.id)">
              <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M6 2v8M2 6h8" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>
            </button>
            <button type="button" class="wb-folder-tree__action" title="Перейменувати" @click.stop="startRename(folder)">
              <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M8.5 1.5l2 2-7 7H1.5V8.5l7-7z" stroke="currentColor" stroke-width="1.2" stroke-linejoin="round"/></svg>
            </button>
            <button type="button" class="wb-folder-tree__action wb-folder-tree__action--danger" title="Видалити" @click.stop="$emit('delete', folder.id)">
              <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M1.5 3h9M4 3V2a.5.5 0 01.5-.5h3a.5.5 0 01.5.5v1M9.5 3v7a1 1 0 01-1 1h-5a1 1 0 01-1-1V3" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round"/></svg>
            </button>
          </div>
        </div>

        <!-- Inline create child (Level 2) -->
        <div v-if="creatingParentId === folder.id" class="wb-folder-tree__children">
          <div class="wb-folder-tree__item wb-folder-tree__item--child wb-folder-tree__item--creating">
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none" class="wb-folder-tree__icon wb-folder-tree__icon--small">
              <rect x="2" y="3.5" width="10" height="8.5" rx="1.5" stroke="currentColor" stroke-width="1.2"/>
              <path d="M3.5 3.5V2.5a1 1 0 011-1h2l1 2H3.5z" stroke="currentColor" stroke-width="1.2" fill="none"/>
            </svg>
            <input
              ref="createChildInputRef"
              v-model="createChildName"
              class="wb-folder-tree__inline-input"
              :placeholder="t('winterboard.folders.newFolderPlaceholder')"
              @keydown.enter="confirmCreateChild"
              @keydown.escape="cancelCreateChild"
              @blur="confirmCreateChild"
            />
          </div>
        </div>

        <!-- Children (Level 2 nesting) -->
        <div v-if="folder.children?.length" class="wb-folder-tree__children">
          <div
            v-for="child in folder.children"
            :key="child.id"
          >
            <div
              class="wb-folder-tree__item wb-folder-tree__item--child"
              :class="{
                'wb-folder-tree__item--active': selectedFolderId === child.id,
                'wb-folder-tree__item--drop': dragOverId === child.id,
              }"
              @click="$emit('select', child.id)"
              @mouseenter="hoveredId = child.id"
              @mouseleave="hoveredId = null"
              @dragover.prevent="onDragOver(child.id)"
              @dragleave="onDragLeave(child.id)"
              @drop.prevent="onDrop(child.id)"
            >
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none" class="wb-folder-tree__icon wb-folder-tree__icon--small">
                <rect x="2" y="3.5" width="10" height="8.5" rx="1.5" stroke="currentColor" stroke-width="1.2"/>
                <path d="M3.5 3.5V2.5a1 1 0 011-1h2l1 2H3.5z" stroke="currentColor" stroke-width="1.2" fill="none"/>
              </svg>

              <!-- Inline rename -->
              <input
                v-if="renamingId === child.id"
                ref="renameInputRef"
                v-model="renameValue"
                class="wb-folder-tree__inline-input"
                @keydown.enter="confirmRename(child.id)"
                @keydown.escape="cancelRename"
                @blur="confirmRename(child.id)"
              />
              <span v-else class="wb-folder-tree__label">{{ child.name }}</span>

              <span class="wb-folder-tree__count">{{ child.sessions_count }}</span>

              <div v-if="hoveredId === child.id && renamingId !== child.id" class="wb-folder-tree__actions">
                <button type="button" class="wb-folder-tree__action" :title="t('winterboard.folders.newSubfolder')" @click.stop="startCreateChild(child.id)">
                  <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M6 2v8M2 6h8" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>
                </button>
                <button type="button" class="wb-folder-tree__action" title="Перейменувати" @click.stop="startRename(child)">
                  <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M8.5 1.5l2 2-7 7H1.5V8.5l7-7z" stroke="currentColor" stroke-width="1.2" stroke-linejoin="round"/></svg>
                </button>
                <button type="button" class="wb-folder-tree__action wb-folder-tree__action--danger" title="Видалити" @click.stop="$emit('delete', child.id)">
                  <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M1.5 3h9M4 3V2a.5.5 0 01.5-.5h3a.5.5 0 01.5.5v1M9.5 3v7a1 1 0 01-1 1h-5a1 1 0 01-1-1V3" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round"/></svg>
                </button>
              </div>
            </div>

            <!-- Inline create grandchild (Level 3) -->
            <div v-if="creatingParentId === child.id" class="wb-folder-tree__children">
              <div class="wb-folder-tree__item wb-folder-tree__item--grandchild wb-folder-tree__item--creating">
                <svg width="12" height="12" viewBox="0 0 12 12" fill="none" class="wb-folder-tree__icon wb-folder-tree__icon--xs">
                  <rect x="1.5" y="3" width="9" height="7" rx="1" stroke="currentColor" stroke-width="1.1"/>
                  <path d="M3 3V2.2a.8.8 0 01.8-.8h1.7l1 1.6H3z" stroke="currentColor" stroke-width="1.1" fill="none"/>
                </svg>
                <input
                  ref="createChildInputRef"
                  v-model="createChildName"
                  class="wb-folder-tree__inline-input"
                  :placeholder="t('winterboard.folders.newFolderPlaceholder')"
                  @keydown.enter="confirmCreateChild"
                  @keydown.escape="cancelCreateChild"
                  @blur="confirmCreateChild"
                />
              </div>
            </div>

            <!-- Grandchildren (Level 3 nesting) -->
            <div v-if="child.children?.length" class="wb-folder-tree__children">
              <div
                v-for="grandchild in child.children"
                :key="grandchild.id"
                class="wb-folder-tree__item wb-folder-tree__item--grandchild"
                :class="{
                  'wb-folder-tree__item--active': selectedFolderId === grandchild.id,
                  'wb-folder-tree__item--drop': dragOverId === grandchild.id,
                }"
                @click="$emit('select', grandchild.id)"
                @mouseenter="hoveredId = grandchild.id"
                @mouseleave="hoveredId = null"
                @dragover.prevent="onDragOver(grandchild.id)"
                @dragleave="onDragLeave(grandchild.id)"
                @drop.prevent="onDrop(grandchild.id)"
              >
                <svg width="12" height="12" viewBox="0 0 12 12" fill="none" class="wb-folder-tree__icon wb-folder-tree__icon--xs">
                  <rect x="1.5" y="3" width="9" height="7" rx="1" stroke="currentColor" stroke-width="1.1"/>
                  <path d="M3 3V2.2a.8.8 0 01.8-.8h1.7l1 1.6H3z" stroke="currentColor" stroke-width="1.1" fill="none"/>
                </svg>

                <!-- Inline rename -->
                <input
                  v-if="renamingId === grandchild.id"
                  ref="renameInputRef"
                  v-model="renameValue"
                  class="wb-folder-tree__inline-input"
                  @keydown.enter="confirmRename(grandchild.id)"
                  @keydown.escape="cancelRename"
                  @blur="confirmRename(grandchild.id)"
                />
                <span v-else class="wb-folder-tree__label">{{ grandchild.name }}</span>

                <span class="wb-folder-tree__count">{{ grandchild.sessions_count }}</span>

                <div v-if="hoveredId === grandchild.id && renamingId !== grandchild.id" class="wb-folder-tree__actions">
                  <button type="button" class="wb-folder-tree__action" title="Перейменувати" @click.stop="startRename(grandchild)">
                    <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M8.5 1.5l2 2-7 7H1.5V8.5l7-7z" stroke="currentColor" stroke-width="1.2" stroke-linejoin="round"/></svg>
                  </button>
                  <button type="button" class="wb-folder-tree__action wb-folder-tree__action--danger" title="Видалити" @click.stop="$emit('delete', grandchild.id)">
                    <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M1.5 3h9M4 3V2a.5.5 0 01.5-.5h3a.5.5 0 01.5.5v1M9.5 3v7a1 1 0 01-1 1h-5a1 1 0 01-1-1V3" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round"/></svg>
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </template>

    <!-- Inline create -->
    <div v-if="creating" class="wb-folder-tree__item wb-folder-tree__item--creating">
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none" class="wb-folder-tree__icon">
        <rect x="2" y="4" width="12" height="10" rx="1.5" stroke="currentColor" stroke-width="1.4"/>
        <path d="M4 4V3a1 1 0 011-1h2.5l1.5 2H4z" stroke="currentColor" stroke-width="1.4" fill="none"/>
      </svg>
      <input
        ref="createInputRef"
        v-model="createName"
        class="wb-folder-tree__inline-input"
        :placeholder="t('winterboard.folders.newFolderPlaceholder')"
        @keydown.enter="confirmCreate"
        @keydown.escape="cancelCreate"
        @blur="confirmCreate"
      />
    </div>

    <!-- New folder button -->
    <button
      v-if="!creating"
      type="button"
      class="wb-folder-tree__add-btn"
      @click="startCreate"
    >
      <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
        <path d="M7 1v12M1 7h12" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
      </svg>
      {{ t('winterboard.folders.newFolder') }}
    </button>
  </div>
</template>

<script setup lang="ts">
import { ref, nextTick } from 'vue'
import { useI18n } from 'vue-i18n'
import type { BoardFolderTree } from '../../api/winterboardApi'

const props = defineProps<{
  folders: BoardFolderTree[]
  selectedFolderId: number | null
  rootOnly: boolean
  loading: boolean
}>()

const emit = defineEmits<{
  select: [folderId: number | null]
  'select-root': []
  create: [name: string, parentId: number | null]
  rename: [folderId: number, name: string]
  delete: [folderId: number]
  drop: [folderId: number, sessionId: string]
}>()

const { t } = useI18n()

// ─── Hover state ──────────────────────────────────────────────────────────

const hoveredId = ref<number | null>(null)

// ─── Inline create ────────────────────────────────────────────────────────

const creating = ref(false)
const createName = ref('')
const createInputRef = ref<HTMLInputElement | null>(null)

function startCreate() {
  creating.value = true
  createName.value = ''
  nextTick(() => createInputRef.value?.focus())
}

function confirmCreate() {
  const name = createName.value.trim()
  if (name) {
    emit('create', name, null)
  }
  creating.value = false
  createName.value = ''
}

function cancelCreate() {
  creating.value = false
  createName.value = ''
}

// ─── Inline create child (subfolder) ─────────────────────────────────

const creatingParentId = ref<number | null>(null)
const createChildName = ref('')
const createChildInputRef = ref<HTMLInputElement | null>(null)

function startCreateChild(parentId: number) {
  creatingParentId.value = parentId
  createChildName.value = ''
  nextTick(() => {
    const input = createChildInputRef.value
    if (Array.isArray(input)) {
      input[0]?.focus()
    } else {
      input?.focus()
    }
  })
}

function confirmCreateChild() {
  const name = createChildName.value.trim()
  if (name && creatingParentId.value !== null) {
    emit('create', name, creatingParentId.value)
  }
  creatingParentId.value = null
  createChildName.value = ''
}

function cancelCreateChild() {
  creatingParentId.value = null
  createChildName.value = ''
}

// ─── Inline rename ────────────────────────────────────────────────────────

const renamingId = ref<number | null>(null)
const renameValue = ref('')
const renameInputRef = ref<HTMLInputElement | null>(null)

function startRename(folder: { id: number; name: string }) {
  renamingId.value = folder.id
  renameValue.value = folder.name
  nextTick(() => {
    const input = renameInputRef.value
    if (Array.isArray(input)) {
      input[0]?.focus()
      input[0]?.select()
    } else {
      input?.focus()
      input?.select()
    }
  })
}

function confirmRename(folderId: number) {
  if (renamingId.value !== folderId) return
  const name = renameValue.value.trim()
  if (name) {
    emit('rename', folderId, name)
  }
  renamingId.value = null
}

function cancelRename() {
  renamingId.value = null
}

// ─── Drag & drop ──────────────────────────────────────────────────────────

const dragOverId = ref<number | null>(null)

function onDragOver(folderId: number) {
  dragOverId.value = folderId
}

function onDragLeave(folderId: number) {
  if (dragOverId.value === folderId) dragOverId.value = null
}

function onDrop(folderId: number) {
  dragOverId.value = null
  const sessionId = event instanceof DragEvent
    ? (event as DragEvent).dataTransfer?.getData('text/wb-session-id')
    : null
  if (sessionId) {
    emit('drop', folderId, sessionId)
  }
}
</script>

<style scoped>
.wb-folder-tree {
  display: flex;
  flex-direction: column;
  gap: 2px;
  padding: 8px 0;
}

.wb-folder-tree__separator {
  height: 1px;
  background: var(--wb-toolbar-border, #e2e8f0);
  margin: 4px 8px;
}

.wb-folder-tree__item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 7px 12px;
  border: none;
  border-radius: 6px;
  background: none;
  font-size: 13px;
  font-weight: 500;
  color: var(--wb-fg-secondary, #64748b);
  cursor: pointer;
  transition: background 0.1s, color 0.1s;
  text-align: left;
  width: 100%;
  position: relative;
}

.wb-folder-tree__item:hover {
  background: var(--wb-canvas-bg, #f1f5f9);
  color: var(--wb-fg, #0f172a);
}

.wb-folder-tree__item--active {
  background: var(--wb-brand-light, #eff6ff);
  color: var(--wb-brand, #0066ff);
  font-weight: 600;
}

.wb-folder-tree__item--active:hover {
  background: var(--wb-brand-light, #dbeafe);
}

.wb-folder-tree__item--drop {
  background: var(--wb-brand-light, #dbeafe);
  outline: 2px dashed var(--wb-brand, #0066ff);
  outline-offset: -2px;
}

.wb-folder-tree__item--child {
  padding-left: 32px;
}

.wb-folder-tree__item--grandchild {
  padding-left: 52px;
}

.wb-folder-tree__item--creating {
  cursor: default;
}

.wb-folder-tree__icon {
  flex-shrink: 0;
  color: inherit;
}

.wb-folder-tree__icon--small {
  width: 14px;
  height: 14px;
}

.wb-folder-tree__icon--xs {
  width: 12px;
  height: 12px;
}

.wb-folder-tree__label {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.wb-folder-tree__count {
  font-size: 11px;
  color: var(--wb-fg-secondary, #94a3b8);
  min-width: 16px;
  text-align: right;
  flex-shrink: 0;
}

.wb-folder-tree__actions {
  display: flex;
  gap: 2px;
  margin-left: auto;
  flex-shrink: 0;
}

.wb-folder-tree__action {
  width: 22px;
  height: 22px;
  display: flex;
  align-items: center;
  justify-content: center;
  border: none;
  background: none;
  border-radius: 4px;
  color: var(--wb-fg-secondary, #94a3b8);
  cursor: pointer;
  padding: 0;
}

.wb-folder-tree__action:hover {
  background: var(--wb-toolbar-border, #e2e8f0);
  color: var(--wb-fg, #0f172a);
}

.wb-folder-tree__action--danger:hover {
  background: rgba(239, 68, 68, 0.1);
  color: #ef4444;
}

.wb-folder-tree__inline-input {
  flex: 1;
  min-width: 0;
  border: 1px solid var(--wb-brand, #0066ff);
  border-radius: 4px;
  padding: 2px 6px;
  font-size: 13px;
  color: var(--wb-fg, #0f172a);
  background: var(--wb-card-bg, #ffffff);
  outline: none;
}

.wb-folder-tree__add-btn {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 7px 12px;
  margin-top: 4px;
  border: none;
  border-radius: 6px;
  background: none;
  font-size: 13px;
  font-weight: 500;
  color: var(--wb-fg-secondary, #94a3b8);
  cursor: pointer;
  transition: background 0.1s, color 0.1s;
  width: 100%;
  text-align: left;
}

.wb-folder-tree__add-btn:hover {
  background: var(--wb-canvas-bg, #f1f5f9);
  color: var(--wb-brand, #0066ff);
}

.wb-folder-tree__children {
  display: flex;
  flex-direction: column;
  gap: 1px;
}

.wb-folder-tree__loading {
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding: 4px 12px;
}

.wb-folder-tree__skeleton {
  height: 28px;
  border-radius: 6px;
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
}

@keyframes wb-skeleton-shimmer {
  0% { background-position: 200% 0; }
  100% { background-position: -200% 0; }
}
</style>
