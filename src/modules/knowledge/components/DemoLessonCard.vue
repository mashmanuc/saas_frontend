<!-- Knowledge: Demo lesson card for tutor profile marketplace section
     Ref: Phase 13 B2.2 -->
<template>
  <router-link
    :to="`/lesson/${lesson.tutor_slug}/${lesson.slug}`"
    class="demo-lesson-card"
    :aria-label="lesson.title"
  >
    <div class="demo-lesson-card__thumbnail">
      <img
        v-if="lesson.board_thumbnail_url"
        :src="lesson.board_thumbnail_url"
        :alt="lesson.title"
        class="demo-lesson-card__img"
        loading="lazy"
        @error="(e: Event) => (e.target as HTMLImageElement).style.display = 'none'"
      />
      <div v-else class="demo-lesson-card__placeholder">
        <svg width="32" height="32" viewBox="0 0 32 32" fill="none" aria-hidden="true">
          <rect x="4" y="6" width="24" height="20" rx="3" stroke="currentColor" stroke-width="1.5"/>
          <path d="M4 12h24" stroke="currentColor" stroke-width="1.5"/>
          <circle cx="9" cy="9" r="1.5" fill="currentColor"/>
          <circle cx="14" cy="9" r="1.5" fill="currentColor"/>
        </svg>
      </div>
      <span class="demo-lesson-card__duration">
        {{ formattedDuration }}
      </span>
    </div>

    <div class="demo-lesson-card__body">
      <h3 class="demo-lesson-card__title">{{ lesson.title }}</h3>
      <div class="demo-lesson-card__meta">
        <SubjectBadge
          v-if="lesson.subject_tag"
          :category-name="lesson.subject_tag"
          size="sm"
        />
        <time class="demo-lesson-card__date" :datetime="lesson.created_at">
          {{ formattedDate }}
        </time>
        <RatingSummary
          v-if="lesson.average_rating"
          :average-rating="lesson.average_rating"
          :rating-count="lesson.rating_count || 0"
          size="sm"
        />
      </div>
    </div>
  </router-link>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import RatingSummary from './RatingSummary.vue'
import SubjectBadge from './SubjectBadge.vue'

export interface DemoLesson {
  id: string
  title: string
  slug: string
  tutor_slug: string
  subject_tag: string
  duration_seconds: number
  created_at: string
  board_thumbnail_url: string | null
  average_rating?: number | null
  rating_count?: number
}

const KNOWN_SUBJECTS = [
  'math', 'physics', 'english', 'ukrainian', 'chemistry',
  'biology', 'history', 'geography', 'informatics',
] as const

const props = defineProps<{
  lesson: DemoLesson
}>()

const { t, locale } = useI18n()

const subjectLabel = computed(() => {
  if (!props.lesson.subject_tag) return ''
  if ((KNOWN_SUBJECTS as readonly string[]).includes(props.lesson.subject_tag)) {
    return t(`subject.${props.lesson.subject_tag}`)
  }
  return props.lesson.subject_tag
})

const formattedDuration = computed(() => {
  const sec = props.lesson.duration_seconds
  if (!sec) return ''
  const mins = Math.floor(sec / 60)
  if (mins >= 60) {
    const hrs = Math.floor(mins / 60)
    const remainMins = mins % 60
    return t('knowledge.demo.durationHours', { hours: hrs, minutes: remainMins })
  }
  return t('knowledge.demo.duration', { minutes: mins })
})

const formattedDate = computed(() => {
  if (!props.lesson.created_at) return ''
  try {
    return new Date(props.lesson.created_at).toLocaleDateString(
      locale.value === 'uk' ? 'uk-UA' : 'en-US',
      { day: 'numeric', month: 'short' },
    )
  } catch {
    return ''
  }
})
</script>

<style scoped>
.demo-lesson-card {
  display: flex;
  flex-direction: column;
  border-radius: 10px;
  border: 1px solid #e2e8f0;
  overflow: hidden;
  text-decoration: none;
  color: inherit;
  transition: box-shadow 0.15s, border-color 0.15s;
}

.demo-lesson-card:hover {
  border-color: #6366f1;
  box-shadow: 0 2px 8px rgba(99, 102, 241, 0.12);
}

.demo-lesson-card:focus-visible {
  outline: 2px solid #6366f1;
  outline-offset: 2px;
}

.demo-lesson-card__thumbnail {
  position: relative;
  aspect-ratio: 16 / 10;
  background: #f1f5f9;
  overflow: hidden;
}

.demo-lesson-card__img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.demo-lesson-card__placeholder {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 100%;
  height: 100%;
  color: #94a3b8;
}

.demo-lesson-card__duration {
  position: absolute;
  bottom: 8px;
  right: 8px;
  padding: 2px 8px;
  background: rgba(0, 0, 0, 0.7);
  color: #ffffff;
  border-radius: 4px;
  font-size: 12px;
  font-weight: 600;
  font-variant-numeric: tabular-nums;
}

.demo-lesson-card__body {
  padding: 12px;
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.demo-lesson-card__title {
  font-size: 14px;
  font-weight: 600;
  color: #0f172a;
  margin: 0;
  line-height: 1.3;
  overflow: hidden;
  text-overflow: ellipsis;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
}

.demo-lesson-card__meta {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}

.demo-lesson-card__subject {
  display: inline-block;
  padding: 2px 8px;
  background: #ede9fe;
  color: #6366f1;
  border-radius: 4px;
  font-size: 11px;
  font-weight: 600;
}

.demo-lesson-card__date {
  font-size: 12px;
  color: #94a3b8;
}
</style>
