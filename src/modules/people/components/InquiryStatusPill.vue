<template>
  <span
    :class="[
      'inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium',
      statusClasses
    ]"
  >
    {{ statusText }}
  </span>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import type { InquiryStatus } from '@/types/inquiries'

const props = defineProps<{
  status: InquiryStatus
}>()

const statusClasses = computed(() => {
  switch (props.status) {
    case 'OPEN':
      return 'bg-blue-100 text-blue-800'
    case 'ACCEPTED':
      return 'bg-green-100 text-green-800'
    case 'REJECTED':
      return 'bg-red-100 text-red-800'
    case 'CANCELLED':
      return 'bg-gray-100 text-gray-800'
    case 'EXPIRED':
      return 'bg-yellow-100 text-yellow-800'
    default:
      return 'bg-gray-100 text-gray-800'
  }
})

const statusText = computed(() => {
  switch (props.status) {
    case 'OPEN':
      return 'Sent'
    case 'ACCEPTED':
      return 'Accepted'
    case 'REJECTED':
      return 'Declined'
    case 'CANCELLED':
      return 'Cancelled'
    case 'EXPIRED':
      return 'Expired'
    default:
      return props.status
  }
})
</script>
