<template>
  <Transition name="wb-upload-fade">
    <div
      v-if="isUploading || showSuccess || uploadError"
      class="wb-upload-indicator"
      :class="{
        'wb-upload-indicator--uploading': isUploading,
        'wb-upload-indicator--success': showSuccess,
        'wb-upload-indicator--error': !!uploadError,
      }"
      role="status"
      aria-live="polite"
    >
      <span v-if="isUploading" class="wb-upload-indicator__spinner" />
      <span v-if="isUploading">{{ t('winterboard.upload.uploading') }}</span>
      <span v-else-if="showSuccess">&#10003; {{ t('winterboard.upload.saved') }}</span>
      <span v-else-if="uploadError">{{ uploadError }}</span>
    </div>
  </Transition>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'

const props = defineProps<{
  isUploading: boolean
  uploadError: string | null
}>()

const { t } = useI18n()
const showSuccess = ref(false)
let successTimer: ReturnType<typeof setTimeout> | null = null

watch(() => props.isUploading, (curr, prev) => {
  // When uploading transitions from true → false without error → show success
  if (prev && !curr && !props.uploadError) {
    showSuccess.value = true
    if (successTimer) clearTimeout(successTimer)
    successTimer = setTimeout(() => {
      showSuccess.value = false
    }, 3000)
  }
})
</script>

<style scoped>
.wb-upload-indicator {
  position: fixed;
  bottom: 16px;
  right: 16px;
  z-index: 100;
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 6px 14px;
  border-radius: 20px;
  font-size: 12px;
  font-weight: 500;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
  pointer-events: none;
}

.wb-upload-indicator--uploading {
  background: #eff6ff;
  color: #1d4ed8;
  border: 1px solid #bfdbfe;
}

.wb-upload-indicator--success {
  background: #f0fdf4;
  color: #15803d;
  border: 1px solid #bbf7d0;
}

.wb-upload-indicator--error {
  background: #fef2f2;
  color: #b91c1c;
  border: 1px solid #fecaca;
  pointer-events: auto;
}

.wb-upload-indicator__spinner {
  width: 14px;
  height: 14px;
  border: 2px solid #bfdbfe;
  border-top-color: #2563eb;
  border-radius: 50%;
  animation: wb-upload-spin 0.8s linear infinite;
}

@keyframes wb-upload-spin {
  to { transform: rotate(360deg); }
}

/* Transition */
.wb-upload-fade-enter-active,
.wb-upload-fade-leave-active {
  transition: opacity 0.25s ease, transform 0.25s ease;
}
.wb-upload-fade-enter-from,
.wb-upload-fade-leave-to {
  opacity: 0;
  transform: translateY(8px);
}
</style>
