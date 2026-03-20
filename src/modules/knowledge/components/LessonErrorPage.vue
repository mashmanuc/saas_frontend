<template>
  <div class="lesson-error-page">
    <div class="lesson-error-page__content">
      <div class="lesson-error-page__icon">
        <svg v-if="error.type === '404'" viewBox="0 0 24 24" fill="currentColor">
          <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z"/>
        </svg>
        <svg v-else viewBox="0 0 24 24" fill="currentColor">
          <path d="M11 15h2v2h-2zm0-8h2v6h-2zm.99-5C6.47 2 2 6.48 2 12s4.47 10 9.99 10C17.52 22 22 17.52 22 12S17.52 2 11.99 2zM12 20c-4.42 0-8-3.58-8-8s3.58-8 8-8 8 3.58 8 8-3.58 8-8 8z"/>
        </svg>
      </div>

      <h1 class="lesson-error-page__title">
        {{ errorTitle }}
      </h1>

      <p class="lesson-error-page__message">
        {{ error.message }}
      </p>

      <div class="lesson-error-page__actions">
        <button @click="goBack" class="lesson-error-page__btn">
          {{ $t('knowledge.lesson.error.goBack') }}
        </button>
        <button @click="goHome" class="lesson-error-page__btn lesson-error-page__btn--secondary">
          {{ $t('knowledge.lesson.error.goHome') }}
        </button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import { useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'

const { t } = useI18n()
const router = useRouter()

const props = defineProps({
  error: {
    type: Object,
    required: true,
  },
})

const errorTitle = computed(() => {
  switch (props.error.type) {
    case '404':
      return t('knowledge.lesson.error.notFound')
    case 'broken_snapshot':
      return t('knowledge.lesson.error.brokenSnapshot')
    case 'replay_error':
      return t('knowledge.lesson.error.replayError')
    default:
      return t('knowledge.lesson.error.serverError')
  }
})

function goBack() {
  router.back()
}

function goHome() {
  router.push('/')
}
</script>

<style scoped>
.lesson-error-page {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 100vh;
  padding: 2rem;
  background: var(--color-bg-primary, #fff);
}

.lesson-error-page__content {
  max-width: 460px;
  text-align: center;
}

.lesson-error-page__icon {
  margin: 0 auto 1.5rem;
  width: 96px;
  height: 96px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  background: var(--color-bg-secondary, #f5f5f5);
  color: var(--color-text-tertiary, #999);
}

.lesson-error-page__icon svg {
  width: 48px;
  height: 48px;
}

.lesson-error-page__title {
  font-size: 1.75rem;
  font-weight: 700;
  color: var(--color-text-primary, #111);
  margin: 0 0 0.75rem;
}

.lesson-error-page__message {
  font-size: 1rem;
  color: var(--color-text-secondary, #666);
  margin: 0 0 2rem;
  line-height: 1.5;
}

.lesson-error-page__actions {
  display: flex;
  gap: 0.75rem;
  justify-content: center;
  flex-wrap: wrap;
}

.lesson-error-page__btn {
  padding: 0.625rem 1.5rem;
  border-radius: 8px;
  font-size: 0.9375rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.15s ease;
  border: none;
  background: var(--color-accent, #6366f1);
  color: #fff;
}

.lesson-error-page__btn:hover {
  opacity: 0.9;
  transform: translateY(-1px);
}

.lesson-error-page__btn--secondary {
  background: transparent;
  color: var(--color-text-primary, #111);
  border: 1.5px solid var(--color-border, #ddd);
}

.lesson-error-page__btn--secondary:hover {
  background: var(--color-bg-secondary, #f5f5f5);
}
</style>
