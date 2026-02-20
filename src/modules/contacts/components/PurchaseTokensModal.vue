<template>
  <Modal v-if="isOpen" @close="close" class="purchase-tokens-modal">
    <template #header>
      <h3>{{ $t('contacts.purchase.title') }}</h3>
    </template>
    
    <template #body>
      <div class="purchase-content">
        <!-- Current Balance -->
        <div class="current-balance">
          <span class="balance-label">{{ $t('contacts.purchase.currentBalance') }}</span>
          <span class="balance-value">{{ store.formattedBalance }} {{ $t('contacts.tokens') }}</span>
        </div>
        
        <!-- Packages -->
        <div v-if="loading" class="packages-skeleton">
          <div v-for="i in 3" :key="i" class="package-skeleton"></div>
        </div>
        
        <div v-else-if="packages.length" class="packages-grid">
          <div
            v-for="pkg in packages"
            :key="pkg.id"
            class="package-card"
            :class="{ 'selected': selectedPackage === pkg.id }"
            @click="selectPackage(pkg.id)"
          >
            <div class="package-tokens">
              <span class="token-amount">{{ pkg.tokens }}</span>
              <span class="token-label">{{ $t('contacts.tokens') }}</span>
            </div>
            <div class="package-price">
              <span class="price">{{ formatPrice(pkg.price, pkg.currency) }}</span>
              <span class="per-token">{{ $t('contacts.purchase.perToken', { price: formatPrice(pkg.price_per_token, pkg.currency) }) }}</span>
            </div>
            <div v-if="selectedPackage === pkg.id" class="selected-indicator">
              <i class="icon-check"></i>
            </div>
          </div>
        </div>
        
        <div v-else class="empty-packages">
          <p>{{ $t('contacts.purchase.noPackages') }}</p>
        </div>
        
        <!-- Error -->
        <div v-if="error" class="alert alert-error">
          {{ error }}
        </div>
      </div>
    </template>
    
    <template #footer>
      <div class="modal-actions">
        <Button variant="outline" @click="close">
          {{ $t('common.cancel') }}
        </Button>
        <Button
          variant="primary"
          :disabled="!selectedPackage || processing"
          :loading="processing"
          @click="purchase"
        >
          {{ $t('contacts.purchase.submit') }}
        </Button>
      </div>
    </template>
  </Modal>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { useContactTokensStore } from '../stores/contactTokensStore'
import Modal from '@/components/ui/Modal.vue'
import Button from '@/ui/Button.vue'

const props = defineProps({
  isOpen: {
    type: Boolean,
    default: false
  }
})

const emit = defineEmits(['close', 'success'])

const store = useContactTokensStore()

const selectedPackage = ref(null)
const processing = ref(false)

const loading = computed(() => store.loading)
const error = computed(() => store.error)
const packages = computed(() => store.packages)

onMounted(() => {
  if (!store.packages.length) {
    store.fetchPackages()
  }
})

function formatPrice(price, currency) {
  const formatter = new Intl.NumberFormat('uk-UA', {
    style: 'currency',
    currency: currency || 'UAH',
    minimumFractionDigits: 0,
    maximumFractionDigits: 2
  })
  return formatter.format(price)
}

function selectPackage(packageId) {
  selectedPackage.value = packageId
}

function close() {
  selectedPackage.value = null
  emit('close')
}

async function purchase() {
  if (!selectedPackage.value) return
  
  processing.value = true
  
  try {
    const result = await store.purchaseTokens(selectedPackage.value, {
      success: `${window.location.origin}/contacts/purchase/success`,
      cancel: `${window.location.origin}/contacts/purchase/cancel`
    })
    
    // Redirect to payment provider
    if (result.redirectUrl) {
      window.location.href = result.redirectUrl
    } else {
      emit('success', result)
      close()
    }
  } catch (e) {
    // Error handled by store
  } finally {
    processing.value = false
  }
}
</script>

<style scoped>
.purchase-tokens-modal {
  max-width: 600px;
}

.purchase-content {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-lg);
}

.current-balance {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: var(--spacing-md);
  background: var(--color-surface-elevated);
  border-radius: var(--radius-md);
}

.balance-label {
  font-size: var(--font-size-sm);
  color: var(--color-text-secondary);
}

.balance-value {
  font-size: var(--font-size-lg);
  font-weight: 600;
  color: var(--color-text-primary);
}

.packages-skeleton {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
  gap: var(--spacing-md);
}

.package-skeleton {
  height: 120px;
  background: var(--color-skeleton);
  border-radius: var(--radius-lg);
  animation: pulse 1.5s infinite;
}

@keyframes pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.5; }
}

.packages-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
  gap: var(--spacing-md);
}

.package-card {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: var(--spacing-lg);
  background: var(--color-surface);
  border: 2px solid var(--color-border);
  border-radius: var(--radius-lg);
  cursor: pointer;
  transition: all 0.2s ease;
  position: relative;
}

.package-card:hover {
  border-color: var(--color-primary);
  background: var(--color-primary-subtle);
}

.package-card.selected {
  border-color: var(--color-primary);
  background: var(--color-primary-subtle);
}

.package-tokens {
  display: flex;
  flex-direction: column;
  align-items: center;
  margin-bottom: var(--spacing-sm);
}

.token-amount {
  font-size: var(--font-size-3xl);
  font-weight: 700;
  color: var(--color-text-primary);
  line-height: 1;
}

.token-label {
  font-size: var(--font-size-xs);
  color: var(--color-text-secondary);
  text-transform: uppercase;
}

.package-price {
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
}

.price {
  font-size: var(--font-size-lg);
  font-weight: 600;
  color: var(--color-primary);
}

.per-token {
  font-size: var(--font-size-xs);
  color: var(--color-text-tertiary);
}

.selected-indicator {
  position: absolute;
  top: var(--spacing-sm);
  right: var(--spacing-sm);
  width: 24px;
  height: 24px;
  background: var(--color-primary);
  color: var(--color-primary-text);
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
}

.empty-packages {
  text-align: center;
  padding: var(--spacing-xl);
  color: var(--color-text-secondary);
}

.alert {
  padding: var(--spacing-sm) var(--spacing-md);
  border-radius: var(--radius-md);
  font-size: var(--font-size-sm);
}

.alert-error {
  background: var(--color-error-subtle);
  color: var(--color-error);
  border: 1px solid var(--color-error);
}

.modal-actions {
  display: flex;
  justify-content: flex-end;
  gap: var(--spacing-sm);
}

</style>
