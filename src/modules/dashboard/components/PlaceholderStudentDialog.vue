<template>
  <Modal
    :open="open"
    :title="isEdit ? $t('dashboard.tutor.placeholder.editTitle') : $t('dashboard.tutor.placeholder.addTitle')"
    size="sm"
    @close="$emit('close')"
  >
    <form class="space-y-4" data-testid="placeholder-student-form" @submit.prevent="save">
      <p v-if="!isEdit" class="text-sm text-muted">{{ $t('dashboard.tutor.placeholder.hint') }}</p>

      <Input
        v-if="nameEditable"
        id="placeholder-student-name"
        v-model="name"
        :label="$t('dashboard.tutor.placeholder.name')"
        :placeholder="$t('dashboard.tutor.placeholder.namePlaceholder')"
        required
        maxlength="120"
        data-testid="placeholder-student-name"
      />
      <p v-else class="text-sm">
        <span class="text-muted">{{ $t('dashboard.tutor.placeholder.name') }}:</span>
        <span class="font-semibold text-body">{{ fixedName }}</span>
      </p>

      <fieldset class="space-y-2">
        <legend class="form-field__label">{{ $t('dashboard.tutor.placeholder.source') }}</legend>
        <label class="flex items-center gap-2 text-sm">
          <input v-model="source" type="radio" value="own" data-testid="placeholder-source-own" />
          {{ $t('dashboard.tutor.placeholder.sourceOwn') }}
        </label>
        <label class="flex items-center gap-2 text-sm">
          <input v-model="source" type="radio" value="platform" data-testid="placeholder-source-platform" />
          {{ $t('dashboard.tutor.placeholder.sourcePlatform') }}
        </label>
        <Input
          v-if="source === 'platform'"
          id="placeholder-student-platform"
          v-model="platform"
          :placeholder="$t('dashboard.tutor.placeholder.platformPlaceholder')"
          :help="$t('dashboard.tutor.placeholder.platformHelp')"
          maxlength="64"
          data-testid="placeholder-student-platform"
        />
      </fieldset>

      <Textarea
        v-model="notes"
        :label="$t('dashboard.tutor.placeholder.notes')"
        :placeholder="$t('dashboard.tutor.placeholder.notesPlaceholder')"
        :rows="2"
        :maxlength="2000"
        data-testid="placeholder-student-notes"
      />

      <p v-if="error" class="text-sm text-danger" role="alert" data-testid="placeholder-student-error">{{ error }}</p>
    </form>

    <template #footer>
      <Button variant="outline" size="sm" type="button" @click="$emit('close')">
        {{ $t('dashboard.tutor.placeholder.cancel') }}
      </Button>
      <Button
        variant="primary"
        size="sm"
        type="button"
        :disabled="!canSave"
        data-testid="placeholder-student-save"
        @click="save"
      >
        {{ saving ? $t('dashboard.tutor.placeholder.saving') : $t('dashboard.tutor.placeholder.save') }}
      </Button>
    </template>
  </Modal>
</template>

<script setup>
// Учень без акаунта і «звідки учень» (власник 2026-10-14): «треба і своїх учнів, і учнів з платформи
// Буки, де я працюю, записувати, щоб в мене графік був». Додати — імʼя + звідки; змінити — звідки й
// нотатку будь-якого учня, імʼя — лише учня без акаунта (у справжнього акаунта імʼя його власника).
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import Modal from '../../../ui/Modal.vue'
import Button from '../../../ui/Button.vue'
import Input from '../../../ui/Input.vue'
import Textarea from '../../../ui/Textarea.vue'
import relationsApi from '../../../api/relations'

const props = defineProps({
  open: { type: Boolean, default: false },
  /** null — додати нового учня без акаунта; звʼязок — змінити його */
  relation: { type: Object, default: null },
})
const emit = defineEmits(['close', 'saved'])
const { t } = useI18n()

const name = ref('')
const source = ref('own')
const platform = ref('')
const notes = ref('')
const error = ref('')
const saving = ref(false)

const isEdit = computed(() => Boolean(props.relation))
const nameEditable = computed(() => !isEdit.value || Boolean(props.relation?.student?.is_placeholder))
const fixedName = computed(() => {
  const s = props.relation?.student
  return s?.display_name || s?.full_name || [s?.first_name, s?.last_name].filter(Boolean).join(' ')
})
const platformValue = computed(() => (source.value === 'platform' ? platform.value.trim() : ''))
const canSave = computed(() => {
  if (saving.value) return false
  if (nameEditable.value && !name.value.trim()) return false
  if (source.value === 'platform' && !platformValue.value) return false
  return true
})

watch(
  () => [props.open, props.relation],
  ([open]) => {
    if (!open) return
    const r = props.relation
    name.value = r?.student?.is_placeholder ? fixedName.value : ''
    platform.value = r?.external_platform || ''
    source.value = platform.value ? 'platform' : 'own'
    notes.value = r?.notes || ''
    error.value = ''
    saving.value = false
  },
  { immediate: true },
)

function errorText(err) {
  const code = err?.response?.data?.error
  const key = `dashboard.tutor.placeholder.errors.${code}`
  return code && t(key) !== key ? t(key) : t('dashboard.tutor.placeholder.errors.failed')
}

async function save() {
  if (!canSave.value) return
  saving.value = true
  error.value = ''
  const body = { external_platform: platformValue.value, notes: notes.value.trim() }
  if (nameEditable.value) body.name = name.value.trim()
  try {
    const relation = isEdit.value
      ? await relationsApi.updateRelationDetails(props.relation.id, body)
      : await relationsApi.createPlaceholderStudent(body)
    emit('saved', relation)
  } catch (err) {
    // Видимо у вікні; нічого не створено й не змінено, учитель може виправити й зберегти ще раз
    error.value = errorText(err)
  } finally {
    saving.value = false
  }
}
</script>
