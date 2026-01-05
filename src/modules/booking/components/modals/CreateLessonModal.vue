<template>
  <Teleport to="body">
    <div v-if="visible" class="modal-overlay" @click.self="handleClose">
      <div ref="modalRef" class="modal-container" role="dialog" aria-labelledby="modal-title" aria-modal="true">
      <div class="modal-header">
        <h2 id="modal-title">{{ $t('calendar.createLesson.title') }}</h2>
        <button @click="handleClose" class="close-btn" aria-label="Закрити">
          <XIcon class="w-5 h-5" />
        </button>
      </div>

      <form @submit.prevent="submitForm" class="modal-form">
        <!-- Time Selection -->
        <div class="form-field">
          <DateTimePicker
            v-model="formData.start"
            :min="minDateTime"
            :label="$t('calendar.createLesson.selectedTime')"
            :hint="$t('calendar.createLesson.timeHint')"
            :hour-label="$t('calendar.createLesson.hourLabel')"
            :minute-label="$t('calendar.createLesson.minuteLabel')"
            required
            data-testid="start-time-picker"
          />
        </div>

        <!-- Student Search Combobox -->
        <div class="form-field">
          <label for="student-search" class="field-label">
            {{ $t('calendar.createLesson.student') }}
            <span class="required">*</span>
          </label>
          <div class="combobox-wrapper">
            <input
              id="student-search"
              data-testid="student-search"
              v-model="searchQuery"
              type="text"
              class="field-input"
              :placeholder="$t('calendar.createLesson.searchStudent')"
              @focus="showDropdown = true"
              @blur="handleBlur"
              autocomplete="off"
            />
            <div v-if="showDropdown && filteredOrders.length" class="dropdown-list">
              <button
                v-for="order in filteredOrders"
                :key="order.id"
                type="button"
                class="dropdown-item"
                data-testid="order-option"
                :data-order-id="order.id"
                @mousedown.prevent="selectStudent(order)"
              >
                <div class="student-info">
                  <span class="student-name">{{ order.clientName }}</span>
                  <span v-if="order.lessonsBalance !== undefined" class="balance-badge">
                    {{ order.lessonsBalance }} {{ $t('calendar.createLesson.lessonsLeft') }}
                  </span>
                </div>
              </button>
            </div>
          </div>
          <p v-if="fieldErrors.orderId" class="field-error">{{ fieldErrors.orderId }}</p>
        </div>

        <!-- Lesson Type -->
        <div v-if="lessonTypes.length" class="form-field">
          <label for="lesson-type" class="field-label">
            {{ $t('calendar.createLesson.lessonType') }}
          </label>
          <select
            id="lesson-type"
            v-model="formData.lessonType"
            class="field-select"
          >
            <option value="">{{ $t('calendar.createLesson.selectType') }}</option>
            <option
              v-for="(label, value) in lessonTypesDict"
              :key="value"
              :value="value"
            >
              {{ label }}
            </option>
          </select>
          <p v-if="fieldErrors.lessonType" class="field-error">{{ fieldErrors.lessonType }}</p>
        </div>

        <!-- Duration Selection -->
        <div class="form-field">
          <label for="duration" class="field-label">
            {{ $t('calendar.createLesson.duration') }}
            <span class="required">*</span>
          </label>
          <div class="duration-buttons" role="group" aria-label="Тривалість уроку">
            <button
              type="button"
              :class="['duration-btn', { active: formData.durationMin === 30 }]"
              data-testid="duration-30"
              @click="formData.durationMin = 30"
              :aria-pressed="formData.durationMin === 30"
            >
              30 {{ $t('booking.common.minutes') }}
            </button>
            <button
              type="button"
              :class="['duration-btn', { active: formData.durationMin === 60 }]"
              data-testid="duration-60"
              @click="formData.durationMin = 60"
              :aria-pressed="formData.durationMin === 60"
            >
              60 {{ $t('booking.common.minutes') }}
            </button>
            <button
              type="button"
              :class="['duration-btn', { active: formData.durationMin === 90 }]"
              data-testid="duration-90"
              @click="formData.durationMin = 90"
              :aria-pressed="formData.durationMin === 90"
            >
              90 {{ $t('booking.common.minutes') }}
            </button>
          </div>
        </div>

        <!-- Regularity Selection -->
        <div class="form-field">
          <label for="regularity" class="field-label">
            {{ $t('calendar.createLesson.regularity') }}
          </label>
          <select
            id="regularity"
            v-model="formData.regularity"
            class="field-select"
          >
            <option value="single">{{ $t('booking.calendar.regularity.single') }}</option>
            <option value="once_a_week">{{ $t('booking.calendar.regularity.once_a_week') }}</option>
          </select>
        </div>

        <!-- Repeat Mode (Series) -->
        <div class="form-field">
          <label class="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              v-model="enableRepeat"
              class="w-4 h-4 rounded border-gray-300"
            />
            <span class="field-label mb-0">{{ $t('calendar.createLesson.repeatMode') }}</span>
          </label>
        </div>

        <div v-if="enableRepeat" class="space-y-4 pl-6 border-l-2 border-primary/20">
          <!-- Repeat Mode Select -->
          <div class="form-field">
            <label for="repeat-mode" class="field-label">
              {{ $t('calendar.createLesson.repeatMode') }}
            </label>
            <select
              id="repeat-mode"
              v-model="repeatMode"
              class="field-select"
            >
              <option value="weekly">{{ $t('booking.calendar.repeatMode.weekly') }}</option>
              <option value="biweekly">{{ $t('booking.calendar.repeatMode.biweekly') }}</option>
            </select>
          </div>

          <!-- Repeat Count or Until -->
          <div class="form-field">
            <label class="field-label">
              {{ repeatByCount ? $t('calendar.createLesson.repeatCount') : $t('calendar.createLesson.repeatUntil') }}
            </label>
            <div class="flex items-center gap-2">
              <input
                v-if="repeatByCount"
                type="number"
                v-model.number="repeatCount"
                min="1"
                max="8"
                class="field-input"
                :placeholder="$t('calendar.createLesson.repeatCount')"
              />
              <input
                v-else
                type="date"
                v-model="repeatUntil"
                class="field-input"
                :placeholder="$t('calendar.createLesson.repeatUntil')"
              />
              <button
                type="button"
                @click="repeatByCount = !repeatByCount"
                class="px-3 py-2 text-sm border border-border-subtle rounded-md hover:bg-background-subtle"
              >
                {{ repeatByCount ? '📅' : '#' }}
              </button>
            </div>
          </div>

          <!-- Skip Conflicts -->
          <div class="form-field">
            <label class="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                v-model="skipConflicts"
                class="w-4 h-4 rounded border-gray-300"
              />
              <span class="text-sm text-muted">{{ $t('calendar.createLesson.skipConflicts') }}</span>
            </label>
          </div>
        </div>

        <!-- Tutor Comment -->
        <div class="form-field">
          <label for="tutor-comment" class="field-label">
            {{ $t('calendar.createLesson.tutorComment') }}
          </label>
          <textarea
            id="tutor-comment"
            v-model="formData.tutorComment"
            class="field-textarea"
            rows="2"
            :placeholder="$t('calendar.createLesson.tutorCommentPlaceholder')"
          />
        </div>

        <!-- Student Comment -->
        <div class="form-field">
          <label for="student-comment" class="field-label">
            {{ $t('calendar.createLesson.studentComment') }}
          </label>
          <textarea
            id="student-comment"
            v-model="formData.studentComment"
            class="field-textarea"
            rows="2"
            :placeholder="$t('calendar.createLesson.studentCommentPlaceholder')"
          />
        </div>

        <!-- Time Validation Error -->
        <div v-if="formData.start && !isTimeValid" class="warning-message" role="alert">
          <AlertCircleIcon class="w-5 h-5" />
          <p>{{ t('calendar.errors.invalidTime') }}</p>
        </div>
        <p v-if="fieldErrors.start" class="field-error">{{ fieldErrors.start }}</p>
        <p v-if="fieldErrors.durationMin" class="field-error">{{ fieldErrors.durationMin }}</p>

        <!-- F7: Conflict Warning Block -->
        <div v-if="showConflictWarning && conflicts.length" class="conflict-warning" role="alert">
          <div class="conflict-header">
            <AlertCircleIcon class="w-5 h-5" />
            <h4>{{ $t('calendar.createLesson.conflictDetected') }}</h4>
          </div>
          <div class="conflict-list">
            <div v-for="conflict in conflicts" :key="conflict.eventId" class="conflict-item">
              <p class="conflict-student">{{ conflict.studentName }}</p>
              <p class="conflict-time">{{ conflict.start }} - {{ conflict.end }}</p>
              <p class="conflict-reason">{{ conflict.reason }}</p>
            </div>
          </div>
          <div class="conflict-actions">
            <button type="button" @click="handleCancelConflict" class="btn-secondary">
              {{ $t('common.cancel') }}
            </button>
            <button type="button" @click="handleForceCreate" class="btn-warning">
              {{ $t('calendar.createLesson.createAnyway') }}
            </button>
          </div>
        </div>

        <!-- Error Display -->
        <div v-if="error" class="error-message" role="alert">
          <AlertCircleIcon class="w-5 h-5" />
          <p>{{ error }}</p>
        </div>

        <!-- Actions -->
        <div class="modal-actions">
          <button
            type="button"
            @click="handleClose"
            class="btn-secondary"
            :disabled="isSubmitting"
          >
            {{ $t('common.cancel') }}
          </button>
          <button
            type="submit"
            class="btn-primary"
            data-testid="create-lesson-submit"
            :disabled="!isFormValid || isSubmitting"
          >
            <LoaderIcon v-if="isSubmitting" class="w-4 h-4 animate-spin" />
            {{ $t('calendar.createLesson.create') }}
          </button>
        </div>
      </form>
    </div>
  </div>
  </Teleport>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { X as XIcon, Calendar as CalendarIcon, Loader as LoaderIcon, AlertCircle as AlertCircleIcon } from 'lucide-vue-next'
