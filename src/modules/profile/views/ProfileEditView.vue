<template>
  <div class="space-y-6">
    <Card class="space-y-2">
      <div class="flex flex-wrap items-start justify-between gap-4">
        <div>
          <Heading :level="1">
            {{ $t('profile.editTitle') }}
          </Heading>
          <p class="text-sm text-muted-foreground">
            {{ $t('profile.editDescription') }}
          </p>
        </div>
        <div class="flex flex-col items-end gap-2">
          <div class="flex gap-2">
            <Button variant="outline" size="sm" :disabled="isSaving" @click="goBack">
              {{ $t('profile.actions.cancel') }}
            </Button>
            <Button
              variant="primary"
              size="sm"
              :disabled="isSaveBlocked"
              :loading="isSaving"
              @click="handleSubmit"
            >
              {{ isSaving ? $t('profile.actions.saving') : $t('profile.actions.save') }}
            </Button>
          </div>
          <div class="flex flex-wrap items-center gap-3 text-xs text-muted">
            <span :class="['inline-flex items-center gap-1 rounded-full border px-2 py-0.5', autosaveBadgeClass]">
              {{ autosaveBadgeMessage }}
            </span>
            <span v-if="profileStore.draftLoading" class="text-muted">
              {{ $t('profile.draft.loading') }}
            </span>
            <button
              v-if="profileStore.hasUnsavedChanges"
              type="button"
              class="text-accent underline-offset-2 hover:underline disabled:cursor-not-allowed disabled:opacity-60"
              :disabled="isSaving || autosaveStatus === 'saving'"
              @click="revertChanges"
            >
              {{ $t('profile.actions.revert') }}
            </button>
          </div>
        </div>
      </div>
    </Card>

    <Card v-if="errorMessage" class="border-red-200 bg-red-50 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-200">
      {{ errorMessage }}
    </Card>

    <Card class="space-y-6">
      <div class="flex flex-col gap-6 lg:flex-row">
        <div class="flex flex-1 flex-col items-center justify-center gap-4">
          <AvatarUploadWidget
            :image-url="profileStore.avatarUrl"
            :fallback-name="profileStore.fullName || profileStore.user?.email || '?'"
            :disabled="isSaving"
            @upload="handleAvatarUpload"
            @delete="handleAvatarDelete"
          />
        </div>

        <div class="flex-[2]">
          <ProfileForm
            v-model="form"
            :errors="formErrors"
            :timezone-options="timezoneOptions"
            :disabled="isSaving"
            @submit="handleSubmit"
          />
        </div>
      </div>
    </Card>

    <Modal :open="draftDialogOpen" :title="$t('profile.draft.foundTitle')" size="sm" :persistent="true" @close="discardDraft">
      <p class="text-sm text-muted">
        {{ draftDescription }}
      </p>
      <div class="flex flex-col gap-3 text-xs text-muted" v-if="profileStore.draftError">
        <span class="text-danger-500">{{ profileStore.draftError }}</span>
      </div>
      <template #footer>
        <div class="flex justify-end gap-2">
          <Button variant="ghost" size="sm" :disabled="isDraftRestoring" @click="discardDraft">
            {{ $t('profile.draft.discard') }}
          </Button>
          <Button variant="primary" size="sm" :disabled="isDraftRestoring" :loading="isDraftRestoring" @click="restoreDraft">
            {{ $t('profile.draft.restore') }}
          </Button>
        </div>
      </template>
    </Modal>
  </div>
</template>

