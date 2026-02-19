<!-- WB5-B2: Quick Color Palette — inline color radio buttons, Kami-style
     Ref: TASK_BOARD_V5.md B2
     Pattern: role="radiogroup" + role="radio" + aria-checked + arrow keys
     8 pen colors / 6 highlighter colors, context-dependent on currentTool
     Last-used color persisted to localStorage per tool type -->
<template>
  <div
    v-if="showPenColors || showHighlighterColors"
    ref="groupEl"
    class="wb-quick-palette"
    role="radiogroup"
    :aria-label="t('winterboard.toolbar.color')"
    @keydown="handleKeydown"
  >
    <!-- Pen colors (pen, line, rectangle, circle, text) -->
    <template v-if="showPenColors">
      <button
        v-for="(color, idx) in penColors"
        :key="color.hex"
        type="button"
        role="radio"
        :aria-checked="color.hex === modelValue"
        :aria-label="t(color.labelKey)"
        :class="['wb-quick-palette__btn', {
          'wb-quick-palette__btn--active': color.hex === modelValue,
          'wb-quick-palette__btn--white': color.hex === '#ffffff',
        }]"
        :style="{ backgroundColor: color.hex }"
        :tabindex="idx === activeIndex ? 0 : -1"
        @click="selectColor(color.hex, idx)"
      />
    </template>

    <!-- Highlighter colors -->
    <template v-if="showHighlighterColors">
      <button
        v-for="(color, idx) in highlighterColors"
        :key="color.hex"
        type="button"
        role="radio"
        :aria-checked="color.hex === modelValue"
        :aria-label="t(color.labelKey)"
        :class="['wb-quick-palette__btn', 'wb-quick-palette__btn--hl', {
          'wb-quick-palette__btn--active': color.hex === modelValue,
        }]"
        :style="{ backgroundColor: color.hex }"
        :tabindex="idx === activeIndex ? 0 : -1"
        @click="selectColor(color.hex, idx)"
      />
    </template>
  </div>
</template>

<script setup lang="ts">
// WB5: WBQuickPalette — inline color radio buttons (Kami-style)
// Ref: TASK_BOARD_V5.md B2

