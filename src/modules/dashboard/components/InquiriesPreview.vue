<template>
  <Card v-if="inquiries.length > 0">
    <div class="inquiries-header">
      <h2 class="text-lg font-semibold">
        {{ $t('dashboard.newInquiries.title') }}
        <span class="text-sm text-muted ml-1">({{ inquiries.length }})</span>
      </h2>
      <router-link to="/tutor/inquiries" class="text-sm text-accent hover:underline">
        {{ $t('dashboard.newInquiries.viewAll') }}
      </router-link>
    </div>

    <ul class="space-y-2">
      <li
        v-for="inquiry in displayedInquiries"
        :key="inquiry.id"
        class="inquiry-item"
      >
        <div class="flex-1 min-w-0">
          <p class="text-sm font-medium text-body truncate">
            {{ inquiry.student_name }}
          </p>
          <p v-if="inquiry.subject" class="text-xs text-muted">
            {{ $t('dashboard.newInquiries.wantsToLearn') }} {{ inquiry.subject }}
          </p>
        </div>
        <div class="inquiry-actions">
          <button
            class="inquiry-accept-btn"
            :disabled="loadingId === inquiry.id"
            :aria-label="$t('dashboard.newInquiries.accept') + ': ' + inquiry.student_name"
            @click="$emit('accept', inquiry.id)"
          >
            <Check :size="16" />
          </button>
          <button
            class="inquiry-decline-btn"
            :disabled="loadingId === inquiry.id"
            :aria-label="$t('dashboard.newInquiries.decline') + ': ' + inquiry.student_name"
            @click="$emit('decline', inquiry.id)"
          >
            <X :size="16" />
          </button>
        </div>
      </li>
    </ul>
  </Card>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { Check, X } from 'lucide-vue-next'
import Card from '@/ui/Card.vue'

const MAX_PREVIEW = 3

const props = defineProps<{
  inquiries: Array<{
    id: number | string
    student_name: string
    subject?: string
    status: string
  }>
  loadingId?: number | string | null
}>()

defineEmits<{
  accept: [id: number | string]
  decline: [id: number | string]
}>()

const displayedInquiries = computed(() =>
  props.inquiries.slice(0, MAX_PREVIEW)
)
</script>

<style scoped>
.inquiries-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: var(--space-sm, 12px);
}

/* Mobile-first: stack layout */
.inquiry-item {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: var(--space-sm, 8px);
  padding: var(--space-sm, 8px) var(--space-md, 12px);
  border-radius: var(--radius-lg, 12px);
  border: 1px solid var(--border-color, var(--color-border-default));
  background: var(--card-bg, var(--color-surface));
}

/* Small tablet+: row layout */
@media (min-width: 640px) {
  .inquiry-item {
    flex-direction: row;
    align-items: center;
    gap: var(--space-md, 12px);
  }
}

/* Mobile: full width actions row */
.inquiry-actions {
  display: flex;
  gap: var(--space-xs, 6px);
  flex-shrink: 0;
  width: 100%;
}

/* Small tablet+: auto width */
@media (min-width: 640px) {
  .inquiry-actions {
    width: auto;
  }
}

/* Touch-friendly buttons: 44px min on mobile */
.inquiry-accept-btn,
.inquiry-decline-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  min-width: 44px;
  min-height: 44px;
  border-radius: var(--radius-md, 8px);
  border: 1px solid var(--border-color, var(--color-border-default));
  background: transparent;
  cursor: pointer;
  transition: background-color 0.15s, border-color 0.15s, color 0.15s;
}

/* Desktop: compact buttons */
@media (min-width: 1024px) {
  .inquiry-accept-btn,
  .inquiry-decline-btn {
    min-width: 32px;
    min-height: 32px;
  }
}

.inquiry-accept-btn {
  color: var(--success-bg, #22c55e);
}

.inquiry-accept-btn:hover:not(:disabled) {
  background: color-mix(in srgb, var(--success-bg, #22c55e) 10%, transparent);
  border-color: var(--success-bg, #22c55e);
}

.inquiry-decline-btn {
  color: var(--danger-bg, #ef4444);
}

.inquiry-decline-btn:hover:not(:disabled) {
  background: color-mix(in srgb, var(--danger-bg, #ef4444) 10%, transparent);
  border-color: var(--danger-bg, #ef4444);
}

.inquiry-accept-btn:focus-visible {
  outline: 2px solid var(--success-bg, #22c55e);
  outline-offset: 2px;
}

.inquiry-decline-btn:focus-visible {
  outline: 2px solid var(--danger-bg, #ef4444);
  outline-offset: 2px;
}

.inquiry-accept-btn:disabled,
.inquiry-decline-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
</style>
