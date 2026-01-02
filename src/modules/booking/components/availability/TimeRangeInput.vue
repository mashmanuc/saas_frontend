<script setup lang="ts">
// F19: Time Range Input Component
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'

const props = defineProps<{
  start: string
  end: string
}>()

const emit = defineEmits<{
  'update:start': [value: string]
  'update:end': [value: string]
}>()

const { t } = useI18n()

// Generate time options (every 30 minutes)
const timeOptions = computed(() => {
  const options: string[] = []
  for (let h = 0; h < 24; h++) {
    for (let m = 0; m < 60; m += 30) {
      const hour = h.toString().padStart(2, '0')
      const minute = m.toString().padStart(2, '0')
      options.push(`${hour}:${minute}`)
    }
  }
  return options
})

// Validate end time is after start time
const isValid = computed(() => {
  return props.end > props.start
})
</script>

<template>
  <div class="time-range-input" :class="{ invalid: !isValid }">
    <select
      :value="start"
      class="time-select"
      @change="emit('update:start', ($event.target as HTMLSelectElement).value)"
      data-testid="time-start"
      aria-label="Start time"
    >
      <option v-for="time in timeOptions" :key="time" :value="time">
        {{ time }}
      </option>
    </select>

    <span class="separator">to</span>

    <select
      :value="end"
      class="time-select"
      @change="emit('update:end', ($event.target as HTMLSelectElement).value)"
      data-testid="time-end"
      aria-label="End time"
    >
      <option v-for="time in timeOptions" :key="time" :value="time">
        {{ time }}
      </option>
    </select>

    <span v-if="!isValid" class="error-hint" data-testid="time-error">
      {{ t('calendar.slotEditor.errors.endBeforeStart') }}
    </span>
  </div>
</template>

<style scoped>
.time-range-input {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}

.time-select {
  padding: 8px 12px;
  border: 1px solid var(--color-border, #d1d5db);
  border-radius: 6px;
  font-size: 14px;
  background: var(--color-bg-primary, white);
  cursor: pointer;
  transition: all 0.15s;
}

.time-select:focus {
  outline: none;
  border-color: var(--color-primary, #3b82f6);
  box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
}

.time-range-input.invalid .time-select {
  border-color: var(--color-danger, #ef4444);
}

.separator {
  font-size: 13px;
  color: var(--color-text-secondary, #6b7280);
}

.error-hint {
  width: 100%;
  font-size: 12px;
  color: var(--color-danger, #ef4444);
}
</style>
