<template>
  <div class="availability-template-editor">
    <div class="editor-header">
      <h2>{{ $t('booking.template.title') }}</h2>
      <p class="subtitle">{{ $t('booking.template.subtitle') }}</p>
      
      <div class="timezone-info">
        <ClockIcon class="w-4 h-4" />
        <span>{{ $t('booking.template.timezone') }}: {{ timezone }}</span>
      </div>
    </div>

    <div v-if="loading" class="loading-state">
      <LoaderIcon class="w-8 h-8 animate-spin" />
      <p>{{ $t('common.loading') }}</p>
    </div>

    <div v-else-if="error" class="error-state">
      <AlertCircleIcon class="w-8 h-8 text-red-500" />
      <p>{{ error }}</p>
      <button @click="loadTemplate" class="btn-secondary">
        {{ $t('common.retry') }}
      </button>
    </div>

    <div v-else class="weekdays-list">
      <div
        v-for="(weekday, index) in weekdays"
        :key="index"
        class="weekday-section"
      >
        <div class="weekday-header">
          <CalendarIcon class="w-5 h-5" />
          <h3>{{ $t(`common.weekdays.${weekday}`) }}</h3>
          
          <!-- Copy from dropdown -->
          <select
            v-if="weeklySlots[index].length === 0"
            @change="copyFromDay($event, index)"
            class="copy-select"
          >
            <option value="">{{ $t('booking.template.copyFrom') }}</option>
            <option
              v-for="(day, i) in weekdays"
              :key="i"
              :value="i"
              :disabled="weeklySlots[i].length === 0"
            >
              {{ $t(`common.weekdays.${day}`) }}
            </option>
          </select>
        </div>

        <div class="time-slots">
          <div
            v-if="weeklySlots[index].length === 0"
            class="empty-slots"
          >
            <p>{{ $t('booking.template.noSlots') }}</p>
          </div>

          <div
            v-for="(slot, slotIndex) in weeklySlots[index]"
            :key="slotIndex"
            class="time-slot-item"
          >
            <input
              v-model="slot.start"
              type="time"
              class="time-input"
              @change="validateSlot(index, slotIndex)"
            />
            <span class="separator">—</span>
            <input
              v-model="slot.end"
              type="time"
              class="time-input"
              @change="validateSlot(index, slotIndex)"
            />
            <button
              @click="removeSlot(index, slotIndex)"
              class="btn-icon-danger"
              :aria-label="$t('common.delete')"
            >
              <XIcon class="w-4 h-4" />
            </button>
            
            <span v-if="slot.error" class="slot-error">
              {{ slot.error }}
            </span>
          </div>

          <button
            @click="addSlot(index)"
            class="btn-add-slot"
          >
            <PlusIcon class="w-4 h-4" />
            {{ $t('booking.template.addTime') }}
          </button>
        </div>
      </div>
    </div>

    <div class="editor-actions">
      <button
        v-if="hasAnySlots"
        @click="applyToAllDays"
        class="btn-secondary"
      >
        {{ $t('booking.template.applyToAll') }}
      </button>
      
      <button
        @click="handleCancel"
        class="btn-secondary"
        :disabled="saving"
      >
        {{ $t('common.cancel') }}
      </button>
      
      <button
        @click="handleSave"
        class="btn-primary"
        :disabled="!isValid || saving"
      >
        <LoaderIcon v-if="saving" class="w-4 h-4 animate-spin" />
        {{ $t('booking.template.saveAndGenerate') }}
      </button>
    </div>

    <!-- Generation Progress Modal -->
    <GenerationProgressModal
      v-if="showProgressModal"
      :visible="showProgressModal"
      :job-id="generationJobId"
      @complete="handleGenerationComplete"
      @close="showProgressModal = false"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { 
  Clock as ClockIcon, 
  Calendar as CalendarIcon, 
  Plus as PlusIcon, 
  X as XIcon,
  Loader as LoaderIcon,
  AlertCircle as AlertCircleIcon,
} from 'lucide-vue-next'
import { useAvailabilityStore } from '@/modules/booking/stores/availabilityStore'
import { useToast } from '@/composables/useToast'
import GenerationProgressModal from './GenerationProgressModal.vue'

