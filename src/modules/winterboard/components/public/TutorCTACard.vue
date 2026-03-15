<!-- WB: Tutor CTA card — viral loop component for public lesson page
     Ref: PHASE12_PLAN.md B5 / §TutorCTACard -->
<template>
  <div class="tutor-cta">
    <div class="tutor-cta__header">
      <img
        v-if="tutorAvatar"
        :src="tutorAvatar"
        :alt="tutorName"
        class="tutor-cta__avatar"
      />
      <div v-else class="tutor-cta__avatar tutor-cta__avatar--placeholder">
        {{ tutorInitial }}
      </div>

      <div class="tutor-cta__info">
        <span class="tutor-cta__name">{{ tutorName }}</span>
        <span v-if="subjects" class="tutor-cta__subjects">{{ subjects }}</span>
        <div v-if="rating" class="tutor-cta__rating">
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
              :fill="i <= Math.round(rating) ? '#f59e0b' : '#e2e8f0'"
              stroke="none"
            />
          </svg>
          <span class="tutor-cta__rating-value">{{ rating.toFixed(1) }}</span>
        </div>
      </div>
    </div>

    <div v-if="priceFrom" class="tutor-cta__price">
      {{ t('publicLesson.cta.priceFrom', { price: priceFrom }) }}
    </div>

    <div class="tutor-cta__actions">
      <a
        :href="bookUrl"
        class="tutor-cta__btn tutor-cta__btn--primary"
      >
        {{ t('publicLesson.cta.book') }}
      </a>
      <a
        v-if="profileUrl"
        :href="profileUrl"
        class="tutor-cta__btn tutor-cta__btn--outline"
      >
        {{ t('publicLesson.cta.viewProfile') }}
      </a>
    </div>

    <p class="tutor-cta__hint">{{ t('publicLesson.cta.hint') }}</p>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'

const props = defineProps<{
  tutorName: string
  tutorAvatar?: string | null
  tutorSlug?: string
  lessonSlug?: string
  subjects?: string
  rating?: number | null
  priceFrom?: number | null
  isAuthenticated?: boolean
}>()

const { t } = useI18n()

const tutorInitial = computed(() =>
  props.tutorName?.charAt(0).toUpperCase() || '?',
)

const profileUrl = computed(() =>
  props.tutorSlug ? `/marketplace/${props.tutorSlug}` : null,
)

const bookUrl = computed(() => {
  if (props.isAuthenticated && props.tutorSlug) {
    return `/marketplace/${props.tutorSlug}`
  }
  const ref = props.lessonSlug ? `lesson_${props.lessonSlug}` : ''
  return `/auth/register${ref ? `?ref=${ref}` : ''}`
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
  font-size: 13px;
  color: #64748b;
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
