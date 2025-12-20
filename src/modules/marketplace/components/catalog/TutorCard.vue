<script setup lang="ts">
// TASK MF6: TutorCard component
import { computed, ref } from 'vue'
import { MapPin, BookOpen, Calendar } from 'lucide-vue-next'
import { useI18n } from 'vue-i18n'
import type { TutorListItem, Badge } from '../../api/marketplace'
import { formatList, toDisplayText } from '../../utils/formatters'
import BadgeIcon from '../shared/Badge.vue'
import Rating from '../shared/Rating.vue'
import PriceTag from '../shared/PriceTag.vue'

interface Props {
  tutor: TutorListItem
}

const props = defineProps<Props>()

const { t } = useI18n()

const displayBadges = computed(() => {
  const badges = Array.isArray(props.tutor.badges) ? props.tutor.badges : []
  return badges.slice(0, 2)
})

const headlineText = computed(() => {
  const v = (props.tutor as any)?.headline
  return typeof v === 'string' && v.trim().length > 0 ? v : t('common.notSpecified')
})

const countryText = computed(() => {
  return toDisplayText((props.tutor as any)?.country, t('common.notSpecified'))
})

const lessonsText = computed(() => {
  return toDisplayText((props.tutor as any)?.total_lessons, t('common.notSpecified'))
})

const hourlyRateText = computed(() => {
  const amount = (props.tutor as any)?.hourly_rate
  const currency = (props.tutor as any)?.currency
  if (typeof amount === 'number' && Number.isFinite(amount) && typeof currency === 'string' && currency.trim().length > 0) {
    return null
  }
  return t('common.notSpecified')
})

type TabKey = 'summary' | 'about' | 'calendar'
const activeTab = ref<TabKey>('summary')

const subjectsText = computed(() => {
  return formatList((props.tutor as any)?.subjects, t('common.notSpecified'))
})

const aboutText = computed(() => {
  // TutorListItem does not include full bio, so show headline as fallback.
  return headlineText.value || t('common.notSpecified')
})
</script>

<template>
  <article class="tutor-card surface-card" data-test="marketplace-tutor-card-row">
    <div class="left">
      <RouterLink :to="`/marketplace/tutors/${tutor.slug}`" class="avatar-link">
        <img
          v-if="tutor.photo"
          :src="tutor.photo"
          :alt="tutor.full_name || 'Tutor'"
          class="photo"
        />
        <div v-else class="photo-placeholder">
          {{ (tutor.full_name || 'T').charAt(0) }}
        </div>
      </RouterLink>
    </div>

    <div class="middle">
      <div class="top-row">
        <div class="name-row">
          <RouterLink :to="`/marketplace/tutors/${tutor.slug}`" class="name">
            {{ tutor.full_name || t('common.notSpecified') }}
          </RouterLink>

          <div class="badges" v-if="displayBadges.length > 0">
            <BadgeIcon
              v-for="badge in displayBadges"
              :key="badge.type"
              :badge="badge"
              size="sm"
            />
          </div>

          <div class="rating">
            <Rating :value="tutor.average_rating" :count="tutor.total_reviews" />
          </div>
        </div>

        <div class="meta-row">
          <div class="meta-item">
            <BookOpen :size="14" />
            <span>{{ lessonsText }}</span>
          </div>
          <div class="meta-item">
            <MapPin :size="14" />
            <span>{{ countryText }}</span>
          </div>
        </div>

        <div class="subjects">
          {{ subjectsText }}
        </div>
      </div>
    </div>

    <div class="right">
      <div class="price">
        <template v-if="!hourlyRateText">
          <span class="price-label">{{ t('marketplace.filters.price') }}</span>
          <span class="price-value">
            <PriceTag :amount="tutor.hourly_rate" :currency="tutor.currency" size="sm" />
            <span class="per-hour">{{ t('marketplace.common.perHour') }}</span>
          </span>
        </template>
        <template v-else>
          <span class="price-label">{{ t('marketplace.filters.price') }}</span>
          <span class="price-value">{{ hourlyRateText }}</span>
        </template>
      </div>

      <RouterLink :to="`/marketplace/tutors/${tutor.slug}`" class="btn btn-primary cta">
        {{ t('common.open') }}
      </RouterLink>

      <div class="tabs">
        <button type="button" class="tab" :class="{ active: activeTab === 'summary' }" @click="activeTab = 'summary'">
          {{ t('marketplace.catalog.tabs.summary') }}
        </button>
        <button type="button" class="tab" :class="{ active: activeTab === 'about' }" @click="activeTab = 'about'">
          {{ t('marketplace.catalog.tabs.about') }}
        </button>
        <button type="button" class="tab" :class="{ active: activeTab === 'calendar' }" @click="activeTab = 'calendar'">
          {{ t('marketplace.catalog.tabs.calendar') }}
        </button>
      </div>

      <div class="tab-body">
        <div v-if="activeTab === 'summary'" class="tab-panel">
          <div class="headline">{{ headlineText }}</div>
        </div>
        <div v-else-if="activeTab === 'about'" class="tab-panel">
          <div class="about">{{ aboutText }}</div>
        </div>
        <div v-else class="tab-panel">
          <div class="calendar">
            <Calendar :size="16" />
            <span>{{ t('common.notSpecified') }}</span>
          </div>
        </div>
      </div>
    </div>
  </article>
