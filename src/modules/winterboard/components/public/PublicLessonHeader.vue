<!-- WB: Public lesson header — title, tutor info, date, duration, subject badge
     Ref: PHASE12_PLAN.md B1 / Phase 13 B1.1 -->
<template>
  <header class="public-lesson-header">
    <div class="public-lesson-header__top">
      <h1 class="public-lesson-header__title">{{ title }}</h1>
      <div class="public-lesson-header__badges">
        <span v-if="subjectTag" class="public-lesson-header__subject-badge">
          {{ subjectLabel }}
        </span>
        <span v-if="durationSeconds" class="public-lesson-header__duration">
          <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true">
            <circle cx="8" cy="8" r="7" stroke="currentColor" stroke-width="1.4"/>
            <path d="M8 4v4l2.5 1.5" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
          {{ formattedDuration }}
        </span>
      </div>
    </div>

    <div class="public-lesson-header__meta">
      <div class="public-lesson-header__tutor">
        <img
          :src="avatarSrc"
          :alt="tutorName"
          class="public-lesson-header__avatar"
          @error="onAvatarError"
        />
        <div class="public-lesson-header__tutor-info">
          <router-link
            v-if="tutorSlug"
            :to="`/marketplace/${tutorSlug}`"
            class="public-lesson-header__tutor-name public-lesson-header__tutor-link"
          >
            {{ tutorName }}
          </router-link>
          <span v-else class="public-lesson-header__tutor-name">{{ tutorName }}</span>
        </div>
      </div>

      <time v-if="createdAt" class="public-lesson-header__date" :datetime="createdAt">
        {{ formattedDate }}
      </time>
    </div>
  </header>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { useI18n } from 'vue-i18n'

const FALLBACK_AVATAR = '/default-avatar.svg'

const KNOWN_SUBJECTS = [
  'math', 'physics', 'english', 'ukrainian', 'chemistry',
  'biology', 'history', 'geography', 'informatics',
] as const

const props = defineProps<{
  title: string
  tutorName: string
  tutorAvatarUrl: string | null
  tutorSlug: string
  subjectTag: string
  durationSeconds: number
  createdAt: string
}>()

const { t, locale } = useI18n()

const avatarFailed = ref(false)

const avatarSrc = computed(() => {
  if (avatarFailed.value || !props.tutorAvatarUrl) return FALLBACK_AVATAR
  return props.tutorAvatarUrl
})

function onAvatarError(): void {
  avatarFailed.value = true
}

const subjectLabel = computed(() => {
  if (!props.subjectTag) return ''
  if ((KNOWN_SUBJECTS as readonly string[]).includes(props.subjectTag)) {
    return t(`subject.${props.subjectTag}`)
  }
  return props.subjectTag
})

const formattedDuration = computed(() => {
  if (!props.durationSeconds) return ''
  const mins = Math.floor(props.durationSeconds / 60)
  const secs = props.durationSeconds % 60
  if (mins >= 60) {
    const hrs = Math.floor(mins / 60)
    const remainMins = mins % 60
    return `${hrs} ${t('publicLesson.header.hourShort')} ${remainMins} ${t('publicLesson.header.minShort')}`
  }
  return secs > 0
    ? `${mins}:${String(secs).padStart(2, '0')}`
    : `${mins} ${t('publicLesson.header.minShort')}`
})

const formattedDate = computed(() => {
  if (!props.createdAt) return ''
  try {
    return new Date(props.createdAt).toLocaleDateString(
      locale.value === 'uk' ? 'uk-UA' : 'en-US',
      { day: 'numeric', month: 'long', year: 'numeric' },
    )
  } catch {
    return props.createdAt
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

.public-lesson-header__badges {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-shrink: 0;
}

.public-lesson-header__subject-badge {
  display: inline-flex;
  align-items: center;
  padding: 4px 10px;
  background: #ede9fe;
  color: #6366f1;
  border-radius: 6px;
  font-size: 12px;
  font-weight: 600;
  white-space: nowrap;
}

.public-lesson-header__tutor-link {
  color: #6366f1;
  text-decoration: none;
  transition: color 0.12s;
}

.public-lesson-header__tutor-link:hover {
  color: #4f46e5;
  text-decoration: underline;
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
