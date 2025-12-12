<script setup lang="ts">
// F11: Review Response Component
import type { ReviewResponse } from '../../api/reviews'

defineProps<{
  response: ReviewResponse
}>()

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}
</script>

<template>
  <div class="review-response">
    <div class="response-header">
      <div class="tutor-badge">
        <span class="badge-icon">T</span>
        <span class="badge-label">Tutor Response</span>
      </div>
      <time class="response-date">{{ formatDate(response.created_at) }}</time>
    </div>

    <p class="response-content">{{ response.content }}</p>
  </div>
</template>

<style scoped>
.review-response {
  margin-top: 16px;
  padding: 16px;
  background: var(--color-bg-secondary, #f5f5f5);
  border-radius: 8px;
  border-left: 3px solid var(--color-primary, #3b82f6);
}

.response-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 12px;
}

.tutor-badge {
  display: flex;
  align-items: center;
  gap: 8px;
}

.badge-icon {
  width: 24px;
  height: 24px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--color-primary, #3b82f6);
  color: white;
  font-size: 12px;
  font-weight: 600;
  border-radius: 50%;
}

.badge-label {
  font-size: 13px;
  font-weight: 600;
  color: var(--color-text-primary, #111827);
}

.response-date {
  font-size: 12px;
  color: var(--color-text-secondary, #6b7280);
}

.response-content {
  margin: 0;
  font-size: 14px;
  color: var(--color-text-primary, #111827);
  line-height: 1.6;
}
</style>
