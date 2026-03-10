<template>
  <div class="contacts-view">
    <div class="contacts-header">
      <h1>{{ $t('contacts.title') }}</h1>
      <p class="subtitle">{{ $t('contacts.subtitle') }}</p>
    </div>
    
    <div class="contacts-grid">
      <!-- Balance Widget -->
      <div class="grid-section balance-section">
        <ContactBalanceWidget
          @purchase="showPurchase = true"
          @view-history="scrollToLedger"
        />
      </div>
      
      <!-- Monthly Allowance -->
      <div class="grid-section allowance-section">
        <MonthlyAllowanceWidget />
      </div>
      
      <!-- Ledger -->
      <div id="ledger" class="grid-section ledger-section">
        <ContactLedgerTable />
      </div>
    </div>
    
    <!-- Purchase Modal -->
    <PurchaseTokensModal
      :is-open="showPurchase"
      @close="showPurchase = false"
      @success="onPurchaseSuccess"
    />
    
    <!-- Grant Modal (Admin only) -->
    <TokenGrantModal
      v-if="canGrant"
      :is-open="showGrant"
      @close="showGrant = false"
      @success="onGrantSuccess"
    />
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { useContactTokensStore } from '../stores/contactTokensStore'
import { useAuthStore } from '@/modules/auth/store/authStore'
import ContactBalanceWidget from '../components/ContactBalanceWidget.vue'
import ContactLedgerTable from '../components/ContactLedgerTable.vue'
import MonthlyAllowanceWidget from '../components/MonthlyAllowanceWidget.vue'
import PurchaseTokensModal from '../components/PurchaseTokensModal.vue'
import TokenGrantModal from '../components/TokenGrantModal.vue'

const store = useContactTokensStore()
const authStore = useAuthStore()

const showPurchase = ref(false)
const showGrant = ref(false)

// Check if user has staff/admin role for grant capability
const canGrant = computed(() => {
  const role = authStore.userRole
  return ['admin', 'staff', 'operator', 'operator_admin'].includes(role)
})

onMounted(() => {
  // Initial data load
  store.fetchBalance()
  store.fetchAllowanceInfo()
})

function scrollToLedger() {
  const ledgerEl = document.getElementById('ledger')
  if (ledgerEl) {
    ledgerEl.scrollIntoView({ behavior: 'smooth' })
  }
}

function onPurchaseSuccess(result) {
  // Refresh balance after purchase
  store.fetchBalance(true)
  // Show success notification
  console.log('Purchase successful:', result)
}

function onGrantSuccess(result) {
  // Grant handled by store, show confirmation
  console.log('Grant successful:', result)
}
</script>

<style scoped>
/* Mobile-first: compact padding */
.contacts-view {
  max-width: 1200px;
  margin: 0 auto;
  padding: var(--spacing-md, 16px);
}

@media (min-width: 768px) {
  .contacts-view {
    padding: var(--spacing-xl);
  }
}

.contacts-header {
  margin-bottom: var(--spacing-xl);
}

/* Mobile-first: responsive heading */
.contacts-header h1 {
  font-size: var(--font-size-xl, 1.25rem);
  font-weight: 700;
  margin: 0 0 var(--spacing-sm);
}

@media (min-width: 768px) {
  .contacts-header h1 {
    font-size: var(--font-size-2xl);
  }
}

.subtitle {
  color: var(--color-text-secondary);
  margin: 0;
}

/* Mobile-first: single column */
.contacts-grid {
  display: grid;
  grid-template-columns: 1fr;
  gap: var(--spacing-md, 16px);
}

@media (min-width: 768px) {
  .contacts-grid {
    grid-template-columns: 1fr 1fr;
    gap: var(--spacing-lg);
  }
}

.grid-section {
  background: var(--color-surface);
  border-radius: var(--radius-lg);
  overflow: hidden;
}

/* Mobile-first: all single column */
.balance-section {
  grid-column: 1;
}

.allowance-section {
  grid-column: 1;
}

.ledger-section {
  grid-column: 1;
}

/* Tablet+: 2-column layout */
@media (min-width: 768px) {
  .balance-section {
    grid-column: 1;
    grid-row: 1;
  }

  .allowance-section {
    grid-column: 2;
    grid-row: 1;
  }

  .ledger-section {
    grid-column: 1 / -1;
    grid-row: 2;
  }
}
</style>
