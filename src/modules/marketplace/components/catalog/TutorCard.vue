<script setup lang="ts">
// TASK MF6: TutorCard component
import { computed } from 'vue'
import { MapPin } from 'lucide-vue-next'
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
  const v = props.tutor?.headline
  return typeof v === 'string' && v.trim().length > 0 ? v : t('common.notSpecified')
})

const countryText = computed(() => {
  // v1.0 fix: Show city_name if available, fallback to country
  const city = props.tutor?.city_name
  if (city) return city
  return toDisplayText(props.tutor?.country, t('common.notSpecified'))
})


const hourlyRateText = computed(() => {
  const amount = props.tutor?.hourly_rate
  const currency = props.tutor?.currency
  if (typeof amount === 'number' && Number.isFinite(amount) && typeof currency === 'string' && currency.trim().length > 0) {
    return null
  }
  return t('common.notSpecified')
})


const languagesText = computed(() => {
  return formatList(props.tutor?.languages, t('common.notSpecified'))
})

/**
 * v1.0: Витягнути теги формату (online/offline/hybrid) для предмета
 */
function getFormatTags(subject: any) {
  if (!subject || !Array.isArray(subject.tags)) return []
  return subject.tags.filter((tag: any) => 
    tag.group === 'formats' && ['online', 'offline', 'hybrid'].includes(tag.code)
  )
}

</script>

<template>
  <article class="tutor-card" data-test="marketplace-tutor-card-row">
    <!-- Avatar -->
    <div class="tc-avatar-wrap">
      <RouterLink :to="`/marketplace/tutors/${tutor.slug}`" class="tc-avatar-link">
        <div class="tc-avatar">
          <img
            v-if="tutor.photo"
            :src="tutor.photo"
            :alt="(tutor.display_name || tutor.full_name) || 'Tutor'"
          />
          <span v-else class="tc-avatar-letter">
            {{ ((tutor.display_name || tutor.full_name) || 'T').charAt(0) }}
          </span>
        </div>
      </RouterLink>
    </div>

    <!-- Info -->
    <div class="tc-info">
      <RouterLink :to="`/marketplace/tutors/${tutor.slug}`" class="tc-name">
        {{ (tutor.display_name || tutor.full_name) || t('common.notSpecified') }}
      </RouterLink>

      <div class="tc-tagline">{{ headlineText }}</div>

      <div class="tc-meta">
        <div class="tc-meta-item">
          <MapPin :size="13" />
          <span>{{ countryText }}</span>
        </div>
        <div v-if="tutor.total_reviews > 0" class="tc-meta-item">
          <Rating :value="tutor.average_rating" :count="tutor.total_reviews" />
        </div>
        <div class="tc-meta-item">
          <span>{{ languagesText }}</span>
        </div>
      </div>

      <div v-if="displayBadges.length > 0" class="tc-badges">
        <span
          v-for="badge in displayBadges"
          :key="badge.type"
          class="tc-badge tc-badge--verified"
        >
          <BadgeIcon :badge="badge" size="sm" />
          {{ badge.name || badge.type }}
        </span>
      </div>

      <div v-if="tutor.subjects?.length" class="tc-subjects">
        <span
          v-for="subject in tutor.subjects"
          :key="subject.code"
          class="tc-subj"
        >
          {{ subject.title }}
          <span
            v-for="ftag in getFormatTags(subject)"
            :key="ftag.code"
            :class="['tc-subj-format', `tc-subj-format--${ftag.code}`]"
          >
            {{ ftag.label }}
          </span>
        </span>
      </div>
    </div>

    <!-- CTA block -->
    <div class="tc-cta-block">
      <div class="tc-price">
        <template v-if="!hourlyRateText">
          <div class="tc-price-val">
            <PriceTag :amount="tutor.hourly_rate" :currency="tutor.currency" size="sm" />
          </div>
          <div class="tc-price-per">{{ t('marketplace.common.perHour') }}</div>
        </template>
        <template v-else>
          <div class="tc-price-val tc-price-val--na">{{ hourlyRateText }}</div>
        </template>
      </div>

      <RouterLink :to="`/marketplace/tutors/${tutor.slug}`" class="btn-tc-view">
        {{ t('marketplace.card.viewProfile') }} &rarr;
      </RouterLink>
    </div>
  </article>
</template>

