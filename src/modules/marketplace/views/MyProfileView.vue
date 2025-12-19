<script setup lang="ts">
// TASK MF5: My Profile View
import { onMounted, computed } from 'vue'
import { storeToRefs } from 'pinia'
import { useMarketplaceStore } from '../stores/marketplaceStore'
import ProfileEditor from '../components/editor/ProfileEditor.vue'
import ProfileStatusBadge from '../components/shared/ProfileStatusBadge.vue'
import CreateProfilePrompt from '../components/editor/CreateProfilePrompt.vue'
import LoadingSpinner from '@/ui/LoadingSpinner.vue'
import type { TutorProfileUpsertPayload, TutorProfilePatchPayload } from '../api/marketplace'
import { telemetry } from '@/services/telemetry'
import { useI18n } from 'vue-i18n'

const store = useMarketplaceStore()
const { t } = useI18n()
const {
  myProfile,
  isLoadingMyProfile,
  isSaving,
  isProfileComplete,
  canSubmitForReview,
  canPublish,
  error,
  validationErrors,
  filterOptions,
} = storeToRefs(store)

const hasValidationErrors = computed(() => {
  return validationErrors.value && Object.keys(validationErrors.value).length > 0
})

const profileUrl = computed(() => {
  if (!myProfile.value?.slug) return null
  return `/marketplace/tutors/${myProfile.value.slug}`
})

onMounted(() => {
  store.loadMyProfile()
  store.loadFilterOptions()
})

async function handleSave(data: TutorProfilePatchPayload) {
  telemetry.trigger('marketplace_profile_save', { has_id: typeof myProfile.value?.id === 'number' })
  await store.updateProfile(data)
}

async function handleCreate(data: TutorProfileUpsertPayload) {
  telemetry.trigger('marketplace_profile_create', {})
  await store.createProfile(data)
}

async function handleSubmit() {
  telemetry.trigger('marketplace_profile_submit', { is_complete: isProfileComplete.value })
  await store.submitForReview()
}

async function handlePublish() {
  telemetry.trigger('marketplace_profile_publish', { status: myProfile.value?.status || null })
  await store.publishProfile()
}

async function handleUnpublish() {
  telemetry.trigger('marketplace_profile_unpublish', {})
  await store.unpublishProfile()
}
</script>

<template>
  <div class="my-profile-view" data-test="marketplace-my-profile">
    <header class="page-header">
      <div class="header-content">
        <h1>{{ t('marketplace.profile.title') }}</h1>
        <div class="header-actions">
          <ProfileStatusBadge v-if="myProfile" :status="myProfile.status" />

          <a
            v-if="myProfile?.is_public && profileUrl"
            :href="profileUrl"
            target="_blank"
            class="btn btn-ghost"
          >
            {{ t('marketplace.profile.viewPublic') }}
          </a>

          <button
            v-if="canPublish && !myProfile?.is_public"
            class="btn btn-primary"
            :disabled="isSaving"
            data-test="marketplace-publish"
            @click="handlePublish"
          >
            {{ isSaving ? t('marketplace.profile.publishing') : t('marketplace.profile.publish') }}
          </button>

          <button
            v-if="myProfile?.is_public"
            class="btn btn-secondary"
            :disabled="isSaving"
            data-test="marketplace-unpublish"
            @click="handleUnpublish"
          >
            {{ isSaving ? t('marketplace.profile.unpublishing') : t('marketplace.profile.unpublish') }}
          </button>

          <button
            v-if="canSubmitForReview"
            class="btn btn-secondary"
            :disabled="isSaving"
            data-test="marketplace-submit"
            @click="handleSubmit"
          >
            {{ isSaving ? t('marketplace.profile.submitting') : t('marketplace.profile.submit') }}
          </button>
        </div>
      </div>
    </header>

    <main class="page-content">
      <LoadingSpinner v-if="isLoadingMyProfile" />

      <template v-else>
        <div v-if="error" class="error-banner" data-test="marketplace-profile-error">
          {{ error }}
        </div>

        <div v-if="hasValidationErrors" class="validation-banner" data-test="marketplace-profile-validation">
          <strong>{{ t('marketplace.profile.validationTitle') }}</strong>
          <ul>
            <li v-for="(messages, field) in validationErrors" :key="field">
              {{ field }}: {{ (messages || []).join(', ') }}
            </li>
          </ul>
        </div>

        <div v-if="!isProfileComplete && myProfile" class="incomplete-banner" data-test="marketplace-profile-incomplete">
          <strong>{{ t('marketplace.profile.incompleteTitle') }}</strong>
          {{ t('marketplace.profile.incompleteDescription') }}
        </div>

        <ProfileEditor
          v-if="myProfile"
          :profile="myProfile"
          :saving="isSaving"
          :filter-options="filterOptions"
          data-test="marketplace-profile-editor"
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
  background: var(--surface-marketplace);
}

.page-header {
  background: var(--nav-bg);
  border-bottom: 1px solid var(--border-color);
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
  color: var(--text-primary);
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
  background: color-mix(in srgb, var(--danger-bg) 12%, transparent);
  border: 1px solid color-mix(in srgb, var(--danger-bg) 28%, transparent);
  color: var(--text-primary);
  padding: 1rem;
  border-radius: 8px;
  margin-bottom: 1.5rem;
}

.incomplete-banner {
  background: color-mix(in srgb, var(--warning-bg) 14%, transparent);
  border: 1px solid color-mix(in srgb, var(--warning-bg) 32%, transparent);
  color: var(--text-primary);
  padding: 1rem;
  border-radius: 8px;
  margin-bottom: 1.5rem;
}

.validation-banner {
  background: color-mix(in srgb, var(--info-bg) 12%, transparent);
  border: 1px solid color-mix(in srgb, var(--info-bg) 28%, transparent);
  color: var(--text-primary);
  padding: 1rem;
  border-radius: 8px;
  margin-bottom: 1.5rem;
}

.validation-banner ul {
  margin: 0.5rem 0 0;
  padding-left: 1.25rem;
}

</style>
