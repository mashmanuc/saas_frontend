<template>
  <div class="space-y-6">
    <Card class="space-y-2">
      <div class="flex flex-wrap items-start justify-between gap-4">
        <div>
          <Heading :level="1">
            {{ $t('profile.title') }}
          </Heading>
          <p class="text-sm text-muted-foreground">
            {{ $t('profile.subtitle') }}
          </p>
        </div>
        <div class="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" @click="goToSettings">
            {{ $t('profile.settingsButton') }}
          </Button>
          <Button variant="primary" size="sm" @click="goToEdit">
            {{ $t('profile.editButton') }}
          </Button>
        </div>
      </div>
    </Card>

    <Card v-if="errorMessage" class="border-red-200 bg-red-50 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-200">
      {{ errorMessage }}
    </Card>

    <div class="grid gap-6 lg:grid-cols-3">
      <Card class="lg:col-span-1 flex flex-col items-center justify-center">
        <AvatarUpload
          :image-url="profileStore.avatarUrl"
          :fallback-name="profileStore.fullName || profileStore.user?.email || '?'"
          :disabled="profileStore.loading"
          @upload="handleAvatarUpload"
          @delete="handleAvatarDelete"
        />
      </Card>

      <Card class="lg:col-span-2 space-y-6">
        <div class="grid gap-6 sm:grid-cols-2">
          <InfoRow :label="$t('profile.email')" :value="profileStore.user?.email" />
          <InfoRow :label="$t('profile.role')" :value="roleLabel" />
          <InfoRow :label="$t('profile.timezone')" :value="timezoneLabel" />
          <InfoRow v-if="profileStore.profile?.headline" :label="$t('profile.headline')" :value="profileStore.profile?.headline" />
        </div>

        <div>
          <h3 class="text-sm font-semibold text-foreground mb-2">
            {{ $t('profile.bio') }}
          </h3>
          <p class="text-sm text-muted-foreground whitespace-pre-line">
            {{ profileStore.profile?.bio || $t('profile.bioEmpty') }}
          </p>
        </div>

        <div>
          <h3 class="text-sm font-semibold text-foreground mb-2">
            {{ $t('profile.subjectsTitle') }}
          </h3>
          <div v-if="subjects && subjects.length" class="flex flex-wrap gap-2">
            <span
              v-for="subject in subjects"
              :key="subject"
              class="rounded-full bg-surface-muted px-3 py-1 text-xs font-medium text-muted-foreground"
            >
              {{ subject }}
            </span>
          </div>
          <p v-else class="text-sm text-muted-foreground">
            {{ $t('profile.subjectsEmpty') }}
          </p>
        </div>
      </Card>
    </div>

    <div class="grid gap-6 lg:grid-cols-2">
      <ProfileCard
        :title="$t('profile.accountSettingsTitle')"
        :subtitle="$t('profile.accountSettingsDescription')"
      >
        <div class="flex items-center justify-between">
          <p class="text-sm text-muted-foreground">
            {{ $t('profile.accountSettingsDescription') }}
          </p>
          <button
            type="button"
            class="text-sm font-medium text-primary hover:underline"
            @click="goToSettings"
          >
            {{ $t('profile.settingsButton') }}
          </button>
        </div>
      </ProfileCard>
    </div>
  </div>
</template>

<script setup>
import { computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import Button from '../../../ui/Button.vue'
import Card from '../../../ui/Card.vue'
import Heading from '../../../ui/Heading.vue'
import AvatarUpload from '../components/AvatarUpload.vue'
import ProfileCard from '../components/ProfileCard.vue'
import InfoRow from '../components/InfoRow.vue'
import { useProfileStore } from '../store/profileStore'
import { useAuthStore } from '../../auth/store/authStore'

const router = useRouter()
const profileStore = useProfileStore()
const authStore = useAuthStore()

const roleLabel = computed(() => {
  const role = profileStore.user?.role
  if (!role) return ''
  return role
    .split('_')
    .map((chunk) => chunk.toLowerCase())
    .map((chunk) => chunk.replace(chunk[0], chunk[0]?.toUpperCase()))
    .join(' ')
})

const timezoneLabel = computed(() => profileStore.user?.timezone || profileStore.settings?.timezone || 'UTC')
const subjects = computed(() => profileStore.profile?.subjects || [])
const errorMessage = computed(() => profileStore.error)

async function ensureProfileLoaded() {
  if (!authStore.isAuthenticated) return
  if (profileStore.initialized || profileStore.loading) return
  try {
    await profileStore.loadProfile()
  } catch (error) {
    console.error('Failed to load profile', error)
  }
}

function handleAvatarUpload(file) {
  profileStore.uploadAvatar(file).catch((error) => {
    console.error('avatar upload failed', error)
  })
}

function handleAvatarDelete() {
  profileStore.removeAvatar().catch((error) => {
    console.error('avatar delete failed', error)
  })
}

function goToEdit() {
  router.push('/dashboard/profile/edit')
}

function goToSettings() {
  router.push('/dashboard/profile/settings')
}

onMounted(() => {
  ensureProfileLoaded()
})
</script>
