<template>
  <div class="calendar-footer">
    <div class="footer-content">
      <!-- View Mode -->
      <div v-if="!isEditMode" class="view-mode">
        <div class="footer-header">
          <div class="footer-label">
            <svg class="icon" width="20" height="20" viewBox="0 0 20 20" fill="currentColor">
              <path d="M3.9 12c0-1.71 1.39-3.1 3.1-3.1h4V7H7c-2.76 0-5 2.24-5 5s2.24 5 5 5h4v-1.9H7c-1.71 0-3.1-1.39-3.1-3.1zM8 13h8v-2H8v2zm5-6h4c2.76 0 5 2.24 5 5s-2.24 5-5 5h-4v-1.9h4c1.71 0 3.1-1.39 3.1-3.1 0-1.71-1.39-3.1-3.1-3.1h-4V7z"/>
            </svg>
            {{ t('calendar.footer.your_lesson_link') }}
          </div>
          <span class="provider-badge" :class="`provider-badge--${currentProvider}`">
            {{ getProviderLabel(currentProvider) }}
          </span>
        </div>
        
        <div class="footer-link-container">
          <input 
            ref="linkInput"
            :value="displayLink" 
            readonly 
            class="link-input"
            @focus="(e) => (e.target as HTMLInputElement).select()"
          />
          <button class="btn-secondary" @click="openLink" :disabled="!displayLink">
            <svg class="icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>
              <polyline points="15 3 21 3 21 9"/>
              <line x1="10" y1="14" x2="21" y2="3"/>
            </svg>
            {{ t('calendar.footer.join_lesson') }}
          </button>
          <button
            class="btn-tertiary"
            @click="toggleEditMode"
            :disabled="loading || !hasInitialData || isSaving"
          >
            <svg class="icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
              <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
            </svg>
            {{ t('calendar.footer.edit_link') }}
          </button>
          <button class="copy-btn" @click="copyLink">
            <svg v-if="!copied" class="icon" width="16" height="16" viewBox="0 0 20 20" fill="currentColor">
              <path d="M16 1H4c-1.1 0-2 .9-2 2v14h2V3h12V1zm3 4H8c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h11c1.1 0 2-.9 2-2V7c0-1.1-.9-2-2-2zm0 16H8V7h11v14z"/>
            </svg>
            <svg v-else class="icon" width="16" height="16" viewBox="0 0 20 20" fill="currentColor">
              <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/>
            </svg>
            {{ copied ? t('calendar.footer.copied') : t('calendar.footer.copy') }}
          </button>
        </div>
        
        <!-- Backup link if exists -->
        <div v-if="hasBackup" class="backup-link">
          <span class="backup-label">{{ t('calendar.footer.backup') }}:</span>
          <span class="backup-provider">{{ getProviderLabel(backupProvider) }}</span>
          <code class="backup-url">{{ backupUrl }}</code>
          <button class="copy-btn-small" @click="copyBackupLink">
            <svg class="icon" width="14" height="14" viewBox="0 0 20 20" fill="currentColor">
              <path d="M16 1H4c-1.1 0-2 .9-2 2v14h2V3h12V1zm3 4H8c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h11c1.1 0 2-.9 2-2V7c0-1.1-.9-2-2-2zm0 16H8V7h11v14z"/>
            </svg>
          </button>
        </div>
      </div>
      
      <!-- Edit Mode -->
      <div v-else class="edit-mode">
        <div class="edit-header">
          <h3 class="edit-title">{{ t('calendar.footer.edit_lesson_links') }}</h3>
          <button class="btn-close" @click="cancelEdit">
            <svg class="icon" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <line x1="18" y1="6" x2="6" y2="18"/>
              <line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        </div>
        
        <!-- Primary Link -->
        <div class="form-section">
          <label class="form-label">{{ t('calendar.footer.primary_link') }}</label>
          <div class="form-row">
            <select v-model="editPrimaryProvider" class="form-select">
              <option value="platform">{{ t('calendar.footer.provider.platform') }}</option>
              <option value="zoom">Zoom</option>
              <option value="meet">Google Meet</option>
              <option value="custom">{{ t('calendar.footer.provider.custom') }}</option>
            </select>
            <input 
              v-model="editPrimaryUrl"
              type="url"
              class="form-input"
              :placeholder="editPrimaryProvider === 'platform' ? t('calendar.footer.platform_auto') : 'https://...'"
              :disabled="editPrimaryProvider === 'platform'"
            />
          </div>
          <p v-if="primaryError" class="error-text">{{ primaryError }}</p>
        </div>
        
        <!-- Backup Link Toggle -->
        <div class="form-section">
          <label class="form-checkbox-label">
            <input v-model="enableBackup" type="checkbox" class="form-checkbox" />
            {{ t('calendar.footer.add_backup_link') }}
          </label>
        </div>
        
        <!-- Backup Link Fields -->
        <div v-if="enableBackup" class="form-section">
          <label class="form-label">{{ t('calendar.footer.backup_link') }}</label>
          <div class="form-row">
            <select v-model="editBackupProvider" class="form-select">
              <option value="platform">{{ t('calendar.footer.provider.platform') }}</option>
              <option value="zoom">Zoom</option>
              <option value="meet">Google Meet</option>
              <option value="custom">{{ t('calendar.footer.provider.custom') }}</option>
            </select>
            <input 
              v-model="editBackupUrl"
              type="url"
              class="form-input"
              :placeholder="editBackupProvider === 'platform' ? t('calendar.footer.platform_auto') : 'https://...'"
              :disabled="editBackupProvider === 'platform'"
            />
          </div>
          <p v-if="backupError" class="error-text">{{ backupError }}</p>
        </div>
        
        <!-- Action Buttons -->
        <div class="form-actions">
          <button class="btn-primary" @click="saveChanges" :disabled="!isFormValid || isSaving">
            <span v-if="isSaving">{{ t('common.saving') }}...</span>
            <span v-else>{{ t('common.save') }}</span>
          </button>
          <button class="btn-secondary" @click="cancelEdit" :disabled="isSaving">
            {{ t('common.cancel') }}
          </button>
        </div>
        
        <p v-if="saveError" class="error-text">{{ saveError }}</p>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { storeToRefs } from 'pinia'
