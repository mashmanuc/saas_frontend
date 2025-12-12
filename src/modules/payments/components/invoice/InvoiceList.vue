<script setup lang="ts">
// F28: Invoice List Component
import type { Invoice } from '../../api/payments'
import InvoiceItem from './InvoiceItem.vue'

defineProps<{
  invoices: Invoice[]
}>()

const emit = defineEmits<{
  download: [id: number]
}>()
</script>

<template>
  <div class="invoice-list">
    <InvoiceItem
      v-for="invoice in invoices"
      :key="invoice.id"
      :invoice="invoice"
      @download="emit('download', invoice.id)"
    />
  </div>
</template>

<style scoped>
.invoice-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}
</style>
