<script setup lang="ts">
// TASK MF5: My Profile View
import { onMounted, computed } from 'vue'
import { storeToRefs } from 'pinia'
import { useMarketplaceStore } from '../stores/marketplaceStore'
import ProfileEditor from '../components/editor/ProfileEditor.vue'
import ProfileStatusBadge from '../components/shared/ProfileStatusBadge.vue'
import CreateProfilePrompt from '../components/editor/CreateProfilePrompt.vue'
import LoadingSpinner from '@/ui/LoadingSpinner.vue'
import type { TutorProfile } from '../api/marketplace'

const store = useMarketplaceStore()
const {
  myProfile,
  isLoadingMyProfile,
  isSaving,
  isProfileComplete,
  canSubmitForReview,
  canPublish,
  error,
} = storeToRefs(store)

const profileUrl = computed(() => {
  if (!myProfile.value?.slug) return null
  return `/tutor/${myProfile.value.slug}`
})

onMounted(() => {
  store.loadMyProfile()
})

async function handleSave(data: Partial<TutorProfile>) {
  await store.updateProfile(data)
}

async function handleCreate(data: Partial<TutorProfile>) {
  await store.createProfile(data)
}

async function handleSubmit() {
  await store.submitForReview()
}

async function handlePublish() {
  await store.publishProfile()
}

async function handleUnpublish() {
  await store.unpublishProfile()
}
</script>

<template>
  <div class="my-profile-view">
    <header class="page-header">
      <div class="header-content">
        <h1>My Tutor Profile</h1>
        <div class="header-actions">
          <ProfileStatusBadge v-if="myProfile" :status="myProfile.status" />

          <a
            v-if="myProfile?.is_public && profileUrl"
            :href="profileUrl"
            target="_blank"
            class="btn btn-ghost"
          >
            View Public Profile
          </a>

          <button
            v-if="canPublish && !myProfile?.is_public"
            class="btn btn-primary"
            :disabled="isSaving"
            @click="handlePublish"
          >
            {{ isSaving ? 'Publishing...' : 'Publish Profile' }}
          </button>

          <button
            v-if="myProfile?.is_public"
            class="btn btn-secondary"
            :disabled="isSaving"
            @click="handleUnpublish"
          >
            {{ isSaving ? 'Unpublishing...' : 'Unpublish' }}
          </button>

          <button
            v-if="canSubmitForReview"
            class="btn btn-secondary"
            :disabled="isSaving"
            @click="handleSubmit"
          >
            {{ isSaving ? 'Submitting...' : 'Submit for Review' }}
          </button>
        </div>
      </div>
    </header>

    <main class="page-content">
      <LoadingSpinner v-if="isLoadingMyProfile" />

      <template v-else>
        <div v-if="error" class="error-banner">
          {{ error }}
        </div>

        <div v-if="!isProfileComplete && myProfile" class="incomplete-banner">
          <strong>Your profile is incomplete.</strong>
          Complete all required fields to submit for review.
        </div>

        <ProfileEditor
          v-if="myProfile"
          :profile="myProfile"
          :saving="isSaving"
          @save="handleSave"
        />

        <CreateProfilePrompt v-else @create="handleCreate" />
      </template>
    </main>
  </div>
</template>

<style scoped>
.my-profile-view {
  min-height: 100vh;
  background: #f9fafb;
}

.page-header {
  background: white;
  border-bottom: 1px solid #e5e7eb;
  padding: 1.5rem;
}

.header-content {
  max-width: 1000px;
  margin: 0 auto;
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 1rem;
}

.page-header h1 {
  font-size: 1.5rem;
  font-weight: 600;
  margin: 0;
  color: #111827;
}

.header-actions {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  flex-wrap: wrap;
}

.page-content {
  max-width: 1000px;
  margin: 0 auto;
  padding: 1.5rem;
}

.error-banner {
  background: #fef2f2;
  border: 1px solid #fecaca;
  color: #991b1b;
  padding: 1rem;
  border-radius: 8px;
  margin-bottom: 1.5rem;
}

.incomplete-banner {
  background: #fffbeb;
  border: 1px solid #fde68a;
  color: #92400e;
  padding: 1rem;
  border-radius: 8px;
  margin-bottom: 1.5rem;
}

.btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  padding: 0.625rem 1.25rem;
  border: none;
  border-radius: 8px;
  font-size: 0.875rem;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;
  text-decoration: none;
}

.btn-primary {
  background: #3b82f6;
  color: white;
}

.btn-primary:hover {
  background: #2563eb;
}

.btn-secondary {
  background: white;
  color: #374151;
  border: 1px solid #d1d5db;
}

.btn-secondary:hover {
  background: #f9fafb;
}

.btn-ghost {
  background: transparent;
  color: #3b82f6;
}

.btn-ghost:hover {
  background: #eff6ff;
}

.btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}
</style>
