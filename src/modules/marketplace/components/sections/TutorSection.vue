<script setup lang="ts">
// TASK F15-F18: TutorSection component (unified for Popular, New, Recommended, Featured)
import { ref, onMounted, computed } from 'vue'
import { useRouter } from 'vue-router'
import { TrendingUp, Sparkles, ThumbsUp, Star, ArrowRight } from 'lucide-vue-next'
import { marketplaceApi } from '../../api/marketplace'
import type { TutorListItem } from '../../api/marketplace'
import TutorCard from '../catalog/TutorCard.vue'

const props = withDefaults(
  defineProps<{
    type: 'popular' | 'new' | 'recommended' | 'featured'
    limit?: number
  }>(),
  {
    limit: 10,
  }
)

const router = useRouter()

const config = {
  popular: {
    title: 'Popular Tutors',
    icon: TrendingUp,
    endpoint: 'getPopularTutors',
    sortParam: '-lessons',
  },
  new: {
    title: 'New Tutors',
    icon: Sparkles,
    endpoint: 'getNewTutors',
    sortParam: '-newest',
  },
  recommended: {
    title: 'Recommended for You',
    icon: ThumbsUp,
    endpoint: 'getRecommendedTutors',
    sortParam: '-relevance',
  },
  featured: {
    title: 'Featured Tutors',
    icon: Star,
    endpoint: 'getFeaturedTutors',
    sortParam: '-rating',
  },
}

const { title, icon, endpoint, sortParam } = config[props.type]

const tutors = ref<TutorListItem[]>([])
const isLoading = ref(false)
const error = ref<string | null>(null)

const viewAllLink = computed(() => `/tutors?sort=${sortParam}`)

onMounted(async () => {
  isLoading.value = true
  error.value = null

  try {
    const apiMethod = marketplaceApi[endpoint as keyof typeof marketplaceApi] as (
      limit: number
    ) => Promise<TutorListItem[]>
    tutors.value = await apiMethod(props.limit)
  } catch (e: any) {
    error.value = e.message || 'Failed to load tutors'
  } finally {
    isLoading.value = false
  }
})

const handleViewAll = () => {
  router.push(viewAllLink.value)
}
</script>

<template>
  <section class="tutor-section">
    <div class="section-header">
      <h2>
        <component :is="icon" :size="24" class="section-icon" />
        {{ title }}
      </h2>
      <button class="view-all-btn" @click="handleViewAll">
        View All
        <ArrowRight :size="16" />
      </button>
    </div>

    <!-- Loading State -->
    <div v-if="isLoading" class="tutors-carousel loading">
      <div v-for="i in 4" :key="i" class="tutor-skeleton">
        <div class="skeleton-photo" />
        <div class="skeleton-content">
          <div class="skeleton-line w-70" />
          <div class="skeleton-line w-50" />
          <div class="skeleton-line w-40" />
        </div>
      </div>
    </div>

    <!-- Error State -->
    <div v-else-if="error" class="error-state">
      <p>{{ error }}</p>
    </div>

    <!-- Tutors Carousel -->
    <div v-else class="tutors-carousel">
      <TutorCard
        v-for="tutor in tutors"
        :key="tutor.id"
        :tutor="tutor"
        compact
      />
    </div>
  </section>
</template>

<style scoped>
.tutor-section {
  margin-bottom: 48px;
}

.section-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 24px;
}

.section-header h2 {
  display: flex;
  align-items: center;
  gap: 12px;
  font-size: 1.5rem;
  font-weight: 600;
  margin: 0;
  color: var(--color-text-primary, #111827);
}

.section-icon {
  color: var(--color-primary, #3b82f6);
}

.view-all-btn {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 8px 16px;
  background: none;
  border: 1px solid var(--color-border, #e5e7eb);
  border-radius: 8px;
  font-size: 14px;
  font-weight: 500;
  color: var(--color-text-primary, #111827);
  cursor: pointer;
  transition: all 0.15s;
}

.view-all-btn:hover {
  border-color: var(--color-primary, #3b82f6);
  color: var(--color-primary, #3b82f6);
}

.tutors-carousel {
  display: flex;
  gap: 16px;
  overflow-x: auto;
  padding-bottom: 8px;
  scroll-snap-type: x mandatory;
  -webkit-overflow-scrolling: touch;
}

.tutors-carousel::-webkit-scrollbar {
  height: 6px;
}

.tutors-carousel::-webkit-scrollbar-track {
  background: var(--color-bg-secondary, #f5f5f5);
  border-radius: 3px;
}

.tutors-carousel::-webkit-scrollbar-thumb {
  background: var(--color-border, #d1d5db);
  border-radius: 3px;
}

.tutors-carousel > * {
  flex-shrink: 0;
  scroll-snap-align: start;
  width: 280px;
}

/* Loading skeleton */
.tutor-skeleton {
  background: var(--color-bg-primary, white);
  border-radius: 12px;
  padding: 16px;
  width: 280px;
}

.skeleton-photo {
  width: 100%;
  height: 160px;
  border-radius: 8px;
  background: linear-gradient(90deg, #f0f0f0 25%, #e0e0e0 50%, #f0f0f0 75%);
  background-size: 200% 100%;
  animation: shimmer 1.5s infinite;
  margin-bottom: 12px;
}

.skeleton-content {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.skeleton-line {
  height: 14px;
  border-radius: 4px;
  background: linear-gradient(90deg, #f0f0f0 25%, #e0e0e0 50%, #f0f0f0 75%);
  background-size: 200% 100%;
  animation: shimmer 1.5s infinite;
}

.skeleton-line.w-70 {
  width: 70%;
}

.skeleton-line.w-50 {
  width: 50%;
}

.skeleton-line.w-40 {
  width: 40%;
}

@keyframes shimmer {
  0% {
    background-position: 200% 0;
  }
  100% {
    background-position: -200% 0;
  }
}

.error-state {
  text-align: center;
  padding: 32px;
  color: var(--color-text-secondary, #6b7280);
}

@media (max-width: 640px) {
  .section-header {
    flex-direction: column;
    align-items: flex-start;
    gap: 12px;
  }

  .section-header h2 {
    font-size: 1.25rem;
  }

  .tutors-carousel > * {
    width: 240px;
  }
}
</style>
