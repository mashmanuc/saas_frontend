<template>
  <div class="push-handler">
    <!-- Push Permission Request Banner -->
    <Transition name="slide-down">
      <div v-if="showPermissionBanner" class="permission-banner">
        <div class="banner-content">
          <Bell class="banner-icon" />
          <div class="banner-text">
            <strong>{{ $t('push.enableTitle') }}</strong>
            <p>{{ $t('push.enableDescription') }}</p>
          </div>
        </div>
        <div class="banner-actions">
          <Button variant="secondary" size="sm" @click="dismissBanner">
            {{ $t('common.later') }}
          </Button>
          <Button variant="primary" size="sm" :disabled="isEnabling" :loading="isEnabling" @click="enablePush">
            {{ $t('push.enable') }}
          </Button>
        </div>
      </div>
    </Transition>

    <!-- Push Toast Container -->
    <Teleport to="body">
      <div class="push-toast-container">
        <TransitionGroup name="toast">
          <div
            v-for="toast in toasts"
            :key="toast.id"
            class="push-toast"
            :class="`toast-${toast.type}`"
            @click="handleToastClick(toast)"
          >
            <div class="toast-icon-wrapper">
              <component :is="getToastIcon(toast.type)" class="toast-icon" />
            </div>
            <div class="toast-content">
              <strong class="toast-title">{{ toast.title }}</strong>
              <p class="toast-body">{{ toast.body }}</p>
            </div>
            <button 
              type="button" 
              class="toast-close"
              @click.stop="dismissToast(toast.id)"
            >
              <X class="close-icon" />
            </button>
          </div>
        </TransitionGroup>
      </div>
    </Teleport>
  </div>
</template>

<script setup>
/**
 * PushHandler Component — v0.16.0
 * Toast для пушів, deep-link navigation
 */

import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { 
  Bell, 
  MessageSquare, 
  Calendar, 
  Users, 
  AlertCircle, 
  CheckCircle,
  X,
} from 'lucide-vue-next'
import Button from '@/ui/Button.vue'
import { 
  isPushSupported, 
  isNotificationPermitted, 
  isNotificationDenied,
  registerPush,
  getPushStatus,
} from '../../core/push/register'

const router = useRouter()
const { t } = useI18n()

// Props
const props = defineProps({
  /**
   * Auto-show permission banner
   */
  autoShowBanner: {
    type: Boolean,
    default: true,
  },
  /**
   * Delay before showing banner (ms)
   */
  bannerDelay: {
    type: Number,
    default: 5000,
  },
  /**
   * Toast auto-dismiss time (ms)
   */
  toastDuration: {
    type: Number,
    default: 5000,
  },
})

const emit = defineEmits(['permission-granted', 'permission-denied', 'toast-click'])

// State
const showPermissionBanner = ref(false)
const isEnabling = ref(false)
const toasts = ref([])
const bannerDismissed = ref(false)

let bannerTimer = null
const toastTimers = new Map()

// Toast types and icons
const TOAST_TYPES = {
  message: 'message',
  lesson: 'lesson',
  user: 'user',
  success: 'success',
  error: 'error',
  default: 'default',
}

const getToastIcon = (type) => {
  const icons = {
    [TOAST_TYPES.message]: MessageSquare,
    [TOAST_TYPES.lesson]: Calendar,
    [TOAST_TYPES.user]: Users,
    [TOAST_TYPES.success]: CheckCircle,
    [TOAST_TYPES.error]: AlertCircle,
    [TOAST_TYPES.default]: Bell,
  }
  return icons[type] || icons.default
}

// Methods
const checkAndShowBanner = async () => {
  if (!props.autoShowBanner || bannerDismissed.value) return
  
  // Check localStorage for dismissed state
  const dismissed = localStorage.getItem('push_banner_dismissed')
  if (dismissed) {
    bannerDismissed.value = true
    return
  }
  
  const status = await getPushStatus()
  
  // Show banner if supported but not permitted and not denied
  if (status.supported && !status.permitted && !status.denied) {
    if (bannerTimer) {
      clearTimeout(bannerTimer)
      bannerTimer = null
    }
    bannerTimer = setTimeout(() => {
      bannerTimer = null
      showPermissionBanner.value = true
    }, props.bannerDelay)
  }
}

