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
        <router-link to="/marketplace" class="btn btn-primary">
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
          <button 
            @click="handleCancel(inquiry.id)"
            class="btn btn-secondary btn-sm"
            :disabled="isLoading"
          >
            {{ $t('inquiries.student.cancel') }}
          </button>
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

async function handleCancel(inquiryId: number) {
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
  padding: 24px;
}

.view-header {
  margin-bottom: 32px;
}

.view-header h1 {
  margin: 0 0 8px 0;
  font-size: 28px;
  font-weight: 700;
  color: #111827;
}

.view-description {
  margin: 0;
  font-size: 16px;
  color: #6B7280;
}

.inquiries-list {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.btn {
  padding: 8px 16px;
  border: none;
  border-radius: 6px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;
  font-size: 14px;
}

.btn-sm {
  padding: 6px 12px;
  font-size: 13px;
}

.btn-secondary {
  background: #F3F4F6;
  color: #374151;
}

.btn-secondary:hover:not(:disabled) {
  background: #E5E7EB;
}

.btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
</style>
