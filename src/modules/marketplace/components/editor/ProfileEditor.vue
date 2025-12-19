<script setup lang="ts">
// TASK MF10: ProfileEditor component
import { ref, watch, computed } from 'vue'
import { Save } from 'lucide-vue-next'
import { getLanguageName, getLanguageOptions } from '@/config/languages'
import { useI18n } from 'vue-i18n'
import { useAuthStore } from '@/modules/auth/store/authStore'
import { resolveMediaUrl } from '@/utils/media'
import { TIMEZONES } from '@/utils/timezones'
import { fromApi, toApi, type TutorProfileFormModel } from '../../tutorProfileFormModel'
import { updateAvatar } from '@/api/profile'
import { notifyError, notifySuccess } from '@/utils/notify'
import type {
  FilterOptions,
  TutorProfile,
  TutorProfilePatchPayload,
  LanguageLevel,
} from '../../api/marketplace'

type FormState = TutorProfileFormModel & {
  newSubject: string
  newLanguageCode: string
  newLanguageLevel: LanguageLevel
}

interface Props {
  profile: TutorProfile
  saving: boolean
  filterOptions?: FilterOptions | null
}

function addSubject() {
  const code = (formData.value.newSubject || '').trim()
  if (!code) return
  if (!formData.value.subjects.includes(code)) {
    formData.value.subjects = [...formData.value.subjects, code]
  }
  formData.value.newSubject = ''
}

function removeSubject(code: string) {
  formData.value.subjects = formData.value.subjects.filter((x) => x !== code)
}

function addLanguage() {
  const code = (formData.value.newLanguageCode || '').trim()
  const level = formData.value.newLanguageLevel
  if (!code) return
  if (formData.value.languages.some((l) => l.code === code)) return
  formData.value.languages = [...formData.value.languages, { code, level }]
  formData.value.newLanguageCode = ''
}

function removeLanguage(code: string) {
  formData.value.languages = formData.value.languages.filter((l) => l.code !== code)
}

function addCertification() {
  formData.value.certifications = [
    ...(formData.value.certifications || []),
    { name: '', issuer: '', is_public: true },
  ]
}

function removeCertification(index: number) {
  formData.value.certifications = (formData.value.certifications || []).filter((_, i) => i !== index)
}

const props = defineProps<Props>()

const { t, locale } = useI18n()
const useNativeLanguageNames = computed(() => locale.value === 'uk')

const auth = useAuthStore()

const isAvatarUploading = ref(false)

const avatarUrl = computed(() => {
  const value = auth.user?.avatar_url || props.profile?.user?.avatar_url || ''
  return value ? resolveMediaUrl(value) : ''
})

async function handleAvatarSelected(e: Event) {
  const input = e.target as HTMLInputElement
  const file = input.files?.[0]
  input.value = ''
  if (!file || isAvatarUploading.value) return

  isAvatarUploading.value = true
  try {
    const formData = new FormData()
    formData.append('avatar', file)
    const data = (await updateAvatar(formData)) as any
    const avatarUrl = data?.avatar_url ? resolveMediaUrl(data.avatar_url) : null

    if (auth.user) {
      auth.setAuth({ user: { ...auth.user, avatar_url: avatarUrl } })
    }

    notifySuccess(t('profile.messages.avatarUpdateSuccess') || 'Фото оновлено')
  } catch (error) {
    notifyError(t('profile.messages.avatarUpdateError') || 'Не вдалося оновити фото')
    throw error
  } finally {
    isAvatarUploading.value = false
  }
}

const emit = defineEmits<{
  (e: 'save', data: TutorProfilePatchPayload): void
}>()

const formData = ref<FormState>({
  ...fromApi(props.profile),
  newSubject: '',
  newLanguageCode: '',
  newLanguageLevel: 'fluent' as LanguageLevel,
})

watch(
  () => props.profile,
  (newProfile) => {
    formData.value = {
      ...fromApi(newProfile),
      newSubject: '',
      newLanguageCode: '',
      newLanguageLevel: 'fluent' as LanguageLevel,
    }
  }
)

function handleSubmit() {
  if (!canSubmit.value) return
  const { newSubject, newLanguageCode, newLanguageLevel, ...model } = formData.value
  emit('save', toApi(model))
}

const currencies = ['USD', 'EUR', 'GBP', 'UAH', 'PLN']