import { useTutorLessonLinksStore } from '@/modules/booking/stores/tutorLessonLinksStore'
import { useToast } from '@/composables/useToast'

const { t } = useI18n()
const lessonLinksStore = useTutorLessonLinksStore()
const toast = useToast()

const { effectivePrimary, primary, backup, loading } = storeToRefs(lessonLinksStore)

const copied = ref(false)
const linkInput = ref<HTMLInputElement | null>(null)
const isEditMode = ref(false)
const isSaving = ref(false)

// Edit form state
const editPrimaryProvider = ref<string>('platform')
const editPrimaryUrl = ref<string>('')
const enableBackup = ref(false)
const editBackupProvider = ref<string>('zoom')
const editBackupUrl = ref<string>('')
const primaryError = ref<string>('')
const backupError = ref<string>('')
const saveError = ref<string>('')

// Computed
const displayLink = computed(() => effectivePrimary.value?.url || '')
const currentProvider = computed(() => effectivePrimary.value?.provider || 'platform')
const hasBackup = computed(() => backup.value !== null)
const backupProvider = computed(() => backup.value?.provider || '')
const backupUrl = computed(() => backup.value?.url || '')

const hasInitialData = computed(() => Boolean(primary.value) || Boolean(effectivePrimary.value))

const isFormValid = computed(() => {
  // Clear errors
  primaryError.value = ''
  backupError.value = ''
  
  // Validate primary
  if (editPrimaryProvider.value !== 'platform') {
    if (!editPrimaryUrl.value || !editPrimaryUrl.value.trim()) {
      primaryError.value = t('calendar.footer.url_required')
      return false
    }
    if (!editPrimaryUrl.value.startsWith('https://')) {
      primaryError.value = t('calendar.footer.https_required')
      return false
    }
  }
  
  // Validate backup if enabled
  if (enableBackup.value && editBackupProvider.value !== 'platform') {
    if (!editBackupUrl.value || !editBackupUrl.value.trim()) {
      backupError.value = t('calendar.footer.url_required')
      return false
    }
    if (!editBackupUrl.value.startsWith('https://')) {
      backupError.value = t('calendar.footer.https_required')
      return false
    }
  }
  
  return true
})