import { useCalendarWeekStore } from '@/modules/booking/stores/calendarWeekStore'
import { useToast } from '@/composables/useToast'
import { useFocusTrap } from '@/composables/useFocusTrap'
import { useErrorHandler, type ErrorHandlerResult } from '@/modules/booking/composables/useErrorHandler'
import { sanitizeComment } from '@/utils/sanitize'
import type { CalendarCell, CreateEventPayload } from '@/modules/booking/types/calendarWeek'
import { storeToRefs } from 'pinia'
import { bookingApi } from '@/modules/booking/api/bookingApi'
import type { ConflictItem } from '@/modules/booking/api/bookingApi'
import DateTimePicker from '@/components/ui/DateTimePicker.vue'

const props = defineProps<{
  visible: boolean
  selectedCell: CalendarCell
}>()

const emit = defineEmits<{
  close: []
  success: [eventId: number]
}>()

const { t } = useI18n()
const store = useCalendarWeekStore()
const { ordersArray, meta } = storeToRefs(store)
const toast = useToast()
const { handleError, handleErrorWithFields } = useErrorHandler()

const modalRef = ref<HTMLElement | null>(null)
useFocusTrap(modalRef, {
  onEscape: handleClose,
  initialFocus: true,
})

const formData = ref<CreateEventPayload>({
  orderId: 0,
  start: '',
  durationMin: 60,
  regularity: 'single',
  tutorComment: '',
  studentComment: '',
  lessonType: '',
  slotId: undefined,
  notifyStudent: true,
  autoGenerateZoom: false,
})

