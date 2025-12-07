<template>
  <form class="space-y-6" @submit.prevent="emitSubmit">
    <div class="grid gap-4 sm:grid-cols-2">
      <Input
        v-model="localForm.first_name"
        :label="$t('profile.form.firstName')"
        :error="errors.first_name"
        :required="true"
        :disabled="disabled"
      />
      <Input
        v-model="localForm.last_name"
        :label="$t('profile.form.lastName')"
        :error="errors.last_name"
        :required="true"
        :disabled="disabled"
      />
    </div>

    <div>
      <label class="mb-1 block text-sm font-medium text-primary">
        {{ $t('profile.form.timezone') }}
        <span class="text-red-500">*</span>
      </label>
      <select
        v-model="localForm.timezone"
        class="input w-full appearance-none"
        :class="{ error: !!errors.timezone, disabled }"
        :disabled="disabled"
      >
        <option value="" disabled>
          {{ $t('profile.form.timezonePlaceholder') }}
        </option>
        <option v-for="option in timezoneOptions" :key="option.value" :value="option.value">
          {{ option.label }}
        </option>
      </select>
      <p v-if="errors.timezone" class="mt-1 text-sm text-red-500">
        {{ errors.timezone }}
      </p>
    </div>

    <Input
      v-model="localForm.headline"
      :label="$t('profile.form.headline')"
      :help="$t('profile.form.headlineHint')"
      :disabled="disabled"
    />

    <div>
      <label class="mb-1 block text-sm font-medium text-primary">
        {{ $t('profile.form.bio') }}
      </label>
      <textarea
        v-model="localForm.bio"
        rows="6"
        class="input w-full resize-none"
        :class="{ disabled }"
        :placeholder="$t('profile.form.bioPlaceholder')"
        :disabled="disabled"
      />
    </div>

    <slot />
  </form>
</template>

<script setup>
import { reactive, watch } from 'vue'
import Input from '../../../ui/Input.vue'

const props = defineProps({
  modelValue: {
    type: Object,
    default: () => ({}),
  },
  errors: {
    type: Object,
    default: () => ({}),
  },
  timezoneOptions: {
    type: Array,
    default: () => [],
  },
  disabled: {
    type: Boolean,
    default: false,
  },
})

const emit = defineEmits(['submit', 'update:modelValue'])

const defaultForm = Object.freeze({
  first_name: '',
  last_name: '',
  timezone: '',
  headline: '',
  bio: '',
})

const localForm = reactive({ ...defaultForm })

watch(
  () => props.modelValue,
  (value) => {
    Object.assign(localForm, defaultForm, value || {})
  },
  { immediate: true, deep: true },
)

watch(
  localForm,
  (value) => {
    emit('update:modelValue', { ...value })
  },
  { deep: true },
)

function emitSubmit() {
  emit('submit')
}
</script>
