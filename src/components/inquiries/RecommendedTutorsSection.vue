<template>
  <div v-if="shouldShow" class="recommended-tutors-section">
    <h3 class="section-title">{{ t('inquiries.recommendedTutors.title') }}</h3>
    <p class="section-description">{{ t('inquiries.recommendedTutors.description') }}</p>
    
    <!-- Loading state -->
    <div v-if="isLoading" class="loading-state">
      <div class="spinner" aria-label="Loading recommendations"></div>
      <p>{{ t('inquiries.recommendedTutors.loading') }}</p>
    </div>
    
    <!-- Error state -->
    <div v-else-if="error" class="error-state">
      <AlertCircle class="error-icon" />
      <p class="error-message">{{ error }}</p>
      <button @click="loadRecommendations" class="retry-button">
        {{ t('common.retry') }}
      </button>
    </div>
    
    <!-- Tutors list -->
    <div v-else-if="tutors.length > 0" class="tutors-grid">
      <div
        v-for="tutor in tutors"
        :key="tutor.id"
        class="tutor-card"
        @click="handleTutorClick(tutor)"
      >
        <img
          v-if="tutor.photo"
          :src="tutor.photo"
          :alt="tutor.full_name"
          class="tutor-photo"
        />
        <div class="tutor-info">
          <h4 class="tutor-name">{{ tutor.full_name }}</h4>
          <p class="tutor-headline">{{ tutor.headline }}</p>
          <div class="tutor-meta">
            <span class="rating">⭐ {{ tutor.average_rating?.toFixed(1) || 'N/A' }}</span>
            <span class="price">{{ tutor.hourly_rate }} {{ tutor.currency }}/{{ t('common.hour') }}</span>
          </div>
        </div>
      </div>
    </div>
    
    <!-- Empty state -->
    <div v-else class="empty-state">
      <p>{{ t('inquiries.recommendedTutors.noResults') }}</p>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, watch, computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'
import { AlertCircle } from 'lucide-vue-next'
import { getRecommendedTutors } from '@/api/inquiries'
import { useToast } from '@/composables/useToast'

interface Inquiry {
  id: string
  status: string
  [key: string]: any
}

interface Props {
  inquiry: Inquiry
}

const props = defineProps<Props>()
const emit = defineEmits<{
  'tutor-selected': [tutor: any]
}>()

const { t } = useI18n()
const router = useRouter()
const toast = useToast()

const tutors = ref<any[]>([])
const isLoading = ref(false)
const error = ref<string | null>(null)

const shouldShow = computed(() => {
  return props.inquiry.status === 'REJECTED'
})

/**
 * Завантажити рекомендації
 */
async function loadRecommendations() {
  if (!props.inquiry.id) return
  
  isLoading.value = true
  error.value = null
  
  try {
    const recommendations = await getRecommendedTutors(props.inquiry.id)
    tutors.value = recommendations
    
    // Telemetry
    if (typeof window !== 'undefined' && (window as any).telemetry) {
      (window as any).telemetry.track('inquiry.recommendations_loaded', {
        inquiry_id: props.inquiry.id,
        count: recommendations.length
      })
    }
  } catch (err: any) {
    const errorMsg = err.response?.data?.detail || err.message || t('inquiries.recommendedTutors.loadError')
    error.value = errorMsg
    
    // Show toast for user-visible error
    toast.error(errorMsg)
    
    // Telemetry
    if (typeof window !== 'undefined' && (window as any).telemetry) {
      (window as any).telemetry.track('inquiry.recommendations_error', {
        inquiry_id: props.inquiry.id,
        error: errorMsg
      })
    }
  } finally {
    isLoading.value = false
  }
}

/**
 * Обробити клік по тьютору
 */
function handleTutorClick(tutor: any) {
  emit('tutor-selected', tutor)
  
  // Navigate to tutor profile
  if (tutor.slug) {
    router.push(`/tutors/${tutor.slug}`)
  }
  
  // Telemetry
  if (typeof window !== 'undefined' && (window as any).telemetry) {
    (window as any).telemetry.track('inquiry.recommendation_clicked', {
      inquiry_id: props.inquiry.id,
      tutor_id: tutor.id,
      tutor_slug: tutor.slug
    })
  }
}

/**
 * Watch inquiry status - коли стає REJECTED, завантажуємо рекомендації
 */
watch(
  () => props.inquiry.status,
  (newStatus, oldStatus) => {
    if (newStatus === 'REJECTED' && newStatus !== oldStatus) {
      // Очистити попередні рекомендації
      tutors.value = []
      error.value = null
      
      // Завантажити нові
      loadRecommendations()
    }
  },
  { immediate: true }
)
</script>

<style scoped>
.recommended-tutors-section {
  margin-top: 2rem;
  padding: 1.5rem;
  background: #f9fafb;
  border-radius: 8px;
}

.section-title {
  font-size: 1.25rem;
  font-weight: 600;
  margin-bottom: 0.5rem;
  color: var(--text-primary);
}

.section-description {
  font-size: 0.875rem;
  color: var(--text-secondary);
  margin-bottom: 1.5rem;
}

.loading-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 2rem;
  gap: 1rem;
}

.spinner {
  width: 2rem;
  height: 2rem;
  border: 3px solid #e5e7eb;
  border-top-color: #3b82f6;
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

.error-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 2rem;
  gap: 1rem;
}

.error-icon {
  width: 3rem;
  height: 3rem;
  color: #ef4444;
}

.error-message {
  color: #dc2626;
  text-align: center;
}

.retry-button {
  padding: 0.5rem 1rem;
  background: #3b82f6;
  color: white;
  border: none;
  border-radius: 6px;
  cursor: pointer;
  font-weight: 500;
  transition: background 0.2s;
}

.retry-button:hover {
  background: #2563eb;
}

.tutors-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: 1rem;
}

.tutor-card {
  background: var(--card-bg);
  border: 1px solid var(--border-color);
  border-radius: 8px;
  padding: 1rem;
  cursor: pointer;
  transition: all 0.2s;
  display: flex;
  gap: 1rem;
}

.tutor-card:hover {
  border-color: #3b82f6;
  box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
  transform: translateY(-2px);
}

.tutor-photo {
  width: 64px;
  height: 64px;
  border-radius: 50%;
  object-fit: cover;
  flex-shrink: 0;
}

.tutor-info {
  flex: 1;
  min-width: 0;
}

.tutor-name {
  font-size: 1rem;
  font-weight: 600;
  margin-bottom: 0.25rem;
  color: var(--text-primary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.tutor-headline {
  font-size: 0.875rem;
  color: var(--text-secondary);
  margin-bottom: 0.5rem;
  overflow: hidden;
  text-overflow: ellipsis;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
}

.tutor-meta {
  display: flex;
  gap: 1rem;
  font-size: 0.875rem;
  color: #374151;
}

.rating {
  display: flex;
  align-items: center;
  gap: 0.25rem;
}

.price {
  font-weight: 500;
}

.empty-state {
  padding: 2rem;
  text-align: center;
  color: #6b7280;
}
</style>
