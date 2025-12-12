<script setup lang="ts">
// F29: Invoice Item Component
import { computed } from 'vue'
import { FileText, Download, CheckCircle, Clock, XCircle } from 'lucide-vue-next'
import type { Invoice } from '../../api/payments'

const props = defineProps<{
  invoice: Invoice
}>()

const emit = defineEmits<{
  download: []
}>()

function formatCurrency(amount: number, currency: string): string {
  return new Intl.NumberFormat('uk-UA', {
    style: 'currency',
    currency,
  }).format(amount / 100)
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('uk-UA', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })
}

const statusConfig = computed(() => {
  const configs: Record<string, { icon: any; color: string; label: string }> = {
    draft: { icon: Clock, color: 'gray', label: 'Draft' },
    open: { icon: Clock, color: 'warning', label: 'Open' },
    paid: { icon: CheckCircle, color: 'success', label: 'Paid' },
    void: { icon: XCircle, color: 'danger', label: 'Void' },
  }
  return configs[props.invoice.status] || configs.draft
})
</script>

<template>
  <div class="invoice-item">
    <div class="invoice-icon">
      <FileText :size="20" />
    </div>

    <div class="invoice-info">
      <div class="invoice-main">
        <span class="invoice-number">{{ invoice.number }}</span>
        <span :class="['invoice-status', statusConfig.color]">
          <component :is="statusConfig.icon" :size="14" />
          {{ statusConfig.label }}
        </span>
      </div>
      <div class="invoice-meta">
        <span>Issued: {{ formatDate(invoice.issued_at) }}</span>
        <span v-if="invoice.paid_at">Paid: {{ formatDate(invoice.paid_at) }}</span>
      </div>
    </div>

    <div class="invoice-right">
      <span class="invoice-amount">
        {{ formatCurrency(invoice.total, invoice.currency) }}
      </span>
      <button class="download-btn" @click="emit('download')">
        <Download :size="16" />
        PDF
      </button>
    </div>
  </div>
</template>

<style scoped>
.invoice-item {
  display: flex;
  align-items: center;
  gap: 14px;
  padding: 16px;
  background: var(--color-bg-primary, white);
  border: 1px solid var(--color-border, #e5e7eb);
  border-radius: 10px;
}

.invoice-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 44px;
  height: 44px;
  background: var(--color-bg-secondary, #f5f5f5);
  border-radius: 10px;
  color: var(--color-text-secondary, #6b7280);
}

.invoice-info {
  flex: 1;
  min-width: 0;
}

.invoice-main {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 4px;
}

.invoice-number {
  font-size: 15px;
  font-weight: 600;
  color: var(--color-text-primary, #111827);
}

.invoice-status {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 2px 8px;
  border-radius: 12px;
  font-size: 12px;
  font-weight: 500;
}

.invoice-status.success {
  background: var(--color-success-light, #d1fae5);
  color: var(--color-success-dark, #065f46);
}

.invoice-status.warning {
  background: var(--color-warning-light, #fef3c7);
  color: var(--color-warning-dark, #92400e);
}

.invoice-status.danger {
  background: var(--color-danger-light, #fee2e2);
  color: var(--color-danger-dark, #991b1b);
}

.invoice-status.gray {
  background: var(--color-bg-tertiary, #e5e7eb);
  color: var(--color-text-secondary, #6b7280);
}

.invoice-meta {
  display: flex;
  gap: 16px;
  font-size: 13px;
  color: var(--color-text-secondary, #6b7280);
}

.invoice-right {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 8px;
}

.invoice-amount {
  font-size: 16px;
  font-weight: 600;
  color: var(--color-text-primary, #111827);
}

.download-btn {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 6px 12px;
  background: var(--color-bg-secondary, #f5f5f5);
  border: 1px solid var(--color-border, #d1d5db);
  border-radius: 6px;
  font-size: 13px;
  color: var(--color-text-primary, #111827);
  cursor: pointer;
  transition: all 0.15s;
}

.download-btn:hover {
  background: var(--color-bg-tertiary, #e5e7eb);
}
</style>
