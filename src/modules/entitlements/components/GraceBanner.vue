<template>
  <Transition name="slide-down">
    <div v-if="shouldShow" class="grace-banner">
      <div class="banner-content">
        <div class="banner-icon">
          <i class="icon-clock-alert"></i>
        </div>
        <div class="banner-text">
          <h4 class="banner-title">{{ $t('entitlements.grace.title') }}</h4>
          <p class="banner-message">
            {{ $t('entitlements.grace.message', { days: daysRemaining }) }}
          </p>
          <p class="banner-submessage">
            {{ $t('entitlements.grace.submessage') }}
          </p>
        </div>
        <div class="banner-actions">
          <Button variant="secondary" @click="onRenew">
            {{ $t('entitlements.grace.renew') }}
          </Button>
          <Button variant="ghost" class="btn-text" @click="onDismiss">
            {{ $t('common.dismiss') }}
          </Button>
        </div>
      </div>
      <Button variant="ghost" size="sm" iconOnly class="btn-close" @click="onDismiss" :aria-label="$t('common.close')">
        <i class="icon-close"></i>
      </Button>
    </div>
  </Transition>
</template>

<script setup>
import { computed } from 'vue'
import { useEntitlementsStore } from '../stores/entitlementsStore'
import { useRouter } from 'vue-router'
import Button from '@/ui/Button.vue'

const store = useEntitlementsStore()
const router = useRouter()

const shouldShow = computed(() => store.shouldShowGraceBanner)
const daysRemaining = computed(() => store.daysRemaining)

function onRenew() {
  router.push('/billing')
}

function onDismiss() {
  store.acknowledgeGrace()
}
</script>

<style scoped>
.grace-banner {
  background: linear-gradient(135deg, var(--color-warning) 0%, var(--color-warning-dark) 100%);
  color: var(--color-warning-text);
  padding: var(--spacing-md) var(--spacing-lg);
  position: relative;
  display: flex;
  align-items: center;
  gap: var(--spacing-md);
}

.banner-content {
  display: flex;
  align-items: center;
  gap: var(--spacing-md);
  flex: 1;
  flex-wrap: wrap;
}

.banner-icon {
  font-size: 24px;
  flex-shrink: 0;
}

.banner-text {
  flex: 1;
  min-width: 200px;
}

.banner-title {
  font-size: var(--font-size-base);
  font-weight: 600;
  margin: 0 0 var(--spacing-xs);
}

.banner-message {
  font-size: var(--font-size-sm);
  margin: 0 0 var(--spacing-xs);
  opacity: 0.95;
}

.banner-submessage {
  font-size: var(--font-size-xs);
  margin: 0;
  opacity: 0.8;
}

.banner-actions {
  display: flex;
  gap: var(--spacing-sm);
  flex-shrink: 0;
}

.btn-text {
  color: var(--color-warning-text);
  text-decoration: underline;
  opacity: 0.8;
}

.btn-text:hover {
  opacity: 1;
}

.btn-close {
  color: var(--color-warning-text);
  opacity: 0.6;
  flex-shrink: 0;
}

.btn-close:hover {
  opacity: 1;
}

/* Slide down animation */
.slide-down-enter-active,
.slide-down-leave-active {
  transition: all 0.3s ease;
}

.slide-down-enter-from,
.slide-down-leave-to {
  transform: translateY(-100%);
  opacity: 0;
}

@media (max-width: 640px) {
  .banner-content {
    flex-direction: column;
    align-items: flex-start;
  }
  
  .banner-actions {
    width: 100%;
    justify-content: flex-start;
  }
}
</style>
