<template>
  <div class="space-y-6">
    <div>
      <h3 class="text-lg font-medium">{{ $t('users.settings.profile.title') }}</h3>
      <p class="text-sm text-muted-foreground">
        {{ $t('users.settings.profile.description') }}
      </p>
    </div>

    <div v-if="loading" class="flex justify-center py-8">
      <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
    </div>

    <div v-else-if="errorMessage" class="rounded-lg bg-destructive/10 p-4 text-sm text-destructive">
      {{ errorMessage }}
    </div>

    <div v-else>
      <!-- Student Profile Form -->
      <StudentProfileForm
        v-if="userRole === 'student'"
        v-model="profileData"
        :disabled="saving"
        :saving="saving"
        :error-message="errorMessage"
        @submit="handleSubmit"
      />

      <!-- Tutor Profile Form -->
      <TutorProfileForm
        v-else-if="userRole === 'tutor'"
        v-model="profileData"
        :disabled="saving"
        :saving="saving"
        :error-message="errorMessage"
        @submit="handleSubmit"
      />

      <div v-else class="text-sm text-muted-foreground">
        {{ $t('users.settings.profile.noRole') }}
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
import { useAuthStore } from '@/stores/authStore'
import { getStudentProfile, updateStudentProfile } from '@/api/students'
import { getTutorProfile, updateTutorProfile } from '@/api/tutors'
import StudentProfileForm from '../StudentProfileForm.vue'
import TutorProfileForm from '../TutorProfileForm.vue'
import { notifySuccess, notifyError } from '@/utils/notify'
import { useI18n } from 'vue-i18n'

const { t } = useI18n()
const authStore = useAuthStore()

const loading = ref(false)
const saving = ref(false)
const errorMessage = ref('')
const profileData = ref({})

const userRole = computed(() => authStore.user?.role)

async function loadProfile() {
  loading.value = true
  errorMessage.value = ''

  try {
    if (userRole.value === 'student') {
      const profile = await getStudentProfile()
      profileData.value = profile
    } else if (userRole.value === 'tutor') {
      const profile = await getTutorProfile()
      profileData.value = profile
    }
  } catch (error) {
    console.error('Failed to load profile:', error)
    errorMessage.value = t('users.settings.profile.loadError')
  } finally {
    loading.value = false
  }
}

async function handleSubmit() {
  saving.value = true
  errorMessage.value = ''

  try {
    if (userRole.value === 'student') {
      await updateStudentProfile(profileData.value)
      notifySuccess(t('users.settings.profile.saveSuccess'))
    } else if (userRole.value === 'tutor') {
      await updateTutorProfile(profileData.value)
      notifySuccess(t('users.settings.profile.saveSuccess'))
    }
  } catch (error) {
    console.error('Failed to save profile:', error)
    
    if (error.response?.data?.field_errors) {
      const fieldErrors = error.response.data.field_errors
      const firstError = Object.values(fieldErrors)[0]
      errorMessage.value = Array.isArray(firstError) ? firstError[0] : firstError
    } else if (error.response?.data?.detail) {
      errorMessage.value = error.response.data.detail
    } else {
      errorMessage.value = t('users.settings.profile.saveError')
    }
    
    notifyError(errorMessage.value)
  } finally {
    saving.value = false
  }
}

onMounted(() => {
  loadProfile()
})
</script>
