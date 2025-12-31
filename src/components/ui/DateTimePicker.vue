<template>
  <div class="date-time-picker" v-bind="attrs">
    <label v-if="label" :for="dateInputId" class="field-label">
      {{ label }}
      <span v-if="required" class="required">*</span>
    </label>

    <div class="picker-grid">
      <input
        :id="dateInputId"
        v-model="dateValue"
        type="date"
        class="field-input"
        :min="minDate"
        :max="maxDate"
        :required="required"
        :disabled="disabled"
        @change="handleDateChange"
      />

      <div class="time-select">
        <label :for="hourSelectId" class="sr-only">{{ hourLabel }}</label>
        <select
          :id="hourSelectId"
          v-model="hourValue"
          class="field-select"
          :disabled="disabled || !dateValue"
        >
          <option v-for="hour in hourOptions" :key="hour" :value="hour">
            {{ hour }}
          </option>
        </select>
      </div>

      <div class="time-select">
        <label :for="minuteSelectId" class="sr-only">{{ minuteLabel }}</label>
        <select
          :id="minuteSelectId"
          v-model="minuteValue"
          class="field-select"
          :disabled="disabled || !dateValue"
        >
          <option v-for="minute in minuteOptions" :key="minute" :value="minute">
            {{ minute }}
          </option>
        </select>
      </div>
    </div>

    <p v-if="hint" class="field-hint">{{ hint }}</p>
    <p v-if="error" class="field-error">{{ error }}</p>
  </div>
</template>

<script setup lang="ts">
import { computed, nextTick, ref, useAttrs, watch } from 'vue'

defineOptions({
  name: 'DateTimePicker',
  inheritAttrs: false,
})

const props = withDefaults(
  defineProps<{
    modelValue: string
    label?: string
    hint?: string
    error?: string
    min?: string
    max?: string
    required?: boolean
    disabled?: boolean
    stepMinutes?: number
    hourLabel?: string
    minuteLabel?: string
  }>(),
  {
    modelValue: '',
    label: '',
    hint: '',
    error: '',
    min: '',
    max: '',
    required: false,
    disabled: false,
    stepMinutes: 5,
    hourLabel: 'Hour',
    minuteLabel: 'Minutes',
  }
)

const emit = defineEmits<{
  (e: 'update:modelValue', value: string): void
}>()

const attrs = useAttrs()

const hourOptions = Array.from({ length: 24 }, (_, i) => String(i).padStart(2, '0'))
const dateInputId = `dtp-date-${Math.random().toString(36).slice(2)}`
const hourSelectId = `dtp-hour-${Math.random().toString(36).slice(2)}`
const minuteSelectId = `dtp-minute-${Math.random().toString(36).slice(2)}`

const minDate = computed(() => props.min?.split('T')[0] || '')
const maxDate = computed(() => props.max?.split('T')[0] || '')

const normalizedStep = computed(() => {
  const value = Number(props.stepMinutes) || 5
  if (value <= 0) return 5
  if (60 % value !== 0) return 5
  return value
})

const minuteOptions = computed(() => {
  const options: string[] = []
  for (let i = 0; i < 60; i += normalizedStep.value) {
    options.push(String(i).padStart(2, '0'))
  }
  return options
})

const minConstraint = computed(() => {
  if (!props.min) return null
  const [datePart, timePart] = props.min.split('T')
  if (!datePart || !timePart) return null
  const [hours = '00', minutes = '00'] = timePart.split(':')
  return {
    date: datePart,
    hours: hours.slice(0, 2).padStart(2, '0'),
    minutes: normalizeMinute(minutes),
  }
})

const dateValue = ref('')
const hourValue = ref('00')
const minuteValue = ref(minuteOptions.value[0] || '00')

let isSyncing = false

function parseModelValue(value: string) {
  if (!value) {
    dateValue.value = ''
    hourValue.value = '00'
    minuteValue.value = minuteOptions.value[0] || '00'
    return
  }

  const [datePart, timePart] = value.split('T')
  if (datePart) {
    dateValue.value = datePart
  }

  if (timePart) {
    const [hourPart = '00', minutePart = '00'] = timePart.split(':')
    hourValue.value = hourPart.slice(0, 2).padStart(2, '0')
    minuteValue.value = normalizeMinute(minutePart)
  }
}

function normalizeMinute(value: string) {
  const padded = value.slice(0, 2).padStart(2, '0')
  if (minuteOptions.value.includes(padded)) {
    return padded
  }

  const numeric = Number(padded)
  if (Number.isNaN(numeric)) {
    return minuteOptions.value[0] || '00'
  }

  const step = normalizedStep.value
  const nearest = Math.round(numeric / step) * step
  const bounded = Math.min(55, Math.max(0, nearest - (nearest % step)))
  const fallback = minuteOptions.value.includes(String(bounded).padStart(2, '0'))
    ? String(bounded).padStart(2, '0')
    : minuteOptions.value[0] || '00'
  return fallback
}

watch(
  () => props.modelValue,
  value => {
    if (isSyncing) return
    parseModelValue(value)
  },
  { immediate: true }
)

watch(
  minuteOptions,
  options => {
    if (!options.includes(minuteValue.value)) {
      minuteValue.value = options[0] || '00'
    }
  },
  { immediate: true }
)

function clampToMinIfNeeded() {
  if (!minConstraint.value || !dateValue.value) return
  const minDate = minConstraint.value.date
  if (dateValue.value < minDate) {
    dateValue.value = minDate
    hourValue.value = minConstraint.value.hours
    minuteValue.value = minConstraint.value.minutes
    return
  }

  if (dateValue.value === minDate) {
    const currentMinutes = Number(minuteValue.value)
    const currentHours = Number(hourValue.value)
    const minHours = Number(minConstraint.value.hours)
    const minMinutes = Number(minConstraint.value.minutes)

    if (currentHours < minHours) {
      hourValue.value = minConstraint.value.hours
      minuteValue.value = minConstraint.value.minutes
      return
    }

    if (currentHours === minHours && currentMinutes < minMinutes) {
      minuteValue.value = minConstraint.value.minutes
    }
  }
}

watch([dateValue, minConstraint], () => {
  clampToMinIfNeeded()
})

watch([hourValue, minuteValue], () => {
  clampToMinIfNeeded()
})

watch([dateValue, hourValue, minuteValue], () => {
  isSyncing = true
  const payload = dateValue.value ? `${dateValue.value}T${hourValue.value}:${minuteValue.value}` : ''
  emit('update:modelValue', payload)
  nextTick(() => {
    isSyncing = false
  })
})

function handleDateChange() {
  if (!dateValue.value) {
    hourValue.value = '00'
    minuteValue.value = minuteOptions.value[0] || '00'
  }
}
</script>

<style scoped>
.date-time-picker {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.picker-grid {
  display: grid;
  grid-template-columns: 1.3fr 0.7fr 0.7fr;
  gap: 12px;
}

.time-select select {
  width: 100%;
}

.sr-only {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  border: 0;
}
</style>
