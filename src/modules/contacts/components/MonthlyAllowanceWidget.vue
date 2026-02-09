<template>
  <div class="monthly-allowance-widget">
    <div class="allowance-card">
      <div class="allowance-header">
        <h3 class="allowance-title">
          <i class="icon-calendar"></i>
          {{ $t('contacts.allowance.title') }}
        </h3>
      </div>
      
      <div class="allowance-content">
        <div v-if="loading" class="skeleton-loader">
          <div class="skeleton-amount"></div>
          <div class="skeleton-text"></div>
        </div>
        
        <template v-else>
          <div class="allowance-amount">
            <span class="amount">{{ planAllowance }}</span>
            <span class="unit">{{ $t('contacts.tokens') }} / {{ $t('contacts.allowance.month') }}</span>
          </div>
          
          <div class="allowance-details">
            <p v-if="daysUntilAllowance !== null" class="next-grant">
              <i class="icon-clock"></i>
              {{ $t('contacts.allowance.nextGrant', { days: daysUntilAllowance }) }}
            </p>
            <p v-else-if="lastGrantDate" class="last-grant">
              <i class="icon-check"></i>
              {{ $t('contacts.allowance.received', { date: formatDate(lastGrantDate) }) }}
            </p>
            <p v-else class="no-grant">
              {{ $t('contacts.allowance.notStarted') }}
            </p>
          </div>
          
          <div v-if="allowanceHistory.length > 0" class="allowance-history">
            <h4 class="history-title">{{ $t('contacts.allowance.history') }}</h4>
            <ul class="history-list">
              <li
                v-for="(item, index) in allowanceHistory.slice(0, 3)"
                :key="index"
                class="history-item"
              >
                <span class="history-date">{{ formatDate(item.date) }}</span>
                <span class="history-amount">+{{ item.amount }}</span>
                <span class="history-plan">{{ item.plan }}</span>
              </li>
            </ul>
          </div>
        </template>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed, onMounted } from 'vue'
import { useContactTokensStore } from '../stores/contactTokensStore'
import { useI18n } from 'vue-i18n'

const { d } = useI18n()

const store = useContactTokensStore()

const loading = computed(() => store.loading)
const planAllowance = computed(() => store.planAllowance)
const daysUntilAllowance = computed(() => store.daysUntilAllowance)
const lastGrantDate = computed(() => store.lastGrantDate)
const allowanceHistory = computed(() => store.allowanceHistory)

onMounted(() => {
  if (!store.planAllowance) {
    store.fetchAllowanceInfo()
  }
})

function formatDate(dateString) {
  if (!dateString) return ''
  return d(new Date(dateString), 'short')
}
</script>

<style scoped>
.monthly-allowance-widget {
  width: 100%;
}

.allowance-card {
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-lg);
  padding: var(--spacing-lg);
  height: 100%;
}

.allowance-header {
  margin-bottom: var(--spacing-md);
}

.allowance-title {
  display: flex;
  align-items: center;
  gap: var(--spacing-sm);
  font-size: var(--font-size-sm);
  font-weight: 600;
  color: var(--color-text-secondary);
  margin: 0;
}

.allowance-content {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-md);
}

.skeleton-loader {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-sm);
}

.skeleton-amount {
  height: 40px;
  width: 80px;
  background: var(--color-skeleton);
  border-radius: var(--radius-md);
  animation: pulse 1.5s infinite;
}

.skeleton-text {
  height: 16px;
  width: 150px;
  background: var(--color-skeleton);
  border-radius: var(--radius-sm);
  animation: pulse 1.5s infinite;
}

@keyframes pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.5; }
}

.allowance-amount {
  display: flex;
  align-items: baseline;
  gap: var(--spacing-sm);
}

.amount {
  font-size: var(--font-size-2xl);
  font-weight: 700;
  color: var(--color-primary);
  line-height: 1;
}

.unit {
  font-size: var(--font-size-sm);
  color: var(--color-text-secondary);
}

.allowance-details {
  font-size: var(--font-size-sm);
  color: var(--color-text-secondary);
}

.next-grant,
.last-grant,
.no-grant {
  display: flex;
  align-items: center;
  gap: var(--spacing-xs);
  margin: 0;
}

.next-grant {
  color: var(--color-primary);
}

.last-grant {
  color: var(--color-success);
}

.no-grant {
  color: var(--color-text-tertiary);
}

.allowance-history {
  margin-top: var(--spacing-md);
  padding-top: var(--spacing-md);
  border-top: 1px solid var(--color-border);
}

.history-title {
  font-size: var(--font-size-xs);
  font-weight: 600;
  color: var(--color-text-tertiary);
  text-transform: uppercase;
  letter-spacing: 0.05em;
  margin: 0 0 var(--spacing-sm);
}

.history-list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: var(--spacing-xs);
}

.history-item {
  display: flex;
  align-items: center;
  gap: var(--spacing-sm);
  font-size: var(--font-size-sm);
  padding: var(--spacing-xs) 0;
}

.history-date {
  color: var(--color-text-secondary);
  min-width: 80px;
}

.history-amount {
  font-weight: 600;
  color: var(--color-success);
  min-width: 40px;
}

.history-plan {
  color: var(--color-text-tertiary);
  font-size: var(--font-size-xs);
  background: var(--color-surface-elevated);
  padding: var(--spacing-xs) var(--spacing-sm);
  border-radius: var(--radius-full);
}
</style>
