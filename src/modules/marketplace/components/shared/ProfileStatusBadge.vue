<script setup lang="ts">
import { Clock, CheckCircle, XCircle, AlertCircle, Eye } from 'lucide-vue-next'
import type { ProfileStatus } from '../../api/marketplace'

interface Props {
  status: ProfileStatus
}

const props = defineProps<Props>()

const statusConfig: Record<ProfileStatus, { label: string; icon: typeof Clock; class: string }> = {
  draft: { label: 'Draft', icon: Clock, class: 'status--draft' },
  pending_review: { label: 'Pending Review', icon: Clock, class: 'status--pending' },
  approved: { label: 'Approved', icon: CheckCircle, class: 'status--approved' },
  rejected: { label: 'Rejected', icon: XCircle, class: 'status--rejected' },
  suspended: { label: 'Suspended', icon: AlertCircle, class: 'status--suspended' },
}

function getConfig() {
  return statusConfig[props.status] || statusConfig.draft
}
</script>

<template>
  <span class="status-badge" :class="getConfig().class">
    <component :is="getConfig().icon" :size="14" />
    {{ getConfig().label }}
  </span>
</template>

<style scoped>
.status-badge {
  display: inline-flex;
  align-items: center;
  gap: 0.375rem;
  padding: 0.375rem 0.75rem;
  border-radius: 9999px;
  font-size: 0.8125rem;
  font-weight: 500;
}

.status--draft {
  background: #f3f4f6;
  color: #6b7280;
}

.status--pending {
  background: #fef3c7;
  color: #b45309;
}

.status--approved {
  background: #d1fae5;
  color: #047857;
}

.status--rejected {
  background: #fee2e2;
  color: #b91c1c;
}

.status--suspended {
  background: #fef2f2;
  color: #991b1b;
}
</style>
