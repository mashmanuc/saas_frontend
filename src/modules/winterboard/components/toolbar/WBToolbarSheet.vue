<!-- WB Responsive Phase 2 B4: Bottom sheet for color/thickness/actions
     Ref: winterboard_dev/responsive/PHASE2.md B4
     Opens on tap of active tool or color/size indicator in mobile variant.
     Contains: thickness presets, color palette, actions (undo/redo/clear/lock).
     a11y: role="dialog", aria-modal, focus trap, Escape to close. -->
<template>
  <Teleport to="body">
    <Transition name="wb-sheet">
      <div
        v-if="isOpen"
        class="wb-toolbar-sheet-backdrop"
        @click.self="emit('close')"
      >
        <div
          ref="sheetEl"
          class="wb-toolbar-sheet"
          role="dialog"
          aria-modal="true"
          :aria-label="t('winterboard.toolbar.sheetTitle')"
          @keydown.escape="emit('close')"
        >
          <!-- Drag handle -->
          <div class="wb-toolbar-sheet__handle" aria-hidden="true">
            <div class="wb-toolbar-sheet__handle-bar" />
          </div>

          <!-- Thickness section -->
          <div
            v-if="showThickness"
            class="wb-toolbar-sheet__section"
            role="group"
            :aria-label="t('winterboard.toolbar.thickness_section')"
          >
            <span class="wb-toolbar-sheet__label">{{ t('winterboard.toolbar.thickness_section') }}</span>
            <WBThicknessPresets
              :model-value="currentSize"
              :current-color="currentColor"
              @update:model-value="handleSizeChange"
            />
          </div>

          <!-- Color section -->
          <div
            v-if="showColor"
            class="wb-toolbar-sheet__section"
            role="group"
            :aria-label="t('winterboard.toolbar.color_section')"
          >
            <span class="wb-toolbar-sheet__label">{{ t('winterboard.toolbar.color_section') }}</span>
            <WBQuickPalette
              :model-value="currentColor"
              :current-tool="currentTool"
              @update:model-value="handleColorChange"
            />
          </div>

          <!-- Actions section -->
          <div
            class="wb-toolbar-sheet__section wb-toolbar-sheet__actions"
            role="group"
            :aria-label="t('winterboard.toolbar.actions')"
          >
            <button
              type="button"
              class="wb-toolbar-sheet__action-btn"
              :disabled="!canUndo"
              @click="emit('undo')"
            >
              {{ t('winterboard.tools.undo') }}
            </button>
            <button
              type="button"
              class="wb-toolbar-sheet__action-btn"
              :disabled="!canRedo"
              @click="emit('redo')"
            >
              {{ t('winterboard.tools.redo') }}
            </button>
            <button
              type="button"
              class="wb-toolbar-sheet__action-btn wb-toolbar-sheet__action-btn--danger"
              :disabled="!canClearPage"
              @click="emit('clear-page-request')"
            >
              {{ t('winterboard.clear.button') }}
            </button>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup lang="ts">
// WB Responsive Phase 2 B4: WBToolbarSheet
// Ref: winterboard_dev/responsive/PHASE2.md B4

import { ref, computed, watch, nextTick, onUnmounted } from 'vue'
import { useI18n } from 'vue-i18n'
import type { WBToolType } from '../../types/winterboard'
import WBThicknessPresets from './WBThicknessPresets.vue'
import WBQuickPalette from './WBQuickPalette.vue'

interface Props {
  isOpen?: boolean
  currentTool?: WBToolType
  currentColor?: string
  currentSize?: number
  canUndo?: boolean
  canRedo?: boolean
  canClearPage?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  isOpen: false,
  currentTool: 'pen',
  currentColor: '#000000',
  currentSize: 2,
  canUndo: false,
  canRedo: false,
  canClearPage: false,
})

const emit = defineEmits<{
  close: []
  'color-change': [color: string]
  'size-change': [size: number]
  undo: []
  redo: []
  'clear-page-request': []
}>()

