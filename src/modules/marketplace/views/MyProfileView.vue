<script setup lang="ts">
// TASK MF5: My Profile View
import { onMounted, computed, ref } from 'vue'
import { storeToRefs } from 'pinia'
import { useMarketplaceStore } from '../stores/marketplaceStore'
import ProfileEditor from '../components/editor/ProfileEditor.vue'
import ProfileStatusBadge from '../components/shared/ProfileStatusBadge.vue'
import CreateProfilePrompt from '../components/editor/CreateProfilePrompt.vue'
import LoadingSpinner from '@/ui/LoadingSpinner.vue'
import ActivityStatusBanner from '@/modules/tutor/components/ActivityStatusBanner.vue'
import type { TutorProfileUpsertPayload, TutorProfilePatchPayload } from '../api/marketplace'
import type { TutorActivityStatus } from '../api/tutorActivity'
import tutorActivityApi from '../api/tutorActivity'
import { telemetry } from '@/services/telemetry'
import { useI18n } from 'vue-i18n'
import { notifyError, notifySuccess } from '@/utils/notify'
import Button from '@/ui/Button.vue'

const store = useMarketplaceStore()
const { t } = useI18n()
const activityStatus = ref<TutorActivityStatus | null>(null)
const {
  myProfile,
  isLoadingMyProfile,
  isSaving,
  isProfileComplete,
  missingProfileSections,
  canSubmitForReview,
  canPublish,
  error,
  validationErrors,
  filterOptions,
} = storeToRefs(store)

const editorRef = ref<InstanceType<typeof ProfileEditor> | null>(null)

const hasValidationErrors = computed(() => {
  return validationErrors.value && Object.keys(validationErrors.value).length > 0
})

const profileUrl = computed(() => {
  if (!myProfile.value?.slug) return null
  return `/marketplace/tutors/${myProfile.value.slug}`
})

const completenessPercent = computed(() => {
  if (!myProfile.value || typeof myProfile.value.completeness_score !== 'number') {
    return null
  }
  const normalized = Math.min(Math.max(myProfile.value.completeness_score, 0), 1)
  return Math.round(normalized * 100)
})

const shouldShowCompletenessWidget = computed(() => completenessPercent.value !== null)

onMounted(() => {
  store.loadMyProfile()
  store.loadFilterOptions()
})

async function handleSave(data: TutorProfilePatchPayload, options?: { silent?: boolean }) {
  telemetry.trigger('marketplace_profile_save', { has_slug: !!myProfile.value?.slug, silent: !!options?.silent })
  await store.updateProfile(data, options)
}

async function handleCreate(data: TutorProfileUpsertPayload) {
  telemetry.trigger('marketplace_profile_create', {})
  await store.createProfile(data)
}

async function handleSubmit() {
  telemetry.trigger('marketplace_profile_submit', { is_complete: isProfileComplete.value })
  try {
    await store.submitForReview()
    notifySuccess(t('marketplace.profile.submitSuccess'))
  } catch (err) {
    notifyError(store.error || t('marketplace.profile.submitError'))
  }
}

async function handlePublish() {
  telemetry.trigger('marketplace_profile_publish', {})
  try {
    const payload = editorRef.value?.getSubmitPayload?.()
    if (!payload) return
    await store.updateProfile(payload)
    await store.publishProfile()
    notifySuccess(t('marketplace.profile.publishSuccess'))
  } catch (err) {
    notifyError(store.error || t('marketplace.profile.publishError'))
  }
}

async function handleUnpublish() {
  telemetry.trigger('marketplace_profile_unpublish', {})
  try {
    await store.unpublishProfile()
    notifySuccess(t('marketplace.profile.unpublishSuccess'))
  } catch (err) {
    notifyError(store.error || t('marketplace.profile.unpublishError'))
  }
}
</script>

