<script setup lang="ts">
// TASK MF6: TutorCard component
import { computed, ref, onMounted } from 'vue'
import { MapPin, BookOpen, Calendar, Clock } from 'lucide-vue-next'
import { useI18n } from 'vue-i18n'
import type { TutorListItem, Badge } from '../../api/marketplace'
import { formatList, toDisplayText } from '../../utils/formatters'
import { availabilityApi } from '@/modules/booking/api/availabilityApi'
import type { AvailabilitySummary } from '@/modules/booking/api/availabilityApi'
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
  const v = props.tutor?.headline
  return typeof v === 'string' && v.trim().length > 0 ? v : t('common.notSpecified')
})

const countryText = computed(() => {
  return toDisplayText(props.tutor?.country, t('common.notSpecified'))
})

const lessonsText = computed(() => {
  return toDisplayText(props.tutor?.total_lessons, t('common.notSpecified'))
})

const hourlyRateText = computed(() => {
  const amount = props.tutor?.hourly_rate
  const currency = props.tutor?.currency
  if (typeof amount === 'number' && Number.isFinite(amount) && typeof currency === 'string' && currency.trim().length > 0) {
    return null
  }
  return t('common.notSpecified')
})

type TabKey = 'summary' | 'about' | 'calendar'
const activeTab = ref<TabKey>('summary')

const availabilitySummary = ref<AvailabilitySummary | null>(null)
const loadingAvailability = ref(false)

const subjectsText = computed(() => {
  // Handle API format: array of objects with title field
  const subjects = props.tutor?.subjects
  if (Array.isArray(subjects) && subjects.length > 0) {
    // Extract titles from subject objects
    const titles = subjects
      .map(s => typeof s === 'object' && s !== null ? s.title : null)
      .filter((t): t is string => typeof t === 'string' && t.trim().length > 0)
    
    if (titles.length > 0) {
      return titles.join(', ')
    }
  }
  
  return t('common.notSpecified')
})

const languagesText = computed(() => {
  return formatList(props.tutor?.languages, t('common.notSpecified'))
})

const aboutText = computed(() => {
  // TutorListItem does not include full bio, so show headline as fallback.
  return headlineText.value || t('common.notSpecified')
})

const nextAvailableText = computed(() => {
  if (!availabilitySummary.value?.next_available_slot) {
    return t('marketplace.profile.noSlotsAvailable')
  }
  
  const date = new Date(availabilitySummary.value.next_available_slot)
  const now = new Date()
  const diffMs = date.getTime() - now.getTime()
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60))
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24))
  
  if (diffHours < 24) {
    return t('marketplace.profile.today')
  } else if (diffDays === 1) {
    return t('marketplace.profile.tomorrow')
  } else if (diffDays < 7) {
    return t('marketplace.profile.inDays', { count: diffDays })
  }
  
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
})

async function loadAvailability() {
  if (activeTab.value !== 'calendar') return
  
  loadingAvailability.value = true
  try {
    availabilitySummary.value = await availabilityApi.getTutorAvailabilitySummary(props.tutor.slug)
  } catch (err) {
    console.error('[TutorCard] Failed to load availability:', err)
  } finally {
    loadingAvailability.value = false
  }
}

function handleTabChange(tab: TabKey) {
  activeTab.value = tab
  if (tab === 'calendar' && !availabilitySummary.value) {
    loadAvailability()
  }
}
</script>

