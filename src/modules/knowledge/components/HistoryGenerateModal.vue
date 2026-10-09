<!-- «Згенерувати урок історії» (2026-10-09): пункт програми МОН → урок-сценарій у «Моїх уроках».
     Генерація йде у воркері 1–3 хв; тут — вибір теми, кроки з поясненням і результат. -->
<template>
  <Teleport to="body">
    <div class="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" @click.self="onClose">
      <div class="w-full max-w-2xl rounded-xl bg-white p-6 shadow-xl" role="dialog" aria-modal="true"
           :aria-label="t('knowledge.historyGen.title')">
        <div class="mb-4 flex items-start justify-between gap-4">
          <div>
            <h2 class="text-lg font-semibold text-gray-900">✨ {{ t('knowledge.historyGen.title') }}</h2>
            <p class="mt-1 text-sm text-gray-500">{{ t('knowledge.historyGen.subtitle') }}</p>
          </div>
          <button type="button" class="text-gray-400 hover:text-gray-600" :aria-label="t('knowledge.historyGen.close')"
                  @click="onClose">✕</button>
        </div>

        <!-- Вибір теми -->
        <form v-if="phase === 'form'" class="space-y-4" @submit.prevent="start">
          <div class="grid grid-cols-1 gap-3 sm:grid-cols-[120px_1fr]">
            <label class="block text-sm">
              <span class="mb-1 block font-medium text-gray-700">{{ t('knowledge.historyGen.grade') }}</span>
              <select v-model.number="grade" class="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm">
                <option v-for="g in program.grades" :key="g.grade" :value="g.grade">{{ g.grade }}</option>
              </select>
            </label>
            <label class="block text-sm">
              <span class="mb-1 block font-medium text-gray-700">{{ t('knowledge.historyGen.section') }}</span>
              <select v-model="sectionId" class="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm">
                <option v-for="s in sections" :key="s.id" :value="s.id">{{ s.title }}</option>
              </select>
            </label>
          </div>
          <label class="block text-sm">
            <span class="mb-1 block font-medium text-gray-700">{{ t('knowledge.historyGen.item') }}</span>
            <select v-model="itemId" class="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm">
              <option v-for="it in items" :key="it.id" :value="it.id">{{ short(it.text) }}</option>
            </select>
          </label>
          <label class="block text-sm">
            <span class="mb-1 block font-medium text-gray-700">{{ t('knowledge.historyGen.topic') }}</span>
            <input v-model="topic" type="text" maxlength="120"
                   class="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                   :placeholder="t('knowledge.historyGen.topicPlaceholder')" />
            <span class="mt-1 block text-xs text-gray-500">{{ t('knowledge.historyGen.topicHint') }}</span>
          </label>
          <p v-if="startError" class="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{{ startError }}</p>
          <div class="flex items-center justify-between gap-3 pt-2">
            <p class="text-xs text-gray-500">{{ t('knowledge.historyGen.howItWorks') }}</p>
            <button type="submit" :disabled="!itemId || starting"
                    class="shrink-0 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50">
              {{ starting ? '…' : t('knowledge.historyGen.generate') }}
            </button>
          </div>
        </form>

        <!-- Кроки генерації -->
        <div v-else-if="phase === 'running'" class="space-y-3">
          <p class="text-sm text-gray-700">
            {{ t('knowledge.historyGen.forItem') }} <b>{{ topic || short(selectedItemText) }}</b>
          </p>
          <ol class="space-y-2">
            <li v-for="s in visibleSteps" :key="s" class="flex items-center gap-2 text-sm"
                :class="stepState(s) === 'todo' ? 'text-gray-400' : 'text-gray-800'">
              <span class="inline-block w-5 text-center" aria-hidden="true">
                {{ stepState(s) === 'done' ? '✓' : stepState(s) === 'now' ? '⏳' : '·' }}
              </span>
              {{ t(`knowledge.historyGen.steps.${s}`) }}
            </li>
          </ol>
          <p class="text-xs text-gray-500">{{ t('knowledge.historyGen.elapsed', { s: elapsed }) }}</p>
        </div>

        <!-- Результат -->
        <div v-else class="space-y-4">
          <template v-if="job?.status === 'ready'">
            <p class="text-sm text-gray-800">✅ {{ t('knowledge.historyGen.ready', { n: job.scenes || 0 }) }}</p>
            <p class="text-base font-semibold text-gray-900">{{ job.title }}</p>
            <p v-if="job.articles?.length" class="text-xs text-gray-500">
              {{ t('knowledge.historyGen.sources') }}: {{ job.articles.join(' · ') }}
            </p>
            <div class="flex justify-end gap-3 pt-2">
              <button type="button" class="rounded-lg border border-gray-300 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
                      @click="onClose">
                {{ t('knowledge.historyGen.toList') }}
              </button>
              <button type="button"
                      class="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
                      @click="emit('conduct', job.lesson_id as string)">
                {{ t('knowledge.historyGen.conduct') }}
              </button>
            </div>
          </template>
          <template v-else>
            <p class="text-sm text-gray-800">
              {{ job?.status === 'refused' ? t('knowledge.historyGen.refused') : t('knowledge.historyGen.failed') }}
            </p>
            <p v-if="job?.reason" class="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800">{{ job.reason }}</p>
            <div class="flex justify-end gap-3 pt-2">
              <button type="button" class="rounded-lg border border-gray-300 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
                      @click="onClose">
                {{ t('knowledge.historyGen.close') }}
              </button>
              <button type="button"
                      class="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
                      @click="phase = 'form'">
                {{ t('knowledge.historyGen.again') }}
              </button>
            </div>
          </template>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import {
  FINAL_STATUSES,
  fetchHistoryJob,
  httpStatusOf,
  startHistoryGeneration,
  type HistoryJob,
  type HistoryJobStatus,
  type HistoryProgram,
} from '../api/historyGeneratorApi'

