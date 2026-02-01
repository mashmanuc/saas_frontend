<template>
  <div class="space-y-6">
    <Card class="space-y-2">
      <div class="flex flex-wrap items-start justify-between gap-4">
        <div>
          <Heading :level="1">
            {{ $t('tutor.profile.editTitle') }}
          </Heading>
          <p class="text-sm text-muted-foreground">
            {{ $t('tutor.profile.editDescription') }}
          </p>
        </div>
        <div class="flex gap-2">
          <Button variant="outline" size="sm" :disabled="isSaving" @click="goBack">
            {{ $t('ui.cancel') }}
          </Button>
          <Button
            variant="primary"
            size="sm"
            :disabled="isSaving || !isValid"
            :loading="isSaving"
            @click="handleSubmit"
          >
            {{ isSaving ? $t('ui.saving') : $t('ui.save') }}
          </Button>
        </div>
      </div>
    </Card>

    <Card v-if="errorMessage" class="border-red-200 bg-red-50 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-200">
      {{ errorMessage }}
    </Card>

    <Card class="space-y-6">
      <TutorProfileForm
        v-model="formData"
        :disabled="isSaving"
        :saving="isSaving"
        :show-publish-toggle="true"
        :error-message="errorMessage"
        @submit="handleSubmit"
        @cancel="goBack"
        @change="handleFormChange"
        @publish="handlePublish"
        @unpublish="handleUnpublish"
      />
    </Card>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import Button from '@/ui/Button.vue'
import Card from '@/ui/Card.vue'
import Heading from '@/ui/Heading.vue'
import TutorProfileForm from '../components/TutorProfileForm.vue'
import { useProfileStore } from '../store/profileStore'
import { notifySuccess } from '@/utils/notify'

const router = useRouter()
const { t } = useI18n()
const profileStore = useProfileStore()

const formData = ref({
  headline: '',
  bio: '',
  experience: 0,
  hourly_rate: 0,
  currency: 'UAH',
  is_published: false
})

const isSaving = computed(() => profileStore.saving)
const errorMessage = computed(() => profileStore.error)

const isValid = computed(() => {
  return Boolean(
    formData.value.headline?.trim() &&
    formData.value.bio?.trim() &&
    formData.value.hourly_rate &&
    formData.value.hourly_rate > 0
  )
})

function loadFormData() {
  if (profileStore.profile) {
    formData.value = {
      headline: profileStore.profile.headline || '',
      bio: profileStore.profile.bio || '',
      experience: profileStore.profile.experience || 0,
      hourly_rate: profileStore.profile.hourly_rate || 0,
      currency: profileStore.profile.currency || 'UAH',
      is_published: profileStore.profile.is_published || false
    }
  }
}

async function handleSubmit() {
  if (!isValid.value) return

  try {
    await profileStore.saveProfile({
      tutor_profile: formData.value
    })
    notifySuccess(t('tutor.profile.saveSuccess'))
    router.push('/tutor/profile')
  } catch (error) {
    // Error handled in store
  }
}

function goBack() {
  router.back()
}

function handleFormChange() {
  profileStore.hasUnsavedChanges = true
}

async function handlePublish() {
  try {
    const { publishTutorProfile } = await import('@/api/users')
    await publishTutorProfile()
    formData.value.is_published = true
    notifySuccess(t('tutor.profile.publishSuccess'))
  } catch (err) {
    console.error('Publish failed', err)
  }
}

async function handleUnpublish() {
  try {
    formData.value.is_published = false
    await profileStore.saveProfile({ 
      tutor_profile: { is_published: false } 
    })
    notifySuccess(t('tutor.profile.unpublishSuccess'))
  } catch (err) {
    console.error('Unpublish failed', err)
  }
}

onMounted(async () => {
  if (!profileStore.initialized) {
    await profileStore.loadProfile().catch(() => {})
  }
  loadFormData()
})
</script>
