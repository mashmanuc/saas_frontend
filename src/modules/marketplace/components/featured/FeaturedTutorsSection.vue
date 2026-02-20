<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import marketplaceApi, { type TutorListItem } from '../../api/marketplace'
import TutorCard from '../catalog/TutorCard.vue'
import LoadingSpinner from '@/ui/LoadingSpinner.vue'
import { useI18n } from 'vue-i18n'
import { telemetry } from '@/services/telemetry'
import Button from '@/ui/Button.vue'

const { t } = useI18n()
const router = useRouter()

const tutors = ref<TutorListItem[]>([])
const isLoading = ref(false)
const error = ref<string | null>(null)

onMounted(async () => {
  await loadFeatured()
})

async function loadFeatured() {
  isLoading.value = true
  error.value = null
  
  try {
    const response = await marketplaceApi.getTutors({ }, 1, 6, 'featured')
    tutors.value = response.results.slice(0, 6)
    
    telemetry.trigger('marketplace_featured_viewed', {
      count: tutors.value.length
    })
  } catch (err) {
    error.value = t('marketplace.featured.loadError')
    console.error('[FeaturedTutorsSection] Load error:', err)
  } finally {
    isLoading.value = false
  }
}

function handleCardClick(tutor: TutorListItem) {
  telemetry.trigger('marketplace_featured_click', {
    tutor_slug: tutor.slug
  })
  router.push(`/marketplace/tutors/${tutor.slug}`)
}
</script>

<template>
  <section class="featured-section" data-test="marketplace-featured">
    <div class="section-header">
      <h2>{{ t('marketplace.featured.title') }}</h2>
      <p class="section-subtitle">{{ t('marketplace.featured.subtitle') }}</p>
    </div>

    <LoadingSpinner v-if="isLoading" />

    <div v-else-if="error" class="error-state">
      <p>{{ error }}</p>
      <Button variant="secondary" @click="loadFeatured">
        {{ t('common.retry') }}
      </Button>
    </div>

    <div v-else-if="tutors.length === 0" class="empty-state">
      <p>{{ t('marketplace.featured.empty') }}</p>
    </div>

    <div v-else class="featured-grid">
      <div
        v-for="tutor in tutors"
        :key="tutor.id"
        class="featured-card-wrapper"
        @click="handleCardClick(tutor)"
      >
        <div class="sponsored-badge">{{ t('marketplace.featured.sponsored') }}</div>
        <TutorCard :tutor="tutor" />
      </div>
    </div>
  </section>
</template>

<style scoped>
.featured-section {
  padding: 2rem 0;
}

.section-header {
  text-align: center;
  margin-bottom: 2rem;
}

.section-header h2 {
  font-size: 2rem;
  font-weight: 700;
  margin: 0 0 0.5rem;
  color: var(--text-primary);
}

.section-subtitle {
  font-size: 1.125rem;
  color: var(--text-secondary);
  margin: 0;
}

.featured-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: 1.5rem;
  margin-top: 1.5rem;
}

.featured-card-wrapper {
  position: relative;
  cursor: pointer;
  transition: transform 0.2s;
}

.featured-card-wrapper:hover {
  transform: translateY(-4px);
}

.sponsored-badge {
  position: absolute;
  top: 0.75rem;
  right: 0.75rem;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
  padding: 0.25rem 0.75rem;
  border-radius: 12px;
  font-size: 0.75rem;
  font-weight: 600;
  z-index: 1;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
}

.error-state,
.empty-state {
  text-align: center;
  padding: 3rem 1rem;
  color: var(--text-secondary);
}

@media (max-width: 768px) {
  .featured-grid {
    grid-template-columns: 1fr;
  }
}
</style>