function getProviderLabel(provider: string): string {
  const labels: Record<string, string> = {
    platform: t('calendar.footer.provider.platform'),
    zoom: 'Zoom',
    meet: 'Google Meet',
    custom: t('calendar.footer.provider.custom')
  }
  return labels[provider] || provider
}

function toggleEditMode() {
  if (loading.value) return
  if (!hasInitialData.value) {
    toast.error(t('calendar.footer.load_failed'))
    return
  }

  const primarySource = primary.value ?? effectivePrimary.value ?? null

  editPrimaryProvider.value = primarySource?.provider || 'platform'
  editPrimaryUrl.value = primarySource?.url || ''

  const backupSource = backup.value ?? null
  enableBackup.value = Boolean(backupSource)
  if (backupSource) {
    editBackupProvider.value = backupSource.provider || 'zoom'
    editBackupUrl.value = backupSource.url || ''
  } else {
    editBackupProvider.value = 'zoom'
    editBackupUrl.value = ''
  }

  isEditMode.value = true
}

function cancelEdit() {
  isEditMode.value = false
  saveError.value = ''
  primaryError.value = ''
  backupError.value = ''
}

async function saveChanges() {
  if (!isFormValid.value) return
  
  isSaving.value = true
  saveError.value = ''
  
  try {
    const payload: any = {
      primary: {
        provider: editPrimaryProvider.value,
        url: editPrimaryProvider.value === 'platform' ? null : editPrimaryUrl.value
      }
    }
    
    if (enableBackup.value) {
      payload.backup = {
        provider: editBackupProvider.value,
        url: editBackupProvider.value === 'platform' ? null : editBackupUrl.value
      }
    } else {
      payload.backup = null
    }
    
    await lessonLinksStore.patchLessonLinks(payload)
    
    toast.success(t('calendar.footer.settings_saved'))
    isEditMode.value = false
  } catch (error: any) {
    console.error('[CalendarFooter] Save error:', error)
    saveError.value = error?.response?.data?.error || t('calendar.footer.save_failed')
  } finally {
    isSaving.value = false
  }
}

function openLink() {
  const url = displayLink.value
  if (!url) return
  
  // Security check
  if (!url.startsWith('https://')) {
    toast.error(t('calendar.footer.invalid_link'))
    return
  }
  
  window.open(url, '_blank', 'noopener,noreferrer')
}

const copyLink = async () => {
  try {
    await navigator.clipboard.writeText(displayLink.value)
    copied.value = true
    setTimeout(() => {
      copied.value = false
    }, 2000)
  } catch (error) {
    console.error('Failed to copy:', error)
    if (linkInput.value) {
      linkInput.value.select()
      document.execCommand('copy')
      copied.value = true
      setTimeout(() => {
        copied.value = false
      }, 2000)
    }
  }
}

const copyBackupLink = async () => {
  try {
    await navigator.clipboard.writeText(backupUrl.value)
    toast.success(t('calendar.footer.backup_copied'))
  } catch (error) {
    console.error('Failed to copy backup:', error)
  }
}
</script>

<style scoped>
.calendar-footer {
  padding: 16px 24px;
  background: #f5f7fa;
  border-radius: 0 0 8px 8px;
  border-top: 1px solid #e0e0e0;
}

