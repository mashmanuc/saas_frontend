<template>
  <div class="space-y-6">
    <!-- Loading State -->
    <div v-if="meStore.loading" class="flex justify-center py-8">
      <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
    </div>

    <!-- Error State -->
    <div v-else-if="meStore.error" class="rounded-lg bg-destructive/10 p-4 text-sm text-destructive">
      {{ meStore.error }}
    </div>

    <template v-else>
      <!-- Avatar Section: Only for Student -->
      <section v-if="isStudent" class="space-y-4">
        <h3 class="text-lg font-medium">{{ $t('profile.avatar.title') }}</h3>
        <AvatarUpload
          :image-url="meStore.avatarUrl"
          :fallback-name="meStore.fullName"
          :disabled="meStore.saving"
          @upload="handleAvatarUpload"
          @delete="handleAvatarDelete"
        />
      </section>

      <hr v-if="isStudent" class="border-border" />

      <!-- Personal Info Section -->
      <section class="space-y-4">
        <h3 class="text-lg font-medium">{{ $t('userProfile.account.personalInfo') }}</h3>

        <div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Input
            :label="$t('userProfile.account.firstName')"
            v-model="form.first_name"
            :disabled="meStore.saving"
          />
          <Input
            :label="$t('userProfile.account.lastName')"
            v-model="form.last_name"
            :disabled="meStore.saving"
          />
        </div>

        <Input
          :label="$t('userProfile.account.username')"
          v-model="form.username"
          :disabled="meStore.saving"
        />

        <Input
          :label="$t('userProfile.account.timezone')"
          v-model="form.timezone"
          :disabled="meStore.saving"
        />

        <Button
          variant="primary"
          :loading="meStore.saving"
          :disabled="meStore.saving || !hasChanges"
          @click="savePersonalInfo"
        >
          {{ $t('userProfile.account.save') }}
        </Button>
      </section>

      <hr class="border-border" />

      <!-- Email Section -->
      <section class="space-y-4">
        <h3 class="text-lg font-medium">{{ $t('userProfile.account.email') }}</h3>
        <p class="text-sm text-muted-foreground">
          {{ $t('userProfile.account.emailDescription') }}
        </p>

        <div class="flex items-center gap-4">
          <div class="flex-1">
            <Input
              :label="$t('profile.fields.email')"
              :model-value="meStore.user?.email"
              disabled
            />
          </div>
          <Button variant="outline" @click="goToChangeEmail">
            {{ $t('userProfile.account.changeEmail') }}
          </Button>
        </div>
      </section>

      <hr class="border-border" />

      <!-- Password Section -->
      <section class="space-y-4">
        <h3 class="text-lg font-medium">{{ $t('userProfile.account.password') }}</h3>
        <p class="text-sm text-muted-foreground">
          {{ $t('userProfile.account.passwordDescription') }}
        </p>

        <Button variant="outline" @click="goToChangePassword">
          {{ $t('userProfile.account.changePassword') }}
        </Button>
      </section>
    </template>
  </div>
</template>

<script setup>
import { reactive, watch, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/authStore'
import Input from '@/ui/Input.vue'
import Button from '@/ui/Button.vue'
import AvatarUpload from '../AvatarUpload.vue'
import { useMeStore } from '../../store/meStore'

const router = useRouter()
const meStore = useMeStore()
const authStore = useAuthStore()

const isStudent = computed(() => authStore.user?.role === 'student')
const isTutor = computed(() => authStore.user?.role === 'tutor')

const form = reactive({
  first_name: '',
  last_name: '',
  username: '',
  timezone: 'Europe/Kyiv',
})

const initialForm = reactive({
  first_name: '',
  last_name: '',
  username: '',
  timezone: 'Europe/Kyiv',
})

const hasChanges = computed(() => {
  return form.first_name !== initialForm.first_name ||
    form.last_name !== initialForm.last_name ||
    form.username !== initialForm.username ||
    form.timezone !== initialForm.timezone
})

// Load user data on mount
onMounted(async () => {
  if (!meStore.user && !meStore.loading) {
    await meStore.load()
  }
})

// Sync form with store data
watch(
  () => meStore.user,
  (user) => {
    if (!user) return
    const data = {
      first_name: user.first_name || '',
      last_name: user.last_name || '',
      username: user.username || '',
      timezone: user.timezone || 'Europe/Kyiv',
    }
    Object.assign(form, data)
    Object.assign(initialForm, { ...data })
  },
  { immediate: true }
)

async function savePersonalInfo() {
  await meStore.save({
    first_name: form.first_name,
    last_name: form.last_name,
    username: form.username,
    timezone: form.timezone,
  })
  // Update initial form after successful save
  Object.assign(initialForm, {
    first_name: form.first_name,
    last_name: form.last_name,
    username: form.username,
    timezone: form.timezone,
  })
}

async function handleAvatarUpload(file) {
  await meStore.uploadAvatar(file)
}

async function handleAvatarDelete() {
  await meStore.deleteAvatar()
}

function goToChangeEmail() {
  router.push({ name: 'change-email' })
}

function goToChangePassword() {
  router.push({ name: 'change-password' })
}
</script>
