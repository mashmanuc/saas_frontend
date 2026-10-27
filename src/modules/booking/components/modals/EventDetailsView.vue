<template>
  <div class="event-details">
    <!-- 2026-10-28 (власник: «займає дохера місця і не дуже інформативне»): коли — одним рядком; звідки учень,
         оплата, повтор — значками (слот від вікна уроку); дошка — звичайна кнопка, не на пів-екрана -->
    <p class="ed-when" data-testid="event-time">
      <ClockIcon class="ed-icon" aria-hidden="true" />
      <span>{{ formatDay(event.start) }} · {{ formatTime(event.start) }}–{{ formatTime(event.end) }} · {{ event.durationMin }} {{ $t('common.min') }}</span>
    </p>
    <p v-if="event.clientPhone" class="ed-sub">
      <PhoneIcon class="ed-icon" aria-hidden="true" />
      <span>{{ event.clientPhone }}</span>
    </p>
    <div v-if="$slots.chips" class="ed-chips"><slot name="chips" /></div>
    <p v-if="event.tutorComment" class="comment-text">{{ event.tutorComment }}</p>

    <template v-if="props.actions">
      <button
        class="classroom-join-btn"
        :disabled="joiningClassroom"
        @click="handleOpenClassroom"
      >
        <MonitorIcon class="ed-icon" aria-hidden="true" />
        {{ joiningClassroom ? $t('common.loading') : $t('booking.calendar.eventDetails.openClassroom') }}
      </button>
      <!-- Join Lesson CTA (Zoom/зовнішні посилання) -->
      <JoinLessonPicker
        v-if="event.lesson_link"
        :event-id="event.id"
        :lesson-link="event.lesson_link"
      />
      <!-- Підсумок уроку (2026-10-27): лише на головній вкладці вікна (як і кнопки уроку), лише урок з учнем,
           що вже почався (BOOKING_DOMAIN_SSOT П1) -->
      <LessonOutcomePanel
        v-if="canHaveOutcome"
        :event-id="event.id"
        :outcome="event.outcome ?? null"
        @changed="(o) => emit('outcome-changed', o)"
        @extra="emit('extra-lesson')"
      />
    </template>

    <StartLessonDialog
      :open="startDialogOpen"
      :student-id="event.studentId ?? null"
      :student-name="event.clientName"
      @close="startDialogOpen = false"
    />
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { Clock as ClockIcon, Phone as PhoneIcon, Monitor as MonitorIcon } from 'lucide-vue-next'
import type { CalendarEvent } from '@/modules/booking/types/calendarWeek'
import { calendarV055Api } from '@/modules/booking/api/calendarV055Api'
import JoinLessonPicker from './JoinLessonPicker.vue'
import LessonOutcomePanel from '@/modules/booking/components/outcome/LessonOutcomePanel.vue'
import type { LessonOutcome } from '@/modules/booking/api/lessonOutcomeApi'
import StartLessonDialog from '@/modules/knowledge/components/StartLessonDialog.vue'
import { activeLocale } from '@/utils/i18nDate'

const props = withDefaults(defineProps<{
  event: CalendarEvent
  dictionaries: any
  /** false — лише відомості про урок (у «Видалити» / «Перенести»), без кнопки дошки й без підсумку */
  actions?: boolean
}>(), { actions: true })

const emit = defineEmits<{
  'outcome-changed': [outcome: LessonOutcome]
  'extra-lesson': []
}>()

// П1: підсумок — лише для уроку з учнем, що вже почався
const canHaveOutcome = computed(() =>
  !!props.event.studentId && new Date(props.event.start).getTime() <= Date.now(),
)

const router = useRouter()
const { t } = useI18n()
const joiningClassroom = ref(false)
const startDialogOpen = ref(false)

async function handleOpenClassroom() {
  // Урок з учнем (власник 2026-10-15, Б-203): кімната події без живого уроку — особиста дошка вчителя,
  // учень туди не потрапить. Тому — вікно «Почати урок з учнем»: нова дошка або готовий урок з «Моїх уроків».
  if (props.event.studentId) {
    startDialogOpen.value = true
    return
  }
  joiningClassroom.value = true
  try {
    // Використовуємо canonical API join endpoint — повертає classroom URL
    const response = await calendarV055Api.joinEventRoom(props.event.id)
    if (response.room?.url) {
      router.push(response.room.url)
    }
  } catch (err: any) {
    const code = err?.response?.data?.code
    const status = err?.response?.status
    if (status === 409 || code === 'room_not_available_yet') {
      alert(t('student.calendar.tooEarly'))
    } else if (status === 410 || code === 'room_expired') {
      alert(t('student.calendar.expired'))
    } else {
      alert(t('student.calendar.joinError'))
    }
  } finally {
    joiningClassroom.value = false
  }
}

function formatDay(utcTime: string): string {
  return new Date(utcTime).toLocaleDateString(activeLocale(), { weekday: 'short', day: 'numeric', month: 'long' })
}

function formatTime(utcTime: string): string {
  const date = new Date(utcTime)
  return date.toLocaleTimeString(activeLocale(), {
    hour: '2-digit',
    minute: '2-digit',
  })
}
</script>

<style scoped>
.event-details {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.ed-when,
.ed-sub {
  display: flex;
  align-items: center;
  gap: 8px;
  margin: 0;
  font-size: 15px;
  font-weight: 600;
  color: var(--text-primary);
}

.ed-sub {
  font-size: 13px;
  font-weight: 400;
  color: var(--text-secondary);
}

.ed-icon {
  width: 16px;
  height: 16px;
  flex: none;
  color: var(--text-secondary);
}

.ed-chips {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.comment-text {
  margin: 0;
  padding: 10px 12px;
  background: var(--bg-secondary);
  border-radius: var(--radius-md);
  font-size: 14px;
  color: var(--text-primary);
  white-space: pre-wrap;
}

/* Кнопка "Відкрити дошку" — головна дія, але звичайного розміру */
.classroom-join-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  width: 100%;
  min-height: 42px;
  padding: 8px 14px;
  background: var(--accent);
  color: var(--color-on-accent);
  border-radius: var(--radius-md);
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  border: none;
}

.classroom-join-btn .ed-icon {
  color: inherit;
}

.classroom-join-btn:hover:not(:disabled) {
  filter: brightness(1.06);
}

.classroom-join-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
  transform: none;
}
</style>
