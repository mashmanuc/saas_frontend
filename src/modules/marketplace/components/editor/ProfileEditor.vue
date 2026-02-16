<style scoped>
.choice-group {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
}

/* Chip стилі — використовуються глобальні .chip з main.css */
/* Додаткове: приховуємо radio input всередині chip-label */
.chip input[type="radio"],
.chip input[type="checkbox"] {
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

.privacy-section .chip {
  justify-content: center;
}

.privacy-section .chip.is-active {
  /* Для privacy pill використовуємо м'який accent замість повного заливу */
  border-color: var(--accent, #047857);
  background: color-mix(in srgb, var(--accent, #047857) 12%, var(--card-bg, #fff));
  color: var(--accent, #047857);
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
import { buildTutorProfileUpdate, validateProfileBeforeSubmit, debugPayload } from '../../adapters/profileAdapter'
import { updateAvatar } from '@/api/profile'
import { notifyError, notifySuccess } from '@/utils/notify'
import CertificationsEditor from './CertificationsEditor.vue'
import SubjectTagsSelector from './SubjectTagsSelector.vue'
import SubjectsTab from './SubjectsTab.vue'
import TeachingLanguagesTab from './TeachingLanguagesTab.vue'
import { useRouter, useRoute } from 'vue-router'
import LessonLinksEditor from '@/modules/booking/components/lessonLinks/LessonLinksEditor.vue'
import { useLanguagesCatalog } from '../../composables/useLanguagesCatalog'
import { useCatalog } from '../../composables/useCatalog'
import CityAutocomplete from '@/components/geo/CityAutocomplete.vue'
import CityPrivacyToggle from '@/components/geo/CityPrivacyToggle.vue'
import type { SpecialtyTagCatalog } from '../../api/marketplace'
import type { LanguageTag } from '../../api/languages'
import { onMounted } from 'vue'
import type {
  FilterOptions,
  TutorProfileFull,
  TutorProfilePatchPayload,
  LanguageLevel,
} from '../../api/marketplace'
import type { MarketplaceValidationErrors } from '../../utils/apiErrors'
import { mapValidationErrors, type NestedError } from '../../utils/nestedErrorMapper'

type FormState = TutorProfileFormModel & {
  newLanguageCode: string
  newLanguageLevel: LanguageLevel
  languages: Array<{
    code: string
    level: LanguageLevel
    tags?: string[]
    description?: string
  }>
}

interface Props {
  profile: TutorProfileFull
  saving: boolean
  filterOptions?: FilterOptions | null
  apiErrors?: MarketplaceValidationErrors | null
}

// v0.60: Subject management moved to SubjectTagsSelector component

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

// v0.84.0: Teaching languages management
const newTeachingLanguageCode = ref('')
const newTeachingLanguageLevel = ref<LanguageLevel>('fluent')

function addTeachingLanguage() {
  const code = newTeachingLanguageCode.value.trim()
  const level = newTeachingLanguageLevel.value
  if (!code) return
  if (formData.value.teaching_languages.some((l) => l.code === code)) return
  formData.value.teaching_languages = [...formData.value.teaching_languages, { code, level }]
  newTeachingLanguageCode.value = ''
  if (import.meta.env.DEV) {
    console.debug('[ProfileEditor] teaching_languages.add', {
      added: { code, level },
      total: formData.value.teaching_languages.length,
      teaching_languages: formData.value.teaching_languages,
    })
  }
  // Mark field as touched so validation can show if needed
  markFieldAsTouched('teaching_languages')
}

function removeTeachingLanguage(code: string) {
  formData.value.teaching_languages = formData.value.teaching_languages.filter((l) => l.code !== code)
  // Mark field as touched so validation can show if needed
  markFieldAsTouched('teaching_languages')
}

const props = defineProps<Props>()

const { t, te, locale } = useI18n()
const router = useRouter()
const route = useRoute()
const useNativeLanguageNames = computed(() => locale.value === 'uk')

function tr(key: string, fallback: string) {
  return te(key) ? t(key) : fallback
}

const auth = useAuthStore()

// v0.84.0: Languages catalog for new UX
const languagesCatalog = useLanguagesCatalog()
const catalog = useCatalog()

onMounted(() => {
  languagesCatalog.loadCatalog()
  catalog.loadSubjects()
  catalog.loadTags()
})

watch(locale, () => {
  languagesCatalog.loadCatalog()
  catalog.loadSubjects()
  catalog.loadTags()
})

const isAvatarUploading = ref(false)

const avatarUrl = computed(() => {
  const value = auth.user?.avatar_url || props.profile?.media?.photo_url || ''
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
    
    // v0.83.0: Reload profile to update validation banner and UI
    emit('reload')
  } catch (error) {
    notifyError(t('profile.messages.avatarUpdateError'))
    throw error
  } finally {
    isAvatarUploading.value = false
  }
}

const emit = defineEmits<{
  (e: 'save', data: TutorProfilePatchPayload, options?: { silent?: boolean }): void
  (e: 'publish'): void
  (e: 'unpublish'): void
  (e: 'reload'): void
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

function syncStepFromRoute(stepParam: unknown) {
  if (typeof stepParam !== 'string') return
  const idx = steps.value.findIndex((s) => s.id === stepParam)
  if (idx >= 0) {
    stepIndex.value = idx
  }
}

const formData = ref<FormState>({
  ...fromApi(props.profile),
  newLanguageCode: '',
  newLanguageLevel: 'fluent' as LanguageLevel,
})

// v0.95.1: Touched fields tracking to prevent premature validation
const touchedFields = ref<Set<string>>(new Set())

function markFieldAsTouched(fieldName: string) {
  touchedFields.value.add(fieldName)
}

const draftKey = computed(() => {
  const slug = props.profile?.slug || 'new'
  return `marketplace:profile:draft:${slug}`
})

type LocalDraft = {
  savedAt: number
  data: TutorProfilePatchPayload
}

const autosaveStatus = ref<'idle' | 'saving' | 'saved' | 'restored'>('idle')
const lastAutosavedAt = ref<number | null>(null)
const hasLocalDraft = ref(false)
const showDraftBanner = ref(false)

type EditorStepId = 'photo' | 'basic' | 'subjects' | 'teaching-languages' | 'pricing' | 'video' | 'privacy' | 'lesson-links' | 'publish'

const steps = computed<Array<{ id: EditorStepId; title: string }>>(() => [
  { id: 'photo', title: t('marketplace.profile.editor.photoTitle') },
  { id: 'basic', title: t('marketplace.profile.editor.basicTitle') },
  { id: 'subjects', title: t('marketplace.profile.editor.subjectsTitle') },
  { id: 'teaching-languages', title: t('marketplace.profile.editor.teachingLanguagesTitle') },
  { id: 'pricing', title: t('marketplace.profile.editor.pricingTitle') },
  { id: 'video', title: t('marketplace.profile.editor.videoTitle') },
  { id: 'privacy', title: t('marketplace.profile.editor.privacyTitle') },
  { id: 'lesson-links', title: t('marketplace.profile.editor.lessonLinksTitle') },
  { id: 'publish', title: t('marketplace.profile.publish') },
])

const stepIndex = ref(0)
const currentStep = computed<EditorStepId>(() => steps.value[Math.min(stepIndex.value, steps.value.length - 1)]?.id || 'basic')
const isFirstStep = computed(() => stepIndex.value <= 0)
const isLastStep = computed(() => stepIndex.value >= steps.value.length - 1)

watch(
  () => route.query.step,
  (stepParam) => {
    syncStepFromRoute(stepParam)
  },
  { immediate: true }
)

watch(
  stepIndex,
  (idx) => {
    const stepId = steps.value[idx]?.id
    if (!stepId) return
    if (route.query.step === stepId) return
    router.replace({
      query: {
        ...route.query,
        step: stepId
      }
    })
  }
)

const stepErrors = computed(() => {
  const e = errors.value
  const next: Record<EditorStepId, string[]> = {
    photo: [],
    basic: ['headline', 'bio'],
    subjects: ['subjects'],
    'teaching-languages': ['teaching_languages'],
    pricing: ['hourly_rate'],
    video: [],
    privacy: [],
    'lesson-links': [],
    publish: [],
  }

  const out: Record<EditorStepId, number> = {
    photo: 0,
    basic: 0,
    subjects: 0,
    'teaching-languages': 0,
    pricing: 0,
    video: 0,
    privacy: 0,
    'lesson-links': 0,
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
  const { newLanguageCode, newLanguageLevel, ...model } = formData.value
  // v0.60.1: Use adapter to build strict API contract payload
  const apiPayload = buildTutorProfileUpdate(model)
  if (import.meta.env.DEV) {
    debugPayload(apiPayload, 'ProfileEditor.buildPayloadFromForm')
  }
  return apiPayload as any // Cast for compatibility with legacy TutorProfilePatchPayload type
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
    const key = draftKey.value
    const serialized = JSON.stringify(draft)
    if (import.meta.env.DEV) {
      console.log('[ProfileEditor] writeLocalDraft key:', key, 'size:', serialized.length)
    }
    localStorage.setItem(key, serialized)
    hasLocalDraft.value = true
    lastAutosavedAt.value = draft.savedAt
    if (import.meta.env.DEV) {
      const verify = localStorage.getItem(key)
      console.log('[ProfileEditor] writeLocalDraft verify:', !!verify, 'length:', verify?.length || 0)
    }
  } catch (err) {
    console.error('[ProfileEditor] writeLocalDraft error:', err)
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

const isUpdatingFromProps = ref(false)

const debouncedAutosave = debounce(async () => {
  if (import.meta.env.DEV) {
    console.log('[ProfileEditor] debouncedAutosave called, saving:', props.saving, 'isUpdatingFromProps:', isUpdatingFromProps.value)
  }
  if (props.saving || isUpdatingFromProps.value) return
  autosaveStatus.value = 'saving'
  try {
    const { newLanguageCode, newLanguageLevel, ...model } = formData.value
    // v0.60.1: Build payload WITHOUT debugPayload to avoid infinite loop
    const apiPayload = buildTutorProfileUpdate(model)
    // Skip debugPayload during autosave to prevent console.log spam
    if (import.meta.env.DEV) {
      console.log('[ProfileEditor] Writing draft to localStorage, bio length:', apiPayload.bio?.length || 0)
    }
    writeLocalDraft(apiPayload as any)

    // Keep autosave local-only to avoid spamming API (rate-limited).
    lastAutosavedAt.value = Date.now()

    autosaveStatus.value = 'saved'
    if (import.meta.env.DEV) {
      console.log('[ProfileEditor] Autosave completed successfully')
    }
  } catch (err) {
    console.error('[ProfileEditor] Autosave error:', err)
    autosaveStatus.value = 'idle'
  }
}, 2000) as ((...args: any[]) => void) & { cancel?: () => void }

onBeforeUnmount(() => {
  debouncedAutosave.cancel?.()
})

watch(
  () => props.profile,
  (newProfile) => {
    isUpdatingFromProps.value = true
    formData.value = {
      ...fromApi(newProfile),
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
    
    // Reset flag after Vue's reactivity updates
    setTimeout(() => {
      isUpdatingFromProps.value = false
    }, 0)
  },
  { deep: true, immediate: true }
)

watch(
  formData,
  () => {
    if (import.meta.env.DEV) {
      console.log('[ProfileEditor] formData changed, isUpdatingFromProps:', isUpdatingFromProps.value)
    }
    if (!isUpdatingFromProps.value) {
      debouncedAutosave()
    }
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
  // Mark all fields as touched so validation errors will show
  markAllFieldsAsTouched()
  
  if (!canSubmit.value) return
  const apiPayload = getSubmitPayload({ silent: false })
  if (!apiPayload) return
  emit('save', apiPayload as any)
}

function markAllFieldsAsTouched() {
  const allFields = [
    'headline', 'bio', 'subjects', 'teaching_languages', 'hourly_rate',
    'experience_years', 'birth_year', 'country', 'timezone', 'format',
    'gender', 'show_gender', 'show_age', 'telegram_username', 'show_telegram'
  ]
  allFields.forEach(field => touchedFields.value.add(field))
}

function getSubmitPayload(opts?: { silent?: boolean }) {
  const { newLanguageCode, newLanguageLevel, ...model } = formData.value

  const silent = !!opts?.silent

  // v0.60.1: Preflight validation before API call
  const validationErrors = validateProfileBeforeSubmit(model)
  if (validationErrors.length > 0) {
    // IMPORTANT UX: during autosave we must not show validation toasts.
    // Validation feedback should be shown only on explicit Save.
    if (!silent) {
      console.error('[ProfileEditor] Validation errors:', validationErrors)
      // v0.89: Show ALL validation errors, not just the first one
      const errorMessages = validationErrors
        .map(err => `• ${t(err.message)}`)
        .join('\n')
      const errorMsg = `${t('marketplace.errors.validationFailed')}:\n${errorMessages}`
      notifyError(errorMsg, { timeout: 10000 })
    }
    return null
  }

  // Build strict API contract payload
  const apiPayload = buildTutorProfileUpdate(model)
  // Skip debugPayload to avoid infinite loop during publish
  if (import.meta.env.DEV) {
    console.debug('[ProfileEditor] submit.payload.teaching_languages', {
      formTeachingLanguages: (model as any).teaching_languages,
      payloadTeachingLanguages: (apiPayload as any).teaching_languages,
    })
  }
  return apiPayload
}

defineExpose({
  getSubmitPayload,
})

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
  const expYears = formData.value.experience_years
  if (typeof expYears !== 'number' || Number.isNaN(expYears)) {
    next.experience_years = t('marketplace.profile.errors.experienceNonNegative')
  } else if (expYears < 0) {
    next.experience_years = t('marketplace.profile.errors.experienceNonNegative')
  }
  if (typeof formData.value.birth_year === 'number') {
    if (formData.value.birth_year < 1900 || formData.value.birth_year > 2100) {
      next.birth_year = t('marketplace.profile.errors.birthYearInvalid')
    }
  }
  if (!Array.isArray(formData.value.subjects) || formData.value.subjects.length === 0) {
    next.subjects = t('marketplace.profile.editor.validation.subjects')
  }
  // v0.84.0: Validate teaching_languages instead of deprecated languages
  if (!Array.isArray(formData.value.teaching_languages) || formData.value.teaching_languages.length === 0) {
    next.teaching_languages = t('marketplace.profile.editor.validation.teachingLanguages')
  }
  return next
})

const allErrors = computed(() => {
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

// v0.95.1: Only show errors for touched fields to prevent premature validation
const errors = computed(() => {
  const next: Record<string, string> = {}
  for (const [field, error] of Object.entries(allErrors.value)) {
    // Show error only if field was touched OR if there are API errors (from server validation)
    if (touchedFields.value.has(field) || props.apiErrors?.[field]) {
      next[field] = error
    }
  }
  return next
})

// Map nested field errors (subjects[0].custom_direction_text, languages[1].level)
const nestedErrorMap = computed(() => {
  if (!props.apiErrors) return new Map<string, NestedError[]>()
  return mapValidationErrors(props.apiErrors)
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
  const translateSubject = (code: string, fallback?: string) => {
    return (
      catalog.getSubjectTitle(code) ||
      t(`marketplace.subjects.${code}`, fallback || code)
    )
  }

  // v0.88: Use default_subjects for chips (whitelist 10)
  const opts = props.filterOptions?.default_subjects || props.filterOptions?.subjects
  if (Array.isArray(opts) && opts.length > 0) {
    return opts.map((o) => ({ value: o.value, label: translateSubject(o.value, o.label) }))
  }
  return fallbackSubjectOptions.value.map((option) => ({
    value: option.value,
    label: translateSubject(option.value, option.label),
  }))
})

// v0.88: All subjects for dropdown (excluding defaults and already selected)
const allSubjectOptions = computed(() => {
  const translateSubject = (code: string, fallback?: string) => {
    return (
      catalog.getSubjectTitle(code) ||
      t(`marketplace.subjects.${code}`, fallback || code)
    )
  }

  const allSubjects = props.filterOptions?.subjects || []
  const defaultCodes = new Set((props.filterOptions?.default_subjects || []).map((s) => s.value))
  const selectedCodes = new Set(formData.value.subjects?.map((s: any) => s.code) || [])

  return allSubjects
    .filter((s) => {
      return !defaultCodes.has(s.value) && !selectedCodes.has(s.value)
    })
    .map((o) => ({
      value: o.value,
      label: translateSubject(o.value, o.label),
    }))
})

const SUBJECT_GROUP_TO_CATEGORY: Record<string, LanguageTag['category']> = {
  grades: 'level',
  exams: 'format',
  goals: 'goal',
  formats: 'format',
  audience: 'audience',
}

const subjectTagChips = computed<LanguageTag[]>(() =>
  catalog.tags.value.map((tag) => ({
    code: tag.code,
    title: tag.label,
    category: SUBJECT_GROUP_TO_CATEGORY[tag.group] ?? tag.group,
    order: tag.sort_order ?? 0,
  }))
)

/**
 * v1.0: Хлібні крихти — показати секцію "Місто" якщо тютор обрав
 * формат офлайн або гібрид для хоча б одного предмета/мови.
 */
const needsCityPrompt = computed(() => {
  const subjects = formData.value.subjects || []
  return subjects.some((s: any) => {
    if (!Array.isArray(s.tags)) return false
    // Підтримка обох форматів: string[] та object[]
    return s.tags.some((tag: any) => {
      const code = typeof tag === 'string' ? tag : tag?.code
      return code === 'offline' || code === 'hybrid'
    })
  })
})

const stepCompletion = computed<Record<string, boolean>>(() => {
  const f = formData.value
  return {
    photo: !!(props.profile?.media?.photo_url || avatarUrl.value),
    basic: (f.headline?.trim() || '').length >= 20 &&
           (f.bio?.trim() || '').length >= 100 &&
           f.experience_years > 0,
    subjects: f.subjects.length >= 1,
    'teaching-languages': (f.teaching_languages || []).length >= 1,
    pricing: f.hourly_rate > 0 && !!f.currency,
    video: !!f.video_intro_url?.trim(),
    privacy: true,
    'lesson-links': true,
    publish: f.is_published,
  }
})

const completedSteps = computed(() =>
  Object.values(stepCompletion.value).filter(Boolean).length
)

const languageTagOptions = computed(() => [
  ...languagesCatalog.levelTags.value,
  ...languagesCatalog.formatTags.value,
  ...languagesCatalog.goalTags.value,
  ...languagesCatalog.audienceTags.value,
])

const fallbackLanguageSubjects = computed(() =>
  languageOptions.value.map((option, idx) => ({
    code: option.value,
    title: option.label,
    is_popular: idx < 10,
    order: idx,
  }))
)

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
  // v0.84.0: Handle language_* codes (languages as subjects)
  if (code.startsWith('language_')) {
    const langCode = code.replace('language_', '')
    return languagesCatalog.getLanguageTitle(langCode)
  }
  
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

  // v0.84.0: Check teaching_languages instead of deprecated languages
  if (localErrors.value.teaching_languages) {
    items.push(t('marketplace.profile.editor.teachingLanguagesLabel'))
  }

  if (localErrors.value.hourly_rate) {
    items.push(t('marketplace.profile.editor.hourlyRateLabel'))
  }

  return items
})

// v0.84.0: Handlers for new UX components
function handleSelectSubject(code: string) {
  const exists = formData.value.subjects.find(s => s.code === code)
  if (exists) {
    formData.value.subjects = formData.value.subjects.filter(s => s.code !== code)
  } else {
    formData.value.subjects.push({
      code,
      tags: [],
      custom_direction_text: ''
    })
  }
}

function handleSelectLanguage(code: string) {
  const exists = formData.value.languages.find(l => l.code === code)
  if (exists) {
    formData.value.languages = formData.value.languages.filter(l => l.code !== code)
  } else {
    formData.value.languages.push({
      code,
      level: 'fluent' as LanguageLevel,
      tags: [],
      description: ''
    })
  }
}

function handleUpdateSubjects(updated: Array<{ code: string; title: string; tags: string[]; custom_direction_text: string }>) {
  if (import.meta.env.DEV) {
    console.log('[PE] handleUpdateSubjects, tags:', updated.map(s => ({ code: s.code, tags: s.tags })))
  }
  formData.value.subjects = updated.map(s => ({
    code: s.code,
    tags: s.tags,
    custom_direction_text: s.custom_direction_text
  }))
  if (import.meta.env.DEV) {
    console.log('[PE] needsCityPrompt after update:', needsCityPrompt.value)
  }
}

function handleUpdateLanguages(updated: Array<{ code: string; title: string; level: string; tags: string[]; description: string }>) {
  formData.value.languages = updated.map(l => ({
    code: l.code,
    level: l.level as LanguageLevel,
    tags: l.tags,
    description: l.description
  }))
}
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

    <div class="editor-progress">
      <span class="progress-label">{{ completedSteps }}/{{ steps.length }} {{ $t('marketplace.profile.editor.stepsCompleted') }}</span>
      <div class="progress-track">
        <div class="progress-fill" :style="{ width: `${(completedSteps / steps.length) * 100}%` }" />
      </div>
    </div>

    <nav class="editor-steps" data-test="marketplace-editor-steps">
      <button
        v-for="(s, idx) in steps"
        :key="s.id"
        type="button"
        class="step-pill"
        :class="{ 'is-active': idx === stepIndex, 'has-errors': (stepErrors[s.id] || 0) > 0 }"
        @click="stepIndex = idx"
      >
        <span class="step-indicator" :class="stepCompletion[s.id] ? 'step-done' : 'step-todo'">
          {{ stepCompletion[s.id] ? '✓' : (idx + 1) }}
        </span>
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
            v-model="formData.is_published"
            type="checkbox"
            :disabled="saving"
            data-test="marketplace-editor-publish-toggle"
          />
          {{ t('marketplace.profile.publish') }}
        </label>
        <p class="hint">
          {{ t('marketplace.profile.editor.publishHint') }}
        </p>
      </div>
    </section>

    <section v-show="currentStep === 'lesson-links'" class="editor-section">
      <LessonLinksEditor
        :show-header="false"
        :show-cancel-button="false"
      />
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
              :class="['chip', { 'is-active': formData.gender === option.value }]"
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
            @blur="markFieldAsTouched('birth_year')"
          />
          <div v-if="errors.birth_year" class="field-error" data-test="marketplace-editor-error-birth-year">
            {{ errors.birth_year }}
          </div>
          <label class="inline-toggle">
            <input v-model="formData.show_age" type="checkbox" data-test="marketplace-editor-show-age" />
            {{ t('marketplace.profile.editor.showAge') }}
          </label>
        </div>

        <div class="privacy-card">
          <div class="privacy-card-header">
            <span class="privacy-card-title">{{ t('marketplace.profile.editor.telegramLabel') }}</span>
            <p class="privacy-card-hint">{{ t('marketplace.profile.editor.telegramHelper') }}</p>
          </div>
          <input
            id="telegram"
            v-model="formData.telegram_username"
            type="text"
            placeholder="@username"
            data-test="marketplace-editor-telegram"
          />
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
          @blur="markFieldAsTouched('headline')"
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
          @blur="markFieldAsTouched('bio')"
        />
        <span class="hint">
          {{ t('marketplace.profile.editor.bioHint') }}
          <span v-if="formData.bio" :class="{ 'text-success': formData.bio.length >= 10, 'text-muted': formData.bio.length < 10 }">
            ({{ formData.bio.length }}/10 мін.)
          </span>
        </span>
        <div v-if="errors.bio" class="field-error" data-test="marketplace-editor-error-bio">
          {{ errors.bio }}
        </div>
      </div>

      <div class="form-group">
        <label for="experience_years">{{ t('marketplace.profile.editor.experienceYearsLabel') }}</label>
        <input
          id="experience_years"
          v-model.number="formData.experience_years"
          type="number"
          min="0"
          max="50"
          :placeholder="t('marketplace.profile.editor.experienceYearsPlaceholder')"
          data-test="marketplace-editor-experience-years"
        />
        <span class="hint">{{ t('marketplace.profile.editor.experienceYearsHint') }}</span>
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

    <!-- Вкладка: Предмети (основні предмети + мови для вивчення) -->
    <section v-show="currentStep === 'subjects'" class="editor-section">
      <h2>{{ t('marketplace.profile.editor.subjectsTitle') }}</h2>

      <SubjectsTab
        :subject-options="subjectOptions"
        :all-subject-options="allSubjectOptions"
        :languages="languagesCatalog.languages.value.length ? languagesCatalog.languages.value : fallbackLanguageSubjects"
        :subjects="formData.subjects"
        :subject-tags="subjectTagChips"
        :subject-tag-catalog="catalog.tags.value"
        :language-tags="languageTagOptions"
        :get-subject-label="getSubjectLabel"
        @select-subject="handleSelectSubject"
        @update:subjects="handleUpdateSubjects"
      />

      <!-- v1.0: Хлібні крихти — Місто з'являється коли обрано офлайн/гібрид -->
      <Transition name="fade">
        <div v-if="needsCityPrompt" class="breadcrumb-city-section">
          <div class="breadcrumb-arrow">↓</div>
          <div class="breadcrumb-card">
            <h3>🏙️ {{ $t('tutor.city.label') }}</h3>
            <p class="breadcrumb-hint">
              {{ $t('tutor.city.breadcrumb_hint') }}
            </p>
            <CityAutocomplete
              v-model="formData.city_code"
              country-code="UA"
            />
            <CityPrivacyToggle
              v-model="formData.is_city_public"
            />
          </div>
        </div>
      </Transition>
    </section>

    <!-- Вкладка: Мова викладання -->
    <section v-show="currentStep === 'teaching-languages'" class="editor-section">
      <h2>{{ t('marketplace.profile.editor.teachingLanguagesTitle') }}</h2>
      <p class="section-hint">{{ t('marketplace.profile.editor.teachingLanguagesHint') }}</p>
      
      <TeachingLanguagesTab
        :languages="languagesCatalog.languages.value.length > 0 ? languagesCatalog.languages.value : languageOptions.map((o, idx) => ({ code: o.value, title: o.label, is_popular: idx < 10, order: idx }))"
        :teaching-languages="formData.teaching_languages"
        :language-levels="languageLevels"
        :new-language-code="newTeachingLanguageCode"
        :new-language-level="newTeachingLanguageLevel"
        :get-language-title="languagesCatalog.languages.value.length > 0 ? languagesCatalog.getLanguageTitle : (code) => getLanguageName(code, useNativeLanguageNames)"
        :errors="errors"
        @update:new-language-code="newTeachingLanguageCode = $event"
        @update:new-language-level="newTeachingLanguageLevel = $event"
        @add-language="addTeachingLanguage"
        @remove-language="removeTeachingLanguage"
        @update-language-level="(code, level) => { const tl = formData.teaching_languages.find(l => l.code === code); if (tl) tl.level = level; }"
      />
    </section>

    <section v-show="currentStep === 'pricing'" class="editor-section">
      <h2>{{ t('marketplace.profile.editor.pricingTitle') }}</h2>

      <div class="form-row">
        <div class="form-group">
          <label for="hourly_rate">{{ t('marketplace.profile.editor.hourlyRateLabel') }} <span class="required-mark">*</span></label>
          <div class="input-with-addon">
            <input
              id="hourly_rate"
              v-model.number="formData.hourly_rate"
              type="number"
              min="0"
              step="1"
              :placeholder="t('marketplace.profile.editor.hourlyRatePlaceholder')"
              data-test="marketplace-editor-hourly-rate"
              @blur="markFieldAsTouched('hourly_rate')"
            />
            <select v-model="formData.currency" data-test="marketplace-editor-currency">
              <option v-for="c in currencies" :key="c" :value="c">{{ c }}</option>
            </select>
          </div>
          <span class="hint">{{ t('marketplace.profile.editor.hourlyRateHint') }}</span>
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

      <span v-if="autosaveStatus !== 'idle'" class="autosave-status" :class="`autosave-${autosaveStatus}`" data-test="marketplace-editor-autosave-status">
        <span v-if="autosaveStatus === 'saving'" class="autosave-indicator">●</span>
        <span v-if="autosaveStatus === 'saved'">{{ t('profile.autosave.saved') }}</span>
        <span v-if="autosaveStatus === 'restored'">{{ t('profile.autosave.restored') }}</span>
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
  display: flex;
  align-items: center;
  gap: 0.35rem;
  transition: opacity 0.2s ease;
}

.autosave-indicator {
  display: inline-block;
  font-size: 0.6rem;
  animation: pulse 1.5s ease-in-out infinite;
  color: var(--accent-primary);
}

.autosave-saved {
  color: var(--success-text, #10b981);
}

.autosave-restored {
  color: var(--warning-text, #f59e0b);
}

@keyframes pulse {
  0%, 100% { opacity: 0.4; }
  50% { opacity: 1; }
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

.step-pill--link {
  border-style: dashed;
}

.step-pill--link:hover {
  background: color-mix(in srgb, var(--accent-primary) 6%, transparent);
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

.required-mark {
  color: var(--danger);
  font-weight: bold;
}

.text-success {
  color: var(--success);
}

.text-muted {
  color: var(--text-muted);
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

/* v0.84.0 FINAL: Subject Selection and Display Areas */
.subject-selection-area {
  margin-bottom: var(--space-xl);
}

.subject-selection-area h3 {
  font-size: 1.125rem;
  font-weight: 600;
  margin-bottom: var(--space-sm);
  color: var(--text-primary);
}

.subject-selection-area .section-hint {
  font-size: 0.875rem;
  color: var(--text-muted);
  margin-bottom: var(--space-md);
}

.selected-subjects-area {
  margin-top: var(--space-xl);
  padding-top: var(--space-xl);
  border-top: 2px solid var(--border-color);
}

.selected-subjects-area h3 {
  font-size: 1.125rem;
  font-weight: 600;
  margin-bottom: var(--space-md);
  color: var(--text-primary);
}

/* v0.84.0: Teaching Languages Section */
.teaching-languages-section {
  margin-top: var(--space-xl);
  padding: var(--space-lg);
  border: 1px solid var(--border-color);
  border-radius: var(--radius-lg);
  background: var(--surface-card);
}

.teaching-languages-section h3 {
  font-size: 1rem;
  font-weight: 600;
  margin-bottom: var(--space-sm);
  color: var(--text-primary);
}

.teaching-languages-section .section-hint {
  font-size: 0.875rem;
  color: var(--text-muted);
  margin-bottom: var(--space-md);
}

.teaching-language-selector {
  display: flex;
  gap: var(--space-sm);
  margin-bottom: var(--space-md);
}

.teaching-language-selector select {
  flex: 1;
  padding: 0.625rem 0.875rem;
  border: 1px solid var(--border-color);
  border-radius: var(--radius-md);
  font-size: 0.9375rem;
}

.teaching-languages-list {
  display: flex;
  flex-direction: column;
  gap: var(--space-sm);
}

.teaching-language-item {
  display: flex;
  align-items: center;
  gap: var(--space-sm);
  padding: var(--space-sm);
  border: 1px solid var(--border-color);
  border-radius: var(--radius-md);
  background: var(--surface-base);
}

.teaching-language-item .language-name {
  flex: 1;
  font-weight: 500;
  color: var(--text-primary);
}

.teaching-language-item select {
  width: auto;
  min-width: 150px;
  padding: 0.5rem;
  border: 1px solid var(--border-color);
  border-radius: var(--radius-sm);
}

/* v1.0: Progress bar styles */
.editor-progress {
  display: flex;
  align-items: center;
  gap: var(--space-sm);
  margin-bottom: var(--space-md);
  font-size: 0.875rem;
  color: var(--text-secondary);
}

.progress-label {
  white-space: nowrap;
}

.progress-track {
  flex: 1;
  height: 8px;
  background: var(--border-color);
  border-radius: 4px;
  overflow: hidden;
}

.progress-fill {
  height: 100%;
  background: var(--accent-primary);
  border-radius: 4px;
  transition: width 0.3s ease;
}

.step-indicator {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 22px;
  height: 22px;
  border-radius: 50%;
  font-size: 0.75rem;
  font-weight: 600;
  margin-right: 4px;
}

.step-done {
  background: #10b981;
  color: white;
}

.step-todo {
  background: var(--border-color);
  color: var(--text-muted);
}

/* v1.0: Breadcrumb city prompt animation */
.city-prompt {
  border-left: 3px solid var(--accent);
  background: color-mix(in srgb, var(--accent) 5%, var(--card-bg));
}

/* v1.0: Breadcrumb city section styles */
.breadcrumb-city-section {
  margin-top: var(--space-xl);
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--space-md);
}

.breadcrumb-arrow {
  font-size: 1.5rem;
  color: var(--accent-primary);
  animation: bounce 1.5s infinite;
}

@keyframes bounce {
  0%, 100% { transform: translateY(0); }
  50% { transform: translateY(6px); }
}

.breadcrumb-card {
  width: 100%;
  padding: var(--space-lg);
  border: 2px solid var(--accent-primary);
  border-radius: var(--radius-lg);
  background: color-mix(in srgb, var(--accent-primary) 5%, var(--card-bg));
}

.breadcrumb-card h3 {
  margin: 0 0 var(--space-sm) 0;
  font-size: 1.125rem;
  font-weight: 600;
  color: var(--text-primary);
}

.breadcrumb-hint {
  margin: 0 0 var(--space-md) 0;
  font-size: 0.875rem;
  color: var(--text-secondary);
}

.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.3s ease, transform 0.3s ease;
}
.fade-enter-from,
.fade-leave-to {
  opacity: 0;
  transform: translateY(-8px);
}
</style>
