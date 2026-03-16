<!-- WB: Tutor CTA card — viral loop component for public lesson page
     Ref: PHASE12_PLAN.md B5 / Phase 13 B2.1 -->
<template>
  <div class="tutor-cta" role="complementary" :aria-label="t('publicLesson.cta.ariaLabel')">
    <div class="tutor-cta__header">
      <img
        :src="avatarSrc"
        :alt="tutorName"
        class="tutor-cta__avatar"
        @error="onAvatarError"
      />

      <div class="tutor-cta__info">
        <span class="tutor-cta__name">{{ tutorName }}</span>
        <div v-if="subjectTags.length" class="tutor-cta__subjects">
          <span
            v-for="tag in subjectTags"
            :key="tag"
            class="tutor-cta__subject-chip"
          >{{ subjectLabel(tag) }}</span>
        </div>
        <div v-if="ratingAvg" class="tutor-cta__rating">
          <svg
            v-for="i in 5"
            :key="i"
            width="14"
            height="14"
            viewBox="0 0 14 14"
            fill="none"
            aria-hidden="true"
          >
            <path
              d="M7 1l1.5 3 3.3.5-2.4 2.3.6 3.3L7 8.4l-3 1.7.6-3.3L2.2 4.5l3.3-.5L7 1z"
              :fill="i <= Math.round(ratingAvg) ? '#f59e0b' : '#e2e8f0'"
              stroke="none"
            />
          </svg>
          <span class="tutor-cta__rating-value">{{ ratingAvg.toFixed(1) }}</span>
          <span v-if="ratingCount" class="tutor-cta__rating-count">({{ ratingCount }})</span>
        </div>
      </div>
    </div>

    <div v-if="priceFromUah" class="tutor-cta__price">
      {{ t('publicLesson.cta.priceFrom', { price: priceFromUah }) }}
    </div>

    <div class="tutor-cta__actions">
      <router-link
        :to="bookUrl"
        class="tutor-cta__btn tutor-cta__btn--primary"
      >
        {{ t('publicLesson.cta.book') }}
      </router-link>
      <router-link
        v-if="tutorSlug"
        :to="profileUrl"
        class="tutor-cta__btn tutor-cta__btn--outline"
      >
        {{ t('publicLesson.cta.viewProfile') }}
      </router-link>
    </div>

    <p class="tutor-cta__hint">{{ t('publicLesson.cta.hint') }}</p>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { useAuthStore } from '@/modules/auth/store/authStore'

const FALLBACK_AVATAR = '/default-avatar.svg'

const KNOWN_SUBJECTS = [
  'math', 'physics', 'english', 'ukrainian', 'chemistry',
  'biology', 'history', 'geography', 'informatics',
] as const

const props = defineProps<{
  tutorName: string
  tutorAvatarUrl: string | null
  tutorSlug: string
  subjectTags: string[]
  ratingAvg: number | null
  ratingCount: number
  priceFromUah: number | null
  lessonSlug: string
}>()

const { t } = useI18n()
const auth = useAuthStore()

const avatarFailed = ref(false)

const avatarSrc = computed(() => {
  if (avatarFailed.value || !props.tutorAvatarUrl) return FALLBACK_AVATAR
  return props.tutorAvatarUrl
})

function onAvatarError(): void {
  avatarFailed.value = true
}

function subjectLabel(tag: string): string {
  if ((KNOWN_SUBJECTS as readonly string[]).includes(tag)) {
    return t(`subject.${tag}`)
  }
  return tag
}

const profileUrl = computed(() => `/marketplace/${props.tutorSlug}`)

const bookUrl = computed(() => {
  const refParam = props.lessonSlug ? `lesson_${props.lessonSlug}` : ''
  if (auth.isAuthenticated) {
    return `/marketplace/${props.tutorSlug}${refParam ? `?ref=${refParam}` : ''}`
  }
  const redirect = encodeURIComponent(`/marketplace/${props.tutorSlug}`)
  return `/auth/register?ref=${refParam}&redirect=${redirect}`
})
</script>

<style scoped>
.tutor-cta {
  background: #ffffff;
  border: 1px solid #e2e8f0;
  border-radius: 12px;
  padding: 20px;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.06);
}

.tutor-cta__header {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 16px;
}

.tutor-cta__avatar {
  width: 52px;
  height: 52px;
  border-radius: 50%;
  object-fit: cover;
  flex-shrink: 0;
}

.tutor-cta__avatar--placeholder {
  display: flex;
  align-items: center;
  justify-content: center;
  background: #6366f1;
  color: #ffffff;
  font-weight: 700;
  font-size: 20px;
}

.tutor-cta__info {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.tutor-cta__name {
  font-size: 16px;
  font-weight: 700;
  color: #0f172a;
}

.tutor-cta__subjects {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
}

.tutor-cta__subject-chip {
  display: inline-block;
  padding: 2px 8px;
  background: #ede9fe;
  color: #6366f1;
  border-radius: 4px;
  font-size: 11px;
  font-weight: 600;
}

.tutor-cta__rating {
  display: flex;
  align-items: center;
  gap: 2px;
  margin-top: 2px;
}

.tutor-cta__rating-value {
  font-size: 12px;
  font-weight: 600;
  color: #475569;
  margin-left: 4px;
}

.tutor-cta__rating-count {
  font-size: 11px;
  color: #94a3b8;
  margin-left: 2px;
}

.tutor-cta__price {
  font-size: 14px;
  font-weight: 600;
  color: #0f172a;
  padding: 10px 0;
  border-top: 1px solid #f1f5f9;
  border-bottom: 1px solid #f1f5f9;
  margin-bottom: 16px;
}

.tutor-cta__actions {
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin-bottom: 12px;
}

.tutor-cta__btn {
  display: block;
  text-align: center;
  padding: 10px 16px;
  border-radius: 8px;
  font-size: 14px;
  font-weight: 600;
  text-decoration: none;
  transition: background 0.15s, color 0.15s;
}

.tutor-cta__btn--primary {
  background: #6366f1;
  color: #ffffff;
}

.tutor-cta__btn--primary:hover {
  background: #4f46e5;
}

.tutor-cta__btn--outline {
  background: none;
  color: #6366f1;
  border: 1px solid #e2e8f0;
}

.tutor-cta__btn--outline:hover {
  background: #f8fafc;
}

.tutor-cta__hint {
  font-size: 11px;
  color: #94a3b8;
  text-align: center;
  margin: 0;
  line-height: 1.4;
}
</style>