const errors = computed(() => {
  const next: Record<string, string> = {}
  if (!formData.value.headline || formData.value.headline.trim().length < 3) {
    next.headline = 'Headline is required (min 3 characters).'
  }
  if (!formData.value.bio || formData.value.bio.trim().length < 10) {
    next.bio = 'Bio is required (min 10 characters).'
  }
  if (typeof formData.value.hourly_rate !== 'number' || formData.value.hourly_rate <= 0) {
    next.hourly_rate = 'Hourly rate must be greater than 0.'
  }
  if (!Array.isArray(formData.value.subjects) || formData.value.subjects.length === 0) {
    next.subjects = 'Select at least one subject.'
  }
  if (!Array.isArray(formData.value.languages) || formData.value.languages.length === 0) {
    next.languages = 'Select at least one language.'
  }
  return next
})

const canSubmit = computed(() => Object.keys(errors.value).length === 0)

const subjectOptions = computed(() => {
  const opts = props.filterOptions?.subjects || []
  return opts.map((o) => ({ value: o.value, label: o.label }))
})

const countryOptions = computed(() => {
  const opts = props.filterOptions?.countries || []
  return opts.map((o) => ({ value: o.value, label: o.label }))
})

const timezoneOptions = TIMEZONES

function getSubjectLabel(code: string): string {
  const found = subjectOptions.value.find((o) => o.value === code)
  return found?.label || code
}

const languageOptions = computed(() => {
  return getLanguageOptions(useNativeLanguageNames.value)
})

const languageLevels = computed<Array<{ value: LanguageLevel; label: string }>>(() => [
  { value: 'basic', label: t('marketplace.profile.editor.languageLevels.basic') },
  { value: 'conversational', label: t('marketplace.profile.editor.languageLevels.conversational') },
  { value: 'fluent', label: t('marketplace.profile.editor.languageLevels.fluent') },
  { value: 'native', label: t('marketplace.profile.editor.languageLevels.native') },
])
</script>

