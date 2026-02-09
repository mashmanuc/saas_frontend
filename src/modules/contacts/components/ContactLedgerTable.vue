<template>
  <div class="contact-ledger-table">
    <div class="ledger-header">
      <h3 class="ledger-title">{{ $t('contacts.ledger.title') }}</h3>
      
      <div class="ledger-filters">
        <select v-model="selectedType" class="filter-select" @change="onFilterChange">
          <option value="">{{ $t('contacts.ledger.allTypes') }}</option>
          <option value="PURCHASE">{{ $t('contacts.ledger.types.purchase') }}</option>
          <option value="DEDUCTION">{{ $t('contacts.ledger.types.deduction') }}</option>
          <option value="REFUND">{{ $t('contacts.ledger.types.refund') }}</option>
          <option value="GRANT">{{ $t('contacts.ledger.types.grant') }}</option>
          <option value="BONUS">{{ $t('contacts.ledger.types.bonus') }}</option>
        </select>
        
        <button
          class="btn btn-icon"
          :title="$t('contacts.ledger.refresh')"
          @click="refresh"
        >
          <i class="icon-refresh" :class="{ 'spin': loading }"></i>
        </button>
      </div>
    </div>
    
    <div class="ledger-content">
      <div v-if="loading && !ledger.length" class="skeleton-table">
        <div v-for="i in 5" :key="i" class="skeleton-row">
          <div class="skeleton-cell"></div>
          <div class="skeleton-cell"></div>
          <div class="skeleton-cell"></div>
          <div class="skeleton-cell"></div>
        </div>
      </div>
      
      <table v-else-if="ledger.length" class="ledger-table">
        <thead>
          <tr>
            <th>{{ $t('contacts.ledger.date') }}</th>
            <th>{{ $t('contacts.ledger.type') }}</th>
            <th>{{ $t('contacts.ledger.change') }}</th>
            <th>{{ $t('contacts.ledger.balance') }}</th>
          </tr>
        </thead>
        <tbody>
          <tr
            v-for="entry in ledger"
            :key="entry.id"
            class="ledger-row"
            :class="`type-${entry.type.toLowerCase()}`"
          >
            <td class="cell-date">{{ formatDate(entry.created_at) }}</td>
            <td class="cell-type">
              <span class="type-badge" :class="`type-${entry.type.toLowerCase()}`">
                {{ $t(`contacts.ledger.types.${entry.type.toLowerCase()}`) }}
              </span>
            </td>
            <td class="cell-delta" :class="{ 'positive': entry.delta > 0, 'negative': entry.delta < 0 }">
              {{ entry.delta > 0 ? '+' : '' }}{{ entry.delta }}
            </td>
            <td class="cell-balance">{{ entry.balance_after }}</td>
          </tr>
        </tbody>
      </table>
      
      <div v-else class="empty-state">
        <i class="icon-empty"></i>
        <p>{{ $t('contacts.ledger.empty') }}</p>
      </div>
    </div>
    
    <div v-if="ledgerHasMore && !loading" class="load-more">
      <button class="btn btn-link" @click="loadMore">
        {{ $t('contacts.ledger.loadMore') }}
      </button>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { useContactTokensStore } from '../stores/contactTokensStore'
import { useI18n } from 'vue-i18n'

const { d } = useI18n()

const store = useContactTokensStore()

const selectedType = ref('')

const ledger = computed(() => store.ledger)
const loading = computed(() => store.loading)
const ledgerHasMore = computed(() => store.ledgerHasMore)

onMounted(() => {
  if (!store.ledger.length) {
    store.fetchLedger()
  }
})

function formatDate(dateString) {
  return d(new Date(dateString), 'short')
}

function onFilterChange() {
  store.fetchLedger({ type: selectedType.value || undefined, offset: 0 })
}

function refresh() {
  store.fetchLedger({ type: selectedType.value || undefined, offset: 0 })
}

