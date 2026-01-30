<template>
  <div v-if="showBanner" class="trial-banner" :class="bannerClass">
    <div class="trial-banner-content">
      <div class="trial-banner-icon">
        <AlertCircle v-if="isExpiringSoon" :size="20" />
        <Info v-else :size="20" />
      </div>
      <div class="trial-banner-text">
        <p class="trial-banner-title">{{ title }}</p>
        <p class="trial-banner-description">{{ description }}</p>
      </div>
      <div class="trial-banner-actions">
        <Button
          v-if="showUpgradeButton"
          variant="primary"
          size="sm"
          @click="handleUpgrade"
        >
          {{ $t('auth.trial.banner.upgradeButton') }}
        </Button>
        <button
          v-if="dismissible"
          type="button"
          class="trial-banner-close"
          @click="handleDismiss"
        >
          ×
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'
import { AlertCircle, Info } from 'lucide-vue-next'
import Button from '@/ui/Button.vue'

const props = defineProps<{
  daysLeft: number
  trialActive: boolean
  dismissible?: boolean
}>()

const emit = defineEmits<{
  dismiss: []
}>()

const { t } = useI18n()
const router = useRouter()

const dismissed = ref(false)

const showBanner = computed(() => {
  if (dismissed.value) return false
  return props.trialActive && props.daysLeft >= 0
})

const isExpiringSoon = computed(() => props.daysLeft <= 3)

const bannerClass = computed(() => {
  if (isExpiringSoon.value) return 'trial-banner-warning'
  return 'trial-banner-info'
})

const title = computed(() => {
  if (props.daysLeft === 0) {
    return t('auth.trial.banner.lastDay')
  }
  return t('auth.trial.banner.title', { days: props.daysLeft })
})

const description = computed(() => {
  if (isExpiringSoon.value) {
    return t('auth.trial.banner.expiringSoonDescription')
  }
  return t('auth.trial.banner.description')
})

const showUpgradeButton = computed(() => isExpiringSoon.value)

function handleUpgrade() {
  router.push('/billing/plans')
}

function handleDismiss() {
  dismissed.value = true
  emit('dismiss')
}
</script>

<style scoped>
.trial-banner {
  border-radius: var(--radius-md, 8px);
  padding: 1rem;
  margin-bottom: 1rem;
}

.trial-banner-info {
  background: var(--info-bg, #dbeafe);
  border: 1px solid var(--info-border, #93c5fd);
  color: var(--info, #1e40af);
}

.trial-banner-warning {
  background: var(--warning-bg, #fef3c7);
  border: 1px solid var(--warning-border, #fcd34d);
  color: var(--warning, #b45309);
}

.trial-banner-content {
  display: flex;
  align-items: flex-start;
  gap: 0.75rem;
}

.trial-banner-icon {
  flex-shrink: 0;
  margin-top: 0.125rem;
}

.trial-banner-text {
  flex: 1;
  min-width: 0;
}

.trial-banner-title {
  font-weight: 600;
  font-size: 0.875rem;
  margin: 0 0 0.25rem 0;
}

.trial-banner-description {
  font-size: 0.8125rem;
  margin: 0;
  opacity: 0.9;
}

.trial-banner-actions {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  flex-shrink: 0;
}

.trial-banner-close {
  background: none;
  border: none;
  font-size: 1.5rem;
  cursor: pointer;
  padding: 0;
  width: 24px;
  height: 24px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: var(--radius-sm, 4px);
  color: currentColor;
  opacity: 0.7;
}

.trial-banner-close:hover {
  opacity: 1;
  background: rgba(0, 0, 0, 0.05);
}

@media (max-width: 640px) {
  .trial-banner-content {
    flex-direction: column;
  }
  
  .trial-banner-actions {
    width: 100%;
    justify-content: space-between;
  }
}
</style>