<template>
  <form class="profile-editor" data-test="marketplace-editor-form" @submit.prevent="handleSubmit">
    <section class="editor-section">
      <h2>{{ t('marketplace.profile.editor.photoTitle') }}</h2>

      <div class="photo-row">
        <img
          v-if="avatarUrl"
          :src="avatarUrl"
          alt="Profile photo"
          class="photo-preview"
          data-test="marketplace-editor-photo-preview"
        />
        <div v-else class="photo-placeholder" data-test="marketplace-editor-photo-empty">
          {{ t('marketplace.profile.editor.noPhoto') }}
        </div>

        <label class="btn btn-secondary photo-upload" :class="{ disabled: saving || isAvatarUploading }">
          {{ isAvatarUploading ? (t('profile.avatar.uploading') || 'Оновлюємо…') : (t('profile.avatar.update') || 'Оновити фото') }}
          <input
            type="file"
            accept="image/*"
            class="file-input"
            :disabled="saving || isAvatarUploading"
            data-test="marketplace-editor-avatar-input"
            @change="handleAvatarSelected"
          />
        </label>
      </div>
    </section>

    <section class="editor-section">
      <h2>{{ t('marketplace.profile.editor.privacyTitle') }}</h2>

      <div class="form-row">
        <div class="form-group">
          <label for="gender">{{ t('marketplace.profile.editor.genderLabel') }}</label>
          <input
            id="gender"
            v-model="formData.gender"
            type="text"
            :placeholder="t('marketplace.profile.editor.genderPlaceholder')"
            data-test="marketplace-editor-gender"
          />
          <label class="checkbox-label">
            <input v-model="formData.show_gender" type="checkbox" data-test="marketplace-editor-show-gender" />
            {{ t('marketplace.profile.editor.showGender') }}
          </label>
        </div>

        <div class="form-group">
          <label for="birth_year">{{ t('marketplace.profile.editor.birthYearLabel') }}</label>
          <input
            id="birth_year"
            v-model.number="formData.birth_year"
            type="number"
            min="1900"
            max="2100"
            :placeholder="t('marketplace.profile.editor.birthYearPlaceholder')"
            data-test="marketplace-editor-birth-year"
          />
          <label class="checkbox-label">
            <input v-model="formData.show_age" type="checkbox" data-test="marketplace-editor-show-age" />
            {{ t('marketplace.profile.editor.showAge') }}
          </label>
        </div>
      </div>

      <div class="form-group">
        <label for="telegram">{{ t('marketplace.profile.editor.telegramLabel') }}</label>
        <input
          id="telegram"
          v-model="formData.telegram_username"
          type="text"
          :placeholder="t('marketplace.profile.editor.telegramPlaceholder')"
          data-test="marketplace-editor-telegram"
        />
        <label class="checkbox-label">
          <input v-model="formData.show_telegram" type="checkbox" data-test="marketplace-editor-show-telegram" />
          {{ t('marketplace.profile.editor.showTelegram') }}
        </label>
      </div>

      <div class="form-group">
        <label>{{ t('marketplace.profile.editor.certificationsTitle') }}</label>

        <div class="list-editor" data-test="marketplace-editor-certifications">
          <div v-if="formData.certifications.length" class="list-items">
            <div
              v-for="(c, idx) in formData.certifications"
              :key="idx"
              class="list-item certification-item"
              data-test="marketplace-editor-certification-item"
            >
              <div class="cert-fields">
                <input
                  v-model="c.name"
                  type="text"
                  :placeholder="t('marketplace.profile.editor.certificationNamePlaceholder')"
                  data-test="marketplace-editor-certification-name"
                />
                <input
                  v-model="c.issuer"
                  type="text"
                  :placeholder="t('marketplace.profile.editor.certificationIssuerPlaceholder')"
                  data-test="marketplace-editor-certification-issuer"
                />
              </div>

              <label class="checkbox-label">
                <input v-model="c.is_public" type="checkbox" data-test="marketplace-editor-certification-public" />
                {{ t('marketplace.profile.editor.certificationPublic') }}
              </label>

              <button type="button" class="btn btn-ghost" @click="removeCertification(idx)">
                {{ t('marketplace.profile.editor.remove') }}
              </button>
            </div>
          </div>

          <button type="button" class="btn btn-secondary" @click="addCertification">
            {{ t('marketplace.profile.editor.addCertification') }}
          </button>
        </div>
      </div>
    </section>

    <section class="editor-section">
      <h2>{{ t('marketplace.profile.editor.basicTitle') }}</h2>

      <div class="form-group">
        <label for="headline">{{ t('marketplace.profile.editor.headlineLabel') }}</label>
        <input
          id="headline"
          v-model="formData.headline"
          type="text"
          :placeholder="t('marketplace.profile.editor.headlinePlaceholder')"
          maxlength="100"
          data-test="marketplace-editor-headline"
        />
        <span class="hint">{{ t('marketplace.profile.editor.headlineHint') }}</span>
        <div v-if="errors.headline" class="field-error" data-test="marketplace-editor-error-headline">
          {{ errors.headline }}
        </div>
      </div>

      <div class="form-group">
        <label for="bio">{{ t('marketplace.profile.editor.bioLabel') }}</label>
        <textarea
          id="bio"
          v-model="formData.bio"
          rows="6"
          :placeholder="t('marketplace.profile.editor.bioPlaceholder')"
          data-test="marketplace-editor-bio"
        />
        <div v-if="errors.bio" class="field-error" data-test="marketplace-editor-error-bio">
          {{ errors.bio }}
        </div>
      </div>

      <div class="form-row">
        <div class="form-group">
          <label for="country">{{ t('marketplace.profile.editor.countryLabel') }}</label>
          <select id="country" v-model="formData.country" data-test="marketplace-editor-country">
            <option value="">{{ t('marketplace.profile.editor.countryPlaceholder') }}</option>
            <option v-for="o in countryOptions" :key="o.value" :value="o.value">{{ o.label }}</option>
          </select>
        </div>

        <div class="form-group">
          <label for="timezone">{{ t('marketplace.profile.editor.timezoneLabel') }}</label>
          <select id="timezone" v-model="formData.timezone" data-test="marketplace-editor-timezone">
            <option value="">{{ t('marketplace.profile.editor.timezonePlaceholder') }}</option>
            <option v-for="o in timezoneOptions" :key="o.value" :value="o.value">{{ o.label }}</option>
          </select>
        </div>
      </div>
    </section>

    <section class="editor-section">
      <h2>{{ t('marketplace.profile.editor.subjectsLanguagesTitle') }}</h2>

      <div class="form-row">
        <div class="form-group">
          <label>{{ t('marketplace.profile.editor.subjectsLabel') }}</label>

          <div class="list-editor" data-test="marketplace-editor-subjects">
            <div class="list-editor-row">
              <select v-model="formData.newSubject" data-test="marketplace-editor-subject-add">
                <option value="">{{ t('marketplace.profile.editor.selectSubject') }}</option>
                <option v-for="o in subjectOptions" :key="o.value" :value="o.value">
                  {{ o.label }}
                </option>
              </select>
              <button type="button" class="btn btn-secondary" :disabled="!formData.newSubject" @click="addSubject">
                {{ t('marketplace.profile.editor.add') }}
              </button>
            </div>

            <div v-if="formData.subjects.length" class="list-items">
              <div v-for="code in formData.subjects" :key="code" class="list-item" data-test="marketplace-editor-subject-item">
                <span class="item-label">{{ getSubjectLabel(code) }}</span>
                <button type="button" class="btn btn-ghost" @click="removeSubject(code)">{{ t('marketplace.profile.editor.remove') }}</button>
              </div>
            </div>
          </div>

          <div v-if="errors.subjects" class="field-error" data-test="marketplace-editor-error-subjects">
            {{ errors.subjects }}
          </div>
        </div>

        <div class="form-group">
          <label>{{ t('marketplace.profile.editor.languagesLabel') }}</label>

          <div class="list-editor" data-test="marketplace-editor-languages">
            <div class="list-editor-row">
              <select v-model="formData.newLanguageCode" data-test="marketplace-editor-language-code">
                <option value="">{{ t('marketplace.profile.editor.selectLanguage') }}</option>
                <option v-for="o in languageOptions" :key="o.value" :value="o.value">
                  {{ o.label }}
                </option>
              </select>
              <select v-model="formData.newLanguageLevel" data-test="marketplace-editor-language-level">
                <option v-for="l in languageLevels" :key="l.value" :value="l.value">{{ l.label }}</option>
              </select>
              <button
                type="button"
                class="btn btn-secondary"
                :disabled="!formData.newLanguageCode"
                @click="addLanguage"
              >
                {{ t('marketplace.profile.editor.add') }}
              </button>
            </div>

            <div v-if="formData.languages.length" class="list-items">
              <div v-for="l in formData.languages" :key="l.code" class="list-item" data-test="marketplace-editor-language-item">
                <span class="item-label">{{ getLanguageName(l.code, useNativeLanguageNames) }}</span>
                <select v-model="l.level" data-test="marketplace-editor-language-item-level">
                  <option v-for="x in languageLevels" :key="x.value" :value="x.value">{{ x.label }}</option>
                </select>
                <button type="button" class="btn btn-ghost" @click="removeLanguage(l.code)">{{ t('marketplace.profile.editor.remove') }}</button>
              </div>
            </div>
          </div>

          <div v-if="errors.languages" class="field-error" data-test="marketplace-editor-error-languages">
            {{ errors.languages }}
          </div>
        </div>
      </div>
    </section>

    <section class="editor-section">
      <h2>{{ t('marketplace.profile.editor.pricingTitle') }}</h2>

      <div class="form-row">
        <div class="form-group">
          <label for="hourly_rate">{{ t('marketplace.profile.editor.hourlyRateLabel') }}</label>
          <div class="input-with-addon">
            <input
              id="hourly_rate"
              v-model.number="formData.hourly_rate"
              type="number"
              min="0"
              step="1"
              data-test="marketplace-editor-hourly-rate"
            />
            <select v-model="formData.currency" data-test="marketplace-editor-currency">
              <option v-for="c in currencies" :key="c" :value="c">{{ c }}</option>
            </select>
          </div>
          <div v-if="errors.hourly_rate" class="field-error" data-test="marketplace-editor-error-hourly-rate">
            {{ errors.hourly_rate }}
          </div>
        </div>

        <div class="form-group">
          <label for="trial_price">{{ t('marketplace.profile.editor.trialPriceLabel') }}</label>
          <input
            id="trial_price"
            v-model.number="formData.trial_lesson_price"
            type="number"
            min="0"
            step="1"
            :placeholder="t('marketplace.profile.editor.trialPricePlaceholder')"
            data-test="marketplace-editor-trial-price"
          />
          <span class="hint">{{ t('marketplace.profile.editor.trialPriceHint') }}</span>
        </div>
      </div>
    </section>

    <section class="editor-section">
      <h2>{{ t('marketplace.profile.editor.videoTitle') }}</h2>

      <div class="form-group">
        <label for="video_url">{{ t('marketplace.profile.editor.videoUrlLabel') }}</label>
        <input
          id="video_url"
          v-model="formData.video_intro_url"
          type="url"
          :placeholder="t('marketplace.profile.editor.videoUrlPlaceholder')"
          data-test="marketplace-editor-video-url"
        />
        <span class="hint">{{ t('marketplace.profile.editor.videoHint') }}</span>
      </div>
    </section>

    <div class="editor-actions">
      <button type="submit" class="btn btn-primary" :disabled="saving || !canSubmit" data-test="marketplace-editor-save">
        <Save :size="18" />
        {{ saving ? t('marketplace.profile.editor.saving') : t('marketplace.profile.editor.save') }}
      </button>
    </div>
  </form>