const router = useRouter()
const availabilityStore = useAvailabilityStore()
const toast = useToast()

const weekdays = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday']
const timezone = ref('Europe/Kiev')
const loading = ref(false)
const saving = ref(false)
const error = ref<string | null>(null)
const showProgressModal = ref(false)
const generationJobId = ref<string | null>(null)

// weeklySlots[weekday_index] = [{start: "09:00", end: "12:00", error: null}, ...]
const weeklySlots = ref<Array<Array<{start: string, end: string, error: string | null}>>>(
  Array.from({ length: 7 }, () => [])
)

const hasAnySlots = computed(() => {
  return weeklySlots.value.some(day => day.length > 0)
})

const isValid = computed(() => {
  // Check if at least one slot exists
  const hasSlots = weeklySlots.value.some(day => day.length > 0)
  if (!hasSlots) return false
  
  // Check if all slots are valid (no errors)
  return weeklySlots.value.every(day =>
    day.every(slot => !slot.error && slot.start && slot.end)
  )
})

onMounted(async () => {
  await loadTemplate()
})

async function loadTemplate() {
  loading.value = true
  error.value = null
  
  try {
    const template = await availabilityStore.loadTemplate()
    
    if (template) {
      timezone.value = template.timezone || 'Europe/Kiev'
      
      // Parse weekly_slots into weeklySlots array
      if (template.weekly_slots && template.weekly_slots.length > 0) {
        weeklySlots.value = Array.from({ length: 7 }, () => [])
        
        for (const slot of template.weekly_slots) {
          weeklySlots.value[slot.weekday].push({
            start: slot.start,
            end: slot.end,
            error: null,
          })
        }
      }
    }
  } catch (err) {
    error.value = err instanceof Error ? err.message : 'Failed to load template'
  } finally {
    loading.value = false
  }
}

function addSlot(weekdayIndex: number) {
  weeklySlots.value[weekdayIndex].push({
    start: '09:00',
    end: '10:00',
    error: null,
  })
}

function removeSlot(weekdayIndex: number, slotIndex: number) {
  weeklySlots.value[weekdayIndex].splice(slotIndex, 1)
}

function validateSlot(weekdayIndex: number, slotIndex: number) {
  const slot = weeklySlots.value[weekdayIndex][slotIndex]
  
  // Check if end > start
  if (slot.start >= slot.end) {
    slot.error = 'Час закінчення має бути пізніше за час початку'
    return
  }
  
  // Check for overlaps with other slots on same day
  const daySlots = weeklySlots.value[weekdayIndex]
  for (let i = 0; i < daySlots.length; i++) {
    if (i === slotIndex) continue
    
    const other = daySlots[i]
    if (
      (slot.start >= other.start && slot.start < other.end) ||
      (slot.end > other.start && slot.end <= other.end) ||
      (slot.start <= other.start && slot.end >= other.end)
    ) {
      slot.error = 'Перетин з іншим часовим проміжком'
      return
    }
  }
  
  slot.error = null
}

async function handleSave() {
  if (!isValid.value) return
  
  saving.value = true
  
  try {
    // Convert weeklySlots to API format
    const slotsForApi = []
    for (let weekday = 0; weekday < 7; weekday++) {
      for (const slot of weeklySlots.value[weekday]) {
        slotsForApi.push({
          weekday,
          start: slot.start,
          end: slot.end,
        })
      }
    }
    
    const result = await availabilityStore.saveTemplate({
      weekly_slots: slotsForApi,
      timezone: timezone.value,
      auto_generate: true,
    })
    
    toast.success('Розклад збережено. Генерація слотів...')
    
    // Show progress modal
    generationJobId.value = result.last_generation_job_id
    showProgressModal.value = true
    
  } catch (err) {
    toast.error('Не вдалося зберегти розклад')
    console.error(err)
  } finally {
    saving.value = false
  }
}

function handleGenerationComplete() {
  showProgressModal.value = false
  toast.success('Слоти згенеровано успішно!')
  router.push('/booking/calendar')
}

