<script setup lang="ts">
import { ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { Plus, Trash2 } from 'lucide-vue-next'

const props = defineProps<{
  modelValue: Array<{
    name: string
    issuer: string
    year: number
  }>
}>()

const emit = defineEmits(['update:modelValue'])

const { t } = useI18n()

function addCertification() {
  const updated = [...props.modelValue]
  updated.push({
    name: '',
    issuer: '',
    year: new Date().getFullYear()
  })
  emit('update:modelValue', updated)
}

function removeCertification(index: number) {
  const updated = [...props.modelValue]
  updated.splice(index, 1)
  emit('update:modelValue', updated)
}

function updateCertification(index: number, field: string, value: any) {
  const updated = [...props.modelValue]
  updated[index] = { ...updated[index], [field]: value }
  emit('update:modelValue', updated)
}
</script>

<template>
  <div class="certifications-section">
    <div class="section-header">
      <h3>{{ t('profile.editor.certifications.title') }}</h3>
      <button class="btn btn-secondary btn-sm" @click="addCertification">
        <Plus :size="16" />
        {{ t('profile.editor.certifications.add') }}
      </button>
    </div>

    <div class="certifications-list">
      <div v-for="(cert, idx) in modelValue" :key="idx" class="certification-item">
        <div class="form-field">
          <label>{{ t('profile.editor.certifications.name') }}</label>
          <input
            :value="cert.name"
            type="text"
            class="input"
            @input="updateCertification(idx, 'name', ($event.target as HTMLInputElement).value)"
          />
        </div>

        <div class="form-field">
          <label>{{ t('profile.editor.certifications.issuer') }}</label>
          <input
            :value="cert.issuer"
            type="text"
            class="input"
            @input="updateCertification(idx, 'issuer', ($event.target as HTMLInputElement).value)"
          />
        </div>

        <div class="form-field">
          <label>{{ t('profile.editor.certifications.year') }}</label>
          <input
            :value="cert.year"
            type="number"
            class="input"
            @input="updateCertification(idx, 'year', parseInt(($event.target as HTMLInputElement).value))"
          />
        </div>

        <button class="btn-remove" @click="removeCertification(idx)">
          <Trash2 :size="18" />
        </button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.certifications-section {
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

.certifications-list {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.certification-item {
  display: grid;
  grid-template-columns: 2fr 2fr 1fr auto;
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
