<template>
  <div class="staff-settings" data-testid="staff-platform-settings">
    <div class="page-header">
      <h1 class="page-title">{{ $t('staff.platformSettings.title') }}</h1>
      <p class="help-text">{{ $t('staff.platformSettings.helpText') }}</p>
    </div>

    <div v-if="loading" class="loading-state">
      <LoadingSpinner />
    </div>

    <template v-else>
      <!-- 2026-09-26: БУЛО v-else-if — помилка перемикачів ховала всю сторінку разом із лендингом -->
      <div v-if="error" class="error-state">
        <AlertTriangle :size="20" />
        <span>{{ error }}</span>
        <button class="btn btn-sm" @click="loadSettings">{{ $t('common.retry') }}</button>
      </div>

      <!-- Налаштування по категоріях -->
      <div
        v-for="(group, category) in groupedSettings"
        :key="category"
        class="settings-group"
      >
        <h2 class="group-title">{{ categoryLabel(category) }}</h2>

        <div
          v-for="setting in group"
          :key="setting.key"
          class="setting-card"
          :class="{ danger: setting.danger }"
        >
          <div class="setting-info">
            <div class="setting-label">{{ setting.label }}</div>
            <div class="setting-key">{{ setting.key }}</div>
            <div class="setting-description">{{ setting.description }}</div>
          </div>

          <div class="setting-control">
            <label class="toggle">
              <input
                type="checkbox"
                :checked="setting.value"
                :disabled="saving === setting.key"
                @change="toggleSetting(setting)"
              />
              <span class="toggle-slider" />
            </label>
            <span class="toggle-label">{{ setting.value ? $t('common.enabled') : $t('common.disabled') }}</span>
          </div>
        </div>
      </div>

      <!-- Лендінг — реальний реплей для демо-секції «Перегляньте, як проходив урок» -->
      <div class="settings-group">
        <h2 class="group-title">{{ $t('staff.platformSettings.landing.group') }}</h2>
        <div class="setting-card">
          <div class="setting-info">
            <div class="setting-label">{{ $t('staff.platformSettings.landing.replayLabel') }}</div>
            <div class="setting-description">{{ $t('staff.platformSettings.landing.replayDescription') }}</div>
            <input
              v-model="landingReplayUrl"
              type="url"
              class="landing-input"
              placeholder="https://m4sh.org/winterboard/public/..."
              :disabled="landingSaving"
            />
            <p v-if="landingError" class="landing-msg landing-msg--error">{{ landingError }}</p>
            <p v-else-if="landingSaved" class="landing-msg landing-msg--ok">{{ $t('staff.platformSettings.landing.saved') }}</p>
          </div>
          <div class="setting-control">
            <button class="btn btn-sm" :disabled="landingSaving" @click="saveLandingConfig">
              {{ landingSaving ? '…' : $t('common.save') }}
            </button>
          </div>
        </div>
      </div>

      <!-- 2026-09-26: «Налаштувань немає» прибрано — блок лендингу є завжди, тож сторінка не порожня -->
    </template>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { AlertTriangle } from 'lucide-vue-next'
import LoadingSpinner from '@/ui/LoadingSpinner.vue'
import platformSettingsApi, { type PlatformSetting } from '../api/platformSettingsApi'

const settings = ref<PlatformSetting[]>([])
const loading = ref(true)
const error = ref('')
const saving = ref<string | null>(null)

// Лендінг-config (реплей для демо-секції) — окремий endpoint
const landingReplayUrl = ref('')
const landingSaving = ref(false)
const landingError = ref('')
const landingSaved = ref(false)

// 2026-09-26 (аудит адмінки, «сховати, не видаляти»): перемикач, що ні на що не впливає.
// MARKETPLACE_AUTO_APPROVE_PROFILES пише FeatureToggle, а читачі (у вимкненому marketplace)
// завжди брали env — і фраза «діє одразу» для нього була неправдою.
const HIDDEN_SETTINGS = new Set(['MARKETPLACE_AUTO_APPROVE_PROFILES'])

const groupedSettings = computed(() => {
  const groups: Record<string, PlatformSetting[]> = {}
  const list = Array.isArray(settings.value) ? settings.value : []
  for (const s of list) {
    if (HIDDEN_SETTINGS.has(s.key)) continue
    if (!groups[s.category]) groups[s.category] = []
    groups[s.category].push(s)
  }
  return groups
})

function categoryLabel(category: string): string {
  const labels: Record<string, string> = {
    MARKETPLACE: 'Маркетплейс',
    TRUST: 'Довіра та безпека',
    SYSTEM: 'Система',
  }
  return labels[category] || category
}

async function loadSettings() {
  loading.value = true
  error.value = ''
  try {
    settings.value = await platformSettingsApi.getAll()
  } catch (e: any) {
    error.value = e?.response?.data?.detail || 'Не вдалося завантажити налаштування'
  } finally {
    loading.value = false
  }
}

