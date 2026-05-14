<!-- WBColorFlyout — single stroke-style button in toolbar → flyout with thickness + color.
     Replaces both WBThicknessPresets (circles) and WBQuickPalette (vertical strip).
     Thickness shown as horizontal strokes (not dots) for clear visual distinction. -->
<template>
  <div
    ref="rootRef"
    class="wb-color-flyout"
    :class="{ 'wb-color-flyout--open': isOpen }"
  >
    <!-- Trigger: color swatch + thickness line preview -->
    <button
      ref="triggerRef"
      type="button"
      class="wb-toolbar__btn wb-color-flyout__trigger"
      :aria-label="t('winterboard.toolbar.color')"
      :aria-expanded="isOpen"
      :aria-haspopup="true"
      :title="t('winterboard.toolbar.color')"
      @click="toggle"
    >
      <span class="wb-color-flyout__trigger-inner">
        <!-- Color circle -->
        <span
          class="wb-color-flyout__swatch"
          :class="{ 'wb-color-flyout__swatch--white': modelValue === '#ffffff' }"
          :style="{ background: swatchBackground }"
        />
        <!-- Thickness preview line -->
        <span
          class="wb-color-flyout__stroke-preview"
          :style="{
            height: strokePreviewHeight + 'px',
            background: modelValue === '#ffffff' ? '#94a3b8' : modelValue,
          }"
        />
      </span>
      <span class="wb-color-flyout__chevron" aria-hidden="true">›</span>
    </button>

    <!-- Flyout panel -->
    <Transition name="wb-flyout">
      <div
        v-if="isOpen"
        ref="panelRef"
        class="wb-color-flyout__panel"
        role="dialog"
        :aria-label="t('winterboard.toolbar.color')"
        @keydown.escape="close"
      >
        <!-- Arrow pointer -->
        <div class="wb-color-flyout__arrow" aria-hidden="true" />

        <!-- ── Thickness section ─────────────────────────────────────── -->
        <div class="wb-color-flyout__section-label">
          {{ t('winterboard.toolbar.thickness', 'Товщина') }}
        </div>
        <div
          class="wb-color-flyout__strokes"
          role="radiogroup"
          :aria-label="t('winterboard.toolbar.thickness', 'Товщина')"
        >
          <button
            v-for="preset in thicknessPresets"
            :key="preset.size"
            type="button"
            role="radio"
            :aria-checked="currentSize === preset.size"
            :aria-label="t(`winterboard.toolbar.thickness_${preset.name}`, preset.label)"
            class="wb-color-flyout__stroke-btn"
            :class="{ 'wb-color-flyout__stroke-btn--active': currentSize === preset.size }"
            @click="selectSize(preset.size)"
          >
            <span
              class="wb-color-flyout__stroke-line"
              :style="{
                height: preset.visual + 'px',
                background: strokeLineColor,
                borderRadius: preset.visual >= 6 ? '3px' : '1px',
              }"
            />
          </button>
        </div>

        <div class="wb-color-flyout__divider" />

        <!-- ── Color section ─────────────────────────────────────────── -->
        <template v-if="showPenColors">
          <div class="wb-color-flyout__section-label">
            {{ t('winterboard.toolbar.pen_colors', 'Колір') }}
          </div>
          <div
            class="wb-color-flyout__grid"
            role="radiogroup"
            :aria-label="t('winterboard.toolbar.pen_colors', 'Колір')"
          >
            <button
              v-for="color in penColors"
              :key="color.hex"
              type="button"
              role="radio"
              :aria-checked="color.hex === modelValue"
              :aria-label="t(color.labelKey)"
              class="wb-color-flyout__btn"
              :class="{
                'wb-color-flyout__btn--active': color.hex === modelValue,
                'wb-color-flyout__btn--white': color.hex === '#ffffff',
              }"
              :style="{ background: color.hex }"
              @click="selectColor(color.hex)"
            />
            <!-- Custom color picker -->
            <label
              class="wb-color-flyout__btn wb-color-flyout__btn--custom"
              :class="{ 'wb-color-flyout__btn--active': isPenCustomActive }"
              :title="t('winterboard.toolbar.custom_color', 'Свій колір')"
              :style="isPenCustomActive ? { background: modelValue } : {}"
            >
              <input
                ref="penColorInputRef"
                type="color"
                class="wb-color-flyout__color-input"
                :value="penCustomColor"
                @change="onCustomColorChange"
              />
              <span v-if="!isPenCustomActive" class="wb-color-flyout__custom-icon" aria-hidden="true">+</span>
            </label>
          </div>
        </template>

        <template v-if="showHighlighterColors">
          <div class="wb-color-flyout__section-label">
            {{ t('winterboard.toolbar.highlighter_colors', 'Маркер') }}
          </div>
          <div
            class="wb-color-flyout__grid"
            role="radiogroup"
            :aria-label="t('winterboard.toolbar.highlighter_colors', 'Маркер')"
          >
            <button
              v-for="color in highlighterColors"
              :key="color.hex"
              type="button"
              role="radio"
              :aria-checked="color.hex === modelValue"
              :aria-label="t(color.labelKey)"
              class="wb-color-flyout__btn wb-color-flyout__btn--hl"
              :class="{ 'wb-color-flyout__btn--active': color.hex === modelValue }"
              :style="{ background: color.hex }"
              @click="selectColor(color.hex)"
            />
            <!-- Custom color picker for highlighter -->
            <label
              class="wb-color-flyout__btn wb-color-flyout__btn--custom wb-color-flyout__btn--hl"
              :class="{ 'wb-color-flyout__btn--active': isHlCustomActive }"
              :title="t('winterboard.toolbar.custom_color', 'Свій колір')"
              :style="isHlCustomActive ? { background: modelValue } : {}"
            >
              <input
                ref="hlColorInputRef"
                type="color"
                class="wb-color-flyout__color-input"
                :value="hlCustomColor"
                @change="onCustomColorChange"
              />
              <span v-if="!isHlCustomActive" class="wb-color-flyout__custom-icon" aria-hidden="true">+</span>
            </label>
          </div>
        </template>
      </div>
    </Transition>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted, onUnmounted } from 'vue'
