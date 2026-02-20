<script setup lang="ts">
import { ref, computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { notifyError, notifySuccess } from '@/utils/notify'
import Button from '@/ui/Button.vue'

export interface Props {
  show: boolean
  currentLevel?: 'none' | 'basic' | 'advanced' | 'premium'
}

const props = withDefaults(defineProps<Props>(), {
  currentLevel: 'none'
})

const emit = defineEmits<{
  close: []
  success: []
}>()

const { t } = useI18n()

const currentStep = ref(1)
const isSubmitting = ref(false)

const formData = ref({
  documents: [] as File[],
  videoLink: '',
  backgroundInfo: ''
})

const targetLevel = computed(() => {
  if (props.currentLevel === 'none') return 'basic'
  if (props.currentLevel === 'basic') return 'advanced'
  if (props.currentLevel === 'advanced') return 'premium'
  return 'basic'
})

const steps = computed(() => [
  { id: 1, label: t('marketplace.verification.modal.step1') },
  { id: 2, label: t('marketplace.verification.modal.step2') },
  { id: 3, label: t('marketplace.verification.modal.step3') }
])

const canProceed = computed(() => {
  if (currentStep.value === 1) {
    return formData.value.documents.length > 0
  }
  if (currentStep.value === 2) {
    return formData.value.videoLink.trim().length > 0
  }
  if (currentStep.value === 3) {
    return formData.value.backgroundInfo.trim().length >= 50
  }
  return false
})

function handleFileUpload(event: Event) {
  const target = event.target as HTMLInputElement
  if (target.files) {
    const files = Array.from(target.files)
    const validFiles = files.filter(file => {
      const isValidType = ['application/pdf', 'image/jpeg', 'image/png'].includes(file.type)
      const isValidSize = file.size <= 10 * 1024 * 1024
      return isValidType && isValidSize
    })
    
    if (validFiles.length !== files.length) {
      notifyError(t('marketplace.verification.modal.invalidFiles'))
    }
    
    formData.value.documents = validFiles
  }
}

function removeDocument(index: number) {
  formData.value.documents.splice(index, 1)
}

function nextStep() {
  if (canProceed.value && currentStep.value < 3) {
    currentStep.value++
  }
}

function prevStep() {
  if (currentStep.value > 1) {
    currentStep.value--
  }
}

async function handleSubmit() {
  if (!canProceed.value) return
  
  isSubmitting.value = true
  
  try {
    // Mock API call - replace with actual verification request
    await new Promise(resolve => setTimeout(resolve, 1500))
    
    notifySuccess(t('marketplace.verification.modal.submitSuccess'))
    emit('success')
    emit('close')
  } catch (err) {
    notifyError(t('marketplace.verification.modal.submitError'))
  } finally {
    isSubmitting.value = false
  }
}

function handleClose() {
  if (!isSubmitting.value) {
    emit('close')
  }
}
</script>

<template>
  <div v-if="show" class="modal-overlay" @click.self="handleClose">
    <div class="modal-content" data-test="verification-request-modal">
      <div class="modal-header">
        <h2>{{ t('marketplace.verification.modal.title', { level: targetLevel }) }}</h2>
        <button class="close-btn" @click="handleClose" :disabled="isSubmitting">×</button>
      </div>

      <div class="steps-indicator">
        <div
          v-for="step in steps"
          :key="step.id"
          class="step-item"
          :class="{ active: currentStep === step.id, completed: currentStep > step.id }"
        >
          <div class="step-number">{{ step.id }}</div>
          <div class="step-label">{{ step.label }}</div>
        </div>
      </div>

      <div class="modal-body">
        <!-- Step 1: Documents -->
        <div v-if="currentStep === 1" class="step-content">
          <h3>{{ t('marketplace.verification.modal.documentsTitle') }}</h3>
          <p class="step-description">{{ t('marketplace.verification.modal.documentsDescription') }}</p>
          
          <div class="file-upload-area">
            <input
              type="file"
              id="document-upload"
              multiple
              accept=".pdf,.jpg,.jpeg,.png"
              @change="handleFileUpload"
              :disabled="isSubmitting"
            />
            <label for="document-upload" class="upload-label">
              <span class="upload-icon">📄</span>
              <span>{{ t('marketplace.verification.modal.uploadDocuments') }}</span>
              <span class="upload-hint">{{ t('marketplace.verification.modal.uploadHint') }}</span>
            </label>
          </div>

          <div v-if="formData.documents.length > 0" class="uploaded-files">
            <div v-for="(file, index) in formData.documents" :key="index" class="file-item">
              <span class="file-name">{{ file.name }}</span>
              <button class="remove-btn" @click="removeDocument(index)" :disabled="isSubmitting">×</button>
            </div>
          </div>
        </div>

        <!-- Step 2: Video Link -->
        <div v-if="currentStep === 2" class="step-content">
          <h3>{{ t('marketplace.verification.modal.videoTitle') }}</h3>
          <p class="step-description">{{ t('marketplace.verification.modal.videoDescription') }}</p>
          
          <div class="form-group">
            <label for="video-link">{{ t('marketplace.verification.modal.videoLinkLabel') }}</label>
            <input
              id="video-link"
              v-model="formData.videoLink"
              type="url"
              class="form-control"
              :placeholder="t('marketplace.verification.modal.videoLinkPlaceholder')"
              :disabled="isSubmitting"
            />
          </div>
        </div>

        <!-- Step 3: Background Info -->
        <div v-if="currentStep === 3" class="step-content">
          <h3>{{ t('marketplace.verification.modal.backgroundTitle') }}</h3>
          <p class="step-description">{{ t('marketplace.verification.modal.backgroundDescription') }}</p>
          
          <div class="form-group">
            <label for="background-info">{{ t('marketplace.verification.modal.backgroundLabel') }}</label>
            <textarea
              id="background-info"
              v-model="formData.backgroundInfo"
              class="form-control"
              rows="6"
              :placeholder="t('marketplace.verification.modal.backgroundPlaceholder')"
              :disabled="isSubmitting"
            />
            <div class="char-count">
              {{ formData.backgroundInfo.length }} / 500
            </div>
          </div>
        </div>
      </div>

      <div class="modal-footer">
        <Button
          v-if="currentStep > 1"
          variant="outline"
          @click="prevStep"
          :disabled="isSubmitting"
        >
          {{ t('common.back') }}
        </Button>
        
        <Button
          v-if="currentStep < 3"
          variant="primary"
          @click="nextStep"
          :disabled="!canProceed || isSubmitting"
        >
          {{ t('common.next') }}
        </Button>
        
        <Button
          v-if="currentStep === 3"
          variant="primary"
          @click="handleSubmit"
          :disabled="!canProceed || isSubmitting"
          :loading="isSubmitting"
        >
          {{ t('common.submit') }}
        </Button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
  padding: 1rem;
}

