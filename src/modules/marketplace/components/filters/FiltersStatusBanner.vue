<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { RefreshCw, AlertCircle } from 'lucide-vue-next'

const props = defineProps<{
  cacheExpired?: boolean
  lastUpdated?: number | null
  onRefresh?: () => void
}>()

const { t } = useI18n()

const showBanner = computed(() => props.cacheExpired && props.lastUpdated)

const timeAgo = computed(() => {
  if (!props.lastUpdated) return ''
  const now = Date.now()
  const diff = now - props.lastUpdated
  const minutes = Math.floor(diff / 60000)
  const hours = Math.floor(minutes / 60)
  const days = Math.floor(hours / 24)

  if (days > 0) return t('marketplace.filters.cacheExpiredDays', { count: days })
  if (hours > 0) return t('marketplace.filters.cacheExpiredHours', { count: hours })
  if (minutes > 0) return t('marketplace.filters.cacheExpiredMinutes', { count: minutes })
  return t('marketplace.filters.cacheExpiredJustNow')
})
</script>

<template>
  <Transition name="slide-down">
    <div v-if="showBanner" class="filters-status-banner" data-test="filters-cache-expired">
      <div class="banner-content">
        <AlertCircle :size="18" class="icon-warning" />
        <div class="banner-text">
          <p class="banner-title">{{ t('marketplace.filters.cacheExpiredTitle') }}</p>
          <p class="banner-subtitle">{{ timeAgo }}</p>
        </div>
      </div>
      <button
        v-if="onRefresh"
        type="button"
        class="refresh-btn"
        @click="onRefresh"
        data-test="filters-refresh-button"
      >
        <RefreshCw :size="16" />
        {{ t('marketplace.filters.refresh') }}
      </button>
    </div>
  </Transition>
</template>

<style scoped>
.filters-status-banner {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  padding: 0.75rem 1rem;
  background: var(--warning-bg, #fff3cd);
  border: 1px solid var(--warning-border, #ffc107);
  border-radius: var(--radius-md, 8px);
  margin-bottom: 1rem;
}

.banner-content {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  flex: 1;
}

.icon-warning {
  color: var(--warning, #ff9800);
  flex-shrink: 0;
}

.banner-text {
  display: flex;
  flex-direction: column;
  gap: 0.125rem;
}

.banner-title {
  font-size: 0.875rem;
  font-weight: 600;
  color: var(--text-primary);
  margin: 0;
}

.banner-subtitle {
  font-size: 0.75rem;
  color: var(--text-secondary);
  margin: 0;
}

.refresh-btn {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.5rem 1rem;
  background: var(--primary);
  color: white;
  border: none;
  border-radius: var(--radius-sm, 6px);
  font-size: 0.875rem;
  font-weight: 500;
  cursor: pointer;
  transition: background 0.2s;
  white-space: nowrap;
}

.refresh-btn:hover {
  background: var(--primary-hover);
}

.refresh-btn:active {
  transform: scale(0.98);
}

.slide-down-enter-active,
.slide-down-leave-active {
  transition: all 0.3s ease;
}

.slide-down-enter-from {
  opacity: 0;
  transform: translateY(-10px);
}

.slide-down-leave-to {
  opacity: 0;
  transform: translateY(-10px);
}

@media (max-width: 640px) {
  .filters-status-banner {
    flex-direction: column;
    align-items: stretch;
  }

  .refresh-btn {
    width: 100%;
    justify-content: center;
  }
}
</style>
