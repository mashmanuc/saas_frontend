<template>
  <div v-if="shouldShow" class="warning-banner" :class="bannerClass">
    <div class="warning-icon">⚠️</div>
    <div class="warning-content">
      <h3 class="warning-title">{{ title }}</h3>
      <p class="warning-message">{{ message }}</p>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'

const props = defineProps<{
  declineStreak: number
  isBlocked: boolean
}>()

const { t } = useI18n()

const shouldShow = computed(() => props.declineStreak > 0 || props.isBlocked)

const bannerClass = computed(() => {
  if (props.isBlocked) return 'danger'
  if (props.declineStreak >= 4) return 'danger'
  if (props.declineStreak >= 2) return 'warning'
  return 'info'
})

const title = computed(() => {
  if (props.isBlocked) {
    return t('warnings.blocked.title')
  }
  return t('warnings.declineStreak.title')
})

const message = computed(() => {
  if (props.isBlocked) {
    return t('warnings.blocked.message')
  }
  return t('warnings.declineStreak.message', { count: props.declineStreak })
})
</script>

<style scoped>
.warning-banner {
  display: flex;
  gap: 1rem;
  padding: 1rem;
  border-radius: 0.5rem;
  border-left: 4px solid;
  margin-bottom: 1rem;
}

.warning-banner.info {
  background: #eff6ff;
  border-color: #3b82f6;
}

.warning-banner.warning {
  background: #fffbeb;
  border-color: #f59e0b;
}

.warning-banner.danger {
  background: #fef2f2;
  border-color: #ef4444;
}

.warning-icon {
  font-size: 1.5rem;
  flex-shrink: 0;
}

.warning-content {
  flex: 1;
}

.warning-title {
  margin: 0 0 0.25rem 0;
  font-size: 1rem;
  font-weight: 600;
  color: #111827;
}

.warning-message {
  margin: 0;
  font-size: 0.875rem;
  color: #374151;
}
</style>
