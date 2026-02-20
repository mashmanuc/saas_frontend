<template>
  <div v-if="shouldShow" class="contacts-balance-widget">
    <button
      @click="openLedgerModal"
      class="balance-button"
      :class="balanceClass"
      :disabled="isLoadingBalance"
      :aria-label="$t('contacts.balance.ariaLabel')"
    >
      <span v-if="isLoadingBalance" class="spinner"></span>
      <template v-else-if="errorBalance">
        <span class="error-icon">⚠</span>
        <span class="sr-only">{{ $t('contacts.balance.error') }}</span>
      </template>
      <template v-else>
        <span class="balance-label">{{ $t('contacts.balance.label') }}:</span>
        <span class="balance-value">{{ balance ?? '—' }}</span>
      </template>
    </button>
    
    <ContactLedgerModal
      v-if="isLedgerModalOpen"
      @close="closeLedgerModal"
    />
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted } from 'vue'
import { storeToRefs } from 'pinia'
import { useContactsStore } from '@/stores/contactsStore'
import { useAuthStore } from '@/modules/auth/store/authStore'
import ContactLedgerModal from './ContactLedgerModal.vue'
import { ref } from 'vue'

const contactsStore = useContactsStore()
const authStore = useAuthStore()

const { balance, isLoadingBalance, errorBalance } = storeToRefs(contactsStore)
const isLedgerModalOpen = ref(false)

// Show only for authenticated tutors
const shouldShow = computed(() => {
  return authStore.isAuthenticated && authStore.user?.role === 'tutor'
})

// Balance color classes
const balanceClass = computed(() => {
  if (errorBalance.value) return 'balance-error'
  if (balance.value === null) return ''
  if (balance.value === 0) return 'balance-danger'
  if (balance.value <= 3) return 'balance-warning'
  return 'balance-ok'
})

function openLedgerModal() {
  isLedgerModalOpen.value = true
}

function closeLedgerModal() {
  isLedgerModalOpen.value = false
}

// Fetch balance on mount
onMounted(async () => {
  if (shouldShow.value) {
    try {
      await contactsStore.fetchBalance()
    } catch (err) {
      // Error handled by store
    }
  }
})
</script>

<style scoped>
.contacts-balance-widget {
  display: inline-block;
}

.balance-button {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.5rem 1rem;
  border: 1px solid var(--border-color);
  border-radius: 0.375rem;
  background: var(--card-bg);
  cursor: pointer;
  transition: all 0.2s;
  font-size: 0.875rem;
}

.balance-button:hover:not(:disabled) {
  background: #f9fafb;
  border-color: #d1d5db;
}

.balance-button:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.balance-label {
  color: var(--text-secondary);
}

.balance-value {
  font-weight: 600;
  color: var(--text-primary);
}

.balance-ok .balance-value {
  color: #059669;
}

.balance-warning .balance-value {
  color: #d97706;
}

.balance-danger .balance-value {
  color: #dc2626;
}

.balance-error {
  border-color: #fca5a5;
  background: #fef2f2;
}

.error-icon {
  color: #dc2626;
}

.spinner {
  display: inline-block;
  width: 1rem;
  height: 1rem;
  border: 2px solid #e5e7eb;
  border-top-color: #3b82f6;
  border-radius: 50%;
  animation: spin 0.6s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

.sr-only {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
  border-width: 0;
}
</style>