function copyFromDay(event: Event, targetDayIndex: number) {
  const sourceDayIndex = parseInt((event.target as HTMLSelectElement).value)
  
  if (sourceDayIndex >= 0 && sourceDayIndex < 7) {
    weeklySlots.value[targetDayIndex] = weeklySlots.value[sourceDayIndex].map(slot => ({
      start: slot.start,
      end: slot.end,
      error: null,
    }))
  }
  
  // Reset select
  (event.target as HTMLSelectElement).value = ''
}

function applyToAllDays() {
  const firstDayWithSlots = weeklySlots.value.find(day => day.length > 0)
  
  if (!firstDayWithSlots) return
  
  if (confirm('Застосувати розклад першого дня до всіх інших днів?')) {
    for (let i = 0; i < 7; i++) {
      weeklySlots.value[i] = firstDayWithSlots.map(slot => ({
        start: slot.start,
        end: slot.end,
        error: null,
      }))
    }
  }
}

function handleCancel() {
  router.back()
}
</script>

<style scoped>
.availability-template-editor {
  max-width: 800px;
  margin: 0 auto;
  padding: 24px;
}

.editor-header {
  margin-bottom: 32px;
}

.editor-header h2 {
  font-size: 24px;
  font-weight: 600;
  margin-bottom: 8px;
}

.subtitle {
  color: var(--text-secondary);
  font-size: 14px;
}

.timezone-info {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-top: 16px;
  padding: 12px;
  background: var(--bg-secondary);
  border-radius: 8px;
  font-size: 14px;
}

.weekdays-list {
  display: flex;
  flex-direction: column;
  gap: 24px;
}

.weekday-section {
  border: 1px solid var(--border-color);
  border-radius: var(--radius-lg);
  padding: 16px;
}

.weekday-header {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 16px;
}

.weekday-header h3 {
  font-size: 16px;
  font-weight: 600;
  flex: 1;
}

.copy-select {
  padding: 6px 12px;
  border: 1px solid var(--border-color);
  border-radius: var(--radius-md);
  font-size: 13px;
  background: var(--card-bg);
  cursor: pointer;
  transition: border-color 0.2s;
}

.copy-select:hover {
  border-color: var(--accent);
}

.copy-select:focus {
  outline: none;
  border-color: var(--accent);
  box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
}

.time-slots {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.empty-slots {
  padding: 16px;
  text-align: center;
  color: var(--text-secondary);
  font-size: 14px;
}

.time-slot-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px;
  background: var(--bg-secondary);
  border-radius: var(--radius-md);
  flex-wrap: wrap;
}

.time-input {
  padding: 8px 12px;
  border: 1px solid var(--border-color);
  border-radius: var(--radius-md);
  font-size: 14px;
}

.separator {
  color: var(--text-secondary);
  font-weight: 500;
}

.btn-icon-danger {
  padding: 8px;
  color: var(--danger);
  border-radius: 6px;
  transition: background-color 0.2s;
}

.btn-icon-danger:hover {
  background-color: var(--danger-bg, #fee2e2);
}

.slot-error {
  color: var(--danger);
  font-size: 12px;
  width: 100%;
  margin-top: 4px;
}

.btn-add-slot {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 16px;
  color: var(--accent);
  border: 1px dashed var(--accent);
  border-radius: 8px;
  font-size: 14px;
  transition: all 0.2s;
}

.btn-add-slot:hover {
  background-color: var(--accent-bg, #eff6ff);
}

.editor-actions {
  display: flex;
  justify-content: flex-end;
  gap: 12px;
  margin-top: 32px;
  padding-top: 24px;
  border-top: 1px solid var(--border-color);
}

.btn-primary {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 12px 24px;
  background-color: var(--accent);
  color: white;
  border-radius: var(--radius-md);
  font-weight: 500;
  transition: background-color 0.2s;
}

.btn-primary:hover:not(:disabled) {
  background-color: var(--accent-hover, #2563eb);
}

.btn-primary:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.btn-secondary {
  padding: 12px 24px;
  border: 1px solid var(--border-color);
  border-radius: var(--radius-md);
  font-weight: 500;
  transition: background-color 0.2s;
}

.btn-secondary:hover:not(:disabled) {
  background-color: var(--bg-secondary);
}

.btn-secondary:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.loading-state,
.error-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 16px;
  padding: 48px;
  text-align: center;
}
</style>
