<template>
  <div v-if="show" class="modal-overlay" @click="handleOverlayClick">
    <div class="modal-container" @click.stop>
      <div class="modal-header">
        <h2>{{ showSuccess ? $t('inquiries.success.created') : $t('inquiries.form.title') }}</h2>
        <button @click="$emit('close')" class="close-btn">✕</button>
      </div>
      
      <div class="modal-body">
        <!-- Success State -->
        <div v-if="showSuccess" class="success-state">
          <div class="success-icon">✓</div>
          <p class="success-description">{{ $t('inquiries.success.description') }}</p>
          <div class="success-actions">
            <router-link to="/student/inquiries" class="btn btn-primary" @click="$emit('close')">
              {{ $t('inquiries.success.viewMyInquiries') }}
            </router-link>
            <router-link to="/marketplace" class="btn btn-secondary" @click="$emit('close')">
              {{ $t('inquiries.success.findMoreTutors') }}
            </router-link>
          </div>
        </div>
        
        <!-- Form -->
        <form v-else @submit.prevent="handleSubmit" class="inquiry-form">
          <!-- Tutor Preview -->
          <div class="tutor-preview">
            <img :src="tutor.avatar || '/default-avatar.png'" class="avatar-sm" alt="" />
            <div>
              <h3>{{ tutor.full_name }}</h3>
              <p class="subjects">{{ tutor.subjects?.join(', ') || '' }}</p>
            </div>
          </div>
          
          <!-- Phase 1 v0.87: Contact Info Fields (якщо немає в профілі) -->
          <div v-if="!hasContactInfo" class="contact-info-section mb-4">
            <div class="rounded-lg border border-blue-200 bg-blue-50 p-4 dark:border-blue-800 dark:bg-blue-950/30 mb-4">
              <h4 class="text-sm font-semibold text-blue-900 dark:text-blue-200 mb-1">
                {{ $t('inquiry.contactInfo.title') }}
              </h4>
              <p class="text-sm text-blue-800 dark:text-blue-300">
                {{ $t('inquiry.contactInfo.description') }}
              </p>
            </div>
            
            <div class="form-group">
              <label for="contact_phone">{{ $t('profile.phone') }} *</label>
              <input 
                id="contact_phone"
                v-model="contactForm.phone"
                type="tel"
                placeholder="+380501234567"
                class="form-control"
              />
              <span v-if="phoneError" class="error-text">
                {{ phoneError }}
              </span>
              <span class="hint">
                {{ $t('profile.phoneHint') }}
              </span>
            </div>
            
            <div class="form-group">
              <label for="contact_telegram">{{ $t('profile.telegram') }}</label>
              <input 
                id="contact_telegram"
                v-model="contactForm.telegram_username"
                type="text"
                placeholder="@username"
                class="form-control"
              />
              <span class="hint">
                {{ $t('profile.telegramHint') }}
              </span>
            </div>
          </div>
          
          <!-- Form Fields -->
          <div class="form-group">
            <label for="start_preference">{{ $t('inquiries.form.startPreference') }} *</label>
            <select
              id="start_preference"
              v-model="form.start_preference"
              required
              class="form-control"
            >
              <option value="asap">{{ $t('inquiries.form.startOptions.asap') }}</option>
              <option value="week">{{ $t('inquiries.form.startOptions.week') }}</option>
              <option value="month">{{ $t('inquiries.form.startOptions.month') }}</option>
            </select>
          </div>

          <div class="form-group">
            <label for="message">{{ $t('inquiries.form.goals') }} *</label>
            <textarea 
              id="message"
              v-model="form.message" 
              rows="4"
              :placeholder="$t('inquiries.form.goalsPlaceholder')"
              required
              class="form-control"
              maxlength="500"
            ></textarea>
            <span class="char-count">{{ form.message.length }}/500</span>
          </div>
          
          <!-- Error Display -->
          <ErrorState
            v-if="errorState"
            :variant="errorState.variant"
            :title="errorState.title"
            :message="errorState.message"
            :retry-after="errorState.retryAfter"
            :show-retry="errorState.showRetry"
            @retry="clearError"
          >
            <template v-if="errorState.showUpgrade" #actions>
              <router-link to="/billing/plans" class="btn btn-primary">
                {{ $t('inquiries.errors.maxOpenReachedUpgrade') }}
              </router-link>
            </template>
          </ErrorState>
          
          <!-- Actions -->
          <div class="form-actions">
            <Button 
              variant="secondary"
              @click="$emit('close')" 
              :disabled="isSubmitting"
            >
              {{ $t('inquiries.form.cancel') }}
            </Button>
            <Button 
              type="submit" 
              variant="primary"
              :disabled="isSubmitting || !isFormValid || isRateLimited"
            >
              <span v-if="isRateLimited">{{ $t('inquiries.form.retryIn', { seconds: remainingSeconds }) }}</span>
              <span v-else-if="!isSubmitting">{{ $t('inquiries.form.submit') }}</span>
              <span v-else>{{ $t('inquiries.form.submitting') }}</span>
            </Button>
          </div>
        </form>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
/**
 * InquiryFormModal Component (Phase 1 v0.86)
 * 
 * Форма для створення inquiry від студента до тьютора
 */

import { ref, reactive, computed, toRef } from 'vue'
import { useRouter } from 'vue-router'
import { useInquiriesStore } from '@/stores/inquiriesStore'
import { useAuthStore } from '@/modules/auth/store/authStore'
import { useInquiryErrorHandler } from '@/composables/useInquiryErrorHandler'
import { useRateLimitCountdown } from '@/composables/useRateLimitCountdown'
import { usePhoneValidation } from '@/composables/usePhoneValidation'
import { updateMyProfile } from '@/api/users'
import ErrorState from './ErrorState.vue'
import Button from '@/ui/Button.vue'

