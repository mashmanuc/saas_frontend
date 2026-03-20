<template>
  <div class="lesson-cta">
    <div class="lesson-cta__content">
      <h3 class="lesson-cta__title">{{ $t('knowledge.lesson.cta.title') }}</h3>
      <p class="lesson-cta__subtitle">{{ $t('knowledge.lesson.cta.subtitle') }}</p>
      <div class="lesson-cta__buttons">
        <button @click="bookLesson" class="lesson-cta__btn lesson-cta__btn--primary">
          {{ $t('knowledge.lesson.cta.bookLesson') }}
        </button>
        <button @click="askTutor" class="lesson-cta__btn lesson-cta__btn--secondary">
          {{ $t('knowledge.lesson.cta.askTutor') }}
        </button>
      </div>
    </div>
  </div>
</template>

<script setup>
const props = defineProps({
  tutor: {
    type: Object,
    required: true,
  },
})

function bookLesson() {
  // Phase 23: booking integration
  if (props.tutor.slug) {
    window.open(`/tutor/${props.tutor.slug}`, '_blank')
  }
}

function askTutor() {
  // Phase 23: chat integration
  if (props.tutor.slug) {
    window.open(`/tutor/${props.tutor.slug}`, '_blank')
  }
}
</script>

<style scoped>
.lesson-cta {
  margin-top: 2.5rem;
  padding: 2rem 1.5rem;
  border-radius: 12px;
  background: linear-gradient(135deg, var(--color-accent-light, #e0e7ff) 0%, var(--color-accent, #6366f1) 100%);
  text-align: center;
}

.lesson-cta__content {
  max-width: 600px;
  margin: 0 auto;
}

.lesson-cta__title {
  font-size: 1.375rem;
  font-weight: 700;
  color: #fff;
  margin: 0 0 0.5rem;
}

.lesson-cta__subtitle {
  font-size: 1rem;
  color: rgba(255, 255, 255, 0.85);
  margin: 0 0 1.5rem;
}

.lesson-cta__buttons {
  display: flex;
  gap: 0.75rem;
  justify-content: center;
  flex-wrap: wrap;
}

.lesson-cta__btn {
  padding: 0.625rem 1.5rem;
  border-radius: 8px;
  font-size: 0.9375rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.15s ease;
  border: none;
}

.lesson-cta__btn--primary {
  background: #fff;
  color: var(--color-accent, #6366f1);
}

.lesson-cta__btn--primary:hover {
  transform: translateY(-1px);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
}

.lesson-cta__btn--secondary {
  background: transparent;
  color: #fff;
  border: 1.5px solid rgba(255, 255, 255, 0.6);
}

.lesson-cta__btn--secondary:hover {
  background: rgba(255, 255, 255, 0.1);
}
</style>