<template>
  <article class="tutor-card surface-card" data-test="marketplace-tutor-card-row">
    <div class="left">
      <RouterLink :to="`/marketplace/tutors/${tutor.slug}`" class="avatar-link">
        <img
          v-if="tutor.photo"
          :src="tutor.photo"
          :alt="(tutor.display_name || tutor.full_name) || 'Tutor'"
          class="photo"
        />
        <div v-else class="photo-placeholder">
          {{ ((tutor.display_name || tutor.full_name) || 'T').charAt(0) }}
        </div>
      </RouterLink>
    </div>

    <div class="middle">
      <div class="top-row">
        <div class="name-row">
          <RouterLink :to="`/marketplace/tutors/${tutor.slug}`" class="name">
            {{ (tutor.display_name || tutor.full_name) || t('common.notSpecified') }}
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
          <strong>{{ t('marketplace.filters.subjects') }}:</strong> {{ subjectsText }}
        </div>
        
        <div class="languages">
          <strong>{{ t('marketplace.filters.languages') }}:</strong> {{ languagesText }}
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
        <button type="button" class="tab" :class="{ active: activeTab === 'summary' }" @click="handleTabChange('summary')">
          {{ t('marketplace.catalog.tabs.summary') }}
        </button>
        <button type="button" class="tab" :class="{ active: activeTab === 'about' }" @click="handleTabChange('about')">
          {{ t('marketplace.catalog.tabs.about') }}
        </button>
        <button type="button" class="tab" :class="{ active: activeTab === 'calendar' }" @click="handleTabChange('calendar')">
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
          <div v-if="loadingAvailability" class="calendar-loading">
            <span>{{ t('common.loading') }}</span>
          </div>
          <div v-else-if="availabilitySummary" class="calendar-info">
            <div class="availability-row">
              <Calendar :size="16" />
              <div class="availability-details">
                <span class="availability-label">{{ t('marketplace.profile.nextAvailable') }}:</span>
                <span class="availability-value">{{ nextAvailableText }}</span>
              </div>
            </div>
            <div v-if="availabilitySummary.weekly_hours" class="availability-row">
              <Clock :size="16" />
              <div class="availability-details">
                <span class="availability-label">{{ t('marketplace.profile.weeklyHours') }}:</span>
                <span class="availability-value">{{ availabilitySummary.weekly_hours }}h</span>
              </div>
            </div>
          </div>
          <div v-else class="calendar-empty">
            <Calendar :size="16" />
            <span>{{ t('marketplace.profile.noAvailability') }}</span>
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
  gap: 1.5rem;
  align-items: start;
  background: var(--card-bg);
  border: 1.5px solid var(--border-color);
  border-radius: 12px;
  padding: 1.5rem;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
  transition: box-shadow 0.2s, transform 0.2s;
}

.tutor-card:hover {
  box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05);
  transform: translateY(-2px);
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
  border-radius: 12px;
}

.photo {
  object-fit: cover;
  box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06);
}

.photo-placeholder {
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 2.25rem;
  font-weight: 600;
  color: var(--text-secondary);
  background: var(--bg-secondary);
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
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
  font-size: 1.125rem;
  font-weight: 600;
  color: var(--text-primary);
  text-decoration: none;
  transition: color 0.2s;
}

.name:hover {
  color: var(--accent);
  text-decoration: none;
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
  gap: 1rem;
  margin-top: 0.75rem;
  color: var(--text-secondary);
  font-size: 0.875rem;
}

.meta-item {
  display: inline-flex;
  align-items: center;
  gap: 0.375rem;
  padding: 0.25rem 0.5rem;
  background: var(--bg-secondary);
  border: 1px solid var(--border-color);
  border-radius: 6px;
}

.subjects {
  margin-top: 0.75rem;
  padding: 0.5rem 0.75rem;
  background: var(--subject-tag-bg);
  border: 1.5px solid var(--subject-tag-bg);
  border-radius: 6px;
  color: var(--subject-tag-text);
  font-size: 0.875rem;
  font-weight: 500;
}

.subjects strong {
  color: var(--subject-tag-text);
  font-weight: 600;
}

.languages {
  margin-top: 0.5rem;
  padding: 0.5rem 0.75rem;
  background: var(--language-tag-bg);
  border: 1.5px solid var(--language-tag-bg);
  border-radius: 6px;
  color: var(--language-tag-text);
  font-size: 0.875rem;
  font-weight: 500;
}

.languages strong {
  color: var(--language-tag-text);
  font-weight: 600;
}

.right {
  display: flex;
  flex-direction: column;
  gap: var(--space-sm);
  align-items: stretch;
}

.price {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
  padding: 1rem;
  background: var(--price-tag-bg);
  border: 1.5px solid var(--price-tag-bg);
  border-radius: 8px;
}

.price-label {
  font-size: 0.75rem;
  font-weight: 600;
  color: var(--price-tag-text);
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.price-value {
  font-size: 1.25rem;
  font-weight: 700;
  color: var(--price-tag-text);
}

.per-hour {
  margin-left: 0.25rem;
  font-size: 0.8125rem;
  color: var(--text-muted);
}

.cta {
  width: 100%;
  padding: 0.75rem 1.5rem;
  background: var(--accent);
  color: var(--accent-contrast);
  border: 1px solid transparent;
  border-radius: 8px;
  font-size: 0.9375rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s;
  box-shadow: 0 2px 8px var(--shadow);
}

.cta:hover {
  background: var(--accent-hover);
  box-shadow: 0 4px 12px var(--shadow-strong);
  transform: translateY(-1px);
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

.calendar-loading,
.calendar-empty {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  color: var(--text-muted);
}

.calendar-info {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.availability-row {
  display: flex;
  align-items: flex-start;
  gap: 0.5rem;
}

.availability-details {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.availability-label {
  font-size: 0.75rem;
  color: var(--text-muted);
}

.availability-value {
  font-weight: 600;
  color: var(--text-primary);
}
</style>
