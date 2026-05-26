<template>
  <div class="fixed inset-0 z-50 flex items-center justify-center bg-black/40" @click.self="$emit('close')">
    <div class="bg-white rounded-lg shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
      <header class="px-4 py-3 border-b border-slate-200 flex items-center justify-between">
        <h2 class="font-semibold text-slate-900">
          {{ $t('feedback.staff.status.title') }}
        </h2>
        <button class="text-slate-500 hover:text-slate-900" @click="$emit('close')">✕</button>
      </header>

      <div class="p-4 space-y-3">
        <div class="text-sm text-slate-600">
          <div class="truncate"><b>{{ thread.title }}</b></div>
          <div class="text-xs">{{ $t('feedback.staff.status.current') }}: <code>{{ thread.status }}</code></div>
        </div>

        <label class="block">
          <span class="text-sm font-medium text-slate-700">{{ $t('feedback.staff.status.newStatus') }}</span>
          <select v-model="form.status" class="mt-1 w-full px-2 py-1.5 border border-slate-300 rounded">
            <option v-for="s in STATUSES" :key="s" :value="s">
              {{ $t(`feedback.status.${s}`, s) }}
            </option>
          </select>
        </label>

        <label v-if="form.status === 'duplicate'" class="block">
          <span class="text-sm font-medium text-slate-700">
            {{ $t('feedback.staff.status.duplicateOf') }}
          </span>
          <input
            v-model.number="form.duplicate_of_id"
            type="number"
            min="1"
            placeholder="thread id канонічного thread"
            class="mt-1 w-full px-2 py-1.5 border border-slate-300 rounded"
          />
          <p class="text-xs text-slate-500 mt-0.5">
            {{ $t('feedback.staff.status.duplicateHint') }}
          </p>
        </label>

        <label class="block">
          <span class="text-sm font-medium text-slate-700">{{ $t('feedback.staff.status.response') }}</span>
          <textarea
            v-model="form.staff_response"
            rows="4"
            maxlength="5000"
            :placeholder="$t('feedback.staff.status.responsePlaceholder')"
            class="mt-1 w-full px-2 py-1.5 border border-slate-300 rounded text-sm"
          />
        </label>

        <p v-if="error" class="text-sm text-rose-600">{{ error }}</p>
      </div>

      <footer class="px-4 py-3 border-t border-slate-200 flex justify-end gap-2">
        <button class="px-3 py-1.5 text-sm border border-slate-300 rounded hover:bg-slate-100" @click="$emit('close')">
          {{ $t('feedback.staff.cancel') }}
        </button>
        <button
          :disabled="saving || !canSave"
          class="px-3 py-1.5 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
          @click="save"
        >
          {{ saving ? '...' : $t('feedback.staff.save') }}
        </button>
      </footer>
    </div>
  </div>
</template>

<script setup>
import { computed, reactive, ref } from 'vue'
import api from '../../api/feedbackApi'

const props = defineProps({
  thread: { type: Object, required: true },
})
const emit = defineEmits(['close', 'saved'])

const STATUSES = ['open', 'under_review', 'planned', 'in_progress', 'released', 'done', 'rejected', 'duplicate', 'archived', 'needs_info']

const form = reactive({
  status: props.thread.status,
  staff_response: props.thread.staff_response || '',
  duplicate_of_id: null,
})

const saving = ref(false)
const error = ref(null)

const canSave = computed(() => {
  if (form.status === 'duplicate' && !form.duplicate_of_id) return false
  if (form.status === 'duplicate' && form.duplicate_of_id === props.thread.id) return false
  return form.status !== props.thread.status || form.staff_response !== (props.thread.staff_response || '')
})

async function save() {
  saving.value = true
  error.value = null
  try {
    const payload = {
      status: form.status,
      staff_response: form.staff_response,
    }
    if (form.status === 'duplicate') payload.duplicate_of_id = form.duplicate_of_id
    const updated = await api.changeStatus(props.thread.id, payload)
    emit('saved', updated)
  } catch (e) {
    error.value = e?.response?.data?.detail || e?.response?.data?.error || 'Не вдалося зберегти'
  } finally {
    saving.value = false
  }
}
</script>