import { useI18n } from 'vue-i18n'
import type { WBToolType } from '../../types/winterboard'

interface ColorDef { hex: string; labelKey: string }
interface ThicknessPreset { name: string; label: string; size: number; visual: number }

const props = defineProps<{
  modelValue: string
  currentTool: WBToolType
  currentSize: number
}>()

const emit = defineEmits<{
  'update:modelValue': [color: string]
  'update:currentSize': [size: number]
}>()

const { t } = useI18n()

// ─── Thickness presets (sizes mirror WBThicknessPresets) ─────────────────────

const thicknessPresets: ThicknessPreset[] = [
  { name: 'thin',   label: 'Тонка',   size: 1,  visual: 1.5 },
  { name: 'normal', label: 'Звичайна', size: 3,  visual: 3 },
  { name: 'bold',   label: 'Жирна',   size: 6,  visual: 6 },
  { name: 'marker', label: 'Маркер',  size: 12, visual: 10 },
]

// ─── Color definitions ───────────────────────────────────────────────────────

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

// ─── Tool visibility ─────────────────────────────────────────────────────────

const PEN_TOOLS: WBToolType[] = ['pen', 'line', 'rectangle', 'circle', 'text']
const showPenColors = computed(() => PEN_TOOLS.includes(props.currentTool))
const showHighlighterColors = computed(() => props.currentTool === 'highlighter')

// ─── Trigger visuals ─────────────────────────────────────────────────────────

// Highlighter colors shown semi-transparent in trigger swatch
const swatchBackground = computed(() =>
  showHighlighterColors.value ? props.modelValue + 'cc' : props.modelValue
)

// Thickness preview line: clamp visual between 1.5–10px
const strokePreviewHeight = computed(() => {
  const preset = thicknessPresets.find(p => p.size === props.currentSize)
  if (preset) return preset.visual
  return Math.max(1.5, Math.min(10, props.currentSize * 1.2))
})

// Stroke lines in flyout use current color (or a visible fallback for white)
const strokeLineColor = computed(() =>
  props.modelValue === '#ffffff' ? '#94a3b8' : props.modelValue
)

// ─── Flyout state ─────────────────────────────────────────────────────────────

const isOpen = ref(false)
const rootRef = ref<HTMLElement | null>(null)
const triggerRef = ref<HTMLElement | null>(null)
const panelRef = ref<HTMLElement | null>(null)

function toggle(): void { isOpen.value = !isOpen.value }
function close(): void { isOpen.value = false; triggerRef.value?.focus() }

function onClickOutside(e: MouseEvent): void {
  if (rootRef.value && !rootRef.value.contains(e.target as Node)) {
    isOpen.value = false
  }
}

onMounted(() => document.addEventListener('mousedown', onClickOutside, true))
onUnmounted(() => document.removeEventListener('mousedown', onClickOutside, true))

watch([showPenColors, showHighlighterColors], ([pen, hl]) => {
  if (!pen && !hl) isOpen.value = false
})

