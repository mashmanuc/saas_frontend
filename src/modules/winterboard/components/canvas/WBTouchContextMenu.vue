<template>
  <Teleport to="body">
    <div
      v-if="visible"
      ref="menuRef"
      class="wb-touch-ctx-menu"
      :style="{ top: `${y}px`, left: `${x}px` }"
      role="menu"
      :aria-label="t('wb.ctx.menu', 'Context menu')"
      @pointerdown.stop
    >
      <button
        class="wb-touch-ctx-menu__item"
        role="menuitem"
        :disabled="!hasSelection"
        @click="handleCopy"
      >
        {{ t('wb.ctx.copy', 'Copy') }}
      </button>
      <button
        class="wb-touch-ctx-menu__item"
        role="menuitem"
        :disabled="!hasClipboard"
        @click="handlePaste"
      >
        {{ t('wb.ctx.paste', 'Paste') }}
      </button>
      <button
        class="wb-touch-ctx-menu__item"
        role="menuitem"
        :disabled="!hasSelection"
        @click="handleDuplicate"
      >
        {{ t('wb.ctx.duplicate', 'Duplicate') }}
      </button>
      <button
        class="wb-touch-ctx-menu__item wb-touch-ctx-menu__item--danger"
        role="menuitem"
        :disabled="!hasSelection"
        @click="handleDelete"
      >
        {{ t('wb.ctx.delete', 'Delete') }}
      </button>
      <button
        class="wb-touch-ctx-menu__item"
        role="menuitem"
        :disabled="!hasSingleSelection"
        @click="handleBringToFront"
      >
        {{ t('wb.ctx.bringToFront', 'Bring to Front') }}
      </button>
      <button
        class="wb-touch-ctx-menu__item"
        role="menuitem"
        :disabled="!hasSingleSelection"
        @click="handleSendToBack"
      >
        {{ t('wb.ctx.sendToBack', 'Send to Back') }}
      </button>
    </div>
    <!-- Backdrop: tap outside closes -->
    <div
      v-if="visible"
      class="wb-touch-ctx-menu__backdrop"
      aria-hidden="true"
      @pointerdown="handleClose"
    />
  </Teleport>
</template>

<script setup lang="ts">
// WBTouchContextMenu — touch context menu with 6 actions for A10 touch parity
// Ref: responsive/prompts/active/DAY12-13_PHASE6.md A10
// Zone: AGENT-A (components/canvas/WBTouchContextMenu.vue — listed in A10 responsibility)

import { ref, computed, onMounted, onBeforeUnmount } from 'vue'
import { useI18n } from 'vue-i18n'
import { useWBStore } from '../../board/state/boardStore'

const props = defineProps<{
  visible: boolean
  x: number
  y: number
}>()

const emit = defineEmits<{
  close: []
}>()

const { t } = useI18n({ useScope: 'global' })
const wbStore = useWBStore()
const menuRef = ref<HTMLElement | null>(null)

// ─── Selection state ─────────────────────────────────────────────────────────

const hasSelection = computed(() => wbStore.selectedIds.length > 0)
const hasSingleSelection = computed(() => wbStore.selectedIds.length === 1)
const hasClipboard = computed(() => wbStore.clipboardAssets.length > 0)

// ─── Actions ─────────────────────────────────────────────────────────────────

function handleCopy(): void {
  wbStore.copySelectedToClipboard()
  handleClose()
}

function handlePaste(): void {
  wbStore.pasteFromClipboard()
  handleClose()
}

function handleDuplicate(): void {
  // Copy then paste in one action (offset already applied in paste)
  wbStore.copySelectedToClipboard()
  wbStore.pasteFromClipboard()
  handleClose()
}

function handleDelete(): void {
  // Delete all selected assets (strokes deletion is handled by keyboard delete in desktop mode)
  const ids = [...wbStore.selectedIds]
  for (const id of ids) {
    wbStore.deleteAsset(id)
  }
  wbStore.selectedIds = []
  handleClose()
}

function handleBringToFront(): void {
  const id = wbStore.selectedIds[0]
  if (id) wbStore.bringToFront(id)
  handleClose()
}

function handleSendToBack(): void {
  const id = wbStore.selectedIds[0]
  if (id) wbStore.sendToBack(id)
  handleClose()
}

function handleClose(): void {
  emit('close')
}

// ─── Keyboard close (Escape) ─────────────────────────────────────────────────

function onKeyDown(e: KeyboardEvent): void {
  if (e.key === 'Escape' && props.visible) handleClose()
}

onMounted(() => {
  document.addEventListener('keydown', onKeyDown)
})
onBeforeUnmount(() => {
  document.removeEventListener('keydown', onKeyDown)
})
</script>

<style scoped>
.wb-touch-ctx-menu {
  position: fixed;
  z-index: 9999;
  background: var(--color-surface, #ffffff);
  border: 1px solid var(--color-border, #e2e8f0);
  border-radius: 10px;
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.14);
  overflow: hidden;
  min-width: 170px;
  user-select: none;
  /* Prevent browser context menu on long-press */
  -webkit-touch-callout: none;
}

.wb-touch-ctx-menu__item {
  display: block;
  width: 100%;
  padding: 12px 18px;
  text-align: left;
  font-size: 15px;
  line-height: 1.3;
  border: none;
  background: transparent;
  color: var(--color-text, #1e293b);
  cursor: pointer;
  transition: background 0.1s;
  /* Touch target: min 44px height (Apple HIG) */
  min-height: 44px;
}

.wb-touch-ctx-menu__item:active,
.wb-touch-ctx-menu__item:hover {
  background: var(--color-surface-hover, #f1f5f9);
}

.wb-touch-ctx-menu__item:disabled {
  opacity: 0.38;
  pointer-events: none;
}

.wb-touch-ctx-menu__item--danger {
  color: var(--color-danger, #ef4444);
}

.wb-touch-ctx-menu__item + .wb-touch-ctx-menu__item {
  border-top: 1px solid var(--color-border-subtle, #f1f5f9);
}

.wb-touch-ctx-menu__backdrop {
  position: fixed;
  inset: 0;
  z-index: 9998;
  background: transparent;
}
</style>
