<template>
  <Transition name="slide-down">
    <div v-if="visible" class="trust-guard-banner" :class="severityClass">
      <div class="banner-icon">
        <i :class="iconClass"></i>
      </div>
      <div class="banner-content">
        <h4 class="banner-title">{{ title }}</h4>
        <p class="banner-message">{{ message }}</p>
        <div v-if="actions.length" class="banner-actions">
          <Button
            v-for="action in actions"
            :key="action.label"
            :variant="action.variant || 'ghost'"
            @click="action.handler"
          >
            {{ action.label }}
          </Button>
        </div>
      </div>
      <button class="btn-close" @click="dismiss" :aria-label="$t('common.close')">
        <i class="icon-close"></i>
      </button>
    </div>
  </Transition>
</template>

<script setup>
import { computed, ref } from 'vue'
import { useRouter } from 'vue-router'
import Button from '@/ui/Button.vue'

const props = defineProps({
  error: {
    type: Object,
    default: null
  }
})

const emit = defineEmits(['dismiss'])

const router = useRouter()
const dismissed = ref(false)

const visible = computed(() => {
  return props.error && !dismissed.value
})

const errorCode = computed(() => props.error?.code || '')
const errorData = computed(() => props.error?.data || {})

const severityClass = computed(() => {
  const severity = errorData.value?.severity || 'warning'
  return `severity-${severity}`
})

const iconClass = computed(() => {
  const icons = {
    'INQUIRY_BLOCKED': 'icon-message-square-off',
    'CONTACT_ACCESS_DENIED': 'icon-lock',
    'BANNED': 'icon-ban',
    'RATE_LIMITED': 'icon-clock',
    'TRUST_ERROR': 'icon-shield-alert',
    'default': 'icon-alert-triangle'
  }
  return icons[errorCode.value] || icons['default']
})

const title = computed(() => {
  const titles = {
    'INQUIRY_BLOCKED': 'Доступ до запитів обмежено',
    'CONTACT_ACCESS_DENIED': 'Доступ до контактів заблоковано',
    'BANNED': 'Аккаунт заблоковано',
    'RATE_LIMITED': 'Занадто багато спроб',
    'TRUST_ERROR': 'Помилка безпеки',
    'default': 'Увага'
  }
  return titles[errorCode.value] || titles['default']
})

const message = computed(() => {
  return props.error?.message || 
         errorData.value?.message || 
         'Виникла проблема з доступом. Будь ласка, спробуйте пізніше.'
})

const actions = computed(() => {
  const actions = []
  
  if (errorCode.value === 'BANNED' && errorData.value?.can_appeal) {
    actions.push({
      label: 'Подати апеляцію',
      variant: 'primary',
      handler: () => router.push('/trust/appeals')
    })
  }
  
  if (errorCode.value === 'CONTACT_ACCESS_DENIED') {
    actions.push({
      label: 'Поповнити баланс',
      variant: 'primary',
      handler: () => router.push('/contacts')
    })
  }
  
  if (errorCode.value === 'INQUIRY_BLOCKED') {
    actions.push({
      label: 'Дізнатися більше',
      variant: 'ghost',
      handler: () => router.push('/help/trust')
    })
  }
  
  return actions
})

function dismiss() {
  dismissed.value = true
  emit('dismiss')
}
</script>

<style scoped>
.trust-guard-banner {
  display: flex;
  align-items: flex-start;
  gap: var(--spacing-md);
  padding: var(--spacing-md) var(--spacing-lg);
  position: relative;
}

.severity-error {
  background: var(--color-error);
  color: var(--color-error-text);
}

.severity-warning {
  background: var(--color-warning);
  color: var(--color-warning-text);
}

.severity-info {
  background: var(--color-info);
  color: var(--color-info-text);
}

.banner-icon {
  font-size: 24px;
  flex-shrink: 0;
  opacity: 0.8;
}

.banner-content {
  flex: 1;
  min-width: 0;
}

.banner-title {
  font-size: var(--font-size-base);
  font-weight: 600;
  margin: 0 0 var(--spacing-xs);
}

.banner-message {
  font-size: var(--font-size-sm);
  margin: 0 0 var(--spacing-sm);
  opacity: 0.9;
}

.banner-actions {
  display: flex;
  gap: var(--spacing-sm);
  flex-wrap: wrap;
}

.btn-close {
  background: none;
  border: none;
  color: inherit;
  cursor: pointer;
  padding: var(--spacing-xs);
  opacity: 0.6;
  transition: opacity 0.2s ease;
  flex-shrink: 0;
}

.btn-close:hover {
  opacity: 1;
}

/* Slide down animation */
.slide-down-enter-active,
.slide-down-leave-active {
  transition: all 0.3s ease;
}

.slide-down-enter-from,
.slide-down-leave-to {
  transform: translateY(-100%);
  opacity: 0;
}

@media (max-width: 640px) {
  .trust-guard-banner {
    flex-direction: column;
    align-items: flex-start;
  }
  
  .banner-actions {
    width: 100%;
  }
}
</style>