// ─── Selection handlers ───────────────────────────────────────────────────────

const STORAGE_KEY_PEN = 'wb_last_pen_color'
const STORAGE_KEY_HL  = 'wb_last_hl_color'

function selectColor(hex: string): void {
  emit('update:modelValue', hex)
  try {
    localStorage.setItem(showPenColors.value ? STORAGE_KEY_PEN : STORAGE_KEY_HL, hex)
  } catch { /* quota */ }
  // keep flyout open so user can also change thickness in one session
}

function selectSize(size: number): void {
  emit('update:currentSize', size)
}

// ─── Custom color picker ──────────────────────────────────────────────────────

const penColorInputRef = ref<HTMLInputElement | null>(null)
const hlColorInputRef = ref<HTMLInputElement | null>(null)

// Last picked custom color for each mode (persisted in localStorage)
function readCustomFromStorage(key: string, presets: ColorDef[], fallback: string): string {
  try {
    const s = localStorage.getItem(key)
    return s && !presets.some(c => c.hex === s) ? s : fallback
  } catch { return fallback }
}
const penCustomColor = ref<string>(readCustomFromStorage(STORAGE_KEY_PEN, penColors, '#ff0000'))
const hlCustomColor = ref<string>(readCustomFromStorage(STORAGE_KEY_HL, highlighterColors, '#fde047'))

// Active when current color isn't one of the preset swatches
const isPenCustomActive = computed(
  () => showPenColors.value && !penColors.some(c => c.hex === props.modelValue)
)
const isHlCustomActive = computed(
  () => showHighlighterColors.value && !highlighterColors.some(c => c.hex === props.modelValue)
)

function onCustomColorChange(e: Event): void {
  const hex = (e.target as HTMLInputElement).value
  if (showPenColors.value) {
    penCustomColor.value = hex
  } else {
    hlCustomColor.value = hex
  }
  selectColor(hex)
}

// ─── Restore last color on tool switch ───────────────────────────────────────

