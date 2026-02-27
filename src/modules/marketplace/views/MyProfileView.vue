<script setup lang="ts">
// TASK MF5: My Profile View
import { onMounted, computed, ref } from 'vue'
import { onBeforeRouteLeave, useRouter, useRoute } from 'vue-router'
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
import { findFirstTabWithError } from '../utils/validationMessages'
import Button from '@/ui/Button.vue'

const store = useMarketplaceStore()
const { t } = useI18n()
const router = useRouter()
const route = useRoute()
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

// P4: completenessPercent and shouldShowCompletenessWidget removed —
// single progress indicator is now the editor's step-based "X/9 steps" bar.

onMounted(() => {
  store.loadMyProfile()
  store.loadFilterOptions()
})

onBeforeRouteLeave(() => {
  editorRef.value?.flushDraft?.()
})

async function handleSave(data: TutorProfilePatchPayload, options?: { silent?: boolean }) {
  telemetry.trigger('marketplace_profile_save', { has_slug: !!myProfile.value?.slug, silent: !!options?.silent })
  try {
    await store.updateProfile(data, options)
    if (!options?.silent) {
      notifySuccess(t('marketplace.profile.saveSuccess'))
    }
  } catch (err: any) {
    // store.updateProfile already shows toasts for 400 validation errors.
    // Here we handle everything else (401, 500, network errors).
    if (options?.silent) return
    const status = err?.response?.status
    if (status === 401) {
      notifyError(t('common.sessionExpired', 'Сесію завершено. Увійдіть знову.'))
    } else if (!validationErrors.value) {
      notifyError(error.value || t('marketplace.errors.updateProfile'))
    }
    // FIX-D: Auto-switch to the first tab with validation errors
    if (validationErrors.value) {
      const errorTab = findFirstTabWithError(validationErrors.value)
      if (errorTab && route.query.step !== errorTab) {
        router.replace({ query: { ...route.query, step: errorTab } })
      }
    }
  }
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

const FIELD_LABEL_MAP: Record<string, string> = {
  photo: 'marketplace.profile.editor.photoTitle',
  headline: 'marketplace.profile.editor.headlineLabel',
  bio: 'marketplace.profile.editor.bioLabel',
  subjects: 'marketplace.profile.editor.subjectsLabel',
  languages: 'marketplace.profile.editor.teachingLanguagesLabel',
  teaching_languages: 'marketplace.profile.editor.teachingLanguagesLabel',
  hourly_rate: 'marketplace.profile.editor.hourlyRateLabel',
  currency: 'marketplace.profile.editor.pricingTitle',
  experience_years: 'marketplace.profile.editor.experienceYearsLabel',
  timezone: 'marketplace.profile.editor.timezoneLabel',
  format: 'marketplace.profile.editor.formatLabel',
  availability: 'marketplace.profile.editor.availabilityLabel',
  status: 'marketplace.profile.statusLabel',
}

function fieldLabel(field: string): string {
  const key = FIELD_LABEL_MAP[field]
  if (key) {
    const translated = t(key)
    if (translated !== key) return translated
  }
  return field
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
            v-if="myProfile?.is_published"
            variant="secondary"
            :disabled="isSaving"
            data-test="marketplace-unpublish"
            @click="handleUnpublish"
          >
            {{ isSaving ? t('marketplace.profile.unpublishing') : t('marketplace.profile.unpublish') }}
          </Button>

          <!-- v1.0: Hidden — self-publish flow makes moderation button confusing for users
          <Button
            v-if="canSubmitForReview"
            variant="secondary"
            :disabled="isSaving"
            data-test="marketplace-submit"
            @click="handleSubmit"
          >
            {{ isSaving ? t('marketplace.profile.submitting') : t('marketplace.profile.submit') }}
          </Button>
          -->
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
              <strong>{{ fieldLabel(field as string) }}:</strong> {{ (messages || []).join(', ') }}
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

        <!-- P4: completeness % widget removed — conflicts with editor's step-based progress (X/9).
             Backend completeness_score uses different thresholds (bio≥100, headline≥20) and counts
             fields not present in the UI (certifications, education, video_intro).
             Single source of truth for progress is now the editor's step completion indicator. -->


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

/* P4: completeness-widget CSS removed — widget replaced by editor's step progress bar */

</style>
