<template>
  <div class="wb-grid-button" ref="containerRef">
    <button
      type="button"
      class="wb-grid-button__trigger"
      :class="{ 'wb-grid-button__trigger--active': isGridActive }"
      :title="t('winterboard.grid.toggleGrid')"
      :aria-expanded="isPopupOpen"
      @click="isPopupOpen = !isPopupOpen"
    >
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
        <!-- Grid icon -->
        <rect x="1" y="1" width="6" height="6" rx="0.5" stroke="currentColor" stroke-width="1.2" fill="none"/>
        <rect x="9" y="1" width="6" height="6" rx="0.5" stroke="currentColor" stroke-width="1.2" fill="none"/>
        <rect x="1" y="9" width="6" height="6" rx="0.5" stroke="currentColor" stroke-width="1.2" fill="none"/>
        <rect x="9" y="9" width="6" height="6" rx="0.5" stroke="currentColor" stroke-width="1.2" fill="none"/>
      </svg>
    </button>

    <!-- Popup menu (opens upward) -->
    <Transition name="wb-grid-popup">
      <div v-if="isPopupOpen" class="wb-grid-popup" role="menu">
        <div class="wb-grid-popup__header">
          {{ t('winterboard.grid.backgroundGrid') }}
        </div>
        <button
          v-for="option in gridOptions"
          :key="option.id"
          type="button"
          class="wb-grid-popup__item"
          :class="{ 'wb-grid-popup__item--active': modelValue === option.id }"
          role="menuitem"
          @click="selectGrid(option.id)"
        >
          <span class="wb-grid-popup__preview">
            <svg width="28" height="28" viewBox="0 0 28 28" aria-hidden="true">
              <component :is="() => renderPreview(option.id)" />
            </svg>
          </span>
          <span class="wb-grid-popup__label">{{ t(option.nameKey) }}</span>
          <svg
            v-if="modelValue === option.id"
            class="wb-grid-popup__check"
            width="14" height="14" viewBox="0 0 14 14" fill="none"
          >
            <path d="M3 7l3 3 5-6" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
        </button>
      </div>
    </Transition>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onBeforeUnmount, h } from 'vue'
import { useI18n } from 'vue-i18n'
import { GRID_OPTIONS, type GridType } from '../../composables/useGridOverlay'

const props = defineProps<{
  modelValue: GridType
  isGridActive: boolean
}>()

const emit = defineEmits<{
  'update:modelValue': [value: GridType]
}>()

const { t } = useI18n()

const isPopupOpen = ref(false)
const containerRef = ref<HTMLElement | null>(null)

const gridOptions = GRID_OPTIONS

function selectGrid(type: GridType) {
  emit('update:modelValue', type)
  isPopupOpen.value = false
}

function handleClickOutside(e: MouseEvent) {
  if (containerRef.value && !containerRef.value.contains(e.target as Node)) {
    isPopupOpen.value = false
  }
}

function handleEscape(e: KeyboardEvent) {
  if (e.key === 'Escape') {
    isPopupOpen.value = false
  }
}

onMounted(() => {
  document.addEventListener('mousedown', handleClickOutside)
  document.addEventListener('keydown', handleEscape)
})

onBeforeUnmount(() => {
  document.removeEventListener('mousedown', handleClickOutside)
  document.removeEventListener('keydown', handleEscape)
})

