<template>
  <div class="move-replay-dropdown" ref="dropdownRoot">
    <Teleport to="body">
      <div
        v-if="isOpen"
        class="move-replay-dropdown__menu"
        :style="menuStyle"
        data-testid="move-replay-dropdown"
        ref="menuRef"
      >
        <div class="move-replay-dropdown__header">
          {{ t('winterboard.replayList.folders.moveTo') }}
        </div>

        <button
          type="button"
          class="move-replay-dropdown__item"
          :class="{ 'move-replay-dropdown__item--current': currentFolder === null }"
          :disabled="currentFolder === null"
          data-testid="move-replay-to-root"
          @click="selectFolder(null)"
        >
          {{ t('winterboard.replayList.folders.noFolder') }}
        </button>

        <button
          v-for="folder in flatFolders"
          :key="folder.id"
          type="button"
          class="move-replay-dropdown__item"
          :class="{ 'move-replay-dropdown__item--current': currentFolder === folder.id }"
          :style="{ paddingLeft: `${12 + folder.depth * 16}px` }"
          :disabled="currentFolder === folder.id"
          :data-testid="`move-replay-to-${folder.id}`"
          @click="selectFolder(folder.id)"
        >
          📁 {{ folder.name }}
        </button>

        <p v-if="flatFolders.length === 0" class="move-replay-dropdown__empty">
          {{ t('winterboard.replayList.folders.emptyHint') }}
        </p>
      </div>
    </Teleport>
  </div>
</template>

<script setup lang="ts">
// Dropdown з ієрархічним списком ReplayFolder для переміщення Replay.
// Симетрія: MoveAssetDropdown.vue (Library).
//
// Контракт:
//   - Парент рендерить цей компонент через v-if після натискання "Move" у меню.
//   - anchorRect — DOMRect кнопки-тригера з батьківського компонента.
//   - Компонент автоматично відкривається після mount, позиціонується, закривається
//     при виборі папки або click-outside/Escape.

import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import {
  buildReplayFolderTree,
  flattenReplayFolderTree,
  type ReplayFolder,
} from '../../api/replayFoldersApi'

interface Props {
  replayId: string
  currentFolder: string | null
  folders: ReplayFolder[]   // плоский список зі store
  anchorRect: DOMRect | null
}

const props = defineProps<Props>()

const emit = defineEmits<{
  moved: [replayId: string, newFolderId: string | null]
  close: []
}>()

const { t } = useI18n()

const isOpen = ref(false)
const dropdownRoot = ref<HTMLElement | null>(null)
const menuRef = ref<HTMLElement | null>(null)
const menuStyle = ref<Record<string, string>>({})

const flatFolders = computed(() => flattenReplayFolderTree(buildReplayFolderTree(props.folders)))

function open(): void {
  isOpen.value = true
  requestAnimationFrame(updateMenuPosition)
}

function close(): void {
  isOpen.value = false
  emit('close')
}

function updateMenuPosition(): void {
  const rect = props.anchorRect
  if (!rect) return
  const menuWidth = 240
  const menuMaxHeight = 320

  let top = rect.bottom + 4
  let left = rect.right - menuWidth

  if (left < 8) left = 8
  if (left + menuWidth > window.innerWidth - 8) {
    left = window.innerWidth - menuWidth - 8
  }
  if (top + menuMaxHeight > window.innerHeight - 8) {
    top = rect.top - menuMaxHeight - 4
    if (top < 8) top = 8
  }

  menuStyle.value = {
    top: `${top}px`,
    left: `${left}px`,
  }
}

function selectFolder(folderId: string | null): void {
  emit('moved', props.replayId, folderId)
  close()
}

function handleClickOutside(e: MouseEvent): void {
  if (!isOpen.value) return
  const target = e.target as Node
  if (dropdownRoot.value?.contains(target) || menuRef.value?.contains(target)) return
  close()
}

function handleEscape(e: KeyboardEvent): void {
  if (e.key === 'Escape' && isOpen.value) close()
}

onMounted(() => {
  document.addEventListener('click', handleClickOutside)
  document.addEventListener('keydown', handleEscape)
  requestAnimationFrame(open)
})

onBeforeUnmount(() => {
  document.removeEventListener('click', handleClickOutside)
  document.removeEventListener('keydown', handleEscape)
})
</script>

<style scoped>
.move-replay-dropdown {
  display: inline-block;
}

.move-replay-dropdown__menu {
  position: fixed;
  z-index: 60;
  background: var(--card-bg, #fff);
  border: 1px solid var(--border-color, #e5e7eb);
  border-radius: 8px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
  padding: 4px 0;
  min-width: 240px;
  max-height: 320px;
  overflow-y: auto;
}

.move-replay-dropdown__header {
  padding: 8px 12px;
  font-size: 11px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  color: var(--text-secondary, #6b7280);
  border-bottom: 1px solid var(--border-color, #e5e7eb);
  margin-bottom: 4px;
}

.move-replay-dropdown__item {
  width: 100%;
  text-align: left;
  padding: 6px 12px;
  font-size: 13px;
  border: none;
  background: none;
  cursor: pointer;
  color: var(--text-primary, #374151);
  transition: background 0.1s ease;
  display: block;
}

.move-replay-dropdown__item:hover:not(:disabled) {
  background: var(--bg-secondary, #f3f4f6);
}

.move-replay-dropdown__item--current {
  color: var(--accent, #6366f1);
  font-weight: 500;
  cursor: default;
}

.move-replay-dropdown__item:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.move-replay-dropdown__empty {
  padding: 8px 12px;
  margin: 0;
  font-size: 12px;
  color: var(--text-secondary, #94a3b8);
}
</style>
