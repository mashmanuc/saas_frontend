<template>
  <div class="feature-gate">
    <slot v-if="granted" />
    <slot v-else name="fallback">
      <div class="feature-locked">
        <div class="locked-icon">
          <i class="icon-lock"></i>
        </div>
        <h4 class="locked-title">{{ $t('entitlements.locked.title') }}</h4>
        <p class="locked-message">{{ lockedMessage }}</p>
        <Button 
          v-if="showUpgrade" 
          variant="primary"
          @click="onUpgrade"
        >
          {{ $t('entitlements.locked.upgrade') }}
        </Button>
      </div>
    </slot>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import { useRouter } from 'vue-router'
import { useFeatureGate } from '../composables/useFeatureGate'
import Button from '@/ui/Button.vue'

const props = defineProps({
  feature: {
    type: String,
    required: true
  },
  showUpgrade: {
    type: Boolean,
    default: true
  },
  customMessage: {
    type: String,
    default: null
  }
})

const { granted, reason, isGracePeriod, isTrial } = useFeatureGate(props.feature)
const router = useRouter()

const lockedMessage = computed(() => {
  if (props.customMessage) return props.customMessage
  
  if (isGracePeriod.value) {
    return 'This feature requires an active subscription. Your grace period is ending soon.'
  }
  
  if (isTrial.value) {
    return 'This feature is not available during trial. Upgrade to unlock.'
  }
  
  return 'This feature is not included in your current plan.'
})

function onUpgrade() {
  router.push('/billing')
}
</script>

<style scoped>
.feature-gate {
  width: 100%;
}

.feature-locked {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: var(--spacing-xl);
  text-align: center;
  background: var(--color-surface-elevated);
  border: 1px dashed var(--color-border);
  border-radius: var(--radius-lg);
}

.locked-icon {
  width: 48px;
  height: 48px;
  background: var(--color-surface);
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  margin-bottom: var(--spacing-md);
  color: var(--color-text-secondary);
}

.locked-title {
  font-size: var(--font-size-base);
  font-weight: 600;
  color: var(--color-text-primary);
  margin: 0 0 var(--spacing-sm);
}

.locked-message {
  font-size: var(--font-size-sm);
  color: var(--color-text-secondary);
  margin: 0 0 var(--spacing-md);
  max-width: 300px;
}

</style>
