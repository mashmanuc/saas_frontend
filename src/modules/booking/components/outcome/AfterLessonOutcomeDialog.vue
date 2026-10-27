<template>
  <Modal
    :open="!!event"
    :title="t('calendar.outcome.afterTitle')"
    size="sm"
    stacked
    @close="close"
  >
    <div v-if="event" class="after-lesson" data-testid="after-lesson-outcome">
      <p class="after-lesson__who">{{ event.studentName }} · {{ timeRange }}</p>
      <LessonOutcomePanel
        :event-id="event.id"
        :outcome="event.outcome"
        @changed="(o) => { if (event) event.outcome = o }"
        @extra="openExtra"
      />
    </div>
    <template #footer>
      <button type="button" class="after-lesson__close" data-testid="after-lesson-close" @click="close">
        {{ event?.outcome ? t('calendar.outcome.done') : t('calendar.outcome.later') }}
      </button>
    </template>
  </Modal>
</template>

<script setup lang="ts">
// П7 (BOOKING_DOMAIN_SSOT): після «Завершити урок» — підсумок уроку розкладу, якщо в уроку є пара в розкладі.
// «Пізніше» нічого не записує; «+ Додаткове заняття» — розклад з відкритим створенням уроку для цього учня (П5).
import { computed, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import Modal from '@/ui/Modal.vue'
import LessonOutcomePanel from './LessonOutcomePanel.vue'
import { lessonOutcomeApi, type OutcomeEvent } from '@/modules/booking/api/lessonOutcomeApi'
import { useAfterLessonOutcome } from '@/modules/booking/composables/afterLessonOutcome'
import { activeLocale } from '@/utils/i18nDate'

const { t } = useI18n()
const router = useRouter()
const { pendingSessionId, clear } = useAfterLessonOutcome()
const event = ref<OutcomeEvent | null>(null)

watch(pendingSessionId, async (sid) => {
  if (!sid) return
  try {
    event.value = await lessonOutcomeApi.eventForSession(sid)
  } catch (err) {
    // Підсумок — не перешкода: учитель поставить його в розкладі; помилку видно в консолі.
    console.warn('[AfterLessonOutcome] lookup failed', err)
    event.value = null
  } finally {
    clear()
  }
})

const timeRange = computed(() => {
  if (!event.value) return ''
  const f = (iso: string) => new Date(iso).toLocaleTimeString(activeLocale(), { hour: '2-digit', minute: '2-digit' })
  return `${f(event.value.start)}–${f(event.value.end)}`
})

function close(): void {
  event.value = null
}

function openExtra(): void {
  const ev = event.value
  if (!ev?.studentId) return
  const lessonStart = new Date(ev.start)
  const start = new Date()
  start.setDate(start.getDate() + 1)
  start.setHours(lessonStart.getHours(), lessonStart.getMinutes(), 0, 0)
  close()
  void router.push({ path: '/tutor/schedule', query: { extraLesson: String(ev.studentId), at: start.toISOString() } })
}
</script>

<style scoped>
.after-lesson {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.after-lesson__who {
  font-size: 14px;
  color: var(--text-secondary);
}

.after-lesson__close {
  padding: 8px 16px;
  border: 1px solid var(--border-color);
  border-radius: var(--radius-md);
  background: var(--card-bg);
  color: var(--text-primary);
  font-weight: 600;
  cursor: pointer;
}
</style>
