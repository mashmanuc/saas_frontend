<script setup lang="ts">
import { ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { Plus, Trash2 } from 'lucide-vue-next'
import Button from '@/ui/Button.vue'

const props = defineProps<{
  modelValue: Array<{
    institution: string
    degree: string
    field: string
    start_year: number
    end_year?: number
  }>
}>()

const emit = defineEmits(['update:modelValue'])

const { t } = useI18n()

function addEducation() {
  const updated = [...props.modelValue]
  updated.push({
    institution: '',
    degree: '',
    field: '',
    start_year: new Date().getFullYear(),
    end_year: undefined
  })
  emit('update:modelValue', updated)
}

function removeEducation(index: number) {
  const updated = [...props.modelValue]
  updated.splice(index, 1)
  emit('update:modelValue', updated)
}

function updateEducation(index: number, field: string, value: any) {
  const updated = [...props.modelValue]
  updated[index] = { ...updated[index], [field]: value }
  emit('update:modelValue', updated)
}
</script>

<template>
  <div class="education-section">
    <div class="section-header">
      <h3>{{ t('profile.editor.education.title') }}</h3>
      <Button variant="secondary" size="sm" @click="addEducation">
        <Plus :size="16" />
        {{ t('profile.editor.education.add') }}
      </Button>
    </div>

    <div class="education-list">
      <div v-for="(edu, idx) in modelValue" :key="idx" class="education-item">
        <div class="form-row">
          <div class="form-field">
            <label>{{ t('profile.editor.education.institution') }}</label>
            <input
              :value="edu.institution"
              type="text"
              class="input"
              @input="updateEducation(idx, 'institution', ($event.target as HTMLInputElement).value)"
            />
          </div>
          <div class="form-field">
            <label>{{ t('profile.editor.education.degree') }}</label>
            <input
              :value="edu.degree"
              type="text"
              class="input"
              @input="updateEducation(idx, 'degree', ($event.target as HTMLInputElement).value)"
            />
          </div>
        </div>

        <div class="form-row">
          <div class="form-field">
            <label>{{ t('profile.editor.education.field') }}</label>
            <input
              :value="edu.field"
              type="text"
              class="input"
              @input="updateEducation(idx, 'field', ($event.target as HTMLInputElement).value)"
            />
          </div>
          <div class="form-field">
            <label>{{ t('profile.editor.education.startYear') }}</label>
            <input
              :value="edu.start_year"
              type="number"
              class="input"
              @input="updateEducation(idx, 'start_year', parseInt(($event.target as HTMLInputElement).value))"
            />
          </div>
          <div class="form-field">
            <label>{{ t('profile.editor.education.endYear') }}</label>
            <input
              :value="edu.end_year"
              type="number"
              class="input"
              @input="updateEducation(idx, 'end_year', ($event.target as HTMLInputElement).value ? parseInt(($event.target as HTMLInputElement).value) : undefined)"
            />
          </div>
        </div>

        <button class="btn-remove" @click="removeEducation(idx)">
          <Trash2 :size="18" />
          {{ t('common.remove') }}
        </button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.education-section {
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

.education-list {
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
}

.education-item {
  padding: 1.5rem;
  background: var(--surface-card);
  border: 1px solid var(--border-color);
  border-radius: var(--radius-md, 8px);
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.form-row {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 1rem;
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

.btn-remove {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.5rem 1rem;
  background: none;
  border: 1px solid var(--border-color);
  border-radius: var(--radius-sm, 6px);
  color: var(--text-secondary);
  cursor: pointer;
  transition: all 0.2s;
  align-self: flex-start;
}

.btn-remove:hover {
  border-color: var(--danger, #dc2626);
  color: var(--danger, #dc2626);
}
</style>
