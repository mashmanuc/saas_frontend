<template>
  <div class="space-y-4">
    <h1 class="text-2xl font-semibold">{{ $t('tutor.search.title') }}</h1>

    <div v-if="!isSelfLearning" class="rounded-lg border border-border-subtle bg-surface-muted/30 p-4">
      <p class="text-sm text-gray-600 dark:text-gray-300">
        {{ $t('student.withTutor') }}
      </p>
    </div>

    <div v-else class="space-y-4">
      <p class="text-sm text-gray-600 dark:text-gray-300">
        {{ $t('student.withoutTutor') }}
      </p>

      <div v-if="isLoading" class="text-sm text-gray-500 dark:text-gray-400">
        {{ $t('loader.loading') }}
      </div>

      <p v-else-if="error" class="text-sm text-red-600">{{ error }}</p>

      <div v-else>
        <div
          v-if="tutors.length"
          class="grid gap-4 md:grid-cols-2 lg:grid-cols-3"
        >
          <article
            v-for="tutor in tutors"
            :key="tutor.id"
            class="rounded-lg border border-border-subtle bg-surface-muted/40 p-4 flex flex-col justify-between gap-3"
          >
            <header class="space-y-1">
              <h2 class="font-semibold text-base text-foreground">
                {{ tutor.full_name || tutor.email }}
              </h2>
              <p class="text-xs text-gray-500 dark:text-gray-400">
                {{ tutor.email }}
              </p>
            </header>

            <p v-if="tutor.bio" class="text-sm text-gray-600 dark:text-gray-300 line-clamp-3">
              {{ tutor.bio }}
            </p>

            <p v-if="tutor.subjects?.length" class="text-xs text-gray-500 dark:text-gray-400">
              {{ tutor.subjects.join(', ') }}
            </p>

            <div class="flex items-center justify-between mt-2">
              <button
                type="button"
                class="inline-flex items-center justify-center rounded-md border border-transparent bg-primary px-3 py-1.5 text-sm font-medium text-white shadow-sm hover:bg-primary/90 disabled:opacity-60 disabled:cursor-not-allowed"
                :disabled="requestLoadingId === tutor.id"
                @click="requestTutor(tutor.id)"
              >
                <span v-if="requestLoadingId === tutor.id">
                  {{ $t('loader.loading') }}
                </span>
                <span v-else>
                  {{ $t('tutor.request.button') }}
                </span>
              </button>

              <span v-if="requestSuccessId === tutor.id" class="text-xs text-emerald-600 dark:text-emerald-400">
                ✓
              </span>
              <span v-else-if="requestErrorId === tutor.id" class="text-xs text-red-600">
                !
              </span>
            </div>
          </article>
        </div>

        <p v-else class="text-sm text-gray-500 dark:text-gray-400">
          {{ $t('dashboard.tutor.empty') }}
        </p>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed, onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useAuthStore } from '../../auth/store/authStore'
import apiClient from '../../../utils/apiClient'
import { notifySuccess, notifyError } from '../../../utils/notify'

const authStore = useAuthStore()
const { t } = useI18n()

const tutors = ref([])
const isLoading = ref(false)
const error = ref(null)

const requestLoadingId = ref(null)
const requestSuccessId = ref(null)
const requestErrorId = ref(null)

const isSelfLearning = computed(() => authStore.user?.is_self_learning === true)

async function loadTutors() {
  if (!isSelfLearning.value) return

  isLoading.value = true
  error.value = null

  try {
    const data = await apiClient.get('/tutors/public-list/')
    tutors.value = data
  } catch (e) {
    error.value = e?.response?.data?.detail || t('tutor.search.loadError')
  } finally {
    isLoading.value = false
  }
}

async function requestTutor(tutorId) {
  requestLoadingId.value = tutorId
  requestSuccessId.value = null
  requestErrorId.value = null

  try {
    await apiClient.post('/student/request_tutor/', { tutor_id: tutorId })
    await authStore.reloadUser()
    requestSuccessId.value = tutorId
    notifySuccess(t('tutor.request.success') || 'Запит надіслано')
  } catch (e) {
    requestErrorId.value = tutorId
    notifyError(t('tutor.request.error') || 'Не вдалося надіслати запит')
  } finally {
    requestLoadingId.value = null
  }
}

onMounted(() => {
  loadTutors()
})
</script>
