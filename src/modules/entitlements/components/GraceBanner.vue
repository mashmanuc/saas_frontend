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
          <button class="btn btn-primary" @click="onRenew">
            {{ $t('entitlements.grance.renew') }}
          </button>
          <button class="btn btn-text" @click="onDismiss">
            {{ $t('common.dismiss') }}
          </button>
        </div>
      </div>
      <button class="btn-close" @click="onDismiss" :aria-label="$t('common.close')">
        <i class="icon-close"></i>
      </button>
    </div>
  </Transition>
</template>

<script setup>
import { computed } from 'vue'
import { useEntitlementsStore } from '../stores/entitlementsStore'
import { useRouter } from 'vue-router'

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

.btn {
  padding: var(--spacing-xs) var(--spacing-md);
  border-radius: var(--radius-md);
  font-size: var(--font-size-sm);
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s ease;
  border: none;
}

.btn-primary {
  background: var(--color-surface);
  color: var(--color-warning);
}

.btn-primary:hover {
  background: var(--color-surface-hover);
}

.btn-text {
  background: transparent;
  color: var(--color-warning-text);
  text-decoration: underline;
  opacity: 0.8;
}

.btn-text:hover {
  opacity: 1;
}

.btn-close {
  background: none;
  border: none;
  color: var(--color-warning-text);
  cursor: pointer;
  padding: var(--spacing-xs);
  opacity: 0.6;
  transition: opacity 0.2s ease;
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
