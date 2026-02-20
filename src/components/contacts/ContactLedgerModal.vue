<template>
  <div class="modal-overlay" @click.self="close" @keydown.esc="close">
    <div
      ref="modalRef"
      class="modal-content"
      role="dialog"
      aria-labelledby="ledger-title"
      aria-modal="true"
    >
      <div class="modal-header">
        <h2 id="ledger-title">{{ $t('contacts.ledger.title') }}</h2>
        <button
          @click="close"
          class="close-button"
          :aria-label="$t('common.close')"
        >
          ×
        </button>
      </div>

      <div class="modal-body">
        <!-- Error State -->
        <div v-if="errorLedger" class="error-state">
          <p>{{ $t('contacts.ledger.error') }}</p>
          <button @click="retry" class="retry-button">
            {{ $t('common.retry') }}
          </button>
        </div>

        <!-- Loading State (initial) -->
        <div v-else-if="isLoadingLedger && ledger.length === 0" class="loading-state">
          <div class="spinner-large"></div>
          <p>{{ $t('contacts.ledger.loading') }}</p>
        </div>

        <!-- Ledger List -->
        <div v-else-if="ledger.length > 0" class="ledger-list">
          <div
            v-for="item in ledger"
            :key="item.id"
            class="ledger-item"
          >
            <div class="item-main">
              <div class="item-type">
                <span class="type-badge" :class="`type-${item.transaction_type.toLowerCase()}`">
                  {{ $t(`contacts.ledger.type.${item.transaction_type.toLowerCase()}`) }}
                </span>
              </div>
              <div class="item-reason">{{ item.reason }}</div>
              <div class="item-date">{{ formatDate(item.created_at) }}</div>
            </div>
            <div class="item-amounts">
              <div class="delta" :class="item.delta > 0 ? 'positive' : 'negative'">
                {{ item.delta > 0 ? '+' : '' }}{{ item.delta }}
              </div>
              <div class="balance-after">
                {{ $t('contacts.ledger.balanceAfter') }}: {{ item.balance_after }}
              </div>
            </div>
          </div>

          <!-- Load More Button -->
          <div v-if="ledgerHasMore" class="load-more-container">
            <button
              @click="loadMore"
              :disabled="isLoadingLedger"
              class="load-more-button"
            >
              <span v-if="isLoadingLedger" class="spinner-small"></span>
              <span v-else>{{ $t('contacts.ledger.loadMore') }}</span>
            </button>
          </div>

          <!-- End of list -->
          <div v-else class="end-message">
            {{ $t('contacts.ledger.endOfList') }}
          </div>
        </div>

        <!-- Empty State -->
        <div v-else class="empty-state">
          <p>{{ $t('contacts.ledger.empty') }}</p>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue'
import { storeToRefs } from 'pinia'
import { useContactsStore } from '@/stores/contactsStore'

const emit = defineEmits<{
  close: []
}>()

const contactsStore = useContactsStore()
const { ledger, ledgerHasMore, isLoadingLedger, errorLedger } = storeToRefs(contactsStore)

const modalRef = ref<HTMLElement | null>(null)

function close() {
  emit('close')
}

function retry() {
  contactsStore.resetLedgerAndFetchFirstPage()
}

function loadMore() {
  contactsStore.loadMoreLedger()
}

function formatDate(dateString: string): string {
  const date = new Date(dateString)
  return new Intl.DateTimeFormat('uk-UA', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  }).format(date)
}

// Focus trap
function handleTabKey(e: KeyboardEvent) {
  if (e.key !== 'Tab' || !modalRef.value) return

  const focusableElements = modalRef.value.querySelectorAll(
    'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
  )
  const firstElement = focusableElements[0] as HTMLElement
  const lastElement = focusableElements[focusableElements.length - 1] as HTMLElement

  if (e.shiftKey) {
    if (document.activeElement === firstElement) {
      lastElement?.focus()
      e.preventDefault()
    }
  } else {
    if (document.activeElement === lastElement) {
      firstElement?.focus()
      e.preventDefault()
    }
  }
}

