<template>
  <div class="empty-state">
    <div class="empty-state-icon">
      <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
        <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
      </svg>
    </div>
    <h3 class="empty-state-title">{{ title }}</h3>
    <p class="empty-state-description">{{ description }}</p>
    <slot name="action" />
  </div>
</template>

<script setup lang="ts">
/**
 * EmptyInquiriesState Component (Phase 1 v0.86)
 * 
 * Відображає порожній стан для списку inquiries
 */

defineProps<{
  title: string
  description: string
}>()
</script>

<style scoped>
.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 48px 24px;
  text-align: center;
}

.empty-state-icon {
  color: #9CA3AF;
  margin-bottom: 16px;
}

.empty-state-title {
  margin: 0 0 8px 0;
  font-size: 18px;
  font-weight: 600;
  color: #111827;
}

.empty-state-description {
  margin: 0 0 24px 0;
  font-size: 14px;
  color: #6B7280;
  max-width: 400px;
}
</style>
