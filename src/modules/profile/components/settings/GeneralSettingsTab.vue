<template>
  <form class="space-y-6" @submit.prevent="handleSubmit">
    <div>
      <h3 class="text-lg font-semibold text-foreground">
        {{ $t('users.settings.general.title') }}
      </h3>
      <p class="text-sm text-muted-foreground">
        {{ $t('users.settings.general.description') }}
      </p>
    </div>

    <div class="space-y-4">
      <div>
        <label for="language" class="block text-sm font-medium text-foreground">
          {{ $t('users.settings.general.language') }}
        </label>
        <select
          id="language"
          v-model="formData.ui_language"
          :disabled="saving"
          class="input mt-1"
          @change="handleChange"
        >
          <option value="uk">Українська</option>
          <option value="en">English</option>
          <option value="ru">Русский</option>
        </select>
      </div>

      <div>
        <label for="timezone" class="block text-sm font-medium text-foreground">
          {{ $t('users.settings.general.timezone') }}
        </label>
        <select
          id="timezone"
          v-model="formData.timezone"
          :disabled="saving"
          class="input mt-1"
          @change="handleChange"
        >
          <!-- ⚠️ `Europe/Kyiv`, не `Kiev`. Бекенд зберігає саме так
               (`UserSettings.DEFAULT_TIMEZONE`), а тут стояло старе
               написання — значення не збігалося з жодною опцією, і селект
               показувався ПОРОЖНІМ. Дані при цьому були цілі: браузер
               просто не мав що підсвітити. -->
          <option value="UTC">UTC</option>
          <option value="Europe/Kyiv">Europe/Kyiv</option>
          <option value="Europe/London">Europe/London</option>
          <option value="America/New_York">America/New_York</option>
          <option value="America/Los_Angeles">America/Los_Angeles</option>
        </select>
      </div>

      <!-- Помічник Інтегралик — увімк/вимк (per-акаунт, синхронно) -->
      <div class="flex items-start gap-3 pt-2">
        <input
          id="integralyk"
          v-model="formData.integralyk_enabled"
          type="checkbox"
          :disabled="saving"
          class="mt-1 h-4 w-4 rounded border-gray-300 text-emerald-600 focus:ring-emerald-500"
          @change="handleChange"
        />
        <label for="integralyk" class="text-sm">
          <span class="block font-medium text-foreground">
            {{ $t('users.settings.general.integralyk') }}
          </span>
          <span class="block text-muted-foreground">
            {{ $t('users.settings.general.integralykHint') }}
          </span>
        </label>
      </div>

      <!-- Мої предмети — ВИДИМІСТЬ і дефолт Інтегралика, не дозвіл (рішення
           власника 2026-09-21). `[]` = «Усі предмети». Секція лише там, де
           коридори Інтегралика відкриті: інакше налаштування ні на що не діє. -->
      <fieldset v-if="subjectChoices.length" class="pt-2" data-testid="teaching-subjects">
        <legend class="text-sm font-medium text-foreground">
          {{ $t('users.settings.general.subjects') }}
        </legend>
        <p class="text-sm text-muted-foreground">
          {{ $t('users.settings.general.subjectsHint') }}
        </p>
        <label class="mt-2 flex items-center gap-3 text-sm">
          <input
            type="checkbox"
            data-testid="teaching-subjects-all"
            :checked="allSubjects"
            :disabled="saving"
            class="h-4 w-4 rounded border-gray-300 text-emerald-600 focus:ring-emerald-500"
            @change="toggleAllSubjects"
          />
          {{ $t('users.settings.general.subjectsAll') }}
        </label>
        <label
          v-for="s in subjectChoices"
          :key="s.id"
          class="mt-1 flex items-center gap-3 pl-7 text-sm"
          :class="{ 'opacity-60': allSubjects }"
        >
          <input
            type="checkbox"
            :data-testid="`teaching-subject-${s.id}`"
            :checked="allSubjects || formData.teaching_subjects.includes(s.id)"
            :disabled="saving || allSubjects"
            class="h-4 w-4 rounded border-gray-300 text-emerald-600 focus:ring-emerald-500"
            @change="toggleSubject(s.id)"
          />
          {{ subjectName(s) }}
        </label>
      </fieldset>
    </div>

    <div v-if="errorMessage" class="rounded-md bg-red-50 p-3 text-sm text-red-700 dark:bg-red-950/40 dark:text-red-200">
      {{ errorMessage }}
    </div>

    <div class="flex justify-end gap-3">
      <Button
        type="button"
        variant="outline"
        :disabled="saving || !hasChanges"
        @click="handleReset"
      >
        {{ $t('ui.reset') }}
      </Button>
      <Button
        type="submit"
        variant="primary"
        :disabled="saving || !hasChanges"
        :loading="saving"
      >
        {{ saving ? $t('ui.saving') : $t('ui.save') }}
      </Button>
    </div>
  </form>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import Button from '@/ui/Button.vue'
