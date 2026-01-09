<template>
  <div class="billing-view">
    <div class="billing-container">
      <div class="billing-header">
        <h1>{{ $t('billing.title') }}</h1>
        <p class="billing-subtitle">{{ $t('billing.subtitle') }}</p>
      </div>

      <div v-if="isLoading" class="loading-state">
        <div class="spinner"></div>
        <p>{{ $t('billing.loading') }}</p>
      </div>

      <div v-else class="billing-content">
        <div class="current-plan-card">
          <h2>{{ $t('billing.currentPlan') }}</h2>
          <div class="plan-badge" :class="`plan-${plan.toLowerCase()}`">
            {{ plan }}
          </div>
          <p v-if="expiresAt" class="expiry-info">
            {{ $t('billing.expiresAt', { date: formatDate(expiresAt) }) }}
          </p>
        </div>

        <div class="coming-soon-card">
          <div class="coming-soon-icon">🚀</div>
          <h2>{{ $t('billing.comingSoon.title') }}</h2>
          <p>{{ $t('billing.comingSoon.description') }}</p>
          <ul class="features-list">
            <li>{{ $t('billing.comingSoon.feature1') }}</li>
            <li>{{ $t('billing.comingSoon.feature2') }}</li>
            <li>{{ $t('billing.comingSoon.feature3') }}</li>
          </ul>
        </div>

        <div class="info-card">
          <h3>{{ $t('billing.needHelp') }}</h3>
          <p>{{ $t('billing.contactSupport') }}</p>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
import { useEntitlementsStore } from '@/stores/entitlementsStore'
import { useI18n } from 'vue-i18n'

const { t } = useI18n()
const entitlementsStore = useEntitlementsStore()

const isLoading = ref(true)

const plan = computed(() => entitlementsStore.plan)
const expiresAt = computed(() => entitlementsStore.expiresAt)

onMounted(async () => {
  try {
    await entitlementsStore.loadEntitlements()
  } catch (err) {
    console.error('Failed to load entitlements:', err)
  } finally {
    isLoading.value = false
  }
})

function formatDate(date: Date): string {
  return new Intl.DateTimeFormat('uk-UA', {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  }).format(date)
}
</script>

<style scoped>
.billing-view {
  min-height: 100vh;
  background-color: #f9fafb;
  padding: 2rem 1rem;
}

.billing-container {
  max-width: 800px;
  margin: 0 auto;
}

.billing-header {
  text-align: center;
  margin-bottom: 3rem;
}

.billing-header h1 {
  font-size: 2.5rem;
  font-weight: 700;
  color: #111827;
  margin: 0 0 0.5rem 0;
}

.billing-subtitle {
  font-size: 1.125rem;
  color: #6b7280;
  margin: 0;
}

.loading-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 4rem 0;
}

.spinner {
  width: 48px;
  height: 48px;
  border: 4px solid #e5e7eb;
  border-top-color: #3b82f6;
  border-radius: 50%;
  animation: spin 1s linear infinite;
  margin-bottom: 1rem;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}

.billing-content {
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
}

.current-plan-card,
.coming-soon-card,
.info-card {
  background: white;
  border-radius: 12px;
  padding: 2rem;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
}

.current-plan-card h2,
.coming-soon-card h2 {
  font-size: 1.5rem;
  font-weight: 600;
  color: #111827;
  margin: 0 0 1rem 0;
}

.plan-badge {
  display: inline-block;
  padding: 0.5rem 1rem;
  border-radius: 6px;
  font-size: 1rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.plan-free {
  background-color: #e5e7eb;
  color: #374151;
}

.plan-pro {
  background-color: #dbeafe;
  color: #1e40af;
}

.plan-business {
  background-color: #fef3c7;
  color: #92400e;
}

.expiry-info {
  margin-top: 1rem;
  font-size: 0.875rem;
  color: #6b7280;
}

.coming-soon-card {
  text-align: center;
}

.coming-soon-icon {
  font-size: 4rem;
  margin-bottom: 1rem;
}

.coming-soon-card p {
  font-size: 1.125rem;
  color: #6b7280;
  margin: 0 0 1.5rem 0;
}

.features-list {
  list-style: none;
  padding: 0;
  margin: 0;
  text-align: left;
  max-width: 400px;
  margin: 0 auto;
}

.features-list li {
  padding: 0.75rem 0;
  border-bottom: 1px solid #e5e7eb;
  color: #374151;
}

.features-list li:last-child {
  border-bottom: none;
}

.features-list li::before {
  content: '✓';
  color: #10b981;
  font-weight: bold;
  margin-right: 0.75rem;
}

.info-card h3 {
  font-size: 1.125rem;
  font-weight: 600;
  color: #111827;
  margin: 0 0 0.5rem 0;
}

.info-card p {
  color: #6b7280;
  margin: 0;
}
</style>
