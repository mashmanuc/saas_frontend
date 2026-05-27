<template>
  <div class="max-w-2xl mx-auto px-4 py-6">
    <header class="mb-6">
      <router-link to="/feedback" class="text-sm text-blue-600 hover:underline">
        ← {{ $t('feedback.new.back') }}
      </router-link>
      <h1 class="text-2xl font-bold text-slate-900 mt-2">
        {{ $t('feedback.new.title') }}
      </h1>
      <p class="text-sm text-slate-600 mt-1">{{ $t('feedback.new.subtitle') }}</p>
    </header>

    <form class="space-y-4" @submit.prevent="submit">
      <!-- Type -->
      <div>
        <label class="block text-sm font-medium text-slate-700 mb-1">
          {{ $t('feedback.new.type') }}
        </label>
        <select
          v-model="form.type"
          required
          class="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:border-blue-500"
        >
          <option v-for="t in TYPES" :key="t" :value="t">{{ $t(`feedback.type.${t}`) }}</option>
        </select>
      </div>

      <!-- Category -->
      <div>
        <label class="block text-sm font-medium text-slate-700 mb-1">
          {{ $t('feedback.new.category') }}
        </label>
        <select
          v-model="form.category"
          class="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:border-blue-500"
        >
          <option v-for="c in CATEGORIES" :key="c" :value="c">{{ $t(`feedback.category.${c}`) }}</option>
        </select>
      </div>

      <!-- Title + similar search -->
      <div class="title-field">
        <label class="block text-sm font-medium text-slate-700 mb-1">
          {{ $t('feedback.new.titleLabel') }}
        </label>
        <input
          v-model="form.title"
          type="text"
          required
          minlength="5"
          maxlength="120"
          class="w-full px-3 py-2 border rounded-lg focus:outline-none"
          :class="titleErrorClass"
          :placeholder="$t('feedback.new.titlePlaceholder')"
          @input="onTitleInput"
          @compositionstart="onCompositionStart"
          @compositionend="onCompositionEnd"
        />
        <div class="flex items-center justify-between mt-1">
          <p v-if="titleError" class="text-xs text-rose-600">{{ titleError }}</p>
          <p v-else class="text-xs text-slate-500">{{ $t('feedback.new.titleHint') }}</p>
          <p class="text-xs text-slate-500 tabular-nums">{{ titleTrimmedLen }}/120</p>
        </div>
        <!--
          C1.5: dropdown absolute → НЕ змінює layout сторінки.
          Батьківський div title-field має position: relative.
          Якщо results.length === 0 — компонент НЕ рендериться.
        -->
        <SimilarThreadsPanel
          v-if="showSimilar"
          :results="store.similarResults"
          :loading="store.similarLoading"
          @select="onSelectSimilar"
        />
      </div>

      <!-- Description -->
      <div>
        <label class="block text-sm font-medium text-slate-700 mb-1">
          {{ $t('feedback.new.description') }}
        </label>
        <textarea
          v-model="form.description"
          required
          minlength="20"
          maxlength="5000"
          rows="6"
          class="w-full px-3 py-2 border rounded-lg focus:outline-none"
          :class="descriptionErrorClass"
          :placeholder="$t('feedback.new.descriptionPlaceholder')"
        />
        <div class="flex items-center justify-between mt-1">
          <p v-if="descriptionError" class="text-xs text-rose-600">{{ descriptionError }}</p>
          <p v-else class="text-xs text-slate-500">{{ $t('feedback.new.descriptionHint') }}</p>
          <p class="text-xs text-slate-500 tabular-nums">{{ descriptionTrimmedLen }}/5000</p>
        </div>
      </div>

      <!-- General error (non-field) -->
      <div v-if="generalError" class="text-sm text-rose-700 bg-rose-50 border border-rose-200 rounded p-2">
        {{ generalError }}
      </div>

      <!-- Actions -->
      <div class="flex items-center justify-between pt-2">
        <router-link to="/feedback" class="text-sm text-slate-600 hover:underline">
          {{ $t('feedback.new.cancel') }}
        </router-link>
        <button
          type="submit"
          :disabled="!canSubmit || store.createLoading"
          class="px-6 py-2 bg-blue-600 text-white rounded-lg disabled:opacity-50 hover:bg-blue-700"
        >
          {{ store.createLoading ? $t('feedback.new.publishing') : $t('feedback.new.publish') }}
        </button>
      </div>
    </form>
  </div>
</template>

<script setup>
import { computed, onUnmounted, reactive, ref } from 'vue'
import { useRouter } from 'vue-router'
import { useFeedbackStore } from '../stores/feedbackStore'
import SimilarThreadsPanel from '../components/SimilarThreadsPanel.vue'

const TYPES = ['feature_request', 'bug_report', 'improvement', 'review', 'discussion']
const CATEGORIES = ['ux', 'classroom', 'winterboard', 'performance', 'ai', 'marketplace', 'other']

const store = useFeedbackStore()
const router = useRouter()

const form = reactive({
  type: 'feature_request',
  category: 'other',
  title: '',
  description: '',
})

