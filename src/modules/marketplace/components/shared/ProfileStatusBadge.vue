<script setup lang="ts">
import { Clock, CheckCircle, XCircle, AlertCircle } from 'lucide-vue-next'
import type { ProfileStatus } from '../../api/marketplace'
import { useI18n } from 'vue-i18n'

interface Props {
  status: ProfileStatus
}

const props = defineProps<Props>()

const { t } = useI18n()

const statusConfig: Record<ProfileStatus, { labelKey: string; icon: typeof Clock; class: string }> = {
  draft: { labelKey: 'marketplace.profile.status.draft', icon: Clock, class: 'status--draft' },
  pending_review: {
    labelKey: 'marketplace.profile.status.pending_review',
    icon: Clock,
    class: 'status--pending',
  },
  approved: { labelKey: 'marketplace.profile.status.approved', icon: CheckCircle, class: 'status--approved' },
  rejected: { labelKey: 'marketplace.profile.status.rejected', icon: XCircle, class: 'status--rejected' },
  suspended: { labelKey: 'marketplace.profile.status.suspended', icon: AlertCircle, class: 'status--suspended' },
}

function getConfig() {
  return statusConfig[props.status]
}
</script>

<template>
  <span class="status-badge" :class="getConfig().class">
    <component :is="getConfig().icon" :size="14" />
    {{ t(getConfig().labelKey) }}
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
  background: var(--surface-card-muted);
  color: var(--text-muted);
}

.status--pending {
  background: color-mix(in srgb, var(--warning-bg) 16%, transparent);
  color: color-mix(in srgb, var(--warning-bg) 72%, var(--text-primary));
}

.status--approved {
  background: color-mix(in srgb, var(--success-bg) 16%, transparent);
  color: color-mix(in srgb, var(--success-bg) 72%, var(--text-primary));
}

.status--rejected {
  background: color-mix(in srgb, var(--danger-bg) 16%, transparent);
  color: color-mix(in srgb, var(--danger-bg) 72%, var(--text-primary));
}

.status--suspended {
  background: color-mix(in srgb, var(--danger-bg) 16%, transparent);
  color: color-mix(in srgb, var(--danger-bg) 72%, var(--text-primary));
}
</style>
