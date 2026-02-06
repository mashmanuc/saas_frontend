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
import { getStudentProfile, updateStudentProfile, validateStudentProfile } from '@/api/students'
import { notifySuccess, notifyError } from '@/utils/notify'

const router = useRouter()
const { t } = useI18n()

const formData = ref({
  learning_goals: '',
  preferred_subjects: [],
  budget_min: undefined,
  budget_max: undefined,
  phone: '',
  telegram_username: ''
})

const isSaving = ref(false)
const errorMessage = ref('')
const hasUnsavedChanges = ref(false)

const isValid = computed(() => {
  return Boolean(
    formData.value.preferred_subjects &&
    formData.value.preferred_subjects.length > 0 &&
    formData.value.phone &&
    formData.value.phone.trim().length > 0
  )
})

async function loadProfile() {
  try {
    const profile = await getStudentProfile()
    formData.value = {
      learning_goals: profile.learning_goals || '',
      preferred_subjects: profile.preferred_subjects || [],
      budget_min: profile.budget_min,
      budget_max: profile.budget_max,
      phone: profile.phone || '',
      telegram_username: profile.telegram_username || ''
    }
  } catch (error) {
    console.error('Failed to load student profile:', error)
    if (error.response?.status === 403) {
      errorMessage.value = t('student.profile.notStudent')
    } else {
      errorMessage.value = t('student.profile.loadError')
    }
  }
}

async function handleSubmit() {
  if (!isValid.value) return

  // Client-side validation
  const validationErrors = validateStudentProfile(formData.value)
  if (validationErrors) {
    const firstError = Object.values(validationErrors)[0]
    errorMessage.value = firstError
    return
  }

  isSaving.value = true
  errorMessage.value = ''

  try {
    await updateStudentProfile(formData.value)
    hasUnsavedChanges.value = false
    notifySuccess(t('student.profile.saveSuccess'))
    router.push('/student')
  } catch (error) {
    console.error('Failed to save student profile:', error)
    
    if (error.response?.data?.field_errors) {
      const fieldErrors = error.response.data.field_errors
      const firstError = Object.values(fieldErrors)[0]
      errorMessage.value = Array.isArray(firstError) ? firstError[0] : firstError
    } else if (error.response?.data?.detail) {
      errorMessage.value = error.response.data.detail
    } else {
      errorMessage.value = t('student.profile.saveError')
    }
    
    notifyError(errorMessage.value)
  } finally {
    isSaving.value = false
  }
}

function goBack() {
  router.back()
}

function handleFormChange() {
  hasUnsavedChanges.value = true
}

onMounted(async () => {
  await loadProfile()
})
</script>
