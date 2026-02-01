<script setup>
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { Button } from '@/assets2/ui-contract'
import { useProfileStore } from '../services/profileStore'
import { useI18n } from 'vue-i18n'

const { t } = useI18n()
const router = useRouter()
const profileStore = useProfileStore()

const loading = computed(() => profileStore.loading)
const user = computed(() => profileStore.user)
const profile = computed(() => profileStore.profile)
const avatarUrl = computed(() => profileStore.avatarUrl)
const fullName = computed(() => profileStore.fullName)
const completenessScore = computed(() => profileStore.completenessScore)

onMounted(async () => {
  await profileStore.loadProfile()
})

const handleEdit = () => {
  router.push('/profile-v2/edit')
}

const handleAccount = () => {
  router.push('/profile-v2/account')
}
</script>

<template>
  <div class="profile-overview-container">
    <header class="profile-overview-header">
      <h1>{{ t('profile.overview.title') }}</h1>
      <Button variant="primary" @click="handleEdit">
        {{ t('profile.overview.editProfile') }}
      </Button>
    </header>

    <div v-if="loading" class="loading-state">
      <p>{{ t('common.loading') }}</p>
    </div>

    <div v-else class="profile-content">
      <section class="profile-card">
        <div class="profile-header-section">
          <div class="avatar-container">
            <img
              v-if="avatarUrl"
              :src="avatarUrl"
              :alt="fullName"
              class="avatar"
            />
            <div v-else class="avatar-placeholder">
              {{ fullName.charAt(0).toUpperCase() }}
            </div>
          </div>
          
          <div class="profile-info">
            <h2 class="profile-name">{{ fullName }}</h2>
            <p v-if="user?.email" class="profile-email">{{ user.email }}</p>
            <p v-if="profile?.headline" class="profile-headline">{{ profile.headline }}</p>
          </div>
        </div>

        <div v-if="profileStore.isTutor" class="completeness-section">
          <div class="completeness-header">
            <span>{{ t('profile.overview.completeness') }}</span>
            <span class="completeness-score">{{ completenessScore }}%</span>
          </div>
          <div class="completeness-bar">
            <div 
              class="completeness-fill" 
              :style="{ width: `${completenessScore}%` }"
            />
          </div>
        </div>
      </section>

      <section class="profile-details">
        <h3>{{ t('profile.sections.about') }}</h3>
        <p v-if="profile?.bio" class="bio-text">{{ profile.bio }}</p>
        <p v-else class="empty-state">{{ t('profile.overview.noBio') }}</p>
      </section>

      <section v-if="profileStore.isTutor" class="profile-details">
        <h3>{{ t('profile.sections.professional') }}</h3>
        <div class="details-grid">
          <div class="detail-item">
            <span class="detail-label">{{ t('profile.fields.hourlyRate') }}</span>
            <span class="detail-value">
              {{ profile?.hourly_rate ? `${profile.hourly_rate} UAH` : t('common.notSet') }}
            </span>
          </div>
          <div class="detail-item">
            <span class="detail-label">{{ t('profile.fields.experience') }}</span>
            <span class="detail-value">
              {{ profile?.experience ? `${profile.experience} ${t('common.years')}` : t('common.notSet') }}
            </span>
          </div>
        </div>
      </section>

      <section class="profile-actions">
        <Button variant="outline" @click="handleAccount">
          {{ t('profile.overview.accountSettings') }}
        </Button>
      </section>
    </div>
  </div>
</template>

<style scoped>
.profile-overview-container {
  max-width: 900px;
  margin: 0 auto;
  padding: var(--ui-space-2xl, 2rem);
}

.profile-overview-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: var(--ui-space-2xl, 2rem);
}