async function toggleSetting(setting: PlatformSetting) {
  const newValue = !setting.value
  saving.value = setting.key
  try {
    await platformSettingsApi.update({ [setting.key]: newValue })
    setting.value = newValue
  } catch (e: any) {
    error.value = e?.response?.data?.detail || 'Не вдалося зберегти'
  } finally {
    saving.value = null
  }
}

async function loadLandingConfig() {
  try {
    const data = await platformSettingsApi.getLandingConfig()
    landingReplayUrl.value = data.replay_demo_url || ''
  } catch {
    /* graceful — лишаємо порожнім */
  }
}

async function saveLandingConfig() {
  landingSaving.value = true
  landingError.value = ''
  landingSaved.value = false
  try {
    const data = await platformSettingsApi.updateLandingConfig(landingReplayUrl.value.trim())
    landingReplayUrl.value = data.replay_demo_url || ''
    landingSaved.value = true
    setTimeout(() => { landingSaved.value = false }, 2500)
  } catch (e: any) {
    landingError.value = e?.response?.data?.detail || 'Не вдалося зберегти'
  } finally {
    landingSaving.value = false
  }
}

onMounted(() => {
  loadSettings()
  loadLandingConfig()
})
</script>

<style scoped>
.staff-settings {
  max-width: 800px;
}

.page-header {
  margin-bottom: var(--space-lg);
}

.page-title {
  font-size: var(--text-xl);
  font-weight: 700;
  color: var(--text-primary);
  margin: 0 0 var(--space-xs);
}

.help-text {
  color: var(--text-secondary);
  font-size: var(--text-sm);
  margin: 0;
}

.loading-state,
.error-state,
.empty-state {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: var(--space-sm);
  padding: var(--space-xl);
  color: var(--text-secondary);
}

.error-state {
  color: var(--danger, #ef4444);
}

.settings-group {
  margin-bottom: var(--space-lg);
}

.group-title {
  font-size: var(--text-base);
  font-weight: 600;
  color: var(--text-secondary);
  text-transform: uppercase;
  letter-spacing: 0.05em;
  font-size: 0.75rem;
  margin: 0 0 var(--space-sm);
  padding-bottom: var(--space-xs);
  border-bottom: 1px solid var(--border-color);
}

.setting-card {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: var(--space-md);
  padding: var(--space-md);
  background: var(--card-bg);
  border: 1px solid var(--border-color);
  border-radius: var(--radius-md);
  margin-bottom: var(--space-sm);
  transition: border-color var(--transition-base);
}

.setting-card:hover {
  border-color: var(--accent);
}

.setting-card.danger {
  border-left: 3px solid var(--danger, #ef4444);
}

.setting-info {
  flex: 1;
  min-width: 0;
}

.setting-label {
  font-weight: 600;
  color: var(--text-primary);
  margin-bottom: 2px;
}

.setting-key {
  font-family: monospace;
  font-size: 0.7rem;
  color: var(--text-muted, var(--text-secondary));
  opacity: 0.6;
  margin-bottom: var(--space-xs);
}

.setting-description {
  font-size: var(--text-sm);
  color: var(--text-secondary);
  line-height: 1.5;
}

.setting-control {
  display: flex;
  align-items: center;
  gap: var(--space-sm);
  flex-shrink: 0;
}

.toggle-label {
  font-size: var(--text-sm);
  color: var(--text-secondary);
  min-width: 70px;
}

/* Toggle switch */
.toggle {
  position: relative;
  display: inline-block;
  width: 44px;
  height: 24px;
  cursor: pointer;
}

.toggle input {
  opacity: 0;
  width: 0;
  height: 0;
}

.toggle-slider {
  position: absolute;
  inset: 0;
  background: var(--color-surface-sunken, #ccc);
  border-radius: 24px;
  transition: background 0.2s;
}

.toggle-slider::before {
  content: '';
  position: absolute;
  width: 18px;
  height: 18px;
  left: 3px;
  bottom: 3px;
  background: white;
  border-radius: 50%;
  transition: transform 0.2s;
}

.toggle input:checked + .toggle-slider {
  background: var(--accent, #10b981);
}

.toggle input:checked + .toggle-slider::before {
  transform: translateX(20px);
}

.toggle input:disabled + .toggle-slider {
  opacity: 0.5;
  cursor: not-allowed;
}

.landing-input {
  width: 100%;
  margin-top: var(--space-sm);
  padding: 8px 10px;
  border: 1px solid var(--border-color);
  border-radius: var(--radius-md);
  background: var(--bg-secondary, var(--card-bg));
  color: var(--text-primary);
  font-size: var(--text-sm);
}

.landing-input:focus {
  outline: none;
  border-color: var(--accent);
}

.landing-msg {
  font-size: var(--text-sm);
  margin: var(--space-xs) 0 0;
}

.landing-msg--error {
  color: var(--danger, #ef4444);
}

.landing-msg--ok {
  color: var(--accent, #10b981);
}

.empty-state {
  flex-direction: column;
  padding: var(--space-xl) 0;
}
</style>
