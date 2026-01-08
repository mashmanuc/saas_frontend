<script setup lang="ts">
import { Calendar, MessageCircle, Clock } from 'lucide-vue-next'
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import type { TutorProfileFull } from '../../api/marketplace'
import PriceTag from '../shared/PriceTag.vue'

interface Props {
  profile: TutorProfileFull
}

const props = defineProps<Props>()

const { t } = useI18n()

const responseTimeText = computed(() => {
  const hours = props.profile?.stats?.response_time_hours
  return typeof hours === 'number' ? t('marketplace.profile.contact.respondsInHours', { hours }) : t('common.notSpecified')
})

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
          :amount="profile.pricing?.hourly_rate || 0"
          :currency="profile.pricing?.currency || 'USD'"
          size="lg"
        />
        <span class="per-hour">{{ t('marketplace.common.perHour') }}</span>
      </div>

      <div v-if="profile.pricing?.trial_lesson_price !== null" class="trial-price">
        {{ t('marketplace.profile.contact.trialLesson') }}:
        <PriceTag
          :amount="profile.pricing?.trial_lesson_price || 0"
          :currency="profile.pricing?.currency || 'USD'"
        />
      </div>
    </div>

    <div class="response-time">
      <Clock :size="16" />
      {{ responseTimeText }}
    </div>

    <div class="actions">
      <button class="btn btn-primary" @click="emit('book')">
        <Calendar :size="18" />
        {{ t('marketplace.profile.contact.bookLesson') }}
      </button>
      <button class="btn btn-secondary" @click="emit('message')">
        <MessageCircle :size="18" />
        {{ t('marketplace.profile.contact.sendMessage') }}
      </button>
    </div>
  </div>
</template>

<style scoped>
.profile-contact {
  background: var(--surface-card);
  border-radius: var(--radius-lg);
  padding: var(--space-xl);
  box-shadow: var(--shadow-sm);
}

.price-section {
  margin-bottom: 1rem;
  padding-bottom: 1rem;
  border-bottom: 1px solid var(--border-color);
}

.price-main {
  display: flex;
  align-items: baseline;
  gap: 0.25rem;
}

.per-hour {
  font-size: 0.9375rem;
  color: var(--text-muted);
}

.trial-price {
  margin-top: 0.5rem;
  font-size: 0.875rem;
  color: var(--text-muted);
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.response-time {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 0.875rem;
  color: var(--text-muted);
  margin-bottom: 1.25rem;
}

.actions {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

</style>