.profile-overview-header h1 {
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

.profile-content {
  display: flex;
  flex-direction: column;
  gap: var(--ui-space-xl, 1.5rem);
}

.profile-card {
  background: var(--ui-color-card, rgba(255, 255, 255, 0.9));
  border: 1px solid var(--ui-color-border, rgba(5, 150, 105, 0.2));
  border-radius: var(--ui-radius-lg, 0.75rem);
  padding: var(--ui-space-xl, 1.5rem);
}

.profile-header-section {
  display: flex;
  gap: var(--ui-space-lg, 1rem);
  align-items: flex-start;
}

.avatar-container {
  flex-shrink: 0;
}

.avatar {
  width: 80px;
  height: 80px;
  border-radius: var(--ui-radius-full, 9999px);
  object-fit: cover;
  border: 2px solid var(--ui-color-border, rgba(5, 150, 105, 0.2));
}

.avatar-placeholder {
  width: 80px;
  height: 80px;
  border-radius: var(--ui-radius-full, 9999px);
  background: var(--ui-color-primary, #059669);
  color: var(--ui-color-primary-contrast, #ffffff);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: var(--ui-font-size-xl, 1.25rem);
  font-weight: var(--ui-font-weight-bold, 700);
}

.profile-info {
  flex: 1;
}

.profile-name {
  font-size: var(--ui-font-size-lg, 1.125rem);
  font-weight: var(--ui-font-weight-semibold, 600);
  color: var(--ui-color-text, #0d4a3e);
  margin: 0 0 var(--ui-space-xs, 0.25rem);
}

.profile-email {
  font-size: var(--ui-font-size-sm, 0.875rem);
  color: var(--ui-color-text-muted, #1f6b5a);
  margin: 0 0 var(--ui-space-sm, 0.5rem);
}

.profile-headline {
  font-size: var(--ui-font-size-md, 1rem);
  color: var(--ui-color-text, #0d4a3e);
  margin: 0;
}

.completeness-section {
  margin-top: var(--ui-space-lg, 1rem);
  padding-top: var(--ui-space-lg, 1rem);
  border-top: 1px solid var(--ui-color-border, rgba(5, 150, 105, 0.2));
}

.completeness-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: var(--ui-space-sm, 0.5rem);
  font-size: var(--ui-font-size-sm, 0.875rem);
  color: var(--ui-color-text, #0d4a3e);
}

.completeness-score {
  font-weight: var(--ui-font-weight-semibold, 600);
  color: var(--ui-color-primary, #059669);
}

.completeness-bar {
  height: 8px;
  background: var(--ui-color-bg, #e0f7f4);
  border-radius: var(--ui-radius-full, 9999px);
  overflow: hidden;
}

.completeness-fill {
  height: 100%;
  background: var(--ui-color-primary, #059669);
  transition: width var(--ui-transition-normal, 250ms ease);
}

.profile-details {
  background: var(--ui-color-card, rgba(255, 255, 255, 0.9));
  border: 1px solid var(--ui-color-border, rgba(5, 150, 105, 0.2));
  border-radius: var(--ui-radius-lg, 0.75rem);
  padding: var(--ui-space-xl, 1.5rem);
}

.profile-details h3 {
  font-size: var(--ui-font-size-lg, 1.125rem);
  font-weight: var(--ui-font-weight-semibold, 600);
  color: var(--ui-color-text, #0d4a3e);
  margin: 0 0 var(--ui-space-md, 0.75rem);
}

.bio-text {
  font-size: var(--ui-font-size-md, 1rem);
  color: var(--ui-color-text, #0d4a3e);
  line-height: var(--ui-line-height, 1.5);
  margin: 0;
  white-space: pre-wrap;
}

.empty-state {
  font-size: var(--ui-font-size-sm, 0.875rem);
  color: var(--ui-color-text-muted, #1f6b5a);
  font-style: italic;
  margin: 0;
}

.details-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: var(--ui-space-lg, 1rem);
}

.detail-item {
  display: flex;
  flex-direction: column;
  gap: var(--ui-space-xs, 0.25rem);
}

.detail-label {
  font-size: var(--ui-font-size-sm, 0.875rem);
  color: var(--ui-color-text-muted, #1f6b5a);
}

.detail-value {
  font-size: var(--ui-font-size-md, 1rem);
  color: var(--ui-color-text, #0d4a3e);
  font-weight: var(--ui-font-weight-medium, 500);
}

.profile-actions {
  display: flex;
  justify-content: center;
  padding-top: var(--ui-space-lg, 1rem);
}

@media (max-width: 768px) {
  .profile-overview-container {
    padding: var(--ui-space-lg, 1rem);
  }
  
  .profile-overview-header {
    flex-direction: column;
    align-items: flex-start;
    gap: var(--ui-space-md, 0.75rem);
  }
  
  .profile-header-section {
    flex-direction: column;
    align-items: center;
    text-align: center;
  }
  
  .details-grid {
    grid-template-columns: 1fr;
  }
}
</style>
