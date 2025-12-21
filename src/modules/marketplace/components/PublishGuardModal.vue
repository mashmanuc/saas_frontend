<template>
  <Transition name="modal">
    <div v-if="show" class="modal-overlay" @click="handleClose">
      <div class="modal-content" @click.stop>
        <div class="modal-header">
          <div class="header-icon">
            <AlertTriangle :size="24" />
          </div>
          <h2>{{ $t('marketplace.draft.publishGuardTitle') }}</h2>
        </div>

        <div class="modal-body">
          <p class="description">
            {{ $t('marketplace.draft.publishGuardDescription') }}
          </p>

          <div class="warning-box">
            <AlertTriangle :size="18" />
            <p>{{ $t('marketplace.draft.publishGuardWarning') }}</p>
          </div>

          <div class="actions-list">
            <div class="action-item">
              <span class="action-number">1.</span>
              <span class="action-text">{{ $t('marketplace.draft.publishGuardStep1') }}</span>
            </div>
            <div class="action-item">
              <span class="action-number">2.</span>
              <span class="action-text">{{ $t('marketplace.draft.publishGuardStep2') }}</span>
            </div>
          </div>
        </div>

        <div class="modal-footer">
          <button type="button" class="btn btn-secondary" @click="handleClose">
            {{ $t('common.cancel') }}
          </button>
          <button type="button" class="btn btn-primary" @click="handleSync">
            {{ $t('marketplace.draft.syncNow') }}
          </button>
        </div>
      </div>
    </div>
  </Transition>
</template>

<script setup>
import { useI18n } from 'vue-i18n'
import { AlertTriangle } from 'lucide-vue-next'

const props = defineProps({
  show: {
    type: Boolean,
    default: false,
  },
  onSync: {
    type: Function,
    default: () => {},
  },
  onClose: {
    type: Function,
    default: () => {},
  },
})

const { t } = useI18n()

function handleSync() {
  if (props.onSync) props.onSync()
}

function handleClose() {
  if (props.onClose) props.onClose()
}
</script>

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
  border-radius: var(--radius-lg, 12px);
  box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04);
  max-width: 500px;
  width: 100%;
}

.modal-header {
  padding: 1.5rem;
  border-bottom: 1px solid var(--border-color);
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.75rem;
  text-align: center;
}

.header-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 64px;
  height: 64px;
  background: var(--warning-bg, #fef3c7);
  color: var(--warning, #f59e0b);
  border-radius: 50%;
}

.modal-header h2 {
  font-size: 1.25rem;
  font-weight: 600;
  margin: 0;
  color: var(--text-primary);
}

.modal-body {
  padding: 1.5rem;
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
}

.description {
  font-size: 0.9375rem;
  color: var(--text-secondary);
  margin: 0;
  line-height: 1.6;
  text-align: center;
}

.warning-box {
  display: flex;
  align-items: flex-start;
  gap: 0.75rem;
  padding: 0.75rem;
  border-radius: var(--radius-md, 8px);
  font-size: 0.875rem;
  background: var(--warning-bg, #fef3c7);
  color: var(--warning, #f59e0b);
  border: 1px solid var(--warning-border, #fcd34d);
}

.warning-box p {
  margin: 0;
  flex: 1;
}

.actions-list {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.action-item {
  display: flex;
  align-items: flex-start;
  gap: 0.75rem;
  padding: 0.75rem;
  background: var(--surface-secondary);
  border-radius: var(--radius-sm, 4px);
  border: 1px solid var(--border-color);
}

.action-number {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
  background: var(--primary);
  color: white;
  border-radius: 50%;
  font-size: 0.75rem;
  font-weight: 600;
  flex-shrink: 0;
}

.action-text {
  font-size: 0.875rem;
  color: var(--text-primary);
  line-height: 1.5;
}

.modal-footer {
  padding: 1rem 1.5rem;
  border-top: 1px solid var(--border-color);
  display: flex;
  justify-content: flex-end;
  gap: 0.75rem;
}

.btn {
  padding: 0.5rem 1rem;
  border-radius: var(--radius-sm, 6px);
  font-size: 0.875rem;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;
  border: none;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
}

.btn-secondary {
  background: var(--surface-secondary);
  color: var(--text-primary);
  border: 1px solid var(--border-color);
}

.btn-secondary:hover {
  background: var(--surface-hover);
}

.btn-primary {
  background: var(--primary);
  color: white;
}

.btn-primary:hover {
  background: var(--primary-hover);
}

.modal-enter-active,
.modal-leave-active {
  transition: opacity 0.3s ease;
}

.modal-enter-from,
.modal-leave-to {
  opacity: 0;
}

.modal-enter-active .modal-content,
.modal-leave-active .modal-content {
  transition: transform 0.3s ease;
}

.modal-enter-from .modal-content,
.modal-leave-to .modal-content {
  transform: scale(0.95);
}
</style>
