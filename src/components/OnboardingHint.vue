<template>
  <Transition name="hint-fade">
    <div
      v-if="visible"
      class="onboarding-hint"
      :class="[`hint-${variant}`]"
      role="status"
    >
      <div class="hint-icon">{{ icon }}</div>
      <div class="hint-body">
        <slot />
      </div>
      <div class="hint-actions">
        <slot name="actions" />
        <button
          v-if="dismissible"
          type="button"
          class="hint-dismiss"
          :aria-label="$t('onboarding.hints.dismiss', 'Закрити підказку')"
          @click="handleDismiss"
        >
          ✕
        </button>
      </div>
    </div>
  </Transition>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useOnboardingHints } from '@/composables/useOnboardingHints'

const props = withDefaults(defineProps<{
  hintId: string
  variant?: 'info' | 'success' | 'warning'
  dismissible?: boolean
  icon?: string
  /** Додаткова зовнішня умова показу (AND з isHintVisible) */
  condition?: boolean
}>(), {
  variant: 'info',
  dismissible: true,
  icon: '💡',
  condition: true,
})

const emit = defineEmits<{
  dismissed: []
}>()

const { isHintVisible, dismissHint } = useOnboardingHints()

const visible = computed(() => props.condition && isHintVisible(props.hintId))

function handleDismiss() {
  dismissHint(props.hintId)
  emit('dismissed')
}
</script>

<style scoped>
.onboarding-hint {
  display: flex;
  align-items: flex-start;
  gap: var(--space-md);
  padding: var(--space-md) var(--space-lg);
  border-radius: var(--radius-md);
  border: 1px solid;
  margin-bottom: var(--space-md);
}

.hint-info {
  background: color-mix(in srgb, var(--accent) 8%, var(--card-bg));
  border-color: color-mix(in srgb, var(--accent) 25%, transparent);
}

.hint-success {
  background: color-mix(in srgb, var(--success-bg, #22c55e) 8%, var(--card-bg));
  border-color: color-mix(in srgb, var(--success-bg, #22c55e) 25%, transparent);
}

.hint-warning {
  background: color-mix(in srgb, var(--warning-bg, #eab308) 8%, var(--card-bg));
  border-color: color-mix(in srgb, var(--warning-bg, #eab308) 25%, transparent);
}

.hint-icon {
  flex-shrink: 0;
  font-size: 1.25rem;
  line-height: 1.5;
}

.hint-body {
  flex: 1;
  font-size: var(--text-sm);
  color: var(--text-primary);
  line-height: 1.6;
}

.hint-body :deep(ol) {
  margin: var(--space-xs) 0;
  padding-left: 1.25rem;
}

.hint-body :deep(li) {
  margin-bottom: 2px;
}

.hint-body :deep(strong) {
  font-weight: 600;
}

.hint-actions {
  display: flex;
  align-items: flex-start;
  gap: var(--space-sm);
  flex-shrink: 0;
}

.hint-dismiss {
  background: none;
  border: none;
  color: var(--text-secondary);
  cursor: pointer;
  font-size: var(--text-base);
  padding: 2px 4px;
  border-radius: var(--radius-sm);
  transition: all var(--transition-base);
  line-height: 1;
}

.hint-dismiss:hover {
  color: var(--text-primary);
  background: color-mix(in srgb, var(--text-primary) 8%, transparent);
}

/* Fade transition */
.hint-fade-enter-active {
  transition: all 0.3s ease;
}
.hint-fade-leave-active {
  transition: all 0.2s ease;
}
.hint-fade-enter-from,
.hint-fade-leave-to {
  opacity: 0;
  transform: translateY(-8px);
}

@media (max-width: 768px) {
  .onboarding-hint {
    padding: var(--space-sm) var(--space-md);
  }
}
</style>