interface Tutor {
  id: number
  full_name: string
  avatar?: string
  subjects?: string[]
  min_hourly_rate?: number
}

const props = defineProps<{
  show: boolean
  tutor: Tutor
}>()

const emit = defineEmits<{
  close: []
  success: []
}>()

const router = useRouter()
const inquiriesStore = useInquiriesStore()
const authStore = useAuthStore()
const { errorState, handleError, clearError } = useInquiryErrorHandler()
const { isRateLimited, remainingSeconds, startCountdown } = useRateLimitCountdown()

const isSubmitting = ref(false)
const showSuccess = ref(false)

// Phase 1 v0.87: Check if student has contact info
const hasContactInfo = computed(() => {
  const user = authStore.user
  if (!user) return false
  return Boolean(user.phone || user.telegram_username)
})

// Contact form for students without phone
const contactForm = reactive({
  phone: '',
  telegram_username: ''
})

// Phone validation
const phoneRef = toRef(contactForm, 'phone')
const { isValidFormat, errorMessage: phoneError } = usePhoneValidation(phoneRef)

const form = reactive({
  start_preference: 'asap',
  message: ''
})

const isFormValid = computed(() => {
  const baseValid = form.start_preference &&
                    form.message.trim().length >= 10

  // Якщо студент почав заповнювати phone - перевіряємо формат
  if (contactForm.phone.trim().length > 0) {
    return baseValid && isValidFormat.value
  }

  return baseValid
})

async function handleSubmit() {
  console.log('[InquiryFormModal] handleSubmit called', {
    isFormValid: isFormValid.value,
    tutorId: props.tutor.id,
    hasContactInfo: hasContactInfo.value,
    contactForm: contactForm
  })
  
  if (!isFormValid.value) {
    return
  }
  
  isSubmitting.value = true
  clearError()
  
  try {
    // Phase 1 v0.87: Якщо немає контактів І студент заповнив поля - оновлюємо профіль
    if (!hasContactInfo.value && contactForm.phone.trim()) {
      console.log('[InquiryFormModal] Updating profile with contact info...')
      const result = await updateMyProfile({
        phone: contactForm.phone,
        telegram_username: contactForm.telegram_username || undefined
      })
      // apiClient вже розгортає res.data, результат: { user: {...} }
      if (result?.user) {
        authStore.user = result.user
      }
      console.log('[InquiryFormModal] Profile updated successfully')
    }
    
    // Створюємо inquiry
    await inquiriesStore.createInquiry(String(props.tutor.id), form.message)
    showSuccess.value = true
  } catch (err: any) {
    
    // Phase 2.3: Handle 429 rate limit - ONLY countdown, NO error modal
    if (err.response?.status === 429) {
      startCountdown(err)
      return
    }
    
    handleError(err)
  } finally {
    isSubmitting.value = false
  }
}

function handleOverlayClick() {
  if (!isSubmitting.value) {
    emit('close')
  }
}
</script>

<style scoped>
.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
  padding: 20px;
}

.modal-container {
  background: white;
  border-radius: 12px;
  box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1);
  max-height: 90vh;
  overflow-y: auto;
  max-width: 600px;
  width: 100%;
}

.modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 20px 24px;
  border-bottom: 1px solid #E5E7EB;
}

.modal-header h2 {
  margin: 0;
  font-size: 20px;
  font-weight: 600;
}

.close-btn {
  background: none;
  border: none;
  font-size: 24px;
  color: #9CA3AF;
  cursor: pointer;
  padding: 0;
  width: 32px;
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 4px;
  transition: all 0.2s;
}

.close-btn:hover {
  background: #F3F4F6;
  color: #374151;
}

.modal-body {
  padding: 24px;
}

.inquiry-form {
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.tutor-preview {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 16px;
  background: #F9FAFB;
  border-radius: 8px;
}

.avatar-sm {
  width: 48px;
  height: 48px;
  border-radius: 50%;
  object-fit: cover;
}

.tutor-preview h3 {
  margin: 0;
  font-size: 16px;
  font-weight: 600;
}

.tutor-preview .subjects {
  margin: 0;
  font-size: 14px;
  color: #6B7280;
}

.form-group {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.form-group label {
  font-weight: 500;
  color: #374151;
}

.form-control {
  padding: 10px 12px;
  border: 1px solid #D1D5DB;
  border-radius: 6px;
  font-size: 14px;
  transition: border-color 0.2s;
}

.form-control:focus {
  outline: none;
  border-color: #4F46E5;
  box-shadow: 0 0 0 3px rgba(79, 70, 229, 0.1);
}

.hint {
  font-size: 12px;
  color: #6B7280;
}

.error-text {
  font-size: 12px;
  color: #EF4444;
}

.char-count {
  font-size: 12px;
  color: #9CA3AF;
  text-align: right;
}

.form-actions {
  display: flex;
  gap: 12px;
  justify-content: flex-end;
  margin-top: 8px;
}

.success-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 32px 24px;
  text-align: center;
}

.success-icon {
  width: 64px;
  height: 64px;
  border-radius: 50%;
  background: #10B981;
  color: white;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 32px;
  font-weight: bold;
  margin-bottom: 16px;
}

.success-description {
  margin: 0 0 24px 0;
  font-size: 14px;
  color: #6B7280;
  max-width: 400px;
}

.success-actions {
  display: flex;
  gap: 12px;
  flex-wrap: wrap;
  justify-content: center;
}
</style>