// SVG preview renderers for each grid type
function renderPreview(type: GridType) {
  const c = '#94a3b8' // slate-400
  const bg = '#f8fafc' // slate-50

  switch (type) {
    case 'none':
      return h('g', [
        h('rect', { x: 0, y: 0, width: 28, height: 28, fill: bg, rx: 3 }),
        h('line', { x1: 6, y1: 22, x2: 22, y2: 6, stroke: c, 'stroke-width': 1.5 }),
      ])
    case 'small-grid':
      return h('g', [
        h('rect', { x: 0, y: 0, width: 28, height: 28, fill: bg, rx: 3 }),
        ...[7, 14, 21].flatMap(v => [
          h('line', { x1: v, y1: 1, x2: v, y2: 27, stroke: c, 'stroke-width': 0.5 }),
          h('line', { x1: 1, y1: v, x2: 27, y2: v, stroke: c, 'stroke-width': 0.5 }),
        ]),
      ])
    case 'large-grid':
      return h('g', [
        h('rect', { x: 0, y: 0, width: 28, height: 28, fill: bg, rx: 3 }),
        h('line', { x1: 14, y1: 1, x2: 14, y2: 27, stroke: c, 'stroke-width': 0.5 }),
        h('line', { x1: 1, y1: 14, x2: 27, y2: 14, stroke: c, 'stroke-width': 0.5 }),
      ])
    case 'dots':
      return h('g', [
        h('rect', { x: 0, y: 0, width: 28, height: 28, fill: bg, rx: 3 }),
        ...[7, 14, 21].flatMap(x =>
          [7, 14, 21].map(y =>
            h('circle', { cx: x, cy: y, r: 1, fill: c }),
          ),
        ),
      ])
    case 'ruled':
      return h('g', [
        h('rect', { x: 0, y: 0, width: 28, height: 28, fill: bg, rx: 3 }),
        ...[7, 14, 21].map(y =>
          h('line', { x1: 1, y1: y, x2: 27, y2: y, stroke: c, 'stroke-width': 0.5 }),
        ),
      ])
    case 'coordinate':
      return h('g', [
        h('rect', { x: 0, y: 0, width: 28, height: 28, fill: bg, rx: 3 }),
        ...[7, 21].flatMap(v => [
          h('line', { x1: v, y1: 1, x2: v, y2: 27, stroke: '#e2e8f0', 'stroke-width': 0.3 }),
          h('line', { x1: 1, y1: v, x2: 27, y2: v, stroke: '#e2e8f0', 'stroke-width': 0.3 }),
        ]),
        h('line', { x1: 1, y1: 14, x2: 27, y2: 14, stroke: '#334155', 'stroke-width': 1.2 }),
        h('line', { x1: 14, y1: 1, x2: 14, y2: 27, stroke: '#334155', 'stroke-width': 1.2 }),
        h('polygon', { points: '26,12.5 26,15.5 28,14', fill: '#334155' }),
        h('polygon', { points: '12.5,2 15.5,2 14,0', fill: '#334155' }),
      ])
    default:
      return h('g')
  }
}
</script>

<style scoped>
.wb-grid-button {
  position: relative;
  display: flex;
  align-items: center;
}

.wb-grid-button__trigger {
  width: 28px;
  height: 28px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--wb-bg-secondary, #f8fafc);
  border: 1px solid var(--wb-border, #e2e8f0);
  border-radius: 6px;
  cursor: pointer;
  color: var(--wb-fg-secondary, #64748b);
  transition: background 0.15s ease, color 0.15s ease, border-color 0.15s ease;
}

.wb-grid-button__trigger:hover {
  background: var(--wb-bg-hover, #f1f5f9);
  color: var(--wb-fg, #0f172a);
}

.wb-grid-button__trigger--active {
  background: var(--wb-brand, #2563eb);
  color: #fff;
  border-color: var(--wb-brand, #2563eb);
}

.wb-grid-button__trigger--active:hover {
  background: #1d4ed8;
  border-color: #1d4ed8;
}

/* Popup menu — opens upward */
.wb-grid-popup {
  position: absolute;
  bottom: calc(100% + 8px);
  left: 0;
  width: 220px;
  background: #ffffff;
  border: 1px solid var(--wb-border, #e2e8f0);
  border-radius: 12px;
  box-shadow: 0 8px 30px rgba(0, 0, 0, 0.12), 0 2px 8px rgba(0, 0, 0, 0.06);
  overflow: hidden;
  z-index: 100;
}

.wb-grid-popup__header {
  padding: 10px 14px 6px;
  font-size: 11px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  color: var(--wb-fg-secondary, #94a3b8);
}

.wb-grid-popup__item {
  display: flex;
  align-items: center;
  gap: 10px;
  width: 100%;
  padding: 8px 14px;
  border: none;
  background: transparent;
  cursor: pointer;
  text-align: left;
  transition: background 0.12s ease;
  color: var(--wb-fg, #0f172a);
  font-size: 13px;
}

.wb-grid-popup__item:hover {
  background: var(--wb-bg-hover, #f1f5f9);
}

.wb-grid-popup__item--active {
  background: #eff6ff;
  font-weight: 600;
}

.wb-grid-popup__item--active:hover {
  background: #dbeafe;
}

.wb-grid-popup__preview {
  width: 28px;
  height: 28px;
  flex-shrink: 0;
  border-radius: 4px;
  overflow: hidden;
  border: 1px solid var(--wb-border, #e2e8f0);
}

.wb-grid-popup__label {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.wb-grid-popup__check {
  flex-shrink: 0;
  color: var(--wb-brand, #2563eb);
}

/* Popup transition */
.wb-grid-popup-enter-active {
  transition: opacity 0.15s ease, transform 0.15s ease;
}
.wb-grid-popup-leave-active {
  transition: opacity 0.1s ease, transform 0.1s ease;
}
.wb-grid-popup-enter-from,
.wb-grid-popup-leave-to {
  opacity: 0;
  transform: translateY(4px);
}

/* Last item rounded bottom */
.wb-grid-popup__item:last-child {
  margin-bottom: 4px;
}
</style>