const { t } = useI18n()
const sheetEl = ref<HTMLElement | null>(null)

// Show thickness/color only for relevant tools
const THICKNESS_TOOLS: WBToolType[] = ['pen', 'highlighter', 'line', 'rectangle', 'circle']
const COLOR_TOOLS: WBToolType[] = ['pen', 'highlighter', 'line', 'rectangle', 'circle', 'text']

const showThickness = computed(() => THICKNESS_TOOLS.includes(props.currentTool))
const showColor = computed(() => COLOR_TOOLS.includes(props.currentTool))

function handleSizeChange(size: number) {
  emit('size-change', size)
}

function handleColorChange(color: string) {
  emit('color-change', color)
}

// Focus trap: auto-focus first focusable when opened
watch(() => props.isOpen, async (open) => {
  if (open) {
    await nextTick()
    const firstBtn = sheetEl.value?.querySelector<HTMLElement>('button:not(:disabled)')
    firstBtn?.focus()
  }
})
</script>

<style scoped>
.wb-toolbar-sheet-backdrop {
  position: fixed;
  inset: 0;
  z-index: 100;
  background: rgba(0, 0, 0, 0.3);
  display: flex;
  align-items: flex-end;
  justify-content: center;
}

.wb-toolbar-sheet {
  width: 100%;
  max-width: 480px;
  max-height: 40vh;
  overflow-y: auto;
  background: var(--wb-toolbar-bg, #ffffff);
  border-radius: 16px 16px 0 0;
  padding: 8px 16px 16px;
  padding-bottom: calc(16px + env(safe-area-inset-bottom, 0px));
  box-shadow: 0 -4px 24px rgba(0, 0, 0, 0.12);
}

.wb-toolbar-sheet__handle {
  display: flex;
  justify-content: center;
  padding: 8px 0 12px;
}

.wb-toolbar-sheet__handle-bar {
  width: 32px;
  height: 4px;
  border-radius: 2px;
  background: var(--wb-toolbar-border, #cbd5e1);
}

.wb-toolbar-sheet__section {
  margin-bottom: 16px;
}

.wb-toolbar-sheet__label {
  display: block;
  font-size: 12px;
  font-weight: 600;
  color: var(--wb-fg-secondary, #64748b);
  text-transform: uppercase;
  letter-spacing: 0.05em;
  margin-bottom: 8px;
}

.wb-toolbar-sheet__actions {
  display: flex;
  gap: 8px;
}

.wb-toolbar-sheet__action-btn {
  flex: 1;
  height: 44px;
  border: 1px solid var(--wb-toolbar-border, #e2e8f0);
  border-radius: 8px;
  background: transparent;
  font-size: 14px;
  font-weight: 500;
  color: var(--wb-fg, #0f172a);
  cursor: pointer;
  touch-action: manipulation;
}

.wb-toolbar-sheet__action-btn:disabled {
  opacity: 0.35;
  cursor: not-allowed;
}

.wb-toolbar-sheet__action-btn:hover:not(:disabled) {
  background: var(--wb-btn-hover, #f1f5f9);
}

.wb-toolbar-sheet__action-btn--danger {
  color: #dc2626;
  border-color: #fecaca;
}

.wb-toolbar-sheet__action-btn--danger:hover:not(:disabled) {
  background: #fee2e2;
}

/* Sheet slide-up animation */
.wb-sheet-enter-active {
  transition: opacity 0.2s ease, transform 0.25s ease;
}
.wb-sheet-leave-active {
  transition: opacity 0.15s ease, transform 0.2s ease;
}
.wb-sheet-enter-from {
  opacity: 0;
}
.wb-sheet-enter-from .wb-toolbar-sheet {
  transform: translateY(100%);
}
.wb-sheet-leave-to {
  opacity: 0;
}
.wb-sheet-leave-to .wb-toolbar-sheet {
  transform: translateY(100%);
}

@media (prefers-reduced-motion: reduce) {
  .wb-sheet-enter-active,
  .wb-sheet-leave-active {
    transition: none;
  }
}
</style>