</template>

<style scoped>
.profile-editor {
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
}

.photo-row {
  display: flex;
  align-items: center;
  gap: 1rem;
  flex-wrap: wrap;
}

.photo-preview {
  width: 96px;
  height: 96px;
  border-radius: 12px;
  object-fit: cover;
  border: 1px solid #e5e7eb;
}

.photo-placeholder {
  width: 96px;
  height: 96px;
  border-radius: 12px;
  background: #f3f4f6;
  border: 1px solid #e5e7eb;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #6b7280;
  font-size: 0.875rem;
}

.photo-upload {
  position: relative;
  overflow: hidden;
}

.file-input {
  position: absolute;
  inset: 0;
  opacity: 0;
  cursor: pointer;
}

.photo-upload.disabled {
  opacity: 0.6;
  pointer-events: none;
}

.editor-section {
  background: white;
  border-radius: 12px;
  padding: 1.5rem;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
}

.editor-section h2 {
  font-size: 1.125rem;
  font-weight: 600;
  margin: 0 0 1.25rem;
  color: #111827;
}

.form-group {
  margin-bottom: 1rem;
}

.form-group:last-child {
  margin-bottom: 0;
}

.form-group label {
  display: block;
  font-size: 0.875rem;
  font-weight: 500;
  color: #374151;
  margin-bottom: 0.375rem;
}