</template>

<style scoped>
.tutor-card {
  display: grid;
  grid-template-columns: 96px 1fr 340px;
  gap: var(--space-lg);
  align-items: start;
}

@media (max-width: 900px) {
  .tutor-card {
    grid-template-columns: 84px 1fr;
  }
  .right {
    grid-column: 1 / -1;
  }
}

.left {
  display: flex;
  justify-content: center;
}

.avatar-link {
  display: inline-flex;
  border-radius: var(--radius-lg);
  overflow: hidden;
  border: 1px solid var(--border-color);
}

.photo,
.photo-placeholder {
  width: 96px;
  height: 96px;
}

.photo {
  object-fit: cover;
}

.photo-placeholder {
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 2.25rem;
  font-weight: 600;
  color: var(--text-muted);
  background: color-mix(in srgb, var(--surface-card-muted) 70%, transparent);
}

.name-row {
  display: flex;
  align-items: center;
  gap: var(--space-sm);
  flex-wrap: wrap;
}

.badges {
  display: inline-flex;
  align-items: center;
  gap: 0.25rem;
}

.name {
  font: var(--font-headline);
  color: var(--text-primary);
  text-decoration: none;
}

.name:hover {
  text-decoration: underline;
}

.trust {
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
  font-size: 0.8125rem;
  color: var(--text-muted);
}

.meta-row {
  display: flex;
  gap: var(--space-md);
  margin-top: var(--space-sm);
  color: var(--text-muted);
  font-size: 0.875rem;
}

.meta-item {
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
}

.subjects {
  margin-top: var(--space-sm);
  color: var(--text-muted);
  font-size: 0.875rem;
}

.right {
  display: flex;
  flex-direction: column;
  gap: var(--space-sm);
  align-items: stretch;
}

.price {
  display: flex;
  justify-content: space-between;
  align-items: baseline;
  gap: var(--space-sm);
}

.price-label {
  font-size: 0.8125rem;
  color: var(--text-muted);
}

.price-value {
  font-weight: 600;
  color: var(--text-primary);
}

.per-hour {
  margin-left: 0.25rem;
  font-size: 0.8125rem;
  color: var(--text-muted);
}

.cta {
  width: 100%;
}

.tabs {
  display: flex;
  gap: var(--space-sm);
  justify-content: flex-end;
}

.tab {
  border: none;
  background: transparent;
  padding: 0.25rem 0.5rem;
  font-size: 0.875rem;
  color: var(--text-muted);
  cursor: pointer;
  border-bottom: 2px solid transparent;
}

.tab.active {
  color: var(--text-primary);
  border-bottom-color: var(--accent-primary);
}

.tab-body {
  border-top: 1px solid var(--border-color);
  padding-top: var(--space-sm);
  color: var(--text-muted);
  font-size: 0.875rem;
}

.calendar {
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
}
</style>
