<template>
  <section class="lesson-outcome" data-testid="lesson-outcome">
    <p class="lesson-outcome__title">{{ t('calendar.outcome.title') }}</p>
    <div class="lesson-outcome__row" role="group" :aria-label="t('calendar.outcome.title')">
      <button
        type="button"
        class="lesson-outcome__btn lesson-outcome__btn--held"
        :class="{ 'is-active': current === 'held' }"
        :aria-pressed="current === 'held'"
        :disabled="saving"
        data-testid="lesson-outcome-held"
        @click="choose('held')"
      >
        ✓ {{ t('calendar.outcome.held') }}
      </button>
      <button
        type="button"
        class="lesson-outcome__btn lesson-outcome__btn--not-held"
        :class="{ 'is-active': current === 'not_held' }"
        :aria-pressed="current === 'not_held'"
        :disabled="saving"
        data-testid="lesson-outcome-not-held"
        @click="choose('not_held')"
      >
        {{ t('calendar.outcome.notHeld') }}
      </button>
    </div>
    <p v-if="current === 'not_held'" class="lesson-outcome__hint" data-testid="lesson-outcome-hint">
      {{ t('calendar.outcome.notCountedHint') }}
    </p>
    <button type="button" class="lesson-outcome__extra" data-testid="lesson-outcome-extra" @click="emit('extra')">
      {{ current === 'not_held' ? t('calendar.outcome.newTime') : t('calendar.outcome.extra') }}
    </button>
    <p v-if="error" class="lesson-outcome__error" role="alert">{{ error }}</p>
  </section>
</template>

<script setup lang="ts">
// Підсумок уроку (власник 2026-10-27: «зразу після уроку або між уроками відзначити, що відбулось, не відбулось
// заняття… або ще зробити додаткове заняття»). Правила П1–П8 — BOOKING_DOMAIN_SSOT. Місце для кроку програми учня
// (П8, лінія Лови) — нижче цієї панелі, коли програма буде.
import { ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { lessonOutcomeApi, type LessonOutcome } from '@/modules/booking/api/lessonOutcomeApi'

const props = defineProps<{
  eventId: number
  outcome: LessonOutcome | null
}>()

const emit = defineEmits<{
  changed: [outcome: LessonOutcome]
  extra: []
}>()

const { t } = useI18n()
const current = ref<LessonOutcome | null>(props.outcome)
const saving = ref(false)
const error = ref('')

watch(() => props.outcome, (v) => { current.value = v })

async function choose(outcome: LessonOutcome): Promise<void> {
  if (saving.value || current.value === outcome) return
  saving.value = true
  error.value = ''
  try {
    const event = await lessonOutcomeApi.setOutcome(props.eventId, outcome)
    current.value = event.outcome
    emit('changed', outcome)
  } catch (err: any) {
    error.value = err?.response?.data?.error?.message || t('calendar.outcome.saveError')
  } finally {
    saving.value = false
  }
}
</script>

<style scoped>
.lesson-outcome {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 12px;
  background: var(--bg-secondary);
  border-radius: var(--radius-md);
}

.lesson-outcome__title {
  font-size: 14px;
  font-weight: 600;
  color: var(--text-primary);
}

.lesson-outcome__row {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 8px;
}

.lesson-outcome__btn {
  padding: 10px 12px;
  border: 1px solid var(--border-color);
  border-radius: var(--radius-md);
  background: var(--card-bg);
  color: var(--text-primary);
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
}

.lesson-outcome__btn:disabled {
  cursor: wait;
}

/* Кольори — ті, що оголошені в усіх темах (світла, темна, класична): --success-bg / --danger-bg і текст на заливці */
.lesson-outcome__btn--held.is-active {
  background: var(--success-bg);
  border-color: var(--success-bg);
  color: var(--color-on-accent);
}

.lesson-outcome__btn--not-held.is-active {
  background: var(--danger-bg);
  border-color: var(--danger-bg);
  color: var(--color-on-accent);
}

.lesson-outcome__hint {
  font-size: 12px;
  color: var(--text-secondary);
}

.lesson-outcome__extra {
  align-self: flex-start;
  padding: 6px 0;
  border: none;
  background: none;
  color: var(--accent);
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
}

.lesson-outcome__error {
  font-size: 13px;
  color: var(--danger-bg);
}
</style>
