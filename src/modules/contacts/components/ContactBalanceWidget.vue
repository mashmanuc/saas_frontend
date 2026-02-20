<template>
  <div class="contact-balance-widget">
    <div class="balance-card" :class="{ 'low-balance': hasLowBalance, 'zero-balance': hasNoTokens }">
      <div class="balance-header">
        <h3 class="balance-title">
          <i class="icon-coins"></i>
          {{ $t('contacts.balance.title') }}
        </h3>
        <span v-if="hasLowBalance && !hasNoTokens" class="warning-badge">
          {{ $t('contacts.balance.low') }}
        </span>
      </div>
      
      <div class="balance-content">
        <div v-if="loading" class="skeleton-loader">
          <div class="skeleton-balance"></div>
          <div class="skeleton-text"></div>
        </div>
        
        <template v-else>
          <div class="balance-amount">
            <span class="amount">{{ formattedBalance }}</span>
            <span class="unit">{{ $t('contacts.tokens') }}</span>
          </div>
          
          <div class="balance-details">
            <p v-if="planAllowance > 0" class="allowance-info">
              {{ $t('contacts.allowance.monthly', { amount: planAllowance }) }}
              <span v-if="daysUntilAllowance !== null" class="next-grant">
                • {{ $t('contacts.allowance.nextIn', { days: daysUntilAllowance }) }}
              </span>
            </p>
            
            <p v-if="hasNoTokens" class="zero-message">
              {{ $t('contacts.balance.zeroMessage') }}
            </p>
            
            <p v-else-if="hasLowBalance" class="low-message">
              {{ $t('contacts.balance.lowMessage') }}
            </p>
          </div>
        </template>
      </div>
      
      <div class="balance-actions">
        <Button
          v-if="hasLowBalance || hasNoTokens"
          variant="primary"
          @click="$emit('purchase')"
        >
          {{ $t('contacts.actions.purchase') }}
        </Button>
        <Button
          variant="outline"
          @click="$emit('view-history')"
        >
          {{ $t('contacts.actions.history') }}
        </Button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed, onMounted } from 'vue'
import { useContactTokensStore } from '../stores/contactTokensStore'
import Button from '@/ui/Button.vue'

const props = defineProps({
  autoRefresh: {
    type: Boolean,
    default: true
  }
})

const emit = defineEmits(['purchase', 'view-history'])

const store = useContactTokensStore()

const loading = computed(() => store.loading)
const formattedBalance = computed(() => store.formattedBalance)
const hasLowBalance = computed(() => store.hasLowBalance)
const hasNoTokens = computed(() => store.hasNoTokens)
const planAllowance = computed(() => store.planAllowance)
const daysUntilAllowance = computed(() => store.daysUntilAllowance)

onMounted(() => {
  if (props.autoRefresh) {
    store.fetchBalance()
  }
})
</script>

<style scoped>
.contact-balance-widget {
  width: 100%;
}

.balance-card {
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-lg);
  padding: var(--spacing-lg);
  transition: border-color 0.2s ease;
}

.balance-card.low-balance {
  border-color: var(--color-warning);
  background: linear-gradient(135deg, var(--color-surface) 0%, var(--color-warning-subtle) 100%);
}

.balance-card.zero-balance {
  border-color: var(--color-error);
  background: linear-gradient(135deg, var(--color-surface) 0%, var(--color-error-subtle) 100%);
}

.balance-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: var(--spacing-md);
}

.balance-title {
  display: flex;
  align-items: center;
  gap: var(--spacing-sm);
  font-size: var(--font-size-sm);
  font-weight: 600;
  color: var(--color-text-secondary);
  margin: 0;
}

.warning-badge {
  background: var(--color-warning);
  color: var(--color-warning-text);
  font-size: var(--font-size-xs);
  font-weight: 600;
  padding: var(--spacing-xs) var(--spacing-sm);
  border-radius: var(--radius-full);
}

.balance-content {
  margin-bottom: var(--spacing-lg);
}

.skeleton-loader {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-sm);
}

.skeleton-balance {
  height: 48px;
  width: 100px;
  background: var(--color-skeleton);
  border-radius: var(--radius-md);
  animation: pulse 1.5s infinite;
}

.skeleton-text {
  height: 16px;
  width: 200px;
  background: var(--color-skeleton);
  border-radius: var(--radius-sm);
  animation: pulse 1.5s infinite;
}

@keyframes pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.5; }
}

.balance-amount {
  display: flex;
  align-items: baseline;
  gap: var(--spacing-sm);
  margin-bottom: var(--spacing-sm);
}

.amount {
  font-size: var(--font-size-3xl);
  font-weight: 700;
  color: var(--color-text-primary);
  line-height: 1;
}

.unit {
  font-size: var(--font-size-sm);
  color: var(--color-text-secondary);
}

.balance-details {
  font-size: var(--font-size-sm);
  color: var(--color-text-secondary);
}

.allowance-info {
  margin: 0;
}

.next-grant {
  color: var(--color-text-tertiary);
}

.zero-message,
.low-message {
  margin: var(--spacing-sm) 0 0;
  font-weight: 500;
}

.zero-message {
  color: var(--color-error);
}

.low-message {
  color: var(--color-warning);
}

.balance-actions {
  display: flex;
  gap: var(--spacing-sm);
}
</style>
