<template>
  <div class="container mx-auto px-4 py-8">
    <div v-if="loading" class="flex items-center justify-center py-12">
      <div class="flex flex-col items-center gap-3">
        <div class="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
        <p class="text-sm text-muted-foreground">{{ $t('ui.loading') }}</p>
      </div>
    </div>

    <div v-else-if="error" class="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-200">
      {{ error }}
    </div>

    <TutorPublicProfile
      v-else-if="tutorProfile && user"
      :profile="tutorProfile"
      :user="user"
      :rating="rating"
      :reviews-count="reviewsCount"
      @contact="handleContact"
      @share="handleShare"
    >
      <template #reviews>
        <div v-if="reviewsCount > 0" class="mt-6">
          <!-- Reviews section можна додати пізніше -->
        </div>
      </template>
    </TutorPublicProfile>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import TutorPublicProfile from '../components/TutorPublicProfile.vue'
import { getTutorProfile } from '@/api/users'
import { notifySuccess, notifyError } from '@/utils/notify'
import { i18n } from '@/i18n'

const route = useRoute()
const router = useRouter()

const userId = ref(route.params.userId as string)
const tutorProfile = ref(null)
const user = ref(null)
const rating = ref(0)
const reviewsCount = ref(0)
const loading = ref(false)
const error = ref('')

onMounted(async () => {
  await loadProfile()
})

async function loadProfile() {
  loading.value = true
  error.value = ''

  try {
    const data = await getTutorProfile(userId.value)
    user.value = data.user
    tutorProfile.value = data.tutor_profile
    
    // TODO: Fetch rating and reviews from reviews API
    rating.value = 0
    reviewsCount.value = 0
  } catch (err: any) {
    if (err?.response?.status === 404) {
      error.value = i18n.global.t('users.profile.notFound')
    } else {
      error.value = err?.response?.data?.detail || i18n.global.t('ui.error')
    }
  } finally {
    loading.value = false
  }
}

function handleContact() {
  // Redirect to inquiry creation
  router.push(`/book/${userId.value}`)
}

function handleShare() {
  notifySuccess(i18n.global.t('ui.copied'))
}
</script>
