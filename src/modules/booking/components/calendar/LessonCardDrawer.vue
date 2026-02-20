<template>
  <Modal :open="!!(modelValue && lesson)" :title="t('calendar.lesson_card.title')" size="sm" @close="close">
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
      <Button 
        v-if="lesson?.can_reschedule && !isPast(lesson.start)"
        variant="outline" 
        fullWidth
        @click="openReschedule"
      >
        {{ t('calendar.lesson_card.reschedule') }}
      </Button>
      
      <Button variant="outline" fullWidth @click="goToLesson">
        {{ t('calendar.lesson_card.go_to_lesson') }}
      </Button>
      
      <Button 
        v-if="lesson?.can_mark_no_show && isPast(lesson.start) && lesson.status === 'scheduled'"
        variant="danger" 
        fullWidth
        @click="confirmNoShow"
      >
        {{ t('calendar.lesson_card.mark_no_show') }}
      </Button>
    </div>
  </Modal>
  
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
import Modal from '@/ui/Modal.vue'
import Button from '@/ui/Button.vue'
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
  background: var(--bg-secondary);
  border-radius: var(--radius-md);
}

.icon {
  color: var(--accent);
  flex-shrink: 0;
}

.detail-text {
  font-size: 14px;
  color: var(--text-primary);
}

.lesson-link {
  font-size: 14px;
  color: var(--accent);
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
  background: var(--calendar-first-lesson-bg, #F3E5F5);
  border-radius: var(--radius-md);
  color: var(--calendar-first-lesson, #9C27B0);
  font-weight: 600;
  font-size: 14px;
}

.lesson-actions {
  display: flex;
  flex-direction: column;
  gap: 12px;
}
</style>