.footer-content {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.footer-label {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 14px;
  font-weight: 500;
  color: #666;
}

.icon {
  color: #1976D2;
  flex-shrink: 0;
}

.footer-link-container {
  display: flex;
  gap: 12px;
  align-items: center;
}

.link-input {
  flex: 1;
  padding: 10px 12px;
  border: 1px solid #ddd;
  border-radius: 6px;
  font-size: 14px;
  background: white;
  color: #333;
  font-family: monospace;
}

.link-input:focus {
  outline: none;
  border-color: #1976D2;
}

.copy-btn {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 16px;
  background: #1976D2;
  color: white;
  border: none;
  border-radius: 6px;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  transition: background 0.2s;
  white-space: nowrap;
}

.copy-btn:hover {
  background: #1565C0;
}

.copy-btn .icon {
  color: white;
}

/* View mode styles */
.view-mode {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.footer-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.provider-badge {
  padding: 4px 12px;
  border-radius: 12px;
  font-size: 12px;
  font-weight: 600;
  text-transform: uppercase;
}

.provider-badge--platform {
  background: #e0f2fe;
  color: #0369a1;
}

.provider-badge--zoom {
  background: #dbeafe;
  color: #1e40af;
}

.provider-badge--meet {
  background: #fef3c7;
  color: #92400e;
}

.provider-badge--custom {
  background: #f3e8ff;
  color: #6b21a8;
}

.btn-secondary, .btn-tertiary {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 10px 14px;
  border: 1px solid #d1d5db;
  background: white;
  color: #374151;
  border-radius: 6px;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;
  white-space: nowrap;
}

.btn-secondary:hover:not(:disabled) {
  background: #f9fafb;
  border-color: #9ca3af;
}

.btn-tertiary {
  background: transparent;
}

.btn-tertiary:hover:not(:disabled) {
  background: #f3f4f6;
}

.btn-secondary:disabled, .btn-tertiary:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.backup-link {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 12px;
  background: #f9fafb;
  border-radius: 6px;
  font-size: 13px;
}

.backup-label {
  font-weight: 600;
  color: #6b7280;
}

.backup-provider {
  font-weight: 500;
  color: #374151;
}

.backup-url {
  flex: 1;
  padding: 4px 8px;
  background: white;
  border: 1px solid #e5e7eb;
  border-radius: 4px;
  font-size: 12px;
  color: #1f2937;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.copy-btn-small {
  padding: 4px 8px;
  background: transparent;
  border: 1px solid #d1d5db;
  border-radius: 4px;
  cursor: pointer;
  transition: background 0.2s;
}

.copy-btn-small:hover {
  background: #f3f4f6;
}

/* Edit mode styles */
.edit-mode {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.edit-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding-bottom: 12px;
  border-bottom: 1px solid #e5e7eb;
}

.edit-title {
  font-size: 16px;
  font-weight: 600;
  color: #111827;
  margin: 0;
}

.btn-close {
  padding: 4px;
  background: transparent;
  border: none;
  cursor: pointer;
  color: #6b7280;
  transition: color 0.2s;
}

.btn-close:hover {
  color: #111827;
}

.form-section {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.form-label {
  font-size: 14px;
  font-weight: 500;
  color: #374151;
}

.form-row {
  display: flex;
  gap: 8px;
}

.form-select {
  min-width: 140px;
  padding: 8px 12px;
  border: 1px solid #d1d5db;
  border-radius: 6px;
  font-size: 14px;
  background: white;
  color: #111827;
  cursor: pointer;
}

.form-input {
  flex: 1;
  padding: 8px 12px;
  border: 1px solid #d1d5db;
  border-radius: 6px;
  font-size: 14px;
  color: #111827;
}

.form-input:disabled {
  background: #f9fafb;
  color: #9ca3af;
  cursor: not-allowed;
}

.form-input:focus, .form-select:focus {
  outline: none;
  border-color: #3b82f6;
  box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
}

.form-checkbox-label {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 14px;
  color: #374151;
  cursor: pointer;
}

.form-checkbox {
  width: 18px;
  height: 18px;
  cursor: pointer;
  accent-color: #3b82f6;
}

.form-actions {
  display: flex;
  gap: 8px;
  padding-top: 8px;
}

.btn-primary {
  flex: 1;
  padding: 10px 16px;
  background: #3b82f6;
  color: white;
  border: none;
  border-radius: 6px;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  transition: background 0.2s;
}

.btn-primary:hover:not(:disabled) {
  background: #2563eb;
}

.btn-primary:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.error-text {
  color: #dc2626;
  font-size: 13px;
  margin: 0;
}

@media (max-width: 768px) {
  .footer-link-container {
    flex-direction: column;
  }
  
  .copy-btn, .btn-secondary, .btn-tertiary {
    width: 100%;
    justify-content: center;
  }
  
  .form-row {
    flex-direction: column;
  }
  
  .form-select {
    min-width: auto;
  }
}
</style>
