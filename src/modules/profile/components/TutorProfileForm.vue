<template>
  <form class="space-y-6" @submit.prevent="handleSubmit">
    <div class="space-y-4">
      <div>
        <label for="headline" class="block text-sm font-medium text-foreground">
          {{ $t('users.profile.headline') }}
          <span class="text-red-500">*</span>
        </label>
        <input
          id="headline"
          v-model="formData.headline"
          type="text"
          maxlength="100"
          :disabled="disabled"
          class="input mt-1"
          :placeholder="$t('users.profile.headlinePlaceholder')"
          @input="handleChange"
        />
        <p class="mt-1 text-xs text-muted-foreground">
          {{ formData.headline?.length || 0 }}/100
        </p>
      </div>

      <div>
        <label for="bio" class="block text-sm font-medium text-foreground">
          {{ $t('users.profile.bio') }}
          <span class="text-red-500">*</span>
        </label>
        <textarea
          id="bio"
          v-model="formData.bio"
          rows="6"
          maxlength="1000"
          :disabled="disabled"
          class="input mt-1"
          :placeholder="$t('users.profile.bioPlaceholder')"
          @input="handleChange"
        />
        <p class="mt-1 text-xs text-muted-foreground">
          {{ formData.bio?.length || 0 }}/1000
        </p>
      </div>

      <div class="grid grid-cols-1 gap-4 md:grid-cols-2">
        <div>
          <label for="experience" class="block text-sm font-medium text-foreground">
            {{ $t('users.profile.experience') }}
          </label>
          <input
            id="experience"
            v-model.number="formData.experience"
            type="number"
            min="0"
            max="50"
            :disabled="disabled"
            class="input mt-1"
            :placeholder="$t('users.profile.experiencePlaceholder')"
            @input="handleChange"
          />
        </div>

        <div>
          <label for="hourly_rate" class="block text-sm font-medium text-foreground">
            {{ $t('users.profile.hourlyRate') }}
            <span class="text-red-500">*</span>
          </label>
          <div class="mt-1 flex gap-2">
            <input
              id="hourly_rate"
              v-model.number="formData.hourly_rate"
              type="number"
              min="1"
              step="0.01"
              :disabled="disabled"
              class="input flex-1"
              :placeholder="$t('users.profile.hourlyRatePlaceholder')"
              @input="handleChange"
            />
            <select
              v-model="formData.currency"
              :disabled="disabled"
              class="input w-24"
              @change="handleChange"
            >
              <option value="USD">USD</option>
              <option value="EUR">EUR</option>
              <option value="UAH">UAH</option>
            </select>
          </div>
        </div>
      </div>

      <div v-if="showPublishToggle" class="flex items-center justify-between rounded-lg border border-border p-4">
        <div>
          <p class="font-medium text-foreground">
            {{ $t('users.profile.publishStatus') }}
          </p>
          <p class="text-sm text-muted-foreground">
            {{ formData.is_published ? $t('users.profile.published') : $t('users.profile.draft') }}
          </p>
        </div>
        <button
          type="button"
          :disabled="disabled || !canPublish"
          class="rounded-md px-4 py-2 text-sm font-medium transition"
          :class="formData.is_published 
            ? 'bg-surface-muted text-muted-foreground hover:bg-surface-muted/80' 
            : 'bg-primary text-primary-foreground hover:bg-primary/90'"
          @click="togglePublish"
        >
          {{ formData.is_published ? $t('users.profile.unpublish') : $t('users.profile.publish') }}
        </button>
      </div>
    </div>

    <div v-if="errorMessage" class="rounded-md bg-red-50 p-3 text-sm text-red-700 dark:bg-red-950/40 dark:text-red-200">
      {{ errorMessage }}
    </div>

    <div class="flex justify-end gap-3">
      <Button
        type="button"
        variant="outline"
        :disabled="disabled"
        @click="$emit('cancel')"
      >
        {{ $t('ui.cancel') }}
      </Button>
      <Button
        type="submit"
        variant="primary"
        :disabled="disabled || !isValid"
        :loading="saving"
      >
        {{ saving ? $t('ui.saving') : $t('ui.save') }}
      </Button>
    </div>
  </form>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import Button from '@/ui/Button.vue'
import type { TutorProfile } from '@/api/users'

const props = defineProps<{
  modelValue: Partial<TutorProfile>
  disabled?: boolean
  saving?: boolean
  showPublishToggle?: boolean
  errorMessage?: string
}>()

const emit = defineEmits<{
  'update:modelValue': [value: Partial<TutorProfile>]
  'submit': []
  'cancel': []
  'change': []
  'publish': []
  'unpublish': []
}>()

const formData = ref<Partial<TutorProfile>>({ ...props.modelValue })

watch(() => props.modelValue, (newValue) => {
  formData.value = { ...newValue }
}, { deep: true })

const isValid = computed(() => {
  return Boolean(
    formData.value.headline?.trim() &&
    formData.value.bio?.trim() &&
    formData.value.hourly_rate &&
    formData.value.hourly_rate > 0
  )
})

const canPublish = computed(() => {
  return isValid.value
})

function handleChange() {
  emit('update:modelValue', formData.value)
  emit('change')
}

function handleSubmit() {
  if (isValid.value) {
    emit('submit')
  }
}

function togglePublish() {
  if (formData.value.is_published) {
    emit('unpublish')
  } else {
    emit('publish')
  }
}
</script>
