<style scoped>
.choice-group {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
}

.choice-pill {
  position: relative;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 0.35rem;
  padding: 0.4rem 0.85rem;
  border: 1px solid var(--border-color);
  border-radius: 999px;
  font-size: 0.875rem;
  cursor: pointer;
  transition: color 0.2s ease, border-color 0.2s ease, background 0.2s ease;
}

.choice-pill input {
  position: absolute;
  inset: 0;
  opacity: 0;
  pointer-events: none;
  margin: 0;
}

.privacy-section {
  display: flex;
  flex-direction: column;
  gap: var(--space-lg);
}

.privacy-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(260px, 1fr));
  gap: var(--space-lg);
}

.privacy-card {
  background: var(--surface-card);
  border: 1px solid var(--border-color);
  border-radius: var(--radius-lg);
  padding: var(--space-lg);
  box-shadow: var(--shadow-xs);
  display: flex;
  flex-direction: column;
  gap: var(--space-md);
}

.privacy-card legend,
.privacy-card-header {
  margin: 0;
  padding: 0;
  border: 0;
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.privacy-card-title {
  font: var(--font-subtitle);
  color: var(--text-primary);
}

.privacy-card-hint {
  margin: 0;
  font-size: 0.85rem;
  color: var(--text-muted);
}

.pill-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(120px, 1fr));
  gap: 0.5rem;
}

.privacy-section .choice-pill {
  justify-content: center;
  color: var(--text-secondary);
  background: var(--surface-base);
}

.privacy-section .choice-pill.is-active {
  border-color: var(--accent-primary);
  background: color-mix(in srgb, var(--accent-primary) 12%, transparent);
  color: var(--accent-primary);
}

.inline-toggle {
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
  font-size: 0.875rem;
  color: var(--text-muted);
}

.privacy-card input[type='number'],
.privacy-card input[type='text'] {
  width: 100%;
}

.span-2 {
  grid-column: span 2;
}

@media (max-width: 768px) {
  .span-2 {
    grid-column: span 1;
  }
}
</style>

<script setup lang="ts">
// TASK MF10: ProfileEditor component
import { ref, watch, computed, onBeforeUnmount } from 'vue'
import { Save } from 'lucide-vue-next'
import { getLanguageName, getLanguageOptions } from '@/config/languages'
import { useI18n } from 'vue-i18n'
import { useAuthStore } from '@/modules/auth/store/authStore'
import { resolveMediaUrl } from '@/utils/media'
import { TIMEZONES } from '@/utils/timezones'
import { debounce } from '@/utils/debounce'
import { fromApi, toApi, type TutorProfileFormModel } from '../../tutorProfileFormModel'
import { updateAvatar } from '@/api/profile'
import { notifyError, notifySuccess } from '@/utils/notify'
import CertificationsEditor from './CertificationsEditor.vue'
import type {
  FilterOptions,
  TutorProfile,
  TutorProfilePatchPayload,
  LanguageLevel,
} from '../../api/marketplace'
import type { MarketplaceValidationErrors } from '../../utils/apiErrors'

type FormState = TutorProfileFormModel & {
  newSubject: string
  newLanguageCode: string
  newLanguageLevel: LanguageLevel
}

interface Props {
  profile: TutorProfile
  saving: boolean
  filterOptions?: FilterOptions | null
  apiErrors?: MarketplaceValidationErrors | null
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

const props = defineProps<Props>()

const { t, te, locale } = useI18n()
const useNativeLanguageNames = computed(() => locale.value === 'uk')

function tr(key: string, fallback: string) {
  return te(key) ? t(key) : fallback
}

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

    notifySuccess(t('profile.messages.avatarUpdateSuccess'))
  } catch (error) {
    notifyError(t('profile.messages.avatarUpdateError'))
    throw error
  } finally {
    isAvatarUploading.value = false
  }
}

const emit = defineEmits<{
  (e: 'save', data: TutorProfilePatchPayload): void
  (e: 'publish'): void
  (e: 'unpublish'): void
}>()

function handlePublishToggle(event: Event) {
  const input = event.target as HTMLInputElement | null
  if (!input) return
  if (input.checked) {
    emit('publish')
  } else {
    emit('unpublish')
  }
}

