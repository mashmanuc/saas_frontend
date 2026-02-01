<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '@/modules/auth/store/authStore'
import marketplaceApi, { type TutorListItem } from '../../api/marketplace'
import TutorCard from '../catalog/TutorCard.vue'
import LoadingSpinner from '@/ui/LoadingSpinner.vue'
import { useI18n } from 'vue-i18n'
import { telemetry } from '@/services/telemetry'

const { t } = useI18n()
const router = useRouter()
const auth = useAuthStore()

const tutors = ref<TutorListItem[]>([])
const isLoading = ref(false)
const error = ref<string | null>(null)

const isStudent = computed(() => auth.userRole === 'student')

onMounted(async () => {
  if (isStudent.value) {
    await loadRecommendations()
  }
})

async function loadRecommendations() {
  isLoading.value = true
  error.value = null
  
  try {
    const response = await marketplaceApi.getTutors({ }, 1, 4, 'recommended')
    tutors.value = response.results.slice(0, 4)
    
    telemetry.trigger('marketplace_recommendation_seen', {
      count: tutors.value.length
    })
  } catch (err) {
    error.value = t('marketplace.recommendations.loadError')
    console.error('[RecommendedTutorsWidget] Load error:', err)
  } finally {
    isLoading.value = false
  }
}

function handleCardClick(tutor: TutorListItem) {
  telemetry.trigger('marketplace_recommendation_click', {
    tutor_slug: tutor.slug
  })
  router.push(`/marketplace/tutors/${tutor.slug}`)
}
</script>

<template>
  <div v-if="isStudent" class="recommendations-widget" data-test="marketplace-recommendations">
    <div class="widget-header">
      <h3>{{ t('marketplace.recommendations.title') }}</h3>
      <p class="widget-subtitle">{{ t('marketplace.recommendations.subtitle') }}</p>
    </div>

    <LoadingSpinner v-if="isLoading" />

    <div v-else-if="error" class="error-state">
      <p>{{ error }}</p>
      <button class="btn btn-sm btn-secondary" @click="loadRecommendations">
        {{ t('common.retry') }}
      </button>
    </div>

    <div v-else-if="tutors.length === 0" class="empty-state">
      <p>{{ t('marketplace.recommendations.empty') }}</p>
    </div>

    <div v-else class="recommendations-list">
      <div
        v-for="tutor in tutors"
        :key="tutor.id"
        class="recommendation-item"
        @click="handleCardClick(tutor)"
      >
        <TutorCard :tutor="tutor" compact />
        <div class="recommendation-reason">
          <span class="reason-icon">💡</span>
          <span class="reason-text">{{ t('marketplace.recommendations.reason') }}</span>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.recommendations-widget {
  background: var(--surface-card);
  border-radius: var(--radius-lg);
  padding: 1.5rem;
  box-shadow: var(--shadow-sm);
}

.widget-header {
  margin-bottom: 1.5rem;
}

.widget-header h3 {
  font-size: 1.25rem;
  font-weight: 600;
  margin: 0 0 0.25rem;
  color: var(--text-primary);
}

.widget-subtitle {
  font-size: 0.875rem;
  color: var(--text-secondary);
  margin: 0;
}

.recommendations-list {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.recommendation-item {
  cursor: pointer;
  transition: transform 0.2s;
  border-radius: var(--radius-md);
  overflow: hidden;
}

.recommendation-item:hover {
  transform: translateX(4px);
}

.recommendation-reason {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.5rem 0.75rem;
  background: color-mix(in srgb, var(--accent-primary) 8%, transparent);
  border-top: 1px solid color-mix(in srgb, var(--accent-primary) 15%, transparent);
  font-size: 0.75rem;
  color: var(--text-secondary);
}

.reason-icon {
  font-size: 1rem;
}

.error-state,
.empty-state {
  text-align: center;
  padding: 2rem 1rem;
  color: var(--text-secondary);
  font-size: 0.875rem;
}
</style>
