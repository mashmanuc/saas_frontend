<template>
  <div v-if="isVisible" class="tutor-journey-panel">
    <p class="tutor-journey-panel__title">Твій прогрес</p>

    <ul class="tutor-journey-panel__list" role="list">
      <li
        v-for="ms in milestones"
        :key="ms.key"
        class="tutor-journey-panel__item"
        :class="{ 'tutor-journey-panel__item--done': ms.done }"
      >
        <span class="tutor-journey-panel__icon" aria-hidden="true">
          {{ ms.done ? '✓' : '○' }}
        </span>
        <span class="tutor-journey-panel__label">{{ ms.label }}</span>
      </li>
    </ul>

    <!-- CTA тільки поки перший урок ще не створено -->
    <div v-if="!firstLessonDone" class="tutor-journey-panel__footer">
      <router-link
        :to="{ name: 'winterboard-boards' }"
        class="tutor-journey-panel__cta"
      >
        Студія уроків →
      </router-link>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import type { ActivationStateDTO } from '@/types/activation'

// ── Props ─────────────────────────────────────────────────────────────────────

const props = defineProps<{
  /** Raw activation state — null під час завантаження */
  state?: ActivationStateDTO
  /** Кількість draft lessons з dashboard snapshot */
  draftLessonsCount?: number
}>()

// ── Milestones ────────────────────────────────────────────────────────────────

const milestones = computed(() => [
  {
    key: 'profile_created',
    label: 'Профіль створено',
    done: !!props.state?.marketplace_draft_started_at,
  },
  {
    key: 'subjects_added',
    label: 'Предмети додані',
    done: !!props.state?.profile_bio_set_at,
  },
  {
    key: 'first_lesson',
    label: 'Перший урок',
    done: (props.draftLessonsCount ?? 0) > 0,
  },
  {
    key: 'first_classroom',
    label: 'Перший classroom',
    done: !!props.state?.first_lesson_completed_at,
  },
])

const firstLessonDone = computed(() => (props.draftLessonsCount ?? 0) > 0)

// Ховаємо панель якщо state не завантажено або всі 4 виконано
const isVisible = computed<boolean>(() => {
  if (!props.state) return false
  return milestones.value.some(ms => !ms.done)
})
</script>

<style scoped>
.tutor-journey-panel {
  background: var(--bg-card, #fff);
  border: 1px solid var(--border-color, #e5e7eb);
  border-radius: var(--radius-lg, 12px);
  padding: var(--space-lg, 20px);
  display: flex;
  flex-direction: column;
  gap: var(--space-md, 12px);
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.06);
}

/* ── Title ── */
.tutor-journey-panel__title {
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: var(--accent, #10b981);
  margin: 0;
}

/* ── List ── */
.tutor-journey-panel__list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.tutor-journey-panel__item {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 14px;
  color: var(--text-muted, #9ca3af);
}

.tutor-journey-panel__item--done {
  color: var(--text-primary, #111827);
}

.tutor-journey-panel__icon {
  font-size: 13px;
  width: 16px;
  text-align: center;
  flex-shrink: 0;
  color: var(--accent, #10b981);
}

.tutor-journey-panel__item:not(.tutor-journey-panel__item--done) .tutor-journey-panel__icon {
  color: var(--text-muted, #d1d5db);
}

.tutor-journey-panel__label {
  line-height: 1.4;
}

/* ── CTA ── */
.tutor-journey-panel__footer {
  display: flex;
}

.tutor-journey-panel__cta {
  display: inline-flex;
  align-items: center;
  padding: 8px 16px;
  background: transparent;
  color: var(--accent, #10b981);
  border: 1.5px solid var(--accent, #10b981);
  border-radius: var(--radius-md, 8px);
  font-size: 13px;
  font-weight: 600;
  text-decoration: none;
  transition: background 0.15s, color 0.15s;
}

.tutor-journey-panel__cta:hover {
  background: var(--accent, #10b981);
  color: #fff;
}
</style>
