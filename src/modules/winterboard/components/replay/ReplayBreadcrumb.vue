<template>
  <nav
    v-if="items.length > 1"
    class="replay-breadcrumb"
    aria-label="breadcrumb"
    data-testid="replay-breadcrumb"
  >
    <template v-for="(item, idx) in items" :key="item.id ?? 'root'">
      <button
        v-if="idx < items.length - 1"
        type="button"
        class="replay-breadcrumb__item"
        @click="emit('navigate', item.id)"
      >
        {{ item.name }}
      </button>
      <span v-else class="replay-breadcrumb__current">
        {{ item.name }}
      </span>
      <span
        v-if="idx < items.length - 1"
        class="replay-breadcrumb__separator"
        aria-hidden="true"
      >›</span>
    </template>
  </nav>
</template>

<script setup lang="ts">
// Breadcrumb навігація для показу поточного шляху в ReplayFolder-дереві.
// Показується лише коли вкладеність >= 1 (items.length > 1).
//
// Симетрія: LibraryBreadcrumb.vue (але зі string UUID id замість number).

export interface BreadcrumbItem {
  id: string | null  // null = root
  name: string
}

defineProps<{
  items: BreadcrumbItem[]
}>()

const emit = defineEmits<{
  navigate: [folderId: string | null]
}>()
</script>

<style scoped>
.replay-breadcrumb {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 8px 0;
  font-size: 12px;
  color: var(--text-secondary, #6b7280);
  overflow-x: auto;
  white-space: nowrap;
  flex-shrink: 0;
}

.replay-breadcrumb__item {
  background: none;
  border: none;
  padding: 2px 4px;
  border-radius: 4px;
  cursor: pointer;
  color: var(--text-secondary, #6b7280);
  font-size: 12px;
  transition: background 0.1s ease, color 0.1s ease;
}

.replay-breadcrumb__item:hover {
  background: var(--bg-secondary, #f3f4f6);
  color: var(--text-primary, #111827);
}

.replay-breadcrumb__current {
  font-weight: 600;
  color: var(--text-primary, #111827);
}

.replay-breadcrumb__separator {
  opacity: 0.4;
}
</style>