let prevIsPen: boolean | null = null
watch(
  () => [showPenColors.value, showHighlighterColors.value] as const,
  ([isPen, isHl]) => {
    if (prevIsPen !== null && (isPen || isHl) && isPen !== prevIsPen) {
      try {
        const key = isPen ? STORAGE_KEY_PEN : STORAGE_KEY_HL
        const saved = localStorage.getItem(key)
        // Accept both preset and custom (any valid 6-digit hex)
        if (saved && /^#[0-9a-fA-F]{6}$/.test(saved)) emit('update:modelValue', saved)
      } catch { /* ignore */ }
    }
    prevIsPen = isPen
  },
  { immediate: true },
)
</script>

<style scoped>
.wb-color-flyout {
  position: relative;
}

/* ─── Trigger ────────────────────────────────────────────────────────────────── */

.wb-color-flyout__trigger {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 3px;
  padding: 0 4px;
}

.wb-color-flyout__trigger-inner {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 3px;
}

.wb-color-flyout__swatch {
  width: 20px;
  height: 20px;
  border-radius: 50%;
  border: 2px solid rgba(0, 0, 0, 0.12);
  flex-shrink: 0;
  transition: transform 0.1s ease;
}
.wb-color-flyout__swatch--white { border-color: #cbd5e1; }

.wb-color-flyout__stroke-preview {
  width: 20px;
  border-radius: 2px;
  flex-shrink: 0;
  transition: height 0.15s ease, background 0.15s ease;
  min-height: 1.5px;
}

.wb-color-flyout__trigger:hover .wb-color-flyout__swatch,
.wb-color-flyout--open .wb-color-flyout__swatch {
  transform: scale(1.1);
}

.wb-color-flyout__chevron {
  font-size: 13px;
  line-height: 1;
  color: var(--wb-fg-secondary, #475569);
  opacity: 0.55;
  transition: transform 0.15s ease, opacity 0.15s ease;
}
.wb-color-flyout--open .wb-color-flyout__chevron {
  transform: rotate(90deg);
  opacity: 1;
}

/* ─── Flyout panel ───────────────────────────────────────────────────────────── */

.wb-color-flyout__panel {
  position: absolute;
  left: calc(100% + 10px);
  top: 0;
  z-index: 60;
  background: #ffffff;
  border: 1px solid #e2e8f0;
  border-radius: 10px;
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.12), 0 2px 8px rgba(0, 0, 0, 0.06);
  padding: 10px 12px;
  min-width: 172px;
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.wb-color-flyout__arrow {
  position: absolute;
  left: -6px;
  top: 16px;
  width: 10px;
  height: 10px;
  background: #ffffff;
  border-left: 1px solid #e2e8f0;
  border-bottom: 1px solid #e2e8f0;
  transform: rotate(45deg);
}

/* ─── Section label ──────────────────────────────────────────────────────────── */

.wb-color-flyout__section-label {
  font-size: 10px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: #94a3b8;
  line-height: 1;
  margin-top: 2px;
}

/* ─── Divider ────────────────────────────────────────────────────────────────── */

.wb-color-flyout__divider {
  height: 1px;
  background: #f1f5f9;
  margin: 2px 0;
}

/* ─── Thickness strokes ──────────────────────────────────────────────────────── */

.wb-color-flyout__strokes {
  display: flex;
  gap: 4px;
  align-items: center;
}

.wb-color-flyout__stroke-btn {
  flex: 1;
  height: 36px;
  display: flex;
  align-items: center;
  justify-content: center;
  border: 2px solid transparent;
  border-radius: 7px;
  background: transparent;
  cursor: pointer;
  transition: background 0.1s, border-color 0.1s;
  padding: 0 4px;
}

.wb-color-flyout__stroke-btn:hover {
  background: #f1f5f9;
}

.wb-color-flyout__stroke-btn--active {
  background: #dbeafe;
  border-color: #2563eb;
}

.wb-color-flyout__stroke-line {
  width: 100%;
  border-radius: 2px;
  display: block;
  min-height: 1.5px;
  transition: background 0.15s;
}

/* ─── Color grid (4 columns) ─────────────────────────────────────────────────── */

.wb-color-flyout__grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 6px;
}

.wb-color-flyout__btn {
  width: 30px;
  height: 30px;
  border-radius: 50%;
  border: 2px solid transparent;
  cursor: pointer;
  transition: transform 0.1s, border-color 0.1s, box-shadow 0.1s;
}
.wb-color-flyout__btn:hover { transform: scale(1.15); }
.wb-color-flyout__btn--active {
  border-color: #ffffff;
  box-shadow: 0 0 0 2px var(--wb-brand, #2563eb), 0 1px 4px rgba(0,0,0,0.2);
}
.wb-color-flyout__btn--white { border-color: #cbd5e1; }
.wb-color-flyout__btn--white.wb-color-flyout__btn--active {
  border-color: #ffffff;
  box-shadow: 0 0 0 2px var(--wb-brand, #2563eb), inset 0 0 0 1px #e2e8f0;
}
.wb-color-flyout__btn--hl { opacity: 0.85; }
.wb-color-flyout__btn--hl:hover { opacity: 1; }

/* ─── Flyout transition ──────────────────────────────────────────────────────── */

.wb-flyout-enter-active { transition: opacity 0.15s ease, transform 0.15s ease; }
.wb-flyout-leave-active { transition: opacity 0.1s ease, transform 0.1s ease; }
.wb-flyout-enter-from,
.wb-flyout-leave-to { opacity: 0; transform: translateX(-6px) scale(0.97); }

/* ─── Mobile: panel opens upward ─────────────────────────────────────────────── */

@media (max-width: 768px) {
  .wb-color-flyout__panel {
    left: 0;
    top: auto;
    bottom: calc(100% + 10px);
  }
  .wb-color-flyout__arrow {
    left: 14px;
    top: auto;
    bottom: -6px;
    transform: rotate(-135deg);
  }
  .wb-flyout-enter-from,
  .wb-flyout-leave-to { opacity: 0; transform: translateY(6px) scale(0.97); }
}

@media (prefers-reduced-motion: reduce) {
  .wb-flyout-enter-active,
  .wb-flyout-leave-active { transition: opacity 0.1s ease; }
  .wb-flyout-enter-from,
  .wb-flyout-leave-to { transform: none; }
}

/* ─── Custom color picker button ─────────────────────────────────────────────── */

.wb-color-flyout__btn--custom {
  background: conic-gradient(
    from 0deg,
    #ff0000, #ff8000, #ffff00, #00cc00, #00cccc, #0000ff, #cc00cc, #ff0000
  );
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
}

/* Transparent overlay so the full button area triggers the color picker */
.wb-color-flyout__color-input {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  opacity: 0;
  cursor: pointer;
  border: none;
  padding: 0;
}

.wb-color-flyout__custom-icon {
  font-size: 15px;
  font-weight: 700;
  line-height: 1;
  color: #ffffff;
  text-shadow: 0 0 3px rgba(0, 0, 0, 0.55), 0 1px 2px rgba(0, 0, 0, 0.35);
  pointer-events: none;
  position: relative; /* above the input overlay */
  z-index: 1;
}
</style>
