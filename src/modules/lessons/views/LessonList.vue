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
          <div class="inline-flex items-center gap-2 rounded-full border border-border-subtle bg-background px-3 py-1.5" data-test="week-nav">
            <button
              type="button"
              class="text-muted hover:text-foreground"
              data-test="week-prev"
              @click="goPrev"
            >
              ‹
            </button>
            <button
              type="button"
              class="text-sm font-semibold text-foreground"
              data-test="week-label"
              @click="goToday"
            >
              {{ weekLabel }}
            </button>
            <button
              type="button"
              class="text-muted hover:text-foreground"
              data-test="week-next"
              @click="goNext"
            >
              ›
            </button>
          </div>

          <Button
            variant="primary"
            size="sm"
            data-test="mark-free-time"
            @click="markFreeTime"
          >
            {{ t('lessons.calendar.actions.markFreeTime') }}
          </Button>

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

          <button
            type="button"
            class="inline-flex h-9 w-9 items-center justify-center rounded-full bg-primary text-white shadow hover:brightness-110"
            data-test="create-lesson-button"
            @click="openCreateModal()"
          >
            +
          </button>

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
          <div
            v-if="myStudentsGate.loading"
            class="rounded-lg border border-border-subtle bg-background px-3 py-2 text-sm text-muted"
            data-test="my-students-loading"
          >
            {{ t('common.loading') }}
          </div>

          <div
            v-else-if="myStudentsGate.isEmpty"
            class="rounded-lg border border-border-subtle bg-background px-3 py-3"
            data-test="my-students-empty"
          >
            <p class="text-sm font-semibold text-foreground">
              {{ t('lessons.calendar.myStudents.emptyTitle') }}
            </p>
            <p class="mt-1 text-sm text-muted">
              {{ t('lessons.calendar.myStudents.emptyDescription') }}
            </p>
            <div class="mt-3 flex flex-wrap gap-2">
              <Button variant="secondary" size="sm" data-test="my-students-refresh" @click="refreshMyStudents">
                {{ t('lessons.calendar.myStudents.actions.refresh') }}
              </Button>
              <Button variant="ghost" size="sm" data-test="my-students-cta" @click="goToMyStudentsHelp">
                {{ t('lessons.calendar.myStudents.actions.cta') }}
              </Button>
            </div>
          </div>

          <div v-else class="space-y-1">
            <StudentAutocomplete
              v-model="createForm.studentId"
              :label="t('lessons.calendar.fields.studentId')"
              :placeholder="t('booking.typeToSearch')"
              :show-invite-cta="false"
              :recent-students="myStudentsGate.students"
              :search-results="myStudentsGate.students"
              data-test="student-autocomplete"
              @invite="handleInviteStudent"
              @search="handleSearchStudents"
            />
          </div>

          <div
            v-if="createModalError.isSyncIssue"
            class="rounded-lg border border-amber-200 bg-amber-50 px-3 py-3"
            data-test="create-lesson-sync-issue"
          >
            <p class="text-sm font-semibold text-amber-900">
              {{ t('lessons.calendar.syncIssue.title') }}
            </p>
            <p class="mt-1 text-sm text-amber-900/80">
              {{ t('lessons.calendar.syncIssue.description') }}
            </p>
            <div class="mt-3 flex flex-wrap gap-2">
              <Button variant="secondary" size="sm" data-test="sync-refresh" @click="handleSyncRefresh">
                {{ t('lessons.calendar.syncIssue.actions.refresh') }}
              </Button>
              <Button variant="primary" size="sm" data-test="sync-retry" @click="handleSyncRetry">
                {{ t('common.retry') }}
              </Button>
            </div>
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
              <DateTimePicker
                v-model="createForm.start"
                :label="t('lessons.calendar.fields.start')"
                :hour-label="t('calendar.createLesson.hourLabel')"
                :minute-label="t('calendar.createLesson.minuteLabel')"
                required
              />
            </div>

            <div class="space-y-1">
              <DateTimePicker
                v-model="createForm.end"
                :label="t('lessons.calendar.fields.end')"
                :hour-label="t('calendar.createLesson.hourLabel')"
                :minute-label="t('calendar.createLesson.minuteLabel')"
                required
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
import { useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import dayjs from 'dayjs'
import FullCalendar from '@fullcalendar/vue3'
import timeGridPlugin from '@fullcalendar/timegrid'
import interactionPlugin from '@fullcalendar/interaction'
// FullCalendar CSS imported in src/assets/fullcalendar.css

import Button from '@/ui/Button.vue'
import Card from '@/ui/Card.vue'
import StudentAutocomplete from '@/modules/booking/components/StudentAutocomplete.vue'
import DateTimePicker from '@/components/ui/DateTimePicker.vue'
import { notifyError, notifySuccess } from '@/utils/notify'
import { useLessonStore, LESSON_STATUSES } from '@/modules/lessons/store/lessonStore'
import { useSettingsStore } from '@/stores/settingsStore'
import { getLocaleCalendarRules, normalizeLocale } from '@/modules/lessons/utils/calendarLocaleRules'
import { studentsApi } from '@/modules/booking/api/studentsApi'

const router = useRouter()
const { t } = useI18n()
const lessonStore = useLessonStore()
const settingsStore = useSettingsStore()

const calendarRef = ref(null)
const createModalOpen = ref(false)
const cancelModalOpen = ref(false)
const createSubmitting = ref(false)
const cancelSubmitting = ref(false)
const selectedLesson = ref(null)

const myStudentsGate = reactive({
  loading: false,
  count: null,
  error: null,
  students: [],
  get isEmpty() {
    return typeof this.count === 'number' && this.count <= 0
  },
})

const createModalError = reactive({
  code: null,
  get isSyncIssue() {
    return this.code === 'not_a_member'
  },
})

const calendarLocale = computed(() => normalizeLocale(settingsStore.locale || 'en'))
const localeCalendarRules = computed(() => getLocaleCalendarRules(calendarLocale.value))
const calendarFirstDay = computed(() => localeCalendarRules.value.firstDay)

function getCalendarDayMeta(date) {
  const dt = date instanceof Date ? date : new Date(date)
  const day = dt.getDay() // 0..6 (Sun..Sat)

  const { firstDay, weekendDays } = localeCalendarRules.value
  const index = (day - firstDay + 7) % 7 // 0..6 relative to week start

  return {
    day,
    index,
    isWeekend: weekendDays.includes(day),
    isZebra: index % 2 === 1,
  }
}

function formatCalendarDayHeader(date) {
  const locale = calendarLocale.value
  const dt = date instanceof Date ? date : new Date(date)

  const weekday = new Intl.DateTimeFormat(locale, { weekday: 'short' })
    .format(dt)
    .replace('.', '')
    .toLowerCase()
  const day = new Intl.DateTimeFormat(locale, { day: '2-digit' }).format(dt)
  return `${weekday}, ${day}`
}

const createForm = reactive({
  studentId: null,
  start: '',
  end: '',
  seriesId: '',
})

const roleOptions = computed(() => [
  { value: 'tutor', label: t('lessons.calendar.roles.tutor') },
  { value: 'student', label: t('lessons.calendar.roles.student') },
])

const weekLabel = computed(() => {
  const api = calendarRef.value?.getApi?.()
  const start = api?.view?.currentStart
  const end = api?.view?.currentEnd
  if (!start || !end) {
    return ''
  }

  const locale = settingsStore.locale || 'en'
  const fmt = new Intl.DateTimeFormat(locale, { day: '2-digit', month: 'short' })
  const fmtDay = new Intl.DateTimeFormat(locale, { day: '2-digit' })
  const fmtMonthYear = new Intl.DateTimeFormat(locale, { month: 'short', year: 'numeric' })

  const startD = dayjs(start)
  const endD = dayjs(end).subtract(1, 'day')

  if (startD.year() === endD.year() && startD.month() === endD.month()) {
    return `${fmtDay.format(startD.toDate())}–${fmtDay.format(endD.toDate())} ${fmtMonthYear.format(endD.toDate())}`
  }

  return `${fmt.format(startD.toDate())} – ${fmt.format(endD.toDate())}`
})

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
  allDaySlot: false,
  slotMinTime: '06:00:00',
  slotMaxTime: '23:00:00',
  locale: calendarLocale.value,
  firstDay: calendarFirstDay.value,
  dayHeaderContent: (arg) => formatCalendarDayHeader(arg.date),
  dayHeaderClassNames: (arg) => {
    const meta = getCalendarDayMeta(arg.date)
    return [meta.isZebra ? 'cal-zebra' : '', meta.isWeekend ? 'cal-weekend' : ''].filter(Boolean)
  },
  dayCellClassNames: (arg) => {
    const meta = getCalendarDayMeta(arg.date)
    return [meta.isZebra ? 'cal-zebra' : '', meta.isWeekend ? 'cal-weekend' : ''].filter(Boolean)
  },
  events: events.value,
  select: handleSelectRange,
  eventClick: handleEventClick,
  eventDrop: handleEventDrop,
  eventResize: handleEventResize,
  datesSet: handleDatesSet,
  headerToolbar: false,
  nowIndicator: true,
  buttonText: {
    today: t('lessons.calendar.buttons.today'),
    week: t('lessons.calendar.buttons.week'),
    day: t('lessons.calendar.buttons.day'),
  },
}))

