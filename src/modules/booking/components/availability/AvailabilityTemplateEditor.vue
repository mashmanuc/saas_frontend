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
  color: #6b7280;
  font-size: 14px;
}

.timezone-info {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-top: 16px;
  padding: 12px;
  background: #f3f4f6;
  border-radius: 8px;
  font-size: 14px;
}

.weekdays-list {
  display: flex;
  flex-direction: column;
  gap: 24px;
}

.weekday-section {
  border: 1px solid #e5e7eb;
  border-radius: 12px;
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
}

.time-slots {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.empty-slots {
  padding: 16px;
  text-align: center;
  color: #9ca3af;
  font-size: 14px;
}

.time-slot-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px;
  background: #f9fafb;
  border-radius: 8px;
  flex-wrap: wrap;
}

.time-input {
  padding: 8px 12px;
  border: 1px solid #d1d5db;
  border-radius: 6px;
  font-size: 14px;
}

.separator {
  color: #6b7280;
  font-weight: 500;
}

.btn-icon-danger {
  padding: 8px;
  color: #ef4444;
  border-radius: 6px;
  transition: background-color 0.2s;
}

.btn-icon-danger:hover {
  background-color: #fee2e2;
}

.slot-error {
  color: #ef4444;
  font-size: 12px;
  width: 100%;
  margin-top: 4px;
}

.btn-add-slot {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 16px;
  color: #3b82f6;
  border: 1px dashed #3b82f6;
  border-radius: 8px;
  font-size: 14px;
  transition: all 0.2s;
}

.btn-add-slot:hover {
  background-color: #eff6ff;
}

.editor-actions {
  display: flex;
  justify-content: flex-end;
  gap: 12px;
  margin-top: 32px;
  padding-top: 24px;
  border-top: 1px solid #e5e7eb;
}

.btn-primary {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 12px 24px;
  background-color: #3b82f6;
  color: white;
  border-radius: 8px;
  font-weight: 500;
  transition: background-color 0.2s;
}

.btn-primary:hover:not(:disabled) {
  background-color: #2563eb;
}

.btn-primary:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.btn-secondary {
  padding: 12px 24px;
  border: 1px solid #d1d5db;
  border-radius: 8px;
  font-weight: 500;
  transition: background-color 0.2s;
}

.btn-secondary:hover:not(:disabled) {
  background-color: #f3f4f6;
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
