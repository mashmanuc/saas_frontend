<script setup lang="ts">
// TASK F15-F18: TutorSection component (unified for Popular, New, Recommended, Featured)
import { ref, onMounted, computed } from 'vue'
import { useRouter } from 'vue-router'
import { TrendingUp, Sparkles, ThumbsUp, Star, ArrowRight } from 'lucide-vue-next'
import marketplaceApi, { type TutorListItem } from '../../api/marketplace'
import TutorCard from '../catalog/TutorCard.vue'
import { useI18n } from 'vue-i18n'
import Button from '@/ui/Button.vue'

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

const { t } = useI18n()

const config = {
  popular: {
    title: 'marketplace.sections.popular',
    icon: TrendingUp,
    endpoint: 'getPopularTutors',
    sortParam: '-lessons',
  },
  new: {
    title: 'marketplace.sections.new',
    icon: Sparkles,
    endpoint: 'getNewTutors',
    sortParam: '-newest',
  },
  recommended: {
    title: 'marketplace.sections.recommended',
    icon: ThumbsUp,
    endpoint: 'getRecommendedTutors',
    sortParam: '-relevance',
  },
  featured: {
    title: 'marketplace.sections.featured',
    icon: Star,
    endpoint: 'getFeaturedTutors',
    sortParam: '-rating',
  },
}

const { title: titleKey, icon, endpoint, sortParam } = config[props.type]

const title = computed(() => t(titleKey))

const tutors = ref<TutorListItem[]>([])
const isLoading = ref(false)
const error = ref<string | null>(null)

const viewAllLink = computed(() => `/marketplace?sort=${sortParam}`)

onMounted(async () => {
  isLoading.value = true
  error.value = null

  try {
    const apiMethod = marketplaceApi[endpoint as keyof typeof marketplaceApi] as (
      limit: number
    ) => Promise<TutorListItem[]>
    tutors.value = await apiMethod(props.limit)
  } catch (e: any) {
    error.value = t('marketplace.sections.loadError')
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
      <Button variant="ghost" @click="handleViewAll">
        {{ t('marketplace.sections.viewAll') }}
        <ArrowRight :size="16" />
      </Button>
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
  color: var(--text-primary);
}

.section-icon {
  color: var(--accent);
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
  background: var(--surface-card-muted);
  border-radius: 3px;
}

.tutors-carousel::-webkit-scrollbar-thumb {
  background: var(--border-color);
  border-radius: 3px;
}

.tutors-carousel > * {
  flex-shrink: 0;
  scroll-snap-align: start;
  width: 280px;
}

/* Loading skeleton */
.tutor-skeleton {
  background: var(--surface-card);
  border-radius: var(--radius-lg);
  padding: 16px;
  width: 280px;
}

.skeleton-photo {
  width: 100%;
  height: 160px;
  border-radius: 8px;
  background: linear-gradient(
    90deg,
    color-mix(in srgb, var(--border-color) 35%, transparent) 25%,
    color-mix(in srgb, var(--border-color) 55%, transparent) 50%,
    color-mix(in srgb, var(--border-color) 35%, transparent) 75%
  );
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
  background: linear-gradient(
    90deg,
    color-mix(in srgb, var(--border-color) 35%, transparent) 25%,
    color-mix(in srgb, var(--border-color) 55%, transparent) 50%,
    color-mix(in srgb, var(--border-color) 35%, transparent) 75%
  );
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
  color: var(--text-muted);
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
