<script setup lang="ts">
import { ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { AlertTriangle, X } from 'lucide-vue-next'
import Button from '@/ui/Button.vue'

const props = defineProps<{
  show: boolean
  conflictFields?: string[]
  serverPayload?: any
  clientPayload?: any
  onResolve?: (strategy: 'server' | 'client' | 'merge') => Promise<void>
  onCancel?: () => void
}>()

const { t } = useI18n()

const isResolving = ref(false)
const error = ref('')

function formatFieldValue(value: any): string {
  if (value === null || value === undefined) return '(empty)'
  if (typeof value === 'string') return value
  if (typeof value === 'number' || typeof value === 'boolean') return String(value)
  if (Array.isArray(value)) {
    // Format arrays with better readability
    if (value.length === 0) return '[]'
    return JSON.stringify(value, null, 2)
  }
  if (typeof value === 'object') {
    // Format objects with better readability
    if (Object.keys(value).length === 0) return '{}'
    return JSON.stringify(value, null, 2)
  }
  return String(value)
}

function getNestedValue(obj: any, path: string): any {
  const keys = path.split('.')
  let current = obj
  for (const key of keys) {
    if (current === null || current === undefined) return undefined
    current = current[key]
  }
  return current
}

async function handleResolve(strategy: 'server' | 'client' | 'merge') {
  if (!props.onResolve) return
  
  isResolving.value = true
  error.value = ''
  
  try {
    await props.onResolve(strategy)
  } catch (err: any) {
    error.value = err?.message || t('marketplace.draft.resolveError')
  } finally {
    isResolving.value = false
  }
}

function handleCancel() {
  if (isResolving.value) return
  if (props.onCancel) props.onCancel()
}
</script>

<template>
  <Transition name="modal">
    <div v-if="show" class="modal-overlay" @click="handleCancel">
      <div class="modal-content" @click.stop>
        <div class="modal-header">
          <div class="header-icon">
            <AlertTriangle :size="24" />
          </div>
          <h2>{{ t('marketplace.draft.conflictTitle') }}</h2>
          <Button
            variant="ghost"
            iconOnly
            :disabled="isResolving"
            @click="handleCancel"
          >
            <X :size="20" />
          </Button>
        </div>

        <div class="modal-body">
          <p class="description">
            {{ t('marketplace.draft.conflictDescription') }}
          </p>

          <div v-if="conflictFields && conflictFields.length" class="conflict-fields">
            <p class="fields-label">{{ t('marketplace.draft.conflictFields') }}:</p>
            
            <div class="diff-container">
              <div v-for="field in conflictFields" :key="field" class="field-diff">
                <h4 class="field-name">{{ field }}</h4>
                <div class="diff-columns">
                  <div class="diff-column server">
                    <div class="column-header">{{ t('marketplace.draft.serverVersion') }}</div>
                    <div class="column-content">
                      <pre>{{ formatFieldValue(getNestedValue(serverPayload, field)) }}</pre>
                    </div>
                  </div>
                  <div class="diff-column client">
                    <div class="column-header">{{ t('marketplace.draft.clientVersion') }}</div>
                    <div class="column-content">
                      <pre>{{ formatFieldValue(getNestedValue(clientPayload, field)) }}</pre>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div v-if="error" class="error-box">
            <AlertTriangle :size="18" />
            <p>{{ error }}</p>
          </div>

          <div class="strategies">
            <button
              type="button"
              class="strategy-card"
              :disabled="isResolving"
              @click="handleResolve('server')"
            >
              <div class="strategy-header">
                <h3>{{ t('marketplace.draft.useServer') }}</h3>
              </div>
              <p class="strategy-description">
                {{ t('marketplace.draft.useServerDescription') }}
              </p>
            </button>

            <button
              type="button"
              class="strategy-card"
              :disabled="isResolving"
              @click="handleResolve('client')"
            >
              <div class="strategy-header">
                <h3>{{ t('marketplace.draft.useClient') }}</h3>
              </div>
              <p class="strategy-description">
                {{ t('marketplace.draft.useClientDescription') }}
              </p>
            </button>

            <button
              type="button"
              class="strategy-card"
              :disabled="isResolving"
              @click="handleResolve('merge')"
            >
              <div class="strategy-header">
                <h3>{{ t('marketplace.draft.useMerge') }}</h3>
              </div>
              <p class="strategy-description">
                {{ t('marketplace.draft.useMergeDescription') }}
              </p>
            </button>
          </div>
        </div>

        <div class="modal-footer">
          <Button
            variant="outline"
            :disabled="isResolving"
            @click="handleCancel"
          >
            {{ t('common.cancel') }}
          </Button>
        </div>
      </div>
    </div>
  </Transition>
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
  border-radius: var(--radius-lg, 12px);
  box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04);
  max-width: 600px;
  width: 100%;
  max-height: 90vh;
  overflow-y: auto;
}

