<script setup lang="ts">
import { computed, ref } from 'vue'
import { X } from 'lucide-vue-next'
import { useI18n } from 'vue-i18n'
import { marketplaceApi, type CreateReviewPayload } from '../../api/marketplace'
import { notifyError, notifySuccess } from '@/utils/notify'
import { mapMarketplaceErrorToMessage, parseMarketplaceApiError } from '../../utils/apiErrors'

const props = defineProps<{
  slug: string
}>()

const emit = defineEmits<{
  (e: 'close'): void
  (e: 'created'): void
}>()

const { t } = useI18n()

const rating = ref<number>(5)
const text = ref('')

const isSubmitting = ref(false)
const errorMessage = ref<string | null>(null)
const fieldErrors = ref<Record<string, string[]> | null>(null)

const canSubmit = computed(() => {
  return rating.value >= 1 && rating.value <= 5 && text.value.trim().length >= 10
})

async function submit() {
  if (isSubmitting.value || !props.slug) return
  if (!canSubmit.value) {
    notifyError(t('marketplace.profile.reviews.write.validation') || 'Перевірте коректність даних.')
    return
  }

  isSubmitting.value = true
  errorMessage.value = null
  fieldErrors.value = null

  const payload: CreateReviewPayload = {
    rating: rating.value,
    text: text.value.trim(),
  }

  try {
    await marketplaceApi.createTutorReview(props.slug, payload as CreateReviewPayload)
    notifySuccess(t('marketplace.profile.reviews.write.success') || 'Відгук надіслано')
    emit('created')
    emit('close')
  } catch (e: any) {
    const info = parseMarketplaceApiError(e)
    fieldErrors.value = info.fields
    errorMessage.value = mapMarketplaceErrorToMessage(info, 'Не вдалося надіслати відгук.')
    notifyError(errorMessage.value)
  } finally {
    isSubmitting.value = false
  }
}
</script>

<template>
  <div class="overlay" data-test="marketplace-create-review-modal">
    <div class="modal">
      <div class="top">
        <h3>{{ t('marketplace.profile.reviews.write.title') }}</h3>
        <button class="icon" type="button" @click="emit('close')" :disabled="isSubmitting">
          <X :size="18" />
        </button>
      </div>

      <div class="body">
        <div class="field">
          <label class="label">{{ t('marketplace.profile.reviews.write.ratingLabel') }}</label>
          <div class="rating-pills">
            <button
              v-for="n in 5"
              :key="n"
              type="button"
              class="pill"
              :class="{ active: rating === n }"
              :disabled="isSubmitting"
              @click="rating = n"
            >
              {{ n }}
            </button>
          </div>
        </div>

        <div class="field">
          <label class="label" for="review-text">{{ t('marketplace.profile.reviews.write.textLabel') }}</label>
          <textarea
            id="review-text"
            v-model="text"
            class="textarea"
            :placeholder="t('marketplace.profile.reviews.write.textPlaceholder')"
            :disabled="isSubmitting"
            rows="5"
          />
        </div>

        <div v-if="errorMessage" class="error">{{ errorMessage }}</div>

        <div v-if="fieldErrors" class="field-errors">
          <div v-for="(msgs, k) in fieldErrors" :key="k" class="field-error">
            <strong>{{ k }}</strong>: {{ (msgs || []).join(', ') }}
          </div>
        </div>
      </div>

      <div class="actions">
        <button class="btn btn-secondary" type="button" @click="emit('close')" :disabled="isSubmitting">
          {{ t('common.cancel') }}
        </button>
        <button
          class="btn btn-primary"
          type="button"
          :disabled="isSubmitting || !canSubmit"
          @click="submit"
        >
          {{ isSubmitting ? t('common.loading') : t('marketplace.profile.reviews.write.submit') }}
        </button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.overlay {
  position: fixed;
  inset: 0;
  background: rgba(17, 24, 39, 0.45);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 1.25rem;
  z-index: 50;
}

.modal {
  width: min(560px, 100%);
  background: white;
  border-radius: 14px;
  box-shadow: 0 10px 30px rgba(0, 0, 0, 0.2);
  overflow: hidden;
}

.top {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 1rem 1.25rem;
  border-bottom: 1px solid #e5e7eb;
}

.top h3 {
  margin: 0;
  font-size: 1.125rem;
  font-weight: 600;
}

.icon {
  border: none;
  background: transparent;
  cursor: pointer;
  padding: 0.25rem;
  border-radius: 8px;
}

.icon:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.body {
  padding: 1rem 1.25rem;
}

.field {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  margin-bottom: 1rem;
}

.label {
  font-weight: 600;
  color: #111827;
}

.rating-pills {
  display: flex;
  gap: 0.5rem;
  flex-wrap: wrap;
}

.pill {
  border: 1px solid #e5e7eb;
  background: white;
  border-radius: 999px;
  padding: 0.375rem 0.75rem;
  cursor: pointer;
  font-weight: 600;
}

.pill.active {
  border-color: #3b82f6;
  color: #1d4ed8;
  background: #eff6ff;
}

.pill:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.textarea {
  width: 100%;
  border: 1px solid #e5e7eb;
  border-radius: 12px;
  padding: 0.75rem;
  resize: vertical;
}

.error {
  color: #b91c1c;
  background: #fef2f2;
  border: 1px solid #fecaca;
  border-radius: 12px;
  padding: 0.75rem;
  margin-top: 0.5rem;
}

.field-errors {
  margin-top: 0.75rem;
}

.field-error {
  font-size: 0.875rem;
  color: #991b1b;
}

.actions {
  display: flex;
  justify-content: flex-end;
  gap: 0.75rem;
  padding: 1rem 1.25rem;
  border-top: 1px solid #e5e7eb;
}

.btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  padding: 0.75rem 1.5rem;
  border: none;
  border-radius: 8px;
  font-size: 0.875rem;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;
}

.btn-primary {
  background: #3b82f6;
  color: white;
}

.btn-primary:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.btn-secondary {
  background: #f3f4f6;
  color: #111827;
}
</style>
