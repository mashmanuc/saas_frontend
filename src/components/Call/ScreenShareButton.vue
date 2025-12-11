<template>
  <div class="screen-share-wrapper">
    <!-- Screen Share Button -->
    <button
      type="button"
      class="screen-share-btn"
      :class="{
        'is-sharing': isSharing,
        'is-disabled': !isSupported || isLoading,
      }"
      :disabled="!isSupported || isLoading"
      :aria-label="buttonLabel"
      :title="buttonLabel"
      @click="handleClick"
    >
      <MonitorUp v-if="!isSharing" class="icon" />
      <MonitorOff v-else class="icon" />
      <span v-if="showLabel" class="label">
        {{ isSharing ? $t('call.stopSharing') : $t('call.shareScreen') }}
      </span>
      <Loader2 v-if="isLoading" class="icon-loading" />
    </button>

    <!-- Teacher Sharing Indicator -->
    <div v-if="teacherIsSharing && !isSharing" class="teacher-sharing-indicator">
      <Monitor class="indicator-icon" />
      <span class="indicator-text">{{ $t('call.teacherSharing') }}</span>
    </div>

    <!-- Error Toast -->
    <Transition name="fade">
      <div v-if="errorMessage" class="error-toast">
        <AlertCircle class="error-icon" />
        <span>{{ errorMessage }}</span>
        <button type="button" class="close-btn" @click="clearError">
          <X class="close-icon" />
        </button>
      </div>
    </Transition>
  </div>
</template>

<script setup>
/**
 * ScreenShareButton Component — v0.16.0
 * Start/stop screen sharing with error handling
 */

import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useI18n } from 'vue-i18n'
import { MonitorUp, MonitorOff, Monitor, AlertCircle, X, Loader2 } from 'lucide-vue-next'
import { isScreenShareSupported } from '../../core/webrtc/media'
import { ERROR_CODE } from '../../core/webrtc/events'

const { t } = useI18n()

const props = defineProps({
  /**
   * Media manager instance
   */
  mediaManager: {
    type: Object,
    required: true,
  },
  /**
   * Show text label
   */
  showLabel: {
    type: Boolean,
    default: false,
  },
  /**
   * Whether teacher is currently sharing
   */
  teacherIsSharing: {
    type: Boolean,
    default: false,
  },
})

const emit = defineEmits(['start', 'stop', 'error'])

// State
const isSharing = ref(false)
const isLoading = ref(false)
const errorMessage = ref('')
const isSupported = ref(false)

// Computed
const buttonLabel = computed(() => {
  if (!isSupported.value) {
    return t('call.screenShareNotSupported')
  }
  if (isLoading.value) {
    return t('call.loading')
  }
  return isSharing.value ? t('call.stopSharing') : t('call.shareScreen')
})

// Methods
const handleClick = async () => {
  if (isSharing.value) {
    await stopSharing()
  } else {
    await startSharing()
  }
}

const startSharing = async () => {
  if (isLoading.value) return
  
  isLoading.value = true
  clearError()
  
  try {
    await props.mediaManager.getScreenShare()
    isSharing.value = true
    emit('start')
  } catch (error) {
    handleError(error)
  } finally {
    isLoading.value = false
  }
}

const stopSharing = async () => {
  props.mediaManager.stopScreenShare()
  isSharing.value = false
  emit('stop')
}

const handleError = (error) => {
  let message = t('call.errors.unknown')
  
  switch (error.code) {
    case ERROR_CODE.PERMISSION_DENIED:
      message = t('call.errors.permissionDenied')
      break
    case ERROR_CODE.NOT_SUPPORTED:
      message = t('call.errors.notSupported')
      break
    default:
      message = error.message || t('call.errors.unknown')
  }
  
  errorMessage.value = message
  emit('error', error)
  
  // Auto-clear after 5 seconds
  setTimeout(clearError, 5000)
}

