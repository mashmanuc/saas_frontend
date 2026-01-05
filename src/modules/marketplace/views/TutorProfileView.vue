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
import TutorBadgeHistory from '../components/profile/TutorBadgeHistory.vue'
import ProfileReviews from '../components/profile/ProfileReviews.vue'
import CreateReviewModal from '../components/profile/CreateReviewModal.vue'
import ProfileContact from '../components/profile/ProfileContact.vue'
import LoadingSpinner from '@/ui/LoadingSpinner.vue'
import NotFound from '@/ui/NotFound.vue'
import TrialRequestModal from '../components/trial/TrialRequestModal.vue'
import TutorAvailabilityCalendar from '../components/TutorAvailabilityCalendar.vue'
import StudentAvailabilityCalendar from '../../booking/components/calendar/StudentAvailabilityCalendar.vue'
import BookingRequestModal from '../../booking/components/requests/BookingRequestModal.vue'
import type { AvailableSlot } from '../api/marketplace'

interface CalendarSlot {
  slot_id: string
  start_at: string
  duration: number
  status: string
}
import type { TimeSlot } from '../../booking/api/availabilityApi'
import { useToast } from '@/composables/useToast'

const route = useRoute()
const router = useRouter()
const store = useMarketplaceStore()
const auth = useAuthStore()
const { currentProfile, isLoadingProfile, error } = storeToRefs(store)

const slug = computed(() => route.params.slug as string)
const selectedSlot = ref<CalendarSlot | null>(null)
const showFullCalendar = ref(false)
const selectedBookingSlot = ref<TimeSlot | null>(null)
const showBookingModal = ref(false)
const selectedAvailableSlot = ref<AvailableSlot | null>(null)

const isCreateReviewOpen = ref(false)
const reviewsRef = ref<InstanceType<typeof ProfileReviews> | null>(null)
const toast = useToast()

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
  return
}

function goBack() {
  router.push('/marketplace')
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

function handleSlotClick(slot: CalendarSlot) {
  selectedSlot.value = slot
}

function handleRefreshCalendar() {
  // Reload calendar by re-fetching profile or triggering calendar refresh
  if (currentProfile.value) {
    store.loadProfile(slug.value)
  }
}

function handleBookingSuccess(requestId: number) {
  toast.success('Запит надіслано! Очікуйте підтвердження від тьютора.')
  showBookingModal.value = false
  selectedAvailableSlot.value = null
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
            v-if="Array.isArray(currentProfile.education) && currentProfile.education.length > 0"
            :education="currentProfile.education"
          />

          <ProfileSubjects
            v-if="Array.isArray(currentProfile.subjects) && currentProfile.subjects.length > 0"
            :subjects="currentProfile.subjects"
          />

          <!-- Availability Section v0.59 - Real Calendar -->
          <section v-if="currentProfile.has_availability" class="profile-section availability-section">
            <h2>{{ $t('marketplace.availableSlots') }}</h2>
            
            <TutorAvailabilityCalendar
              ref="calendarRef"
              :tutor-id="currentProfile.id"
              :timezone="currentProfile.timezone || 'Europe/Kyiv'"
              @slot-click="handleSlotClick"
            />
          </section>

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
            v-if="Array.isArray(currentProfile.badges) && currentProfile.badges.length > 0"
            :badges="currentProfile.badges"
          />

          <TutorBadgeHistory />
        </aside>
      </div>
    </template>

    <NotFound
      v-else-if="error"
      :title="$t('marketplace.profile.notFound.title')"
      :description="$t('marketplace.profile.notFound.description')"
    >
      <button class="btn btn-primary" @click="goBack">{{ $t('marketplace.profile.notFound.backCta') }}</button>
    </NotFound>

    <TrialRequestModal
      v-if="selectedSlot"
      :slug="slug"
      :slot="selectedSlot"
      @close="selectedSlot = null"
      @created="() => { selectedSlot = null }"
      @refresh="handleRefreshCalendar"
    />

    <CreateReviewModal
      v-if="isCreateReviewOpen"
      :slug="slug"
      @close="closeCreateReview"
      @created="handleReviewCreated"
    />
    
    <BookingRequestModal
      v-if="showBookingModal && selectedAvailableSlot && currentProfile"
      :visible="showBookingModal"
      :tutor-id="currentProfile.id"
      :slot="selectedAvailableSlot"
      @close="showBookingModal = false"
      @success="handleBookingSuccess"
    />
  </div>
</template>

<style scoped>
.profile-view {
  min-height: 100vh;
  background: var(--surface-marketplace);
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
  background: var(--surface-card);
  border-radius: var(--radius-lg);
  padding: var(--space-xl);
  box-shadow: var(--shadow-sm);
}

.profile-section h2 {
  font: var(--font-headline);
  margin: 0 0 1rem;
  color: var(--text-primary);
}

.reviews-header {
  display: flex;
  justify-content: flex-end;
  margin-bottom: 0.75rem;
}

.availability-section {
  background: var(--surface-card);
  border-radius: var(--radius-lg);
  padding: var(--space-xl);
  box-shadow: var(--shadow-sm);
}

.mt-4 {
  margin-top: 1.5rem;
}

</style>