<template>
  <div class="my-profile-view" data-test="marketplace-my-profile">
    <header class="page-header">
      <div class="header-content">
        <h1>{{ t('marketplace.profile.title') }}</h1>
        <div class="header-actions">
          <a
            v-if="myProfile && profileUrl"
            :href="profileUrl"
            target="_blank"
            class="link-ghost"
          >
            {{ t('marketplace.profile.viewPublic') }}
          </a>

          <Button
            v-if="canPublish"
            variant="primary"
            :disabled="isSaving"
            data-test="marketplace-publish"
            @click="handlePublish"
          >
            {{ isSaving ? t('marketplace.profile.publishing') : t('marketplace.profile.publish') }}
          </Button>

          <Button
            v-if="myProfile"
            variant="secondary"
            :disabled="isSaving"
            data-test="marketplace-unpublish"
            @click="handleUnpublish"
          >
            {{ isSaving ? t('marketplace.profile.unpublishing') : t('marketplace.profile.unpublish') }}
          </Button>

          <Button
            v-if="canSubmitForReview"
            variant="secondary"
            :disabled="isSaving"
            data-test="marketplace-submit"
            @click="handleSubmit"
          >
            {{ isSaving ? t('marketplace.profile.submitting') : t('marketplace.profile.submit') }}
          </Button>
        </div>
      </div>
    </header>

    <main class="page-content">
      <LoadingSpinner v-if="isLoadingMyProfile" />

      <template v-else>
        <!-- v0.83.0: Don't show error banner for profile_missing - show CreateProfilePrompt instead -->
        <div v-if="error && error.trim()" class="error-banner" data-test="marketplace-profile-error">
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

        <div v-if="myProfile && myProfile.is_published && isProfileComplete" class="success-banner" data-test="marketplace-profile-published">
          <strong>{{ t('marketplace.profile.publishedTitle') }}</strong>
          {{ t('marketplace.profile.publishedDescription') }}
        </div>

        <div v-else-if="missingProfileSections.length > 0 && myProfile" class="incomplete-banner" data-test="marketplace-profile-incomplete">
          <strong>{{ t('marketplace.profile.incompleteTitle') }}</strong>
          <p class="hint">{{ t('marketplace.profile.incompleteDescription') }}</p>
          <ul class="incomplete-list">
            <li v-for="section in missingProfileSections" :key="section">{{ section }}</li>
          </ul>
          
        </div>

        <div v-if="shouldShowCompletenessWidget" class="completeness-widget" data-test="marketplace-profile-completeness">
          <div class="completeness-header">
            <span class="completeness-label">{{ t('marketplace.profile.completenessScore') || 'Заповнено' }}</span>
            <span class="completeness-value">{{ completenessPercent }}%</span>
          </div>
          <div class="completeness-bar">
            <div
              class="completeness-fill"
              :style="{ width: `${completenessPercent}%` }"
            />
          </div>
        </div>

        <ProfileEditor
          v-if="myProfile"
          ref="editorRef"
          :profile="myProfile"
          :saving="isSaving"
          :api-errors="validationErrors"
          :filter-options="filterOptions"
          data-test="marketplace-profile-editor"
          @save="handleSave"
          @publish="handlePublish"
          @unpublish="handleUnpublish"
          @reload="store.loadMyProfile"
        />

        <CreateProfilePrompt v-else @create="handleCreate" />
      </template>
    </main>
  </div>
</template>

<style scoped>
.link-ghost {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 0.625rem 1.125rem;
  border-radius: 25px;
  font-weight: 600;
  font-size: 0.95rem;
  cursor: pointer;
  transition: all 0.2s ease;
  background-color: transparent;
  color: var(--accent);
  border: 1px solid color-mix(in srgb, var(--accent) 25%, transparent);
  text-decoration: none;
}

.link-ghost:hover {
  background-color: color-mix(in srgb, var(--accent) 8%, transparent);
  color: var(--accent);
  border-color: color-mix(in srgb, var(--accent) 45%, transparent);
}

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

.incomplete-list {
  margin: 0.5rem 0 0;
  padding-left: 1.25rem;
}

.incomplete-banner .hint {
  margin: 0.25rem 0 0;
  font-size: 0.9rem;
  opacity: 0.85;
}

.success-banner {
  background: color-mix(in srgb, var(--success-bg) 14%, transparent);
  border: 1px solid color-mix(in srgb, var(--success-bg) 32%, transparent);
  color: var(--text-primary);
  padding: 1rem;
  border-radius: 8px;
  margin-bottom: 1.5rem;
}

.completeness-widget {
  margin-top: 1rem;
  padding-top: 1rem;
  border-top: 1px solid color-mix(in srgb, var(--warning-bg) 20%, transparent);
}

.completeness-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 0.5rem;
}

.completeness-label {
  font-size: 0.875rem;
  color: var(--text-secondary);
  font-weight: 500;
}

.completeness-value {
  font-size: 0.875rem;
  font-weight: 600;
  color: var(--text-primary);
}

.completeness-bar {
  height: 8px;
  width: 100%;
  background: color-mix(in srgb, var(--warning-bg) 20%, transparent);
  border-radius: 999px;
  overflow: hidden;
}

.completeness-fill {
  height: 100%;
  background: var(--accent);
  transition: width 0.3s ease;
  border-radius: 999px;
}

</style>