.modal-content {
  background: var(--surface-card);
  border-radius: var(--radius-lg);
  max-width: 600px;
  width: 100%;
  max-height: 90vh;
  overflow-y: auto;
  box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1);
}

.modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 1.5rem;
  border-bottom: 1px solid var(--border-color);
}

.modal-header h2 {
  font-size: 1.5rem;
  font-weight: 600;
  margin: 0;
  color: var(--text-primary);
}

.close-btn {
  background: none;
  border: none;
  font-size: 2rem;
  line-height: 1;
  cursor: pointer;
  color: var(--text-secondary);
  padding: 0;
  width: 2rem;
  height: 2rem;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: var(--radius-md);
  transition: all 0.2s;
}

.close-btn:hover:not(:disabled) {
  background: var(--surface-hover);
  color: var(--text-primary);
}

.close-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.steps-indicator {
  display: flex;
  justify-content: space-between;
  padding: 1.5rem;
  border-bottom: 1px solid var(--border-color);
}

.step-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.5rem;
  flex: 1;
  position: relative;
}

.step-item:not(:last-child)::after {
  content: '';
  position: absolute;
  top: 1rem;
  left: 50%;
  right: -50%;
  height: 2px;
  background: var(--border-color);
  z-index: -1;
}

.step-item.completed:not(:last-child)::after {
  background: var(--accent);
}

.step-number {
  width: 2rem;
  height: 2rem;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--surface-hover);
  color: var(--text-secondary);
  font-weight: 600;
  font-size: 0.875rem;
  border: 2px solid var(--border-color);
}

.step-item.active .step-number {
  background: var(--accent);
  color: white;
  border-color: var(--accent);
}

.step-item.completed .step-number {
  background: var(--accent);
  color: white;
  border-color: var(--accent);
}

.step-label {
  font-size: 0.75rem;
  color: var(--text-secondary);
  text-align: center;
}

.step-item.active .step-label {
  color: var(--text-primary);
  font-weight: 600;
}

.modal-body {
  padding: 1.5rem;
  min-height: 300px;
}

.step-content h3 {
  font-size: 1.125rem;
  font-weight: 600;
  margin: 0 0 0.5rem;
  color: var(--text-primary);
}

.step-description {
  font-size: 0.875rem;
  color: var(--text-secondary);
  margin: 0 0 1.5rem;
}

.file-upload-area {
  margin-bottom: 1rem;
}

.file-upload-area input[type="file"] {
  display: none;
}

.upload-label {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.5rem;
  padding: 2rem;
  border: 2px dashed var(--border-color);
  border-radius: var(--radius-md);
  cursor: pointer;
  transition: all 0.2s;
  background: var(--surface-hover);
}

.upload-label:hover {
  border-color: var(--accent);
  background: color-mix(in srgb, var(--accent) 5%, transparent);
}

.upload-icon {
  font-size: 2rem;
}

.upload-hint {
  font-size: 0.75rem;
  color: var(--text-secondary);
}

.uploaded-files {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.file-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 0.75rem;
  background: var(--surface-hover);
  border-radius: var(--radius-md);
  font-size: 0.875rem;
}

.file-name {
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.remove-btn {
  background: none;
  border: none;
  font-size: 1.5rem;
  line-height: 1;
  cursor: pointer;
  color: var(--text-secondary);
  padding: 0;
  width: 1.5rem;
  height: 1.5rem;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: var(--radius-sm);
  transition: all 0.2s;
}

.remove-btn:hover:not(:disabled) {
  background: var(--danger-bg);
  color: white;
}

.form-group {
  margin-bottom: 1rem;
}

.form-group label {
  display: block;
  font-size: 0.875rem;
  font-weight: 500;
  margin-bottom: 0.5rem;
  color: var(--text-primary);
}

.form-control {
  width: 100%;
  padding: 0.75rem;
  border: 1px solid var(--border-color);
  border-radius: var(--radius-md);
  font-size: 0.875rem;
  background: var(--surface-card);
  color: var(--text-primary);
  transition: all 0.2s;
}

.form-control:focus {
  outline: none;
  border-color: var(--accent);
  box-shadow: 0 0 0 3px color-mix(in srgb, var(--accent) 10%, transparent);
}

.form-control:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

textarea.form-control {
  resize: vertical;
  font-family: inherit;
}

.char-count {
  text-align: right;
  font-size: 0.75rem;
  color: var(--text-secondary);
  margin-top: 0.25rem;
}

.modal-footer {
  display: flex;
  justify-content: flex-end;
  gap: 0.75rem;
  padding: 1.5rem;
  border-top: 1px solid var(--border-color);
}
</style>
