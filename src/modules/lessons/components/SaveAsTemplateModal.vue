<template>
  <Teleport to="body">
    <div
      v-if="modelValue"
      class="sat-overlay"
      @click.self="close"
    >
      <div class="sat-modal">
        <h2 class="sat-modal__title">
          {{ $t('template.saveAsTemplate') }}
        </h2>

        <label class="sat-modal__label">
          {{ $t('template.titleLabel') }}
        </label>
        <input
          v-model="title"
          type="text"
          maxlength="200"
          class="sat-modal__input"
          :placeholder="$t('template.titlePlaceholder')"
          @keyup.enter="save"
        />

        <p v-if="error" class="sat-modal__error">
          {{ $t(`template.${error}`) }}
        </p>

        <div class="sat-modal__footer">
          <button
            @click="close"
            class="sat-modal__btn sat-modal__btn--secondary"
          >
            {{ $t('common.cancel') }}
          </button>
          <button
            @click="save"
            :disabled="!title.trim() || isSaving"
            class="sat-modal__btn sat-modal__btn--primary"
          >
            <span v-if="isSaving" class="sat-modal__saving">
              <svg class="sat-modal__spinner" viewBox="0 0 24 24">
                <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" fill="none"/>
                <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
              </svg>
              {{ $t('common.loading') }}
            </span>
            <span v-else>{{ $t('template.save') }}</span>
          </button>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { lessonsTemplateApi } from '../api/lessonsTemplateApi'

const props = defineProps<{
  modelValue: boolean
  lessonId: number | null
}>()

const emit = defineEmits<{
  'update:modelValue': [value: boolean]
  saved: [templateId: number]
}>()

const title = ref('')
const isSaving = ref(false)
const error = ref<string | null>(null)

function close() {
  emit('update:modelValue', false)
  title.value = ''
  error.value = null
}

async function save() {
  if (!title.value.trim() || !props.lessonId) return
  isSaving.value = true
  error.value = null

  try {
    const res = await lessonsTemplateApi.saveAsTemplate(props.lessonId, title.value.trim())
    const data = (res as Record<string, unknown>).data ?? res
    emit('saved', (data as Record<string, unknown>).id as number)
    close()
  } catch (e: unknown) {
    const status = (e as Record<string, Record<string, unknown>>)?.response?.status
    if (status === 400) {
      error.value = 'titleRequired'
    } else if (status === 404) {
      error.value = 'lessonNotFound'
    } else {
      error.value = 'saveFailed'
    }
  } finally {
    isSaving.value = false
  }
}
</script>

<style scoped>
.sat-overlay {
  position: fixed;
  inset: 0;
  z-index: 50;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(0, 0, 0, 0.5);
}
.sat-modal {
  background: var(--card-bg);
  border-radius: 12px;
  box-shadow: 0 20px 60px var(--shadow);
  width: 100%;
  max-width: 420px;
  padding: 24px;
}
.sat-modal__title {
  font-size: 18px;
  font-weight: 600;
  color: var(--text-primary);
  margin: 0 0 16px;
}
.sat-modal__label {
  display: block;
  font-size: 13px;
  font-weight: 500;
  color: var(--text-primary);
  margin-bottom: 4px;
}
.sat-modal__input {
  width: 100%;
  border: 1px solid var(--border-color);
  border-radius: 8px;
  padding: 8px 12px;
  font-size: 14px;
  outline: none;
  transition: border-color 0.15s, box-shadow 0.15s;
}
.sat-modal__input:focus {
  border-color: var(--accent);
  box-shadow: 0 0 0 3px color-mix(in srgb, var(--accent) 15%, transparent);
}
.sat-modal__error {
  margin-top: 8px;
  font-size: 13px;
  color: var(--danger-bg);
}
.sat-modal__footer {
  margin-top: 20px;
  display: flex;
  justify-content: flex-end;
  gap: 10px;
}
.sat-modal__btn {
  padding: 8px 16px;
  font-size: 13px;
  font-weight: 500;
  border-radius: 8px;
  cursor: pointer;
  border: none;
  transition: background 0.15s;
}
.sat-modal__btn--secondary {
  background: none;
  color: var(--text-primary);
}
.sat-modal__btn--secondary:hover {
  background: var(--bg-secondary);
}
.sat-modal__btn--primary {
  background: var(--accent);
  color: var(--accent-contrast);
}
.sat-modal__btn--primary:hover:not(:disabled) {
  background: var(--accent-hover);
}
.sat-modal__btn--primary:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
.sat-modal__saving {
  display: inline-flex;
  align-items: center;
  gap: 6px;
}
.sat-modal__spinner {
  width: 16px;
  height: 16px;
  animation: sat-spin 0.8s linear infinite;
}
@keyframes sat-spin {
  to { transform: rotate(360deg); }
}
</style>
