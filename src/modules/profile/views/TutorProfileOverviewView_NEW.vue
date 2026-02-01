<template>
  <div class="space-y-6">
    <Card class="space-y-2">
      <div class="flex flex-wrap items-start justify-between gap-4">
        <div>
          <Heading :level="1">
            {{ $t('tutor.profile.title') }}
          </Heading>
          <p class="text-sm text-muted-foreground">
            {{ $t('tutor.profile.subtitle') }}
          </p>
        </div>
        <div class="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" @click="goToPreview">
            {{ $t('tutor.profile.previewButton') }}
          </Button>
          <Button variant="primary" size="sm" @click="goToEdit">
            {{ $t('tutor.profile.editButton') }}
          </Button>
        </div>
      </div>
    </Card>

    <Card v-if="errorMessage" class="border-red-200 bg-red-50 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-200">
      {{ errorMessage }}
    </Card>

    <div class="grid gap-6">
      <Card class="space-y-6">
        <div class="flex items-center justify-between">
          <div>
            <h3 class="text-lg font-semibold text-foreground">
              {{ $t('tutor.profile.publishStatus') }}
            </h3>
            <p class="text-sm text-muted-foreground">
              {{ profileStore.profile?.is_published ? $t('tutor.profile.published') : $t('tutor.profile.draft') }}
            </p>
          </div>
          <div
            class="rounded-full px-3 py-1 text-xs font-medium"
            :class="profileStore.profile?.is_published 
              ? 'bg-green-100 text-green-700 dark:bg-green-950/40 dark:text-green-200' 
              : 'bg-yellow-100 text-yellow-700 dark:bg-yellow-950/40 dark:text-yellow-200'"
          >
            {{ profileStore.profile?.is_published ? $t('tutor.profile.live') : $t('tutor.profile.notPublished') }}
          </div>
        </div>

        <div class="grid gap-6 sm:grid-cols-2">
          <InfoRow :label="$t('tutor.profile.headline')" :value="profileStore.profile?.headline || '—'" />
          <InfoRow :label="$t('tutor.profile.experience')" :value="experienceLabel" />
          <InfoRow :label="$t('tutor.profile.hourlyRate')" :value="rateLabel" />
          <InfoRow :label="$t('tutor.profile.currency')" :value="profileStore.profile?.currency || 'UAH'" />
        </div>

        <div>
          <h3 class="text-sm font-semibold text-foreground mb-2">
            {{ $t('tutor.profile.bio') }}
          </h3>
          <p class="text-sm text-muted-foreground whitespace-pre-line">
            {{ profileStore.profile?.bio || $t('tutor.profile.bioEmpty') }}
          </p>
        </div>

        <div>
          <h3 class="text-sm font-semibold text-foreground mb-2">
            {{ $t('tutor.profile.subjects') }}
          </h3>
          <div v-if="subjects && subjects.length" class="flex flex-wrap gap-2">
            <span
              v-for="subject in subjects"
              :key="subject"
              class="rounded-full bg-primary/10 px-3 py-1 text-sm font-medium text-primary"
            >
              {{ subject }}
            </span>
          </div>
          <p v-else class="text-sm text-muted-foreground">
            {{ $t('tutor.profile.subjectsEmpty') }}
          </p>
        </div>
      </Card>

      <Card class="space-y-4">
        <h3 class="text-lg font-semibold text-foreground">
          {{ $t('tutor.profile.completeness.title') }}
        </h3>
        <div class="space-y-2">
          <div class="flex items-center justify-between text-sm">
            <span class="text-muted-foreground">{{ $t('tutor.profile.completeness.score') }}</span>
            <span class="font-semibold text-foreground">{{ profileStore.completenessScore }}%</span>
          </div>
          <div class="h-2 w-full overflow-hidden rounded-full bg-surface-muted">
            <div
              class="h-full bg-primary transition-all duration-300"
              :style="{ width: `${profileStore.completenessScore}%` }"
            />
          </div>
        </div>
        <div v-if="profileStore.missingFields.length" class="text-sm text-muted-foreground">
          {{ $t('tutor.profile.completeness.missing') }}: {{ missingFieldsLabel }}
        </div>
      </Card>
    </div>
  </div>
</template>

<script setup>
import { computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import Button from '@/ui/Button.vue'
import Card from '@/ui/Card.vue'
import Heading from '@/ui/Heading.vue'
import InfoRow from '../components/InfoRow.vue'
import { useProfileStore } from '../store/profileStore'
import { useAuthStore } from '../../auth/store/authStore'

const router = useRouter()
const profileStore = useProfileStore()
const authStore = useAuthStore()

const subjects = computed(() => profileStore.profile?.subjects || [])
const errorMessage = computed(() => profileStore.error)

const experienceLabel = computed(() => {
  const exp = profileStore.profile?.experience
  if (!exp) return '—'
  return `${exp} ${exp === 1 ? 'рік' : exp < 5 ? 'роки' : 'років'}`
})

const rateLabel = computed(() => {
  const rate = profileStore.profile?.hourly_rate
  if (!rate) return '—'
  const currency = profileStore.profile?.currency || 'UAH'
  return `${rate} ${currency}`
})

const missingFieldsLabel = computed(() => {
  return profileStore.missingFields.map(field => {
    const labels = {
      bio: 'Біографія',
      headline: 'Заголовок',
      hourly_rate: 'Ставка',
      avatar: 'Аватар'
    }
    return labels[field] || field
  }).join(', ')
})

async function ensureProfileLoaded() {
  if (!authStore.isAuthenticated) return
  if (profileStore.initialized || profileStore.loading) return
  try {
    await profileStore.loadProfile()
  } catch (error) {
    console.error('Failed to load profile', error)
  }
}

function goToEdit() {
  router.push('/tutor/profile/edit')
}

function goToPreview() {
  if (profileStore.user?.id) {
    router.push(`/profile/${profileStore.user.id}`)
  }
}

onMounted(() => {
  ensureProfileLoaded()
})
</script>