const DEFAULT_REPEAT_COUNT = 4

const enableRepeat = ref(false)
const repeatMode = ref<'weekly' | 'biweekly'>('weekly')
const repeatByCount = ref(true)
const repeatCount = ref(DEFAULT_REPEAT_COUNT)
const repeatUntil = ref('')
const skipConflicts = ref(false)

const isSubmitting = ref(false)
const error = ref<string | null>(null)
const fieldErrors = ref<Record<string, string>>({})
const conflicts = ref<ConflictItem[]>([])
const showConflictWarning = ref(false)

// F2: Student search state
const searchQuery = ref('')
const showDropdown = ref(false)
const filteredOrders = computed(() => {
  if (!searchQuery.value) return ordersArray.value
  const query = searchQuery.value.toLowerCase()
  return ordersArray.value.filter(order => 
    order.clientName.toLowerCase().includes(query) ||
    order.studentPhone?.toLowerCase().includes(query) ||
    order.studentEmail?.toLowerCase().includes(query)
  )
})

// F3: Lesson types from dictionaries
const { dictionaries } = storeToRefs(store)
const lessonTypesDict = computed(() => dictionaries.value?.lessonTypes || {})
const lessonTypes = computed(() => Object.keys(lessonTypesDict.value))

const availableOrders = computed(() => ordersArray.value)

