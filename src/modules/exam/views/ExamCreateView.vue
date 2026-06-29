<!-- ExamCreateView — мінімальний конструктор варіанта (recipe → published Blueprint). -->
<template>
  <div class="exam-create">
    <h1 class="exam-create__title">{{ t('exam.create.title') }}</h1>

    <label class="exam-create__field">
      <span>{{ t('exam.create.name') }}</span>
      <input v-model="title" type="text" :placeholder="t('exam.create.namePlaceholder')" />
    </label>

    <div class="exam-create__field">
      <span>{{ t('exam.create.structure') }}</span>
      <div class="exam-create__preset">
        <label :class="{ 'is-on': nmtPreset }">
          <input v-model="nmtPreset" type="radio" :value="true" />
          {{ t('exam.create.presetNmt') }}
        </label>
        <label :class="{ 'is-on': !nmtPreset }">
          <input v-model="nmtPreset" type="radio" :value="false" />
          {{ t('exam.create.presetCustom') }}
        </label>
      </div>
      <p v-if="nmtPreset" class="exam-create__preset-hint">{{ t('exam.create.presetHint') }}</p>
    </div>

    <div class="exam-create__row">
      <label v-if="!nmtPreset" class="exam-create__field">
        <span>{{ t('exam.create.count') }}</span>
        <input v-model.number="count" type="number" min="1" max="30" />
      </label>
      <label class="exam-create__field">
        <span>{{ t('exam.create.minutes') }}</span>
        <input v-model.number="minutes" type="number" min="1" max="240" />
      </label>
      <label class="exam-create__field">
        <span>{{ t('exam.create.difficulty') }}</span>
        <select v-model="diffProfile">
          <option v-for="d in diffProfiles" :key="d" :value="d">{{ t(`exam.create.diff.${d}`) }}</option>
        </select>
      </label>
    </div>

    <div class="exam-create__topics">
      <div class="exam-create__topics-head">
        <span>{{ t('exam.create.topics') }} ({{ selected.size }})</span>
        <button type="button" class="exam-create__link" @click="toggleAll">
          {{ selected.size === topics.length ? t('exam.create.clearAll') : t('exam.create.selectAll') }}
        </button>
      </div>
      <div class="exam-create__topics-grid">
        <label v-for="tp in topics" :key="tp.slug" class="exam-create__topic" :class="{ 'is-on': selected.has(tp.slug) }">
          <input type="checkbox" :checked="selected.has(tp.slug)" @change="toggle(tp.slug)" />
          <span>{{ tp.label }}</span>
        </label>
      </div>
    </div>

    <div v-if="error" class="exam-create__err">{{ error }}</div>

    <div class="exam-create__actions">
      <button class="exam-create__btn is-ghost" @click="$router.push({ name: 'exam-start' })">
        {{ t('exam.create.cancel') }}
      </button>
      <button class="exam-create__btn" :disabled="!canSubmit || saving" @click="submit">
        {{ saving ? t('exam.create.saving') : t('exam.create.publish') }}
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'

import { examApi } from '../api/examApi'

const { t } = useI18n()
const router = useRouter()

const topics = ref<Array<{ slug: string; label: string }>>([])
const diffProfiles = ref<string[]>(['exam', 'balanced', 'easy', 'hard'])
const selected = reactive(new Set<string>())
const title = ref('')
const nmtPreset = ref(true) // канонічна структура НМТ 15/3/4 (default)
const count = ref(10)
const minutes = ref(170) // НМТ-математика = 170 хв
const diffProfile = ref('exam')
const saving = ref(false)
const error = ref<string | null>(null)

const canSubmit = computed(
  () => title.value.trim() !== '' && selected.size > 0 && (nmtPreset.value || count.value >= 1),
)

function toggle(slug: string) {
  if (selected.has(slug)) selected.delete(slug)
  else selected.add(slug)
}
function toggleAll() {
  if (selected.size === topics.value.length) selected.clear()
  else topics.value.forEach((t2) => selected.add(t2.slug))
}

