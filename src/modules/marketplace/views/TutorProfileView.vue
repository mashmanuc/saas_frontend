<script setup lang="ts">
// TASK MF4: Tutor Profile View
import { ref, onMounted, watch, computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { storeToRefs } from 'pinia'
import { useMarketplaceStore } from '../stores/marketplaceStore'
import { useAuthStore } from '@/modules/auth/store/authStore'
import { useTrustStore } from '@/stores/trustStore'
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
import type { AvailableSlot } from '../api/marketplace'
import ReportModal from '@/components/trust/ReportModal.vue'
import { ReportTargetType } from '@/types/trust'
import { useI18n } from 'vue-i18n'
import InquiryFormModal from '@/components/inquiries/InquiryFormModal.vue'

const route = useRoute()
const router = useRouter()
const store = useMarketplaceStore()
const auth = useAuthStore()
const trustStore = useTrustStore()
const { t } = useI18n()
const { currentProfile, isLoadingProfile, error } = storeToRefs(store)

const slug = computed(() => route.params.slug as string)
const selectedSlot = ref<AvailableSlot | null>(null)

const isCreateReviewOpen = ref(false)
const reviewsRef = ref<InstanceType<typeof ProfileReviews> | null>(null)
const isReportModalOpen = ref(false)
const showActionsMenu = ref(false)
const isInquiryModalOpen = ref(false)

const canWriteReview = computed(() => auth.isAuthenticated && auth.userRole === 'student')

const tutorUserId = computed(() => {
  if (!currentProfile.value?.user_id) return null
  return parseInt(currentProfile.value.user_id.toString())
})

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

function handleSlotClick(slot: AvailableSlot) {
  selectedSlot.value = slot
}

function handleRefreshCalendar() {
  // Reload calendar by re-fetching profile or triggering calendar refresh
  if (currentProfile.value) {
    store.loadProfile(slug.value)
  }
}

function handleOpenActionsMenu() {
  showActionsMenu.value = !showActionsMenu.value
}

function handleReport() {
  showActionsMenu.value = false
  isReportModalOpen.value = true
}

async function handleBlock() {
  if (!tutorUserId.value) return
  
  showActionsMenu.value = false
  
  if (confirm(t('trust.block.confirmMessage'))) {
    try {
      await trustStore.blockUser({
        user_id: tutorUserId.value,
        reason: 'Blocked from tutor profile'
      })
      router.push('/marketplace')
    } catch (err) {
      console.error('Block error:', err)
    }
  }
}

function handleReportSuccess() {
  isReportModalOpen.value = false
}

function openInquiryModal() {
  isInquiryModalOpen.value = true
}

function closeInquiryModal() {
  isInquiryModalOpen.value = false
}

function handleInquirySuccess() {
  isInquiryModalOpen.value = false
  // Можна додати notification про успішне створення inquiry
}
</script>

<style scoped>
.profile-header-wrapper {
  position: relative;
}

.profile-actions-menu {
  position: absolute;
  top: 1rem;
  right: 1.5rem;
  z-index: 10;
}

.actions-menu-btn {
  background: rgba(255, 255, 255, 0.9);
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  padding: 0.5rem 0.75rem;
  font-size: 1.25rem;
  font-weight: 600;
  cursor: pointer;
  color: #374151;
  transition: all 0.2s;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
}

.actions-menu-btn:hover {
  background: white;
  box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
}

.actions-dropdown {
  position: absolute;
  top: 100%;
  right: 0;
  margin-top: 0.5rem;
  background: white;
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
  min-width: 180px;
  overflow: hidden;
}

.menu-item {
  display: block;
  width: 100%;
  padding: 0.75rem 1rem;
  text-align: left;
  background: none;
  border: none;
  cursor: pointer;
  font-size: 0.875rem;
  color: #374151;
  transition: background-color 0.2s;
}

.menu-item:hover {
  background-color: #f3f4f6;
}

.menu-item:not(:last-child) {
  border-bottom: 1px solid #f3f4f6;
}
</style>

<template>
  <div class="profile-view">
    <LoadingSpinner v-if="isLoadingProfile" class="loading" />

    <template v-else-if="currentProfile">
      <div class="profile-header-wrapper">
        <ProfileHeader :profile="currentProfile" @back="goBack" />
        
        <div v-if="auth.isAuthenticated" class="profile-actions-menu">
          <button 
            class="actions-menu-btn"
            @click="handleOpenActionsMenu"
            :aria-label="t('common.moreActions')"
          >
            ⋮
          </button>
          <div v-if="showActionsMenu" class="actions-dropdown">
            <button class="menu-item" @click="handleReport">
              {{ t('trust.report.action') }}
            </button>
            <button class="menu-item" @click="handleBlock">
              {{ t('trust.block.action') }}
            </button>
          </div>
        </div>
      </div>

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
          <section 
            v-if="currentProfile.user_id && currentProfile.availability_summary?.timezone" 
            class="profile-section" 
            data-test="marketplace-availability"
          >
            <h2 class="section-title">{{ $t('marketplace.calendar.title') }}</h2>
            <TutorAvailabilityCalendar
              :tutor-id="currentProfile.user_id"
              :timezone="currentProfile.availability_summary.timezone"
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
              :average-rating="currentProfile.stats?.average_rating || 0"
              :total-reviews="currentProfile.stats?.total_reviews || 0"
            />
          </section>
        </main>

        <aside class="profile-sidebar">
          <ProfileContact
            :profile="currentProfile"
            @book="handleBook"
            @message="handleMessage"
            @inquiry="openInquiryModal"
          />

          <!-- Note: TutorProfileFull doesn't have badges or badges_history fields -->
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

    <ReportModal
      :is-open="isReportModalOpen"
      :target-type="ReportTargetType.PROFILE"
      :target-id="currentProfile?.user_id?.toString()"
      @close="isReportModalOpen = false"
      @success="handleReportSuccess"
    />

    <InquiryFormModal
      v-if="currentProfile"
      :show="isInquiryModalOpen"
      :tutor="{
        id: currentProfile.user_id,
        full_name: currentProfile.slug,
        avatar: currentProfile.media?.photo_url || '',
        subjects: currentProfile.subjects?.map(s => s.title) || [],
        min_hourly_rate: currentProfile.pricing?.hourly_rate
      }"
      @close="closeInquiryModal"
      @success="handleInquirySuccess"
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
