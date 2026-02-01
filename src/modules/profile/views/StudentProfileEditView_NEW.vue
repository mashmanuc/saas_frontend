<template>
  <div class="space-y-6">
    <Card class="space-y-2">
      <div class="flex flex-wrap items-start justify-between gap-4">
        <div>
          <Heading :level="1">
            {{ $t('student.profile.editTitle') }}
          </Heading>
          <p class="text-sm text-muted-foreground">
            {{ $t('student.profile.editDescription') }}
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
      <StudentProfileForm
        v-model="formData"
        :disabled="isSaving"
        :saving="isSaving"
        :error-message="errorMessage"
        @submit="handleSubmit"
        @cancel="goBack"
        @change="handleFormChange"
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
import StudentProfileForm from '../components/StudentProfileForm.vue'
import { useProfileStore } from '../store/profileStore'
import { notifySuccess } from '@/utils/notify'

const router = useRouter()
const { t } = useI18n()
const profileStore = useProfileStore()

const formData = ref({
  learning_goals: '',
  preferred_subjects: [],
  budget_min: 0,
  budget_max: 0
})

const isSaving = computed(() => profileStore.saving)
const errorMessage = computed(() => profileStore.error)

const isValid = computed(() => {
  return Boolean(
    formData.value.preferred_subjects &&
    formData.value.preferred_subjects.length > 0
  )
})

function loadFormData() {
  if (profileStore.profile) {
    formData.value = {
      learning_goals: profileStore.profile.learning_goals || '',
      preferred_subjects: profileStore.profile.preferred_subjects || [],
      budget_min: profileStore.profile.budget_min || 0,
      budget_max: profileStore.profile.budget_max || 0
    }
  }
}

async function handleSubmit() {
  if (!isValid.value) return

  try {
    await profileStore.saveProfile({
      student_profile: formData.value
    })
    notifySuccess(t('student.profile.saveSuccess'))
    router.push('/student')
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

onMounted(async () => {
  if (!profileStore.initialized) {
    await profileStore.loadProfile().catch(() => {})
  }
  loadFormData()
})
</script>
