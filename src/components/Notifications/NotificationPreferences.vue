<template>
  <div class="notification-preferences">
    <h3 class="preferences-title">{{ $t('notifications.preferences.title') }}</h3>
    <p class="preferences-desc">{{ $t('notifications.preferences.description') }}</p>

    <div v-if="isLoading" class="loading-state">
      <div class="spinner" />
      <p>{{ $t('notifications.preferences.loading') }}</p>
    </div>

    <div v-else-if="error" class="error-state" role="alert">
      <p class="error-text">{{ $t('notifications.preferences.errorLoading') }}</p>
      <button type="button" class="retry-btn" @click="handleRetry">
        {{ $t('notifications.preferences.retry') }}
      </button>
    </div>

    <div v-else class="preferences-list">
      <div class="preference-item">
        <div class="preference-info">
          <label :for="emailToggleId" class="preference-label">
            {{ $t('notifications.preferences.emailLabel') }}
          </label>
          <p class="preference-hint">{{ $t('notifications.preferences.emailHint') }}</p>
        </div>
        <button
          :id="emailToggleId"
          type="button"
          role="switch"
          :aria-checked="localPreferences.email_notifications"
          :disabled="isSaving"
          class="toggle-switch"
          :class="{ active: localPreferences.email_notifications }"
          @click="toggleEmail"
        >
          <span class="toggle-slider" />
        </button>
      </div>

      <div class="preference-item">
        <div class="preference-info">
          <label :for="inAppToggleId" class="preference-label">
            {{ $t('notifications.preferences.inAppLabel') }}
          </label>
          <p class="preference-hint">{{ $t('notifications.preferences.inAppHint') }}</p>
        </div>
        <button
          :id="inAppToggleId"
          type="button"
          role="switch"
          :aria-checked="localPreferences.in_app_notifications"
          :disabled="isSaving"
          class="toggle-switch"
          :class="{ active: localPreferences.in_app_notifications }"
          @click="toggleInApp"
        >
          <span class="toggle-slider" />
        </button>
      </div>
    </div>

    <div v-if="saveError" class="save-error" role="alert">
      {{ $t('notifications.preferences.saveError') }}
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { storeToRefs } from 'pinia'
import { useNotificationsStore } from '@/stores/notificationsStore'

const { t } = useI18n()
const notificationsStore = useNotificationsStore()
const { preferences, isLoadingPreferences, preferencesError } = storeToRefs(notificationsStore)

const emailToggleId = 'email-notifications-toggle'
const inAppToggleId = 'in-app-notifications-toggle'

const localPreferences = ref({
  email_notifications: false,
  in_app_notifications: true,
})

const isSaving = ref(false)
const saveError = ref<string | null>(null)

const isLoading = computed(() => isLoadingPreferences.value && !preferences.value)
const error = computed(() => preferencesError.value)

watch(preferences, (newPrefs) => {
  if (newPrefs) {
    localPreferences.value = { ...newPrefs }
  }
}, { immediate: true })

async function toggleEmail() {
  if (isSaving.value) return
  
  const newValue = !localPreferences.value.email_notifications
  localPreferences.value.email_notifications = newValue
  
  await savePreference({ email_notifications: newValue })
}

async function toggleInApp() {
  if (isSaving.value) return
  
  const newValue = !localPreferences.value.in_app_notifications
  localPreferences.value.in_app_notifications = newValue
  
  await savePreference({ in_app_notifications: newValue })
}

async function savePreference(updates: Partial<typeof localPreferences.value>) {
  isSaving.value = true
  saveError.value = null
  
  try {
    await notificationsStore.updatePreferences(updates)
  } catch (err) {
    saveError.value = String(err)
    if (preferences.value) {
      localPreferences.value = { ...preferences.value }
    }
  } finally {
    isSaving.value = false
  }
}

async function handleRetry() {
  try {
    await notificationsStore.loadPreferences()
  } catch (err) {
    console.error('[NotificationPreferences] Failed to retry loading preferences:', err)
  }
}

onMounted(() => {
  if (!preferences.value) {
    notificationsStore.loadPreferences()
  }
})
</script>

<style scoped>
.notification-preferences {
  padding: 1.5rem;
  border: 1px solid var(--border-color);
  border-radius: 12px;
  background: var(--surface-card, #fff);
}

.preferences-title {
  font-size: 1.25rem;
  font-weight: 700;
  margin: 0 0 0.5rem;
  color: var(--text-primary);
}

.preferences-desc {
  font-size: 0.9rem;
  margin: 0 0 1.5rem;
  color: var(--text-secondary);
}

.loading-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 1rem;
  padding: 2rem;
}

.spinner {
  width: 32px;
  height: 32px;
  border: 3px solid var(--border-color);
  border-top-color: var(--accent);
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

.error-state {
  text-align: center;
  padding: 2rem;
}

.error-text {
  margin: 0 0 1rem;
  color: var(--danger-text, #dc2626);
}

.retry-btn {
  padding: 0.5rem 1rem;
  border: 1px solid var(--border-color);
  border-radius: 6px;
  background: var(--card-bg);
  color: var(--text-primary);
  cursor: pointer;
  font-size: 0.9rem;
}

.retry-btn:hover {
  border-color: var(--accent);
}

.preferences-list {
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
}

.preference-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  padding: 1rem;
  border: 1px solid var(--border-color);
  border-radius: 8px;
  background: var(--bg-secondary, #f9fafb);
}

.preference-info {
  flex: 1;
}

.preference-label {
  display: block;
  font-size: 1rem;
  font-weight: 600;
  margin: 0 0 0.25rem;
  color: var(--text-primary);
  cursor: pointer;
}

.preference-hint {
  font-size: 0.85rem;
  margin: 0;
  color: var(--text-secondary);
}

.toggle-switch {
  position: relative;
  width: 48px;
  height: 26px;
  border: none;
  border-radius: 999px;
  background: var(--border-color);
  cursor: pointer;
  transition: background 0.2s ease;
  flex-shrink: 0;
}

.toggle-switch:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.toggle-switch.active {
  background: var(--accent, #4f46e5);
}

.toggle-slider {
  position: absolute;
  top: 2px;
  left: 2px;
  width: 22px;
  height: 22px;
  border-radius: 50%;
  background: white;
  transition: transform 0.2s ease;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
}

.toggle-switch.active .toggle-slider {
  transform: translateX(22px);
}

.save-error {
  margin-top: 1rem;
  padding: 0.75rem;
  border-radius: 6px;
  background: #fee;
  color: var(--danger-text, #dc2626);
  font-size: 0.9rem;
  text-align: center;
}

@media (max-width: 640px) {
  .notification-preferences {
    padding: 1rem;
  }

  .preference-item {
    flex-direction: column;
    align-items: flex-start;
  }

  .toggle-switch {
    align-self: flex-end;
  }
}
</style>