const formData = ref<FormState>({
  ...fromApi(props.profile),
  newSubject: '',
  newLanguageCode: '',
  newLanguageLevel: 'fluent' as LanguageLevel,
})

const draftKey = computed(() => {
  const id = props.profile?.id
  const suffix = typeof id === 'number' ? String(id) : 'new'
  return `marketplace:profile:draft:${suffix}`
})

type LocalDraft = {
  savedAt: number
  data: TutorProfilePatchPayload
}

const autosaveStatus = ref<'idle' | 'saving' | 'saved' | 'restored'>('idle')
const lastAutosavedAt = ref<number | null>(null)
const hasLocalDraft = ref(false)
const showDraftBanner = ref(false)

type EditorStepId = 'photo' | 'basic' | 'subjects' | 'pricing' | 'video' | 'privacy' | 'publish'

const steps = computed<Array<{ id: EditorStepId; title: string }>>(() => [
  { id: 'photo', title: t('marketplace.profile.editor.photoTitle') },
  { id: 'basic', title: t('marketplace.profile.editor.basicTitle') },
  { id: 'subjects', title: t('marketplace.profile.editor.subjectsLanguagesTitle') },
  { id: 'pricing', title: t('marketplace.profile.editor.pricingTitle') },
  { id: 'video', title: t('marketplace.profile.editor.videoTitle') },
  { id: 'privacy', title: t('marketplace.profile.editor.privacyTitle') },
  { id: 'publish', title: t('marketplace.profile.publish') },
])

const stepIndex = ref(0)
const currentStep = computed<EditorStepId>(() => steps.value[Math.min(stepIndex.value, steps.value.length - 1)]?.id || 'basic')
const isFirstStep = computed(() => stepIndex.value <= 0)
const isLastStep = computed(() => stepIndex.value >= steps.value.length - 1)

const stepErrors = computed(() => {
  const e = errors.value
  const next: Record<EditorStepId, string[]> = {
    photo: [],
    basic: ['headline', 'bio'],
    subjects: ['subjects', 'languages'],
    pricing: ['hourly_rate'],
    video: [],
    privacy: [],
    publish: [],
  }

  const out: Record<EditorStepId, number> = {
    photo: 0,
    basic: 0,
    subjects: 0,
    pricing: 0,
    video: 0,
    privacy: 0,
    publish: 0,
  }

  for (const [step, fields] of Object.entries(next) as Array<[EditorStepId, string[]]>) {
    out[step] = fields.reduce((acc, f) => (e[f] ? acc + 1 : acc), 0)
  }

  return out
})

const canGoNext = computed(() => {
  const count = stepErrors.value[currentStep.value] || 0
  return count === 0
})

function goPrev() {
  if (isFirstStep.value) return
  stepIndex.value -= 1
}

function goNext() {
  if (isLastStep.value) return
  if (!canGoNext.value) return
  stepIndex.value += 1
}

function buildPayloadFromForm(): TutorProfilePatchPayload {
  const { newSubject, newLanguageCode, newLanguageLevel, ...model } = formData.value
  return toApi(model)
}

function readLocalDraft(): LocalDraft | null {
  try {
    const raw = localStorage.getItem(draftKey.value)
    if (!raw) return null
    const parsed = JSON.parse(raw) as LocalDraft
    if (!parsed || typeof parsed !== 'object') return null
    if (typeof parsed.savedAt !== 'number' || !parsed.data || typeof parsed.data !== 'object') return null
    return parsed
  } catch (_err) {
    return null
  }
}

function writeLocalDraft(payload: TutorProfilePatchPayload): void {
  try {
    const draft: LocalDraft = { savedAt: Date.now(), data: payload }
    localStorage.setItem(draftKey.value, JSON.stringify(draft))
    hasLocalDraft.value = true
    lastAutosavedAt.value = draft.savedAt
  } catch (_err) {
    // ignore localStorage errors
  }
}

function clearLocalDraft(): void {
  try {
    localStorage.removeItem(draftKey.value)
  } catch (_err) {
    // ignore
  }
  hasLocalDraft.value = false
  showDraftBanner.value = false
}

