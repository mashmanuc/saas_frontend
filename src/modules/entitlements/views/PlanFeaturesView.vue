<template>
  <div class="plan-features-view">
    <div class="features-header">
      <h1>{{ $t('entitlements.features.title') }}</h1>
      <p class="subtitle">{{ $t('entitlements.features.subtitle', { plan: currentPlanName }) }}</p>
    </div>
    
    <div class="current-plan-card">
      <div class="plan-badge" :class="planStatusClass">
        {{ currentPlanName }}
      </div>
      <div v-if="isInGracePeriod" class="status-alert grace">
        <i class="icon-clock-alert"></i>
        {{ $t('entitlements.features.graceAlert', { days: daysRemaining }) }}
      </div>
      <div v-else-if="isTrialing" class="status-alert trial">
        <i class="icon-gift"></i>
        {{ $t('entitlements.features.trialAlert', { days: daysRemaining }) }}
      </div>
    </div>
    
    <div class="features-grid">
      <div
        v-for="feature in featuresList"
        :key="feature.id"
        class="feature-card"
        :class="{ 'granted': feature.granted, 'locked': !feature.granted }"
      >
        <div class="feature-icon">
          <i :class="feature.icon || 'icon-star'"></i>
        </div>
        <div class="feature-content">
          <h4 class="feature-name">{{ feature.name }}</h4>
          <p class="feature-description">{{ feature.description }}</p>
          <div v-if="feature.limit" class="feature-limit">
            {{ $t('entitlements.features.limit', { value: feature.limit }) }}
          </div>
        </div>
        <div class="feature-status">
          <span v-if="feature.granted" class="status-badge granted">
            <i class="icon-check"></i>
            {{ $t('entitlements.features.included') }}
          </span>
          <span v-else class="status-badge locked">
            <i class="icon-lock"></i>
            {{ $t('entitlements.features.upgradeRequired') }}
          </span>
        </div>
      </div>
    </div>
    
    <div v-if="!isActive" class="upgrade-section">
      <p>{{ $t('entitlements.features.upgradePrompt') }}</p>
      <Button variant="primary" @click="goToBilling">
        {{ $t('entitlements.features.upgradeCta') }}
      </Button>
    </div>
  </div>
</template>

<script setup>
import { computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useEntitlementsStore } from '../stores/entitlementsStore'
import Button from '@/ui/Button.vue'

const store = useEntitlementsStore()
const router = useRouter()

const currentPlanName = computed(() => {
  const plan = store.currentPlan
  return plan.charAt(0).toUpperCase() + plan.slice(1)
})

const planStatusClass = computed(() => ({
  'status-active': store.isActive,
  'status-trial': store.isTrialing,
  'status-grace': store.isInGracePeriod,
  'status-none': store.planStatus === 'none'
}))

const isInGracePeriod = computed(() => store.isInGracePeriod)
const isTrialing = computed(() => store.isTrialing)
const isActive = computed(() => store.isActive)
const daysRemaining = computed(() => store.daysRemaining)

const featuresList = computed(() => {
  return store.features.map(feature => {
    const check = store.entitlements?.features?.[feature.id]
    return {
      ...feature,
      granted: check?.granted || false,
      limit: check?.granted ? store.entitlements?.limits?.[feature.id] : null
    }
  })
})

onMounted(() => {
  store.fetchEntitlements()
  store.fetchFeatures()
})

function goToBilling() {
  router.push('/billing')
}
</script>

<style scoped>
.plan-features-view {
  max-width: 1200px;
  margin: 0 auto;
  padding: var(--spacing-xl);
}

.features-header {
  margin-bottom: var(--spacing-xl);
}

.features-header h1 {
  font-size: var(--font-size-2xl);
  font-weight: 700;
  margin: 0 0 var(--spacing-sm);
}

.subtitle {
  color: var(--color-text-secondary);
  margin: 0;
}

.current-plan-card {
  display: flex;
  align-items: center;
  gap: var(--spacing-md);
  margin-bottom: var(--spacing-xl);
  flex-wrap: wrap;
}

.plan-badge {
  padding: var(--spacing-sm) var(--spacing-lg);
  border-radius: var(--radius-full);
  font-weight: 600;
  text-transform: uppercase;
  font-size: var(--font-size-sm);
}

.status-active {
  background: var(--color-success-subtle);
  color: var(--color-success);
}

.status-trial {
  background: var(--color-primary-subtle);
  color: var(--color-primary);
}

.status-grace {
  background: var(--color-warning-subtle);
  color: var(--color-warning);
}

.status-none {
  background: var(--color-surface-elevated);
  color: var(--color-text-secondary);
}

.status-alert {
  display: flex;
  align-items: center;
  gap: var(--spacing-sm);
  padding: var(--spacing-sm) var(--spacing-md);
  border-radius: var(--radius-md);
  font-size: var(--font-size-sm);
}

.status-alert.grace {
  background: var(--color-warning-subtle);
  color: var(--color-warning);
}

.status-alert.trial {
  background: var(--color-primary-subtle);
  color: var(--color-primary);
}

.features-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
  gap: var(--spacing-lg);
  margin-bottom: var(--spacing-xl);
}

.feature-card {
  display: flex;
  gap: var(--spacing-md);
  padding: var(--spacing-lg);
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-lg);
  transition: all 0.2s ease;
}

.feature-card.granted {
  border-color: var(--color-success);
  background: linear-gradient(135deg, var(--color-surface) 0%, var(--color-success-subtle) 100%);
}

.feature-card.locked {
  opacity: 0.7;
}

.feature-card.locked:hover {
  opacity: 1;
  border-color: var(--color-border-hover);
}

.feature-icon {
  width: 48px;
  height: 48px;
  background: var(--color-surface-elevated);
  border-radius: var(--radius-md);
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  color: var(--color-text-secondary);
}

.feature-card.granted .feature-icon {
  background: var(--color-success);
  color: var(--color-success-text);
}

.feature-content {
  flex: 1;
}

.feature-name {
  font-size: var(--font-size-base);
  font-weight: 600;
  margin: 0 0 var(--spacing-xs);
  color: var(--color-text-primary);
}

.feature-description {
  font-size: var(--font-size-sm);
  color: var(--color-text-secondary);
  margin: 0 0 var(--spacing-sm);
}

.feature-limit {
  font-size: var(--font-size-xs);
  color: var(--color-primary);
  font-weight: 500;
}

.feature-status {
  flex-shrink: 0;
}

.status-badge {
  display: inline-flex;
  align-items: center;
  gap: var(--spacing-xs);
  padding: var(--spacing-xs) var(--spacing-sm);
  border-radius: var(--radius-full);
  font-size: var(--font-size-xs);
  font-weight: 500;
}

.status-badge.granted {
  background: var(--color-success-subtle);
  color: var(--color-success);
}

.status-badge.locked {
  background: var(--color-surface-elevated);
  color: var(--color-text-tertiary);
}

.upgrade-section {
  text-align: center;
  padding: var(--spacing-xl);
  background: var(--color-surface-elevated);
  border: 1px dashed var(--color-border);
  border-radius: var(--radius-lg);
}

.upgrade-section p {
  color: var(--color-text-secondary);
  margin: 0 0 var(--spacing-md);
}

@media (max-width: 768px) {
  .features-grid {
    grid-template-columns: 1fr;
  }
  
  .feature-card {
    flex-direction: column;
  }
}
</style>