const enablePush = async () => {
  isEnabling.value = true
  
  try {
    const result = await registerPush()
    
    if (result.success) {
      showPermissionBanner.value = false
      emit('permission-granted')
      
      // Show success toast
      addToast({
        type: TOAST_TYPES.success,
        title: t('push.enabled'),
        body: t('push.enabledDescription'),
      })
    } else {
      emit('permission-denied')
      
      if (result.reason === 'permission_denied') {
        addToast({
          type: TOAST_TYPES.error,
          title: t('push.denied'),
          body: t('push.deniedDescription'),
        })
      }
    }
  } catch (error) {
    console.error('[pushHandler] enable failed:', error)
    
    addToast({
      type: TOAST_TYPES.error,
      title: t('push.error'),
      body: error.message,
    })
  } finally {
    isEnabling.value = false
  }
}

const dismissBanner = () => {
  showPermissionBanner.value = false
  bannerDismissed.value = true
  localStorage.setItem('push_banner_dismissed', 'true')
}

const addToast = (toast) => {
  const id = Date.now()
  
  toasts.value.push({
    id,
    type: toast.type || TOAST_TYPES.default,
    title: toast.title,
    body: toast.body,
    url: toast.url || null,
    data: toast.data || {},
  })
  
  // Auto-dismiss
  if (props.toastDuration > 0) {
    const existing = toastTimers.get(id)
    if (existing) {
      clearTimeout(existing)
      toastTimers.delete(id)
    }
    const timer = setTimeout(() => {
      toastTimers.delete(id)
      dismissToast(id)
    }, props.toastDuration)
    toastTimers.set(id, timer)
  }
  
  return id
}

const dismissToast = (id) => {
  const timer = toastTimers.get(id)
  if (timer) {
    clearTimeout(timer)
    toastTimers.delete(id)
  }
  const index = toasts.value.findIndex(t => t.id === id)
  if (index > -1) {
    toasts.value.splice(index, 1)
  }
}

const handleToastClick = (toast) => {
  emit('toast-click', toast)
  
  // Navigate to URL if provided
  if (toast.url) {
    navigateToUrl(toast.url)
  }
  
  dismissToast(toast.id)
}

const navigateToUrl = (url) => {
  // Handle deep links
  if (url.startsWith('/')) {
    router.push(url)
  } else if (url.startsWith('mash://')) {
    // Custom protocol handling
    const path = url.replace('mash://', '/')
    router.push(path)
  } else {
    // External URL
    window.open(url, '_blank')
  }
}

// Handle push messages from service worker
const handleServiceWorkerMessage = (event) => {
  const { type, payload } = event.data || {}
  
  if (type === 'PUSH_RECEIVED') {
    addToast({
      type: payload.type || TOAST_TYPES.default,
      title: payload.title,
      body: payload.body,
      url: payload.url,
      data: payload.data,
    })
  }
}

// Lifecycle
onMounted(() => {
  checkAndShowBanner()
  
  // Listen for messages from service worker
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.addEventListener('message', handleServiceWorkerMessage)
  }
})

onUnmounted(() => {
  if (bannerTimer) {
    clearTimeout(bannerTimer)
    bannerTimer = null
  }
  for (const timer of toastTimers.values()) {
    clearTimeout(timer)
  }
  toastTimers.clear()

  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.removeEventListener('message', handleServiceWorkerMessage)
  }
})

// Expose methods for external use
defineExpose({
  addToast,
  dismissToast,
  showBanner: () => { showPermissionBanner.value = true },
  hideBanner: () => { showPermissionBanner.value = false },
})
</script>

<style scoped>
/* Permission Banner */
.permission-banner {
  position: fixed;
  top: 16px;
  left: 50%;
  transform: translateX(-50%);
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 16px 20px;
  background: var(--bg-primary, white);
  border-radius: 12px;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.15);
  z-index: 1000;
  max-width: 500px;
  width: calc(100% - 32px);
}