function restoreLocalDraft(): void {
  const draft = readLocalDraft()
  if (!draft) {
    clearLocalDraft()
    return
  }
  const model = fromApi({ ...(props.profile as any), ...(draft.data as any) })
  formData.value = {
    ...(model as any),
    newSubject: '',
    newLanguageCode: '',
    newLanguageLevel: 'fluent' as LanguageLevel,
  }
  autosaveStatus.value = 'restored'
  showDraftBanner.value = false
}

function discardLocalDraft(): void {
  clearLocalDraft()
  autosaveStatus.value = 'idle'
}

const debouncedAutosave = debounce(() => {
  if (props.saving) return
  autosaveStatus.value = 'saving'
  const payload = buildPayloadFromForm()
  writeLocalDraft(payload)
  autosaveStatus.value = 'saved'
}, 800) as ((...args: any[]) => void) & { cancel?: () => void }

onBeforeUnmount(() => {
  debouncedAutosave.cancel?.()
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

    const draft = readLocalDraft()
    if (draft) {
      hasLocalDraft.value = true
      lastAutosavedAt.value = draft.savedAt
      showDraftBanner.value = true
    } else {
      hasLocalDraft.value = false
      showDraftBanner.value = false
      lastAutosavedAt.value = null
    }
  }
)

watch(
  formData,
  () => {
    debouncedAutosave()
  },
  { deep: true }
)

watch(
  () => props.saving,
  (next, prev) => {
    if (prev && !next) {
      clearLocalDraft()
      autosaveStatus.value = 'idle'
      lastAutosavedAt.value = null
    }
  }
)

function handleSubmit() {
  if (!canSubmit.value) return
  const { newSubject, newLanguageCode, newLanguageLevel, ...model } = formData.value
  emit('save', toApi(model))
}

const currencies = ['USD', 'EUR', 'GBP', 'UAH', 'PLN']

const localErrors = computed(() => {
  const next: Record<string, string> = {}
  if (!formData.value.headline || formData.value.headline.trim().length < 3) {
    next.headline = t('marketplace.profile.editor.validation.headline')
  }
  if (!formData.value.bio || formData.value.bio.trim().length < 10) {
    next.bio = t('marketplace.profile.editor.validation.bio')
  }
  if (typeof formData.value.hourly_rate !== 'number' || formData.value.hourly_rate <= 0) {
    next.hourly_rate = t('marketplace.profile.editor.validation.hourlyRate')
  }
  if (!Array.isArray(formData.value.subjects) || formData.value.subjects.length === 0) {
    next.subjects = t('marketplace.profile.editor.validation.subjects')
  }
  if (!Array.isArray(formData.value.languages) || formData.value.languages.length === 0) {
    next.languages = t('marketplace.profile.editor.validation.languages')
  }
  return next
})

const errors = computed(() => {
  const next: Record<string, string> = { ...localErrors.value }
  const api = props.apiErrors
  if (api && typeof api === 'object') {
    for (const [field, messages] of Object.entries(api)) {
      if (!field) continue
      const text = Array.isArray(messages) ? messages.filter(Boolean).join(', ') : String(messages)
      if (text.trim().length > 0) next[field] = text
    }
  }
  return next
})

const canSubmit = computed(() => Object.keys(errors.value).length === 0)

const FALLBACK_SUBJECT_CODES = [
  'english',
  'spanish',
  'french',
  'german',
  'ukrainian',
  'polish',
  'chinese',
  'japanese',
  'mathematics',
  'physics',
  'chemistry',
  'biology',
  'computer-science',
  'business-english',
  'marketing',
  'finance',
  'management',
  'piano',
  'guitar',
  'drawing',
  'photography',
  'ielts',
  'toefl',
  'sat',
  'gre',
] as const

const fallbackSubjectOptions = computed(() =>
  FALLBACK_SUBJECT_CODES.map((code) => ({
    value: code,
    label: t(`marketplace.subjects.${code}`),
  }))
)

const subjectOptions = computed(() => {
  const opts = props.filterOptions?.subjects
  if (Array.isArray(opts) && opts.length > 0) {
    return opts.map((o) => ({ value: o.value, label: o.label }))
  }
  return fallbackSubjectOptions.value
})

