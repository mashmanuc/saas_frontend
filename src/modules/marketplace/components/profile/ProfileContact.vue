<script setup lang="ts">
import { MessageCircle, Clock, Send } from 'lucide-vue-next'
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { useAuthStore } from '@/modules/auth/store/authStore'
import type { TutorProfileFull } from '../../api/marketplace'
import PriceTag from '../shared/PriceTag.vue'
import Button from '@/ui/Button.vue'

interface Props {
  profile: TutorProfileFull
}

const props = defineProps<Props>()

const { t } = useI18n()
const auth = useAuthStore()

const isStudent = computed(() => auth.userRole === 'student')
const canSendInquiry = computed(() => auth.isAuthenticated && auth.userRole === 'student')
const needsLogin = computed(() => !auth.isAuthenticated)

const responseTimeText = computed(() => {
  const hours = props.profile?.stats?.response_time_hours
  return typeof hours === 'number' ? t('marketplace.profile.contact.respondsInHours', { hours }) : t('common.notSpecified')
})

const emit = defineEmits<{
  (e: 'message'): void
  (e: 'inquiry'): void
  (e: 'login-required'): void
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
      <!-- Inquiry CTA - показується для всіх авторизованих студентів -->
      <Button v-if="canSendInquiry" variant="primary" @click="emit('inquiry')" data-test="inquiry-cta">
        <Send :size="18" />
        {{ t('inquiries.form.title') }}
      </Button>
      
      <!-- Login required для неавторизованих -->
      <Button v-else-if="needsLogin" variant="primary" @click="emit('login-required')" data-test="inquiry-login-cta">
        <Send :size="18" />
        {{ t('inquiries.form.title') }}
      </Button>
      
      <!-- Message button - тимчасово прихований до реалізації чату -->
    </div>
  </div>
</template>

<style scoped>
.profile-contact {
  background: var(--surface-card);
  border-radius: var(--radius-lg);
  padding: 1rem;
  box-shadow: var(--shadow-sm);
  word-wrap: break-word;
  overflow-wrap: break-word;
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
