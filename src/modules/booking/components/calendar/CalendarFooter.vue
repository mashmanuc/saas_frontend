<template>
  <div class="calendar-footer">
    <div class="footer-content">
      <!-- View Mode -->
      <div class="view-mode">
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
          <Button variant="outline" @click="openLink" :disabled="!displayLink">
            {{ t('calendar.footer.join_lesson') }}
          </Button>
          <Button
            variant="ghost"
            @click="navigateToProfile"
            :disabled="loading"
            data-testid="edit-lesson-links-button"
          >
            {{ t('calendar.footer.edit_link') }}
          </Button>
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
      
      <!-- Edit mode removed - editing now happens in profile -->
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'
import Button from '@/ui/Button.vue'
import { storeToRefs } from 'pinia'
import { useTutorLessonLinksStore } from '@/modules/booking/stores/tutorLessonLinksStore'
import { useToast } from '@/composables/useToast'

const { t } = useI18n()
const router = useRouter()
const lessonLinksStore = useTutorLessonLinksStore()
const toast = useToast()

const { effectivePrimary, primary, backup, loading } = storeToRefs(lessonLinksStore)

const copied = ref(false)
const linkInput = ref<HTMLInputElement | null>(null)

// Computed
const displayLink = computed(() => effectivePrimary.value?.url || '')
const currentProvider = computed(() => effectivePrimary.value?.provider || 'platform')
const hasBackup = computed(() => backup.value !== null)
const backupProvider = computed(() => backup.value?.provider || '')
const backupUrl = computed(() => backup.value?.url || '')

const hasInitialData = computed(() => Boolean(primary.value) || Boolean(effectivePrimary.value))

function getProviderLabel(provider: string): string {
  const labels: Record<string, string> = {
    platform: t('calendar.footer.provider.platform'),
    zoom: 'Zoom',
    meet: 'Google Meet',
    custom: t('calendar.footer.provider.custom')
  }
  return labels[provider] || provider
}

function navigateToProfile() {
  // Navigate to tutor lesson links page
  router.push({ name: 'tutor-lesson-links' })
  console.info('[CalendarFooter] Navigating to lesson links editing page')
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
  background: var(--bg-secondary);
  border-radius: 0 0 var(--radius-md) var(--radius-md);
  border-top: 1px solid var(--border-color);
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
  color: var(--text-secondary);
}

.icon {
  color: var(--accent);
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
  border: 1px solid var(--border-color);
  border-radius: var(--radius-md);
  font-size: 14px;
  background: var(--card-bg);
  color: var(--text-primary);
  font-family: monospace;
}

.link-input:focus {
  outline: none;
  border-color: var(--accent);
}

.copy-btn {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 16px;
  background: var(--accent);
  color: white;
  border: none;
  border-radius: var(--radius-md);
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  transition: background 0.2s;
  white-space: nowrap;
}

.copy-btn:hover {
  background: var(--accent-hover, #1565C0);
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
  background: var(--accent-bg, #e0f2fe);
  color: var(--accent);
}

.provider-badge--zoom {
  background: var(--accent-bg, #dbeafe);
  color: var(--accent);
}

.provider-badge--meet {
  background: var(--warning-bg, #fef3c7);
  color: var(--warning);
}

.provider-badge--custom {
  background: var(--calendar-first-lesson-bg, #f3e8ff);
  color: var(--calendar-first-lesson, #6b21a8);
}

.backup-link {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 12px;
  background: var(--bg-secondary);
  border-radius: var(--radius-md);
  font-size: 13px;
}

.backup-label {
  font-weight: 600;
  color: var(--text-secondary);
}

.backup-provider {
  font-weight: 500;
  color: var(--text-primary);
}

.backup-url {
  flex: 1;
  padding: 4px 8px;
  background: var(--card-bg);
  border: 1px solid var(--border-color);
  border-radius: 4px;
  font-size: 12px;
  color: var(--text-primary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.copy-btn-small {
  padding: 4px 8px;
  background: transparent;
  border: 1px solid var(--border-color);
  border-radius: 4px;
  cursor: pointer;
  transition: background 0.2s;
}

.copy-btn-small:hover {
  background: var(--bg-secondary);
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
  border-bottom: 1px solid var(--border-color);
}

.edit-title {
  font-size: 16px;
  font-weight: 600;
  color: var(--text-primary);
  margin: 0;
}

.btn-close {
  padding: 4px;
  background: transparent;
  border: none;
  cursor: pointer;
  color: var(--text-secondary);
  transition: color 0.2s;
}

.btn-close:hover {
  color: var(--text-primary);
}

.form-section {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.form-label {
  font-size: 14px;
  font-weight: 500;
  color: var(--text-primary);
}

.form-row {
  display: flex;
  gap: 8px;
}

.form-select {
  min-width: 140px;
  padding: 8px 12px;
  border: 1px solid var(--border-color);
  border-radius: var(--radius-md);
  font-size: 14px;
  background: var(--card-bg);
  color: var(--text-primary);
  cursor: pointer;
}

.form-input {
  flex: 1;
  padding: 8px 12px;
  border: 1px solid var(--border-color);
  border-radius: var(--radius-md);
  font-size: 14px;
  color: var(--text-primary);
}

.form-input:disabled {
  background: var(--bg-secondary);
  color: var(--text-muted);
  cursor: not-allowed;
}

.form-input:focus, .form-select:focus {
  outline: none;
  border-color: var(--accent);
  box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
}

.form-checkbox-label {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 14px;
  color: var(--text-primary);
  cursor: pointer;
}

.form-checkbox {
  width: 18px;
  height: 18px;
  cursor: pointer;
  accent-color: var(--accent);
}

.form-actions {
  display: flex;
  gap: 8px;
  padding-top: 8px;
}

.btn-primary {
  flex: 1;
  padding: 10px 16px;
  background: var(--accent);
  color: white;
  border: none;
  border-radius: var(--radius-md);
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  transition: background 0.2s;
}

.btn-primary:hover:not(:disabled) {
  background: var(--accent-hover, #2563eb);
}

.btn-primary:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.error-text {
  color: var(--danger);
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