function loadMore() {
  store.loadMoreLedger()
}
</script>

<style scoped>
.contact-ledger-table {
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-lg);
  overflow: hidden;
}

.ledger-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: var(--spacing-md) var(--spacing-lg);
  border-bottom: 1px solid var(--color-border);
  background: var(--color-surface-elevated);
}

.ledger-title {
  font-size: var(--font-size-base);
  font-weight: 600;
  margin: 0;
}

.ledger-filters {
  display: flex;
  gap: var(--spacing-sm);
  align-items: center;
}

.filter-select {
  padding: var(--spacing-xs) var(--spacing-sm);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  font-size: var(--font-size-sm);
  background: var(--color-surface);
  color: var(--color-text-primary);
}

.ledger-content {
  max-height: 400px;
  overflow-y: auto;
}

.skeleton-table {
  padding: var(--spacing-md);
}

.skeleton-row {
  display: flex;
  gap: var(--spacing-md);
  margin-bottom: var(--spacing-sm);
}

.skeleton-cell {
  flex: 1;
  height: 32px;
  background: var(--color-skeleton);
  border-radius: var(--radius-sm);
  animation: pulse 1.5s infinite;
}

@keyframes pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.5; }
}

.ledger-table {
  width: 100%;
  border-collapse: collapse;
  font-size: var(--font-size-sm);
}

.ledger-table th,
.ledger-table td {
  padding: var(--spacing-md) var(--spacing-lg);
  text-align: left;
}

.ledger-table th {
  font-weight: 600;
  color: var(--color-text-secondary);
  background: var(--color-surface-elevated);
  position: sticky;
  top: 0;
  z-index: 1;
}

.ledger-table td {
  border-bottom: 1px solid var(--color-border-subtle);
}

.ledger-row:hover {
  background: var(--color-surface-hover);
}

.cell-date {
  color: var(--color-text-secondary);
  font-size: var(--font-size-xs);
}

.type-badge {
  display: inline-flex;
  padding: var(--spacing-xs) var(--spacing-sm);
  border-radius: var(--radius-full);
  font-size: var(--font-size-xs);
  font-weight: 500;
  text-transform: uppercase;
}

.type-badge.type-purchase {
  background: var(--color-success-subtle);
  color: var(--color-success);
}

.type-badge.type-deduction {
  background: var(--color-error-subtle);
  color: var(--color-error);
}

.type-badge.type-refund {
  background: var(--color-info-subtle);
  color: var(--color-info);
}

.type-badge.type-grant,
.type-badge.type-bonus {
  background: var(--color-primary-subtle);
  color: var(--color-primary);
}

.cell-delta {
  font-weight: 600;
  font-family: monospace;
}

.cell-delta.positive {
  color: var(--color-success);
}

.cell-delta.negative {
  color: var(--color-error);
}

.cell-balance {
  font-weight: 600;
  color: var(--color-text-primary);
}

.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: var(--spacing-xl);
  color: var(--color-text-secondary);
  text-align: center;
}

.empty-state i {
  font-size: 48px;
  margin-bottom: var(--spacing-md);
  opacity: 0.5;
}

.load-more {
  display: flex;
  justify-content: center;
  padding: var(--spacing-md);
  border-top: 1px solid var(--color-border);
}

.btn {
  display: inline-flex;
  align-items: center;
  gap: var(--spacing-xs);
  padding: var(--spacing-sm) var(--spacing-md);
  border-radius: var(--radius-md);
  font-size: var(--font-size-sm);
  cursor: pointer;
  transition: all 0.2s ease;
  border: none;
  background: transparent;
  color: var(--color-text-secondary);
}

.btn-icon:hover {
  background: var(--color-surface-hover);
}

.btn-link {
  color: var(--color-primary);
  font-weight: 500;
}

.btn-link:hover {
  color: var(--color-primary-hover);
}

.icon-refresh.spin {
  animation: spin 1s linear infinite;
}

@keyframes spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}
</style>