onMounted(async () => {
  // Reset and fetch first page
  await contactsStore.resetLedgerAndFetchFirstPage()

  // Focus first focusable element
  setTimeout(() => {
    const firstButton = modalRef.value?.querySelector('button') as HTMLElement
    firstButton?.focus()
  }, 100)

  // Add keyboard listeners
  document.addEventListener('keydown', handleTabKey)
})

onUnmounted(() => {
  document.removeEventListener('keydown', handleTabKey)
})
</script>

<style scoped>
.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}

.modal-content {
  background: var(--card-bg);
  border-radius: 0.5rem;
  max-width: 600px;
  width: 90%;
  max-height: 80vh;
  display: flex;
  flex-direction: column;
  box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1);
}

.modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 1.5rem;
  border-bottom: 1px solid var(--border-color);
}

.modal-header h2 {
  margin: 0;
  font-size: 1.25rem;
  font-weight: 600;
  color: var(--text-primary);
}

.close-button {
  background: none;
  border: none;
  font-size: 2rem;
  line-height: 1;
  cursor: pointer;
  color: var(--text-secondary);
  padding: 0;
  width: 2rem;
  height: 2rem;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 0.25rem;
}

.close-button:hover {
  background: var(--bg-secondary);
  color: var(--text-primary);
}

.modal-body {
  padding: 1.5rem;
  overflow-y: auto;
  flex: 1;
}

.error-state,
.loading-state,
.empty-state {
  text-align: center;
  padding: 2rem;
  color: var(--text-secondary);
}

.retry-button {
  margin-top: 1rem;
  padding: 0.5rem 1rem;
  background: #3b82f6;
  color: white;
  border: none;
  border-radius: 0.375rem;
  cursor: pointer;
}

.retry-button:hover {
  background: #2563eb;
}

.spinner-large,
.spinner-small {
  display: inline-block;
  border: 3px solid #e5e7eb;
  border-top-color: #3b82f6;
  border-radius: 50%;
  animation: spin 0.6s linear infinite;
}

.spinner-large {
  width: 3rem;
  height: 3rem;
  margin: 0 auto 1rem;
}

.spinner-small {
  width: 1rem;
  height: 1rem;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

.ledger-list {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.ledger-item {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  padding: 1rem;
  border: 1px solid var(--border-color);
  border-radius: 0.375rem;
  background: var(--bg-secondary);
}

.item-main {
  flex: 1;
}

.type-badge {
  display: inline-block;
  padding: 0.25rem 0.5rem;
  border-radius: 0.25rem;
  font-size: 0.75rem;
  font-weight: 600;
  text-transform: uppercase;
}

.type-purchase {
  background: #dbeafe;
  color: #1e40af;
}

.type-deduction {
  background: #fee2e2;
  color: #991b1b;
}

.type-refund {
  background: #d1fae5;
  color: #065f46;
}

.item-reason {
  margin-top: 0.5rem;
  color: var(--text-primary);
  font-size: 0.875rem;
}

.item-date {
  margin-top: 0.25rem;
  color: var(--text-secondary);
  font-size: 0.75rem;
}

.item-amounts {
  text-align: right;
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.delta {
  font-weight: 600;
  font-size: 1.125rem;
}

.delta.positive {
  color: #059669;
}

.delta.negative {
  color: #dc2626;
}

.balance-after {
  font-size: 0.75rem;
  color: var(--text-secondary);
}

.load-more-container {
  text-align: center;
  margin-top: 1rem;
}

.load-more-button {
  padding: 0.75rem 1.5rem;
  background: var(--card-bg);
  border: 1px solid var(--border-color);
  border-radius: 0.375rem;
  cursor: pointer;
  font-weight: 500;
  color: var(--text-primary);
}

.load-more-button:hover:not(:disabled) {
  background: #f9fafb;
  border-color: #9ca3af;
}

.load-more-button:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.end-message {
  text-align: center;
  padding: 1rem;
  color: var(--text-secondary);
  font-size: 0.875rem;
}
</style>
