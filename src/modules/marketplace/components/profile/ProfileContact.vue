<script setup lang="ts">
import { Calendar, MessageCircle, Clock } from 'lucide-vue-next'
import type { TutorProfile } from '../../api/marketplace'
import PriceTag from '../shared/PriceTag.vue'

interface Props {
  profile: TutorProfile
}

defineProps<Props>()

const emit = defineEmits<{
  (e: 'book'): void
  (e: 'message'): void
}>()
</script>

<template>
  <div class="profile-contact">
    <div class="price-section">
      <div class="price-main">
        <PriceTag
          :amount="profile.hourly_rate"
          :currency="profile.currency"
          size="lg"
        />
        <span class="per-hour">/ hour</span>
      </div>

      <div v-if="profile.trial_lesson_price !== null" class="trial-price">
        Trial lesson:
        <PriceTag
          :amount="profile.trial_lesson_price"
          :currency="profile.currency"
        />
      </div>
    </div>

    <div class="response-time">
      <Clock :size="16" />
      Usually responds in {{ profile.response_time_hours }}h
    </div>

    <div class="actions">
      <button class="btn btn-primary" @click="emit('book')">
        <Calendar :size="18" />
        Book a Lesson
      </button>
      <button class="btn btn-secondary" @click="emit('message')">
        <MessageCircle :size="18" />
        Send Message
      </button>
    </div>
  </div>
</template>

<style scoped>
.profile-contact {
  background: white;
  border-radius: 12px;
  padding: 1.5rem;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
}

.price-section {
  margin-bottom: 1rem;
  padding-bottom: 1rem;
  border-bottom: 1px solid #e5e7eb;
}

.price-main {
  display: flex;
  align-items: baseline;
  gap: 0.25rem;
}

.per-hour {
  font-size: 0.9375rem;
  color: #6b7280;
}

.trial-price {
  margin-top: 0.5rem;
  font-size: 0.875rem;
  color: #6b7280;
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.response-time {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 0.875rem;
  color: #6b7280;
  margin-bottom: 1.25rem;
}

.actions {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.btn {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  padding: 0.875rem 1.25rem;
  border: none;
  border-radius: 8px;
  font-size: 0.9375rem;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;
}

.btn-primary {
  background: #3b82f6;
  color: white;
}

.btn-primary:hover {
  background: #2563eb;
}

.btn-secondary {
  background: white;
  color: #374151;
  border: 1px solid #d1d5db;
}

.btn-secondary:hover {
  background: #f9fafb;
}
</style>
