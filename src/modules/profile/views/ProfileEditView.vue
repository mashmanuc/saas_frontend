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
            <Button variant="primary" size="sm" :disabled="isSaving" :loading="isSaving" @click="handleSubmit">
              {{ isSaving ? $t('profile.actions.saving') : $t('profile.actions.save') }}
            </Button>
          </div>
          <div class="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
            <span v-if="autosaveStatus === 'saving'">Автозбереження…</span>
            <span v-else-if="autosaveStatus === 'error'" class="text-red-500">Не вдалося зберегти чернетку</span>
            <span v-else-if="profileStore.hasUnsavedChanges">Є незбережені зміни</span>
            <span v-else-if="lastAutosaveLabel">Чернетку збережено о {{ lastAutosaveLabel }}</span>
            <span v-else>Зміни відсутні</span>
            <button
              v-if="profileStore.hasUnsavedChanges"
              type="button"
              class="text-primary underline-offset-2 hover:underline disabled:cursor-not-allowed disabled:opacity-60"
              :disabled="isSaving || autosaveStatus === 'saving'"
              @click="revertChanges"
            >
              Відкотити зміни
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
          <AvatarUpload
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
          >
            <div v-if="isTutor" class="space-y-3">
              <label class="block text-sm font-medium text-primary">
                {{ $t('profile.subjectsTitle') }}
              </label>
              <div class="flex flex-wrap gap-2">
                <span
                  v-for="subject in subjects"
                  :key="subject"
                  class="inline-flex items-center gap-1 rounded-full bg-surface-muted px-3 py-1 text-xs font-medium text-muted-foreground"
                >
                  {{ subject }}
                  <button
                    type="button"
                    class="text-muted-foreground hover:text-foreground"
                    :disabled="isSaving"
                    @click="removeSubject(subject)"
                  >
                    ×
                  </button>
                </span>
                <form class="flex items-center gap-2" @submit.prevent="addSubject">
                  <input
                    v-model="newSubject"
                    type="text"
                    class="input h-8 w-36 text-xs"
                    :placeholder="$t('profile.subjectsAddPlaceholder')"
                    :disabled="isSaving"
                  />
                  <button
                    type="submit"
                    class="text-xs font-medium text-primary hover:underline disabled:cursor-not-allowed disabled:opacity-60"
                    :disabled="isSaving || !newSubject.trim()"
                  >
                    {{ $t('profile.subjectsAddButton') }}
                  </button>
                </form>
              </div>
            </div>
          </ProfileForm>
        </div>
      </div>
    </Card>
  </div>
</template>

<script setup>
import { computed, nextTick, onBeforeUnmount, reactive, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import Button from '../../../ui/Button.vue'
import Card from '../../../ui/Card.vue'
import Heading from '../../../ui/Heading.vue'
import AvatarUpload from '../components/AvatarUpload.vue'
import ProfileForm from '../components/ProfileForm.vue'
import { useProfileStore } from '../store/profileStore'
import { USER_ROLES } from '../../../types/user'
import { TIMEZONES } from '../../../utils/timezones'
import { debounce } from '../../../utils/debounce'

const router = useRouter()
const { t } = useI18n()
const profileStore = useProfileStore()

const timezoneOptions = TIMEZONES
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
const subjects = ref([])
const newSubject = ref('')
const autosaveStatus = ref('idle')
const isHydrating = ref(true)
const lastServerSnapshot = ref({ user: null, profile: null, subjects: [] })

const isTutor = computed(() => profileStore.user?.role === USER_ROLES.TUTOR)
const isSaving = computed(() => profileStore.saving)
const errorMessage = computed(() => profileStore.error)
const lastAutosaveLabel = computed(() => {
  if (!profileStore.lastAutosavedAt) return ''
  try {
    return new Intl.DateTimeFormat('uk-UA', { hour: '2-digit', minute: '2-digit' }).format(profileStore.lastAutosavedAt)
  } catch (_err) {
    return profileStore.lastAutosavedAt.toLocaleTimeString()
  }
})

function captureSnapshot() {
  lastServerSnapshot.value = {
    user: profileStore.user ? { ...profileStore.user } : null,
    profile: profileStore.profile ? { ...profileStore.profile } : null,
    subjects: [...subjects.value],
  }
}

function finishHydration() {
  nextTick(() => {
    captureSnapshot()
    isHydrating.value = false
  })
}

watch(
  () => profileStore.user,
  (user) => {
    form.first_name = user?.first_name || ''
    form.last_name = user?.last_name || ''
    form.timezone = user?.timezone || profileStore.settings?.timezone || 'Europe/Kyiv'
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
  const payload = {
    user: {
      first_name: form.first_name?.trim(),
      last_name: form.last_name?.trim(),
      timezone: form.timezone,
    },
    profile: {
      headline: form.headline?.trim() || '',
      bio: form.bio || '',
      subjects: isTutor.value ? subjects.value : undefined,
    },
  }

  if (profileStore.user?.role === USER_ROLES.TUTOR) {
    payload.tutor_profile = payload.profile
  } else if (profileStore.user?.role === USER_ROLES.STUDENT) {
    payload.student_profile = payload.profile
  }
  delete payload.profile

  return payload
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

function handleAvatarUpload(file) {
  profileStore.uploadAvatar(file).catch(() => {})
}

function handleAvatarDelete() {
  profileStore.removeAvatar().catch(() => {})
}

function addSubject() {
  const normalized = newSubject.value.trim()
  if (!normalized) return
  const lower = normalized.toLowerCase()
  if (subjects.value.some((subj) => subj.toLowerCase() === lower)) {
    newSubject.value = ''
    return
  }
  subjects.value.push(normalized)
  newSubject.value = ''
}

function removeSubject(subject) {
  subjects.value = subjects.value.filter((item) => item !== subject)
}

function canAutosave() {
  return form.first_name.trim().length >= 2 && form.last_name.trim().length >= 2 && Boolean(form.timezone)
}

const triggerAutosave = debounce(async () => {
  if (isHydrating.value || isSaving.value || !profileStore.initialized) return
  if (!canAutosave()) {
    profileStore.hasUnsavedChanges = true
    return
  }
  autosaveStatus.value = 'saving'
  try {
    await profileStore.autosaveDraft(buildPayload())
    autosaveStatus.value = 'idle'
  } catch (error) {
    autosaveStatus.value = 'error'
  }
}, 800)

watch(
  () => ({
    ...form,
    subjects: [...subjects.value],
  }),
  () => {
    if (isHydrating.value) return
    triggerAutosave()
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
  autosaveStatus.value = 'idle'
  finishHydration()
}

onBeforeUnmount(() => {
  triggerAutosave.cancel?.()
})
</script>
