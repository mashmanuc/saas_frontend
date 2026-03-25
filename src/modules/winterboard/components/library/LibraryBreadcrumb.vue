<template>
  <nav
    v-if="items.length > 1"
    class="library-breadcrumb"
    aria-label="breadcrumb"
    data-testid="breadcrumb"
  >
    <template v-for="(item, idx) in items" :key="item.id ?? 'root'">
      <button
        v-if="idx < items.length - 1"
        type="button"
        class="library-breadcrumb__item"
        @click="emit('navigate', item.id)"
      >
        {{ item.name }}
      </button>
      <span v-else class="library-breadcrumb__current">
        {{ item.name }}
      </span>
      <span
        v-if="idx < items.length - 1"
        class="library-breadcrumb__separator"
        aria-hidden="true"
      >›</span>
    </template>
  </nav>
</template>

<script setup lang="ts">
/**
 * Phase 33 B4: Library Breadcrumb
 *
 * Breadcrumb навігація для показу поточного шляху в папках.
 * Показується тільки коли є вкладеність (items.length > 1).
 */

// ─── Types ───────────────────────────────────────────────────────────────────

export interface BreadcrumbItem {
  id: number | null
  name: string
}

// ─── Props & Emits ───────────────────────────────────────────────────────────

defineProps<{
  items: BreadcrumbItem[]
}>()

const emit = defineEmits<{
  'navigate': [folderId: number | null]
}>()
</script>

<style scoped>
.library-breadcrumb {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 8px 12px;
  font-size: 12px;
  color: var(--wb-text-secondary, #6b7280);
  border-bottom: 1px solid var(--wb-border-color, #e5e7eb);
  overflow-x: auto;
  white-space: nowrap;
  flex-shrink: 0;
}

.library-breadcrumb__item {
  background: none;
  border: none;
  padding: 2px 4px;
  border-radius: 4px;
  cursor: pointer;
  color: var(--wb-text-secondary, #6b7280);
  font-size: 12px;
  transition: background 0.1s ease, color 0.1s ease;
}

.library-breadcrumb__item:hover {
  background: var(--wb-hover-bg, #f3f4f6);
  color: var(--wb-text-primary, #111827);
}

.library-breadcrumb__current {
  font-weight: 600;
  color: var(--wb-text-primary, #111827);
}

.library-breadcrumb__separator {
  opacity: 0.4;
}
</style>