import { useProfileStore } from '../../store/profileStore'
import { getUserSettings, updateUserSettings } from '@/api/users'
import { notifySuccess, notifyError } from '@/utils/notify'
// `setLocale` — саме той шлях, що пише localStorage['lang'] (i18n/index.js),
// тобто ключ, який читає getInitialLocale() при старті застосунку. Пряме
// присвоєння в locale.value міняло б мову лише до перезавантаження.
//
// 📌 Тут стояв абзац про два різні входи в i18n (`.js` і `.ts` з різними
// ключами сховища). Дубль `index.ts` видалено 2026-08-28 — він був мертвий:
// `main.js` бере з нього `getInitialLocale`, якого в `.ts` не існувало
// взагалі, тож застосунок ніколи його й не вантажив.
import { i18n, setLocale } from '@/i18n'
import { fetchCorridorRegistry } from '@/modules/intent/corridors/corridorApi'

const profileStore = useProfileStore()

/**
 * Старе написання київського поясу → нове.
 *
 * `Europe/Kiev` — історична назва зони IANA; бекенд зберігає `Europe/Kyiv`.
 * На акаунтах, де встигло записатись старе, без цієї нормалізації селект
 * знову був би порожнім — тобто той самий баг, тільки з іншого боку.
 */
function normalizeTz(tz: string | null | undefined): string {
  return tz === 'Europe/Kiev' ? 'Europe/Kyiv' : (tz || '')
}

const formData = ref({
  ui_language: 'uk',
  timezone: 'UTC',
  integralyk_enabled: true,
  // [] = «Усі предмети» — так само, як на сервері.
  teaching_subjects: [] as string[]
})

const initialData = ref({ ...formData.value })
const saving = ref(false)
const loading = ref(false)
const errorMessage = ref('')

const hasChanges = computed(() => {
  return JSON.stringify(formData.value) !== JSON.stringify(initialData.value)
})

// ── Мої предмети ───────────────────────────────────────────────────────────
// Список — із реєстру сервера: `available_subjects` = усі АКТИВНІ предмети
// (заплановані сервер не віддає). `general` — це стан «Авто», не предмет.
// 404 = коридори для акаунта закриті → секції немає.
type SubjectEntry = { id: string; label?: string; labels?: Record<string, string> }
const subjectChoices = ref<SubjectEntry[]>([])
const allSubjects = computed(() => formData.value.teaching_subjects.length === 0)

function subjectName(s: SubjectEntry): string {
  const lang = i18n.global.locale.value === 'en' ? 'en' : 'uk'
  return s.labels?.[lang] || s.label || s.id
}

function toggleAllSubjects(event: Event) {
  errorMessage.value = ''
  // Зняли «Усі» → стартуємо з повного списку, щоб прибирати зайве, а не
  // збирати з нуля. Порожній набір означав би знову «Усі».
  formData.value.teaching_subjects = (event.target as HTMLInputElement).checked
    ? []
    : subjectChoices.value.map(s => s.id)
}

function toggleSubject(id: string) {
  errorMessage.value = ''
  const current = formData.value.teaching_subjects
  // Порядок — як у реєстрі, щоб «змін» не виникало від порядку кліків.
  const next = current.includes(id) ? current.filter(x => x !== id) : [...current, id]
  formData.value.teaching_subjects = subjectChoices.value.map(s => s.id).filter(x => next.includes(x))
}

