<template>
  <div v-if="modelValue && event" class="modal-overlay" @click="close">
    <div class="modal-content" @click.stop>
      <div class="modal-header">
        <h3>{{ t('calendar.reschedule.title') }}</h3>
        <button class="close-btn" @click="close">×</button>
      </div>
      
      <div class="modal-body">
        <div class="current-time">
          <span class="label">{{ t('calendar.reschedule.current_time') }}:</span>
          <span class="value">{{ formatDateTime(event.start) }}</span>
        </div>
        
        <div class="form-group">
          <label>{{ t('calendar.reschedule.new_date') }}</label>
          <input 
            v-model="newDate" 
            type="date" 
            class="form-control"
            :min="minDate"
          />
        </div>
        
        <div class="form-group">
          <label>{{ t('calendar.reschedule.new_time') }}</label>
          <input 
            v-model="newTime" 
            type="time" 
            class="form-control"
            step="300"
          />
        </div>
        
        <div v-if="previewResult" class="preview-result">
          <div v-if="previewResult.allowed" class="preview-success">
            <svg class="icon" width="20" height="20" viewBox="0 0 20 20" fill="currentColor">
              <path d="M10 0C4.48 0 0 4.48 0 10s4.48 10 10 10 10-4.48 10-10S15.52 0 10 0zm-2 15l-5-5 1.41-1.41L8 12.17l7.59-7.59L17 6l-9 9z"/>
            </svg>
            {{ t('calendar.reschedule.can_reschedule') }}
          </div>
          
          <div v-else class="preview-error">
            <svg class="icon" width="20" height="20" viewBox="0 0 20 20" fill="currentColor">
              <path d="M10 0C4.48 0 0 4.48 0 10s4.48 10 10 10 10-4.48 10-10S15.52 0 10 0zm1 15H9v-2h2v2zm0-4H9V5h2v6z"/>
            </svg>
            <div class="conflicts">
              <div v-for="(conflict, idx) in previewResult.conflicts" :key="idx" class="conflict-item">
                {{ conflict.reason }}
              </div>
            </div>
          </div>
        </div>
        
        <div v-if="isLoading" class="loading">
          {{ t('calendar.reschedule.checking') }}...
        </div>
      </div>
      
      <div class="modal-footer">
        <button class="btn-secondary" @click="close">
          {{ t('common.cancel') }}
        </button>
        <button 
          class="btn-primary" 
          :disabled="!canConfirm"
          @click="confirmReschedule"
        >
          {{ t('calendar.reschedule.confirm') }}
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useCalendarWeekStore } from '@/modules/booking/stores/calendarWeekStore'
import { useToast } from '@/composables/useToast'
import type { CalendarEvent, ReschedulePreviewResponse } from '@/modules/booking/types/calendarV055'

const props = defineProps<{
  event: CalendarEvent | null
}>()

const emit = defineEmits<{
  'confirmed': []
}>()

const { t } = useI18n()
const store = useCalendarWeekStore()
const toast = useToast()
const modelValue = defineModel<boolean>()

const newDate = ref('')
const newTime = ref('')
const previewResult = ref<ReschedulePreviewResponse | null>(null)
const isLoading = ref(false)

const minDate = computed(() => {
  const today = new Date()
  return today.toISOString().split('T')[0]
})

const canConfirm = computed(() => {
  return newDate.value && newTime.value && previewResult.value?.allowed
})

const formatDateTime = (datetime: string): string => {
  const date = new Date(datetime)
  return date.toLocaleDateString('uk-UA', { 
    weekday: 'short', 
    day: 'numeric', 
    month: 'short',
    hour: '2-digit',
    minute: '2-digit'
  })
}

const close = () => {
  modelValue.value = false
  newDate.value = ''
  newTime.value = ''
  previewResult.value = null
}

watch([newDate, newTime], async () => {
  if (newDate.value && newTime.value && props.event) {
    await checkPreview()
  }
})

