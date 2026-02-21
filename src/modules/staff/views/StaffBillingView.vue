<template>
  <div class="staff-billing" data-testid="staff-billing">
    <div class="page-header">
      <h1 class="page-title">{{ $t('staff.billing.title') }}</h1>
    </div>

    <div v-if="loading" class="loading-state">
      <LoadingSpinner />
    </div>

    <template v-else>
      <!-- Plan cards -->
      <div class="stat-cards-row">
        <Card class="stat-card">
          <div class="stat-value accent">{{ stats.pro_count }}</div>
          <div class="stat-label">PRO</div>
        </Card>
        <Card class="stat-card">
          <div class="stat-value accent">{{ stats.business_count }}</div>
          <div class="stat-label">BUSINESS</div>
        </Card>
        <Card class="stat-card">
          <div class="stat-value">{{ stats.trial_active }}</div>
          <div class="stat-label">{{ $t('staff.billing.trialing') }}</div>
        </Card>
      </div>

      <!-- Pending checkouts -->
      <Card>
        <h2 class="section-title">{{ $t('staff.billing.pendingCheckouts') }}</h2>
        <div v-if="billing.pending_checkouts?.length === 0" class="empty-hint">
          {{ $t('staff.billing.noPending') }}
        </div>
        <table v-else class="data-table">
          <thead>
            <tr>
              <th>Order</th>
              <th>{{ $t('staff.billing.user') }}</th>
              <th>{{ $t('staff.billing.plan') }}</th>
              <th>{{ $t('staff.billing.pendingAge') }}</th>
              <th>{{ $t('staff.billing.created') }}</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="cs in billing.pending_checkouts" :key="cs.order_id">
              <td class="cell-mono">{{ cs.order_id.slice(0, 8) }}…</td>
              <td>{{ cs.user_email }}</td>
              <td>{{ cs.plan }}</td>
              <td>{{ formatAge(cs.pending_age_seconds) }}</td>
              <td class="cell-muted">{{ formatDate(cs.created_at) }}</td>
            </tr>
          </tbody>
        </table>
      </Card>

      <!-- Recent payments -->
      <Card>
        <h2 class="section-title">{{ $t('staff.billing.recentPayments') }}</h2>
        <div v-if="billing.recent_payments?.length === 0" class="empty-hint">
          {{ $t('staff.billing.noPayments') }}
        </div>
        <table v-else class="data-table">
          <thead>
            <tr>
              <th>{{ $t('staff.billing.user') }}</th>
              <th>{{ $t('staff.billing.amount') }}</th>
              <th>{{ $t('staff.billing.status') }}</th>
              <th>{{ $t('staff.billing.date') }}</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="p in billing.recent_payments" :key="p.id">
              <td>{{ p.user_email }}</td>
              <td class="cell-mono">{{ p.amount }} {{ p.currency }}</td>
              <td>
                <Badge :variant="p.payment_status === 'success' ? 'success' : 'muted'" size="sm">
                  {{ p.payment_status }}
                </Badge>
              </td>
              <td class="cell-muted">{{ formatDate(p.created_at) }}</td>
            </tr>
          </tbody>
        </table>
      </Card>
    </template>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import apiClient from '@/utils/apiClient'
import Card from '@/ui/Card.vue'
import Badge from '@/ui/Badge.vue'
import LoadingSpinner from '@/ui/LoadingSpinner.vue'

const loading = ref(true)
const stats = ref<any>({})
const billing = ref<any>({})

function formatAge(seconds: number) {
  if (seconds < 60) return `${seconds}s`
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m`
  return `${Math.floor(seconds / 3600)}h ${Math.floor((seconds % 3600) / 60)}m`
}

function formatDate(iso: string) {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('uk-UA', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

onMounted(async () => {
  try {
    const [overviewRes, billingRes] = await Promise.all([
      apiClient.get('/v1/staff/stats/overview/', { meta: { skipLoader: true } } as any),
      apiClient.get('/v1/staff/stats/billing/', { meta: { skipLoader: true } } as any),
    ])
    stats.value = overviewRes?.billing || {}
    billing.value = billingRes || {}
  } catch {
    // Silent
  } finally {
    loading.value = false
  }
})
</script>

<style scoped>
.staff-billing {
  display: flex;
  flex-direction: column;
  gap: var(--space-lg);
}

.page-header { margin-bottom: 0; }

.page-title {
  font-size: var(--text-2xl);
  font-weight: 600;
  color: var(--text-primary);
  margin: 0;
}

.stat-cards-row {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
  gap: var(--space-md);
}

.stat-card {
  text-align: center;
  padding: var(--space-lg);
}

.stat-value {
  font-size: var(--text-3xl, 1.875rem);
  font-weight: 700;
  color: var(--text-primary);
}

.stat-value.accent { color: var(--accent); }

.stat-label {
  font-size: var(--text-sm);
  color: var(--text-secondary);
  margin-top: var(--space-xs);
}

.section-title {
  font-size: var(--text-lg);
  font-weight: 600;
  color: var(--text-primary);
  margin: 0 0 var(--space-md);
}

.data-table {
  width: 100%;
  border-collapse: collapse;
}

.data-table th {
  text-align: left;
  padding: var(--space-sm) var(--space-md);
  font-size: var(--text-xs);
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: var(--text-secondary);
  border-bottom: 1px solid var(--border-color);
}

.data-table td {
  padding: var(--space-sm) var(--space-md);
  font-size: var(--text-sm);
  border-bottom: 1px solid var(--border-color);
  color: var(--text-primary);
}

.cell-mono { font-family: monospace; font-size: var(--text-xs); }
.cell-muted { color: var(--text-secondary); }

.empty-hint {
  padding: var(--space-lg);
  text-align: center;
  color: var(--text-secondary);
  font-size: var(--text-sm);
}

.loading-state {
  padding: var(--space-xl);
  text-align: center;
}
</style>
