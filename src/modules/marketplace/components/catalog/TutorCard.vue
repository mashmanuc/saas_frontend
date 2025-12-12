<script setup lang="ts">
// TASK MF6: TutorCard component
import { computed } from 'vue'
import { Star, MapPin, BookOpen } from 'lucide-vue-next'
import type { TutorListItem, Badge } from '../../api/marketplace'
import BadgeIcon from '../shared/Badge.vue'
import Rating from '../shared/Rating.vue'
import PriceTag from '../shared/PriceTag.vue'

interface Props {
  tutor: TutorListItem
}

const props = defineProps<Props>()

const displayBadges = computed(() => props.tutor.badges.slice(0, 2))
const displaySubjects = computed(() => props.tutor.subjects.slice(0, 3))
</script>

<template>
  <RouterLink :to="`/tutor/${tutor.slug}`" class="tutor-card">
    <div class="card-image">
      <img
        v-if="tutor.photo"
        :src="tutor.photo"
        :alt="tutor.full_name"
        class="photo"
      />
      <div v-else class="photo-placeholder">
        {{ tutor.full_name.charAt(0) }}
      </div>
      <div v-if="displayBadges.length > 0" class="badges">
        <BadgeIcon
          v-for="badge in displayBadges"
          :key="badge.type"
          :badge="badge"
          size="sm"
        />
      </div>
    </div>

    <div class="card-content">
      <h3 class="name">{{ tutor.full_name }}</h3>
      <p class="headline">{{ tutor.headline }}</p>

      <div class="meta">
        <Rating :value="tutor.average_rating" :count="tutor.total_reviews" />
        <span class="lessons">
          <BookOpen :size="14" />
          {{ tutor.total_lessons }} lessons
        </span>
      </div>

      <div v-if="tutor.country" class="location">
        <MapPin :size="14" />
        {{ tutor.country }}
      </div>

      <div v-if="displaySubjects.length > 0" class="subjects">
        <span
          v-for="subject in displaySubjects"
          :key="subject"
          class="subject-tag"
        >
          {{ subject }}
        </span>
        <span v-if="tutor.subjects.length > 3" class="more-subjects">
          +{{ tutor.subjects.length - 3 }}
        </span>
      </div>

      <div class="price">
        <PriceTag :amount="tutor.hourly_rate" :currency="tutor.currency" />
        <span class="per-hour">/ hour</span>
      </div>
    </div>
  </RouterLink>
</template>

<style scoped>
.tutor-card {
  display: flex;
  flex-direction: column;
  background: white;
  border-radius: 12px;
  overflow: hidden;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
  transition: all 0.2s;
  text-decoration: none;
  color: inherit;
}

.tutor-card:hover {
  transform: translateY(-4px);
  box-shadow: 0 8px 25px rgba(0, 0, 0, 0.15);
}

.card-image {
  position: relative;
  aspect-ratio: 4/3;
  background: #f3f4f6;
}

.photo {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.photo-placeholder {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 3rem;
  font-weight: 600;
  color: #9ca3af;
  background: #e5e7eb;
}

.badges {
  position: absolute;
  top: 0.75rem;
  left: 0.75rem;
  display: flex;
  gap: 0.25rem;
}

.card-content {
  padding: 1rem;
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.name {
  font-size: 1.125rem;
  font-weight: 600;
  margin: 0;
  color: #111827;
}

.headline {
  font-size: 0.875rem;
  color: #6b7280;
  margin: 0;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.meta {
  display: flex;
  align-items: center;
  gap: 1rem;
  font-size: 0.8125rem;
  color: #6b7280;
}

.lessons {
  display: flex;
  align-items: center;
  gap: 0.25rem;
}

.location {
  display: flex;
  align-items: center;
  gap: 0.25rem;
  font-size: 0.8125rem;
  color: #6b7280;
}

.subjects {
  display: flex;
  flex-wrap: wrap;
  gap: 0.375rem;
}

.subject-tag {
  padding: 0.25rem 0.5rem;
  background: #eff6ff;
  color: #3b82f6;
  border-radius: 4px;
  font-size: 0.75rem;
  font-weight: 500;
}

.more-subjects {
  padding: 0.25rem 0.5rem;
  color: #6b7280;
  font-size: 0.75rem;
}

.price {
  display: flex;
  align-items: baseline;
  gap: 0.25rem;
  margin-top: auto;
  padding-top: 0.5rem;
  border-top: 1px solid #f3f4f6;
}

.per-hour {
  font-size: 0.8125rem;
  color: #6b7280;
}
</style>
