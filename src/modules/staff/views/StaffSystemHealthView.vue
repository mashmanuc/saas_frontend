<template>
  <div class="staff-health" data-testid="staff-health">
    <div class="page-header">
      <h1 class="page-title">{{ $t('staff.health.title') }}</h1>
    </div>

    <div v-if="loading" class="loading-state">
      <LoadingSpinner />
    </div>

    <template v-else>
      <div class="health-cards-row">
        <Card v-for="card in healthCards" :key="card.label" class="health-card">
          <div class="health-indicator" :class="card.status" />
          <div class="health-info">
            <div class="health-label">{{ card.label }}</div>
            <div class="health-value">{{ card.value }}</div>
          </div>
        </Card>
      </div>

      <Card v-if="error">
        <p class="text-danger">{{ error }}</p>
      </Card>
    </template>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useI18n } from 'vue-i18n'
import apiClient from '@/utils/apiClient'
import Card from '@/ui/Card.vue'
import LoadingSpinner from '@/ui/LoadingSpinner.vue'

const { t } = useI18n()
const loading = ref(true)
const error = ref('')

interface HealthCard {
  label: string
  value: string
  status: 'green' | 'yellow' | 'red'
}

const healthCards = ref<HealthCard[]>([])

onMounted(async () => {
  try {
    const res = await apiClient.get('/v1/staff/stats/overview/', {
      meta: { skipLoader: true },
    } as any)

    healthCards.value = [
      {
        label: t('staff.health.users'),
        value: String(res?.users?.total ?? '—'),
        status: 'green',
      },
      {
        label: t('staff.health.openReports'),
        value: String(res?.trust?.open_reports ?? '—'),
        status: (res?.trust?.open_reports ?? 0) > 0 ? 'red' : 'green',
      },
      {
        label: t('staff.health.activeBans'),
        value: String(res?.trust?.active_bans ?? '—'),
        status: (res?.trust?.active_bans ?? 0) > 5 ? 'yellow' : 'green',
      },
      {
        label: t('staff.health.activeSubs'),
        value: String(res?.billing?.active_subscriptions ?? '—'),
        status: 'green',
      },
    ]
  } catch (e: any) {
    error.value = e?.message || 'Failed to load health data'
  } finally {
    loading.value = false
  }
})
</script>

<style scoped>
.staff-health {
  display: flex;
  flex-direction: column;
  gap: var(--space-lg);
}

.page-title {
  font-size: var(--text-2xl);
  font-weight: 600;
  color: var(--text-primary);
  margin: 0;
}

.health-cards-row {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
  gap: var(--space-md);
}

.health-card {
  display: flex;
  align-items: center;
  gap: var(--space-md);
  padding: var(--space-lg);
}

.health-indicator {
  width: 12px;
  height: 12px;
  border-radius: 50%;
  flex-shrink: 0;
}

.health-indicator.green { background: #22c55e; }
.health-indicator.yellow { background: #eab308; }
.health-indicator.red { background: #ef4444; }

.health-label {
  font-size: var(--text-sm);
  color: var(--text-secondary);
}

.health-value {
  font-size: var(--text-xl);
  font-weight: 700;
  color: var(--text-primary);
}

.loading-state {
  padding: var(--space-xl);
  text-align: center;
}

.text-danger {
  color: var(--danger-bg, #ef4444);
}
</style>
