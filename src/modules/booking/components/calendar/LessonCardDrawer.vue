<template>
  <div v-if="modelValue && lesson" class="drawer-overlay" @click="close">
    <div class="drawer-content" @click.stop>
      <div class="drawer-header">
        <h3>{{ t('calendar.lesson_card.title') }}</h3>
        <button class="close-btn" @click="close">×</button>
      </div>
      
      <div class="lesson-details">
        <div class="detail-row">
          <svg class="icon" width="20" height="20" viewBox="0 0 20 20" fill="currentColor">
            <path d="M10 10c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/>
          </svg>
          <span class="detail-text">{{ lesson.student?.name || t('calendar.lesson_card.no_student') }}</span>
        </div>
        
        <div class="detail-row">
          <svg class="icon" width="20" height="20" viewBox="0 0 20 20" fill="currentColor">
            <path d="M17 3h-1V1h-2v2H6V1H4v2H3c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm0 16H3V9h14v10zm0-12H3V5h14v2z"/>
          </svg>
          <span class="detail-text">{{ formatDateTime(lesson.start) }}</span>
        </div>
        
        <div v-if="lesson.lesson_link" class="detail-row">
          <svg class="icon" width="20" height="20" viewBox="0 0 20 20" fill="currentColor">
            <path d="M3.9 12c0-1.71 1.39-3.1 3.1-3.1h4V7H7c-2.76 0-5 2.24-5 5s2.24 5 5 5h4v-1.9H7c-1.71 0-3.1-1.39-3.1-3.1zM8 13h8v-2H8v2zm5-6h4c2.76 0 5 2.24 5 5s-2.24 5-5 5h-4v-1.9h4c1.71 0 3.1-1.39 3.1-3.1 0-1.71-1.39-3.1-3.1-3.1h-4V7z"/>
          </svg>
          <a :href="lesson.lesson_link" target="_blank" class="lesson-link">
            {{ t('calendar.lesson_card.join_lesson') }}
          </a>
        </div>
        
        <div v-if="lesson.is_first" class="first-lesson-badge">
          <svg class="icon" width="16" height="16" viewBox="0 0 20 20" fill="currentColor">
            <path d="M12 17.27L18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z"/>
          </svg>
          {{ t('calendar.lesson_card.first_lesson') }}
        </div>
      </div>
      
      <div class="lesson-actions">
        <button 
          v-if="lesson.can_reschedule && !isPast(lesson.start)"
          class="btn-secondary" 
          @click="openReschedule"
        >
          {{ t('calendar.lesson_card.reschedule') }}
        </button>
        
        <button class="btn-secondary" @click="goToLesson">
          {{ t('calendar.lesson_card.go_to_lesson') }}
        </button>
        
        <button 
          v-if="lesson.can_mark_no_show && isPast(lesson.start) && lesson.status === 'scheduled'"
          class="btn-warning" 
          @click="confirmNoShow"
        >
          {{ t('calendar.lesson_card.mark_no_show') }}
        </button>
      </div>
    </div>
  </div>
  
  <RescheduleModal
    v-if="lesson"
    v-model="showReschedule"
    :event="lesson"
    @confirmed="handleRescheduleConfirmed"
  />
  
  <NoShowReasonModal
    v-model="showNoShowModal"
    @confirm="handleNoShowConfirm"
  />
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'
import { useCalendarWeekStore } from '@/modules/booking/stores/calendarWeekStore'
import { useToast } from '@/composables/useToast'
import { useCalendarGrid } from '@/modules/booking/composables/useCalendarGrid'
import type { CalendarEvent } from '@/modules/booking/types/calendarV055'
import RescheduleModal from './RescheduleModal.vue'
import NoShowReasonModal from './NoShowReasonModal.vue'

const props = defineProps<{
  lesson: CalendarEvent | null
}>()

const emit = defineEmits<{
  'mark-no-show': [eventId: number]
  'reschedule-confirmed': []
}>()

const { t } = useI18n()
const router = useRouter()
const store = useCalendarWeekStore()
const toast = useToast()
const { isPast, formatTime } = useCalendarGrid()
const modelValue = defineModel<boolean>()
const showReschedule = ref(false)
const showNoShowModal = ref(false)

const close = () => {
  modelValue.value = false
}

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

const openReschedule = () => {
  showReschedule.value = true
}

const goToLesson = () => {
  if (props.lesson) {
    router.push(`/lessons/${props.lesson.id}`)
  }
}

const confirmNoShow = () => {
  if (!props.lesson) return
  showNoShowModal.value = true
}

const handleNoShowConfirm = async (reasonId: number, comment: string) => {
  if (!props.lesson) return
  
  try {
    await store.markNoShow(props.lesson.id, {
      reason_id: reasonId,
      comment
    })
    
    toast.success(t('calendar.lesson_card.no_show_marked'))
    emit('mark-no-show', props.lesson.id)
    close()
  } catch (error) {
    console.error('Mark no-show error:', error)
    toast.error(t('calendar.lesson_card.no_show_error'))
  }
}

const handleRescheduleConfirmed = () => {
  emit('reschedule-confirmed')
  close()
}
</script>

<style scoped>
.drawer-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: flex-end;
  justify-content: center;
  z-index: 1000;
  animation: fadeIn 0.2s ease;
}

@keyframes fadeIn {
  from { opacity: 0; }
  to { opacity: 1; }
}

.drawer-content {
  background: white;
  border-radius: 16px 16px 0 0;
  padding: 24px;
  max-width: 600px;
  width: 100%;
  max-height: 80vh;
  overflow-y: auto;
  animation: slideUp 0.3s ease;
}

@keyframes slideUp {
  from { transform: translateY(100%); }
  to { transform: translateY(0); }
}

.drawer-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 24px;
  padding-bottom: 16px;
  border-bottom: 1px solid #e0e0e0;
}

.drawer-header h3 {
  margin: 0;
  font-size: 20px;
  font-weight: 600;
  color: #333;
}

.close-btn {
  background: none;
  border: none;
  font-size: 32px;
  color: #666;
  cursor: pointer;
  padding: 0;
  width: 36px;
  height: 36px;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: color 0.2s;
}

.close-btn:hover {
  color: #333;
}

.lesson-details {
  display: flex;
  flex-direction: column;
  gap: 16px;
  margin-bottom: 24px;
}

.detail-row {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px;
  background: #f5f7fa;
  border-radius: 8px;
}

.icon {
  color: #1976D2;
  flex-shrink: 0;
}

.detail-text {
  font-size: 14px;
  color: #333;
}

.lesson-link {
  font-size: 14px;
  color: #1976D2;
  text-decoration: none;
  font-weight: 500;
}

.lesson-link:hover {
  text-decoration: underline;
}

.first-lesson-badge {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 12px;
  background: #F3E5F5;
  border-radius: 8px;
  color: #9C27B0;
  font-weight: 600;
  font-size: 14px;
}

.lesson-actions {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.btn-secondary,
.btn-warning {
  padding: 12px 20px;
  border: none;
  border-radius: 8px;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;
}

.btn-secondary {
  background: #f5f7fa;
  color: #1976D2;
}

.btn-secondary:hover {
  background: #e3f2fd;
}

.btn-warning {
  background: #FFF3E0;
  color: #F57C00;
}

.btn-warning:hover {
  background: #FFE0B2;
}

@media (min-width: 768px) {
  .drawer-overlay {
    align-items: center;
  }
  
  .drawer-content {
    border-radius: 16px;
    max-height: 90vh;
  }
}
</style>