async function loadSubjectChoices() {
  try {
    const reg = await fetchCorridorRegistry(i18n.global.locale.value === 'en' ? 'en' : 'uk')
    subjectChoices.value = (reg?.available_subjects || []).filter((s: SubjectEntry) => s.id !== 'general')
  } catch {
    // 404 — коридори для акаунта закриті; секцію просто не показуємо.
    subjectChoices.value = []
  }
}

onMounted(async () => {
  await loadSubjectChoices()
  // Try cached settings first, then fetch from API
  let settings = profileStore.settings
  // Кеш профілю міг прийти з іншого ендпойнта й не мати `teaching_subjects`;
  // тоді форма стартувала б з «Усі» і збереження стерло б вибір вчителя.
  if (settings && subjectChoices.value.length && !('teaching_subjects' in settings)) {
    settings = null
  }
  if (!settings) {
    loading.value = true
    try {
      settings = await getUserSettings()
      profileStore.settings = settings
    } catch { /* silent — form will use defaults */ }
    finally { loading.value = false }
  }
  if (settings) {
    formData.value = {
      // 🔴 Селект показує МОВУ, ЯКА ЗАРАЗ ДІЄ, а не збережену на сервері.
      //
      // Живий баг власника 2026-08-28: інтерфейс український, а в селекті
      // стояло English; натиснув «Зберегти» — і мова перемкнулась. Причина —
      // два незалежні джерела: застосунок бере мову з localStorage['lang']
      // (i18n/index.js), а форма брала `ui_language` з сервера. Вони не
      // синхронізувались ніколи, тож форма показувала те, чого користувач
      // не бачив, і кнопка «Зберегти» тихо ставала кнопкою «Змінити мову».
      //
      // Серверне значення нижче лишається запасним — для акаунта, який
      // відкрили в чистому браузері, де localStorage порожній.
      ui_language: (i18n.global.locale.value as string)
        || settings.ui_language || settings.language || 'uk',
      // Старе написання нормалізуємо, щоб селект не спорожнів на акаунтах,
      // де встигло зберегтись `Europe/Kiev`.
      timezone: normalizeTz(settings.timezone) || 'UTC',
      integralyk_enabled: settings.integralyk_enabled !== false,
      teaching_subjects: Array.isArray(settings.teaching_subjects) ? [...settings.teaching_subjects] : []
    }
    initialData.value = { ...formData.value }
  }
})

function handleChange() {
  errorMessage.value = ''
}

function handleReset() {
  formData.value = { ...initialData.value }
  errorMessage.value = ''
}

async function handleSubmit() {
  if (!hasChanges.value) return

  saving.value = true
  errorMessage.value = ''

  try {
    // `teaching_subjects` шлемо лише коли змінили: інакше форма без реєстру
    // (закриті коридори) перезаписала б збережений вибір порожнім «Усі».
    const payload: Partial<typeof formData.value> = { ...formData.value }
    if (JSON.stringify(formData.value.teaching_subjects) === JSON.stringify(initialData.value.teaching_subjects)) {
      delete payload.teaching_subjects
    }
    const updated = await updateUserSettings(payload)
    // Update local settings in profileStore without calling loadProfile
    if (profileStore.settings) {
      profileStore.settings = { ...profileStore.settings, ...updated }
    }
    initialData.value = { ...formData.value, teaching_subjects: [...formData.value.teaching_subjects] }
    // 🔴 Через setI18nLocale, а НЕ прямим присвоєнням у locale.value.
    // Пряме присвоєння міняло мову лише до перезавантаження: воно не пише
    // localStorage['lang'] і не ставить <html lang>. Тобто користувач бачив,
    // що мова змінилась, а після F5 вона поверталась — і зміна виглядала
    // як така, що не зберігається.
    if (formData.value.ui_language) {
      setLocale(formData.value.ui_language)
    }
    notifySuccess(i18n.global.t('users.settings.saveSuccess'))
  } catch (error: any) {
    errorMessage.value = error?.response?.data?.detail || i18n.global.t('users.settings.saveError')
    notifyError(errorMessage.value)
  } finally {
    saving.value = false
  }
}
</script>
