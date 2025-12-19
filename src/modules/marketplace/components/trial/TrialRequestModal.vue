<script setup lang="ts">
import { computed, ref } from 'vue'
import { X } from 'lucide-vue-next'
import { marketplaceApi, type TrialRequestPayload, type WeeklyAvailabilitySlot } from '../../api/marketplace'
import { notifyError, notifySuccess } from '@/utils/notify'
import { mapMarketplaceErrorToMessage, parseMarketplaceApiError } from '../../utils/apiErrors'

const props = defineProps<{
  slug: string
  slot: WeeklyAvailabilitySlot
}>()

const emit = defineEmits<{
  (e: 'close'): void
  (e: 'created', payload: unknown): void
}>()

const isSubmitting = ref(false)
const errorMessage = ref<string | null>(null)
const fieldErrors = ref<Record<string, string[]> | null>(null)

const localTime = computed(() => {
  const d = new Date(props.slot.starts_at)
  return d.toLocaleString(undefined, { weekday: 'short', day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })
})

async function submit() {
  if (isSubmitting.value) return
  isSubmitting.value = true
  errorMessage.value = null
  fieldErrors.value = null

  const payload: TrialRequestPayload = {
    starts_at: props.slot.starts_at,
    duration_min: props.slot.duration_min,
  }

  try {
    const res = await marketplaceApi.createTrialRequest(props.slug, payload)
    notifySuccess('Заявку на пробний урок надіслано (pending).')
    emit('created', res)
    emit('close')
  } catch (e: any) {
    const info = parseMarketplaceApiError(e)
    fieldErrors.value = info.fields
    errorMessage.value = mapMarketplaceErrorToMessage(info, 'Не вдалося створити заявку.')
    notifyError(errorMessage.value)
  } finally {
    isSubmitting.value = false
  }
}
</script>

<template>
  <div class="overlay" data-test="trial-modal">
    <div class="modal">
      <div class="top">
        <h3>Підтвердження пробного уроку</h3>
        <button class="icon" type="button" @click="emit('close')" :disabled="isSubmitting">
          <X :size="18" />
        </button>
      </div>

      <div class="body">
        <div class="row">
          <div class="label">Час</div>
          <div class="value">{{ localTime }}</div>
        </div>
        <div class="row">
          <div class="label">Тривалість</div>
          <div class="value">{{ slot.duration_min }} хв</div>
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
          Скасувати
        </button>
        <button class="btn btn-primary" type="button" @click="submit" :disabled="isSubmitting">
          {{ isSubmitting ? 'Надсилаємо…' : 'Забронювати безкоштовний урок' }}
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

.row {
  display: flex;
  gap: 1rem;
  margin-bottom: 0.5rem;
}

.label {
  width: 120px;
  color: #6b7280;
  font-size: 0.875rem;
}

.value {
  color: #111827;
  font-size: 0.875rem;
}

.error {
  margin-top: 0.75rem;
  color: #b91c1c;
  font-size: 0.875rem;
}

.field-errors {
  margin-top: 0.75rem;
  padding: 0.75rem;
  border: 1px solid #fecaca;
  background: #fef2f2;
  border-radius: 10px;
}

.field-error {
  font-size: 0.8125rem;
  color: #7f1d1d;
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
  padding: 0.75rem 1.25rem;
  border: none;
  border-radius: 10px;
  font-size: 0.875rem;
  font-weight: 600;
  cursor: pointer;
}

.btn-primary {
  background: #22c55e;
  color: white;
}

.btn-secondary {
  background: white;
  color: #374151;
  border: 1px solid #d1d5db;
}

.btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}
</style>
