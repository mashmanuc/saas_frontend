<script setup lang="ts">
// F11: Invoices View
import { ref, onMounted, watch } from 'vue'
import { storeToRefs } from 'pinia'
import { FileText, Download, Filter } from 'lucide-vue-next'
import { useSubscriptionStore } from '../stores/subscriptionStore'
import InvoiceList from '../components/invoice/InvoiceList.vue'

const store = useSubscriptionStore()
const { invoices, isLoading, error } = storeToRefs(store)

const statusFilter = ref<string>('')

const statusOptions = [
  { value: '', label: 'All Invoices' },
  { value: 'paid', label: 'Paid' },
  { value: 'open', label: 'Open' },
  { value: 'void', label: 'Void' },
]

onMounted(() => {
  loadInvoices()
})

watch(statusFilter, () => {
  loadInvoices()
})

function loadInvoices() {
  store.loadInvoices({
    status: statusFilter.value || undefined,
  })
}

async function handleDownload(id: number) {
  try {
    await store.downloadInvoice(id)
  } catch (e) {
    console.error('Download failed:', e)
  }
}
</script>

<template>
  <div class="invoices-view">
    <header class="view-header">
      <div>
        <h1>Invoices</h1>
        <p class="subtitle">View and download your invoices</p>
      </div>
    </header>

    <!-- Filters -->
    <div class="filters-bar">
      <div class="filter-group">
        <Filter :size="18" />
        <select v-model="statusFilter">
          <option v-for="opt in statusOptions" :key="opt.value" :value="opt.value">
            {{ opt.label }}
          </option>
        </select>
      </div>
    </div>

    <!-- Loading -->
    <div v-if="isLoading && invoices.length === 0" class="loading-state">
      <div class="spinner" />
    </div>

    <!-- Empty State -->
    <div v-else-if="invoices.length === 0" class="empty-state">
      <FileText :size="48" />
      <h2>No Invoices</h2>
      <p>You don't have any invoices yet.</p>
    </div>

    <!-- Invoices List -->
    <InvoiceList
      v-else
      :invoices="invoices"
      @download="handleDownload"
    />

    <!-- Error -->
    <div v-if="error" class="error-message">
      {{ error }}
    </div>
  </div>
</template>

<style scoped>
.invoices-view {
  max-width: 800px;
  margin: 0 auto;
  padding: 24px 16px;
}

.view-header {
  margin-bottom: 24px;
}

.view-header h1 {
  margin: 0 0 4px;
  font-size: 28px;
  font-weight: 700;
}

.subtitle {
  margin: 0;
  color: var(--color-text-secondary, #6b7280);
}

/* Filters */
.filters-bar {
  display: flex;
  gap: 12px;
  margin-bottom: 24px;
}

.filter-group {
  display: flex;
  align-items: center;
  gap: 8px;
}

.filter-group svg {
  color: var(--color-text-secondary, #6b7280);
}

.filter-group select {
  padding: 8px 12px;
  border: 1px solid var(--color-border, #d1d5db);
  border-radius: 6px;
  font-size: 14px;
  background: var(--color-bg-primary, white);
}

/* Loading */
.loading-state {
  display: flex;
  justify-content: center;
  padding: 64px 0;
}

.spinner {
  width: 40px;
  height: 40px;
  border: 3px solid var(--color-border, #e5e7eb);
  border-top-color: var(--color-primary, #3b82f6);
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}

/* Empty State */
.empty-state {
  text-align: center;
  padding: 64px 0;
  color: var(--color-text-secondary, #6b7280);
}

.empty-state svg {
  margin-bottom: 16px;
  opacity: 0.5;
}

.empty-state h2 {
  margin: 0 0 8px;
  font-size: 20px;
  color: var(--color-text-primary, #111827);
}

.empty-state p {
  margin: 0;
}

/* Error */
.error-message {
  margin-top: 16px;
  padding: 12px;
  background: var(--color-danger-light, #fee2e2);
  color: var(--color-danger, #ef4444);
  border-radius: 8px;
  font-size: 14px;
}
</style>