const selectedOrder = computed(() => {
  return ordersArray.value.find(o => o.id === formData.value.orderId)
})

const availableDurations = computed(() => {
  if (!selectedOrder.value) return [30, 60, 90]
  return selectedOrder.value.durations
})

const isTimeValid = computed(() => {
  if (!formData.value.start) return false
  const selectedTime = new Date(formData.value.start)
  const now = new Date()
  
  // Перевірка: не в минулому
  if (selectedTime < now) return false
  
  // Перевірка: не пізніше ніж через 6 місяців
  const sixMonthsLater = new Date()
  sixMonthsLater.setMonth(sixMonthsLater.getMonth() + 6)
  if (selectedTime > sixMonthsLater) return false
  
  return true
})

// F6: Enhanced validation
const isDurationValid = computed(() => {
  if (!selectedOrder.value) return true
  return selectedOrder.value.durations.includes(formData.value.durationMin)
})

const isFormValid = computed(() => {
  return (
    formData.value.orderId > 0 && 
    formData.value.durationMin > 0 && 
    formData.value.start !== '' && 
    isTimeValid.value &&
    isDurationValid.value
  )
})

const minDateTime = computed(() => {
  const now = new Date()
  const year = now.getFullYear()
  const month = String(now.getMonth() + 1).padStart(2, '0')
  const day = String(now.getDate()).padStart(2, '0')
  const hours = String(now.getHours()).padStart(2, '0')
  
  // Округлюю хвилини до найближчого кратного 5
  const currentMinutes = now.getMinutes()
  const roundedMinutes = Math.ceil(currentMinutes / 5) * 5
  const minutes = String(roundedMinutes).padStart(2, '0')
  
  return `${year}-${month}-${day}T${hours}:${minutes}`
})

watch(
  () => props.visible,
  (visible) => {
    if (visible) {
      resetForm()
    }
  },
  { immediate: true },
)

watch(
  () => formData.value.regularity,
  (regularity) => {
    if (regularity === 'single') {
      enableRepeat.value = false
      return
    }

    enableRepeat.value = true

    if (regularity === 'once_a_week') {
      repeatMode.value = 'weekly'
    } else if (regularity === 'twice_a_week') {
      repeatMode.value = 'biweekly'
    }

    repeatByCount.value = true
    if (!repeatCount.value || repeatCount.value < 1) {
      repeatCount.value = DEFAULT_REPEAT_COUNT
    }
  },
)

watch(
  () => enableRepeat.value,
  (isEnabled) => {
    if (isEnabled && formData.value.regularity === 'single') {
      formData.value.regularity = 'once_a_week'
    }
    if (!isEnabled && formData.value.regularity !== 'single') {
      formData.value.regularity = 'single'
    }
  },
)

function submitForm() {
  handleSubmit()
}

