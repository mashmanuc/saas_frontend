<script setup lang="ts">
import { computed, ref } from 'vue'
import { X } from 'lucide-vue-next'
import Button from '@/ui/Button.vue'
import { useI18n } from 'vue-i18n'
import marketplaceApi, { type CreateReviewPayload } from '../../api/marketplace'
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
    notifyError(t('marketplace.profile.reviews.write.validation'))
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
    notifySuccess(t('marketplace.profile.reviews.write.success'))
    emit('created')
    emit('close')
  } catch (e: any) {
    const info = parseMarketplaceApiError(e)
    fieldErrors.value = info.fields
    errorMessage.value = mapMarketplaceErrorToMessage(info, t('marketplace.profile.reviews.write.sendError'))
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
              class="chip"
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
        <Button variant="outline" @click="emit('close')" :disabled="isSubmitting">
          {{ t('common.cancel') }}
        </Button>
        <Button
          variant="primary"
          :disabled="isSubmitting || !canSubmit"
          :loading="isSubmitting"
          @click="submit"
        >
          {{ t('marketplace.profile.reviews.write.submit') }}
        </Button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.overlay {
  position: fixed;
  inset: 0;
  background: color-mix(in srgb, var(--text-primary) 45%, transparent);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 1.25rem;
  z-index: 50;
}

.modal {
  width: min(560px, 100%);
  background: var(--surface-card);
  border-radius: var(--radius-xl);
  box-shadow: var(--shadow-lg);
  overflow: hidden;
}

.top {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 1rem 1.25rem;
  border-bottom: 1px solid var(--border-color);
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
  color: var(--text-primary);
}

.rating-pills {
  display: flex;
  gap: 0.5rem;
  flex-wrap: wrap;
}

/* Chip стилі — використовуються глобальні .chip з main.css */

.textarea {
  width: 100%;
  border: 1px solid var(--border-color);
  border-radius: var(--radius-lg);
  padding: 0.75rem;
  resize: vertical;
}

.error {
  color: color-mix(in srgb, var(--danger-bg) 72%, var(--text-primary));
  background: color-mix(in srgb, var(--danger-bg) 14%, transparent);
  border: 1px solid color-mix(in srgb, var(--danger-bg) 30%, transparent);
  border-radius: var(--radius-lg);
  padding: 0.75rem;
  margin-top: 0.5rem;
}

.field-errors {
  margin-top: 0.75rem;
}

.field-error {
  font-size: 0.875rem;
  color: color-mix(in srgb, var(--danger-bg) 72%, var(--text-primary));
}

.actions {
  display: flex;
  justify-content: flex-end;
  gap: 0.75rem;
  padding: 1rem 1.25rem;
  border-top: 1px solid var(--border-color);
}
</style>
