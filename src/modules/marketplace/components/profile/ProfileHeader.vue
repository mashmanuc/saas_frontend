<script setup lang="ts">
// TASK MF8: ProfileHeader component
import { ArrowLeft, MapPin, Clock, Star, Play } from 'lucide-vue-next'
import type { TutorProfile } from '../../api/marketplace'
import { resolveMediaUrl } from '@/utils/media'
import Rating from '../shared/Rating.vue'
import BadgeIcon from '../shared/Badge.vue'
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { toDisplayText } from '../../utils/formatters'

interface Props {
  profile: TutorProfile
}

const props = defineProps<Props>()

const { t } = useI18n()

const avatarUrl = computed(() => {
  const value = props.profile?.user?.avatar_url || ''
  return value ? resolveMediaUrl(value) : ''
})

const fullName = computed(() => {
  const raw = props.profile?.user?.full_name
  if (typeof raw === 'string' && raw.trim().length > 0) return raw
  return t('common.notSpecified')
})

const avatarInitial = computed(() => {
  const name = props.profile?.user?.full_name
  if (typeof name === 'string' && name.trim().length > 0) {
    return name.trim().charAt(0)
  }
  return 'T'
})

const headlineText = computed(() => {
  const raw = props.profile?.headline
  return typeof raw === 'string' && raw.trim().length > 0 ? raw : t('common.notSpecified')
})

const countryText = computed(() => toDisplayText((props.profile as any)?.country, t('common.notSpecified')))
const timezoneText = computed(() => toDisplayText((props.profile as any)?.timezone, t('common.notSpecified')))

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
            v-if="profile.video_intro_url"
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
          </div>

          <div class="stats">
            <Rating
              :value="profile.average_rating"
              :count="profile.total_reviews"
              size="lg"
            />
          </div>

          <div v-if="Array.isArray(profile.badges) && profile.badges.length > 0" class="badges">
            <BadgeIcon
              v-for="badge in profile.badges"
              :key="badge.type"
              :badge="badge"
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
  height: 200px;
  background: radial-gradient(1200px circle at 20% 0%, color-mix(in srgb, var(--accent-primary) 28%, transparent), transparent 55%),
    linear-gradient(
      135deg,
      color-mix(in srgb, var(--accent-primary) 85%, transparent),
      color-mix(in srgb, var(--accent-primary) 55%, transparent)
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
  gap: 2rem;
  padding-top: 60px;
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
  width: 180px;
  height: 180px;
  border-radius: var(--radius-xl);
  border: 4px solid var(--surface-card);
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
  background: var(--accent-primary);
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
  font-size: 1.75rem;
  font-weight: 700;
  margin: 0 0 0.5rem;
  color: var(--text-primary);
}

.headline {
  font-size: 1.125rem;
  color: var(--text-muted);
  margin: 0 0 1rem;
}

.meta {
  display: flex;
  gap: 1.5rem;
  margin-bottom: 1rem;
}

.meta-item {
  display: flex;
  align-items: center;
  gap: 0.375rem;
  font-size: 0.9375rem;
  color: var(--text-muted);
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
