<script setup lang="ts">
// TASK MF8: ProfileHeader component
import { ArrowLeft, MapPin, Clock, Star, Play, User, GraduationCap, Calendar } from 'lucide-vue-next'
import type { TutorProfileFull } from '../../api/marketplace'
import { resolveMediaUrl } from '@/utils/media'
import Rating from '../shared/Rating.vue'
import BadgeIcon from '../shared/Badge.vue'
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { toDisplayText } from '../../utils/formatters'

interface Props {
  profile: TutorProfileFull
}

const props = defineProps<Props>()

const { t } = useI18n()

const avatarUrl = computed(() => {
  const value = props.profile?.media?.photo_url || ''
  return value ? resolveMediaUrl(value) : ''
})

const fullName = computed(() => {
  // P0.1: Privacy - use user_name (display_name) from API instead of slug
  return props.profile?.user_name || props.profile?.slug || t('common.notSpecified')
})

const avatarInitial = computed(() => {
  const slug = props.profile?.slug
  if (typeof slug === 'string' && slug.trim().length > 0) {
    return slug.trim().charAt(0).toUpperCase()
  }
  return 'T'
})

const headlineText = computed(() => {
  const raw = props.profile?.headline
  return typeof raw === 'string' && raw.trim().length > 0 ? raw : t('common.notSpecified')
})

const countryText = computed(() => {
  // v1.0 fix: Show city name if tutor opted in, fallback to country
  const cityName = props.profile?.city_name_uk
  if (cityName) return cityName
  const country = props.profile?.country
  return typeof country === 'string' && country.trim().length > 0 ? country : t('common.notSpecified')
})
const timezoneText = computed(() => props.profile?.availability_summary?.timezone || t('common.notSpecified'))

const experienceYears = computed(() => {
  const n = Number((props.profile as any)?.experience_years)
  return Number.isFinite(n) ? n : 0
})

const genderText = computed(() => {
  const g = props.profile?.gender
  if (!g) return null
  const map: Record<string, string> = {
    'male': t('marketplace.profile.gender.male'),
    'female': t('marketplace.profile.gender.female'),
    'other': t('marketplace.profile.gender.other'),
  }
  return map[g.toLowerCase()] || g
})

const ageText = computed(() => {
  const year = props.profile?.birth_year
  if (!year) return null
  const currentYear = new Date().getFullYear()
  const age = currentYear - year
  if (age < 0 || age > 120) return null
  return t('marketplace.profile.age', { age })
})

const hasCertifications = computed(() => !!props.profile?.has_certifications)

const emit = defineEmits<{
  (e: 'back'): void
}>()
</script>

<template>
  <div class="profile-header">
    <div class="header-bg" />

    <div class="header-content">
      <button class="back-btn" @click="emit('back')">
        <ArrowLeft :size="20" />
        {{ t('marketplace.profile.backToCatalog') }}
      </button>

      <div class="profile-info">
        <div class="photo-container">
          <img
            v-if="avatarUrl"
            :src="avatarUrl"
            :alt="fullName"
            class="photo"
          />
          <div v-else class="photo-placeholder">
            {{ avatarInitial }}
          </div>

          <button
            v-if="profile.media?.video_intro_url"
            class="video-btn"
            :title="t('marketplace.profile.watchIntro')"
          >
            <Play :size="24" />
          </button>
        </div>

        <div class="info">
          <h1>{{ fullName }}</h1>
          <p class="headline">{{ headlineText }}</p>

          <div class="meta">
            <div class="meta-item">
              <MapPin :size="16" />
              {{ countryText }}
            </div>
            <div class="meta-item">
              <Clock :size="16" />
              {{ timezoneText }}
            </div>
            <div class="meta-item">
              <Star :size="16" />
              {{
                experienceYears > 0
                  ? t('marketplace.profile.experienceYears', { n: experienceYears })
                  : t('marketplace.profile.experienceYearsNotSpecified')
              }}
            </div>
            <div v-if="genderText" class="meta-item">
              <User :size="16" />
              {{ genderText }}
            </div>
            <div v-if="ageText" class="meta-item">
              <Calendar :size="16" />
              {{ ageText }}
            </div>
            <div v-if="hasCertifications" class="meta-item meta-badge">
              <GraduationCap :size="16" />
              {{ t('marketplace.profile.certified') }}
            </div>
          </div>

          <div class="stats">
            <Rating
              :value="profile.stats?.average_rating || 0"
              :count="profile.stats?.total_reviews || 0"
              size="lg"
            />
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.profile-header {
  position: relative;
  background: var(--surface-card);
}

.header-bg {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  height: 150px;
  background: radial-gradient(1200px circle at 20% 0%, color-mix(in srgb, var(--accent) 28%, transparent), transparent 55%),
    linear-gradient(
      135deg,
      color-mix(in srgb, var(--accent) 85%, transparent),
      color-mix(in srgb, var(--accent) 55%, transparent)
    );
}

.header-content {
  position: relative;
  max-width: 1200px;
  margin: 0 auto;
  padding: 1rem 1.5rem 2rem;
}

.back-btn {
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.5rem 1rem;
  background: color-mix(in srgb, var(--surface-card) 20%, transparent);
  border: none;
  border-radius: 8px;
  color: white;
  font-size: 0.875rem;
  cursor: pointer;
  margin-bottom: 1.5rem;
  transition: background 0.2s;
}

.back-btn:hover {
  background: color-mix(in srgb, var(--surface-card) 30%, transparent);
}

.profile-info {
  display: flex;
  gap: 1.5rem;
  padding-top: 40px;
}

@media (max-width: 768px) {
  .profile-info {
    flex-direction: column;
    align-items: center;
    text-align: center;
  }
}

.photo-container {
  position: relative;
  flex-shrink: 0;
}

.photo,
.photo-placeholder {
  width: 140px;
  height: 140px;
  border-radius: var(--radius-xl);
  border: 3px solid var(--surface-card);
  box-shadow: var(--shadow-lg);
}

.photo {
  object-fit: cover;
}

.photo-placeholder {
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 4rem;
  font-weight: 600;
  color: var(--text-muted);
  background: var(--surface-card-muted);
}

.video-btn {
  position: absolute;
  bottom: -10px;
  right: -10px;
  width: 48px;
  height: 48px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--accent);
  border: 3px solid var(--surface-card);
  border-radius: 50%;
  color: white;
  cursor: pointer;
  box-shadow: var(--shadow-md);
  transition: transform 0.2s;
}

.video-btn:hover {
  transform: scale(1.1);
}

.info {
  flex: 1;
}

.info h1 {
  font-size: 1.5rem;
  font-weight: 700;
  margin: 0 0 0.375rem;
  color: var(--text-primary);
  word-wrap: break-word;
  overflow-wrap: break-word;
  max-width: 100%;
}

.headline {
  font-size: 1rem;
  color: var(--text-muted);
  margin: 0 0 0.75rem;
  word-wrap: break-word;
  overflow-wrap: break-word;
  max-width: 100%;
}

.meta {
  display: flex;
  gap: 1rem;
  margin-bottom: 0.75rem;
  flex-wrap: wrap;
}

.meta-item {
  display: flex;
  align-items: center;
  gap: 0.375rem;
  font-size: 0.9375rem;
  color: var(--text-muted);
  word-wrap: break-word;
  overflow-wrap: break-word;
}

.meta-badge {
  color: var(--accent);
  font-weight: 500;
}

.stats {
  display: flex;
  align-items: center;
  margin-bottom: 1rem;
}

.badges {
  display: flex;
  gap: 0.5rem;
  flex-wrap: wrap;
}
</style>
