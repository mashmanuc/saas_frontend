<!-- WB: Sticky note color picker — 6 color swatches in 3x2 grid
     Ref: TASK_BOARD_V5.md B9.2
     a11y: role="menu", Escape closes, backdrop click closes
     Teleport to body to avoid z-index issues -->
<template>
  <Teleport to="body">
    <Transition name="wb-picker-fade">
      <div
        v-if="visible"
        class="wb-sticky-picker"
        :style="pickerStyle"
        role="menu"
        :aria-label="t('winterboard.sticky.change_color')"
        @keydown.escape="emit('close')"
      >
        <button
          v-for="color in STICKY_COLORS"
          :key="color.name"
          type="button"
          class="wb-sticky-picker__swatch"
          :class="{ 'wb-sticky-picker__swatch--active': color.bg === currentColor }"
          :style="{ background: color.bg }"
          role="menuitem"
          :aria-label="t(`winterboard.sticky.color_${color.name}`)"
          @click="emit('select-color', color.bg)"
        >
          <!-- Checkmark for active color -->
          <svg
            v-if="color.bg === currentColor"
            class="wb-sticky-picker__check"
            width="14"
            height="14"
            viewBox="0 0 14 14"
            fill="none"
            stroke="#1e293b"
            stroke-width="2"
          >
            <polyline points="3,7 6,10 11,4" />
          </svg>
        </button>
      </div>
    </Transition>

    <!-- Backdrop -->
    <div
      v-if="visible"
      class="wb-sticky-picker-backdrop"
      @click="emit('close')"
    />
  </Teleport>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { STICKY_COLORS } from '../../types/winterboard'

const { t } = useI18n()

// ─── Props ──────────────────────────────────────────────────────────────────

interface Props {
  visible: boolean
  x: number
  y: number
  currentColor: string
}

const props = withDefaults(defineProps<Props>(), {
  visible: false,
  x: 0,
  y: 0,
  currentColor: '#fde047',
})

// ─── Emits ──────────────────────────────────────────────────────────────────

const emit = defineEmits<{
  'select-color': [color: string]
  close: []
}>()

// ─── Computed ───────────────────────────────────────────────────────────────

const pickerStyle = computed(() => ({
  left: `${props.x}px`,
  top: `${props.y}px`,
}))
</script>

<style scoped>
.wb-sticky-picker {
  position: fixed;
  z-index: 10001;
  display: grid;
  grid-template-columns: repeat(3, 32px);
  gap: 6px;
  padding: 8px;
  background: #ffffff;
  border-radius: 8px;
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.15);
  border: 1px solid #e2e8f0;
}

.wb-sticky-picker__swatch {
  width: 32px;
  height: 32px;
  border-radius: 6px;
  border: 2px solid transparent;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: transform 0.1s, border-color 0.1s;
}

.wb-sticky-picker__swatch:hover {
  transform: scale(1.1);
}

.wb-sticky-picker__swatch--active {
  border-color: #1e293b;
}

.wb-sticky-picker__swatch:focus-visible {
  outline: 2px solid #3b82f6;
  outline-offset: 2px;
}

.wb-sticky-picker__check {
  pointer-events: none;
}

.wb-sticky-picker-backdrop {
  position: fixed;
  inset: 0;
  z-index: 10000;
}

/* Fade transition */
.wb-picker-fade-enter-active {
  transition: opacity 0.1s ease;
}
.wb-picker-fade-leave-active {
  transition: opacity 0.08s ease;
}
.wb-picker-fade-enter-from,
.wb-picker-fade-leave-to {
  opacity: 0;
}

/* Reduced motion (LAW-22) */
@media (prefers-reduced-motion: reduce) {
  .wb-sticky-picker__swatch {
    transition: none;
  }
  .wb-picker-fade-enter-active,
  .wb-picker-fade-leave-active {
    transition: none;
  }
}
</style>
