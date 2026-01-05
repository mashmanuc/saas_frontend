<template>
  <div class="lesson-links-view">
    <nav class="lesson-links-tabs" aria-label="Tutor profile steps">
      <RouterLink
        v-for="tab in tabs"
        :key="tab.id"
        :to="tab.to"
        class="lesson-links-tab"
        :class="{
          'lesson-links-tab--active': tab.id === activeTab,
          'lesson-links-tab--external': tab.isExternal
        }"
      >
        {{ t(tab.labelKey) }}
      </RouterLink>
    </nav>

    <div class="lesson-links-view__header">
      <div>
        <h1>{{ t('tutor.lessonLinks.title') }}</h1>
        <p class="lesson-links-view__subtitle">
          {{ t('tutor.lessonLinks.subtitle') }}
        </p>
      </div>
    </div>

    <div class="lesson-links-view__card">
      <div v-if="loading" class="lesson-links-view__loader">
        <LoaderIcon class="spinner" />
        <p>{{ t('common.loading') }}</p>
      </div>

      <div v-else-if="error" class="lesson-links-view__error">
        <AlertCircleIcon class="icon" />
        <p>{{ error }}</p>
        <button @click="loadLinks" class="btn-retry">
          {{ t('common.retry') }}
        </button>
      </div>

      <div v-else class="lesson-links-form">
        <!-- Primary Link -->
        <div class="form-section">
          <h2 class="form-section__title">{{ t('tutor.lessonLinks.primary.title') }}</h2>
          <p class="form-section__description">{{ t('tutor.lessonLinks.primary.description') }}</p>

          <div class="form-field">
            <label class="form-label">{{ t('tutor.lessonLinks.provider') }}</label>
            <select v-model="formData.primaryProvider" class="form-select" @change="handlePrimaryProviderChange">
              <option value="platform">{{ t('tutor.lessonLinks.providers.platform') }}</option>
              <option value="zoom">{{ t('tutor.lessonLinks.providers.zoom') }}</option>
              <option value="meet">{{ t('tutor.lessonLinks.providers.meet') }}</option>
              <option value="custom">{{ t('tutor.lessonLinks.providers.custom') }}</option>
            </select>
          </div>

          <div v-if="formData.primaryProvider !== 'platform'" class="form-field">
            <label class="form-label">{{ t('tutor.lessonLinks.url') }}</label>
            <input
              v-model="formData.primaryUrl"
              type="url"
              class="form-input"
              :placeholder="getPlaceholder(formData.primaryProvider)"
              @blur="validateUrl('primary')"
            />
            <p v-if="validationErrors.primaryUrl" class="form-error">{{ validationErrors.primaryUrl }}</p>
          </div>

          <div v-if="formData.primaryProvider === 'platform'" class="platform-info">
            <InfoIcon class="icon" />
            <p>{{ t('tutor.lessonLinks.platformInfo') }}</p>
          </div>
        </div>

        <!-- Backup Link -->
        <div class="form-section">
          <div class="form-section__header">
            <div>
              <h2 class="form-section__title">{{ t('tutor.lessonLinks.backup.title') }}</h2>
              <p class="form-section__description">{{ t('tutor.lessonLinks.backup.description') }}</p>
            </div>
            <label class="toggle-switch">
              <input
                v-model="formData.hasBackup"
                type="checkbox"
                @change="handleBackupToggle"
              />
              <span class="toggle-slider"></span>
            </label>
          </div>

          <template v-if="formData.hasBackup">
            <div class="form-field">
              <label class="form-label">{{ t('tutor.lessonLinks.provider') }}</label>
              <select v-model="formData.backupProvider" class="form-select" @change="handleBackupProviderChange">
                <option value="zoom">{{ t('tutor.lessonLinks.providers.zoom') }}</option>
                <option value="meet">{{ t('tutor.lessonLinks.providers.meet') }}</option>
                <option value="custom">{{ t('tutor.lessonLinks.providers.custom') }}</option>
              </select>
            </div>

            <div class="form-field">
              <label class="form-label">{{ t('tutor.lessonLinks.url') }}</label>
              <input
                v-model="formData.backupUrl"
                type="url"
                class="form-input"
                :placeholder="getPlaceholder(formData.backupProvider)"
                @blur="validateUrl('backup')"
              />
              <p v-if="validationErrors.backupUrl" class="form-error">{{ validationErrors.backupUrl }}</p>
            </div>
          </template>
        </div>

        <!-- Current Effective Link Preview -->
        <div class="preview-section">
          <h3 class="preview-section__title">{{ t('tutor.lessonLinks.preview.title') }}</h3>
          <div class="preview-link">
            <LinkIcon class="icon" />
            <div class="preview-link__content">
              <span class="preview-link__label">{{ t('tutor.lessonLinks.preview.current') }}</span>
              <code class="preview-link__url">{{ effectivePreviewUrl }}</code>
              <span class="preview-link__provider">{{ getProviderLabel(effectivePreviewProvider) }}</span>
            </div>
          </div>
        </div>

        <!-- Actions -->
        <div class="form-actions">
          <button
            @click="handleCancel"
            class="btn-secondary"
            :disabled="saving"
          >
            {{ t('common.cancel') }}
          </button>
          <button
            @click="handleSave"
            class="btn-primary"
            :disabled="saving || !hasChanges"
          >
            <LoaderIcon v-if="saving" class="spinner-small" />
            {{ t('common.save') }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'
import { Loader as LoaderIcon, AlertCircle as AlertCircleIcon, Info as InfoIcon, Link as LinkIcon } from 'lucide-vue-next'
import { useTutorLessonLinksStore } from '@/modules/booking/stores/tutorLessonLinksStore'
import { useToast } from '@/composables/useToast'
import type { LessonLinkProvider } from '@/modules/booking/api/tutorSettingsApi'

const { t } = useI18n()
const router = useRouter()
const activeTab = 'lesson-links'
const tabs = [
  { id: 'photo', labelKey: 'marketplace.profile.editor.photoTitle', to: { name: 'marketplace-my-profile', query: { step: 'photo' } } },
  { id: 'basic', labelKey: 'marketplace.profile.editor.basicTitle', to: { name: 'marketplace-my-profile', query: { step: 'basic' } } },
  { id: 'subjects', labelKey: 'marketplace.profile.editor.subjectsLanguagesTitle', to: { name: 'marketplace-my-profile', query: { step: 'subjects' } } },
  { id: 'pricing', labelKey: 'marketplace.profile.editor.pricingTitle', to: { name: 'marketplace-my-profile', query: { step: 'pricing' } } },
  { id: 'video', labelKey: 'marketplace.profile.editor.videoTitle', to: { name: 'marketplace-my-profile', query: { step: 'video' } } },
  { id: 'privacy', labelKey: 'marketplace.profile.editor.privacyTitle', to: { name: 'marketplace-my-profile', query: { step: 'privacy' } } },
  { id: 'publish', labelKey: 'marketplace.profile.publish', to: { name: 'marketplace-my-profile', query: { step: 'publish' } } },
  { id: 'lesson-links', labelKey: 'marketplace.profile.editor.lessonLinksTitle', to: { name: 'tutor-lesson-links' }, isExternal: true }
]
const store = useTutorLessonLinksStore()
const toast = useToast()

const loading = ref(false)
const saving = ref(false)
const error = ref<string | null>(null)

const formData = ref({
  primaryProvider: 'platform' as LessonLinkProvider['provider'],
  primaryUrl: '',
  hasBackup: false,
  backupProvider: 'zoom' as LessonLinkProvider['provider'],
  backupUrl: ''
})

const originalData = ref<typeof formData.value | null>(null)

const validationErrors = ref({
  primaryUrl: '',
  backupUrl: ''
})

const hasChanges = computed(() => {
  if (!originalData.value) return false
  return JSON.stringify(formData.value) !== JSON.stringify(originalData.value)
})

const effectivePreviewProvider = computed(() => {
  return formData.value.primaryProvider
})

const effectivePreviewUrl = computed(() => {
  if (formData.value.primaryProvider === 'platform') {
    return t('tutor.lessonLinks.platformGenerated')
  }
  return formData.value.primaryUrl || t('tutor.lessonLinks.notSet')
})

function getProviderLabel(provider: string): string {
  const labels: Record<string, string> = {
    platform: t('tutor.lessonLinks.providers.platform'),
    zoom: t('tutor.lessonLinks.providers.zoom'),
    meet: t('tutor.lessonLinks.providers.meet'),
    custom: t('tutor.lessonLinks.providers.custom')
  }
  return labels[provider] || provider
}

function getPlaceholder(provider: string): string {
  const placeholders: Record<string, string> = {
    zoom: 'https://zoom.us/j/123456789',
    meet: 'https://meet.google.com/abc-defg-hij',
    custom: 'https://example.com/meeting'
  }
  return placeholders[provider] || ''
}

function validateUrl(field: 'primary' | 'backup'): boolean {
  const url = field === 'primary' ? formData.value.primaryUrl : formData.value.backupUrl
  
  if (!url) {
    validationErrors.value[`${field}Url`] = t('tutor.lessonLinks.validation.required')
    return false
  }

  try {
    const parsed = new URL(url)
    if (!parsed.protocol.startsWith('http')) {
      validationErrors.value[`${field}Url`] = t('tutor.lessonLinks.validation.invalidProtocol')
      return false
    }
  } catch {
    validationErrors.value[`${field}Url`] = t('tutor.lessonLinks.validation.invalidUrl')
    return false
  }

  validationErrors.value[`${field}Url`] = ''
  return true
}

function handlePrimaryProviderChange() {
  if (formData.value.primaryProvider === 'platform') {
    formData.value.primaryUrl = ''
    validationErrors.value.primaryUrl = ''
  }
}

function handleBackupProviderChange() {
  formData.value.backupUrl = ''
  validationErrors.value.backupUrl = ''
}

function handleBackupToggle() {
  if (!formData.value.hasBackup) {
    formData.value.backupUrl = ''
    validationErrors.value.backupUrl = ''
  }
}

async function loadLinks() {
  loading.value = true
  error.value = null

  try {
    await store.fetchLessonLinks()

    // Populate form with current data
    const primary = store.primary
    const backup = store.backup

    formData.value = {
      primaryProvider: primary?.provider || 'platform',
      primaryUrl: primary?.url || '',
      hasBackup: backup !== null,
      backupProvider: backup?.provider || 'zoom',
      backupUrl: backup?.url || ''
    }

    originalData.value = JSON.parse(JSON.stringify(formData.value))
  } catch (err: any) {
    error.value = err.message || t('tutor.lessonLinks.errors.loadFailed')
    console.error('[TutorLessonLinksView] Load error:', err)
  } finally {
    loading.value = false
  }
}

async function handleSave() {
  // Validate
  let isValid = true
  
  if (formData.value.primaryProvider !== 'platform') {
    isValid = validateUrl('primary') && isValid
  }
  
  if (formData.value.hasBackup) {
    isValid = validateUrl('backup') && isValid
  }

  if (!isValid) {
    toast.error(t('tutor.lessonLinks.validation.fixErrors'))
    return
  }

  saving.value = true

  try {
    const payload: {
      primary?: LessonLinkProvider
      backup?: LessonLinkProvider | null
    } = {}

    // Primary
    payload.primary = {
      provider: formData.value.primaryProvider,
      url: formData.value.primaryProvider === 'platform' ? null : formData.value.primaryUrl
    }

    // Backup
    if (formData.value.hasBackup) {
      payload.backup = {
        provider: formData.value.backupProvider,
        url: formData.value.backupUrl
      }
    } else {
      payload.backup = null
    }

    await store.patchLessonLinks(payload)

    toast.success(t('tutor.lessonLinks.success.saved'))
    originalData.value = JSON.parse(JSON.stringify(formData.value))
  } catch (err: any) {
    if (err?.response?.status === 409) {
      toast.error(t('tutor.lessonLinks.errors.conflict'))
      await loadLinks()
    } else {
      toast.error(err.message || t('tutor.lessonLinks.errors.saveFailed'))
    }
    console.error('[TutorLessonLinksView] Save error:', err)
  } finally {
    saving.value = false
  }
}

function handleCancel() {
  if (hasChanges.value) {
    if (confirm(t('common.confirmDiscard'))) {
      router.back()
    }
  } else {
    router.back()
  }
}

onMounted(() => {
  loadLinks()
})
</script>

<style scoped>
.lesson-links-tabs {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  margin-bottom: 16px;
}

.lesson-links-tab {
  border: 1px solid var(--border-color, #d1d5db);
  border-radius: 999px;
  padding: 6px 14px;
  font-size: 0.875rem;
  color: var(--text-secondary, #475467);
  text-decoration: none;
  transition: all 0.2s ease;
}

.lesson-links-tab--active {
  border-color: #2563eb;
  color: #2563eb;
  background: color-mix(in srgb, #2563eb 12%, transparent);
}

.lesson-links-tab--external {
  border-style: dashed;
}

.lesson-links-view {
  display: flex;
  flex-direction: column;
  gap: 24px;
  padding: 24px;
  min-height: 100%;
  max-width: 800px;
  margin: 0 auto;
}

.lesson-links-view__header {
  display: flex;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 16px;
}

.lesson-links-view__header h1 {
  font-size: 1.75rem;
  font-weight: 600;
  color: #111827;
  margin: 0 0 8px 0;
}

.lesson-links-view__subtitle {
  font-size: 0.875rem;
  color: #6b7280;
  margin: 0;
}

.lesson-links-view__card {
  background: white;
  border-radius: 12px;
  padding: 32px;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
}

.lesson-links-view__loader,
.lesson-links-view__error {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 16px;
  padding: 48px 24px;
  text-align: center;
}

.lesson-links-view__error {
  color: #dc2626;
}

.lesson-links-view__error .icon {
  width: 48px;
  height: 48px;
}

.spinner {
  width: 32px;
  height: 32px;
  animation: spin 1s linear infinite;
  color: #3b82f6;
}

.spinner-small {
  width: 16px;
  height: 16px;
  animation: spin 1s linear infinite;
}

@keyframes spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}

.btn-retry {
  padding: 10px 20px;
  background: #3b82f6;
  color: white;
  border: none;
  border-radius: 6px;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  transition: background 0.2s;
}

.btn-retry:hover {
  background: #2563eb;
}

.lesson-links-form {
  display: flex;
  flex-direction: column;
  gap: 32px;
}

.form-section {
  display: flex;
  flex-direction: column;
  gap: 16px;
  padding-bottom: 32px;
  border-bottom: 1px solid #e5e7eb;
}

.form-section:last-of-type {
  border-bottom: none;
}

.form-section__header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 16px;
}

.form-section__title {
  font-size: 1.125rem;
  font-weight: 600;
  color: #111827;
  margin: 0;
}

.form-section__description {
  font-size: 0.875rem;
  color: #6b7280;
  margin: 4px 0 0 0;
}

.form-field {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.form-label {
  font-size: 0.875rem;
  font-weight: 500;
  color: #374151;
}

.form-select,
.form-input {
  padding: 10px 12px;
  border: 1px solid #d1d5db;
  border-radius: 6px;
  font-size: 14px;
  transition: border-color 0.2s;
}

.form-select:focus,
.form-input:focus {
  outline: none;
  border-color: #3b82f6;
  box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
}

.form-error {
  font-size: 0.75rem;
  color: #dc2626;
  margin: 0;
}

.platform-info {
  display: flex;
  align-items: flex-start;
  gap: 12px;
  padding: 12px;
  background: #eff6ff;
  border: 1px solid #dbeafe;
  border-radius: 6px;
  font-size: 0.875rem;
  color: #1e40af;
}

.platform-info .icon {
  width: 20px;
  height: 20px;
  flex-shrink: 0;
  margin-top: 2px;
}

.toggle-switch {
  position: relative;
  display: inline-block;
  width: 48px;
  height: 24px;
  flex-shrink: 0;
}

.toggle-switch input {
  opacity: 0;
  width: 0;
  height: 0;
}

.toggle-slider {
  position: absolute;
  cursor: pointer;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background-color: #d1d5db;
  transition: 0.3s;
  border-radius: 24px;
}

.toggle-slider:before {
  position: absolute;
  content: "";
  height: 18px;
  width: 18px;
  left: 3px;
  bottom: 3px;
  background-color: white;
  transition: 0.3s;
  border-radius: 50%;
}

input:checked + .toggle-slider {
  background-color: #3b82f6;
}

input:checked + .toggle-slider:before {
  transform: translateX(24px);
}

.preview-section {
  padding: 20px;
  background: #f9fafb;
  border-radius: 8px;
}

.preview-section__title {
  font-size: 0.875rem;
  font-weight: 600;
  color: #374151;
  margin: 0 0 12px 0;
}

.preview-link {
  display: flex;
  align-items: flex-start;
  gap: 12px;
  padding: 12px;
  background: white;
  border: 1px solid #e5e7eb;
  border-radius: 6px;
}

.preview-link .icon {
  width: 20px;
  height: 20px;
  color: #3b82f6;
  flex-shrink: 0;
  margin-top: 2px;
}

.preview-link__content {
  display: flex;
  flex-direction: column;
  gap: 4px;
  flex: 1;
  min-width: 0;
}

.preview-link__label {
  font-size: 0.75rem;
  font-weight: 500;
  color: #6b7280;
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.preview-link__url {
  font-family: monospace;
  font-size: 0.875rem;
  color: #111827;
  background: #f3f4f6;
  padding: 4px 8px;
  border-radius: 4px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.preview-link__provider {
  font-size: 0.75rem;
  color: #3b82f6;
  font-weight: 500;
}

.form-actions {
  display: flex;
  gap: 12px;
  justify-content: flex-end;
  padding-top: 8px;
}

.btn-secondary,
.btn-primary {
  padding: 10px 20px;
  border-radius: 6px;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;
  display: flex;
  align-items: center;
  gap: 8px;
}

.btn-secondary {
  border: 1px solid #d1d5db;
  background: white;
  color: #374151;
}

.btn-secondary:hover:not(:disabled) {
  background: #f9fafb;
}

.btn-primary {
  background: #3b82f6;
  color: white;
  border: none;
}

.btn-primary:hover:not(:disabled) {
  background: #2563eb;
}

.btn-primary:disabled,
.btn-secondary:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

@media (max-width: 640px) {
  .lesson-links-view {
    padding: 16px;
  }

  .lesson-links-view__card {
    padding: 20px;
  }

  .form-actions {
    flex-direction: column-reverse;
  }

  .btn-secondary,
  .btn-primary {
    width: 100%;
    justify-content: center;
  }
}
</style>
