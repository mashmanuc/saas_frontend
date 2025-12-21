<script setup lang="ts">
import { ref } from 'vue'
import { useI18n } from 'vue-i18n'

const props = defineProps<{
  modelValue: {
    hourly_rate?: number
    trial_rate?: number
    package_rates?: Array<{
      lessons: number
      price: number
      discount_percent?: number
    }>
  }
}>()

const emit = defineEmits(['update:modelValue'])

const { t } = useI18n()

function updateField(field: string, value: any) {
  emit('update:modelValue', { ...props.modelValue, [field]: value })
}

function updatePackage(index: number, field: string, value: any) {
  const packages = [...(props.modelValue.package_rates || [])]
  packages[index] = { ...packages[index], [field]: value }
  emit('update:modelValue', { ...props.modelValue, package_rates: packages })
}
</script>

<template>
  <div class="pricing-section">
    <h3>{{ t('profile.editor.pricing.title') }}</h3>

    <div class="form-row">
      <div class="form-field">
        <label>{{ t('profile.editor.pricing.hourlyRate') }}</label>
        <input
          :value="modelValue.hourly_rate"
          type="number"
          class="input"
          step="0.01"
          @input="updateField('hourly_rate', parseFloat(($event.target as HTMLInputElement).value))"
        />
      </div>

      <div class="form-field">
        <label>{{ t('profile.editor.pricing.trialRate') }}</label>
        <input
          :value="modelValue.trial_rate"
          type="number"
          class="input"
          step="0.01"
          @input="updateField('trial_rate', parseFloat(($event.target as HTMLInputElement).value))"
        />
      </div>
    </div>

    <div v-if="modelValue.package_rates?.length" class="packages">
      <h4>{{ t('profile.editor.pricing.packages') }}</h4>
      <div
        v-for="(pkg, idx) in modelValue.package_rates"
        :key="idx"
        class="package-item"
      >
        <div class="form-field">
          <label>{{ t('profile.editor.pricing.lessons') }}</label>
          <input
            :value="pkg.lessons"
            type="number"
            class="input"
            @input="updatePackage(idx, 'lessons', parseInt(($event.target as HTMLInputElement).value))"
          />
        </div>
        <div class="form-field">
          <label>{{ t('profile.editor.pricing.price') }}</label>
          <input
            :value="pkg.price"
            type="number"
            class="input"
            step="0.01"
            @input="updatePackage(idx, 'price', parseFloat(($event.target as HTMLInputElement).value))"
          />
        </div>
        <div class="form-field">
          <label>{{ t('profile.editor.pricing.discount') }}</label>
          <input
            :value="pkg.discount_percent"
            type="number"
            class="input"
            @input="updatePackage(idx, 'discount_percent', parseInt(($event.target as HTMLInputElement).value))"
          />
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.pricing-section {
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
}

.pricing-section h3 {
  font-size: 1.125rem;
  font-weight: 600;
  margin: 0;
  color: var(--text-primary);
}

.pricing-section h4 {
  font-size: 1rem;
  font-weight: 600;
  margin: 0;
  color: var(--text-primary);
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

.packages {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.package-item {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 1rem;
  padding: 1rem;
  background: var(--surface-card);
  border: 1px solid var(--border-color);
  border-radius: var(--radius-md, 8px);
}
</style>