<script setup>
import { computed, nextTick, onBeforeUnmount, onMounted, reactive, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import Button from '../../../ui/Button.vue'
import Modal from '../../../ui/Modal.vue'
import Card from '../../../ui/Card.vue'
import Heading from '../../../ui/Heading.vue'
import AvatarUpload from '../components/AvatarUpload.vue'
import AvatarUploadWidget from '../components/AvatarUploadWidget.vue'
import ProfileForm from '../components/ProfileForm.vue'
import { useProfileStore } from '../store/profileStore'
import { USER_ROLES } from '../../../types/user'
import { TIMEZONES } from '../../../utils/timezones'
import { notifySuccess } from '../../../utils/notify'
import { buildDirtyPayload, hasDirtyChanges, createAutosaveScheduler } from '../utils/autosave'

const router = useRouter()
const { t } = useI18n()
const profileStore = useProfileStore()

const timezoneOptions = TIMEZONES
const timezoneFallback = computed(() => profileStore.settings?.timezone || 'Europe/Kyiv')
const form = reactive({
  first_name: '',
  last_name: '',
  timezone: '',
  headline: '',
  bio: '',
})
const formErrors = reactive({
  first_name: '',
  last_name: '',
  timezone: '',
})
const autosaveStatus = ref('idle')
const isHydrating = ref(true)
const lastServerSnapshot = ref({ user: null, profile: null, subjects: [] })
const draftDialogOpen = ref(false)
const isDraftRestoring = ref(false)
let statusResetTimer = null

const isSaving = computed(() => profileStore.saving)
const errorMessage = computed(() => profileStore.error)

const formattedAutosaveTime = computed(() => formatTime(profileStore.lastAutosavedAt))
const autosaveBadgeMessage = computed(() => {
  if (autosaveStatus.value === 'saving') return t('profile.autosave.saving')
  if (autosaveStatus.value === 'error') return t('profile.autosave.error')
  if (autosaveStatus.value === 'restored') return t('profile.autosave.restored')
  if (autosaveStatus.value === 'rate_limited') return t('profile.autosave.rateLimited')
  if (profileStore.hasUnsavedChanges) return t('profile.autosave.unsaved')
  if (formattedAutosaveTime.value) return t('profile.autosave.savedAt', { time: formattedAutosaveTime.value })
  return t('profile.autosave.clean')
})
const autosaveBadgeClass = computed(() => {
  switch (autosaveStatus.value) {
    case 'saving':
      return 'border-accent text-accent bg-accent/10'
    case 'error':
      return 'border-red-400 text-red-500 bg-red-100 dark:bg-red-500/10'
    case 'restored':
      return 'border-emerald-400 text-emerald-500 bg-emerald-500/10'
    case 'rate_limited':
      return 'border-amber-400 text-amber-500 bg-amber-500/10'
    default:
      return 'border-default text-muted'
  }
})
const isSaveBlocked = computed(
  () => isSaving.value || profileStore.isRateLimited || profileStore.hasUnsavedChanges,
)

const draftDescription = computed(() => {
  if (formattedAutosaveTime.value) {
    return t('profile.draft.foundDescription', { time: formattedAutosaveTime.value })
  }
  return t('profile.draft.foundDescriptionNoTime')
})

function formatTime(date) {
  if (!date) return ''
  try {
    return new Intl.DateTimeFormat('uk-UA', { hour: '2-digit', minute: '2-digit' }).format(date)
  } catch (_err) {
    return date.toLocaleTimeString()
  }
}

function captureSnapshot() {
  lastServerSnapshot.value = {
    user: profileStore.user ? { ...profileStore.user } : null,
    profile: profileStore.profile ? { ...profileStore.profile } : null,
    subjects: [...subjects.value],
  }
}

function captureSnapshotFromForm() {
  const previous = lastServerSnapshot.value
  lastServerSnapshot.value = {
    user: {
      ...(previous.user || {}),
      first_name: form.first_name,
      last_name: form.last_name,
      timezone: form.timezone || timezoneFallback.value,
    },
    profile: {
      ...(previous.profile || {}),
      headline: form.headline,
      bio: form.bio,
    },
    subjects: [...subjects.value],
  }
}

function finishHydration() {
  nextTick(() => {
    captureSnapshot()
    isHydrating.value = false
  })
}

function setAutosaveStatus(value, resetDelay = 0) {
  autosaveStatus.value = value
  if (statusResetTimer) {
    clearTimeout(statusResetTimer)
    statusResetTimer = null
  }
  if (resetDelay > 0) {
    statusResetTimer = setTimeout(() => {
      if (autosaveStatus.value === value) {
        autosaveStatus.value = 'idle'
      }
      statusResetTimer = null
    }, resetDelay)
  }
}

watch(
  () => profileStore.user,
  (user) => {
    form.first_name = user?.first_name || ''
    form.last_name = user?.last_name || ''
    form.timezone = user?.timezone || timezoneFallback.value
    finishHydration()
  },
  { immediate: true },
)

watch(
  () => profileStore.profile,
  (profile) => {
    form.headline = profile?.headline || ''
    form.bio = profile?.bio || ''
    subjects.value = Array.isArray(profile?.subjects) ? [...profile.subjects] : []
    finishHydration()
  },
  { immediate: true },
)

function buildPayload() {
  return {
    user: {
      first_name: form.first_name?.trim(),
      last_name: form.last_name?.trim(),
      timezone: form.timezone,
    }
  }
}

function validateForm() {
  formErrors.first_name = form.first_name?.trim().length >= 2 ? '' : t('profile.messages.validationName')
  formErrors.last_name = form.last_name?.trim().length >= 2 ? '' : t('profile.messages.validationName')
  formErrors.timezone = form.timezone ? '' : t('profile.messages.validationTimezone')
  return !formErrors.first_name && !formErrors.last_name && !formErrors.timezone
}

async function handleSubmit() {
  if (!validateForm()) {
    return
  }

  try {
    await profileStore.saveProfile(buildPayload())
    router.push('/dashboard/profile')
  } catch (error) {
    // error already handled in store
  }
}

function goBack() {
  router.back()
}

async function handleAvatarUpload(file) {
  try {
    await profileStore.uploadAvatar(file)
    captureSnapshot()
  } catch (err) {
    console.error('Avatar upload failed', err)
  }
}

async function handleAvatarDelete() {
  try {
    await profileStore.removeAvatar()
    captureSnapshot()
  } catch (err) {
    console.error('Avatar delete failed', err)
  }
}

function handleFormChange() {
  profileStore.hasUnsavedChanges = true
}


function canAutosave() {
  return form.first_name.trim().length >= 2 && form.last_name.trim().length >= 2 && Boolean(form.timezone)
}

const autosaveScheduler = createAutosaveScheduler(async (payload) => {
  if (!payload || !hasDirtyChanges(payload)) return
  if (!canAutosave()) {
    profileStore.hasUnsavedChanges = true
    return
  }
  setAutosaveStatus('saving')
  try {
    const result = await profileStore.autosaveDraft(payload)
    if (result?.status === 'rate_limited') {
      autosaveStatus.value = 'rate_limited'
      return
    }
    captureSnapshotFromForm()
    profileStore.hasUnsavedChanges = false
    setAutosaveStatus('idle')
  } catch (error) {
    setAutosaveStatus('error')
    throw error
  }
}, 800)

function scheduleAutosave() {
  if (isHydrating.value || isSaving.value || !profileStore.initialized) return
  const payload = buildDirtyPayload({
    snapshot: lastServerSnapshot.value,
    form,
    subjects: subjects.value,
    role: profileStore.user?.role,
    timezoneFallback: form.timezone || timezoneFallback.value,
  })

  if (!hasDirtyChanges(payload)) {
    profileStore.hasUnsavedChanges = false
    return
  }

  profileStore.hasUnsavedChanges = true

  if (!canAutosave()) return
  autosaveScheduler.schedule(payload)
}

function applyDraftData(draft) {
  if (!draft) return
  const userDraft = draft.user || {}
  form.first_name = userDraft.first_name ?? form.first_name ?? ''
  form.last_name = userDraft.last_name ?? form.last_name ?? ''
  form.timezone = userDraft.timezone || form.timezone || profileStore.settings?.timezone || 'Europe/Kyiv'

  const profileDraft = draft.tutor_profile || draft.student_profile || draft.profile || {}
  if ('headline' in profileDraft) {
    form.headline = profileDraft.headline ?? ''
  }
  if ('bio' in profileDraft) {
    form.bio = profileDraft.bio ?? ''
  }
  if (Array.isArray(profileDraft.subjects)) {
    subjects.value = [...profileDraft.subjects]
  }
}

async function restoreDraft() {
  if (!profileStore.draftData) return
  isDraftRestoring.value = true
  isHydrating.value = true
  try {
    applyDraftData(profileStore.draftData)
    profileStore.hasUnsavedChanges = true
    await profileStore.discardProfileDraft().catch(() => {})
    notifySuccess(t('profile.autosave.restored'))
    setAutosaveStatus('restored', 4000)
  } finally {
    draftDialogOpen.value = false
    isDraftRestoring.value = false
    finishHydration()
  }
}

async function discardDraft() {
  isDraftRestoring.value = true
  try {
    await profileStore.discardProfileDraft()
  } finally {
    draftDialogOpen.value = false
    isDraftRestoring.value = false
  }
}

watch(
  () => ({
    ...form,
    subjects: [...subjects.value],
  }),
  () => {
    if (isHydrating.value) return
    scheduleAutosave()
  },
  { deep: true },
)

function revertChanges() {
  if (!lastServerSnapshot.value.user) return
  isHydrating.value = true
  const { user, profile, subjects: snapshotSubjects } = lastServerSnapshot.value
  form.first_name = user?.first_name || ''
  form.last_name = user?.last_name || ''
  form.timezone = user?.timezone || profileStore.settings?.timezone || 'Europe/Kyiv'
  form.headline = profile?.headline || ''
  form.bio = profile?.bio || ''
  subjects.value = [...snapshotSubjects]
  profileStore.hasUnsavedChanges = false
  setAutosaveStatus('idle')
  finishHydration()
}

onMounted(async () => {
  if (!profileStore.initialized) {
    await profileStore.loadProfile().catch(() => {})
  }
  profileStore
    .loadProfileDraft()
    .then(() => {
      if (profileStore.hasDraft && profileStore.draftData) {
        draftDialogOpen.value = true
      }
    })
    .catch(() => {})
})

onBeforeUnmount(() => {
  autosaveScheduler.cancel()
  if (statusResetTimer) {
    clearTimeout(statusResetTimer)
  }
})
</script>