function goPrev() {
  calendarRef.value?.getApi?.()?.prev()
}

function goNext() {
  calendarRef.value?.getApi?.()?.next()
}

function goToday() {
  calendarRef.value?.getApi?.()?.today()
}

function markFreeTime() {
  router.push('/availability').catch(() => {})
}

function formatLocalInput(date) {
  return dayjs(date || new Date()).format('YYYY-MM-DDTHH:mm')
}

function formatDisplay(value) {
  return dayjs(value).format('DD MMM YYYY HH:mm')
}

function openCreateModal(range) {
  createModalOpen.value = true
  createForm.studentId = null
  createForm.start = formatLocalInput(range?.start)
  createForm.end = formatLocalInput(range?.end || dayjs(range?.start).add(1, 'hour'))
  createForm.seriesId = ''

  createModalError.code = null
  void refreshMyStudents()
}

function closeCreateModal() {
  createModalOpen.value = false
}

async function refreshMyStudents() {
  myStudentsGate.loading = true
  myStudentsGate.error = null

  try {
    const data = await studentsApi.listStudents(undefined, 100)
    myStudentsGate.count = Number.isFinite(data?.count) ? data.count : (data?.results?.length || 0)
    myStudentsGate.students = (data?.results || []).map(s => ({
      id: s.student_id,
      name: [s.first_name, s.last_name].filter(Boolean).join(' ') || s.email || `ID: ${s.student_id}`,
    }))
  } catch (e) {
    myStudentsGate.error = e
    myStudentsGate.count = 0
    myStudentsGate.students = []
  } finally {
    myStudentsGate.loading = false
  }
}

