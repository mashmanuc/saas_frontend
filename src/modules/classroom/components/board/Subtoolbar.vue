<template>
  <Transition name="slide">
    <div
      v-if="visible"
      class="subtoolbar"
      role="toolbar"
      :aria-label="$t('classroom.tools.options')"
    >
      <!-- Thickness options -->
      <div class="subtoolbar__section">
        <span class="subtoolbar__label">{{ $t('classroom.tools.thickness') }}</span>
        <div class="thickness-options">
          <button
            v-for="t in thicknessOptions"
            :key="t.value"
            class="thickness-btn"
            :class="{ 'thickness-btn--active': thickness === t.value }"
            :aria-pressed="thickness === t.value"
            :title="t.label"
            @click="$emit('thickness-change', t.value)"
          >
            <span
              class="thickness-btn__dot"
              :style="{ width: `${t.value * 2}px`, height: `${t.value * 2}px` }"
            />
          </button>
        </div>
      </div>

      <!-- Color presets -->
      <div class="subtoolbar__section">
        <span class="subtoolbar__label">{{ $t('classroom.tools.color') }}</span>
        <div class="color-options">
          <button
            v-for="c in colorPresets"
            :key="c"
            class="color-btn"
            :class="{ 'color-btn--active': color === c }"
            :style="{ '--btn-color': c }"
            :aria-pressed="color === c"
            :title="c"
            @click="$emit('color-change', c)"
          >
            <span class="color-btn__swatch" />
          </button>
          <!-- Color picker -->
          <label class="color-picker-label">
            <input
              type="color"
              class="color-picker-input"
              :value="color"
              @input="$emit('color-change', ($event.target as HTMLInputElement).value)"
            />
            <span class="color-picker-icon">+</span>
          </label>
        </div>
      </div>

      <!-- Eraser size (shown only for eraser tool) -->
      <div v-if="tool === 'eraser'" class="subtoolbar__section">
        <span class="subtoolbar__label">{{ $t('classroom.tools.eraserSize') }}</span>
        <div class="eraser-options">
          <button
            v-for="s in eraserSizes"
            :key="s.value"
            class="eraser-btn"
            :class="{ 'eraser-btn--active': thickness === s.value }"
            :aria-pressed="thickness === s.value"
            :title="s.label"
            @click="$emit('thickness-change', s.value)"
          >
            {{ s.label }}
          </button>
        </div>
      </div>
    </div>
  </Transition>
</template>

<script setup lang="ts">
interface Props {
  visible?: boolean
  tool?: string
  thickness?: number
  color?: string
}

withDefaults(defineProps<Props>(), {
  visible: false,
  tool: 'pen',
  thickness: 4,
  color: '#111111',
})

defineEmits<{
  'thickness-change': [value: number]
  'color-change': [value: string]
}>()

// ТЗ v0.28: Thickness 1/2/4/8 px
const thicknessOptions = [
  { value: 1, label: '1px' },
  { value: 2, label: '2px' },
  { value: 4, label: '4px' },
  { value: 8, label: '8px' },
]

// ТЗ v0.28: Color presets
const colorPresets = [
  '#111111', // Black
  '#22c55e', // Green
  '#e879f9', // Pink
  '#2563eb', // Blue
  '#eab308', // Yellow
]

// ТЗ v0.28: Eraser sizes 8/12/20
const eraserSizes = [
  { value: 8, label: 'S' },
  { value: 12, label: 'M' },
  { value: 20, label: 'L' },
]
</script>

<style scoped>
/* Subtoolbar - ТЗ v0.28: праворуч від Toolbar, відступ 8px, ширина 180px */
.subtoolbar {
  position: absolute;
  left: 56px; /* 48px toolbar + 8px gap */
  top: 8px;
  width: 180px;
  padding: 12px;
  background: var(--color-bg, #ffffff);
  border: 1px solid var(--color-border, #e2e8f0);
  border-radius: var(--radius-lg, 12px);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
  z-index: 20;
}

.subtoolbar__section {
  margin-bottom: 12px;
}

.subtoolbar__section:last-child {
  margin-bottom: 0;
}

.subtoolbar__label {
  display: block;
  font-size: 0.75rem;
  font-weight: 500;
  color: var(--color-fg-secondary, #64748b);
  margin-bottom: 8px;
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

/* Thickness buttons */
.thickness-options {
  display: flex;
  gap: 4px;
}

.thickness-btn {
  width: 36px;
  height: 36px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--color-bg-secondary, #f8fafc);
  border: 1px solid var(--color-border, #e2e8f0);
  border-radius: var(--radius-md, 8px);
  cursor: pointer;
  transition: all 0.15s ease;
}

.thickness-btn:hover {
  background: var(--color-bg-hover, #f1f5f9);
}

.thickness-btn--active {
  background: var(--color-brand-light, #dbeafe);
  border-color: var(--color-brand, #2563eb);
}

.thickness-btn__dot {
  border-radius: 50%;
  background: var(--color-fg, #0f172a);
}

.thickness-btn--active .thickness-btn__dot {
  background: var(--color-brand, #2563eb);
}

/* Color buttons */
.color-options {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
}

.color-btn {
  width: 28px;
  height: 28px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: transparent;
  border: 2px solid transparent;
  border-radius: 50%;
  cursor: pointer;
  transition: all 0.15s ease;
}

.color-btn:hover {
  transform: scale(1.1);
}

.color-btn--active {
  border-color: var(--color-fg, #0f172a);
}

.color-btn__swatch {
  width: 20px;
  height: 20px;
  border-radius: 50%;
  background: var(--btn-color);
  box-shadow: inset 0 0 0 1px rgba(0, 0, 0, 0.1);
}

/* Color picker */
.color-picker-label {
  width: 28px;
  height: 28px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: linear-gradient(135deg, #ff0000, #00ff00, #0000ff);
  border: 2px solid var(--color-border, #e2e8f0);
  border-radius: 50%;
  cursor: pointer;
  transition: all 0.15s ease;
}

.color-picker-label:hover {
  transform: scale(1.1);
}

.color-picker-input {
  position: absolute;
  width: 1px;
  height: 1px;
  opacity: 0;
  pointer-events: none;
}

.color-picker-icon {
  font-size: 14px;
  font-weight: 600;
  color: white;
  text-shadow: 0 1px 2px rgba(0, 0, 0, 0.3);
}

/* Eraser buttons */
.eraser-options {
  display: flex;
  gap: 4px;
}

.eraser-btn {
  flex: 1;
  padding: 6px 8px;
  background: var(--color-bg-secondary, #f8fafc);
  border: 1px solid var(--color-border, #e2e8f0);
  border-radius: var(--radius-md, 8px);
  font-size: 0.75rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.15s ease;
}

.eraser-btn:hover {
  background: var(--color-bg-hover, #f1f5f9);
}

.eraser-btn--active {
  background: var(--color-brand-light, #dbeafe);
  border-color: var(--color-brand, #2563eb);
  color: var(--color-brand, #2563eb);
}

/* Transition */
.slide-enter-active,
.slide-leave-active {
  transition: all 0.2s ease;
}

.slide-enter-from,
.slide-leave-to {
  opacity: 0;
  transform: translateX(-8px);
}
</style>
