<!-- WB: Horizontal page navigation bar (bottom)
     Ref: ManifestWinterboard_v2.md LAW-03, TASK_BOARD.md B2.1
     Max 20 pages. Tabs + "Add page" button. -->
<template>
  <nav
    class="wb-page-nav"
    role="tablist"
    :aria-label="t('winterboard.pages.title')"
  >
    <!-- Page tabs (scrollable) -->
    <div ref="tabsContainer" class="wb-page-nav__tabs">
      <button
        v-for="(page, index) in pages"
        :key="page.id"
        type="button"
        role="tab"
        class="wb-page-nav__tab"
        :class="{ 'wb-page-nav__tab--active': index === currentPageIndex }"
        :aria-selected="index === currentPageIndex"
        :aria-controls="`wb-page-panel-${page.id}`"
        :title="page.name"
        @click="goToPage(index)"
        @dblclick="startRename(index)"
      >
        <span class="wb-page-nav__tab-index">{{ index + 1 }}</span>
        <span class="wb-page-nav__tab-name">{{ page.name }}</span>
      </button>
    </div>

    <!-- Add page button -->
    <button
      type="button"
      class="wb-page-nav__add"
      :disabled="isMaxPages"
      :title="isMaxPages
        ? t('winterboard.pages.maxReached', { max: MAX_PAGES })
        : t('winterboard.pages.addPage')"
      :aria-label="t('winterboard.pages.addPage')"
      @click="addPage"
    >
      <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="2"
        stroke-linecap="round"
        stroke-linejoin="round"
        class="wb-page-nav__add-icon"
      >
        <line x1="12" y1="5" x2="12" y2="19" />
        <line x1="5" y1="12" x2="19" y2="12" />
      </svg>
    </button>

    <!-- Page count indicator -->
    <span class="wb-page-nav__count" aria-live="polite">
      {{ currentPageIndex + 1 }} / {{ pageCount }}
    </span>
  </nav>
</template>

<script setup lang="ts">
// WB: WBPageNav — horizontal page navigation
// Ref: TASK_BOARD.md B2.1

import { computed, ref, nextTick } from 'vue'
import { useI18n } from 'vue-i18n'
import { useWBStore } from '../../board/state/boardStore'

// ─── Constants ──────────────────────────────────────────────────────────────

const MAX_PAGES = 20

// ─── Store ──────────────────────────────────────────────────────────────────

const store = useWBStore()
const { t } = useI18n()

// ─── Computed ───────────────────────────────────────────────────────────────

const pages = computed(() => store.pages)
const currentPageIndex = computed(() => store.currentPageIndex)
const pageCount = computed(() => store.pageCount)
const isMaxPages = computed(() => store.pageCount >= MAX_PAGES)

// ─── Refs ───────────────────────────────────────────────────────────────────

const tabsContainer = ref<HTMLElement | null>(null)

// ─── Actions ────────────────────────────────────────────────────────────────

function goToPage(index: number): void {
  store.goToPage(index)
}

function addPage(): void {
  if (isMaxPages.value) return
  store.addPage()
  // Scroll to the new tab after DOM update
  nextTick(() => {
    if (tabsContainer.value) {
      tabsContainer.value.scrollLeft = tabsContainer.value.scrollWidth
    }
  })
}

// TODO(WB-B4.1): implement page rename via inline edit
function startRename(_index: number): void {
  // Placeholder for future rename functionality
}
</script>

<style scoped>
/* WB: Page navigation bar — fixed at bottom
   LAW-03: Pages = Ordered Stack
   LAW-22: 44px min touch target */
.wb-page-nav {
  display: flex;
  align-items: center;
  gap: 4px;
  height: 40px;
  padding: 0 8px;
  background: var(--wb-toolbar-bg, #ffffff);
  border-top: 1px solid var(--wb-toolbar-border, #e2e8f0);
  box-shadow: 0 -1px 4px rgba(0, 0, 0, 0.04);
  contain: layout style;
  z-index: 15;
  flex-shrink: 0;
}

.wb-page-nav__tabs {
  display: flex;
  gap: 2px;
  overflow-x: auto;
  flex: 1;
  min-width: 0;
  scrollbar-width: thin;
  scrollbar-color: var(--wb-toolbar-border, #e2e8f0) transparent;
}

.wb-page-nav__tabs::-webkit-scrollbar {
  height: 3px;
}

.wb-page-nav__tabs::-webkit-scrollbar-thumb {
  background: var(--wb-toolbar-border, #e2e8f0);
  border-radius: 2px;
}

/* Tab button */
.wb-page-nav__tab {
  display: flex;
  align-items: center;
  gap: 4px;
  height: 32px;
  padding: 0 12px;
  background: transparent;
  border: none;
  border-radius: 6px 6px 0 0;
  cursor: pointer;
  color: var(--wb-fg-secondary, #64748b);
  font-size: 12px;
  font-weight: 500;
  white-space: nowrap;
  transition: background 0.15s ease, color 0.15s ease;
  flex-shrink: 0;
  min-width: 60px;
}

.wb-page-nav__tab:hover {
  background: var(--wb-btn-hover, #f1f5f9);
  color: var(--wb-fg, #0f172a);
}

.wb-page-nav__tab:focus-visible {
  outline: 2px solid var(--wb-brand, #0066FF);
  outline-offset: -2px;
}

.wb-page-nav__tab--active {
  background: var(--wb-brand-light, #dbeafe);
  color: var(--wb-brand, #0066FF);
  font-weight: 600;
  border-bottom: 2px solid var(--wb-brand, #0066FF);
}

.wb-page-nav__tab-index {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 18px;
  height: 18px;
  border-radius: 4px;
  background: var(--wb-bg-secondary, #f1f5f9);
  font-size: 10px;
  font-weight: 700;
  color: var(--wb-fg-secondary, #64748b);
}

.wb-page-nav__tab--active .wb-page-nav__tab-index {
  background: var(--wb-brand, #0066FF);
  color: #ffffff;
}

.wb-page-nav__tab-name {
  max-width: 80px;
  overflow: hidden;
  text-overflow: ellipsis;
}

/* Add button */
.wb-page-nav__add {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  background: transparent;
  border: 1px dashed var(--wb-toolbar-border, #cbd5e1);
  border-radius: 6px;
  cursor: pointer;
  color: var(--wb-fg-secondary, #64748b);
  transition: background 0.15s ease, color 0.15s ease, border-color 0.15s ease;
  flex-shrink: 0;
}

.wb-page-nav__add:hover:not(:disabled) {
  background: var(--wb-brand-light, #dbeafe);
  border-color: var(--wb-brand, #0066FF);
  color: var(--wb-brand, #0066FF);
}

.wb-page-nav__add:focus-visible {
  outline: 2px solid var(--wb-brand, #0066FF);
  outline-offset: -2px;
}

.wb-page-nav__add:disabled {
  opacity: 0.35;
  cursor: not-allowed;
}

.wb-page-nav__add-icon {
  width: 16px;
  height: 16px;
}

/* Page count */
.wb-page-nav__count {
  font-size: 11px;
  color: var(--wb-fg-secondary, #94a3b8);
  font-variant-numeric: tabular-nums;
  white-space: nowrap;
  padding: 0 4px;
  flex-shrink: 0;
}

/* Reduced motion (LAW-22) */
@media (prefers-reduced-motion: reduce) {
  .wb-page-nav__tab,
  .wb-page-nav__add {
    transition: none;
  }
}
</style>
