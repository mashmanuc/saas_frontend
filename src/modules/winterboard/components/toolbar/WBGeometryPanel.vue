<!-- GeoBoard: Geometry shapes panel — appears next to toolbar when geometry tool is active.
     Provides shape selection (triangle, circle, polygon) and polygon sides slider. -->
<template>
  <Transition name="wb-collapse">
    <div v-if="visible" class="wb-geo-panel">
      <div class="wb-geo-panel__title">{{ t('winterboard.geometry.title') }}</div>
      <div class="wb-geo-panel__shapes">
        <button
          v-for="shape in shapes"
          :key="shape.id"
          type="button"
          class="wb-geo-panel__shape-btn"
          :class="{ 'wb-geo-panel__shape-btn--active': selectedShape === shape.id }"
          :aria-label="shape.label"
          :data-tooltip="shape.label"
          @click="handleShapeClick(shape.id)"
        >
          <component :is="shape.icon" />
          <span class="wb-geo-panel__shape-label">{{ shape.label }}</span>
        </button>
      </div>
      <!-- Polygon sides slider -->
      <div v-if="selectedShape === 'polygon'" class="wb-geo-panel__slider">
        <label class="wb-geo-panel__slider-label">
          {{ t('winterboard.geometry.sides') }}: {{ polygonSides }}
        </label>
        <input
          type="range"
          :min="3"
          :max="12"
          :value="polygonSides"
          class="wb-geo-panel__range"
          @input="polygonSides = Number(($event.target as HTMLInputElement).value)"
        />
      </div>
      <div class="wb-geo-panel__hint">
        {{ t('winterboard.geometry.click_hint') }}
      </div>

      <!-- Presets separator -->
      <div class="wb-geo-panel__sep" />
      <div class="wb-geo-panel__title">{{ t('winterboard.geometry.presets') }}</div>
      <div class="wb-geo-panel__shapes">
        <button
          v-for="preset in presetButtons"
          :key="preset.id"
          type="button"
          class="wb-geo-panel__shape-btn wb-geo-panel__shape-btn--preset"
          :disabled="presetPlaying"
          @click="emit('run-preset', preset.id)"
        >
          <component :is="preset.icon" />
          <span class="wb-geo-panel__shape-label">{{ preset.label }}</span>
        </button>
      </div>
    </div>
  </Transition>
</template>

<script setup lang="ts">
import { ref, computed, h } from 'vue'
import { useI18n } from 'vue-i18n'
import type { Geometry2DShape } from '../../types/geometry'

const { t } = useI18n()

interface Props {
  visible: boolean
  presetPlaying?: boolean
}

defineProps<Props>()

const emit = defineEmits<{
  'create-shape': [shape: Geometry2DShape, sides?: number]
  'run-preset': [presetId: string]
}>()

const selectedShape = ref<Geometry2DShape>('triangle')
const polygonSides = ref(6)

// Shape button icons (inline SVGs)
const TriangleIcon = {
  render: () => h('svg', { width: 24, height: 24, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', 'stroke-width': '1.5' }, [
    h('polygon', { points: '12,4 4,20 20,20' }),
  ]),
}
const CircleIcon = {
  render: () => h('svg', { width: 24, height: 24, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', 'stroke-width': '1.5' }, [
    h('circle', { cx: 12, cy: 12, r: 8 }),
  ]),
}
const PolygonIcon = {
  render: () => h('svg', { width: 24, height: 24, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', 'stroke-width': '1.5' }, [
    h('polygon', { points: '12,3 20,9 18,18 6,18 4,9' }),
  ]),
}

const shapes = [
  { id: 'triangle' as Geometry2DShape, label: t('winterboard.geometry.triangle'), icon: TriangleIcon },
  { id: 'circle' as Geometry2DShape, label: t('winterboard.geometry.circle'), icon: CircleIcon },
  { id: 'polygon' as Geometry2DShape, label: t('winterboard.geometry.polygon'), icon: PolygonIcon },
]

function handleShapeClick(shape: Geometry2DShape) {
  selectedShape.value = shape
  emit('create-shape', shape, shape === 'polygon' ? polygonSides.value : undefined)
}

// Preset icons
const PythagorasIcon = {
  render: () => h('svg', { width: 24, height: 24, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', 'stroke-width': '1.5' }, [
    h('polygon', { points: '4,20 4,8 16,20' }),
    h('rect', { x: 1, y: 8, width: 3, height: 12, fill: 'rgba(239,68,68,0.3)', stroke: 'none' }),
    h('rect', { x: 4, y: 20, width: 12, height: 3, fill: 'rgba(34,197,94,0.3)', stroke: 'none' }),
  ]),
}
const BuildIcon = {
  render: () => h('svg', { width: 24, height: 24, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', 'stroke-width': '1.5' }, [
    h('line', { x1: 4, y1: 20, x2: 12, y2: 4, 'stroke-dasharray': '3 2' }),
    h('line', { x1: 12, y1: 4, x2: 20, y2: 20 }),
    h('line', { x1: 20, y1: 20, x2: 4, y2: 20, 'stroke-dasharray': '3 2', opacity: 0.4 }),
  ]),
}

const presetButtons = [
  { id: 'triangle_build', label: t('winterboard.geometry.preset_triangle'), icon: BuildIcon },
  { id: 'pythagoras', label: t('winterboard.geometry.preset_pythagoras'), icon: PythagorasIcon },
]
</script>

<style scoped>
.wb-geo-panel {
  position: absolute;
  left: calc(100% + 8px);
  top: 0;
  background: var(--wb-toolbar-bg, #ffffff);
  border: 1px solid var(--wb-border, #e2e8f0);
  border-radius: 10px;
  padding: 10px;
  min-width: 160px;
  box-shadow: 0 4px 12px rgb(0 0 0 / 0.1);
  z-index: 100;
}

.wb-geo-panel__title {
  font-size: 11px;
  font-weight: 600;
  color: var(--wb-text-secondary, #64748b);
  text-transform: uppercase;
  letter-spacing: 0.05em;
  margin-bottom: 8px;
  padding: 0 2px;
}

.wb-geo-panel__shapes {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.wb-geo-panel__shape-btn {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 8px;
  border: none;
  border-radius: 6px;
  background: transparent;
  cursor: pointer;
  color: var(--wb-text, #1e293b);
  font-size: 13px;
  transition: background 0.15s;
}

.wb-geo-panel__shape-btn:hover {
  background: var(--wb-hover, #f1f5f9);
}

.wb-geo-panel__shape-btn--active {
  background: var(--wb-active, #e0f2fe);
  color: var(--wb-primary, #3b82f6);
}

.wb-geo-panel__shape-label {
  white-space: nowrap;
}

.wb-geo-panel__slider {
  margin-top: 8px;
  padding: 0 2px;
}

.wb-geo-panel__slider-label {
  font-size: 12px;
  color: var(--wb-text-secondary, #64748b);
  display: block;
  margin-bottom: 4px;
}

.wb-geo-panel__range {
  width: 100%;
  accent-color: var(--wb-primary, #3b82f6);
}

.wb-geo-panel__hint {
  margin-top: 8px;
  font-size: 11px;
  color: var(--wb-text-tertiary, #94a3b8);
  padding: 0 2px;
}

.wb-geo-panel__sep {
  height: 1px;
  background: var(--wb-border, #e2e8f0);
  margin: 8px 0;
}

.wb-geo-panel__shape-btn--preset {
  color: var(--wb-text-secondary, #64748b);
  font-size: 12px;
}

.wb-geo-panel__shape-btn--preset:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
</style>
