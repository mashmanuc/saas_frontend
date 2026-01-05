<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import Rating from '../shared/Rating.vue'
import marketplaceApi, { type Review } from '../../api/marketplace'
import { notifyError } from '@/utils/notify'
import { mapMarketplaceErrorToMessage, parseMarketplaceApiError } from '../../utils/apiErrors'

interface Props {
  slug: string
  averageRating?: number | null
  totalReviews?: number | null
}

const props = withDefaults(defineProps<Props>(), {
  averageRating: 0,
  totalReviews: 0,
})

const { t } = useI18n()

const reviews = ref<Review[]>([])
const isLoading = ref(false)
const page = ref(1)
const pageSize = 10
const hasMore = ref(false)

const title = computed(() => t('marketplace.profile.reviews.title'))

async function load(reset: boolean) {
  if (!props.slug) return
  if (isLoading.value) return

  isLoading.value = true
  try {
    const nextPage = reset ? 1 : page.value
    const res = await marketplaceApi.getTutorReviews(props.slug, { page: nextPage, page_size: pageSize })

    reviews.value = reset ? res.results : [...reviews.value, ...res.results]
    page.value = nextPage + 1
    hasMore.value = Boolean(res.next)
  } catch (err) {
    notifyError(mapMarketplaceErrorToMessage(parseMarketplaceApiError(err), t('marketplace.profile.reviews.loadError')))
    throw err
  } finally {
    isLoading.value = false
  }
}

function loadMore() {
  load(false)
}

function reload() {
  reviews.value = []
  page.value = 1
  hasMore.value = false
  if (props.slug) {
    load(true)
  }
}

defineExpose({ reload })

watch(
  () => props.slug,
  () => {
    reload()
  },
  { immediate: true }
)
</script>

<template>
  <section class="profile-section" data-test="marketplace-reviews">
    <div class="header">
      <h2>{{ title }}</h2>
      <Rating :value="averageRating ?? 0" :count="totalReviews ?? 0" />
    </div>

    <div v-if="!isLoading && reviews.length === 0" class="empty" data-test="marketplace-reviews-empty">
      {{ t('marketplace.profile.reviews.empty') }}
    </div>

    <div v-else class="list" data-test="marketplace-reviews-list">
      <article v-for="r in reviews" :key="r.id" class="review">
        <div class="review-header">
          <Rating :value="r.rating" :count="0" />
          <time class="date">{{ new Date(r.created_at).toLocaleDateString() }}</time>
        </div>
        <p class="text">{{ r.text }}</p>
      </article>

      <button
        v-if="hasMore"
        type="button"
        class="btn btn-secondary"
        :disabled="isLoading"
        data-test="marketplace-reviews-load-more"
        @click="loadMore"
      >
        {{ isLoading ? t('common.loading') : t('marketplace.profile.reviews.loadMore') }}
      </button>
    </div>
  </section>
</template>

<style scoped>
.profile-section {
  background: var(--surface-card);
  border-radius: var(--radius-lg);
  padding: var(--space-xl);
  box-shadow: var(--shadow-sm);
}

.header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  margin-bottom: 1rem;
}

.header h2 {
  font: var(--font-headline);
  margin: 0;
  color: var(--text-primary);
}

.empty {
  color: var(--text-muted);
}

.list {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.review {
  border: 1px solid var(--border-color);
  border-radius: var(--radius-lg);
  padding: 1rem;
}

.review-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
}

.date {
  font-size: 0.875rem;
  color: var(--text-muted);
}

.text {
  margin: 0.75rem 0 0;
  color: var(--text-primary);
  white-space: pre-wrap;
}
</style>
