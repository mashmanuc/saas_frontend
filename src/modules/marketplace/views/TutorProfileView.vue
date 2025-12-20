<script setup lang="ts">
// TASK MF4: Tutor Profile View
import { ref, onMounted, watch, computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { storeToRefs } from 'pinia'
import { useMarketplaceStore } from '../stores/marketplaceStore'
import { useAuthStore } from '@/modules/auth/store/authStore'
import ProfileHeader from '../components/profile/ProfileHeader.vue'
import ProfileAbout from '../components/profile/ProfileAbout.vue'
import ProfileEducation from '../components/profile/ProfileEducation.vue'
import ProfileSubjects from '../components/profile/ProfileSubjects.vue'
import ProfileBadges from '../components/profile/ProfileBadges.vue'
import ProfileReviews from '../components/profile/ProfileReviews.vue'
import CreateReviewModal from '../components/profile/CreateReviewModal.vue'
import ProfileContact from '../components/profile/ProfileContact.vue'
import LoadingSpinner from '@/ui/LoadingSpinner.vue'
import NotFound from '@/ui/NotFound.vue'
import WeeklyAvailabilityWidget from '../components/trial/WeeklyAvailabilityWidget.vue'
import TrialRequestModal from '../components/trial/TrialRequestModal.vue'
import type { WeeklyAvailabilitySlot } from '../api/marketplace'

const route = useRoute()
const router = useRouter()
const store = useMarketplaceStore()
const auth = useAuthStore()
const { currentProfile, isLoadingProfile, error } = storeToRefs(store)

const slug = computed(() => route.params.slug as string)
const selectedSlot = ref<WeeklyAvailabilitySlot | null>(null)

const isCreateReviewOpen = ref(false)
const reviewsRef = ref<InstanceType<typeof ProfileReviews> | null>(null)

const canWriteReview = computed(() => auth.isAuthenticated && auth.userRole === 'student')

onMounted(() => {
  if (slug.value) {
    store.loadProfile(slug.value)
  }
})

watch(slug, (newSlug) => {
  if (newSlug) {
    store.loadProfile(newSlug)
  }
})

function handleBook() {
  // Booking is now handled via trial-request flow (weekly availability).
  // Keep CTA wired, but require slot selection.
  const el = document.querySelector('[data-test="marketplace-availability"]') as HTMLElement | null
  el?.scrollIntoView?.({ behavior: 'smooth', block: 'start' })
}

function handleMessage() {
  // TODO: Open chat with tutor
  console.log('Message tutor:', currentProfile.value?.user.id)
}

function goBack() {
  router.push('/tutors')
}

function openCreateReview() {
  isCreateReviewOpen.value = true
}

function closeCreateReview() {
  isCreateReviewOpen.value = false
}

function handleReviewCreated() {
  reviewsRef.value?.reload?.()
}
</script>

<template>
  <div class="profile-view">
    <LoadingSpinner v-if="isLoadingProfile" class="loading" />

    <template v-else-if="currentProfile">
      <ProfileHeader :profile="currentProfile" @back="goBack" />

      <div class="profile-layout">
        <main class="profile-main">
          <ProfileAbout :bio="currentProfile.bio" />

          <ProfileEducation
            v-if="currentProfile.education.length > 0"
            :education="currentProfile.education"
          />

          <ProfileSubjects
            v-if="currentProfile.subjects.length > 0"
            :subjects="currentProfile.subjects"
          />

          <WeeklyAvailabilityWidget
            :slug="slug"
            @select-slot="(slot) => (selectedSlot = slot)"
          />

          <!-- Reviews section placeholder -->
          <section class="profile-section">
            <div class="reviews-header">
              <button
                v-if="canWriteReview"
                type="button"
                class="btn btn-secondary"
                data-test="marketplace-write-review"
                @click="openCreateReview"
              >
                {{ $t('marketplace.profile.reviews.write.title') }}
              </button>
            </div>

            <ProfileReviews
              ref="reviewsRef"
              :slug="slug"
              :average-rating="currentProfile.average_rating"
              :total-reviews="currentProfile.total_reviews"
            />
          </section>
        </main>

        <aside class="profile-sidebar">
          <ProfileContact
            :profile="currentProfile"
            @book="handleBook"
            @message="handleMessage"
          />

          <ProfileBadges
            v-if="currentProfile.badges.length > 0"
            :badges="currentProfile.badges"
          />
        </aside>
      </div>
    </template>

    <NotFound
      v-else-if="error"
      title="Tutor not found"
      description="The tutor profile you're looking for doesn't exist or has been removed."
    >
      <button class="btn btn-primary" @click="goBack">Browse Tutors</button>
    </NotFound>

    <TrialRequestModal
      v-if="selectedSlot"
      :slug="slug"
      :slot="selectedSlot"
      @close="selectedSlot = null"
      @created="() => {}"
    />

    <CreateReviewModal
      v-if="isCreateReviewOpen"
      :slug="slug"
      @close="closeCreateReview"
      @created="handleReviewCreated"
    />
  </div>
</template>

<style scoped>
.profile-view {
  min-height: 100vh;
  background: #f9fafb;
}

.loading {
  display: flex;
  justify-content: center;
  padding: 4rem;
}

.profile-layout {
  max-width: 1200px;
  margin: 0 auto;
  padding: 1.5rem;
  display: grid;
  grid-template-columns: 1fr 360px;
  gap: 1.5rem;
}

@media (max-width: 968px) {
  .profile-layout {
    grid-template-columns: 1fr;
  }

  .profile-sidebar {
    order: -1;
  }
}

.profile-main {
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
}

.profile-sidebar {
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
}

.profile-section {
  background: white;
  border-radius: 12px;
  padding: 1.5rem;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
}

.profile-section h2 {
  font-size: 1.25rem;
  font-weight: 600;
  margin: 0 0 1rem;
  color: #111827;
}

.reviews-header {
  display: flex;
  justify-content: flex-end;
  margin-bottom: 0.75rem;
}

.btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  padding: 0.75rem 1.5rem;
  border: none;
  border-radius: 8px;
  font-size: 0.875rem;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;
}

.btn-primary {
  background: #3b82f6;
  color: white;
}

.btn-primary:hover {
  background: #2563eb;
}
</style>
