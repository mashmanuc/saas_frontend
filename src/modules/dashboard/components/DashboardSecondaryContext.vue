<template>
  <aside
    v-if="hasContent"
    class="dashboard-secondary"
    data-testid="dashboard-secondary"
  >
    <ul class="dashboard-secondary__list">
      <li
        v-if="data.today_lessons_remaining && data.today_lessons_remaining.length > 0"
        class="dashboard-secondary__item"
      >
        <span class="dashboard-secondary__icon" aria-hidden="true">📅</span>
        <span>
          {{
            $t('dashboard.secondary.today_remaining', {
              count: data.today_lessons_remaining.length,
            })
          }}
          <span class="dashboard-secondary__detail">
            {{ formatTodayList(data.today_lessons_remaining) }}
          </span>
        </span>
      </li>

      <li
        v-if="(data.pending_inquiries_count ?? 0) > 0"
        class="dashboard-secondary__item"
      >
        <span class="dashboard-secondary__icon" aria-hidden="true">📨</span>
        <span>
          {{
            $t('dashboard.secondary.pending_inquiries', {
              count: data.pending_inquiries_count,
            })
          }}
        </span>
      </li>

      <li
        v-if="data.draft_lessons && data.draft_lessons.length > 0"
        class="dashboard-secondary__item"
      >
        <span class="dashboard-secondary__icon" aria-hidden="true">📖</span>
        <span>
          {{
            $t('dashboard.secondary.draft_lessons', {
              count: data.draft_lessons.length,
            })
          }}
        </span>
      </li>

      <li v-if="data.last_completed_lesson" class="dashboard-secondary__item">
        <span class="dashboard-secondary__icon" aria-hidden="true">✅</span>
        <span>
          {{
            $t('dashboard.secondary.last_completed', {
              counterpart: data.last_completed_lesson.counterpart_name,
            })
          }}
        </span>
      </li>
    </ul>
  </aside>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import type { DashboardSecondary } from '../api/dashboard'

const props = defineProps<{
  data: DashboardSecondary
}>()

const hasContent = computed(() => {
  return (
    (props.data.today_lessons_remaining && props.data.today_lessons_remaining.length > 0) ||
    (props.data.pending_inquiries_count ?? 0) > 0 ||
    (props.data.draft_lessons && props.data.draft_lessons.length > 0) ||
    !!props.data.last_completed_lesson
  )
})

function formatTodayList(items: NonNullable<DashboardSecondary['today_lessons_remaining']>) {
  return items
    .slice(0, 3)
    .map((it) => {
      const time = it.time ? new Date(it.time).toLocaleTimeString('uk', {
        hour: '2-digit',
        minute: '2-digit',
      }) : '—'
      return `${time} ${it.student_name}`
    })
    .join(' · ')
}
</script>

<style scoped>
.dashboard-secondary {
  padding: var(--space-md, 12px) var(--space-lg, 16px);
  background: var(--bg-secondary, #f9fafb);
  border-radius: var(--radius-md, 8px);
  border: 1px solid var(--border-color, #e5e7eb);
}

.dashboard-secondary__list {
  list-style: none;
  padding: 0;
  margin: 0;
  display: flex;
  flex-direction: column;
  gap: var(--space-xs, 6px);
}

.dashboard-secondary__item {
  display: flex;
  align-items: flex-start;
  gap: var(--space-sm, 8px);
  font-size: 0.875rem;
  color: var(--text-secondary, #6b7280);
}

.dashboard-secondary__icon {
  flex-shrink: 0;
  font-size: 1rem;
  line-height: 1.2;
}

.dashboard-secondary__detail {
  display: block;
  margin-top: 2px;
  font-size: 0.8125rem;
  color: var(--text-muted, #9ca3af);
}
</style>
