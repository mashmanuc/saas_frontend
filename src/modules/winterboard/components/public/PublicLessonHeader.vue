<!-- WB: Public lesson header — title, tutor info, date, duration
     Ref: PHASE12_PLAN.md B1 -->
<template>
  <header class="public-lesson-header">
    <div class="public-lesson-header__top">
      <h1 class="public-lesson-header__title">{{ title }}</h1>
      <span v-if="duration" class="public-lesson-header__duration">
        <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true">
          <circle cx="8" cy="8" r="7" stroke="currentColor" stroke-width="1.4"/>
          <path d="M8 4v4l2.5 1.5" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>
        {{ formattedDuration }}
      </span>
    </div>

    <div class="public-lesson-header__meta">
      <div class="public-lesson-header__tutor">
        <img
          v-if="tutorAvatar"
          :src="tutorAvatar"
          :alt="tutorName"
          class="public-lesson-header__avatar"
        />
        <div v-else class="public-lesson-header__avatar public-lesson-header__avatar--placeholder">
          {{ tutorInitial }}
        </div>
        <div class="public-lesson-header__tutor-info">
          <span class="public-lesson-header__tutor-name">{{ tutorName }}</span>
          <span v-if="subject" class="public-lesson-header__subject">{{ subject }}</span>
        </div>
      </div>

      <time v-if="date" class="public-lesson-header__date" :datetime="date">
        {{ formattedDate }}
      </time>
    </div>
  </header>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'

const props = defineProps<{
  title: string
  tutorName: string
  tutorAvatar?: string | null
  subject?: string
  date?: string
  duration?: number // seconds
}>()

const { t, locale } = useI18n()

const tutorInitial = computed(() =>
  props.tutorName?.charAt(0).toUpperCase() || '?',
)

const formattedDuration = computed(() => {
  if (!props.duration) return ''
  const mins = Math.floor(props.duration / 60)
  const secs = props.duration % 60
  if (mins >= 60) {
    const hrs = Math.floor(mins / 60)
    const remainMins = mins % 60
    return `${hrs}${t('publicLesson.header.hourShort')} ${remainMins}${t('publicLesson.header.minShort')}`
  }
  return secs > 0
    ? `${mins}:${String(secs).padStart(2, '0')}`
    : `${mins} ${t('publicLesson.header.minShort')}`
})

const formattedDate = computed(() => {
  if (!props.date) return ''
  try {
    return new Date(props.date).toLocaleDateString(
      locale.value === 'uk' ? 'uk-UA' : 'en-US',
      { day: 'numeric', month: 'long', year: 'numeric' },
    )
  } catch {
    return props.date
  }
})
</script>

<style scoped>
.public-lesson-header {
  padding: 24px 0;
  border-bottom: 1px solid #e2e8f0;
}

.public-lesson-header__top {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
  margin-bottom: 16px;
}

.public-lesson-header__title {
  font-size: 24px;
  font-weight: 700;
  color: #0f172a;
  margin: 0;
  line-height: 1.3;
}

.public-lesson-header__duration {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 4px 10px;
  background: #f1f5f9;
  border-radius: 6px;
  font-size: 13px;
  font-weight: 600;
  color: #475569;
  white-space: nowrap;
  flex-shrink: 0;
}

.public-lesson-header__meta {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
}

.public-lesson-header__tutor {
  display: flex;
  align-items: center;
  gap: 10px;
}

.public-lesson-header__avatar {
  width: 40px;
  height: 40px;
  border-radius: 50%;
  object-fit: cover;
  flex-shrink: 0;
}

.public-lesson-header__avatar--placeholder {
  display: flex;
  align-items: center;
  justify-content: center;
  background: #6366f1;
  color: #ffffff;
  font-weight: 700;
  font-size: 16px;
}

.public-lesson-header__tutor-info {
  display: flex;
  flex-direction: column;
}

.public-lesson-header__tutor-name {
  font-size: 15px;
  font-weight: 600;
  color: #0f172a;
}

.public-lesson-header__subject {
  font-size: 13px;
  color: #64748b;
}

.public-lesson-header__date {
  font-size: 13px;
  color: #94a3b8;
  white-space: nowrap;
}

@media (max-width: 640px) {
  .public-lesson-header__top {
    flex-direction: column;
    gap: 8px;
  }

  .public-lesson-header__title {
    font-size: 20px;
  }

  .public-lesson-header__meta {
    flex-direction: column;
    align-items: flex-start;
    gap: 8px;
  }
}
</style>