function resetForm() {
  // Конвертувати UTC час клітинки в локальний datetime-local формат
  const cellDate = new Date(props.selectedCell.startAtUTC)
  const year = cellDate.getFullYear()
  const month = String(cellDate.getMonth() + 1).padStart(2, '0')
  const day = String(cellDate.getDate()).padStart(2, '0')
  const hours = String(cellDate.getHours()).padStart(2, '0')
  const minutes = String(cellDate.getMinutes()).padStart(2, '0')
  const localDateTime = `${year}-${month}-${day}T${hours}:${minutes}`
  
  formData.value = {
    orderId: 0,
    start: localDateTime,
    durationMin: 60,
    regularity: 'single',
    tutorComment: '',
    studentComment: '',
    lessonType: '',
    slotId: props.selectedCell.slotId,
    notifyStudent: true,
    autoGenerateZoom: false,
  }
  error.value = null
  fieldErrors.value = {}
  searchQuery.value = ''
  showDropdown.value = false
}

function selectStudent(order: any) {
  formData.value.orderId = order.id
  searchQuery.value = order.clientName
  showDropdown.value = false
  fieldErrors.value.orderId = ''
  
  // Adjust duration if needed
  if (!order.durations.includes(formData.value.durationMin)) {
    formData.value.durationMin = order.durations[0] || 60
  }
}

function handleBlur() {
  setTimeout(() => {
    showDropdown.value = false
  }, 500)
}

const formatWithOffset = (date: Date) => {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  const hh = String(date.getHours()).padStart(2, '0')
  const mm = String(date.getMinutes()).padStart(2, '0')
  const tz = date.getTimezoneOffset()
  const sign = tz <= 0 ? '+' : '-'
  const tzHours = String(Math.floor(Math.abs(tz) / 60)).padStart(2, '0')
  const tzMinutes = String(Math.abs(tz) % 60).padStart(2, '0')
  return `${y}-${m}-${d}T${hh}:${mm}:00${sign}${tzHours}:${tzMinutes}`
}

// F7: Check conflicts before submit
async function checkConflicts(options: { strict?: boolean } = {}) {
  conflicts.value = []
  if (!isFormValid.value) return false
  
  try {
    const localDate = new Date(formData.value.start)
    
    const response = await bookingApi.checkSlotConflicts({
      start: formatWithOffset(localDate),
      durationMin: formData.value.durationMin,
      slotId: formData.value.slotId,
      strict: options.strict ?? false,
    })
    
    conflicts.value = response.conflicts || []
    
    if (conflicts.value.length && !options.strict) {
      showConflictWarning.value = true
      return false
    }
    
    return true
  } catch (err: any) {
    if (options.strict && err.response?.status === 409) {
      conflicts.value = err.response?.data?.conflicts || []
      showConflictWarning.value = true
      toast.error(t('calendar.errors.timeOverlap'))
      return false
    }
    
    console.error('[CreateLessonModal] Conflict check error:', err)
    return true // Proceed if conflict check fails
  }
}