<style scoped>
.tutor-card {
  background: var(--white, #ffffff);
  border: 1px solid var(--border, #e0ece5);
  border-radius: 18px;
  padding: 22px 24px;
  margin-bottom: 16px;
  box-shadow: 0 1px 8px rgba(0, 0, 0, 0.06);
  display: grid;
  grid-template-columns: auto 1fr auto;
  gap: 20px;
  align-items: start;
  transition: all 0.2s;
  animation: fadeUp 0.3s ease both;
}

.tutor-card:hover {
  box-shadow: 0 3px 16px rgba(0, 0, 0, 0.1);
  border-color: var(--green-mid, #c8ecd8);
}

/* Avatar */
.tc-avatar-link {
  text-decoration: none;
}

.tc-avatar {
  width: 68px;
  height: 68px;
  border-radius: 50%;
  background: var(--green-mid, #c8ecd8);
  display: flex;
  align-items: center;
  justify-content: center;
  border: 2px solid var(--green-mid, #c8ecd8);
  overflow: hidden;
}

.tc-avatar img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.tc-avatar-letter {
  font-size: 22px;
  font-weight: 800;
  color: var(--green-dark, #158f3e);
}

/* Info */
.tc-name {
  display: block;
  font-size: 17px;
  font-weight: 800;
  color: var(--text, #111816);
  margin-bottom: 3px;
  line-height: 1.2;
  text-decoration: none;
  transition: color 0.15s;
}

.tc-name:hover {
  color: var(--green-dark, #158f3e);
}

.tc-tagline {
  font-size: 13px;
  color: var(--muted, #7a9186);
  font-weight: 500;
  margin-bottom: 10px;
  line-height: 1.4;
}

.tc-meta {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
  font-size: 12px;
  color: var(--muted, #7a9186);
  font-weight: 600;
  margin-bottom: 10px;
}

.tc-meta-item {
  display: flex;
  align-items: center;
  gap: 4px;
}

/* Trust badges */
.tc-badges {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin-bottom: 10px;
}

.tc-badge {
  font-size: 11px;
  font-weight: 700;
  color: var(--muted, #7a9186);
  background: var(--bg, #f5f7f6);
  border: 1px solid var(--border, #e0ece5);
  border-radius: 20px;
  padding: 3px 9px;
  display: inline-flex;
  align-items: center;
  gap: 4px;
}

.tc-badge--verified {
  color: var(--green-dark, #158f3e);
  background: var(--green-light, #edf9f2);
  border-color: var(--green-mid, #c8ecd8);
}

/* Subjects tags */
.tc-subjects {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin-top: 2px;
}

.tc-subj {
  background: var(--green-light, #edf9f2);
  color: var(--green-dark, #158f3e);
  border: 1px solid var(--green-mid, #c8ecd8);
  border-radius: 8px;
  padding: 4px 10px;
  font-size: 11.5px;
  font-weight: 700;
}

.tc-subj-format {
  margin-left: 4px;
  font-size: 10px;
  font-weight: 600;
  padding: 1px 5px;
  border-radius: 4px;
}

.tc-subj-format--online {
  background: #d1fae5;
  color: #065f46;
}

.tc-subj-format--offline {
  background: #fef3c7;
  color: #92400e;
}

.tc-subj-format--hybrid {
  background: #ede9fe;
  color: #5b21b6;
}

/* CTA block */
.tc-cta-block {
  display: flex;
  flex-direction: column;
  gap: 8px;
  align-items: flex-end;
  min-width: 160px;
}

.tc-price {
  text-align: right;
}

.tc-price-val {
  font-size: 20px;
  font-weight: 900;
  color: var(--text, #111816);
  line-height: 1;
  letter-spacing: -0.5px;
}

.tc-price-val--na {
  font-size: 14px;
  font-weight: 600;
  color: var(--muted, #7a9186);
}

.tc-price-per {
  font-size: 12px;
  color: var(--muted, #7a9186);
  font-weight: 600;
}

.btn-tc-view {
  background: var(--green, #1DB954);
  color: white;
  border: none;
  border-radius: 10px;
  padding: 11px 18px;
  font-size: 13px;
  font-weight: 700;
  cursor: pointer;
  transition: all 0.15s;
  font-family: inherit;
  width: 100%;
  text-align: center;
  text-decoration: none;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  box-shadow: 0 2px 10px rgba(29, 185, 84, 0.3);
}

.btn-tc-view:hover {
  background: var(--green-dark, #158f3e);
  transform: translateY(-1px);
  box-shadow: 0 4px 16px rgba(29, 185, 84, 0.4);
}

@keyframes fadeUp {
  from { opacity: 0; transform: translateY(12px); }
  to { opacity: 1; transform: translateY(0); }
}

@media (max-width: 768px) {
  .tutor-card {
    grid-template-columns: auto 1fr;
    gap: 14px;
    padding: 16px;
  }
  .tc-cta-block {
    grid-column: 1 / -1;
    flex-direction: row;
    align-items: center;
    justify-content: space-between;
    min-width: auto;
  }
  .btn-tc-view {
    width: auto;
    flex: 1;
  }
}
</style>