const clearError = () => {
  errorMessage.value = ''
}

// Watch for external stop (user clicks browser's "Stop sharing")
const handleStreamChange = (stream, type) => {
  if (type === 'screen' && !stream) {
    isSharing.value = false
  }
}

// Lifecycle
onMounted(() => {
  isSupported.value = isScreenShareSupported()
  
  // Listen for stream changes
  if (props.mediaManager) {
    const originalCallback = props.mediaManager.onStreamChange
    props.mediaManager.onStreamChange = (stream, type) => {
      originalCallback?.(stream, type)
      handleStreamChange(stream, type)
    }
  }
})

onUnmounted(() => {
  if (isSharing.value) {
    stopSharing()
  }
})
</script>

<style scoped>
.screen-share-wrapper {
  position: relative;
  display: inline-flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
}

.screen-share-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 10px 16px;
  border: none;
  border-radius: 8px;
  background: var(--bg-secondary, #f3f4f6);
  color: var(--text-primary, #111827);
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s ease;
}

.screen-share-btn:hover:not(:disabled) {
  background: var(--bg-hover, #e5e7eb);
}

.screen-share-btn:focus-visible {
  outline: 2px solid var(--color-primary, #3b82f6);
  outline-offset: 2px;
}

.screen-share-btn.is-sharing {
  background: var(--color-success, #10b981);
  color: white;
}

.screen-share-btn.is-sharing:hover {
  background: var(--color-success-hover, #059669);
}

.screen-share-btn.is-disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.icon {
  width: 20px;
  height: 20px;
  flex-shrink: 0;
}

.icon-loading {
  width: 16px;
  height: 16px;
  animation: spin 1s linear infinite;
}

@keyframes spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}

.label {
  white-space: nowrap;
}

/* Teacher Sharing Indicator */
.teacher-sharing-indicator {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 6px 12px;
  background: var(--color-info-bg, #dbeafe);
  color: var(--color-info, #1d4ed8);
  border-radius: 6px;
  font-size: 12px;
  font-weight: 500;
  animation: pulse 2s ease-in-out infinite;
}

@keyframes pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.7; }
}

.indicator-icon {
  width: 14px;
  height: 14px;
}

.indicator-text {
  white-space: nowrap;
}

/* Error Toast */
.error-toast {
  position: absolute;
  top: calc(100% + 8px);
  left: 50%;
  transform: translateX(-50%);
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 14px;
  background: var(--color-error-bg, #fef2f2);
  color: var(--color-error, #dc2626);
  border: 1px solid var(--color-error-border, #fecaca);
  border-radius: 8px;
  font-size: 13px;
  white-space: nowrap;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
  z-index: 100;
}

.error-icon {
  width: 16px;
  height: 16px;
  flex-shrink: 0;
}

.close-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 2px;
  background: none;
  border: none;
  cursor: pointer;
  color: inherit;
  opacity: 0.7;
  transition: opacity 0.2s;
}

.close-btn:hover {
  opacity: 1;
}

.close-icon {
  width: 14px;
  height: 14px;
}

/* Transitions */
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.2s ease, transform 0.2s ease;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
  transform: translateX(-50%) translateY(-4px);
}

/* Dark mode */
@media (prefers-color-scheme: dark) {
  .screen-share-btn {
    background: var(--bg-secondary-dark, #374151);
    color: var(--text-primary-dark, #f9fafb);
  }
  
  .screen-share-btn:hover:not(:disabled) {
    background: var(--bg-hover-dark, #4b5563);
  }
  
  .teacher-sharing-indicator {
    background: var(--color-info-bg-dark, #1e3a5f);
    color: var(--color-info-dark, #60a5fa);
  }
  
  .error-toast {
    background: var(--color-error-bg-dark, #450a0a);
    color: var(--color-error-dark, #fca5a5);
    border-color: var(--color-error-border-dark, #7f1d1d);
  }
}
</style>
