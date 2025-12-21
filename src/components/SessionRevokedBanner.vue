<template>
  <Transition name="banner">
    <div v-if="show" class="banner-overlay">
      <div class="banner-content">
        <div class="banner-icon">
          <AlertTriangle :size="24" />
        </div>
        <div class="banner-body">
          <h3 class="banner-title">{{ $t('auth.sessionRevoked.title') }}</h3>
          <p class="banner-message">{{ $t('auth.sessionRevoked.message') }}</p>
          <p v-if="requestId" class="request-id">Request ID: {{ requestId }}</p>
        </div>
        <div class="banner-actions">
          <button type="button" class="btn btn-primary" @click="handleRelogin">
            {{ $t('auth.sessionRevoked.relogin') }}
          </button>
        </div>
      </div>
    </div>
  </Transition>
</template>

<script setup>
import { ref, watch, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { AlertTriangle } from 'lucide-vue-next'
import { trackEvent } from '@/utils/telemetryAgent'

const props = defineProps({
  show: {
    type: Boolean,
    default: false,
  },
  requestId: {
    type: String,
    default: '',
  },
})

const emit = defineEmits(['close'])

const router = useRouter()

watch(() => props.show, (newVal) => {
  if (newVal) {
    trackEvent('auth.session_revoked_banner_shown', {
      request_id: props.requestId,
    })
  }
})

function handleRelogin() {
  emit('close')
  router.push('/auth/login')
}
</script>

<style scoped>
.banner-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.75);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 9999;
  padding: 1rem;
}

.banner-content {
  background: var(--surface-card);
  border-radius: var(--radius-lg, 12px);
  box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04);
  max-width: 500px;
  width: 100%;
  padding: 2rem;
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
  border: 2px solid var(--danger, #dc2626);
}

.banner-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 64px;
  height: 64px;
  background: var(--danger-bg, #fee2e2);
  color: var(--danger, #dc2626);
  border-radius: 50%;
  margin: 0 auto;
}

.banner-body {
  text-align: center;
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.banner-title {
  font-size: 1.25rem;
  font-weight: 600;
  color: var(--text-primary);
  margin: 0;
}

.banner-message {
  font-size: 0.9375rem;
  color: var(--text-secondary);
  margin: 0;
  line-height: 1.6;
}

.request-id {
  font-size: 0.75rem;
  color: var(--text-secondary);
  font-family: monospace;
  margin: 0;
  opacity: 0.8;
}

.banner-actions {
  display: flex;
  justify-content: center;
  gap: 0.75rem;
}

.btn {
  padding: 0.75rem 1.5rem;
  border-radius: var(--radius-sm, 6px);
  font-size: 0.9375rem;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;
  border: none;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
}

.btn-primary {
  background: var(--primary);
  color: white;
}

.btn-primary:hover {
  background: var(--primary-hover);
}

.banner-enter-active,
.banner-leave-active {
  transition: opacity 0.3s ease;
}

.banner-enter-from,
.banner-leave-to {
  opacity: 0;
}

.banner-enter-active .banner-content,
.banner-leave-active .banner-content {
  transition: transform 0.3s ease;
}

.banner-enter-from .banner-content,
.banner-leave-to .banner-content {
  transform: scale(0.9);
}
</style>
