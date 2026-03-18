<template>
  <nav
    v-if="items.length > 1"
    class="breadcrumb-nav"
    :aria-label="t('breadcrumb.home') || 'Breadcrumb'"
  >
    <ol class="breadcrumb-nav__list">
      <li
        v-for="(item, index) in items"
        :key="index"
        class="breadcrumb-nav__item"
        :class="{ 'breadcrumb-nav__item--current': index === items.length - 1 }"
      >
        <router-link
          v-if="item.to && index < items.length - 1"
          :to="item.to"
          class="breadcrumb-nav__link"
        >
          {{ item.label }}
        </router-link>
        <span
          v-else
          class="breadcrumb-nav__text"
          :aria-current="index === items.length - 1 ? 'page' : undefined"
        >
          {{ item.label }}
        </span>

        <span
          v-if="index < items.length - 1"
          class="breadcrumb-nav__separator"
          aria-hidden="true"
        >
          /
        </span>
      </li>
    </ol>
  </nav>
</template>

<script setup lang="ts">
import { useI18n } from 'vue-i18n'

const { t } = useI18n()

interface BreadcrumbItem {
  label: string
  to?: string
}

defineProps<{
  items: BreadcrumbItem[]
}>()
</script>

<style scoped>
.breadcrumb-nav {
  padding: 0.5rem 0;
  font-size: 0.8125rem;
  color: var(--text-muted, #6b7280);
}

.breadcrumb-nav__list {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 0.25rem;
  list-style: none;
  margin: 0;
  padding: 0;
  overflow-x: auto;
  -webkit-overflow-scrolling: touch;
}

.breadcrumb-nav__item {
  display: flex;
  align-items: center;
  gap: 0.25rem;
  white-space: nowrap;
}

.breadcrumb-nav__link {
  color: var(--primary, #10b981);
  text-decoration: none;
  transition: color 0.15s ease;
}

.breadcrumb-nav__link:hover {
  color: var(--primary-hover, #059669);
  text-decoration: underline;
}

.breadcrumb-nav__link:focus-visible {
  outline: 2px solid var(--primary, #10b981);
  outline-offset: 2px;
  border-radius: 2px;
}

.breadcrumb-nav__text {
  color: var(--text, #111827);
  font-weight: 500;
}

.breadcrumb-nav__separator {
  color: var(--text-muted, #9ca3af);
  user-select: none;
}

.breadcrumb-nav__item--current .breadcrumb-nav__text {
  color: var(--text, #111827);
}

/* Mobile: horizontal scroll */
@media (max-width: 640px) {
  .breadcrumb-nav {
    padding: 0.375rem 0;
    font-size: 0.75rem;
  }

  .breadcrumb-nav__list {
    flex-wrap: nowrap;
    overflow-x: auto;
    scrollbar-width: none;
    -ms-overflow-style: none;
  }

  .breadcrumb-nav__list::-webkit-scrollbar {
    display: none;
  }
}
</style>
