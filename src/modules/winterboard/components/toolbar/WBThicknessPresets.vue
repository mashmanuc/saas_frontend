<!-- WB5: Quick thickness presets — inline radio buttons, no popover
     Ref: TASK_BOARD_V5.md B1
     Pattern: role="radiogroup" + role="radio" + aria-checked + arrow keys
     4 presets: thin(1), normal(3), bold(6), marker(12) -->
<template>
  <div
    ref="groupEl"
    class="wb-thickness-presets"
    role="radiogroup"
    :aria-label="t('winterboard.toolbar.thickness')"
    @keydown="handleKeydown"
  >
    <button
      v-for="(preset, idx) in presets"
      :key="preset.name"
      type="button"
      role="radio"
      :aria-checked="isActive(preset.size)"
      :aria-label="t(`winterboard.toolbar.thickness_${preset.name}`)"
      :class="['wb-thickness-btn', { 'wb-thickness-btn--active': isActive(preset.size) }]"
      :tabindex="idx === activeIndex ? 0 : -1"
      @click="select(preset.size, idx)"
    >
      <span
        class="wb-thickness-dot"
        :style="dotStyle(preset.size)"
        aria-hidden="true"
      />
    </button>
  </div>
</template>

<script setup lang="ts">
// WB5: WBThicknessPresets — inline thickness radio buttons
// Ref: TASK_BOARD_V5.md B1

import { ref, computed } from 'vue'
import { useI18n } from 'vue-i18n'

// ─── Props ──────────────────────────────────────────────────────────────────

interface Props {
  modelValue: number
  currentColor?: string
}

const props = withDefaults(defineProps<Props>(), {
  currentColor: '#1e293b',
})

// ─── Emits ──────────────────────────────────────────────────────────────────

const emit = defineEmits<{
  'update:modelValue': [size: number]
}>()

// ─── i18n ───────────────────────────────────────────────────────────────────

const { t } = useI18n()

// ─── Presets ────────────────────────────────────────────────────────────────

export interface ThicknessPreset {
  name: string
  size: number
}

const presets: ThicknessPreset[] = [
  { name: 'thin', size: 1 },
  { name: 'normal', size: 3 },
  { name: 'bold', size: 6 },
  { name: 'marker', size: 12 },
]

// ─── State ──────────────────────────────────────────────────────────────────

const groupEl = ref<HTMLElement | null>(null)

const activeIndex = computed(() => {
  const idx = presets.findIndex((p) => p.size === props.modelValue)
  // If current size doesn't match any preset, highlight closest
  if (idx !== -1) return idx
  let closest = 0
  let minDiff = Infinity
  for (let i = 0; i < presets.length; i++) {
    const diff = Math.abs(presets[i].size - props.modelValue)
    if (diff < minDiff) {
      minDiff = diff
      closest = i
    }
  }
  return closest
})

// ─── Methods ────────────────────────────────────────────────────────────────

function isActive(size: number): boolean {
  return props.modelValue === size
}

function dotStyle(size: number): Record<string, string> {
  // Clamp visual dot between 4px and 16px for display
  const visualSize = Math.max(4, Math.min(16, size * 1.4))
  return {
    width: `${visualSize}px`,
    height: `${visualSize}px`,
    backgroundColor: props.currentColor,
  }
}

function select(size: number, idx: number): void {
  emit('update:modelValue', size)
  focusIndex(idx)
}

function focusIndex(idx: number): void {
  if (!groupEl.value) return
  const buttons = groupEl.value.querySelectorAll<HTMLElement>('[role="radio"]')
  buttons[idx]?.focus()
}

function handleKeydown(event: KeyboardEvent): void {
  const len = presets.length
  let newIdx = activeIndex.value

  switch (event.key) {
    case 'ArrowRight':
    case 'ArrowDown':
      event.preventDefault()
      newIdx = (activeIndex.value + 1) % len
      break
    case 'ArrowLeft':
    case 'ArrowUp':
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

  emit('update:modelValue', presets[newIdx].size)
  focusIndex(newIdx)
}
</script>

<style scoped>
.wb-thickness-presets {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 2px;
}

.wb-thickness-btn {
  width: 44px;
  height: 36px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: transparent;
  border: 2px solid transparent;
  border-radius: 8px;
  cursor: pointer;
  transition: background 0.15s ease, border-color 0.15s ease;
}

.wb-thickness-btn:hover {
  background: var(--wb-btn-hover, #f1f5f9);
}

.wb-thickness-btn:focus-visible {
  outline: 2px solid var(--wb-brand, #0066FF);
  outline-offset: -2px;
}

.wb-thickness-btn--active {
  background: var(--wb-brand-light, #dbeafe);
  border-color: var(--wb-brand, #2563eb);
}

.wb-thickness-btn--active:hover {
  background: var(--wb-brand-light, #dbeafe);
}

.wb-thickness-dot {
  border-radius: 50%;
  transition: width 0.1s ease, height 0.1s ease;
  flex-shrink: 0;
}

/* Reduced motion */
@media (prefers-reduced-motion: reduce) {
  .wb-thickness-btn,
  .wb-thickness-dot {
    transition: none;
  }
}
</style>
