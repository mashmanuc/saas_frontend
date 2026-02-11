<template>
  <div class="session-actions">
    <button
      class="action-btn"
      @click="$emit('open')"
      :title="$t('common.open')"
    >
      <span class="icon">📂</span>
    </button>
    <button
      class="action-btn"
      @click="$emit('share')"
      :title="$t('solo.share')"
    >
      <span class="icon">🔗</span>
    </button>
    <button
      class="action-btn"
      @click="$emit('export')"
      :title="$t('solo.export.title')"
    >
      <span class="icon">📤</span>
    </button>
    <button
      class="action-btn"
      @click="$emit('duplicate')"
      :title="$t('solo.duplicate')"
    >
      <span class="icon">📋</span>
    </button>
    <button
      class="action-btn action-btn--danger"
      @click="handleDelete"
      :title="$t('solo.delete')"
    >
      <span class="icon">🗑️</span>
    </button>
  </div>
</template>

<script setup lang="ts">
import { useI18n } from 'vue-i18n'

const { t } = useI18n()

const emit = defineEmits<{
  (e: 'open'): void
  (e: 'share'): void
  (e: 'export'): void
  (e: 'duplicate'): void
  (e: 'delete'): void
}>()

function handleDelete(): void {
  if (confirm(t('common.confirmDelete'))) {
    emit('delete')
  }
}
</script>

<style scoped>
.session-actions {
  display: flex;
  gap: 0.25rem;
}

.action-btn {
  padding: 0.5rem;
  background: transparent;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-size: 1rem;
  transition: background-color 0.2s;
}

.action-btn:hover {
  background: var(--hover-bg, #f3f4f6);
}

.action-btn--danger:hover {
  background: var(--danger-bg, #fef2f2);
}
</style>
