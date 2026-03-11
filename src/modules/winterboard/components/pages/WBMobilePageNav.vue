<!-- WB Responsive Phase 4 B9: Touch-friendly page navigation
     Ref: winterboard_dev/responsive/PHASE4.md B9
     Compact bar: ← Page 1/5 → + 📄
     Features: prev/next, page counter, add page, open thumbnails sheet -->
<template>
  <nav
    class="wb-page-nav"
    role="navigation"
    :aria-label="t('winterboard.pages.navigation')"
  >
    <!-- Previous page -->
    <button
      type="button"
      class="wb-page-nav__btn"
      :disabled="currentPage <= 1"
      :aria-label="t('winterboard.pages.previous')"
      @click="emit('prev')"
    >
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
        <path d="M10 12L6 8L10 4" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
      </svg>
    </button>

    <!-- Page counter -->
    <span class="wb-page-nav__counter" aria-live="polite">
      {{ currentPage }} / {{ totalPages }}
    </span>

    <!-- Next page -->
    <button
      type="button"
      class="wb-page-nav__btn"
      :disabled="currentPage >= totalPages"
      :aria-label="t('winterboard.pages.next')"
      @click="emit('next')"
    >
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
        <path d="M6 4L10 8L6 12" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
      </svg>
    </button>

    <!-- Separator -->
    <div class="wb-page-nav__sep" aria-hidden="true" />

    <!-- Add page -->
    <button
      type="button"
      class="wb-page-nav__btn"
      :aria-label="t('winterboard.pages.add')"
      @click="emit('add')"
    >
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
        <path d="M8 3V13M3 8H13" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
      </svg>
    </button>

    <!-- Open thumbnails sheet -->
    <button
      type="button"
      class="wb-page-nav__btn wb-page-nav__btn--pages"
      :aria-label="t('winterboard.pages.showAll')"
      @click="emit('open-thumbnails')"
    >
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
        <rect x="2" y="2" width="5" height="5" rx="1" stroke="currentColor" stroke-width="1.2"/>
        <rect x="9" y="2" width="5" height="5" rx="1" stroke="currentColor" stroke-width="1.2"/>
        <rect x="2" y="9" width="5" height="5" rx="1" stroke="currentColor" stroke-width="1.2"/>
        <rect x="9" y="9" width="5" height="5" rx="1" stroke="currentColor" stroke-width="1.2"/>
      </svg>
    </button>
  </nav>
</template>

<script setup lang="ts">
// WB Responsive Phase 4 B9: WBMobilePageNav
import { useI18n } from 'vue-i18n'

interface Props {
  currentPage?: number
  totalPages?: number
}

withDefaults(defineProps<Props>(), {
  currentPage: 1,
  totalPages: 1,
})

const emit = defineEmits<{
  prev: []
  next: []
  add: []
  'open-thumbnails': []
}>()

const { t } = useI18n()
</script>

<style scoped>
.wb-page-nav {
  display: flex;
  align-items: center;
  height: 40px;
  padding: 0 8px;
  gap: 4px;
  background: var(--wb-toolbar-bg, #ffffff);
  border-top: 1px solid var(--wb-toolbar-border, #e2e8f0);
  flex-shrink: 0;
  z-index: var(--wb-z-page-nav, 15);
}

.wb-page-nav__btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 36px;
  height: 36px;
  background: transparent;
  border: none;
  border-radius: 8px;
  color: var(--wb-fg-secondary, #475569);
  cursor: pointer;
  flex-shrink: 0;
  touch-action: manipulation;
}

.wb-page-nav__btn:hover:not(:disabled) {
  background: var(--wb-btn-hover, #f1f5f9);
  color: var(--wb-fg, #0f172a);
}

.wb-page-nav__btn:focus-visible {
  outline: 2px solid var(--wb-brand, #0066FF);
  outline-offset: -2px;
}

.wb-page-nav__btn:disabled {
  opacity: 0.3;
  cursor: not-allowed;
}

.wb-page-nav__counter {
  font-size: 13px;
  font-weight: 600;
  color: var(--wb-fg, #0f172a);
  min-width: 48px;
  text-align: center;
  user-select: none;
}

.wb-page-nav__sep {
  width: 1px;
  height: 20px;
  background: var(--wb-toolbar-border, #e2e8f0);
  margin: 0 4px;
  flex-shrink: 0;
}

@media (prefers-reduced-motion: reduce) {
  .wb-page-nav__btn {
    transition: none;
  }
}
</style>