.banner-content {
  display: flex;
  align-items: flex-start;
  gap: 12px;
  flex: 1;
}

.banner-icon {
  width: 24px;
  height: 24px;
  color: var(--color-primary, #3b82f6);
  flex-shrink: 0;
}

.banner-text {
  flex: 1;
}

.banner-text strong {
  display: block;
  font-size: 14px;
  margin-bottom: 4px;
}

.banner-text p {
  font-size: 13px;
  color: var(--text-secondary, #6b7280);
  margin: 0;
}

.banner-actions {
  display: flex;
  gap: 8px;
  flex-shrink: 0;
}

/* Toast Container */
.push-toast-container {
  position: fixed;
  top: 16px;
  right: 16px;
  display: flex;
  flex-direction: column;
  gap: 8px;
  z-index: 1001;
  max-width: 380px;
  width: 100%;
  pointer-events: none;
}

.push-toast {
  display: flex;
  align-items: flex-start;
  gap: 12px;
  padding: 14px 16px;
  background: var(--bg-primary, white);
  border-radius: 10px;
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.12);
  cursor: pointer;
  pointer-events: auto;
  transition: transform 0.2s, box-shadow 0.2s;
}

.push-toast:hover {
  transform: translateY(-2px);
  box-shadow: 0 6px 20px rgba(0, 0, 0, 0.15);
}

.toast-icon-wrapper {
  width: 36px;
  height: 36px;
  border-radius: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.toast-message .toast-icon-wrapper { background: var(--color-info-bg, #dbeafe); color: var(--color-info, #2563eb); }
.toast-lesson .toast-icon-wrapper { background: var(--color-success-bg, #dcfce7); color: var(--color-success, #16a34a); }
.toast-user .toast-icon-wrapper { background: var(--color-warning-bg, #fef3c7); color: var(--color-warning, #d97706); }
.toast-success .toast-icon-wrapper { background: var(--color-success-bg, #dcfce7); color: var(--color-success, #16a34a); }
.toast-error .toast-icon-wrapper { background: var(--color-error-bg, #fee2e2); color: var(--color-error, #dc2626); }
.toast-default .toast-icon-wrapper { background: var(--color-bg-secondary, #f3f4f6); color: var(--text-secondary, #6b7280); }

.toast-icon {
  width: 18px;
  height: 18px;
}

.toast-content {
  flex: 1;
  min-width: 0;
}

.toast-title {
  display: block;
  font-size: 14px;
  font-weight: 600;
  margin-bottom: 2px;
  color: var(--text-primary, #111827);
}

.toast-body {
  font-size: 13px;
  color: var(--text-secondary, #6b7280);
  margin: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
}

.toast-close {
  padding: 4px;
  background: none;
  border: none;
  cursor: pointer;
  color: var(--text-muted, #9ca3af);
  opacity: 0.7;
  transition: opacity 0.2s;
  flex-shrink: 0;
}

.toast-close:hover {
  opacity: 1;
}

.close-icon {
  width: 16px;
  height: 16px;
}

/* Transitions */
.slide-down-enter-active,
.slide-down-leave-active {
  transition: all 0.3s ease;
}

.slide-down-enter-from,
.slide-down-leave-to {
  opacity: 0;
  transform: translateX(-50%) translateY(-20px);
}

.toast-enter-active,
.toast-leave-active {
  transition: all 0.3s ease;
}

.toast-enter-from {
  opacity: 0;
  transform: translateX(100%);
}

.toast-leave-to {
  opacity: 0;
  transform: translateX(100%);
}

/* Mobile */
@media (max-width: 480px) {
  .permission-banner {
    flex-direction: column;
    align-items: stretch;
  }
  
  .banner-actions {
    justify-content: flex-end;
  }
  
  .push-toast-container {
    right: 8px;
    left: 8px;
    max-width: none;
  }
}
</style>
