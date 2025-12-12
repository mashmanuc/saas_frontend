<script setup lang="ts">
// F16: Booking Status Badge Component
import { computed } from 'vue'
import {
  Clock,
  CheckCircle,
  XCircle,
  AlertCircle,
  Calendar,
  UserX,
} from 'lucide-vue-next'
import type { BookingStatus } from '../../api/booking'

const props = defineProps<{
  status: BookingStatus
  large?: boolean
}>()

const statusConfig = {
  pending: {
    label: 'Pending',
    icon: Clock,
    class: 'status-pending',
  },
  confirmed: {
    label: 'Confirmed',
    icon: CheckCircle,
    class: 'status-confirmed',
  },
  cancelled: {
    label: 'Cancelled',
    icon: XCircle,
    class: 'status-cancelled',
  },
  completed: {
    label: 'Completed',
    icon: CheckCircle,
    class: 'status-completed',
  },
  no_show: {
    label: 'No Show',
    icon: UserX,
    class: 'status-no-show',
  },
  rescheduled: {
    label: 'Rescheduled',
    icon: Calendar,
    class: 'status-rescheduled',
  },
}

const config = computed(() => statusConfig[props.status] || statusConfig.pending)
</script>

<template>
  <span class="booking-status" :class="[config.class, { large }]">
    <component :is="config.icon" :size="large ? 20 : 14" />
    {{ config.label }}
  </span>
</template>

<style scoped>
.booking-status {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 4px 10px;
  border-radius: 20px;
  font-size: 12px;
  font-weight: 500;
}

.booking-status.large {
  padding: 8px 16px;
  font-size: 14px;
}

.status-pending {
  background: var(--color-warning-light, #fef3c7);
  color: var(--color-warning-dark, #92400e);
}

.status-confirmed {
  background: var(--color-success-light, #d1fae5);
  color: var(--color-success-dark, #065f46);
}

.status-cancelled {
  background: var(--color-danger-light, #fee2e2);
  color: var(--color-danger-dark, #991b1b);
}

.status-completed {
  background: var(--color-primary-light, #dbeafe);
  color: var(--color-primary-dark, #1e40af);
}

.status-no-show {
  background: var(--color-bg-tertiary, #e5e7eb);
  color: var(--color-text-secondary, #6b7280);
}

.status-rescheduled {
  background: var(--color-info-light, #e0f2fe);
  color: var(--color-info-dark, #075985);
}
</style>
