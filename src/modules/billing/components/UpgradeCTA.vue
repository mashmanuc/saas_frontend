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
        
        <Button
          v-if="dismissible"
          variant="ghost"
          size="sm"
          iconOnly
          aria-label="Close"
          @click="handleDismiss"
        >
          <X :size="16" />
        </Button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { AlertCircle, Info, X } from 'lucide-vue-next'
import Button from '@/ui/Button.vue'
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
  background-color: color-mix(in srgb, var(--warning-bg) 15%, transparent);
  border-color: var(--warning-bg);
  color: var(--warning-bg);
}

.upgrade-cta-banner.error {
  background-color: color-mix(in srgb, var(--danger-bg) 15%, transparent);
  border-color: var(--danger-bg);
  color: var(--danger-bg);
}

.upgrade-cta-banner.info {
  background-color: color-mix(in srgb, var(--accent) 15%, transparent);
  border-color: var(--accent);
  color: var(--accent);
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

</style>
