<template>
  <div class="lesson-hero">
    <div class="lesson-hero__container">
      <!-- Tutor info -->
      <div class="lesson-hero__tutor">
        <img
          v-if="lesson.tutor.photo"
          :src="lesson.tutor.photo"
          :alt="lesson.tutor.name"
          class="lesson-hero__tutor-photo"
        />
        <div v-else class="lesson-hero__tutor-photo lesson-hero__tutor-photo--placeholder">
          {{ lesson.tutor.name?.charAt(0) || '?' }}
        </div>
        <div class="lesson-hero__tutor-info">
          <span class="lesson-hero__tutor-name">{{ lesson.tutor.name }}</span>
          <span class="lesson-hero__tutor-label">{{ $t('knowledge.lesson.tutor') }}</span>
        </div>
      </div>

      <!-- Lesson info -->
      <h1 class="lesson-hero__title">{{ lesson.title }}</h1>
      <p v-if="lesson.description" class="lesson-hero__description">{{ lesson.description }}</p>

      <div class="lesson-hero__meta">
        <span class="lesson-hero__tag">{{ lesson.subject_tag }}</span>
        <span v-if="lesson.visibility === 'public'" class="lesson-hero__badge lesson-hero__badge--public">
          {{ $t('knowledge.lesson.public') }}
        </span>
      </div>

      <!-- Start Replay button: SECONDARY when owner (PRIMARY is "Використати") -->
      <div v-if="access.can_replay && lesson.snapshot_url" class="lesson-hero__action">
        <button
          @click="$emit('start-replay')"
          :class="isOwner ? 'lesson-hero__play-btn lesson-hero__play-btn--secondary' : 'lesson-hero__play-btn'"
        >
          {{ $t('knowledge.lesson.startReplay') }}
        </button>
      </div>

      <!-- No snapshot available -->
      <div v-else-if="access.can_replay && !lesson.snapshot_url" class="lesson-hero__no-replay">
        <p>{{ $t('knowledge.lesson.error.brokenSnapshot') }}</p>
      </div>
    </div>
  </div>
</template>

<script setup>
defineProps({
  lesson: {
    type: Object,
    required: true,
  },
  access: {
    type: Object,
    required: true,
  },
  isOwner: {
    type: Boolean,
    default: false,
  },
})

defineEmits(['start-replay'])
</script>

<style scoped>
.lesson-hero {
  padding: 3rem 1.5rem;
  max-width: 800px;
  margin: 0 auto;
}

.lesson-hero__container {
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
}

.lesson-hero__tutor {
  display: flex;
  align-items: center;
  gap: 0.75rem;
}

.lesson-hero__tutor-photo {
  width: 48px;
  height: 48px;
  border-radius: 50%;
  object-fit: cover;
}

.lesson-hero__tutor-photo--placeholder {
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--color-accent, #6366f1);
  color: #fff;
  font-size: 1.25rem;
  font-weight: 700;
}

.lesson-hero__tutor-info {
  display: flex;
  flex-direction: column;
}

.lesson-hero__tutor-name {
  font-weight: 600;
  color: var(--color-text-primary, #111);
  font-size: 0.9375rem;
}

.lesson-hero__tutor-label {
  font-size: 0.8125rem;
  color: var(--color-text-tertiary, #999);
}

.lesson-hero__title {
  font-size: 2rem;
  font-weight: 800;
  color: var(--color-text-primary, #111);
  margin: 0;
  line-height: 1.2;
}

.lesson-hero__description {
  font-size: 1.0625rem;
  color: var(--color-text-secondary, #555);
  line-height: 1.6;
  margin: 0;
}

.lesson-hero__meta {
  display: flex;
  gap: 0.5rem;
  flex-wrap: wrap;
  align-items: center;
}

.lesson-hero__tag {
  display: inline-block;
  padding: 0.25rem 0.75rem;
  border-radius: 999px;
  font-size: 0.8125rem;
  font-weight: 500;
  background: var(--color-bg-secondary, #f5f5f5);
  color: var(--color-text-secondary, #555);
}

.lesson-hero__badge {
  display: inline-block;
  padding: 0.25rem 0.75rem;
  border-radius: 999px;
  font-size: 0.75rem;
  font-weight: 600;
}

.lesson-hero__badge--public {
  background: #dcfce7;
  color: #166534;
}

.lesson-hero__action {
  padding-top: 0.5rem;
}

.lesson-hero__play-btn {
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.875rem 2rem;
  border-radius: 10px;
  font-size: 1.0625rem;
  font-weight: 700;
  cursor: pointer;
  border: none;
  background: var(--color-accent, #6366f1);
  color: #fff;
  transition: all 0.15s ease;
}

.lesson-hero__play-btn:hover {
  opacity: 0.9;
  transform: translateY(-1px);
  box-shadow: 0 4px 16px rgba(99, 102, 241, 0.3);
}

.lesson-hero__play-btn--secondary {
  background: transparent;
  color: var(--color-accent, #6366f1);
  border: 2px solid var(--color-accent, #6366f1);
}

.lesson-hero__play-btn--secondary:hover {
  background: rgba(99, 102, 241, 0.06);
  box-shadow: none;
}

.lesson-hero__no-replay {
  padding: 1rem;
  border-radius: 8px;
  background: var(--color-bg-secondary, #f5f5f5);
  color: var(--color-text-secondary, #555);
  font-size: 0.9375rem;
}
</style>