async function submit() {
  if (!canSubmit.value) return
  saving.value = true
  error.value = null
  try {
    // НМТ-пресет: канонічна структура 15 single_choice → 3 matching → 4 open_answer
    // (звірено з офіційним форматом НМТ; backend RunFactory mode="structured").
    const selection = nmtPreset.value
      ? {
          mode: 'structured',
          topics: Array.from(selected),
          diff_profile: diffProfile.value,
          groups: [
            { problem_type: 'single_choice', count: 15 },
            { problem_type: 'matching', count: 3 },
            { problem_type: 'open_answer', count: 4 },
          ],
        }
      : {
          mode: 'recipe',
          topics: Array.from(selected),
          task_count: count.value,
          diff_profile: diffProfile.value,
        }
    const bp = await examApi.createBlueprint({
      type: 'nmt',
      title: title.value.trim(),
      sections: [
        {
          order: 0,
          name: 'Математика',
          subject: 'math',
          time_limit_sec: minutes.value * 60,
          scoring_policy: 'nmt_math',
          selection,
        },
      ],
    })
    await examApi.publishBlueprint(bp.id)
    router.push({ name: 'exam-start' })
  } catch (e: any) {
    error.value = e?.detail || e?.message || 'create_failed'
  } finally {
    saving.value = false
  }
}

onMounted(async () => {
  try {
    const data = await examApi.getTopics()
    topics.value = data.topics || []
    if (data.diff_profiles?.length) diffProfiles.value = data.diff_profiles
  } catch (e: any) {
    error.value = e?.detail || e?.message || 'load_failed'
  }
})
</script>

<style scoped>
.exam-create { max-width: 720px; margin: 0 auto; padding: 24px 16px; color: var(--text-primary, inherit); }
.exam-create__title { font-size: 22px; font-weight: 700; margin: 0 0 20px; }
.exam-create__field { display: flex; flex-direction: column; gap: 6px; font-size: 14px; margin-bottom: 14px; }
.exam-create__field span { opacity: 0.7; }
.exam-create__field input, .exam-create__field select { padding: 9px 11px; border: 1px solid var(--border-color, rgba(0,0,0,0.15)); border-radius: 8px; background: var(--card-bg, #fff); color: inherit; font-size: 15px; }
.exam-create__preset { display: flex; gap: 8px; flex-wrap: wrap; }
.exam-create__preset label { display: flex; align-items: center; gap: 6px; padding: 8px 12px; border: 1px solid var(--border-color, rgba(0,0,0,0.12)); border-radius: 8px; font-size: 14px; cursor: pointer; }
.exam-create__preset label.is-on { border-color: #3B6D11; background: rgba(59,109,17,0.08); }
.exam-create__preset-hint { font-size: 12px; opacity: 0.6; margin: 6px 0 0; }
.exam-create__row { display: flex; gap: 14px; flex-wrap: wrap; }
.exam-create__row .exam-create__field { flex: 1; min-width: 120px; }
.exam-create__topics { margin: 8px 0 18px; }
.exam-create__topics-head { display: flex; justify-content: space-between; align-items: center; font-size: 14px; opacity: 0.85; margin-bottom: 8px; }
.exam-create__link { background: none; border: none; color: #3B6D11; cursor: pointer; font-size: 13px; }
.exam-create__topics-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(220px, 1fr)); gap: 6px; }
.exam-create__topic { display: flex; align-items: center; gap: 8px; padding: 7px 10px; border: 1px solid var(--border-color, rgba(0,0,0,0.12)); border-radius: 8px; font-size: 13px; cursor: pointer; }
.exam-create__topic.is-on { border-color: #3B6D11; background: rgba(59,109,17,0.08); }
.exam-create__err { color: #dc2626; font-size: 14px; margin-bottom: 12px; }
.exam-create__actions { display: flex; gap: 10px; justify-content: flex-end; }
.exam-create__btn { background: #3B6D11; color: #fff; border: none; border-radius: 8px; padding: 11px 22px; font-size: 15px; font-weight: 500; cursor: pointer; }
.exam-create__btn.is-ghost { background: transparent; color: inherit; border: 1px solid var(--border-color, rgba(0,0,0,0.2)); }
.exam-create__btn:disabled { opacity: 0.5; cursor: default; }
[data-theme="dark"] .exam-create__btn:not(.is-ghost) { background: #6cae3e; }
[data-theme="dark"] .exam-create__link { color: #6cae3e; }
</style>