import { ref, computed, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import type { WBToolType } from '../../types/winterboard'

// ─── Props ──────────────────────────────────────────────────────────────────

interface Props {
  modelValue: string
  currentTool: WBToolType
}

const props = defineProps<Props>()

// ─── Emits ──────────────────────────────────────────────────────────────────

const emit = defineEmits<{
  'update:modelValue': [color: string]
}>()

// ─── i18n ───────────────────────────────────────────────────────────────────

const { t } = useI18n()

// ─── Color definitions ──────────────────────────────────────────────────────

interface ColorDef {
  hex: string
  labelKey: string
}

const penColors: ColorDef[] = [
  { hex: '#1e293b', labelKey: 'winterboard.toolbar.color_dark' },
  { hex: '#dc2626', labelKey: 'winterboard.toolbar.color_red' },
  { hex: '#2563eb', labelKey: 'winterboard.toolbar.color_blue' },
  { hex: '#16a34a', labelKey: 'winterboard.toolbar.color_green' },
  { hex: '#9333ea', labelKey: 'winterboard.toolbar.color_purple' },
  { hex: '#ea580c', labelKey: 'winterboard.toolbar.color_orange' },
  { hex: '#0891b2', labelKey: 'winterboard.toolbar.color_teal' },
  { hex: '#ffffff', labelKey: 'winterboard.toolbar.color_white' },
]

const highlighterColors: ColorDef[] = [
  { hex: '#fde047', labelKey: 'winterboard.toolbar.highlighter_yellow' },
  { hex: '#86efac', labelKey: 'winterboard.toolbar.highlighter_green' },
  { hex: '#93c5fd', labelKey: 'winterboard.toolbar.highlighter_blue' },
  { hex: '#fca5a5', labelKey: 'winterboard.toolbar.highlighter_pink' },
  { hex: '#c4b5fd', labelKey: 'winterboard.toolbar.highlighter_purple' },
  { hex: '#fdba74', labelKey: 'winterboard.toolbar.highlighter_orange' },
]

// ─── Tool-dependent visibility ──────────────────────────────────────────────

const PEN_TOOLS: WBToolType[] = ['pen', 'line', 'rectangle', 'circle', 'text']

const showPenColors = computed(() => PEN_TOOLS.includes(props.currentTool))
const showHighlighterColors = computed(() => props.currentTool === 'highlighter')

// ─── Active colors list (reactive to tool switch) ───────────────────────────

const currentColors = computed<ColorDef[]>(() => {
  if (showHighlighterColors.value) return highlighterColors
  if (showPenColors.value) return penColors
  return []
})

// ─── State ──────────────────────────────────────────────────────────────────

const groupEl = ref<HTMLElement | null>(null)

const activeIndex = computed(() => {
  const colors = currentColors.value
  const idx = colors.findIndex((c) => c.hex === props.modelValue)
  return idx !== -1 ? idx : 0
})

// ─── Last-used color persistence ────────────────────────────────────────────

const STORAGE_KEY_PEN = 'wb_last_pen_color'
const STORAGE_KEY_HL = 'wb_last_hl_color'

function selectColor(color: string, idx: number): void {
  emit('update:modelValue', color)
  // Save last used color per tool type
  try {
    if (showPenColors.value) {
      localStorage.setItem(STORAGE_KEY_PEN, color)
    } else {
      localStorage.setItem(STORAGE_KEY_HL, color)
    }
  } catch { /* quota exceeded — ignore */ }
  focusIndex(idx)
}

function restoreLastColor(): void {
  const key = showPenColors.value ? STORAGE_KEY_PEN : STORAGE_KEY_HL
  try {
    const saved = localStorage.getItem(key)
    if (saved) {
      // Verify saved color exists in current palette
      const colors = currentColors.value
      if (colors.some((c) => c.hex === saved)) {
        emit('update:modelValue', saved)
      }
    }
  } catch { /* ignore */ }
}

// Restore last color when switching between pen/highlighter tool modes
let prevIsPen: boolean | null = null
watch(
  () => [showPenColors.value, showHighlighterColors.value] as const,
  ([isPen, isHl]) => {
    const currentIsPen = isPen
    // Only restore on actual tool mode switch, not initial render
    if (prevIsPen !== null && (isPen || isHl) && currentIsPen !== prevIsPen) {
      restoreLastColor()
    }
    prevIsPen = currentIsPen
  },
  { immediate: true },
)

// ─── Keyboard navigation ────────────────────────────────────────────────────

function focusIndex(idx: number): void {
  if (!groupEl.value) return
  const buttons = groupEl.value.querySelectorAll<HTMLElement>('[role="radio"]')
  buttons[idx]?.focus()
}

function handleKeydown(event: KeyboardEvent): void {
  const len = currentColors.value.length
  if (len === 0) return
  let newIdx = activeIndex.value

  switch (event.key) {
    case 'ArrowDown':
    case 'ArrowRight':
      event.preventDefault()
      newIdx = (activeIndex.value + 1) % len
      break
    case 'ArrowUp':
    case 'ArrowLeft':
      event.preventDefault()
      newIdx = (activeIndex.value - 1 + len) % len
      break
    case 'Home':
      event.preventDefault()
      newIdx = 0
      break
    case 'End':
      event.preventDefault()
      newIdx = len - 1
      break
    default:
      return
  }

  const color = currentColors.value[newIdx]
  selectColor(color.hex, newIdx)
}
</script>

<style scoped>
.wb-quick-palette {
  display: flex;
  flex-direction: column;
  gap: 2px;
  padding: 2px 0;
}

.wb-quick-palette__btn {
  width: 24px;
  height: 24px;
  border-radius: 50%;
  border: 2px solid transparent;
  cursor: pointer;
  transition: transform 0.1s ease, border-color 0.1s ease;
  margin: 0 auto;
}

.wb-quick-palette__btn:hover {
  transform: scale(1.15);
}

.wb-quick-palette__btn:focus-visible {
  outline: 2px solid var(--wb-brand, #0066FF);
  outline-offset: 1px;
}

.wb-quick-palette__btn--active {
  border-color: #ffffff;
  box-shadow: 0 0 0 2px var(--wb-brand, #2563eb), 0 1px 3px rgba(0, 0, 0, 0.2);
}

/* White color needs visible border */
.wb-quick-palette__btn--white {
  border-color: #e2e8f0;
}
.wb-quick-palette__btn--white.wb-quick-palette__btn--active {
  border-color: #ffffff;
  box-shadow: 0 0 0 2px var(--wb-brand, #2563eb), inset 0 0 0 1px #e2e8f0;
}

/* Highlighter colors: semi-transparent look */
.wb-quick-palette__btn--hl {
  opacity: 0.8;
}
.wb-quick-palette__btn--hl:hover {
  opacity: 1;
}

/* Reduced motion */
@media (prefers-reduced-motion: reduce) {
  .wb-quick-palette__btn {
    transition: none;
  }
}
</style>
