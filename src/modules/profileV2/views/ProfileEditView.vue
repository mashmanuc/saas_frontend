<script setup>
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { Button, FormField, Modal } from '@/assets2/ui-contract'
import { useProfileStore } from '../services/profileStore'
import { useI18n } from 'vue-i18n'

const { t } = useI18n()
const router = useRouter()
const profileStore = useProfileStore()

const form = ref({
  firstName: '',
  lastName: '',
  bio: '',
  headline: '',
  hourlyRate: null,
  experience: null,
})

const showDiscardModal = ref(false)
const hasChanges = ref(false)

const loading = computed(() => profileStore.loading)
const saving = computed(() => profileStore.saving)

onMounted(async () => {
  await profileStore.loadProfile()
  if (profileStore.user) {
    form.value.firstName = profileStore.user.first_name || ''
    form.value.lastName = profileStore.user.last_name || ''
  }
  if (profileStore.profile) {
    form.value.bio = profileStore.profile.bio || ''
    form.value.headline = profileStore.profile.headline || ''
    form.value.hourlyRate = profileStore.profile.hourly_rate || null
    form.value.experience = profileStore.profile.experience || null
  }
})

const handleInput = () => {
  hasChanges.value = true
}

const handleSave = async () => {
  try {
    const payload = {
      user: {
        first_name: form.value.firstName,
        last_name: form.value.lastName,
      },
    }
    
    // Використовуємо tutor_profile для тьюторів, student_profile для студентів
    if (profileStore.isTutor) {
      payload.tutor_profile = {
        bio: form.value.bio,
        headline: form.value.headline,
        hourly_rate: form.value.hourlyRate,
        experience: form.value.experience,
      }
    } else {
      payload.student_profile = {
        bio: form.value.bio,
      }
    }
    
    await profileStore.saveProfile(payload)
    hasChanges.value = false
    router.push('/profile-v2/overview')
  } catch (error) {
    console.error('Save failed:', error)
  }
}

const handleCancel = () => {
  if (hasChanges.value) {
    showDiscardModal.value = true
  } else {
    router.push('/profile-v2/overview')
  }
}

const confirmDiscard = () => {
  showDiscardModal.value = false
  router.push('/profile-v2/overview')
}
</script>

<template>
  <div class="profile-edit-container">
    <header class="profile-edit-header">
      <h1>{{ t('profile.edit.title') }}</h1>
      <p class="subtitle">{{ t('profile.edit.subtitle') }}</p>
    </header>

    <div v-if="loading" class="loading-state">
      <p>{{ t('common.loading') }}</p>
    </div>

    <form v-else class="profile-edit-form" @submit.prevent="handleSave">
      <section class="form-section">
        <h2>{{ t('profile.sections.basicInfo') }}</h2>
        
        <div class="form-row">
          <FormField
            v-model="form.firstName"
            :label="t('profile.fields.firstName')"
            type="text"
            required
            @input="handleInput"
          />
          
          <FormField
            v-model="form.lastName"
            :label="t('profile.fields.lastName')"
            type="text"
            required
            @input="handleInput"
          />
        </div>

        <FormField
          v-model="form.headline"
          :label="t('profile.fields.headline')"
          type="text"
          :helper-text="t('profile.fields.headlineHelper')"
          :max-length="120"
          show-char-count
          @input="handleInput"
        />

        <FormField
          v-model="form.bio"
          :label="t('profile.fields.bio')"
          type="textarea"
          :helper-text="t('profile.fields.bioHelper')"
          :max-length="1000"
          show-char-count
          @input="handleInput"
        />
      </section>

      <section v-if="profileStore.isTutor" class="form-section">
        <h2>{{ t('profile.sections.professional') }}</h2>
        
        <FormField
          v-model.number="form.hourlyRate"
          :label="t('profile.fields.hourlyRate')"
          type="number"
          :helper-text="t('profile.fields.hourlyRateHelper')"
          @input="handleInput"
        />

        <FormField
          v-model.number="form.experience"
          :label="t('profile.fields.experience')"
          type="number"
          :helper-text="t('profile.fields.experienceHelper')"
          @input="handleInput"
        />
      </section>

      <div class="form-actions">
        <Button
          variant="secondary"
          type="button"
          @click="handleCancel"
        >
          {{ t('common.cancel') }}
        </Button>
        
        <Button
          variant="primary"
          type="submit"
          :loading="saving"
          :disabled="!hasChanges"
        >
          {{ t('common.save') }}
        </Button>
      </div>
    </form>

    <Modal
      v-model="showDiscardModal"
      :title="t('profile.edit.discardTitle')"
      type="confirm"
      size="sm"
    >
      <p>{{ t('profile.edit.discardMessage') }}</p>
      
      <template #footer>
        <Button
          variant="secondary"
          @click="showDiscardModal = false"
        >
          {{ t('common.cancel') }}
        </Button>
        <Button
          variant="danger"
          @click="confirmDiscard"
        >
          {{ t('profile.edit.discardConfirm') }}
        </Button>
      </template>
    </Modal>
  </div>
</template>

<style scoped>
.profile-edit-container {
  max-width: 800px;
  margin: 0 auto;
  padding: var(--ui-space-2xl, 2rem);
}

.profile-edit-header {
  margin-bottom: var(--ui-space-2xl, 2rem);
}

.profile-edit-header h1 {
  font-size: var(--ui-font-size-xl, 1.25rem);
  font-weight: var(--ui-font-weight-bold, 700);
  color: var(--ui-color-text, #0d4a3e);
  margin: 0 0 var(--ui-space-sm, 0.5rem);
}

.subtitle {
  font-size: var(--ui-font-size-sm, 0.875rem);
  color: var(--ui-color-text-muted, #1f6b5a);
  margin: 0;
}

.loading-state {
  text-align: center;
  padding: var(--ui-space-2xl, 2rem);
  color: var(--ui-color-text-muted, #1f6b5a);
}

.profile-edit-form {
  display: flex;
  flex-direction: column;
  gap: var(--ui-space-2xl, 2rem);
}

.form-section {
  background: var(--ui-color-card, rgba(255, 255, 255, 0.9));
  border: 1px solid var(--ui-color-border, rgba(5, 150, 105, 0.2));
  border-radius: var(--ui-radius-lg, 0.75rem);
  padding: var(--ui-space-xl, 1.5rem);
}

.form-section h2 {
  font-size: var(--ui-font-size-lg, 1.125rem);
  font-weight: var(--ui-font-weight-semibold, 600);
  color: var(--ui-color-text, #0d4a3e);
  margin: 0 0 var(--ui-space-lg, 1rem);
}

.form-row {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: var(--ui-space-lg, 1rem);
}

.form-actions {
  display: flex;
  justify-content: flex-end;
  gap: var(--ui-space-sm, 0.5rem);
  padding-top: var(--ui-space-lg, 1rem);
}

@media (max-width: 768px) {
  .profile-edit-container {
    padding: var(--ui-space-lg, 1rem);
  }
  
  .form-row {
    grid-template-columns: 1fr;
  }
  
  .form-actions {
    flex-direction: column-reverse;
  }
  
  .form-actions button {
    width: 100%;
  }
}
</style>
