<template>
  <!-- Фільтри й папки — рядок вкладок над сіткою замість окремої колонки
       (візуальний розбір «Матеріалів» 2026-09-22, п. 7). Той самий контракт
       подій, що в LibraryFolderTree: select / create / rename / delete / drop. -->
  <div class="lib-tabs">
    <nav class="lib-tabs__row" :aria-label="t('winterboard.library.folders')">
      <button
        v-for="f in filters"
        :key="String(f.id)"
        type="button"
        class="lib-tabs__tab"
        :class="{
          'lib-tabs__tab--active': selectedId === f.id,
          'lib-tabs__tab--dragover': f.droppable && dragOverId === f.id,
        }"
        :aria-current="selectedId === f.id ? 'true' : undefined"
        @click="emit('select', f.id)"
        @dragover.prevent="f.droppable && onDragOver(f.id, $event)"
        @dragleave="onDragLeave(f.id)"
        @drop.prevent="f.droppable && onDrop(f.id, $event)"
      >{{ f.label }}</button>

      <span v-if="rootFolders.length || editable" class="lib-tabs__sep" aria-hidden="true" />

      <template v-for="folder in rootFolders" :key="folder.id">
        <input
          v-if="renamingId === folder.id"
          ref="inputRef"
          v-model="draft"
          type="text"
          maxlength="255"
          class="lib-tabs__input"
          @keydown.enter="commitRename"
          @keydown.escape="cancelEdit"
          @blur="commitRename"
        />
        <FolderChip
          v-else
          :folder="folder"
          :active="activeRootId === folder.id"
          :dragover="dragOverId === folder.id"
          :editable="editable"
          @select="emit('select', folder.id)"
          @menu="(a) => onFolderMenu(folder, a)"
          @dragover="(e) => onDragOver(folder.id, e)"
          @dragleave="onDragLeave(folder.id)"
          @drop="(e) => onDrop(folder.id, e)"
        />
      </template>

      <input
        v-if="editable && creatingParent === ROOT"
        ref="inputRef"
        v-model="draft"
        type="text"
        maxlength="255"
        class="lib-tabs__input"
        :placeholder="t('winterboard.library.folderName')"
        @keydown.enter="commitCreate"
        @keydown.escape="cancelEdit"
        @blur="commitCreate"
      />
      <button
        v-else-if="editable"
        type="button"
        class="lib-tabs__new"
        @click="startCreate(ROOT)"
      >+ {{ t('winterboard.library.newFolder') }}</button>
    </nav>

    <!-- Підпапки поточної папки — другий рядок (глибше — через «хлібні крихти»). -->
    <nav
      v-if="selectedFolder && (subFolders.length || creatingParent === selectedFolder.id)"
      class="lib-tabs__row lib-tabs__row--sub"
      :aria-label="t('winterboard.library.subfolders')"
    >
      <template v-for="folder in subFolders" :key="folder.id">
        <input
          v-if="renamingId === folder.id"
          ref="inputRef"
          v-model="draft"
          type="text"
          maxlength="255"
          class="lib-tabs__input"
          @keydown.enter="commitRename"
          @keydown.escape="cancelEdit"
          @blur="commitRename"
        />
        <FolderChip
          v-else
          :folder="folder"
          :active="false"
          :dragover="dragOverId === folder.id"
          :editable="editable"
          small
          @select="emit('select', folder.id)"
          @menu="(a) => onFolderMenu(folder, a)"
          @dragover="(e) => onDragOver(folder.id, e)"
          @dragleave="onDragLeave(folder.id)"
          @drop="(e) => onDrop(folder.id, e)"
        />
      </template>
      <input
        v-if="creatingParent === selectedFolder.id"
        ref="inputRef"
        v-model="draft"
        type="text"
        maxlength="255"
        class="lib-tabs__input"
        :placeholder="t('winterboard.library.createChildPlaceholder')"
        @keydown.enter="commitCreate"
        @keydown.escape="cancelEdit"
        @blur="commitCreate"
      />
    </nav>
  </div>
