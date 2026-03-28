<template>
  <div class="move-asset-dropdown" ref="dropdownRoot">
    <!-- Trigger: 📂 button (hidden when externally triggered via anchorRect) -->
    <button
      v-if="!anchorRect"
      type="button"
      class="move-asset-dropdown__trigger"
      :aria-label="t('winterboard.library.moveToFolder')"
      :title="t('winterboard.library.moveToFolder')"
      data-testid="move-asset-btn"
      @click.stop="toggle"
    >
      <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
        <path d="M1.5 4A1.5 1.5 0 013 2.5h2.5l1 1.5H11A1.5 1.5 0 0112.5 5.5v5A1.5 1.5 0 0111 12H3A1.5 1.5 0 011.5 10.5V4z"
          fill="none" stroke="currentColor" stroke-width="1.2" stroke-linejoin="round"/>
        <path d="M7 7v3M5.5 8.5L7 10l1.5-1.5" stroke="currentColor" stroke-width="1.1" stroke-linecap="round" stroke-linejoin="round"/>
      </svg>
    </button>

    <!-- Dropdown menu (Teleport to body) -->
    <Teleport to="body">
      <div
        v-if="isOpen"
        class="move-asset-dropdown__menu"
        :style="menuStyle"
        data-testid="move-dropdown"
        ref="menuRef"
      >
        <div class="move-asset-dropdown__header">
          {{ t('winterboard.library.moveToFolder') }}
        </div>

        <!-- "Без папки" (root) -->
        <button
          type="button"
          class="move-asset-dropdown__item"
          :class="{ 'move-asset-dropdown__item--current': currentFolder === null }"
          :disabled="currentFolder === null"
          @click="selectFolder(null)"
          data-testid="move-to-root"
        >
          {{ t('winterboard.library.noFolder') }}
        </button>

        <!-- Flat folder list with indentation -->
        <button
          v-for="folder in flatFolders"
          :key="folder.id"
          type="button"
          class="move-asset-dropdown__item"
          :class="{ 'move-asset-dropdown__item--current': currentFolder === folder.id }"
          :style="{ paddingLeft: `${12 + folder.depth * 16}px` }"
          :disabled="currentFolder === folder.id"
          @click="selectFolder(folder.id)"
          :data-testid="`move-to-${folder.id}`"
        >
          📁 {{ folder.name }}
        </button>
      </div>
    </Teleport>
  </div>
</template>

<script setup lang="ts">
/**
 * Phase 33 B1: Move Asset Dropdown
 *
 * Dropdown з ієрархічним списком папок для переміщення файлу.
 * Pattern: як MoveToFolderDropdown (knowledge), але для library assets.
 */
import { ref, computed, onMounted, onBeforeUnmount } from 'vue'
import { useI18n } from 'vue-i18n'
import { flattenFolderTree } from '../../utils/flattenFolderTree'
import type { LibraryFolderTree } from '../../types/library'

// ─── Props ───────────────────────────────────────────────────────────────────

interface Props {
  assetId: number
  currentFolder: number | null
  folders: LibraryFolderTree[]
  anchorRect?: DOMRect | null
}

const props = defineProps<Props>()

// ─── Emits ───────────────────────────────────────────────────────────────────

const emit = defineEmits<{
  'moved': [assetId: number, newFolderId: number | null]
  'close': []
}>()

// ─── Composables ─────────────────────────────────────────────────────────────

const { t } = useI18n()

// ─── State ───────────────────────────────────────────────────────────────────

const isOpen = ref(false)
const dropdownRoot = ref<HTMLElement | null>(null)
const menuRef = ref<HTMLElement | null>(null)
const menuStyle = ref<Record<string, string>>({})

// ─── Computed ────────────────────────────────────────────────────────────────

const flatFolders = computed(() => flattenFolderTree(props.folders))

// ─── Methods ─────────────────────────────────────────────────────────────────

