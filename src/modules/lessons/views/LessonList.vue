<template>
  <div class="space-y-4">
    <Card class="space-y-4">
      <div class="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 class="text-2xl font-semibold text-foreground" data-test="lessons-header-title">
            {{ t('lessons.calendar.title') }}
          </h1>
          <p class="text-sm text-muted" data-test="lessons-header-subtitle">
            {{ t('lessons.calendar.subtitle') }}
          </p>
        </div>

        <div class="flex flex-wrap items-center gap-3">
          <div class="inline-flex rounded-lg border border-border-subtle p-1" data-test="role-filter">
            <button
              v-for="option in roleOptions"
              :key="option.value"
              type="button"
              class="rounded-md px-3 py-1.5 text-sm font-medium transition"
              :class="
                lessonStore.role === option.value
                  ? 'bg-primary text-white shadow'
                  : 'text-muted hover:bg-border-subtle/50'
              "
              :data-test="`role-${option.value}`"
              @click="handleRoleSwitch(option.value)"
            >
              {{ option.label }}
            </button>
          </div>

          <div class="inline-flex flex-wrap items-center gap-2 rounded-lg border border-border-subtle px-2 py-1" data-test="status-filter">
            <span class="text-xs font-semibold uppercase tracking-wide text-muted">
              {{ t('lessons.calendar.status.label') }}
            </span>
            <div class="inline-flex rounded-md bg-surface-soft p-1">
              <button
                v-for="option in statusOptions"
                :key="option.value"
                type="button"
                class="rounded px-2 py-1 text-xs font-medium transition"
                :class="
                  lessonStore.status === option.value
                    ? 'bg-primary text-white shadow'
                    : 'text-muted hover:bg-border-subtle/50'
                "
                @click="handleStatusSwitch(option.value)"
              >
                {{ option.label }}
              </button>
            </div>
          </div>

          <Button variant="secondary" size="sm" data-test="create-lesson-button" @click="openCreateModal()">
            {{ t('lessons.calendar.actions.new') }}
          </Button>

          <Button
            variant="ghost"
            size="sm"
            :loading="lessonStore.loading"
            :disabled="lessonStore.loading"
            data-test="refresh-lessons-button"
            @click="refreshLessons"
          >
            {{ t('lessons.calendar.actions.refresh') }}
          </Button>
        </div>
      </div>

      <p v-if="lessonStore.error" class="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
        {{ lessonStore.error }}
      </p>

      <p class="text-xs text-muted">
        {{ t('lessons.calendar.hint') }}
      </p>
    </Card>

    <Card class="relative overflow-hidden p-0">
      <FullCalendar
        ref="calendarRef"
        class="lesson-calendar"
        :options="calendarOptions"
      />

      <div
        v-if="lessonStore.loading"
        class="pointer-events-none absolute inset-0 flex items-center justify-center bg-background/60 text-sm text-muted"
      >
        {{ t('loader.loading') }}
      </div>

      <div
        v-if="lessonStore.hasMoreEvents && !lessonStore.loading"
        class="border-t border-amber-200 bg-amber-50 px-4 py-2 text-xs text-amber-800"
        data-test="partial-info"
      >
        {{ t('lessons.calendar.info.partial', { limit: 500 }) }}
      </div>
    </Card>

    <!-- Create lesson modal -->
    <div
      v-if="createModalOpen"
      class="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4"
      role="dialog"
      aria-modal="true"
    >
      <div class="w-full max-w-lg rounded-xl bg-surface shadow-xl">
        <header class="border-b border-border-subtle px-5 py-4">
          <h2 class="text-lg font-semibold text-foreground">
            {{ t('lessons.calendar.createTitle') }}
          </h2>
        </header>

        <div class="space-y-4 px-5 py-4">
          <div class="space-y-1">
            <label class="text-xs font-medium text-muted">{{ t('lessons.calendar.fields.studentId') }}</label>
            <input
              v-model="createForm.studentId"
              type="text"
              class="w-full rounded-md border border-border-subtle bg-background px-3 py-2 text-sm text-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
              :placeholder="t('lessons.calendar.placeholders.studentId')"
              data-test="student-id-input"
            />
          </div>

          <div class="space-y-1">
            <label class="text-xs font-medium text-muted">{{ t('lessons.calendar.series.label') }}</label>
            <input
              v-model="createForm.seriesId"
              type="text"
              class="w-full rounded-md border border-border-subtle bg-background px-3 py-2 text-sm text-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
              :placeholder="t('lessons.calendar.series.placeholder')"
              data-test="series-id-input"
            />
          </div>

          <div class="grid gap-4 md:grid-cols-2">
            <div class="space-y-1">
              <label class="text-xs font-medium text-muted">{{ t('lessons.calendar.fields.start') }}</label>
              <input
                v-model="createForm.start"
                type="datetime-local"
                class="w-full rounded-md border border-border-subtle bg-background px-3 py-2 text-sm text-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
              />
            </div>

            <div class="space-y-1">
              <label class="text-xs font-medium text-muted">{{ t('lessons.calendar.fields.end') }}</label>
              <input
                v-model="createForm.end"
                type="datetime-local"
                class="w-full rounded-md border border-border-subtle bg-background px-3 py-2 text-sm text-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
              />
            </div>
          </div>
        </div>

        <footer class="flex justify-end gap-2 border-t border-border-subtle px-5 py-4">
          <Button variant="ghost" size="sm" :disabled="createSubmitting" @click="closeCreateModal">
            {{ t('common.cancel') }}
          </Button>
          <Button
            variant="primary"
            size="sm"
            :loading="createSubmitting"
            data-test="submit-create-lesson"
            @click="submitCreateLesson"
          >
            {{ t('lessons.calendar.actions.saveLesson') }}
          </Button>
        </footer>
      </div>
    </div>

    <!-- Cancel lesson modal -->
    <div
      v-if="cancelModalOpen && selectedLesson"
      class="fixed inset-0 z-40 flex items-center justify-center bg-black/40 px-4"
      role="dialog"
      aria-modal="true"
    >
      <div class="w-full max-w-md rounded-xl bg-surface shadow-xl">
        <header class="border-b border-border-subtle px-5 py-4">
          <h2 class="text-lg font-semibold text-foreground">
            {{ t('lessons.calendar.cancelTitle') }}
          </h2>
        </header>
        <div class="space-y-3 px-5 py-4 text-sm text-muted">
          <p>
            {{ t('lessons.calendar.cancelDescription') }}
          </p>
          <ul class="rounded-md border border-border-subtle bg-background px-3 py-2 text-xs">
            <li><strong>ID:</strong> {{ selectedLesson.id }}</li>
            <li><strong>{{ t('lessons.calendar.fields.start') }}:</strong> {{ formatDisplay(selectedLesson.startLocal) }}</li>
            <li><strong>{{ t('lessons.calendar.fields.end') }}:</strong> {{ formatDisplay(selectedLesson.endLocal) }}</li>
            <li>
              <strong>{{ t('lessons.calendar.series.label') }}:</strong>
              <span data-test="modal-series-id">
                {{ selectedLesson.series_id || t('lessons.calendar.series.none') }}
              </span>
            </li>
          </ul>
        </div>
        <footer class="flex justify-end gap-2 border-t border-border-subtle px-5 py-4">
          <Button variant="ghost" size="sm" :disabled="cancelSubmitting" @click="closeCancelModal">
            {{ t('common.cancel') }}
          </Button>
          <Button variant="danger" size="sm" :loading="cancelSubmitting" @click="confirmCancelLesson">
            {{ t('lessons.calendar.actions.confirmCancel') }}
          </Button>
        </footer>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed, onBeforeUnmount, onMounted, reactive, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import dayjs from 'dayjs'
