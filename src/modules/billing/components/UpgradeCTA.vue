<template>
  <div 
    v-if="show"
    class="upgrade-cta-banner"
    :class="variant"
    role="alert"
  >
    <div class="upgrade-cta-content">
      <div class="upgrade-cta-icon">
        <AlertCircle v-if="variant === 'error'" :size="20" />
        <Info v-else :size="20" />
      </div>
      
      <div class="upgrade-cta-text">
        <p class="upgrade-cta-title">{{ title }}</p>
        <p v-if="message" class="upgrade-cta-message">{{ message }}</p>
      </div>
      
      <div class="upgrade-cta-actions">
        <Button
          variant="primary"
          size="sm"
          @click="handleUpgrade"
        >
          {{ ctaText }}
        </Button>
        
        <button
          v-if="dismissible"
          class="upgrade-cta-close"
          @click="handleDismiss"
          aria-label="Close"
        >
          <X :size="16" />
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { AlertCircle, Info, X } from 'lucide-vue-next'
import Button from '@/components/ui/Button.vue'
import { BillingErrorCodes } from '../api/dto'

interface Props {
  errorCode?: string
  title?: string
  message?: string
  ctaText?: string
  dismissible?: boolean
  variant?: 'warning' | 'error' | 'info'
}

const props = withDefaults(defineProps<Props>(), {
  dismissible: true,
  variant: 'warning'
})

const emit = defineEmits<{
  dismiss: []
  upgrade: []
}>()

const router = useRouter()
const { t } = useI18n()
const show = ref(true)

// Compute title based on error code or prop
const title = computed(() => {
  if (props.title) return props.title
  
  switch (props.errorCode) {
    case BillingErrorCodes.SUBSCRIPTION_REQUIRED:
      return t('billing.error.subscription_required')
    case BillingErrorCodes.LIMIT_EXCEEDED:
      return t('billing.error.limit_exceeded')
    case BillingErrorCodes.CHECKOUT_NOT_ALLOWED:
      return t('billing.error.checkout_not_allowed')
    default:
      return t('billing.cta.upgradeToContinue')
  }
})

// Compute CTA text
const ctaText = computed(() => {
  return props.ctaText || t('billing.cta.upgradeNow')
})

function handleUpgrade() {
  emit('upgrade')
  router.push('/billing/plans')
}

function handleDismiss() {
  show.value = false
  emit('dismiss')
}
</script>

<style scoped>
.upgrade-cta-banner {
  padding: 1rem;
  border-radius: 0.5rem;
  border: 1px solid;
  margin-bottom: 1rem;
}

.upgrade-cta-banner.warning {
  background-color: #fef3c7;
  border-color: #f59e0b;
  color: #92400e;
}

.upgrade-cta-banner.error {
  background-color: #fee2e2;
  border-color: #ef4444;
  color: #991b1b;
}

.upgrade-cta-banner.info {
  background-color: #dbeafe;
  border-color: #3b82f6;
  color: #1e40af;
}

.upgrade-cta-content {
  display: flex;
  align-items: flex-start;
  gap: 0.75rem;
}

.upgrade-cta-icon {
  flex-shrink: 0;
  margin-top: 0.125rem;
}

.upgrade-cta-text {
  flex: 1;
}

.upgrade-cta-title {
  font-weight: 600;
  margin: 0 0 0.25rem 0;
}

.upgrade-cta-message {
  font-size: 0.875rem;
  margin: 0;
  opacity: 0.9;
}

.upgrade-cta-actions {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  flex-shrink: 0;
}

.upgrade-cta-close {
  background: none;
  border: none;
  cursor: pointer;
  padding: 0.25rem;
  display: flex;
  align-items: center;
  justify-content: center;
  opacity: 0.7;
  transition: opacity 0.2s;
}

.upgrade-cta-close:hover {
  opacity: 1;
}
</style>
