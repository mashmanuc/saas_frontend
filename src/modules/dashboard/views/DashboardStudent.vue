<template>
  <div class="space-y-6">
    <Card class="space-y-2">
      <Heading :level="1">
        {{ $t('menu.studentDashboard') }}
      </Heading>
      <p class="text-gray-500 text-sm dark:text-gray-400">
        <!-- базовий опис можна доповнити пізніше -->
      </p>
    </Card>

    <Card class="space-y-4">
      <template v-if="isSelfLearning">
        <Heading :level="2">
          {{ $t('student.withoutTutor') }}
        </Heading>
        <TutorSearchView />
      </template>
      <template v-else>
        <Heading :level="2">
          {{ $t('student.withTutor') }}
        </Heading>

        <div v-if="tutorLoading" class="text-sm text-gray-500 dark:text-gray-400">
          {{ $t('loader.loading') }}
        </div>

        <p v-else-if="tutorError" class="text-sm text-red-600">{{ tutorError }}</p>

        <div v-else-if="tutor">
          <p class="font-medium text-base text-foreground">
            {{ tutor.full_name || tutor.email }}
          </p>
          <p class="text-sm text-gray-600 dark:text-gray-300">{{ tutor.email }}</p>
          <p class="text-xs text-gray-500 dark:text-gray-400 mt-1">
            {{ $t('dashboard.tutor.timezoneLabel') }}
            <span class="font-medium">
              {{ tutor.timezone || $t('dashboard.tutor.timezoneUnknown') }}
            </span>
          </p>
          <p v-if="tutor.subjects?.length" class="text-xs text-gray-500 dark:text-gray-400 mt-1">
            {{ tutor.subjects.join(', ') }}
          </p>
          <p v-if="tutor.bio" class="text-sm text-gray-600 dark:text-gray-300 mt-2">
            {{ tutor.bio }}
          </p>
        </div>

        <p v-else class="text-sm text-gray-500 dark:text-gray-400">
          {{ $t('student.withTutor') }}
        </p>
      </template>
    </Card>
  </div>
</template>

<script setup>
import { computed, onMounted, ref, watch } from 'vue'
import Card from '../../../ui/Card.vue'
import Heading from '../../../ui/Heading.vue'
import { useAuthStore } from '../../auth/store/authStore'
import TutorSearchView from '../../tutor/views/TutorSearchView.vue'
import apiClient from '../../../utils/apiClient'

const authStore = useAuthStore()
const isSelfLearning = computed(() => authStore.user?.is_self_learning === true)

const tutor = ref(null)
const tutorLoading = ref(false)
const tutorError = ref(null)

async function loadTutor() {
  if (isSelfLearning.value) return

  tutorLoading.value = true
  tutorError.value = null

  try {
    const data = await apiClient.get('/student/my_tutor/')
    tutor.value = data?.tutor || null
  } catch (e) {
    // Якщо у студента ще немає активного тьютора – не вважаємо це критичною помилкою
    if (e?.response?.status === 404) {
      tutor.value = null
      return
    }
    tutorError.value = e?.response?.data?.detail || 'Не вдалося завантажити дані тьютора'
  } finally {
    tutorLoading.value = false
  }
}

onMounted(() => {
  loadTutor()
})

watch(isSelfLearning, (value) => {
  if (!value) {
    loadTutor()
  }
})
</script>
