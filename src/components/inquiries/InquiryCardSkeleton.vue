<template>
  <div class="inquiry-card-skeleton" aria-hidden="true">
    <div class="skeleton-header">
      <div class="skeleton-avatar pulse" />
      <div class="skeleton-meta">
        <div class="skeleton-line skeleton-name pulse" />
        <div class="skeleton-line skeleton-date pulse" />
      </div>
      <div class="skeleton-badge pulse" />
    </div>
    <div class="skeleton-body">
      <div class="skeleton-line skeleton-text-full pulse" />
      <div class="skeleton-line skeleton-text-partial pulse" />
    </div>
    <div class="skeleton-footer">
      <div class="skeleton-btn pulse" />
      <div class="skeleton-btn pulse" />
    </div>
  </div>
</template>

<script setup lang="ts">
defineProps<{
  count?: number
}>()
</script>

<style scoped>
.inquiry-card-skeleton {
  background: var(--bg-card, #fff);
  border: 1px solid var(--border-color, #e5e7eb);
  border-radius: var(--radius-lg, 12px);
  padding: var(--space-lg, 20px);
  display: flex;
  flex-direction: column;
  gap: var(--space-md, 12px);
}

.skeleton-header {
  display: flex;
  align-items: center;
  gap: var(--space-md, 12px);
}

.skeleton-meta {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.skeleton-body {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.skeleton-footer {
  display: flex;
  gap: var(--space-sm, 8px);
  margin-top: 4px;
}

.skeleton-avatar {
  width: 40px;
  height: 40px;
  border-radius: 50%;
  background: var(--skeleton-color, #e5e7eb);
  flex-shrink: 0;
}

.skeleton-badge {
  width: 72px;
  height: 24px;
  border-radius: 12px;
  background: var(--skeleton-color, #e5e7eb);
}

.skeleton-btn {
  width: 80px;
  height: 34px;
  border-radius: var(--radius-sm, 6px);
  background: var(--skeleton-color, #e5e7eb);
}

.skeleton-line {
  height: 14px;
  border-radius: 4px;
  background: var(--skeleton-color, #e5e7eb);
}

.skeleton-name { width: 55%; }
.skeleton-date { width: 35%; height: 12px; }
.skeleton-text-full { width: 100%; }
.skeleton-text-partial { width: 72%; }

/* Pulse animation */
.pulse {
  animation: skeleton-pulse 1.6s ease-in-out infinite;
}

@keyframes skeleton-pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.5; }
}
</style>