import FullCalendar from '@fullcalendar/vue3'
import timeGridPlugin from '@fullcalendar/timegrid'
import interactionPlugin from '@fullcalendar/interaction'
// FullCalendar CSS imported in src/assets/fullcalendar.css

import Button from '../../../ui/Button.vue'
import Card from '../../../ui/Card.vue'
import { notifyError, notifySuccess } from '../../../utils/notify'
import { useLessonStore, LESSON_STATUSES } from '../store/lessonStore'
import { useSettingsStore } from '../../../stores/settingsStore'

const { t } = useI18n()
const lessonStore = useLessonStore()
const settingsStore = useSettingsStore()

const calendarRef = ref(null)
const createModalOpen = ref(false)
const cancelModalOpen = ref(false)
const createSubmitting = ref(false)
const cancelSubmitting = ref(false)
const selectedLesson = ref(null)

const createForm = reactive({
  studentId: '',
  start: '',
  end: '',
  seriesId: '',
})

const roleOptions = computed(() => [
  { value: 'tutor', label: t('lessons.calendar.roles.tutor') },
  { value: 'student', label: t('lessons.calendar.roles.student') },
])

const statusOptions = computed(() => [
  { value: 'all', label: t('lessons.calendar.status.all') },
  { value: LESSON_STATUSES.SCHEDULED, label: t('lessons.calendar.status.scheduled') },
  { value: LESSON_STATUSES.COMPLETED, label: t('lessons.calendar.status.completed') },
  { value: LESSON_STATUSES.CANCELLED, label: t('lessons.calendar.status.cancelled') },
])

const events = computed(() =>
  lessonStore.items.map((lesson) => ({
    id: String(lesson.id),
    title: lesson.student?.name || t('lessons.calendar.eventTitle', { id: lesson.id }),
    start: lesson.startLocal,
    end: lesson.endLocal,
    extendedProps: lesson,
    classNames: [`lesson-event`, `lesson-${lesson.status}`],
  })),
)

const calendarOptions = computed(() => ({
  plugins: [timeGridPlugin, interactionPlugin],
  initialView: 'timeGridWeek',
  height: 'auto',
  selectable: true,
  selectMirror: true,
  editable: true,
  eventOverlap: false,
  slotMinTime: '06:00:00',
  slotMaxTime: '23:00:00',
  locale: settingsStore.language || 'en',
  events: events.value,
  select: handleSelectRange,
  eventClick: handleEventClick,
  eventDrop: handleEventDrop,
  eventResize: handleEventResize,
  datesSet: handleDatesSet,
  headerToolbar: {
    left: 'prev,next today',
    center: 'title',
    right: 'timeGridWeek,timeGridDay',
  },
  nowIndicator: true,
  buttonText: {
    today: t('lessons.calendar.buttons.today'),
    week: t('lessons.calendar.buttons.week'),
    day: t('lessons.calendar.buttons.day'),
  },
}))