async function handleSearchStudents(query) {
  if (!query || query.length < 2) {
    await refreshMyStudents()
    return
  }
  
  myStudentsGate.loading = true
  try {
    const data = await studentsApi.listStudents(query, 20)
    myStudentsGate.students = (data?.results || []).map(s => ({
      id: s.student_id,
      name: [s.first_name, s.last_name].filter(Boolean).join(' ') || s.email || `ID: ${s.student_id}`,
    }))
  } catch (e) {
    myStudentsGate.students = []
  } finally {
    myStudentsGate.loading = false
  }
}

function goToMyStudentsHelp() {
  // Default CTA: tutor goes to their dashboard to accept requests; student goes to marketplace.
  if (lessonStore.role === 'student') {
    router.push('/marketplace').catch(() => {})
    return
  }
  router.push('/tutor').catch(() => {})
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
      start: dayjs(info.event.start).toISOString(),
      end: dayjs(info.event.end).toISOString(),
    })
    notifySuccess(t('lessons.calendar.notifications.rescheduled'))
  } catch (error) {
    info.revert()
    notifyError(error?.mappedMessage || error?.response?.data?.detail || t('lessons.calendar.notifications.rescheduleError'))
  }
}

async function handleEventResize(info) {
  try {
    await lessonStore.rescheduleLesson(info.event.id, {
      start: dayjs(info.event.start).toISOString(),
      end: dayjs(info.event.end).toISOString(),
    })
    notifySuccess(t('lessons.calendar.notifications.resized'))
  } catch (error) {
    info.revert()
    notifyError(error?.mappedMessage || error?.response?.data?.detail || t('lessons.calendar.notifications.rescheduleError'))
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

function handleInviteStudent() {
  closeCreateModal()
  goToMyStudentsHelp()
}

async function submitCreateLesson() {
  createModalError.code = null
  if (!createForm.studentId) {
    notifyError(t('lessons.calendar.notifications.validation'))
    return
  }

  if (!createForm.start || !createForm.end) {
    notifyError(t('lessons.calendar.notifications.validation'))
    return
  }

  createSubmitting.value = true
  try {
    await lessonStore.createLesson({
      student_id: createForm.studentId,
      start: dayjs(createForm.start).toISOString(),
      end: dayjs(createForm.end).toISOString(),
      series_id: createForm.seriesId || undefined,
    })
    notifySuccess(t('lessons.calendar.notifications.created'))
    closeCreateModal()
  } catch (error) {
    if (error?.mappedCode === 'not_a_member') {
      createModalError.code = 'not_a_member'
      return
    }
    notifyError(error?.mappedMessage || error?.response?.data?.detail || t('lessons.calendar.notifications.createError'))
  } finally {
    createSubmitting.value = false
  }
}

async function handleSyncRefresh() {
  await Promise.all([
    refreshMyStudents(),
    lessonStore.fetchLessons().catch(() => {}),
  ])
}

async function handleSyncRetry() {
  await handleSyncRefresh()
  await submitCreateLesson()
}

async function confirmCancelLesson() {
  if (!selectedLesson.value) return
  cancelSubmitting.value = true
  try {
    await lessonStore.cancelLesson(selectedLesson.value.id, {})
    notifySuccess(t('lessons.calendar.notifications.cancelled'))
    closeCancelModal()
  } catch (error) {
    notifyError(error?.mappedMessage || error?.response?.data?.detail || t('lessons.calendar.notifications.cancelError'))
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
.lesson-calendar :deep(.fc) {
  --fc-border-color: var(--color-border-subtle);
  --fc-page-bg-color: var(--color-bg-primary);
  --fc-neutral-bg-color: var(--color-bg-secondary);
  --fc-neutral-text-color: var(--color-text-secondary);
  --fc-today-bg-color: transparent;
}

.lesson-calendar :deep(.fc .fc-scrollgrid) {
  border-radius: 16px;
  overflow: hidden;
}

.lesson-calendar :deep(.fc .fc-col-header-cell) {
  background: var(--color-bg-primary);
  border-color: var(--color-border-subtle);
}

.lesson-calendar :deep(.fc .fc-col-header-cell-cushion) {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 6px 12px;
  margin: 6px 0;
  border-radius: 999px;
  border: 1px solid var(--color-border-subtle);
  background: var(--color-bg-secondary);
  color: var(--color-text-primary);
  font-weight: 600;
  font-size: 12px;
  line-height: 1;
  text-transform: none;
}

.lesson-calendar :deep(.fc .fc-timegrid-axis-cushion) {
  color: var(--color-text-secondary);
  font-size: 11px;
}

.lesson-calendar :deep(.fc .fc-timegrid-slot-label-cushion) {
  color: var(--color-text-secondary);
  font-size: 11px;
}

.lesson-calendar :deep(.fc .fc-timegrid-slot) {
  border-color: var(--color-border-subtle);
}

.lesson-calendar :deep(.fc .fc-timegrid-col) {
  border-color: var(--color-border-subtle);
}

/* Zebra columns */
.lesson-calendar :deep(.fc .fc-timegrid-col.cal-zebra .fc-timegrid-col-frame) {
  background: color-mix(in srgb, var(--color-bg-secondary) 55%, transparent);
}

/* Weekend shading (overrides zebra) */
.lesson-calendar :deep(.fc .fc-timegrid-col.cal-weekend .fc-timegrid-col-frame) {
  background: color-mix(in srgb, var(--color-bg-secondary) 70%, transparent);
}

.lesson-calendar :deep(.fc .fc-col-header-cell.cal-weekend .fc-col-header-cell-cushion) {
  background: color-mix(in srgb, var(--color-bg-secondary) 85%, transparent);
}

.lesson-calendar :deep(.fc .fc-timegrid-now-indicator-line) {
  border-color: var(--color-primary);
}

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