.form-group input,
.form-group textarea,
.form-group select {
  width: 100%;
  padding: 0.625rem 0.875rem;
  border: 1px solid #d1d5db;
  border-radius: 8px;
  font-size: 0.9375rem;
  transition: border-color 0.2s, box-shadow 0.2s;
}

.form-group input:focus,
.form-group textarea:focus,
.form-group select:focus {
  outline: none;
  border-color: #3b82f6;
  box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
}

.form-group textarea {
  resize: vertical;
  min-height: 120px;
}

.hint {
  display: block;
  font-size: 0.75rem;
  color: #6b7280;
  margin-top: 0.25rem;
}

.field-error {
  margin-top: 0.25rem;
  font-size: 0.75rem;
  color: #b91c1c;
}

.list-editor {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.list-editor-row {
  display: grid;
  grid-template-columns: 1fr 1fr auto;
  gap: 0.5rem;
  align-items: center;
}

.list-items {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.list-item {
  display: grid;
  grid-template-columns: 1fr auto auto;
  gap: 0.5rem;
  align-items: center;
  padding: 0.5rem;
  background: #f9fafb;
  border: 1px solid #e5e7eb;
  border-radius: 8px;
}

.item-label {
  font-size: 0.875rem;
  color: #111827;
}

.form-row {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 1rem;
}

@media (max-width: 640px) {
  .form-row {
    grid-template-columns: 1fr;
  }
}

.input-with-addon {
  display: flex;
  gap: 0.5rem;
}

.input-with-addon input {
  flex: 1;
}

.input-with-addon select {
  width: auto;
}

.editor-actions {
  display: flex;
  justify-content: flex-end;
  padding-top: 1rem;
}

.btn {
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.75rem 1.5rem;
  border: none;
  border-radius: 8px;
  font-size: 0.9375rem;
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

.btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}
</style>