function formatLocalInput(date) {
  return dayjs(date || new Date()).format('YYYY-MM-DDTHH:mm')
}

function formatDisplay(value) {
  return dayjs(value).format('DD MMM YYYY HH:mm')
}

function openCreateModal(range) {
  createModalOpen.value = true
  createForm.studentId = ''
  createForm.start = formatLocalInput(range?.start)
  createForm.end = formatLocalInput(range?.end || dayjs(range?.start).add(1, 'hour'))
  createForm.seriesId = ''
}

function closeCreateModal() {
  createModalOpen.value = false
}

function handleSelectRange(selectionInfo) {
  openCreateModal({ start: selectionInfo.start, end: selectionInfo.end })
}

function handleEventClick(info) {
  selectedLesson.value = info.event.extendedProps
  cancelModalOpen.value = true
}

function closeCancelModal() {
  cancelModalOpen.value = false
  selectedLesson.value = null
}

async function handleEventDrop(info) {
  try {
    await lessonStore.rescheduleLesson(info.event.id, {
      start: info.event.start.toISOString(),
      end: info.event.end?.toISOString() ?? info.event.start.toISOString(),
    })
    notifySuccess(t('lessons.calendar.notifications.rescheduled'))
  } catch (error) {
    info.revert()
    notifyError(error?.response?.data?.detail || t('lessons.calendar.notifications.rescheduleError'))
  }
}

async function handleEventResize(info) {
  try {
    await lessonStore.rescheduleLesson(info.event.id, {
      start: info.event.start.toISOString(),
      end: info.event.end?.toISOString() ?? info.event.start.toISOString(),
    })
    notifySuccess(t('lessons.calendar.notifications.resized'))
  } catch (error) {
    info.revert()
    notifyError(error?.response?.data?.detail || t('lessons.calendar.notifications.rescheduleError'))
  }
}

function formatSeriesSuffix(seriesId) {
  if (!seriesId) return ''
  const shortId = String(seriesId).slice(0, 8).toUpperCase()
  return ` · #${shortId}`
}

async function handleDatesSet(arg) {
  lessonStore.setRange({ start: arg.startStr, end: arg.endStr })
  await lessonStore.fetchLessons().catch(() => {})
}

async function submitCreateLesson() {
  if (!createForm.start || !createForm.end) {
    notifyError(t('lessons.calendar.notifications.validation'))
    return
  }

  createSubmitting.value = true
  try {
    await lessonStore.createLesson({
      student_id: createForm.studentId || undefined,
      start: dayjs(createForm.start).toISOString(),
      end: dayjs(createForm.end).toISOString(),
      series_id: createForm.seriesId || undefined,
    })
    notifySuccess(t('lessons.calendar.notifications.created'))
    closeCreateModal()
  } catch (error) {
    notifyError(error?.response?.data?.detail || t('lessons.calendar.notifications.createError'))
  } finally {
    createSubmitting.value = false
  }
}

async function confirmCancelLesson() {
  if (!selectedLesson.value) return
  cancelSubmitting.value = true
  try {
    await lessonStore.cancelLesson(selectedLesson.value.id, {})
    notifySuccess(t('lessons.calendar.notifications.cancelled'))
    closeCancelModal()
  } catch (error) {
    notifyError(error?.response?.data?.detail || t('lessons.calendar.notifications.cancelError'))
  } finally {
    cancelSubmitting.value = false
  }
}

async function handleRoleSwitch(value) {
  if (lessonStore.role === value) return
  lessonStore.setRole(value)
  await lessonStore.fetchLessons().catch(() => {})
}

async function handleStatusSwitch(value) {
  if (lessonStore.status === value) return
  lessonStore.setStatus(value)
  await lessonStore.fetchLessons().catch(() => {})
}

async function refreshLessons() {
  await lessonStore.fetchLessons().catch(() => {})
}

onMounted(async () => {
  if (!lessonStore.range.start) {
    lessonStore.initializeRange()
  }
  await lessonStore.fetchLessons().catch(() => {})
  lessonStore.startPolling(() => lessonStore.fetchLessons().catch(() => {}))
})

onBeforeUnmount(() => {
  lessonStore.stopPolling()
})
</script>

<style scoped>
.lesson-calendar :deep(.lesson-event.lesson-cancelled) {
  background-color: #fee2e2;
  border-color: #fecdd3;
  color: #b91c1c;
}

.lesson-calendar :deep(.lesson-event.lesson-scheduled) {
  background-color: #e0f2fe;
  border-color: #bae6fd;
  color: #0369a1;
}

.lesson-calendar :deep(.lesson-event.lesson-completed) {
  background-color: #dcfce7;
  border-color: #bbf7d0;
  color: #15803d;
}
</style>
