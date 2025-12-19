<script setup lang="ts">
// TASK MF8: ProfileHeader component
import { ArrowLeft, MapPin, Clock, Star, Play } from 'lucide-vue-next'
import type { TutorProfile } from '../../api/marketplace'
import { resolveMediaUrl } from '@/utils/media'
import Rating from '../shared/Rating.vue'
import BadgeIcon from '../shared/Badge.vue'
import { computed } from 'vue'

interface Props {
  profile: TutorProfile
}

const props = defineProps<Props>()

const avatarUrl = computed(() => {
  const value = props.profile?.user?.avatar_url || ''
  return value ? resolveMediaUrl(value) : ''
})

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
        Back to Tutors
      </button>

      <div class="profile-info">
        <div class="photo-container">
          <img
            v-if="avatarUrl"
            :src="avatarUrl"
            :alt="profile.user.full_name"
            class="photo"
          />
          <div v-else class="photo-placeholder">
            {{ profile.user.full_name.charAt(0) }}
          </div>

          <button
            v-if="profile.video_intro_url"
            class="video-btn"
            title="Watch Introduction"
          >
            <Play :size="24" />
          </button>
        </div>

        <div class="info">
          <h1>{{ profile.user.full_name }}</h1>
          <p class="headline">{{ profile.headline }}</p>

          <div class="meta">
            <div v-if="profile.country" class="meta-item">
              <MapPin :size="16" />
              {{ profile.country }}
            </div>
            <div v-if="profile.timezone" class="meta-item">
              <Clock :size="16" />
              {{ profile.timezone }}
            </div>
          </div>

          <div class="stats">
            <Rating
              :value="profile.average_rating"
              :count="profile.total_reviews"
              size="lg"
            />
            <div class="stat">
              <span class="stat-value">{{ profile.total_lessons }}</span>
              <span class="stat-label">lessons</span>
            </div>
            <div class="stat">
              <span class="stat-value">{{ profile.total_students }}</span>
              <span class="stat-label">students</span>
            </div>
          </div>

          <div v-if="profile.badges.length > 0" class="badges">
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
  background: white;
}

.header-bg {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  height: 200px;
  background: linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%);
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
  background: rgba(255, 255, 255, 0.2);
  border: none;
  border-radius: 8px;
  color: white;
  font-size: 0.875rem;
  cursor: pointer;
  margin-bottom: 1.5rem;
  transition: background 0.2s;
}

.back-btn:hover {
  background: rgba(255, 255, 255, 0.3);
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
  border-radius: 16px;
  border: 4px solid white;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.15);
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
  color: #9ca3af;
  background: #e5e7eb;
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
  background: #3b82f6;
  border: 3px solid white;
  border-radius: 50%;
  color: white;
  cursor: pointer;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.2);
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
  color: #111827;
}

.headline {
  font-size: 1.125rem;
  color: #6b7280;
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
  color: #6b7280;
}

.stats {
  display: flex;
  align-items: center;
  gap: 2rem;
  margin-bottom: 1rem;
}

.stat {
  display: flex;
  flex-direction: column;
}

.stat-value {
  font-size: 1.25rem;
  font-weight: 600;
  color: #111827;
}

.stat-label {
  font-size: 0.8125rem;
  color: #6b7280;
}

.badges {
  display: flex;
  gap: 0.5rem;
  flex-wrap: wrap;
}
</style>