const checkPreview = async () => {
  if (!props.event || !newDate.value || !newTime.value) return
  
  isLoading.value = true
  try {
    const newStart = `${newDate.value}T${newTime.value}:00`
    const duration = new Date(props.event.end).getTime() - new Date(props.event.start).getTime()
    const newEnd = new Date(new Date(newStart).getTime() + duration).toISOString()
    
    // Call real API preview
    previewResult.value = await store.reschedulePreview(props.event.id, {
      start: newStart,
      end: newEnd
    })
  } catch (error) {
    console.error('Preview error:', error)
    previewResult.value = {
      allowed: false,
      conflicts: [{ type: 'booking_exists', reason: t('calendar.reschedule.error') }],
      warnings: []
    }
  } finally {
    isLoading.value = false
  }
}

const confirmReschedule = async () => {
  if (!canConfirm.value || !props.event) return
  
  isLoading.value = true
  try {
    const newStart = `${newDate.value}T${newTime.value}:00`
    const duration = new Date(props.event.end).getTime() - new Date(props.event.start).getTime()
    const newEnd = new Date(new Date(newStart).getTime() + duration).toISOString()
    
    // Call real API confirm and trigger refetch
    await store.rescheduleConfirm(props.event.id, {
      start: newStart,
      end: newEnd
    })
    
    toast.success(t('calendar.reschedule.success'))
    emit('confirmed')
    close()
  } catch (error) {
    console.error('Reschedule error:', error)
    toast.error(t('calendar.reschedule.error'))
  } finally {
    isLoading.value = false
  }
}
</script>

<style scoped>
.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1001;
}

.modal-content {
  background: white;
  border-radius: 12px;
  padding: 24px;
  max-width: 500px;
  width: 90%;
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.2);
}

.modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 24px;
  padding-bottom: 16px;
  border-bottom: 1px solid #e0e0e0;
}

.modal-header h3 {
  margin: 0;
  font-size: 20px;
  font-weight: 600;
}

.close-btn {
  background: none;
  border: none;
  font-size: 28px;
  color: #666;
  cursor: pointer;
  padding: 0;
  width: 32px;
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.modal-body {
  margin-bottom: 24px;
}

.current-time {
  padding: 12px;
  background: #f5f7fa;
  border-radius: 8px;
  margin-bottom: 20px;
}

.current-time .label {
  font-weight: 600;
  color: #666;
  margin-right: 8px;
}

.current-time .value {
  color: #333;
}

.form-group {
  margin-bottom: 16px;
}

.form-group label {
  display: block;
  margin-bottom: 8px;
  font-weight: 500;
  color: #333;
  font-size: 14px;
}

.form-control {
  width: 100%;
  padding: 10px 12px;
  border: 1px solid #ddd;
  border-radius: 6px;
  font-size: 14px;
  transition: border-color 0.2s;
}

.form-control:focus {
  outline: none;
  border-color: #1976D2;
}

.preview-result {
  margin-top: 16px;
  padding: 12px;
  border-radius: 8px;
}

.preview-success {
  background: #E8F5E9;
  color: #2E7D32;
  display: flex;
  align-items: center;
  gap: 8px;
}

.preview-error {
  background: #FFEBEE;
  color: #C62828;
}

.preview-error .icon {
  margin-bottom: 8px;
}

.conflicts {
  margin-top: 8px;
}

.conflict-item {
  font-size: 13px;
  margin-bottom: 4px;
}

.loading {
  text-align: center;
  color: #666;
  font-size: 14px;
  padding: 12px;
}

.modal-footer {
  display: flex;
  gap: 12px;
  justify-content: flex-end;
}

.btn-primary,
.btn-secondary {
  padding: 10px 20px;
  border: none;
  border-radius: 6px;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;
}

.btn-primary {
  background: #1976D2;
  color: white;
}

.btn-primary:hover:not(:disabled) {
  background: #1565C0;
}

.btn-primary:disabled {
  background: #ccc;
  cursor: not-allowed;
}

.btn-secondary {
  background: #f5f7fa;
  color: #333;
}

.btn-secondary:hover {
  background: #e3f2fd;
}
</style>
