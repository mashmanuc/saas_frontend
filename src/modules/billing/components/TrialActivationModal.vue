<template>
  <Modal
    :open="modelValue"
    :title="$t('billing.trialActivation.title')"
    size="sm"
    @close="handleDismiss"
  >
    <!-- Hero -->
    <div class="ta-hero">
      <div class="ta-icon-wrap">
        <Sparkles :size="32" />
      </div>
      <p class="ta-subtitle">{{ $t('billing.trialActivation.subtitle') }}</p>
      <p class="ta-fineprint">{{ $t('billing.trialActivation.noCard') }}</p>
    </div>

    <!-- Bullets -->
    <ul class="ta-bullets">
      <li class="ta-bullet">
        <Check :size="16" />
        <span>{{ $t('billing.trialActivation.bulletDuration', { days: 14 }) }}</span>
      </li>
      <li class="ta-bullet">
        <Check :size="16" />
        <span>{{ $t('billing.trialActivation.bulletContacts', { count: 3 }) }}</span>
      </li>
      <li class="ta-bullet">
        <Check :size="16" />
        <span>{{ $t('billing.trialActivation.bulletCancelAnytime') }}</span>
      </li>
    </ul>

    <div v-if="errorMessage" class="ta-error">{{ errorMessage }}</div>

    <template #footer>
      <Button
        variant="ghost"
        class="flex-1"
        :disabled="submitting"
        @click="handleDismiss"
      >
        {{ $t('billing.trialActivation.dismiss') }}
      </Button>
      <Button
        variant="primary"
        class="flex-1"
        :disabled="submitting"
        @click="handleActivate"
      >
        <span v-if="submitting">{{ $t('common.saving') }}…</span>
        <span v-else>{{ $t('billing.trialActivation.cta') }}</span>
      </Button>
    </template>
  </Modal>
</template>

<script setup lang="ts">
/**
 * TrialActivationModal (Sprint 2 §4.1 — Trial UX).
 *
 * Показується ТІЛЬКИ після завершення першого уроку (НЕ при signup і НЕ при логіні).
 * Тригер: composable `useTrialActivation()`, який слухає `classroom.session.ended`
 * або `booking.completed` first-time events і запитує /billing/trial/eligibility/.
 *
 * Modal:
 *  - dismiss (без активації)
 *  - CTA → POST /v1/billing/trial/start/ → refresh billingStore.fetchMe()
 *
 * Soft monetization: НЕ блокує жодну фічу.
 */
import { ref, watch } from 'vue'
import { Sparkles, Check } from 'lucide-vue-next'
import Button from '@/ui/Button.vue'
import Modal from '@/ui/Modal.vue'
import { startTrial } from '../api/billingApi'
import { useBillingStore } from '../stores/billingStore'
import { trackEvent } from '@/utils/telemetry'

interface Props {
  modelValue: boolean
  trigger?: string  // 'first_lesson' | 'manual' — для telemetry
}

const props = withDefaults(defineProps<Props>(), {
  trigger: 'first_lesson',
})

const emit = defineEmits<{
  'update:modelValue': [value: boolean]
  'activated': []
  'dismissed': []
}>()

const billing = useBillingStore()
const submitting = ref(false)
const errorMessage = ref('')

// Telemetry — `billing.trial_modal_shown` при кожному відкритті.
watch(
  () => props.modelValue,
  (open) => {
    if (open) {
      try {
        trackEvent('billing.trial_modal_shown', { trigger: props.trigger })
      } catch {
        // best-effort
      }
    }
  },
  { immediate: true },
)

async function handleActivate() {
  if (submitting.value) return
  submitting.value = true
  errorMessage.value = ''

  try {
    await startTrial('PRO')
    // Refresh entitlement snapshot — store підхопить новий plan/expires_at.
    try {
      await billing.fetchMe()
    } catch {
      // не блокуємо — backend вже активував trial.
    }
    emit('activated')
    emit('update:modelValue', false)
  } catch (err: any) {
    errorMessage.value =
      err?.message || err?.detail || 'Не вдалося активувати пробний період.'
  } finally {
    submitting.value = false
  }
}

function handleDismiss() {
  emit('dismissed')
  emit('update:modelValue', false)
}
</script>

<style scoped>
.ta-hero {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  margin-bottom: 16px;
  text-align: center;
}

.ta-icon-wrap {
  width: 64px;
  height: 64px;
  border-radius: 50%;
  background: linear-gradient(135deg, #fde68a, #fbbf24);
  color: #92400e;
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 6px 20px rgba(251, 191, 36, 0.35);
}

.ta-subtitle {
  font-size: 14px;
  color: var(--text-secondary, #6b7280);
  margin: 0;
}

.ta-fineprint {
  font-size: 12px;
  color: var(--text-secondary, #9ca3af);
  margin: 0;
}

.ta-bullets {
  list-style: none;
  padding: 0;
  margin: 0 0 8px;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.ta-bullet {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 14px;
  color: var(--text-primary, #111827);
}

.ta-bullet svg {
  color: #16a34a;
  flex-shrink: 0;
}

.ta-error {
  margin-top: 12px;
  padding: 8px 12px;
  border-radius: 8px;
  background: color-mix(in srgb, #ef4444 10%, transparent);
  color: #b91c1c;
  font-size: 13px;
}
</style>
