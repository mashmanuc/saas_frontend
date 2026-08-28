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
// ⚠️ У проєкті ДВА різні входи в i18n, і вони розходяться:
//   src/i18n/index.js  — setI18nLocale(), пише localStorage['lang']
//   src/i18n/index.ts  — setLocale(),     пише localStorage['locale']
// Vite резолвить `.js` раніше за `.ts` (типовий порядок розширень), тож у
// РАНТАЙМІ працює перший, а TypeScript перевіряє другий — і на `@/i18n`
// падає на будь-якому імені, якого немає в `.ts`.
//
// Беремо `setLocale` — єдине ім'я, що є в ОБОХ файлах: у `.js` це псевдонім
// `setI18nLocale` (рядок 76, заведений саме «для сумісності з TypeScript-
// версією»), у `.ts` — власна функція. Тому імпорт і типізується, і в
// рантаймі викликає потрібну реалізацію з ключем `lang`.
//
// Уточнювати шлях як `@/i18n/index.js` марно: TypeScript зводить його назад
// до `.ts` і падає з тією ж помилкою.
//
// Сам розкол — окремий дефект, ширший за цю форму: два ключі сховища
// означають, що мова, збережена одним шляхом, невидима для іншого.
import { i18n, setLocale } from '@/i18n'

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
  integralyk_enabled: true
})

const initialData = ref({ ...formData.value })
const saving = ref(false)
const loading = ref(false)
const errorMessage = ref('')

const hasChanges = computed(() => {
  return JSON.stringify(formData.value) !== JSON.stringify(initialData.value)
})

onMounted(async () => {
  // Try cached settings first, then fetch from API
  let settings = profileStore.settings
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
      integralyk_enabled: settings.integralyk_enabled !== false
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
    const updated = await updateUserSettings(formData.value)
    // Update local settings in profileStore without calling loadProfile
    if (profileStore.settings) {
      profileStore.settings = { ...profileStore.settings, ...updated }
    }
    initialData.value = { ...formData.value }
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