function toggle(): void {
  if (isOpen.value) {
    close()
  } else {
    open()
  }
}

function open(): void {
  isOpen.value = true
  // Position menu on next tick after render
  requestAnimationFrame(() => {
    updateMenuPosition()
  })
}

function close(): void {
  isOpen.value = false
  emit('close')
}

function updateMenuPosition(): void {
  // Use anchor rect from parent (card button position) if available
  const rect = props.anchorRect
    ?? dropdownRoot.value?.querySelector('.move-asset-dropdown__trigger')?.getBoundingClientRect()
  if (!rect) return
  const menuWidth = 220
  const menuMaxHeight = 280

  // Position below trigger, aligned to right edge
  let top = rect.bottom + 4
  let left = rect.right - menuWidth

  // Ensure menu stays within viewport
  const viewportWidth = window.innerWidth
  const viewportHeight = window.innerHeight

  if (left < 8) left = 8
  if (left + menuWidth > viewportWidth - 8) {
    left = viewportWidth - menuWidth - 8
  }

  if (top + menuMaxHeight > viewportHeight - 8) {
    // Show above trigger if not enough space below
    top = rect.top - menuMaxHeight - 4
    if (top < 8) top = 8
  }

  menuStyle.value = {
    top: `${top}px`,
    left: `${left}px`,
  }
}

function selectFolder(folderId: number | null): void {
  emit('moved', props.assetId, folderId)
  close()
}

// ─── Click Outside ───────────────────────────────────────────────────────────

function handleClickOutside(e: MouseEvent): void {
  if (!isOpen.value) return
  
  const target = e.target as Node
  if (
    dropdownRoot.value?.contains(target) ||
    menuRef.value?.contains(target)
  ) {
    return
  }
  
  close()
}

// ─── Lifecycle ───────────────────────────────────────────────────────────────

onMounted(() => {
  document.addEventListener('click', handleClickOutside)
  // Auto-open when parent renders via v-if (triggered by card folder icon click)
  requestAnimationFrame(() => {
    open()
  })
})

onBeforeUnmount(() => {
  document.removeEventListener('click', handleClickOutside)
})
</script>

<style scoped>
.move-asset-dropdown {
  display: inline-block;
}

.move-asset-dropdown__trigger {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  padding: 0;
  border: none;
  border-radius: 4px;
  background: none;
  color: var(--wb-text-secondary, #6b7280);
  cursor: pointer;
  transition: background 0.15s ease, color 0.15s ease;
}

.move-asset-dropdown__trigger:hover {
  background: var(--wb-hover-bg, #f3f4f6);
  color: var(--wb-text-primary, #111827);
}

.move-asset-dropdown__trigger:active {
  background: var(--wb-active-bg, #e5e7eb);
}

/* ─── Menu ────────────────────────────────────────────────────────────────── */

.move-asset-dropdown__menu {
  position: fixed;
  z-index: 50;
  background: white;
  border: 1px solid var(--wb-border-color, #e5e7eb);
  border-radius: 8px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
  padding: 4px 0;
  min-width: 220px;
  max-height: 280px;
  overflow-y: auto;
}

.move-asset-dropdown__header {
  padding: 8px 12px;
  font-size: 11px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  color: var(--wb-text-secondary, #6b7280);
  border-bottom: 1px solid var(--wb-border-color, #e5e7eb);
  margin-bottom: 4px;
}

.move-asset-dropdown__item {
  width: 100%;
  text-align: left;
  padding: 6px 12px;
  font-size: 13px;
  border: none;
  background: none;
  cursor: pointer;
  color: var(--wb-text-primary, #374151);
  transition: background 0.1s ease;
  display: block;
}

.move-asset-dropdown__item:hover:not(:disabled) {
  background: var(--wb-hover-bg, #f3f4f6);
}

.move-asset-dropdown__item--current {
  color: #6366f1;
  font-weight: 500;
  cursor: default;
}

.move-asset-dropdown__item:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
</style>
