<template>
  <div class="session-ended">
    <div class="ended-content">
      <div class="ended-icon">
        <CheckCircle class="w-20 h-20 text-green-500" />
      </div>

      <h1 class="ended-title">Урок завершено</h1>

      <p class="ended-message">
        Дякуємо за участь! Сподіваємося, урок був корисним.
      </p>

      <!-- Session Summary -->
      <div class="session-summary">
        <div class="summary-item">
          <Clock class="w-5 h-5" />
          <span>Тривалість: {{ formattedDuration }}</span>
        </div>
        <div v-if="session" class="summary-item">
          <Calendar class="w-5 h-5" />
          <span>{{ formatDate(session.scheduled_start) }}</span>
        </div>
      </div>

      <!-- Actions -->
      <div class="ended-actions">
        <button class="btn btn-primary" @click="$emit('leave')">
          <Home class="w-5 h-5 mr-2" />
          На головну
        </button>
        <button class="btn btn-secondary" @click="$emit('view-history')">
          <History class="w-5 h-5 mr-2" />
          Переглянути історію
        </button>
      </div>

      <!-- Feedback prompt -->
      <div class="feedback-prompt">
        <p>Як пройшов урок?</p>
        <div class="rating-stars">
          <button 
            v-for="star in 5" 
            :key="star"
            class="star-btn"
            :class="{ active: rating >= star }"
            @click="setRating(star)"
          >
            <Star class="w-8 h-8" :fill="rating >= star ? 'currentColor' : 'none'" />
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { CheckCircle, Clock, Calendar, Home, History, Star } from 'lucide-vue-next'
import type { ClassroomSession } from '../../api/classroom'

interface Props {
  session: ClassroomSession | null
  duration: number // in seconds
}

const props = defineProps<Props>()

defineEmits<{
  (e: 'leave'): void
  (e: 'view-history'): void
}>()

const rating = ref(0)

const formattedDuration = computed(() => {
  const hours = Math.floor(props.duration / 3600)
  const minutes = Math.floor((props.duration % 3600) / 60)

  if (hours > 0) {
    return `${hours} год ${minutes} хв`
  }
  return `${minutes} хв`
})

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('uk-UA', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })
}

function setRating(value: number): void {
  rating.value = value
  // TODO: Submit rating to API
}
</script>

<style scoped>
.session-ended {
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  background: linear-gradient(135deg, #1f2937 0%, #111827 100%);
  padding: 24px;
}

.ended-content {
  text-align: center;
  max-width: 500px;
}

.ended-icon {
  margin-bottom: 32px;
}

.ended-title {
  font-size: 2rem;
  font-weight: 700;
  color: white;
  margin: 0 0 16px;
}

.ended-message {
  font-size: 1.125rem;
  color: var(--color-text-secondary, #9ca3af);
  margin: 0 0 32px;
}

.session-summary {
  display: flex;
  justify-content: center;
  gap: 24px;
  margin-bottom: 32px;
}

.summary-item {
  display: flex;
  align-items: center;
  gap: 8px;
  color: var(--color-text-secondary, #9ca3af);
}

.ended-actions {
  display: flex;
  flex-direction: column;
  gap: 12px;
  align-items: center;
  margin-bottom: 48px;
}

.btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 12px 24px;
  border-radius: 8px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;
  border: none;
  min-width: 200px;
}

.btn-primary {
  background: var(--color-primary, #3b82f6);
  color: white;
}

.btn-primary:hover {
  background: var(--color-primary-dark, #2563eb);
}

.btn-secondary {
  background: transparent;
  color: var(--color-text-secondary, #9ca3af);
  border: 1px solid var(--color-border, #374151);
}

.btn-secondary:hover {
  background: var(--color-bg-secondary, #374151);
}

.feedback-prompt {
  padding: 24px;
  background: var(--color-bg-secondary, #374151);
  border-radius: 12px;
}

.feedback-prompt p {
  color: white;
  font-weight: 500;
  margin: 0 0 16px;
}

.rating-stars {
  display: flex;
  justify-content: center;
  gap: 8px;
}

.star-btn {
  background: none;
  border: none;
  color: var(--color-text-secondary, #6b7280);
  cursor: pointer;
  transition: all 0.2s;
  padding: 4px;
}

.star-btn:hover,
.star-btn.active {
  color: #fbbf24;
  transform: scale(1.1);
}
</style>
