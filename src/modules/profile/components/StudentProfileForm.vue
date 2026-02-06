<template>
  <form class="space-y-6" @submit.prevent="handleSubmit">
    <div class="space-y-4">
      <div>
        <label for="learning_goals" class="block text-sm font-medium text-foreground">
          {{ $t('users.profile.learningGoals') }}
        </label>
        <textarea
          id="learning_goals"
          v-model="formData.learning_goals"
          rows="4"
          maxlength="500"
          :disabled="disabled"
          class="input mt-1"
          :placeholder="$t('users.profile.learningGoalsPlaceholder')"
          @input="handleChange"
        />
        <p class="mt-1 text-xs text-muted-foreground">
          {{ formData.learning_goals?.length || 0 }}/500
        </p>
      </div>

      <div>
        <label class="block text-sm font-medium text-foreground">
          {{ $t('users.profile.preferredSubjects') }}
          <span class="text-red-500">*</span>
        </label>
        <div class="mt-2 space-y-2">
          <div class="flex flex-wrap gap-2">
            <span
              v-for="subject in formData.preferred_subjects"
              :key="subject"
              class="inline-flex items-center gap-1 rounded-full bg-primary/10 px-3 py-1 text-sm text-primary"
            >
              {{ subject }}
              <button
                type="button"
                :disabled="disabled"
                class="text-primary hover:text-primary/80"
                @click="removeSubject(subject)"
              >
                ×
              </button>
            </span>
          </div>
          <div class="flex gap-2">
            <input
              v-model="newSubject"
              type="text"
              :disabled="disabled"
              class="input flex-1"
              :placeholder="$t('users.profile.addSubjectPlaceholder')"
              @keydown.enter.prevent="addSubject"
            />
            <Button
              type="button"
              variant="outline"
              size="sm"
              :disabled="disabled || !newSubject.trim()"
              @click="addSubject"
            >
              {{ $t('ui.add') }}
            </Button>
          </div>
        </div>
      </div>

      <div>
        <label class="block text-sm font-medium text-foreground">
          {{ $t('users.profile.budgetRange') }}
        </label>
        <div class="mt-2 space-y-3">
          <div class="grid grid-cols-2 gap-4">
            <div>
              <label for="budget_min" class="text-xs text-muted-foreground">
                {{ $t('users.profile.budgetMin') }}
              </label>
              <input
                id="budget_min"
                v-model.number="formData.budget_min"
                type="number"
                min="0"
                step="10"
                :disabled="disabled"
                class="input mt-1"
                @input="handleChange"
              />
            </div>
            <div>
              <label for="budget_max" class="text-xs text-muted-foreground">
                {{ $t('users.profile.budgetMax') }}
              </label>
              <input
                id="budget_max"
                v-model.number="formData.budget_max"
                type="number"
                min="0"
                step="10"
                :disabled="disabled"
                class="input mt-1"
                @input="handleChange"
              />
            </div>
          </div>
          <p class="text-xs text-muted-foreground">
            {{ $t('users.profile.budgetHint') }}
          </p>
        </div>
      </div>

      <!-- Phase 1: Contact Information -->
      <div class="space-y-4 border-t border-border pt-6">
        <div>
          <h4 class="text-md font-semibold text-foreground">
            {{ $t('users.profile.contactInformation') }}
          </h4>
          <p class="text-sm text-muted-foreground">
            {{ $t('users.profile.contactInformationHint') }}
          </p>
        </div>
        
        <!-- Phone -->
        <div>
          <label for="phone" class="block text-sm font-medium text-foreground">
            {{ $t('users.profile.phone') }}
            <span class="text-red-500">*</span>
          </label>
          <input
            id="phone"
            v-model="formData.phone"
            type="tel"
            :placeholder="$t('users.profile.phonePlaceholder')"
            :disabled="disabled"
            class="input mt-1"
            required
            pattern="^\+[1-9]\d{1,14}$"
            @input="handleChange"
          />
          <p class="mt-1 text-xs text-muted-foreground">
            {{ $t('users.profile.phoneHint') }}
          </p>
          <p v-if="phoneErrorMessage" class="mt-1 text-xs text-red-500">
            {{ phoneErrorMessage }}
          </p>
        </div>
        
        <!-- Telegram (optional) -->
        <div>
          <label for="telegram" class="block text-sm font-medium text-foreground">
            {{ $t('users.profile.telegram') }}
            <span class="text-muted-foreground text-xs">({{ $t('ui.optional') }})</span>
          </label>
          <input
            id="telegram"
            v-model="formData.telegram_username"
            type="text"
            :placeholder="profileTelegramPlaceholder"
            :disabled="disabled"
            class="input mt-1"
            @input="handleChange"
          />
          <p class="mt-1 text-xs text-muted-foreground">
            {{ profileTelegramHint }}
          </p>
        </div>
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
import { useI18n } from 'vue-i18n'
import Button from '@/ui/Button.vue'
import type { StudentFullProfile } from '@/api/students'
import { usePhoneValidation } from '@/composables/usePhoneValidation'

const props = defineProps<{
  modelValue: Partial<StudentFullProfile>
  disabled?: boolean
  saving?: boolean
  errorMessage?: string
}>()

const emit = defineEmits<{
  'update:modelValue': [value: Partial<StudentFullProfile>]
  'submit': []
  'cancel': []
  'change': []
}>()

const { t } = useI18n()

const formData = ref<Partial<StudentFullProfile>>({ 
  preferred_subjects: [],
  phone: '',
  telegram_username: '',
  ...props.modelValue 
})
const newSubject = ref('')

watch(() => props.modelValue, (newValue) => {
  formData.value = { 
    preferred_subjects: [],
    phone: '',
    telegram_username: '',
    ...newValue 
  }
}, { deep: true })

// Phase 1: Phone validation
const { errorMessage: phoneErrorMessage } = usePhoneValidation(
  computed(() => formData.value.phone || '')
)

const isValid = computed(() => {
  return Boolean(
    formData.value.preferred_subjects &&
    formData.value.preferred_subjects.length > 0 &&
    formData.value.phone &&
    formData.value.phone.trim().length > 0
  )
})

const profileTelegramPlaceholder = computed(() => decodeHtmlEntities(t('users.profile.telegramPlaceholder')))
const profileTelegramHint = computed(() => decodeHtmlEntities(t('users.profile.telegramHint')))

function decodeHtmlEntities(value: string): string {
  if (!value) return value
  return value.split('&commat;').join('@')
}

function handleChange() {
  emit('update:modelValue', formData.value)
  emit('change')
}

function addSubject() {
  const subject = newSubject.value.trim()
  if (!subject) return
  
  if (!formData.value.preferred_subjects) {
    formData.value.preferred_subjects = []
  }
  
  if (!formData.value.preferred_subjects.includes(subject)) {
    formData.value.preferred_subjects.push(subject)
    newSubject.value = ''
    handleChange()
  }
}

function removeSubject(subject: string) {
  if (formData.value.preferred_subjects) {
    formData.value.preferred_subjects = formData.value.preferred_subjects.filter(s => s !== subject)
    handleChange()
  }
}

function handleSubmit() {
  if (isValid.value) {
    emit('submit')
  }
}
</script>
