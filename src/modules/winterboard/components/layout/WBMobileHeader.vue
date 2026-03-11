<!-- WB Responsive Phase 2 B5: Compact mobile header
     Ref: winterboard_dev/responsive/PHASE2.md B5
     Height: 44px, back button, session name, save indicator, menu -->
<template>
  <header
    class="wb-mobile-header"
    :class="{
      'wb-mobile-header--tablet': variant === 'tablet',
    }"
  >
    <!-- Back button -->
    <button
      type="button"
      class="wb-mobile-header__btn wb-mobile-header__btn--back"
      :aria-label="t('winterboard.room.exit')"
      @click="emit('back')"
    >
      <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden="true">
        <path d="M12.5 15L7.5 10L12.5 5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
      </svg>
    </button>

    <!-- Session name (tap to edit) -->
    <button
      type="button"
      class="wb-mobile-header__title"
      :title="sessionName"
      @click="emit('edit-title')"
    >
      <span class="wb-mobile-header__title-text">{{ sessionName }}</span>
    </button>

    <!-- Save indicator -->
    <span
      class="wb-mobile-header__save-dot"
      :class="{
        'wb-mobile-header__save-dot--saved': syncStatus === 'saved',
        'wb-mobile-header__save-dot--saving': syncStatus === 'saving',
        'wb-mobile-header__save-dot--error': syncStatus === 'error',
      }"
      :aria-label="saveLabel"
      role="status"
    />

    <!-- Tablet extras: follow mode + zoom -->
    <template v-if="variant === 'tablet'">
      <span v-if="followMode" class="wb-mobile-header__follow">
        {{ t('winterboard.room.followMode') }}
      </span>
      <span class="wb-mobile-header__zoom">{{ Math.round(zoom * 100) }}%</span>
    </template>

    <!-- Menu button -->
    <button
      type="button"
      class="wb-mobile-header__btn wb-mobile-header__btn--menu"
      :aria-label="t('winterboard.room.menu')"
      @click="emit('menu')"
    >
      <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden="true">
        <circle cx="10" cy="4" r="1.5" fill="currentColor"/>
        <circle cx="10" cy="10" r="1.5" fill="currentColor"/>
        <circle cx="10" cy="16" r="1.5" fill="currentColor"/>
      </svg>
    </button>
  </header>
</template>

<script setup lang="ts">
// WB Responsive Phase 2 B5: WBMobileHeader
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import type { WBSyncStatus } from '../../types/winterboard'

interface Props {
  sessionName?: string
  syncStatus?: WBSyncStatus | 'saved' | 'saving' | 'error'
  variant?: 'mobile' | 'tablet'
  followMode?: boolean
  zoom?: number
}

const props = withDefaults(defineProps<Props>(), {
  sessionName: 'Untitled',
  syncStatus: 'saved',
  variant: 'mobile',
  followMode: false,
  zoom: 1,
})

const emit = defineEmits<{
  back: []
  menu: []
  'edit-title': []
}>()

const { t } = useI18n()

const saveLabel = computed(() => {
  switch (props.syncStatus) {
    case 'saved': return t('winterboard.room.saved')
    case 'saving': return t('winterboard.room.saving')
    case 'error': return t('winterboard.room.syncError')
    default: return ''
  }
})
</script>

<style scoped>
.wb-mobile-header {
  display: flex;
  align-items: center;
  height: 44px;
  padding: 0 4px;
  background: var(--wb-header-bg, #0f172a);
  color: #ffffff;
  gap: 4px;
  flex-shrink: 0;
  z-index: var(--wb-z-header, 30);
}

.wb-mobile-header--tablet {
  height: 48px;
  padding: 0 8px;
}

.wb-mobile-header__btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 44px;
  height: 44px;
  background: transparent;
  border: none;
  color: inherit;
  cursor: pointer;
  border-radius: 8px;
  flex-shrink: 0;
  touch-action: manipulation;
}

.wb-mobile-header__btn:hover {
  background: rgba(255, 255, 255, 0.1);
}

.wb-mobile-header__btn:focus-visible {
  outline: 2px solid var(--wb-brand, #0066FF);
  outline-offset: -2px;
}

.wb-mobile-header__title {
  flex: 1;
  min-width: 0;
  background: transparent;
  border: none;
  color: inherit;
  cursor: pointer;
  text-align: left;
  padding: 4px 8px;
  border-radius: 6px;
  touch-action: manipulation;
}

.wb-mobile-header__title:hover {
  background: rgba(255, 255, 255, 0.1);
}

.wb-mobile-header__title-text {
  display: block;
  font-size: 14px;
  font-weight: 600;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.wb-mobile-header__save-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  flex-shrink: 0;
}

.wb-mobile-header__save-dot--saved {
  background: #22c55e;
}

.wb-mobile-header__save-dot--saving {
  background: #eab308;
  animation: wb-pulse 1s infinite;
}

.wb-mobile-header__save-dot--error {
  background: #ef4444;
}

@keyframes wb-pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.4; }
}

.wb-mobile-header__follow {
  font-size: 11px;
  padding: 2px 6px;
  background: rgba(37, 99, 235, 0.3);
  border-radius: 4px;
  flex-shrink: 0;
}

.wb-mobile-header__zoom {
  font-size: 12px;
  font-weight: 500;
  opacity: 0.7;
  flex-shrink: 0;
  min-width: 36px;
  text-align: center;
}

@media (prefers-reduced-motion: reduce) {
  .wb-mobile-header__save-dot--saving {
    animation: none;
  }
}
</style>
