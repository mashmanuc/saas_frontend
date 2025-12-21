<script setup lang="ts">
import { ref, reactive, onMounted } from 'vue'
import { useI18n } from 'vue-i18n'
import { useAvailabilityStore } from '../store/availabilityStore'
import { Calendar, Plus, Trash2, Copy } from 'lucide-vue-next'

const { t } = useI18n()
const availabilityStore = useAvailabilityStore()

const weekdays = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday']

const weeklyTemplate = ref<Array<{ weekday: string; start: string; end: string }>>([])
const overrides = ref<Array<{ date: string; slots: Array<{ start: string; end: string }> }>>([])
const blackoutDates = ref<string[]>([])

const loading = ref(false)
const saving = ref(false)

function addWeeklySlot() {
  weeklyTemplate.value.push({
    weekday: 'monday',
    start: '09:00',
    end: '10:00'
  })
}

function removeWeeklySlot(index: number) {
  weeklyTemplate.value.splice(index, 1)
}

function copyWeek() {
  const monday = weeklyTemplate.value.filter(s => s.weekday === 'monday')
  weekdays.forEach(day => {
    if (day !== 'monday') {
      monday.forEach(slot => {
        weeklyTemplate.value.push({
          weekday: day,
          start: slot.start,
          end: slot.end
        })
      })
    }
  })
}

function addOverride() {
  overrides.value.push({
    date: new Date().toISOString().split('T')[0],
    slots: [{ start: '09:00', end: '10:00' }]
  })
}

function removeOverride(index: number) {
  overrides.value.splice(index, 1)
}

function addBlackoutDate() {
  blackoutDates.value.push(new Date().toISOString().split('T')[0])
}

function removeBlackoutDate(index: number) {
  blackoutDates.value.splice(index, 1)
}

async function saveAvailability() {
  saving.value = true
  try {
    await availabilityStore.updateMyAvailability({
      weekly_template: weeklyTemplate.value,
      overrides: overrides.value,
      blackout_dates: blackoutDates.value
    })
  } finally {
    saving.value = false
  }
}

onMounted(() => {
  if (availabilityStore.myAvailability) {
    weeklyTemplate.value = availabilityStore.myAvailability.weekly_template || []
    overrides.value = availabilityStore.myAvailability.overrides || []
    blackoutDates.value = availabilityStore.myAvailability.blackout_dates || []
  }
})
</script>

<template>
  <div class="availability-editor">
    <div class="header">
      <h2>{{ t('availability.editor.title') }}</h2>
      <button class="btn btn-primary" :disabled="saving" @click="saveAvailability">
        {{ saving ? t('common.saving') : t('common.save') }}
      </button>
    </div>

    <div class="section">
      <div class="section-header">
        <h3>{{ t('availability.editor.weeklyTemplate') }}</h3>
        <div class="actions">
          <button class="btn btn-secondary btn-sm" @click="copyWeek">
            <Copy :size="16" />
            {{ t('availability.editor.copyWeek') }}
          </button>
          <button class="btn btn-secondary btn-sm" @click="addWeeklySlot">
            <Plus :size="16" />
            {{ t('availability.editor.addSlot') }}
          </button>
        </div>
      </div>

      <div class="slots">
        <div v-for="(slot, idx) in weeklyTemplate" :key="idx" class="slot-row">
          <select v-model="slot.weekday" class="input">
            <option v-for="day in weekdays" :key="day" :value="day">
              {{ t(`common.weekdays.${day}`) }}
            </option>
          </select>
          <input v-model="slot.start" type="time" class="input" />
          <span>—</span>
          <input v-model="slot.end" type="time" class="input" />
          <button class="btn-icon" @click="removeWeeklySlot(idx)">
            <Trash2 :size="18" />
          </button>
        </div>
      </div>
    </div>

    <div class="section">
      <div class="section-header">
        <h3>{{ t('availability.editor.overrides') }}</h3>
        <button class="btn btn-secondary btn-sm" @click="addOverride">
          <Plus :size="16" />
          {{ t('availability.editor.addOverride') }}
        </button>
      </div>

      <div class="overrides">
        <div v-for="(override, idx) in overrides" :key="idx" class="override-row">
          <input v-model="override.date" type="date" class="input" />
          <button class="btn-icon" @click="removeOverride(idx)">
            <Trash2 :size="18" />
          </button>
        </div>
      </div>
    </div>

    <div class="section">
      <div class="section-header">
        <h3>{{ t('availability.editor.blackoutDates') }}</h3>
        <button class="btn btn-secondary btn-sm" @click="addBlackoutDate">
          <Plus :size="16" />
          {{ t('availability.editor.addBlackout') }}
        </button>
      </div>

      <div class="blackouts">
        <div v-for="(date, idx) in blackoutDates" :key="idx" class="blackout-row">
          <input v-model="blackoutDates[idx]" type="date" class="input" />
          <button class="btn-icon" @click="removeBlackoutDate(idx)">
            <Trash2 :size="18" />
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.availability-editor {
  padding: 1.5rem;
  max-width: 1000px;
  margin: 0 auto;
}

.header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 2rem;
}

.header h2 {
  font-size: 1.5rem;
  font-weight: 600;
  margin: 0;
  color: var(--text-primary);
}

.section {
  margin-bottom: 2rem;
  padding: 1.5rem;
  background: var(--surface-card);
  border: 1px solid var(--border-color);
  border-radius: var(--radius-md, 8px);
}

.section-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 1.5rem;
}

.section-header h3 {
  font-size: 1.125rem;
  font-weight: 600;
  margin: 0;
  color: var(--text-primary);
}

.actions {
  display: flex;
  gap: 0.5rem;
}

.slots,
.overrides,
.blackouts {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.slot-row,
.override-row,
.blackout-row {
  display: flex;
  align-items: center;
  gap: 0.75rem;
}

.input {
  padding: 0.5rem 0.75rem;
  border: 1px solid var(--border-color);
  border-radius: var(--radius-sm, 6px);
  font-size: 0.9375rem;
  background: var(--surface-input);
  color: var(--text-primary);
}

.slot-row .input:first-child {
  flex: 1;
}

.slot-row .input[type="time"] {
  width: 120px;
}

.override-row .input,
.blackout-row .input {
  flex: 1;
}

.btn {
  padding: 0.5rem 1rem;
  border: none;
  border-radius: var(--radius-sm, 6px);
  font-size: 0.9375rem;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;
}

.btn-primary {
  background: var(--primary);
  color: white;
}

.btn-primary:hover:not(:disabled) {
  background: var(--primary-hover);
}

.btn-secondary {
  background: var(--surface-secondary);
  color: var(--text-primary);
}

.btn-secondary:hover {
  background: var(--surface-hover);
}

.btn-sm {
  padding: 0.375rem 0.75rem;
  font-size: 0.875rem;
  display: flex;
  align-items: center;
  gap: 0.375rem;
}

.btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.btn-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 36px;
  height: 36px;
  background: none;
  border: none;
  color: var(--text-secondary);
  cursor: pointer;
  transition: color 0.2s;
}

.btn-icon:hover {
  color: var(--danger, #dc2626);
}
</style>
