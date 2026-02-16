<script setup lang="ts">
// TASK MF4: Tutor Profile View
import { ref, onMounted, watch, computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { storeToRefs } from 'pinia'
import { useMarketplaceStore } from '../stores/marketplaceStore'
import { useAuthStore } from '@/modules/auth/store/authStore'
import { useRelationsStore } from '@/stores/relationsStore'
import ProfileHero from '../components/profile/ProfileHero.vue'
import ProfileAbout from '../components/profile/ProfileAbout.vue'
import ProfileEducation from '../components/profile/ProfileEducation.vue'
import ProfileSubjects from '../components/profile/ProfileSubjects.vue'
import ProfileReviews from '../components/profile/ProfileReviews.vue'
import LoadingSpinner from '@/ui/LoadingSpinner.vue'
import NotFound from '@/ui/NotFound.vue'
import TutorAvailabilityCalendar from '../components/TutorAvailabilityCalendar.vue'
import ReportModal from '@/components/trust/ReportModal.vue'
import { ReportTargetType } from '@/types/trust'
import { useI18n } from 'vue-i18n'
import InquiryFormModal from '@/components/inquiries/InquiryFormModal.vue'

const route = useRoute()
const router = useRouter()
const store = useMarketplaceStore()
const auth = useAuthStore()
const relationsStore = useRelationsStore()
const { t } = useI18n()
const { currentProfile, isLoadingProfile, error } = storeToRefs(store)

const slug = computed(() => route.params.slug as string)
const isCreateReviewOpen = ref(false)
const reviewsRef = ref<InstanceType<typeof ProfileReviews> | null>(null)
const isReportModalOpen = ref(false)
const showActionsMenu = ref(false)
const isInquiryModalOpen = ref(false)

const hasRelationWithTutor = computed(() => {
  if (!auth.isAuthenticated || auth.userRole !== 'student') return false
  if (!currentProfile.value?.user_id) return false
  const tutorId = String(currentProfile.value.user_id)
  const store$ = relationsStore as any
  const rels: any[] = store$.studentRelations || store$.relations || []
  return rels.some(
    (r: any) => String(r.tutor?.id) === tutorId && (r.status === 'active' || r.status === 'invited')
  )
})

const tutorUserId = computed(() => {
  if (!currentProfile.value?.user_id) return null
  return parseInt(currentProfile.value.user_id.toString())
})

const calendarRef = ref<HTMLElement | null>(null)

onMounted(() => {
  if (slug.value) {
    store.loadProfile(slug.value)
  }
  if (auth.isAuthenticated && auth.userRole === 'student') {
    const store$ = relationsStore as any
    if (typeof store$.fetchStudentRelations === 'function') {
      store$.fetchStudentRelations()
    } else if (typeof store$.fetchRelations === 'function') {
      store$.fetchRelations()
    }
  }
})

watch(slug, (newSlug) => {
  if (newSlug) {
    store.loadProfile(newSlug)
  }
})

function handleLoginRequired() {
  // Redirect to login with return URL
  const returnUrl = encodeURIComponent(route.fullPath)
  router.push(`/auth/login?redirect=${returnUrl}`)
}

function goBack() {
  router.push('/marketplace')
}

function openCreateReview() {
  showActionsMenu.value = false
  isCreateReviewOpen.value = true
}

function closeCreateReview() {
  isCreateReviewOpen.value = false
}

function handleReviewCreated() {
  reviewsRef.value?.reload?.()
}

function handleOpenActionsMenu() {
  showActionsMenu.value = !showActionsMenu.value
}

function handleReport() {
  showActionsMenu.value = false
  isReportModalOpen.value = true
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
      <!-- Hero with CTA -->
      <div class="profile-header-wrapper">
        <ProfileHero
          :profile="currentProfile"
          @back="goBack"
          @inquiry="openInquiryModal"
          @login-required="handleLoginRequired"
        />

        <div v-if="hasRelationWithTutor" class="profile-actions-menu">
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
            <button class="menu-item" @click="openCreateReview">
              {{ t('reviews.writeReview') }}
            </button>
          </div>
        </div>
      </div>

      <!-- Content Grid: left (main) + right (sidebar) -->
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

          <!-- Reviews section -->
          <ProfileReviews
            ref="reviewsRef"
            :slug="slug"
            :average-rating="currentProfile.stats?.average_rating || 0"
            :total-reviews="currentProfile.stats?.total_reviews || 0"
          />
        </main>

        <aside class="profile-sidebar">
          <!-- Calendar section -->
          <section ref="calendarRef" class="profile-section cal-section" data-test="marketplace-availability">
            <TutorAvailabilityCalendar
              v-if="currentProfile.user_id && currentProfile.availability_summary?.timezone"
              :tutor-id="currentProfile.user_id"
              :timezone="currentProfile.availability_summary.timezone"
              :interactive="false"
            />
            <div v-else class="calendar-empty">
              <p>{{ $t('marketplace.profile.calendar.notConfigured') }}</p>
            </div>
          </section>
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
        full_name: currentProfile.user_name || currentProfile.display_name || currentProfile.slug,
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
  padding-bottom: 4rem;
}

.loading {
  display: flex;
  justify-content: center;
  padding: 4rem;
}

.profile-layout {
  max-width: 1060px;
  margin: 0 auto;
  padding: 0 1rem;
  display: grid;
  grid-template-columns: 1fr 280px;
  gap: 1.25rem;
  align-items: start;
}

@media (max-width: 900px) {
  .profile-layout {
    grid-template-columns: 1fr;
  }
}

.profile-main {
  display: flex;
  flex-direction: column;
  gap: 1.25rem;
}

.profile-sidebar {
  display: flex;
  flex-direction: column;
  gap: 1.25rem;
}

.profile-section {
  background: var(--surface-card);
  border-radius: var(--radius-lg);
  border: 1px solid var(--border-color);
  padding: 1.375rem 1.5rem;
  box-shadow: var(--shadow-sm, 0 1px 8px rgba(0,0,0,0.06));
  word-wrap: break-word;
  overflow-wrap: break-word;
  overflow: hidden;
  animation: fadeUp 0.35s ease 0.15s both;
}

.profile-section h2 {
  font: var(--font-headline);
  margin: 0 0 0.75rem;
  color: var(--text-primary);
  word-wrap: break-word;
  overflow-wrap: break-word;
}

.cal-section {
  padding: 1.375rem;
}

.calendar-empty {
  padding: 2rem;
  text-align: center;
  color: var(--text-muted);
  font-style: italic;
}

@keyframes fadeUp {
  from { opacity: 0; transform: translateY(12px); }
  to { opacity: 1; transform: translateY(0); }
}
</style>