// H1 (2026-05-27): trim-aware validation — backend serializer бачить trimmed values,
// тому FE counter і canSubmit працюють з trimmed length теж. Інакше "ТІЛО " (4 chars
// + пробіл = 5) валив форму, бо backend trim-ив назад до 4.
const titleTrimmedLen = computed(() => form.title.trim().length)
const descriptionTrimmedLen = computed(() => form.description.trim().length)

const canSubmit = computed(
  () => titleTrimmedLen.value >= 5 && descriptionTrimmedLen.value >= 20,
)

// H1: per-field error messages — приоритет server-side (з store.createFieldErrors),
// fallback на client-side hint.
function firstFieldError(field) {
  const msgs = store.createFieldErrors?.[field]
  if (Array.isArray(msgs) && msgs.length > 0) return msgs[0]
  if (typeof msgs === 'string') return msgs
  return ''
}

const titleError = computed(() => {
  const server = firstFieldError('title')
  if (server) return server
  if (form.title.length > 0 && titleTrimmedLen.value < 5) {
    return 'Мінімум 5 символів (без пробілів по краях).'
  }
  return ''
})

const descriptionError = computed(() => {
  const server = firstFieldError('description')
  if (server) return server
  if (form.description.length > 0 && descriptionTrimmedLen.value < 20) {
    return `Ще ${20 - descriptionTrimmedLen.value} символів до мінімуму.`
  }
  return ''
})

const titleErrorClass = computed(() =>
  titleError.value
    ? 'border-rose-400 focus:border-rose-500'
    : 'border-slate-300 focus:border-blue-500'
)

const descriptionErrorClass = computed(() =>
  descriptionError.value
    ? 'border-rose-400 focus:border-rose-500'
    : 'border-slate-300 focus:border-blue-500'
)

// Загальна (non-field) помилка — показуємо лише якщо немає inline errors.
const generalError = computed(() => {
  if (!store.createError) return ''
  const hasFieldErrors = Object.keys(store.createFieldErrors || {}).length > 0
  // Якщо є inline errors → загальне приховуємо щоб не дублювати.
  if (hasFieldErrors) return ''
  return store.createError
})

/*
 * C1 (audit 2026-05-24): similar-search input jank fix.
 *
 * Симптоми:
 * - кожен keystroke (включаючи trailing пробіли) фірав окремий request
 * - layout shift при показі/приховуванні SimilarThreadsPanel → frame drops
 * - IME (Cyrillic composition) генерує intermediate input events → spam
 *
 * Fix:
 * - normalize(query): trim + collapse multiple spaces → ' ' → стабільний ключ
 * - dedup: пропускати якщо normalized === last fired
 * - debounce 600ms (з 400ms): більше шансів на pause навіть при slow typing
 * - composition guard: ігнорувати input під час IME
 * - reserve panel space через CSS (template) — no layout shift
 */
const DEBOUNCE_MS = 600
// D2: meaningful trigger boundary — НЕ запит на "до", "дод", "д..."
// Тільки коли запит вже "має сенс": ≥2 слова АБО ≥12 символів.
const MIN_CHARS = 12
const MIN_WORDS = 2

let debounceTimer = null
let lastFiredQuery = ''
let composing = false
// C1.5: showSimilar = computed від results — нема рендеру коли empty
const showSimilar = computed(() => store.similarResults.length > 0)

function normalize(q) {
  return (q || '').trim().replace(/\s+/g, ' ').toLowerCase()
}

function isMeaningfulQuery(normalized) {
  if (!normalized) return false
  if (normalized.length >= MIN_CHARS) return true
  const words = normalized.split(' ').filter(Boolean)
  return words.length >= MIN_WORDS
}

function onCompositionStart() {
  composing = true
}

function onCompositionEnd() {
  composing = false
  scheduleSearch()
}

function onTitleInput() {
  if (composing) return  // IME mid-composition — wait для compositionend
  scheduleSearch()
}

function scheduleSearch() {
  clearTimeout(debounceTimer)
  const q = normalize(form.title)
  // D2: meaningful boundary — пропускаємо "до", "дод", "test", тощо.
  if (!isMeaningfulQuery(q)) {
    store.clearSimilar()
    lastFiredQuery = ''
    return
  }
  if (q === lastFiredQuery) {
    // Те ж саме нормалізоване — нічого не робимо
    return
  }
  debounceTimer = setTimeout(() => {
    lastFiredQuery = q
    store.searchSimilar(q, { type: form.type }).catch(() => {})
  }, DEBOUNCE_MS)
}

function onSelectSimilar(item) {
  router.push({ name: 'FeedbackThread', params: { id: item.id } })
}

async function submit() {
  if (!canSubmit.value) return
  try {
    const t = await store.createThread({
      type: form.type,
      category: form.category,
      title: form.title.trim(),
      description: form.description.trim(),
    })
    router.push({ name: 'FeedbackThread', params: { id: t.id } })
  } catch (err) {
    // error already у store.createError
  }
}

onUnmounted(() => {
  clearTimeout(debounceTimer)
  store.clearSimilar()
})
</script>

<style scoped>
/* C1.5: title-field — relative anchor для absolute-positioned SimilarThreadsPanel. */
.title-field {
  position: relative;
}
</style>