const props = defineProps<{ program: HistoryProgram }>()
const emit = defineEmits<{
  (e: 'close'): void
  (e: 'created', lessonId: string): void
  (e: 'conduct', lessonId: string): void
}>()
const { t } = useI18n()

const POLL_MS = 2000
const GIVE_UP_MS = 10 * 60 * 1000          // довше за межу задачі воркера (8 хв)
const STEPS: HistoryJobStatus[] = ['sources', 'writing', 'checking', 'rewriting', 'saving']

const grade = ref<number>(props.program.grades[0]?.grade ?? 7)
const sectionId = ref('')
const itemId = ref('')
const topic = ref('')
const phase = ref<'form' | 'running' | 'done'>('form')
const starting = ref(false)
const startError = ref('')
const job = ref<HistoryJob | null>(null)
const seen = ref<HistoryJobStatus[]>([])
const elapsed = ref(0)
let pollTimer: ReturnType<typeof setTimeout> | null = null
let tickTimer: ReturnType<typeof setInterval> | null = null
let startedAt = 0

const sections = computed(() => props.program.grades.find((g) => g.grade === grade.value)?.sections ?? [])
const items = computed(() => sections.value.find((s) => s.id === sectionId.value)?.items ?? [])
const selectedItemText = computed(() => items.value.find((i) => i.id === itemId.value)?.text ?? '')
// «Виправляю» показуємо лише тоді, коли перепитування справді було.
const visibleSteps = computed(() => STEPS.filter((s) => s !== 'rewriting' || seen.value.includes('rewriting')))

watch(grade, () => { sectionId.value = sections.value[0]?.id ?? '' }, { immediate: true })
watch(sectionId, () => { itemId.value = items.value[0]?.id ?? '' }, { immediate: true })

function short(text: string): string {
  return text.length > 110 ? `${text.slice(0, 109).trimEnd()}…` : text
}

function stepState(step: HistoryJobStatus): 'done' | 'now' | 'todo' {
  const current = job.value?.status
  if (current === step) return 'now'
  return seen.value.includes(step) ? 'done' : 'todo'
}

function stopTimers(): void {
  if (pollTimer) clearTimeout(pollTimer)
  if (tickTimer) clearInterval(tickTimer)
  pollTimer = null
  tickTimer = null
}

async function poll(jobId: string): Promise<void> {
  try {
    const next = await fetchHistoryJob(jobId)
    job.value = next
    if (!seen.value.includes(next.status)) seen.value = [...seen.value, next.status]
    if (FINAL_STATUSES.includes(next.status)) {
      stopTimers()
      phase.value = 'done'
      if (next.status === 'ready' && next.lesson_id) emit('created', next.lesson_id)
      return
    }
  } catch (err) {
    // Одиночний збій опитування — не кінець генерації: наступна спроба через POLL_MS.
    console.error('[HistoryGenerateModal] poll failed', err)
  }
  if (Date.now() - startedAt > GIVE_UP_MS) {
    stopTimers()
    job.value = { ...(job.value as HistoryJob), status: 'failed', reason: t('knowledge.historyGen.timeout') }
    phase.value = 'done'
    return
  }
  pollTimer = setTimeout(() => poll(jobId), POLL_MS)
}

async function start(): Promise<void> {
  if (!itemId.value || starting.value) return
  starting.value = true
  startError.value = ''
  try {
    const { job_id: jobId } = await startHistoryGeneration(itemId.value, topic.value.trim())
    job.value = { id: jobId, status: 'queued', content_id: itemId.value, topic: topic.value }
    seen.value = []
    phase.value = 'running'
    startedAt = Date.now()
    elapsed.value = 0
    tickTimer = setInterval(() => { elapsed.value = Math.round((Date.now() - startedAt) / 1000) }, 1000)
    pollTimer = setTimeout(() => poll(jobId), POLL_MS)
  } catch (err) {
    const code = httpStatusOf(err)
    startError.value = code === 409 ? t('knowledge.historyGen.busy')
      : code === 429 ? t('knowledge.historyGen.limit')
        : t('knowledge.historyGen.startError')
  } finally {
    starting.value = false
  }
}

function onClose(): void {
  // Генерація у воркері йде й без вікна: готовий урок з'явиться в «Моїх уроках».
  stopTimers()
  emit('close')
}

onBeforeUnmount(stopTimers)
</script>