const FALLBACK_COUNTRIES = [
  { value: 'UA', labelKey: 'ukraine' },
  { value: 'PL', labelKey: 'poland' },
  { value: 'DE', labelKey: 'germany' },
  { value: 'ES', labelKey: 'spain' },
  { value: 'FR', labelKey: 'france' },
  { value: 'IT', labelKey: 'italy' },
  { value: 'GB', labelKey: 'unitedKingdom' },
  { value: 'US', labelKey: 'unitedStates' },
  { value: 'CA', labelKey: 'canada' },
  { value: 'AU', labelKey: 'australia' },
  { value: 'TR', labelKey: 'turkey' },
  { value: 'IN', labelKey: 'india' },
  { value: 'CN', labelKey: 'china' },
  { value: 'BR', labelKey: 'brazil' },
  { value: 'CZ', labelKey: 'czechia' },
  { value: 'SK', labelKey: 'slovakia' },
  { value: 'RO', labelKey: 'romania' },
  { value: 'HU', labelKey: 'hungary' },
] as const

const fallbackCountryOptions = computed(() =>
  FALLBACK_COUNTRIES.map((country) => ({
    value: country.value,
    label: t(`marketplace.countries.${country.labelKey}`),
  }))
)

const countryOptions = computed(() => {
  const opts = props.filterOptions?.countries
  if (Array.isArray(opts) && opts.length > 0) {
    return opts.map((o) => ({ value: o.value, label: o.label }))
  }
  return fallbackCountryOptions.value
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

const genderOptions = computed(() => [
  { value: 'female', label: t('marketplace.profile.editor.genderOptions.female') },
  { value: 'male', label: t('marketplace.profile.editor.genderOptions.male') },
  { value: 'other', label: t('marketplace.profile.editor.genderOptions.other') },
  { value: '', label: t('marketplace.profile.editor.genderOptions.unspecified') },
])

const publishMissingItems = computed(() => {
  const items: string[] = []

  if (!avatarUrl.value) {
    items.push(t('marketplace.profile.editor.photoTitle'))
  }

  if (localErrors.value.headline) {
    items.push(t('marketplace.profile.editor.headlineLabel'))
  }

  if (localErrors.value.bio) {
    items.push(t('marketplace.profile.editor.bioLabel'))
  }

  if (localErrors.value.subjects) {
    items.push(t('marketplace.profile.editor.subjectsLabel'))
  }

  if (localErrors.value.languages) {
    items.push(t('marketplace.profile.editor.languagesLabel'))
  }

  if (localErrors.value.hourly_rate) {
    items.push(t('marketplace.profile.editor.hourlyRateLabel'))
  }

  return items
})
</script>

<template>
  <form class="profile-editor" data-test="marketplace-editor-form" @submit.prevent="handleSubmit">
    <div v-if="showDraftBanner" class="draft-banner" data-test="marketplace-editor-draft-banner">
      <div class="draft-banner-text">
        {{ t('profile.draft.foundTitle') }}
      </div>
      <div class="draft-banner-actions">
        <button type="button" class="btn btn-secondary" @click="restoreLocalDraft">
          {{ t('profile.draft.restore') }}
        </button>
        <button type="button" class="btn btn-ghost" @click="discardLocalDraft">
          {{ t('profile.draft.discard') }}
        </button>
      </div>
    </div>

    <nav class="editor-steps" data-test="marketplace-editor-steps">
      <button
        v-for="(s, idx) in steps"
        :key="s.id"
        type="button"
        class="step-pill"
        :class="{ 'is-active': idx === stepIndex, 'has-errors': (stepErrors[s.id] || 0) > 0 }"
        :disabled="idx > stepIndex && !canGoNext"
        @click="() => { if (idx <= stepIndex || canGoNext) stepIndex = idx }"
      >
        <span class="step-pill-title">{{ s.title }}</span>
      </button>
    </nav>

    <section v-show="currentStep === 'publish'" class="editor-section">
      <h2>{{ t('marketplace.profile.publish') }}</h2>

      <div v-if="publishMissingItems.length" class="incomplete-banner" data-test="marketplace-editor-incomplete">
        <strong>{{ t('marketplace.profile.incompleteTitle') }}</strong>
        <p class="hint">{{ t('marketplace.profile.incompleteDescription') }}</p>
        <ul class="incomplete-list">
          <li v-for="item in publishMissingItems" :key="item">{{ item }}</li>
        </ul>
      </div>

      <div class="form-group">
        <label class="inline-toggle">
          <input
            type="checkbox"
            :checked="Boolean(profile.is_public)"
            :disabled="saving || profile.status !== 'approved'"
            data-test="marketplace-editor-publish-toggle"
            @change="handlePublishToggle"
          />
          {{ profile.is_public ? t('marketplace.profile.unpublish') : t('marketplace.profile.publish') }}
        </label>
        <p v-if="profile.status !== 'approved'" class="hint">
          {{ t('marketplace.profile.status.pending_review') }}
        </p>
      </div>
    </section>

    <section v-show="currentStep === 'photo'" class="editor-section">
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
          {{ isAvatarUploading ? t('profile.avatar.uploading') : t('profile.avatar.update') }}
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

    <section v-show="currentStep === 'privacy'" class="editor-section privacy-section">
      <h2>{{ t('marketplace.profile.editor.privacyTitle') }}</h2>

      <div class="privacy-grid">
        <fieldset class="privacy-card span-2">
          <legend class="privacy-card-header">
            <span class="privacy-card-title">{{ t('marketplace.profile.editor.genderLabel') }}</span>
            <p class="privacy-card-hint">{{ t('marketplace.profile.editor.genderPlaceholder') }}</p>
          </legend>
          <div class="choice-group pill-grid" data-test="marketplace-editor-gender">
            <label
              v-for="option in genderOptions"
              :key="option.value"
              :class="['choice-pill', { 'is-active': formData.gender === option.value }]"
            >
              <input v-model="formData.gender" type="radio" :value="option.value" />
              <span>{{ option.label }}</span>
            </label>
          </div>
          <label class="inline-toggle">
            <input v-model="formData.show_gender" type="checkbox" data-test="marketplace-editor-show-gender" />
            {{ t('marketplace.profile.editor.showGender') }}
          </label>
        </fieldset>

        <div class="privacy-card">
          <div class="privacy-card-header">
            <span class="privacy-card-title">{{ t('marketplace.profile.editor.birthYearLabel') }}</span>
            <p class="privacy-card-hint">{{ t('marketplace.profile.editor.birthYearPlaceholder') }}</p>
          </div>
          <input
            id="birth_year"
            v-model.number="formData.birth_year"
            type="number"
            min="1900"
            max="2100"
            :placeholder="t('marketplace.profile.editor.birthYearPlaceholder')"
            data-test="marketplace-editor-birth-year"
          />
          <label class="inline-toggle">
            <input v-model="formData.show_age" type="checkbox" data-test="marketplace-editor-show-age" />
            {{ t('marketplace.profile.editor.showAge') }}
          </label>
        </div>

        <div class="privacy-card">
          <div class="privacy-card-header">
            <span class="privacy-card-title">{{ t('marketplace.profile.editor.telegramLabel') }}</span>
            <p class="privacy-card-hint">{{ t('marketplace.profile.editor.telegramPlaceholder') }}</p>
          </div>
          <input
            id="telegram"
            v-model="formData.telegram_username"
            type="text"
            :placeholder="t('marketplace.profile.editor.telegramPlaceholder')"
            data-test="marketplace-editor-telegram"
          />
          <label class="inline-toggle">
            <input v-model="formData.show_telegram" type="checkbox" data-test="marketplace-editor-show-telegram" />
            {{ t('marketplace.profile.editor.showTelegram') }}
          </label>
        </div>

        <div class="privacy-card span-2">
          <div class="privacy-card-header">
            <span class="privacy-card-title">{{ t('marketplace.profile.editor.certificationsTitle') }}</span>
          </div>
          <CertificationsEditor />
        </div>
      </div>
    </section>

    <section v-show="currentStep === 'basic'" class="editor-section">
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

    <section v-show="currentStep === 'subjects'" class="editor-section">
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

    <section v-show="currentStep === 'pricing'" class="editor-section">
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

    <section v-show="currentStep === 'video'" class="editor-section">
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
      <button type="button" class="btn btn-secondary" :disabled="isFirstStep" @click="goPrev">
        {{ t('common.back') }}
      </button>

      <button type="button" class="btn btn-secondary" :disabled="isLastStep || !canGoNext" @click="goNext">
        {{ t('common.next') }}
      </button>

      <button
        v-if="isLastStep"
        type="submit"
        class="btn btn-primary"
        :disabled="saving || !canSubmit"
        data-test="marketplace-editor-save"
      >
        <Save :size="18" />
        {{ saving ? t('marketplace.profile.editor.saving') : t('marketplace.profile.editor.save') }}
      </button>

      <span v-if="lastAutosavedAt" class="autosave-status" data-test="marketplace-editor-autosave-status">
        {{ t('profile.autosave.savedAt', { time: new Date(lastAutosavedAt).toLocaleTimeString() }) }}
      </span>
    </div>
  </form>
</template>

<style scoped>
.profile-editor {
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
}

.draft-banner {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  padding: 0.75rem 1rem;
  border: 1px solid var(--border-color);
  border-radius: var(--radius-lg);
  background: var(--surface-card);
  box-shadow: var(--shadow-xs);
}

.draft-banner-actions {
  display: flex;
  gap: 0.5rem;
}

.autosave-status {
  margin-left: auto;
  font-size: 0.85rem;
  color: var(--text-muted);
}

.editor-steps {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
}

.step-pill {
  border: 1px solid var(--border-color);
  background: var(--surface-card);
  color: var(--text-secondary);
  border-radius: 999px;
  padding: 0.35rem 0.75rem;
  font-size: 0.85rem;
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
}

.step-pill.is-active {
  border-color: var(--accent-primary);
  color: var(--accent-primary);
  background: color-mix(in srgb, var(--accent-primary) 10%, transparent);
}

.step-pill.has-errors {
  border-color: color-mix(in srgb, var(--danger) 70%, var(--border-color));
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
  border-radius: var(--radius-lg);
  object-fit: cover;
  border: 1px solid var(--border-color);
}

.photo-placeholder {
  width: 96px;
  height: 96px;
  border-radius: var(--radius-lg);
  background: var(--surface-card-muted);
  border: 1px solid var(--border-color);
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--text-muted);
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
  background: var(--surface-card);
  border-radius: var(--radius-lg);
  padding: var(--space-xl);
  box-shadow: var(--shadow-sm);
}

.editor-section h2 {
  font-size: 1.125rem;
  font-weight: 600;
  margin: 0 0 1.25rem;
  color: var(--text-primary);
}

.incomplete-banner {
  margin-bottom: 1rem;
  padding: 0.75rem 1rem;
  border: 1px solid var(--border-color);
  border-radius: var(--radius-lg);
  background: var(--surface-base);
}

.incomplete-list {
  margin: 0.5rem 0 0;
  padding-left: 1.25rem;
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
  color: var(--text-secondary);
  margin-bottom: 0.375rem;
}

.form-group input,
.form-group textarea,
.form-group select {
  width: 100%;
  padding: 0.625rem 0.875rem;
  border: 1px solid var(--border-color);
  border-radius: 8px;
  font-size: 0.9375rem;
  transition: border-color 0.2s, box-shadow 0.2s;
}

.form-group input:focus,
.form-group textarea:focus,
.form-group select:focus {
  outline: none;
  border-color: var(--accent-primary);
  box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
}

.form-group textarea {
  resize: vertical;
  min-height: 120px;
}

.hint {
  display: block;
  font-size: 0.75rem;
  color: var(--text-muted);
  margin-top: 0.25rem;
}

.field-error {
  margin-top: 0.25rem;
  font-size: 0.75rem;
  color: color-mix(in srgb, var(--danger-bg) 72%, var(--text-primary));
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
  background: var(--surface-card-muted);
  border: 1px solid var(--border-color);
  border-radius: 8px;
}

.item-label {
  font-size: 0.875rem;
  color: var(--text-primary);
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
</style>