async function handleSubmit(options: { skipConflictCheck?: boolean } = {}) {
  if (!isFormValid.value) return
  
  if (!options.skipConflictCheck) {
    const canProceed = await checkConflicts()
    if (!canProceed) return
  }
  
  isSubmitting.value = true
  error.value = null
  fieldErrors.value = {}
  
  const tempId = `temp-${Date.now()}`
  
  try {
    const localDate = new Date(formData.value.start)
    const isoString = formatWithOffset(localDate)
    const endDate = new Date(localDate.getTime() + formData.value.durationMin * 60000)
    const endIsoString = formatWithOffset(endDate)
    
    const timezone = meta.value?.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone || 'Europe/Kiev'
    
    const basePayload = {
      orderId: formData.value.orderId,
      start: isoString,
      durationMin: formData.value.durationMin,
      regularity: formData.value.regularity,
      tutorComment: sanitizeComment(formData.value.tutorComment || ''),
      studentComment: sanitizeComment(formData.value.studentComment || ''),
      lessonType: formData.value.lessonType || undefined,
      slotId: formData.value.slotId,
      notifyStudent: formData.value.notifyStudent,
      autoGenerateZoom: formData.value.autoGenerateZoom,
      timezone,
    }
    
    if (enableRepeat.value) {
      const resolvedRepeatCount = repeatByCount.value
        ? Math.max(repeatCount.value || DEFAULT_REPEAT_COUNT, 1)
        : undefined
      const resolvedRepeatUntil =
        !repeatByCount.value && repeatUntil.value ? repeatUntil.value : undefined

      const seriesPayload = {
        ...basePayload,
        repeatMode: repeatMode.value,
        repeatCount: resolvedRepeatCount,
        repeatUntil: resolvedRepeatUntil,
        skipConflicts: skipConflicts.value,
      }
      
      const response = await store.createEventSeries(seriesPayload)
      
      console.info('[CreateLessonModal] Series created:', response)
      
      if (response.warnings?.length) {
        response.warnings.forEach(warning => toast.warning(warning))
      }
      
      if (response.skippedCount > 0) {
        toast.warning(
          t('calendar.createLesson.seriesPartialSuccess', {
            created: response.createdCount,
            skipped: response.skippedCount,
          })
        )
      } else {
        toast.success(
          t('calendar.createLesson.seriesSuccess', { count: response.createdCount })
        )
      }
      
      emit('success', response.seriesId)
      emit('close')
    } else {
      const studentName = selectedOrder.value?.clientName || 'Unknown'
      store.addOptimisticEvent({
        tempId,
        start: isoString,
        end: endIsoString,
        status: 'scheduled',
        is_first: false,
        student: {
          id: formData.value.orderId,
          name: studentName,
        },
        lesson_link: '',
        can_reschedule: true,
        can_mark_no_show: true,
      })
      
      const eventId = await store.createEvent({
        ...basePayload,
        tempId,
      })
      
      console.info('[CreateLessonModal] Lesson created:', eventId)
      emit('success', eventId)
      emit('close')
    }
  } catch (err: any) {
    console.error('[CreateLessonModal] Submit error:', err)
    
    if (!enableRepeat.value) {
      store.removeOptimisticEvent(tempId)
    }
    
    const result = handleErrorWithFields(err, t('calendar.errors.createFailed'))
    
    fieldErrors.value = result.fieldErrors
    
    if (result.shouldShowToast) {
      error.value = result.message
    }
  } finally {
    isSubmitting.value = false
  }
}

async function handleForceCreate() {
  const canProceed = await checkConflicts({ strict: true })
  if (!canProceed) return
  showConflictWarning.value = false
  await handleSubmit({ skipConflictCheck: true })
}

function handleCancelConflict() {
  showConflictWarning.value = false
}

function handleClose() {
  if (!isSubmitting.value) {
    emit('close')
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
  z-index: 1000;
  padding: 16px;
}

.modal-container {
  background: white;
  border-radius: 12px;
  max-width: 500px;
  width: 100%;
  max-height: 90vh;
  overflow-y: auto;
  box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1);
}

.modal-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 20px 24px;
  border-bottom: 1px solid #e5e7eb;
}

.modal-header h2 {
  font-size: 20px;
  font-weight: 600;
  color: #111827;
}

.close-btn {
  padding: 4px;
  border-radius: 6px;
  transition: background-color 0.2s;
}

.close-btn:hover {
  background-color: #f3f4f6;
}

