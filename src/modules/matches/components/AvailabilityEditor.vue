<script setup lang="ts">
import { ref, reactive, onMounted, computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { useAvailabilityStore } from '../store/availabilityStore'
import { bookingApi } from '@/modules/booking/api/booking'
import { availabilityApi } from '@/modules/booking/api/availabilityApi'
import type { TemplateSlot } from '@/modules/booking/api/availabilityApi'
import { Calendar, Plus, Trash2, Copy, Play } from 'lucide-vue-next'

const { t } = useI18n()
const availabilityStore = useAvailabilityStore()

const applyingTemplate = ref(false)
const showPreview = ref(false)

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

async function applyTemplate() {
  applyingTemplate.value = true
  const startTime = Date.now()
  
  try {
    const templateSlots: TemplateSlot[] = weeklyTemplate.value.map(slot => ({
      weekday: getWeekdayNumber(slot.weekday),
      start_time: slot.start,
      end_time: slot.end
    }))
    
    await availabilityApi.createTemplate(templateSlots)
    const { job_id, eta_seconds } = await availabilityApi.applyTemplate()
    
    if (typeof window !== 'undefined' && (window as any).telemetry) {
      (window as any).telemetry.track('availability.template_applied', {
        job_id,
        slots_count: templateSlots.length,
        eta_seconds
      })
    }
    
    if (typeof window !== 'undefined' && (window as any).toast) {
      (window as any).toast.success(
        t('availability.editor.templateApplied', { eta: Math.round(eta_seconds / 60) })
      )
    }
    
    // Job status polling removed - template applied successfully
    
    const duration = Date.now() - startTime
    
    if (typeof window !== 'undefined' && (window as any).telemetry) {
      (window as any).telemetry.track('availability.template_applied_success', {
        job_id,
        duration_ms: duration
      })
    }
    
    if (typeof window !== 'undefined' && (window as any).toast) {
      (window as any).toast.success(t('availability.editor.slotsGenerated'))
    }
    
    // Calendar refresh will happen via WebSocket or manual refresh
  } catch (err: any) {
    if (typeof window !== 'undefined' && (window as any).toast) {
      (window as any).toast.error(err.message || t('availability.editor.applyFailed'))
    }
  } finally {
    applyingTemplate.value = false
  }
}

function getWeekdayNumber(weekday: string): number {
  const map: Record<string, number> = {
    monday: 1,
    tuesday: 2,
    wednesday: 3,
    thursday: 4,
    friday: 5,
    saturday: 6,
    sunday: 0
  }
  return map[weekday] || 1
}

const previewSlots = computed(() => {
  return {} // Preview functionality removed
})

const pendingChangesCount = computed(() => {
  return 0 // Pending changes tracking removed
})

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
          <button class="btn btn-secondary btn-sm" @click="showPreview = !showPreview">
            <Calendar :size="16" />
            {{ showPreview ? t('availability.editor.hidePreview') : t('availability.editor.showPreview') }}
          </button>
          <button class="btn btn-secondary btn-sm" @click="copyWeek">
            <Copy :size="16" />
            {{ t('availability.editor.copyWeek') }}
          </button>
          <button class="btn btn-secondary btn-sm" @click="addWeeklySlot">
            <Plus :size="16" />
            {{ t('availability.editor.addSlot') }}
          </button>
          <button 
            class="btn btn-primary btn-sm" 
            :disabled="applyingTemplate || weeklyTemplate.length === 0"
            @click="applyTemplate"
          >
            <Play :size="16" />
            {{ applyingTemplate ? t('availability.editor.applying') : t('availability.editor.applyTemplate') }}
          </button>
        </div>
      </div>

      <div v-if="pendingChangesCount > 0" class="pending-changes">
        {{ t('availability.editor.pendingChanges', { count: pendingChangesCount }) }}
      </div>

      <div v-if="showPreview" class="preview-grid">
        <div class="preview-header">{{ t('availability.editor.preview') }}</div>
        <div class="preview-days">
          <div v-for="day in weekdays" :key="day" class="preview-day">
            <div class="preview-day-name">{{ t(`common.weekdays.${day}`) }}</div>
            <div class="preview-slots">
              <div 
                v-for="(slot, idx) in weeklyTemplate.filter(s => s.weekday === day)" 
                :key="idx"
                class="preview-slot"
              >
                {{ slot.start }} - {{ slot.end }}
              </div>
            </div>
          </div>
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
  gap: 0.5rem;
  align-items: center;
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

.pending-changes {
  padding: 0.75rem;
  background: var(--warning-bg, #fef3c7);
  border: 1px solid var(--warning, #f59e0b);
  border-radius: 0.375rem;
  color: var(--warning-text, #92400e);
  font-size: 0.875rem;
  margin-bottom: 1rem;
}

.preview-grid {
  margin-top: 1rem;
  padding: 1rem;
  background: var(--surface-muted, #f9fafb);
  border-radius: 0.5rem;
}

.preview-header {
  font-weight: 600;
  margin-bottom: 0.75rem;
  color: var(--text-primary);
}

.preview-days {
  display: grid;
  grid-template-columns: repeat(7, 1fr);
  gap: 0.5rem;
}

.preview-day {
  padding: 0.5rem;
  background: white;
  border: 1px solid var(--border-color);
  border-radius: 0.375rem;
}

.preview-day-name {
  font-size: 0.75rem;
  font-weight: 600;
  text-transform: uppercase;
  color: var(--text-secondary);
  margin-bottom: 0.5rem;
}

.preview-slots {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.preview-slot {
  padding: 0.25rem 0.5rem;
  background: var(--primary-bg, #dbeafe);
  border-radius: 0.25rem;
  font-size: 0.75rem;
  color: var(--primary, #3b82f6);
}
</style>
