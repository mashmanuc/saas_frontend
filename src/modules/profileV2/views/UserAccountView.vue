<script setup>
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { Button, FormField } from '@/assets2/ui-contract'
import { useMeStore } from '../services/meStore'
import { useI18n } from 'vue-i18n'
import AvatarUpload from '../../profile/components/AvatarUpload.vue'

const { t } = useI18n()
const router = useRouter()
const meStore = useMeStore()

const form = ref({
  firstName: '',
  lastName: '',
  email: '',
  timezone: '',
})

const loading = computed(() => meStore.loading)
const saving = computed(() => meStore.saving)
const isStudent = computed(() => meStore.user?.role === 'student')

onMounted(async () => {
  await meStore.load()
  if (meStore.user) {
    form.value.firstName = meStore.user.first_name || ''
    form.value.lastName = meStore.user.last_name || ''
    form.value.email = meStore.user.email || ''
    form.value.timezone = meStore.user.timezone || 'UTC'
  }
})

const handleSave = async () => {
  try {
    await meStore.save({
      first_name: form.value.firstName,
      last_name: form.value.lastName,
      timezone: form.value.timezone,
    })
  } catch (error) {
    console.error('Save failed:', error)
  }
}

const handleBack = () => {
  router.push('/profile-v2/overview')
}

const handleAvatarUpload = async (file) => {
  await meStore.uploadAvatar(file)
}

const handleAvatarDelete = async () => {
  await meStore.deleteAvatar()
}
</script>

<template>
  <div class="account-container">
    <header class="account-header">
      <h1>{{ t('profile.account.title') }}</h1>
      <Button variant="secondary" @click="handleBack">
        {{ t('common.back') }}
      </Button>
    </header>

    <div v-if="loading" class="loading-state">
      <p>{{ t('common.loading') }}</p>
    </div>

    <div v-else class="account-content">
      <!-- Avatar section: only for students -->
      <section v-if="isStudent" class="account-section">
        <h2>{{ t('profile.account.avatar') }}</h2>
        <div class="avatar-section">
          <AvatarUpload
            :image-url="meStore.avatarUrl"
            :fallback-name="meStore.fullName"
            :disabled="saving"
            @upload="handleAvatarUpload"
            @delete="handleAvatarDelete"
          />
        </div>
      </section>

      <section class="account-section">
        <h2>{{ t('profile.account.personalInfo') }}</h2>
        
        <form class="account-form" @submit.prevent="handleSave">
          <FormField
            v-model="form.firstName"
            :label="t('profile.fields.firstName')"
            type="text"
            required
          />
          
          <FormField
            v-model="form.lastName"
            :label="t('profile.fields.lastName')"
            type="text"
            required
          />
          
          <FormField
            v-model="form.email"
            :label="t('profile.fields.email')"
            type="email"
            disabled
            :helper-text="t('profile.account.emailHelper')"
          />
          
          <FormField
            v-model="form.timezone"
            :label="t('profile.fields.timezone')"
            type="text"
            :helper-text="t('profile.fields.timezoneHelper')"
          />
          
          <div class="form-actions">
            <Button
              variant="primary"
              type="submit"
              :loading="saving"
            >
              {{ t('common.save') }}
            </Button>
          </div>
        </form>
      </section>

      <section class="account-section">
        <h2>{{ t('profile.account.security') }}</h2>
        <p class="section-description">
          {{ t('profile.account.securityDescription') }}
        </p>
        <Button variant="outline" @click="router.push('/settings/security')">
          {{ t('profile.account.managePassword') }}
        </Button>
      </section>
    </div>
  </div>
</template>

<style scoped>
.account-container {
  max-width: 800px;
  margin: 0 auto;
  padding: var(--ui-space-2xl, 2rem);
}

.account-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: var(--ui-space-2xl, 2rem);
}

.account-header h1 {
  font-size: var(--ui-font-size-xl, 1.25rem);
  font-weight: var(--ui-font-weight-bold, 700);
  color: var(--ui-color-text, #0d4a3e);
  margin: 0;
}

.loading-state {
  text-align: center;
  padding: var(--ui-space-2xl, 2rem);
  color: var(--ui-color-text-muted, #1f6b5a);
}

.account-content {
  display: flex;
  flex-direction: column;
  gap: var(--ui-space-xl, 1.5rem);
}

.account-section {
  background: var(--ui-color-card, rgba(255, 255, 255, 0.9));
  border: 1px solid var(--ui-color-border, rgba(5, 150, 105, 0.2));
  border-radius: var(--ui-radius-lg, 0.75rem);
  padding: var(--ui-space-xl, 1.5rem);
}

.account-section h2 {
  font-size: var(--ui-font-size-lg, 1.125rem);
  font-weight: var(--ui-font-weight-semibold, 600);
  color: var(--ui-color-text, #0d4a3e);
  margin: 0 0 var(--ui-space-lg, 1rem);
}

.section-description {
  font-size: var(--ui-font-size-sm, 0.875rem);
  color: var(--ui-color-text-muted, #1f6b5a);
  margin: 0 0 var(--ui-space-md, 0.75rem);
}

.avatar-section {
  display: flex;
  gap: var(--ui-space-xl, 1.5rem);
  align-items: flex-start;
}

.avatar-display {
  flex-shrink: 0;
}

.avatar {
  width: 120px;
  height: 120px;
  border-radius: var(--ui-radius-full, 9999px);
  object-fit: cover;
  border: 2px solid var(--ui-color-border, rgba(5, 150, 105, 0.2));
}

.avatar-placeholder {
  width: 120px;
  height: 120px;
  border-radius: var(--ui-radius-full, 9999px);
  background: var(--ui-color-primary, #059669);
  color: var(--ui-color-primary-contrast, #ffffff);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 2rem;
  font-weight: var(--ui-font-weight-bold, 700);
}

.avatar-actions {
  display: flex;
  flex-direction: column;
  gap: var(--ui-space-sm, 0.5rem);
  flex: 1;
}

.avatar-input {
  display: none;
}

.account-form {
  display: flex;
  flex-direction: column;
  gap: var(--ui-space-lg, 1rem);
}

.form-actions {
  display: flex;
  justify-content: flex-end;
  padding-top: var(--ui-space-md, 0.75rem);
}

@media (max-width: 768px) {
  .account-container {
    padding: var(--ui-space-lg, 1rem);
  }
  
  .account-header {
    flex-direction: column;
    align-items: flex-start;
    gap: var(--ui-space-md, 0.75rem);
  }
}
</style>