.modal-header {
  padding: 1.5rem;
  border-bottom: 1px solid var(--border-color);
  display: flex;
  align-items: center;
  gap: 0.75rem;
}

.header-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 40px;
  height: 40px;
  background: var(--warning-bg, #fef3c7);
  color: var(--warning, #f59e0b);
  border-radius: var(--radius-md, 8px);
}

.modal-header h2 {
  flex: 1;
  font-size: 1.25rem;
  font-weight: 600;
  margin: 0;
  color: var(--text-primary);
}

.close-button {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  border: none;
  background: transparent;
  color: var(--text-secondary);
  cursor: pointer;
  border-radius: var(--radius-sm, 4px);
  transition: all 0.2s;
}

.close-button:hover:not(:disabled) {
  background: var(--surface-hover);
  color: var(--text-primary);
}

.close-button:disabled {
  opacity: 0.5;
  cursor: not-allowed;
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
}

.conflict-fields {
  padding: 1rem;
  background: var(--surface-secondary);
  border-radius: var(--radius-md, 8px);
  border: 1px solid var(--border-color);
}

.fields-label {
  font-size: 0.875rem;
  font-weight: 600;
  color: var(--text-primary);
  margin: 0 0 1rem 0;
}

.diff-container {
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
}

.field-diff {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.field-name {
  font-size: 0.875rem;
  font-weight: 600;
  color: var(--text-primary);
  margin: 0;
  padding-bottom: 0.5rem;
  border-bottom: 1px solid var(--border-color);
}

.diff-columns {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 1rem;
}

.diff-column {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  min-width: 0;
}

.column-header {
  font-size: 0.75rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  padding: 0.5rem;
  border-radius: var(--radius-sm, 4px);
}

.diff-column.server .column-header {
  background: var(--info-bg, #dbeafe);
  color: var(--info, #3b82f6);
}

.diff-column.client .column-header {
  background: var(--success-bg, #d1fae5);
  color: var(--success, #059669);
}

.column-content {
  padding: 0.75rem;
  background: var(--surface-card);
  border: 1px solid var(--border-color);
  border-radius: var(--radius-sm, 4px);
  overflow-x: auto;
}

.column-content pre {
  margin: 0;
  font-size: 0.8125rem;
  font-family: 'Courier New', monospace;
  white-space: pre-wrap;
  word-break: break-word;
  color: var(--text-primary);
  line-height: 1.5;
}

.fields-list {
  margin: 0;
  padding-left: 1.5rem;
  font-size: 0.875rem;
  color: var(--text-secondary);
}

.fields-list li {
  margin: 0.25rem 0;
}

.error-box {
  display: flex;
  align-items: flex-start;
  gap: 0.75rem;
  padding: 0.75rem;
  border-radius: var(--radius-md, 8px);
  font-size: 0.875rem;
  background: var(--danger-bg, #fee2e2);
  color: var(--danger, #dc2626);
  border: 1px solid var(--danger-border, #fca5a5);
}

.error-box p {
  margin: 0;
  flex: 1;
}

.strategies {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.strategy-card {
  padding: 1rem;
  border: 2px solid var(--border-color);
  border-radius: var(--radius-md, 8px);
  background: var(--surface-card);
  cursor: pointer;
  transition: all 0.2s;
  text-align: left;
}

.strategy-card:hover:not(:disabled) {
  border-color: var(--primary);
  background: var(--primary-bg, #e0f2fe);
}

.strategy-card:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.strategy-header {
  margin-bottom: 0.5rem;
}

.strategy-header h3 {
  font-size: 1rem;
  font-weight: 600;
  margin: 0;
  color: var(--text-primary);
}

.strategy-description {
  font-size: 0.875rem;
  color: var(--text-secondary);
  margin: 0;
  line-height: 1.5;
}

.modal-footer {
  padding: 1rem 1.5rem;
  border-top: 1px solid var(--border-color);
  display: flex;
  justify-content: flex-end;
  gap: 0.75rem;
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
