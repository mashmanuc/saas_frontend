<script setup lang="ts">
// TASK F10: PriceRangeSlider component
import { ref, watch, computed } from 'vue'

const props = withDefaults(
  defineProps<{
    min?: number
    max?: number
    minValue: number | null
    maxValue: number | null
    step?: number
    currency?: string
  }>(),
  {
    min: 0,
    max: 200,
    step: 5,
    currency: '$',
  }
)

const emit = defineEmits<{
  'update:minValue': [value: number | null]
  'update:maxValue': [value: number | null]
  change: [min: number | null, max: number | null]
}>()

const localMin = ref(props.minValue ?? props.min)
const localMax = ref(props.maxValue ?? props.max)

watch(
  () => props.minValue,
  (val) => {
    localMin.value = val ?? props.min
  }
)

watch(
  () => props.maxValue,
  (val) => {
    localMax.value = val ?? props.max
  }
)

const minPercent = computed(() => {
  return ((localMin.value - props.min) / (props.max - props.min)) * 100
})

const maxPercent = computed(() => {
  return ((localMax.value - props.min) / (props.max - props.min)) * 100
})

const handleMinChange = (e: Event) => {
  const value = Number((e.target as HTMLInputElement).value)
  if (value <= localMax.value) {
    localMin.value = value
    emitChange()
  }
}

const handleMaxChange = (e: Event) => {
  const value = Number((e.target as HTMLInputElement).value)
  if (value >= localMin.value) {
    localMax.value = value
    emitChange()
  }
}

const emitChange = () => {
  const minVal = localMin.value === props.min ? null : localMin.value
  const maxVal = localMax.value === props.max ? null : localMax.value
  emit('update:minValue', minVal)
  emit('update:maxValue', maxVal)
  emit('change', minVal, maxVal)
}
</script>

<template>
  <div class="price-range-slider">
    <div class="slider-labels">
      <span>{{ currency }}{{ localMin }}</span>
      <span>{{ currency }}{{ localMax }}</span>
    </div>

    <div class="slider-track">
      <div
        class="slider-range"
        :style="{
          left: `${minPercent}%`,
          width: `${maxPercent - minPercent}%`,
        }"
      />
      <input
        type="range"
        :min="min"
        :max="max"
        :step="step"
        :value="localMin"
        class="slider-input slider-min"
        @input="handleMinChange"
      />
      <input
        type="range"
        :min="min"
        :max="max"
        :step="step"
        :value="localMax"
        class="slider-input slider-max"
        @input="handleMaxChange"
      />
    </div>

    <div class="input-fields">
      <div class="input-group">
        <span class="input-prefix">{{ currency }}</span>
        <input
          type="number"
          :min="min"
          :max="localMax"
          :value="localMin"
          @change="handleMinChange"
        />
      </div>
      <span class="separator">—</span>
      <div class="input-group">
        <span class="input-prefix">{{ currency }}</span>
        <input
          type="number"
          :min="localMin"
          :max="max"
          :value="localMax"
          @change="handleMaxChange"
        />
      </div>
    </div>
  </div>
</template>

<style scoped>
.price-range-slider {
  padding: 8px 0;
}

.slider-labels {
  display: flex;
  justify-content: space-between;
  font-size: 13px;
  color: var(--text-muted);
  margin-bottom: 8px;
}

.slider-track {
  position: relative;
  height: 6px;
  background: var(--border-color);
  border-radius: 3px;
  margin: 16px 0;
}

.slider-range {
  position: absolute;
  height: 100%;
  background: var(--accent-primary);
  border-radius: 3px;
}

.slider-input {
  position: absolute;
  width: 100%;
  height: 6px;
  background: transparent;
  pointer-events: none;
  -webkit-appearance: none;
  appearance: none;
  top: 0;
}

.slider-input::-webkit-slider-thumb {
  -webkit-appearance: none;
  appearance: none;
  width: 18px;
  height: 18px;
  background: var(--surface-card);
  border: 2px solid var(--accent-primary);
  border-radius: 50%;
  cursor: pointer;
  pointer-events: auto;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.15);
}

.slider-input::-moz-range-thumb {
  width: 18px;
  height: 18px;
  background: var(--surface-card);
  border: 2px solid var(--accent-primary);
  border-radius: 50%;
  cursor: pointer;
  pointer-events: auto;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.15);
}

.input-fields {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-top: 12px;
}

.input-group {
  flex: 1;
  display: flex;
  align-items: center;
  border: 1px solid var(--border-color);
  border-radius: 6px;
  overflow: hidden;
}

.input-prefix {
  padding: 8px 0 8px 10px;
  color: var(--text-muted);
  font-size: 14px;
}

.input-group input {
  flex: 1;
  border: none;
  padding: 8px 10px 8px 4px;
  font-size: 14px;
  width: 100%;
  outline: none;
}

.input-group:focus-within {
  border-color: var(--accent-primary);
  box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
}

.separator {
  color: var(--text-muted);
}
</style>
