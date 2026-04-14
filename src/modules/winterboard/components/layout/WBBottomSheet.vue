<!-- WB Responsive: Reusable bottom-sheet drawer for mobile sidebars.
     Pattern from WBToolbarSheet.vue (Phase 2 B4).
     Used for: replay chapters sidebar, replay comments sidebar on mobile. -->
<template>
  <Teleport to="body">
    <Transition name="wb-sheet">
      <div
        v-if="isOpen"
        class="wb-bottom-sheet-backdrop"
        @click.self="emit('close')"
      >
        <div
          ref="sheetEl"
          class="wb-bottom-sheet"
          role="dialog"
          aria-modal="true"
          :aria-label="title"
          :style="{ maxHeight: maxHeight }"
          @keydown.escape="emit('close')"
          @touchstart.passive="onTouchStart"
          @touchmove.passive="onTouchMove"
          @touchend.passive="onTouchEnd"
        >
          <!-- Drag handle -->
          <div class="wb-bottom-sheet__handle" aria-hidden="true">
            <div class="wb-bottom-sheet__handle-bar" />
          </div>

          <!-- Title (optional) -->
          <div v-if="title" class="wb-bottom-sheet__header">
            <h3 class="wb-bottom-sheet__title">{{ title }}</h3>
            <button
              type="button"
              class="wb-bottom-sheet__close"
              :aria-label="t('common.close', 'Закрити')"
              @click="emit('close')"
            >&times;</button>
          </div>

          <!-- Content slot -->
          <div class="wb-bottom-sheet__content">
            <slot />
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup lang="ts">
import { ref, watch, nextTick } from 'vue'
import { useI18n } from 'vue-i18n'

interface Props {
  isOpen?: boolean
  title?: string
  maxHeight?: string
}

const props = withDefaults(defineProps<Props>(), {
  isOpen: false,
  title: '',
  maxHeight: '70vh',
})

const emit = defineEmits<{
  close: []
}>()

const { t } = useI18n({ useScope: 'global' })
const sheetEl = ref<HTMLElement | null>(null)

// Swipe-to-close logic
let _touchStartY = 0
let _touchCurrentY = 0
let _isDragging = false

function onTouchStart(e: TouchEvent): void {
  _touchStartY = e.touches[0].clientY
  _touchCurrentY = _touchStartY
  _isDragging = false
}

function onTouchMove(e: TouchEvent): void {
  _touchCurrentY = e.touches[0].clientY
  const delta = _touchCurrentY - _touchStartY
  // Only start dragging if swiping down and near the top of the sheet
  if (delta > 10) {
    _isDragging = true
    if (sheetEl.value) {
      sheetEl.value.style.transform = `translateY(${Math.max(0, delta)}px)`
    }
  }
}

function onTouchEnd(): void {
  if (_isDragging) {
    const delta = _touchCurrentY - _touchStartY
    if (delta > 100) {
      emit('close')
    }
    if (sheetEl.value) {
      sheetEl.value.style.transform = ''
    }
  }
  _isDragging = false
}

// Focus first focusable on open
watch(() => props.isOpen, async (open) => {
  if (open) {
    await nextTick()
    const focusable = sheetEl.value?.querySelector<HTMLElement>('button:not(:disabled), [tabindex]:not([tabindex="-1"])')
    focusable?.focus()
  }
})
</script>

<style scoped>
.wb-bottom-sheet-backdrop {
  position: fixed;
  inset: 0;
  z-index: var(--wb-z-sheet, 40);
  background: rgba(0, 0, 0, 0.35);
  backdrop-filter: blur(2px);
  display: flex;
  align-items: flex-end;
  justify-content: center;
}

.wb-bottom-sheet {
  width: 100%;
  max-height: 70vh;
  overflow-y: auto;
  background: var(--color-surface, #ffffff);
  border-radius: 16px 16px 0 0;
  padding: 0 0 0;
  padding-bottom: env(safe-area-inset-bottom, 0px);
  box-shadow: 0 -4px 24px rgba(0, 0, 0, 0.12);
  touch-action: pan-y;
  transition: transform 0.15s ease;
}

.wb-bottom-sheet__handle {
  display: flex;
  justify-content: center;
  padding: 10px 0 6px;
  cursor: grab;
}

.wb-bottom-sheet__handle-bar {
  width: 36px;
  height: 4px;
  border-radius: 2px;
  background: var(--color-border, #cbd5e1);
}

.wb-bottom-sheet__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 16px 10px;
  border-bottom: 1px solid var(--color-border, #e2e8f0);
}

.wb-bottom-sheet__title {
  margin: 0;
  font-size: 15px;
  font-weight: 700;
  color: var(--color-text, #0f172a);
}

.wb-bottom-sheet__close {
  background: transparent;
  border: none;
  font-size: 20px;
  color: var(--color-text-muted, #64748b);
  cursor: pointer;
  padding: 4px 8px;
  line-height: 1;
}

.wb-bottom-sheet__content {
  overflow-y: auto;
  max-height: calc(70vh - 80px);
}

/* Slide-up animation (reusing wb-sheet transition name from WBToolbarSheet) */
.wb-sheet-enter-active {
  transition: opacity 0.2s ease;
}
.wb-sheet-enter-active .wb-bottom-sheet {
  transition: transform 0.25s ease;
}
.wb-sheet-leave-active {
  transition: opacity 0.15s ease;
}
.wb-sheet-leave-active .wb-bottom-sheet {
  transition: transform 0.2s ease;
}
.wb-sheet-enter-from {
  opacity: 0;
}
.wb-sheet-enter-from .wb-bottom-sheet {
  transform: translateY(100%);
}
.wb-sheet-leave-to {
  opacity: 0;
}
.wb-sheet-leave-to .wb-bottom-sheet {
  transform: translateY(100%);
}

@media (prefers-reduced-motion: reduce) {
  .wb-sheet-enter-active,
  .wb-sheet-leave-active,
  .wb-sheet-enter-active .wb-bottom-sheet,
  .wb-sheet-leave-active .wb-bottom-sheet {
    transition: none;
  }
}
</style>
