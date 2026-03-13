<template>
  <nav class="wb-folder-tree" :aria-label="t('winterboard.library.folders')">
    <!-- All files (root) -->
    <button
      type="button"
      class="wb-folder-tree__item"
      :class="{ 'wb-folder-tree__item--active': selectedId === null }"
      :aria-current="selectedId === null ? 'true' : undefined"
      @click="emit('select', null)"
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
    <div v-if="flatNodes.length > 0" class="wb-folder-tree__divider" role="separator" />

    <!-- Folders -->
    <button
      v-for="{ folder, depth } in flatNodes"
      :key="folder.id"
      type="button"
      class="wb-folder-tree__item wb-folder-tree__item--folder"
      :class="{ 'wb-folder-tree__item--active': selectedId === folder.id }"
      :style="{ paddingLeft: `${8 + depth * 14}px` }"
      :aria-current="selectedId === folder.id ? 'true' : undefined"
      @click="emit('select', folder.id)"
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
      <span v-if="folder.assets_count > 0" class="wb-folder-tree__count">
        {{ folder.assets_count }}
      </span>
    </button>

    <!-- Empty folders message -->
    <p v-if="flatNodes.length === 0 && !props.loading" class="wb-folder-tree__empty">
      {{ t('winterboard.library.noFolders') }}
    </p>

    <!-- Loading -->
    <div v-if="props.loading" class="wb-folder-tree__loading">
      <div v-for="i in 3" :key="i" class="wb-skeleton-pulse wb-folder-tree__skeleton" />
    </div>
  </nav>
</template>

<script lang="ts">
export const FAVORITES_ID = -1
export const RECENT_ID = -2
</script>

<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import type { LibraryFolderTree as FolderTreeNode } from '../../types/library'

// ─── Props & Emits ────────────────────────────────────────────────────────────

interface Props {
  folders: FolderTreeNode[]
  selectedId: number | null
  loading?: boolean
}

const props = defineProps<Props>()

const emit = defineEmits<{
  select: [id: number | null]
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
