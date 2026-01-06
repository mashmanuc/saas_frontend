<script setup lang="ts">
import { computed, ref } from 'vue'
import { X, AlertCircle } from 'lucide-vue-next'
import marketplaceApi, { type TrialRequestPayload } from '../../api/marketplace'
import { notifyError, notifySuccess } from '@/utils/notify'
import { mapMarketplaceErrorToMessage, parseMarketplaceApiError } from '../../utils/apiErrors'
import { useI18n } from 'vue-i18n'

interface CalendarSlot {
  slot_id: string
  start_at: string
  duration_min: number
  status: string
}

const props = defineProps<{
  slug: string
  slot: CalendarSlot
}>()

const emit = defineEmits<{
  (e: 'close'): void
  (e: 'created', payload: unknown): void
  (e: 'refresh'): void
}>()

const { t } = useI18n()

const isSubmitting = ref(false)
const errorMessage = ref<string | null>(null)
const fieldErrors = ref<Record<string, string[]> | null>(null)
const isSlotConflict = ref(false)

const localTime = computed(() => {
  const d = new Date(props.slot.start_at)
  return d.toLocaleString('uk-UA', { weekday: 'short', day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })
})

async function submit() {
  if (isSubmitting.value) return
  isSubmitting.value = true
  errorMessage.value = null
  fieldErrors.value = null
  isSlotConflict.value = false

  const payload: TrialRequestPayload = {
    slot_id: props.slot.slot_id,
    starts_at: props.slot.start_at,
    duration_min: props.slot.duration_min,
  }

  try {
    const res = await marketplaceApi.createTrialRequest(props.slug, payload)
    notifySuccess(t('marketplace.trialRequest.success'))
    
    // Telemetry: trial_request_sent
    if (window.gtag) {
      window.gtag('event', 'trial_request_sent', {
        tutor_slug: props.slug,
        slot_id: props.slot.slot_id,
      })
    }
    
    emit('created', res)
    emit('close')
  } catch (e: any) {
    // Handle 409 slot conflict
    if (e.response?.status === 409 && e.response?.data?.error === 'slot_unavailable') {
      isSlotConflict.value = true
      errorMessage.value = t('marketplace.trialRequest.slotUnavailable')
      
      // Telemetry: trial_request_failed
      if (window.gtag) {
        window.gtag('event', 'trial_request_failed', {
          tutor_slug: props.slug,
          slot_id: props.slot.slot_id,
          reason: 'slot_unavailable',
        })
      }
    } else {
      const info = parseMarketplaceApiError(e)
      fieldErrors.value = info.fields
      errorMessage.value = mapMarketplaceErrorToMessage(info, t('marketplace.trialRequest.error'))
    }
    notifyError(errorMessage.value)
  } finally {
    isSubmitting.value = false
  }
}

function refreshCalendar() {
  emit('refresh')
  emit('close')
}

declare global {
  interface Window {
    gtag?: (...args: any[]) => void
  }
}
</script>

<template>
  <div class="overlay" data-test="trial-modal">
    <div class="modal">
      <div class="top">
        <h3>{{ t('marketplace.trialRequest.title') }}</h3>
        <button class="icon" type="button" @click="emit('close')" :disabled="isSubmitting">
          <X :size="18" />
        </button>
      </div>

      <div class="body">
        <div class="row">
          <div class="label">{{ t('marketplace.trialRequest.timeLabel') }}</div>
          <div class="value">{{ localTime }}</div>
        </div>
        <div class="row">
          <div class="label">{{ t('marketplace.trialRequest.durationLabel') }}</div>
          <div class="value">{{ slot.duration_min }} {{ t('marketplace.trialRequest.minutesShort') }}</div>
        </div>

        <div v-if="isSlotConflict" class="conflict-banner">
          <AlertCircle class="icon" :size="20" />
          <div class="conflict-content">
            <p class="conflict-message">{{ errorMessage }}</p>
            <button class="btn-refresh" type="button" @click="refreshCalendar">
              {{ t('marketplace.trialRequest.refreshCalendar') }}
            </button>
          </div>
        </div>

        <div v-else-if="errorMessage" class="error">{{ errorMessage }}</div>

        <div v-if="fieldErrors" class="field-errors">
          <div v-for="(msgs, k) in fieldErrors" :key="k" class="field-error">
            <strong>{{ k }}</strong>: {{ (msgs || []).join(', ') }}
          </div>
        </div>
      </div>

      <div class="actions">
        <button class="btn btn-secondary" type="button" @click="emit('close')" :disabled="isSubmitting" data-testid="trial-request-cancel">
          {{ t('common.cancel') }}
        </button>
        <button class="btn btn-primary" type="button" @click="submit" :disabled="isSubmitting" data-testid="trial-request-submit">
          {{ isSubmitting ? t('marketplace.trialRequest.submitting') : t('marketplace.trialRequest.submit') }}
        </button>
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

.conflict-banner {
  display: flex;
  gap: 12px;
  padding: 12px;
  background: #fef2f2;
  border: 1px solid #fecaca;
  border-radius: 8px;
  margin-top: 16px;
}

.conflict-banner .icon {
  color: #dc2626;
  flex-shrink: 0;
}

.conflict-content {
  flex: 1;
}

.conflict-message {
  margin: 0 0 8px 0;
  color: #991b1b;
  font-size: 14px;
}

.btn-refresh {
  padding: 6px 12px;
  background: #dc2626;
  color: white;
  border: none;
  border-radius: 6px;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  transition: background 0.2s;
}

.btn-refresh:hover {
  background: #b91c1c;
}

.body {
  padding: 1rem 1.25rem;
}

.row {
  display: flex;
  gap: 1rem;
  margin-bottom: 0.5rem;
}

.label {
  width: 120px;
  color: var(--text-muted);
  font-size: 0.875rem;
}

.value {
  color: var(--text-primary);
  font-size: 0.875rem;
}

.error {
  margin-top: 0.75rem;
  color: color-mix(in srgb, var(--danger-bg) 72%, var(--text-primary));
  font-size: 0.875rem;
}

.field-errors {
  margin-top: 0.75rem;
  padding: 0.75rem;
  border: 1px solid color-mix(in srgb, var(--danger-bg) 30%, transparent);
  background: color-mix(in srgb, var(--danger-bg) 14%, transparent);
  border-radius: var(--radius-md);
}

.field-error {
  font-size: 0.8125rem;
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
