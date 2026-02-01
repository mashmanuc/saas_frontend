<script setup>
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { Button, FormField, Modal } from '@/assets2/ui-contract'
import { useMeStore } from '../services/meStore'
import { useI18n } from 'vue-i18n'

const { t } = useI18n()
const router = useRouter()
const meStore = useMeStore()

const form = ref({
  firstName: '',
  lastName: '',
  email: '',
  timezone: '',
})

const avatarFile = ref(null)
const avatarPreview = ref(null)
const showDeleteAvatarModal = ref(false)

const loading = computed(() => meStore.loading)
const saving = computed(() => meStore.saving)
const user = computed(() => meStore.user)
const avatarUrl = computed(() => meStore.avatarUrl)

onMounted(async () => {
  await meStore.load()
  if (meStore.user) {
    form.value.firstName = meStore.user.first_name || ''
    form.value.lastName = meStore.user.last_name || ''
    form.value.email = meStore.user.email || ''
    form.value.timezone = meStore.user.timezone || 'UTC'
  }
})

const handleAvatarChange = (event) => {
  const file = event.target.files?.[0]
  if (file) {
    avatarFile.value = file
    const reader = new FileReader()
    reader.onload = (e) => {
      avatarPreview.value = e.target.result
    }
    reader.readAsDataURL(file)
  }
}

const handleUploadAvatar = async () => {
  if (!avatarFile.value) return
  try {
    await meStore.uploadAvatar(avatarFile.value)
    avatarFile.value = null
    avatarPreview.value = null
  } catch (error) {
    console.error('Avatar upload failed:', error)
  }
}

const handleDeleteAvatar = async () => {
  try {
    await meStore.deleteAvatar()
    showDeleteAvatarModal.value = false
  } catch (error) {
    console.error('Avatar delete failed:', error)
  }
}

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
      <section class="account-section">
        <h2>{{ t('profile.account.avatar') }}</h2>
        
        <div class="avatar-section">
          <div class="avatar-display">
            <img
              v-if="avatarPreview || avatarUrl"
              :src="avatarPreview || avatarUrl"
              :alt="meStore.fullName"
              class="avatar"
            />
            <div v-else class="avatar-placeholder">
              {{ meStore.fullName.charAt(0).toUpperCase() }}
            </div>
          </div>
          
          <div class="avatar-actions">
            <input
              id="avatar-upload"
              type="file"
              accept="image/*"
              class="avatar-input"
              @change="handleAvatarChange"
            />
            <label for="avatar-upload">
              <Button variant="outline" as="span">
                {{ t('profile.account.chooseAvatar') }}
              </Button>
            </label>
            
            <Button
              v-if="avatarFile"
              variant="primary"
              @click="handleUploadAvatar"
            >
              {{ t('profile.account.uploadAvatar') }}
            </Button>
            
            <Button
              v-if="avatarUrl && !avatarFile"
              variant="danger"
              @click="showDeleteAvatarModal = true"
            >
              {{ t('profile.account.deleteAvatar') }}
            </Button>
          </div>
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

    <Modal
      v-model="showDeleteAvatarModal"
      :title="t('profile.account.deleteAvatarTitle')"
      type="confirm"
      size="sm"
    >
      <p>{{ t('profile.account.deleteAvatarMessage') }}</p>
      
      <template #footer>
        <Button
          variant="secondary"
          @click="showDeleteAvatarModal = false"
        >
          {{ t('common.cancel') }}
        </Button>
        <Button
          variant="danger"
          @click="handleDeleteAvatar"
        >
          {{ t('common.delete') }}
        </Button>
      </template>
    </Modal>
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
  
  .avatar-section {
    flex-direction: column;
    align-items: center;
  }
  
  .avatar-actions {
    width: 100%;
  }
}
</style>
