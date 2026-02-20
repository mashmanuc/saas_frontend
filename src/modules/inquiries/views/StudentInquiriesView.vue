<template>
  <div class="student-inquiries-view">
    <div class="view-header">
      <h1>{{ $t('inquiries.student.title') }}</h1>
      <p class="view-description">{{ $t('inquiries.student.description') }}</p>
    </div>
    
    <!-- Loading State -->
    <LoadingState v-if="isLoading && !items.length" :message="$t('inquiries.loading')" />
    
    <!-- Error State -->
    <ErrorState
      v-else-if="errorState"
      :variant="errorState.variant"
      :title="errorState.title"
      :message="errorState.message"
      :retry-after="errorState.retryAfter"
      :show-retry="errorState.showRetry"
      @retry="handleRetry"
    />
    
    <!-- Empty State -->
    <EmptyInquiriesState
      v-else-if="!items.length"
      :title="$t('inquiries.student.empty.title')"
      :description="$t('inquiries.student.empty.description')"
    >
      <template #action>
        <router-link to="/marketplace" class="link-primary">
          Знайти тьютора
        </router-link>
      </template>
    </EmptyInquiriesState>
    
    <!-- Inquiries List -->
    <div v-else class="inquiries-list">
      <InquiryCard
        v-for="inquiry in items"
        :key="inquiry.id"
        :inquiry="inquiry"
        current-user-role="student"
        :show-actions="inquiry.status === 'OPEN'"
      >
        <template #actions>
          <Button 
            variant="secondary"
            size="sm"
            :disabled="isLoading"
            @click="handleCancel(inquiry.id)"
          >
            {{ $t('inquiries.student.cancel') }}
          </Button>
        </template>
      </InquiryCard>
    </div>
  </div>
</template>

<script setup lang="ts">
/**
 * StudentInquiriesView (Phase 1 v0.86)
 * 
 * Дашборд студента для перегляду та управління своїми inquiries
 */

import { onMounted, onUnmounted, watch } from 'vue'
import { useInquiriesStore } from '@/stores/inquiriesStore'
import { useInquiryErrorHandler } from '@/composables/useInquiryErrorHandler'
import { usePageVisibility } from '@/composables/usePageVisibility'
import { storeToRefs } from 'pinia'
import Button from '@/ui/Button.vue'
import LoadingState from '@/components/inquiries/LoadingState.vue'
import ErrorState from '@/components/inquiries/ErrorState.vue'
import EmptyInquiriesState from '@/components/inquiries/EmptyInquiriesState.vue'
import InquiryCard from '@/components/inquiries/InquiryCard.vue'

const inquiriesStore = useInquiriesStore()
const { items, isLoading } = storeToRefs(inquiriesStore)
const { errorState, handleError, clearError } = useInquiryErrorHandler()
const { isVisible } = usePageVisibility()

let refreshInterval: number | null = null

onMounted(async () => {
  await loadInquiries()
  
  // Auto-refresh every 2 minutes (120s) - only when tab is active
  refreshInterval = window.setInterval(() => {
    if (isVisible.value && !isLoading.value) {
      loadInquiries()
    }
  }, 120000) // 120 seconds = 2 minutes
})

onUnmounted(() => {
  // Cleanup interval on component unmount
  if (refreshInterval !== null) {
    clearInterval(refreshInterval)
    refreshInterval = null
  }
})

// Refetch when tab becomes visible again (immediate, not waiting for interval)
watch(isVisible, (visible) => {
  if (visible && !isLoading.value) {
    loadInquiries()
  }
})

async function loadInquiries() {
  clearError()
  try {
    await inquiriesStore.fetchInquiries({ role: 'student' })
  } catch (err) {
    handleError(err)
  }
}

async function handleCancel(inquiryId: string) {
  clearError()
  try {
    await inquiriesStore.cancelInquiry(inquiryId)
  } catch (err) {
    handleError(err)
  }
}

function handleRetry() {
  loadInquiries()
}
</script>

<style scoped>
.student-inquiries-view {
  max-width: 800px;
  margin: 0 auto;
  padding: var(--space-lg);
}

.view-header {
  margin-bottom: var(--space-2xl);
}

.view-header h1 {
  margin: 0 0 var(--space-xs) 0;
  font-size: var(--text-2xl);
  font-weight: 700;
  color: var(--text-primary);
}

.view-description {
  margin: 0;
  font-size: var(--text-base);
  color: var(--text-secondary);
}

.inquiries-list {
  display: flex;
  flex-direction: column;
  gap: var(--space-md);
}

.link-primary {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 0.625rem 1.125rem;
  border-radius: 25px;
  font-weight: 600;
  font-size: 0.95rem;
  background: var(--accent);
  color: var(--accent-contrast);
  border: 1px solid transparent;
  text-decoration: none;
  transition: all 0.2s ease;
  box-shadow: 0 2px 8px var(--shadow), 0 0 0 1px rgba(0, 0, 0, 0.05);
}

.link-primary:hover {
  background: var(--accent-hover);
  transform: translateY(-1px);
  box-shadow: 0 4px 12px var(--shadow-strong), 0 0 0 1px rgba(0, 0, 0, 0.08);
}
</style>
