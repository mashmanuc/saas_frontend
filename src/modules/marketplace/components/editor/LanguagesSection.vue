<script setup lang="ts">
import { ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { Plus, Trash2 } from 'lucide-vue-next'

const props = defineProps<{
  modelValue: Array<{
    language: string
    level: string
  }>
}>()

const emit = defineEmits(['update:modelValue'])

const { t } = useI18n()

const levels = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2', 'Native']

function addLanguage() {
  const updated = [...props.modelValue]
  updated.push({
    language: '',
    level: 'B1'
  })
  emit('update:modelValue', updated)
}

function removeLanguage(index: number) {
  const updated = [...props.modelValue]
  updated.splice(index, 1)
  emit('update:modelValue', updated)
}

function updateLanguage(index: number, field: string, value: any) {
  const updated = [...props.modelValue]
  updated[index] = { ...updated[index], [field]: value }
  emit('update:modelValue', updated)
}
</script>

<template>
  <div class="languages-section">
    <div class="section-header">
      <h3>{{ t('profile.editor.languages.title') }}</h3>
      <button class="btn btn-secondary btn-sm" @click="addLanguage">
        <Plus :size="16" />
        {{ t('profile.editor.languages.add') }}
      </button>
    </div>

    <div class="languages-list">
      <div v-for="(lang, idx) in modelValue" :key="idx" class="language-item">
        <div class="form-field">
          <label>{{ t('profile.editor.languages.language') }}</label>
          <input
            :value="lang.language"
            type="text"
            class="input"
            @input="updateLanguage(idx, 'language', ($event.target as HTMLInputElement).value)"
          />
        </div>

        <div class="form-field">
          <label>{{ t('profile.editor.languages.level') }}</label>
          <select
            :value="lang.level"
            class="input"
            @change="updateLanguage(idx, 'level', ($event.target as HTMLSelectElement).value)"
          >
            <option v-for="level in levels" :key="level" :value="level">
              {{ level }}
            </option>
          </select>
        </div>

        <button class="btn-remove" @click="removeLanguage(idx)">
          <Trash2 :size="18" />
        </button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.languages-section {
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
}

.section-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.section-header h3 {
  font-size: 1.125rem;
  font-weight: 600;
  margin: 0;
  color: var(--text-primary);
}

.languages-list {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.language-item {
  display: grid;
  grid-template-columns: 1fr 1fr auto;
  gap: 1rem;
  align-items: end;
}

.form-field {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.form-field label {
  font-size: 0.875rem;
  font-weight: 500;
  color: var(--text-primary);
}

.input {
  padding: 0.5rem 0.75rem;
  border: 1px solid var(--border-color);
  border-radius: var(--radius-sm, 6px);
  font-size: 0.9375rem;
  background: var(--surface-input);
  color: var(--text-primary);
}

.btn {
  padding: 0.5rem 1rem;
  border: none;
  border-radius: var(--radius-sm, 6px);
  font-size: 0.875rem;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;
}

.btn-secondary {
  background: var(--surface-secondary);
  color: var(--text-primary);
}

.btn-secondary:hover {
  background: var(--surface-hover);
}

.btn-sm {
  padding: 0.375rem 0.75rem;
  display: flex;
  align-items: center;
  gap: 0.375rem;
}

.btn-remove {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 40px;
  height: 40px;
  background: none;
  border: 1px solid var(--border-color);
  border-radius: var(--radius-sm, 6px);
  color: var(--text-secondary);
  cursor: pointer;
  transition: all 0.2s;
}

.btn-remove:hover {
  border-color: var(--danger, #dc2626);
  color: var(--danger, #dc2626);
}
</style>