</template>

<script setup lang="ts">
import { computed, defineComponent, h, nextTick, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { FAVORITES_ID, RECENT_ID, PASTED_ID, ARCHIVED_ID } from './LibraryFolderTree.vue'
import { isAssetDrag, getAssetDragData } from '../../utils/dragHelpers'
import type { LibraryFolderTree as FolderNode } from '../../types/library'

const ROOT = -999

const props = withDefaults(defineProps<{
  folders: FolderNode[]
  selectedId: number | null
  editable?: boolean
}>(), { editable: false })

const emit = defineEmits<{
  select: [id: number | null]
  create: [name: string, parentId: number | null]
  rename: [id: number, newName: string]
  delete: [id: number, name: string]
  drop: [data: { assetId: number; folderId: number | null }]
}>()

const { t } = useI18n()

const filters = computed(() => [
  { id: null, label: t('winterboard.library.allTab'), droppable: true },
  { id: FAVORITES_ID, label: t('winterboard.library.favorites'), droppable: false },
  { id: RECENT_ID, label: t('winterboard.library.recent'), droppable: false },
  { id: PASTED_ID, label: t('winterboard.library.storage.pasted'), droppable: false },
  { id: ARCHIVED_ID, label: t('winterboard.library.archive.title'), droppable: false },
] as Array<{ id: number | null; label: string; droppable: boolean }>)

const rootFolders = computed(() => props.folders)

function pathTo(nodes: FolderNode[], id: number): FolderNode[] | null {
  for (const n of nodes) {
    if (n.id === id) return [n]
    const sub = pathTo(n.children, id)
    if (sub) return [n, ...sub]
  }
  return null
}

const selectedPath = computed(() =>
  props.selectedId !== null && props.selectedId > 0 ? pathTo(props.folders, props.selectedId) : null,
)
const selectedFolder = computed(() => selectedPath.value?.[selectedPath.value.length - 1] ?? null)
const activeRootId = computed(() => selectedPath.value?.[0]?.id ?? null)
const subFolders = computed(() => selectedFolder.value?.children ?? [])

// ── Створення / перейменування (як у дереві, інлайн) ──
const creatingParent = ref<number | null>(null)
const renamingId = ref<number | null>(null)
const draft = ref('')
const inputRef = ref<HTMLInputElement | HTMLInputElement[] | null>(null)

function focusInput(select = false): void {
  nextTick(() => {
    const el = Array.isArray(inputRef.value) ? inputRef.value[0] : inputRef.value
    el?.focus()
    if (select) el?.select()
  })
}
function startCreate(parent: number): void {
  renamingId.value = null
  creatingParent.value = parent
  draft.value = ''
  focusInput()
}
function cancelEdit(): void {
  creatingParent.value = null
  renamingId.value = null
  draft.value = ''
}
function commitCreate(): void {
  if (creatingParent.value === null) return
  const name = draft.value.trim()
  const parent = creatingParent.value === ROOT ? null : creatingParent.value
  cancelEdit()
  if (name) emit('create', name, parent)
}
function commitRename(): void {
  if (renamingId.value === null) return
  const id = renamingId.value
  const name = draft.value.trim()
  cancelEdit()
  if (name) emit('rename', id, name)
}

function onFolderMenu(folder: FolderNode, action: 'rename' | 'child' | 'delete'): void {
  if (action === 'rename') {
    creatingParent.value = null
    renamingId.value = folder.id
    draft.value = folder.name
    focusInput(true)
  } else if (action === 'child') {
    emit('select', folder.id)
    startCreate(folder.id)
  } else {
    emit('delete', folder.id, folder.name)
  }
}

// ── Перетягування файлу на папку (як у дереві; віртуальні — ні) ──
const dragOverId = ref<number | null | false>(false)
function onDragOver(id: number | null, e: DragEvent): void {
  if (isAssetDrag(e)) dragOverId.value = id
}
function onDragLeave(id: number | null): void {
  if (dragOverId.value === id) dragOverId.value = false
}
function onDrop(id: number | null, e: DragEvent): void {
  dragOverId.value = false
  const assetId = getAssetDragData(e)
  if (assetId !== null) emit('drop', { assetId, folderId: id })
}

// ── Чіп папки: назва, кількість, «…» (меню дій) ──
const FolderChip = defineComponent({
  props: {
    folder: { type: Object as () => FolderNode, required: true },
    active: Boolean,
    dragover: Boolean,
    editable: Boolean,
    small: Boolean,
  },
  emits: ['select', 'menu', 'dragover', 'dragleave', 'drop'],
  setup(p, { emit: e }) {
    const open = ref(false)
    const close = () => {
      open.value = false
      window.removeEventListener('pointerdown', outside, true)
      window.removeEventListener('keydown', onKey)
    }
    function onKey(ev: KeyboardEvent) { if (ev.key === 'Escape') close() }
    const root = ref<HTMLElement | null>(null)
    function outside(ev: Event) { if (!root.value?.contains(ev.target as Node)) close() }
    function toggle(ev: Event) {
      ev.stopPropagation()
      open.value = !open.value
      if (open.value) {
        window.addEventListener('pointerdown', outside, true)
        window.addEventListener('keydown', onKey)
      } else close()
    }
    const item = (a: string, label: string, danger = false) => h('button', {
      type: 'button', role: 'menuitem',
      class: ['lib-tabs__menu-item', danger && 'lib-tabs__menu-item--danger'],
      onClick: (ev: Event) => { ev.stopPropagation(); close(); e('menu', a) },
    }, label)
    return () => h('span', {
      ref: root,
      class: ['lib-tabs__chip', p.active && 'lib-tabs__chip--active', p.dragover && 'lib-tabs__chip--dragover', p.small && 'lib-tabs__chip--small'],
      onDragover: (ev: DragEvent) => { ev.preventDefault(); e('dragover', ev) },
      onDragleave: () => e('dragleave'),
      onDrop: (ev: DragEvent) => { ev.preventDefault(); e('drop', ev) },
    }, [
      h('button', {
        type: 'button', class: 'lib-tabs__chip-main',
        'aria-label': p.folder.assets_count ? `${p.folder.name} (${p.folder.assets_count})` : p.folder.name,
        'aria-current': p.active ? 'true' : undefined,
        onClick: () => e('select'),
      }, [
        h('span', { class: 'lib-tabs__chip-icon', 'aria-hidden': 'true' }, '▭'),
        h('span', { class: 'lib-tabs__chip-name' }, p.folder.name),
        p.folder.assets_count ? h('span', { class: 'lib-tabs__chip-count' }, String(p.folder.assets_count)) : null,
      ]),
      p.editable ? h('button', {
        type: 'button', class: 'lib-tabs__chip-more',
        'aria-label': t('winterboard.library.folderActions'), title: t('winterboard.library.folderActions'),
        'aria-haspopup': 'menu', 'aria-expanded': open.value, onClick: toggle,
      }, '⋯') : null,
      open.value ? h('div', { class: 'lib-tabs__menu', role: 'menu' }, [
        item('child', t('winterboard.library.createChild')),
        item('rename', t('winterboard.library.renameFolder')),
        item('delete', t('winterboard.library.deleteFolder'), true),
      ]) : null,
    ])
  },
})
</script>

<style scoped>
.lib-tabs {
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.lib-tabs__row {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 4px 2px;
  border-bottom: 1px solid var(--wb-toolbar-border, #e2e8f0);
}
.lib-tabs__row--sub {
  border-bottom: 0;
  gap: 6px;
}
.lib-tabs__tab {
  position: relative;
  padding: 9px 12px;
  border: 0;
  background: none;
  font-size: 13px;
  color: var(--wb-fg-secondary, #475569);
  cursor: pointer;
  border-radius: 6px 6px 0 0;
}
.lib-tabs__tab:hover { color: var(--wb-fg, #0f172a); }
.lib-tabs__tab--active {
  color: var(--wb-brand, #0f766e);
  font-weight: 600;
}
.lib-tabs__tab--active::after,
.lib-tabs__chip--active::after {
  content: '';
  position: absolute;
  left: 8px;
  right: 8px;
  bottom: -1px;
  height: 2px;
  border-radius: 2px;
  background: var(--wb-brand, #0f766e);
}
.lib-tabs__tab--dragover,
.lib-tabs__chip--dragover {
  background: var(--wb-brand-soft, #e6f4ef);
}
.lib-tabs__sep {
  width: 1px;
  height: 18px;
  margin: 0 8px;
  background: var(--wb-toolbar-border, #e2e8f0);
}
.lib-tabs__new {
  padding: 6px 10px;
  border: 1px dashed var(--wb-toolbar-border, #cbd5e1);
  border-radius: 8px;
  background: none;
  font-size: 12px;
  color: var(--wb-fg-secondary, #64748b);
  cursor: pointer;
  margin-left: 4px;
}
.lib-tabs__new:hover { color: var(--wb-brand, #0f766e); border-color: var(--wb-brand, #0f766e); }
.lib-tabs__input {
  width: 160px;
  padding: 5px 8px;
  font-size: 13px;
  border: 1px solid var(--wb-brand, #0f766e);
  border-radius: 8px;
  outline: none;
}
</style>

<style>
/* Чіп рендериться функцією (h) — scoped-атрибут на нього не лягає. */
.lib-tabs__chip {
  position: relative;
  display: inline-flex;
  align-items: center;
  border-radius: 6px 6px 0 0;
}
.lib-tabs__chip--small {
  border: 1px solid var(--wb-toolbar-border, #e2e8f0);
  border-radius: 8px;
}
.lib-tabs__chip-main {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 9px 4px 9px 12px;
  border: 0;
  background: none;
  font-size: 13px;
  color: var(--wb-fg-secondary, #475569);
  cursor: pointer;
}
.lib-tabs__chip--small .lib-tabs__chip-main { padding: 5px 4px 5px 10px; font-size: 12.5px; }
.lib-tabs__chip:not(.lib-tabs__chip--small) .lib-tabs__chip-main:only-child { padding-right: 12px; }
.lib-tabs__chip-main:hover { color: var(--wb-fg, #0f172a); }
.lib-tabs__chip--active .lib-tabs__chip-main { color: var(--wb-brand, #0f766e); font-weight: 600; }
.lib-tabs__chip-icon { font-size: 12px; opacity: 0.7; }
.lib-tabs__chip-count {
  min-width: 18px;
  padding: 0 5px;
  border-radius: 9px;
  background: var(--wb-canvas-bg, #eef2f1);
  font-size: 11px;
  line-height: 18px;
  text-align: center;
  color: var(--wb-fg-secondary, #64748b);
}
.lib-tabs__chip-more {
  padding: 4px 8px;
  border: 0;
  background: none;
  font-size: 14px;
  color: var(--wb-fg-secondary, #94a3b8);
  cursor: pointer;
  border-radius: 6px;
}
.lib-tabs__chip-more:hover { color: var(--wb-fg, #0f172a); background: var(--wb-canvas-bg, #f1f5f9); }
.lib-tabs__menu {
  position: absolute;
  top: calc(100% + 4px);
  left: 0;
  z-index: 50;
  min-width: 190px;
  padding: 4px;
  background: #fff;
  border: 1px solid var(--wb-toolbar-border, #e2e8f0);
  border-radius: 10px;
  box-shadow: 0 10px 30px rgba(15, 23, 42, 0.14);
}
.lib-tabs__menu-item {
  display: block;
  width: 100%;
  padding: 8px 10px;
  border: 0;
  border-radius: 6px;
  background: none;
  font-size: 13px;
  text-align: left;
  color: var(--wb-fg, #0f172a);
  cursor: pointer;
}
.lib-tabs__menu-item:hover { background: var(--wb-canvas-bg, #f1f5f9); }
.lib-tabs__menu-item--danger { color: #b91c1c; }
</style>
