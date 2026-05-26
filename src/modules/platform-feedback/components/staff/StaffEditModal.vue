<template>
  <div class="fixed inset-0 z-50 flex items-center justify-center bg-black/40" @click.self="$emit('close')">
    <div class="bg-white rounded-lg shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
      <header class="px-4 py-3 border-b border-slate-200 flex items-center justify-between">
        <h2 class="font-semibold text-slate-900">✏️ {{ $t('feedback.staff.edit.title') }}</h2>
        <button class="text-slate-500 hover:text-slate-900" @click="$emit('close')">✕</button>
      </header>

      <div class="p-4 space-y-3">
        <p class="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded p-2">
          ⚠️ {{ $t('feedback.staff.edit.warning') }}
        </p>

        <label class="block">
          <span class="text-sm font-medium text-slate-700">{{ $t('feedback.new.titleLabel') }}</span>
          <input
            v-model="form.title"
            type="text"
            minlength="5"
            maxlength="120"
            class="mt-1 w-full px-2 py-1.5 border border-slate-300 rounded"
          />
          <p class="text-xs text-slate-500 mt-0.5">{{ form.title.length }}/120</p>
        </label>

        <label class="block">
          <span class="text-sm font-medium text-slate-700">{{ $t('feedback.new.category') }}</span>
          <select v-model="form.category" class="mt-1 w-full px-2 py-1.5 border border-slate-300 rounded">
            <option v-for="c in CATEGORIES" :key="c" :value="c">{{ $t(`feedback.category.${c}`, c) }}</option>
          </select>
        </label>

        <label class="block">
          <span class="text-sm font-medium text-slate-700">{{ $t('feedback.new.description') }}</span>
          <textarea
            v-model="form.description"
            rows="6"
            minlength="20"
            maxlength="5000"
            class="mt-1 w-full px-2 py-1.5 border border-slate-300 rounded text-sm"
          />
          <p class="text-xs text-slate-500 mt-0.5">{{ form.description.length }}/5000</p>
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

const CATEGORIES = ['ux', 'classroom', 'winterboard', 'performance', 'ai', 'marketplace', 'other']

const form = reactive({
  title: props.thread.title || '',
  description: props.thread.description || '',
  category: props.thread.category || 'other',
})

const saving = ref(false)
const error = ref(null)

const canSave = computed(() => {
  if (form.title.length < 5 || form.title.length > 120) return false
  if (form.description.length < 20 || form.description.length > 5000) return false
  return (
    form.title !== props.thread.title
    || form.description !== props.thread.description
    || form.category !== props.thread.category
  )
})

async function save() {
  saving.value = true
  error.value = null
  try {
    const payload = {}
    if (form.title !== props.thread.title) payload.title = form.title
    if (form.description !== props.thread.description) payload.description = form.description
    if (form.category !== props.thread.category) payload.category = form.category
    const updated = await api.staffEditThread(props.thread.id, payload)
    emit('saved', updated)
  } catch (e) {
    error.value = e?.response?.data?.detail || e?.response?.data?.error || 'Не вдалося зберегти'
  } finally {
    saving.value = false
  }
}
</script>