.modal-form {
  padding: 24px;
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.time-display {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px;
  background: #eff6ff;
  border-radius: 8px;
  border: 1px solid #dbeafe;
}

.time-label {
  font-size: 12px;
  color: #6b7280;
}

.time-value {
  font-size: 14px;
  font-weight: 600;
  color: #1f2937;
}

.form-field {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.field-label {
  font-size: 14px;
  font-weight: 500;
  color: #374151;
}

.required {
  color: #ef4444;
}

.field-select,
.field-textarea {
  padding: 10px 12px;
  border: 1px solid #d1d5db;
  border-radius: 6px;
  font-size: 14px;
  transition: border-color 0.2s;
}

.field-select:focus,
.field-textarea:focus {
  outline: none;
  border-color: #3b82f6;
  box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
}

.duration-buttons {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(80px, 1fr));
  gap: 8px;
}

.duration-btn {
  padding: 10px 16px;
  border: 2px solid #e5e7eb;
  border-radius: 6px;
  font-size: 14px;
  font-weight: 500;
  transition: all 0.2s;
  background: white;
  color: #6b7280;
}

.duration-btn:hover {
  border-color: #3b82f6;
  color: #3b82f6;
}

.duration-btn.active {
  border-color: #3b82f6;
  background: #3b82f6;
  color: white;
}

.warning-message {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 12px;
  background: #fef3c7;
  border: 1px solid #fde68a;
  border-radius: 6px;
  color: #92400e;
  font-size: 14px;
}

.error-message {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 12px;
  background: #fef2f2;
  border: 1px solid #fecaca;
  border-radius: 6px;
  color: #dc2626;
  font-size: 14px;
}

.field-hint {
  font-size: 12px;
  color: #6b7280;
  margin-top: 4px;
}

.field-input {
  padding: 10px 12px;
  border: 1px solid #d1d5db;
  border-radius: 6px;
  font-size: 14px;
  transition: border-color 0.2s;
}

.field-input:focus {
  outline: none;
  border-color: #3b82f6;
  box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
}

.modal-actions {
  display: flex;
  gap: 12px;
  justify-content: flex-end;
  padding-top: 8px;
}

.btn-secondary,
.btn-primary {
  padding: 10px 20px;
  border-radius: 6px;
  font-size: 14px;
  font-weight: 500;
  transition: all 0.2s;
  display: flex;
  align-items: center;
  gap: 8px;
}

.btn-secondary {
  border: 1px solid #d1d5db;
  background: white;
  color: #374151;
}

.btn-secondary:hover:not(:disabled) {
  background: #f3f4f6;
}

.btn-primary {
  background: #3b82f6;
  color: white;
}

.btn-primary:hover:not(:disabled) {
  background: #2563eb;
}

.btn-primary:disabled,
.btn-secondary:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

/* F2-F5: New styles for combobox, dropdown, errors */
.combobox-wrapper {
  position: relative;
}

.dropdown-list {
  position: absolute;
  top: 100%;
  left: 0;
  right: 0;
  max-height: 200px;
  overflow-y: auto;
  background: white;
  border: 1px solid #d1d5db;
  border-radius: 6px;
  box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
  z-index: 1000;
  margin-top: 4px;
}

.dropdown-item {
  width: 100%;
  padding: 10px 12px;
  border: none;
  background: white;
  text-align: left;
  cursor: pointer;
  transition: background-color 0.2s;
}

.dropdown-item:hover {
  background: #f3f4f6;
}

.student-info {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 8px;
}

.student-name {
  font-size: 14px;
  color: #111827;
}

.balance-badge {
  padding: 2px 8px;
  background: #dbeafe;
  border-radius: 12px;
  font-size: 12px;
  font-weight: 500;
  color: #1e40af;
  white-space: nowrap;
}

.field-error {
  font-size: 12px;
  color: #dc2626;
  margin-top: 4px;
}

/* F7: Conflict warning styles */
.conflict-warning {
  padding: 16px;
  background: #fef3c7;
  border: 2px solid #fbbf24;
  border-radius: 8px;
  margin-top: 12px;
}

.conflict-header {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 12px;
}

.conflict-header h4 {
  margin: 0;
  font-size: 14px;
  font-weight: 600;
  color: #92400e;
}

.conflict-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin-bottom: 12px;
}

.conflict-item {
  padding: 8px;
  background: white;
  border-radius: 6px;
  border: 1px solid #fde68a;
}

.conflict-student {
  font-size: 13px;
  font-weight: 600;
  color: #111827;
  margin: 0 0 4px 0;
}

.conflict-time {
  font-size: 12px;
  color: #6b7280;
  margin: 0 0 4px 0;
}

.conflict-reason {
  font-size: 12px;
  color: #92400e;
  margin: 0;
}

.conflict-actions {
  display: flex;
  gap: 8px;
  justify-content: flex-end;
}

.btn-warning {
  padding: 8px 16px;
  border-radius: 6px;
  font-size: 14px;
  font-weight: 500;
  background: #f59e0b;
  color: white;
  border: none;
  cursor: pointer;
  transition: background-color 0.2s;
}

.btn-warning:hover {
  background: #d97706;
}
</style>
