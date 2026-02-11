<template>
  <div class="solo-page-tabs">
    <button
      v-for="(page, index) in pages"
      :key="page.id"
      class="solo-page-tab"
      :class="{ 'solo-page-tab--active': page.id === activePageId }"
      @click="$emit('switch', page.id)"
      @dblclick="handleRename(page.id)"
    >
      {{ index + 1 }}
      <span
        v-if="pages.length > 1"
        class="solo-page-tab__close"
        @click.stop="$emit('delete', page.id)"
      >
        ×
      </span>
    </button>
    <button
      class="solo-page-tab solo-page-tab--add"
      title="Add Page"
      @click="$emit('add')"
    >
      +
    </button>
  </div>
</template>

<script setup lang="ts">
import type { PageState } from '../../types/solo'

defineProps<{
  pages: PageState[]
  activePageId: string
}>()

const emit = defineEmits<{
  switch: [pageId: string]
  add: []
  delete: [pageId: string]
  rename: [pageId: string, name: string]
}>()

function handleRename(pageId: string): void {
  const name = prompt('Page name:')
  if (name) {
    emit('rename', pageId, name)
  }
}
</script>

<style scoped>
.solo-page-tab__close {
  margin-left: 4px;
  font-size: 14px;
  opacity: 0;
  transition: opacity 0.15s;
}

.solo-page-tab:hover .solo-page-tab__close {
  opacity: 0.7;
}

.solo-page-tab__close:hover {
  opacity: 1;
  color: var(--solo-danger);
}
</style>
