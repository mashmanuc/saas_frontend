<script setup lang="ts">
// F17: Profile Step Component
import { ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { User, Camera } from 'lucide-vue-next'
import type { OnboardingStep } from '../../api/onboarding'

defineProps<{
  step: OnboardingStep | null
}>()

const emit = defineEmits<{
  complete: []
  skip: []
}>()

const { t } = useI18n()

const displayName = ref('')
const avatarPreview = ref<string | null>(null)

function handleAvatarChange(event: Event) {
  const input = event.target as HTMLInputElement
  if (input.files && input.files[0]) {
    const reader = new FileReader()
    reader.onload = (e) => {
      avatarPreview.value = e.target?.result as string
    }
    reader.readAsDataURL(input.files[0])
  }
}
</script>

<template>
  <div class="profile-step">
    <div class="step-header">
      <User :size="32" class="header-icon" />
      <h2>{{ t('onboarding.profile.title') }}</h2>
      <p>{{ t('onboarding.profile.description') }}</p>
    </div>

    <div class="profile-form">
      <!-- Avatar Upload -->
      <div class="avatar-upload">
        <div class="avatar-preview">
          <img v-if="avatarPreview" :src="avatarPreview" alt="Avatar" />
          <User v-else :size="40" />
        </div>
        <label class="avatar-button">
          <Camera :size="16" />
          {{ t('onboarding.profile.uploadPhoto') }}
          <input type="file" accept="image/*" @change="handleAvatarChange" />
        </label>
      </div>

      <!-- Name Input -->
      <div class="form-group">
        <label>{{ t('onboarding.profile.displayName') }}</label>
        <input
          v-model="displayName"
          type="text"
          :placeholder="t('onboarding.profile.namePlaceholder')"
        />
      </div>
    </div>
  </div>
</template>

<style scoped>
.profile-step {
  max-width: 450px;
  margin: 0 auto;
  padding: 40px;
  background: var(--color-bg-primary, white);
  border-radius: 16px;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.08);
}

.step-header {
  text-align: center;
  margin-bottom: 32px;
}

.header-icon {
  color: var(--color-primary, #3b82f6);
  margin-bottom: 16px;
}

.step-header h2 {
  margin: 0 0 8px;
  font-size: 24px;
  font-weight: 700;
}

.step-header p {
  margin: 0;
  color: var(--color-text-secondary, #6b7280);
}

.profile-form {
  display: flex;
  flex-direction: column;
  gap: 24px;
}

/* Avatar Upload */
.avatar-upload {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 16px;
}

.avatar-preview {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 100px;
  height: 100px;
  background: var(--color-bg-secondary, #f5f5f5);
  border-radius: 50%;
  overflow: hidden;
  color: var(--color-text-secondary, #6b7280);
}

.avatar-preview img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.avatar-button {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 16px;
  background: var(--color-bg-secondary, #f5f5f5);
  border-radius: 8px;
  font-size: 14px;
  color: var(--color-text-primary, #111827);
  cursor: pointer;
  transition: background 0.15s;
}

.avatar-button:hover {
  background: var(--color-bg-tertiary, #e5e7eb);
}

.avatar-button input {
  display: none;
}

/* Form Group */
.form-group {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.form-group label {
  font-size: 14px;
  font-weight: 500;
  color: var(--color-text-primary, #111827);
}

.form-group input {
  padding: 12px 16px;
  border: 1px solid var(--color-border, #d1d5db);
  border-radius: 8px;
  font-size: 14px;
}

.form-group input:focus {
  outline: none;
  border-color: var(--color-primary, #3b82f6);
}
</style>
