<!--
  Коридори Інтегралика — селектор предмета й мови матеріалу (ТЗ 2026-09-17 §4.1).

  ОДИН компонент для палітри на ноутбуці й пульта на телефоні: список предметів і
  мов береться з реєстру сервера, підписи — з тих самих ключів i18n. Стан — ззовні
  (палітра: спільний store; пульт: `remote.state` ноутбука), тож компонент нічого
  не пише сам і лише повідомляє вибір подіями.

  Згорнуто:   «Предмет: Авто · Історія»   /  «Предмет: Історія 🔒»
              «Мова матеріалу: Авто · English» / «Мова матеріалу: English 🔒»
-->
<template>
  <div class="corridor-selector" :class="{ 'corridor-selector--compact': compact }" data-testid="corridor-selector">
    <div class="corridor-selector__item">
      <button
        type="button"
        class="corridor-selector__chip"
        data-testid="corridor-subject-chip"
        :aria-expanded="open === 'subject' ? 'true' : 'false'"
        aria-haspopup="menu"
        :disabled="disabled || readonly"
        :title="subjectHint"
        @click="toggle('subject')"
      >
        <span class="corridor-selector__name">{{ t('winterboard.corridor.subject') }}:</span>{{ ' ' }}<span data-testid="corridor-subject-value">{{ subjectText }}</span>
      </button>
      <div v-if="open === 'subject'" class="corridor-selector__menu" role="menu" data-testid="corridor-subject-menu">
        <button type="button" role="menuitemradio" :aria-checked="subject.mode !== 'locked' ? 'true' : 'false'"
                data-testid="corridor-subject-auto" @click="pick('subject', AUTO)">
          {{ t('winterboard.corridor.auto') }}
        </button>
        <button v-for="s in lockableSubjects" :key="s.id" type="button" role="menuitemradio"
                :aria-checked="subject.locked === s.id ? 'true' : 'false'"
                :data-testid="`corridor-subject-${s.id}`" @click="pick('subject', s.id)">
          {{ labelOf(s) }}
        </button>
      </div>
    </div>

    <div class="corridor-selector__item">
      <button
        type="button"
        class="corridor-selector__chip"
        data-testid="corridor-language-chip"
        :aria-expanded="open === 'language' ? 'true' : 'false'"
        aria-haspopup="menu"
        :disabled="disabled || readonly"
        :title="languageHint"
        @click="toggle('language')"
      >
        <span class="corridor-selector__name">{{ t('winterboard.corridor.materialLanguage') }}:</span>{{ ' ' }}<span data-testid="corridor-language-value">{{ languageText }}</span>
      </button>
      <div v-if="open === 'language'" class="corridor-selector__menu" role="menu" data-testid="corridor-language-menu">
        <button type="button" role="menuitemradio" :aria-checked="language.mode !== 'locked' ? 'true' : 'false'"
                data-testid="corridor-language-auto" @click="pick('language', AUTO)">
          {{ t('winterboard.corridor.auto') }}
        </button>
        <button v-for="l in languages" :key="l.id" type="button" role="menuitemradio"
                :aria-checked="language.locked === l.id ? 'true' : 'false'"
                :data-testid="`corridor-language-${l.id}`" @click="pick('language', l.id)">
          {{ labelOf(l) }}
        </button>
      </div>
    </div>

    <p v-if="errorKey" class="corridor-selector__error" role="status" data-testid="corridor-error">
      {{ t(`winterboard.corridor.errors.${errorKey}`) }}
    </p>
  </div>
</template>

<script setup>
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'

const AUTO = 'auto'

const props = defineProps({
  registry: { type: Object, default: null },
  subject: { type: Object, required: true },     // {mode, resolved, locked, source}
  language: { type: Object, required: true },    // {mode, content, locked, source}
  disabled: { type: Boolean, default: false },
  readonly: { type: Boolean, default: false },
  errorKey: { type: String, default: '' },
  compact: { type: Boolean, default: false },
})
const emit = defineEmits(['select-subject', 'select-language'])

const { t, locale } = useI18n()
const open = ref(null)

const uiLocale = computed(() => (locale.value === 'en' ? 'en' : 'uk'))
const subjects = computed(() => props.registry?.subjects || [])
const lockableSubjects = computed(() => {
  const ids = props.registry?.lockable_subjects || []
  return subjects.value.filter(s => ids.includes(s.id))
})
const languages = computed(() => props.registry?.languages || [])

function labelOf(entry) {
  return entry?.labels?.[uiLocale.value] || entry?.label || entry?.id || ''
}

// Назви для ПОТОЧНОГО предмета — з усіх активних (`available_subjects`), а не
// лише з видимих. Профіль вчителя ховає предмети зі списку, але урок усе одно
// може йти в прихованому (разова математика в історика, план уроку з
// математики). Шукаючи назву лише в `subjects`, селектор підписав би такий
// урок «Загальний» — неправду. Список для вибору лишається `subjects`.
const namedSubjects = computed(() => props.registry?.available_subjects || subjects.value)

function subjectLabel(id) {
  const found = namedSubjects.value.find(s => s.id === id)
  // Невідомий предмет не вигадуємо — «Загальний» (ТЗ §4.2).
  return found ? labelOf(found) : labelOf(namedSubjects.value.find(s => s.id === 'general')) || t('winterboard.corridor.general')
}

function languageLabel(id) {
  return labelOf(languages.value.find(l => l.id === id)) || id
}

const subjectText = computed(() => props.subject.mode === 'locked'
  ? `${subjectLabel(props.subject.locked || props.subject.resolved)} 🔒`
  : `${t('winterboard.corridor.auto')} · ${subjectLabel(props.subject.resolved)}`)

const languageText = computed(() => props.language.mode === 'locked'
  ? `${languageLabel(props.language.locked || props.language.content)} 🔒`
  : `${t('winterboard.corridor.auto')} · ${languageLabel(props.language.content)}`)

function sourceHint(source) {
  const key = `winterboard.corridor.source.${source}`
  const text = t(key)
  return text === key ? '' : text
}
const subjectHint = computed(() => sourceHint(props.subject.source))
const languageHint = computed(() => sourceHint(props.language.source))

function toggle(which) {
  open.value = open.value === which ? null : which
}

function pick(which, value) {
  open.value = null
  emit(which === 'subject' ? 'select-subject' : 'select-language', value)
}

defineExpose({ AUTO })
</script>

<style scoped>
.corridor-selector {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  align-items: flex-start;
  padding: 6px 10px;
  font-size: 12px;
}
.corridor-selector__item { position: relative; }
.corridor-selector__chip {
  display: inline-block;
  max-width: 100%;
  padding: 3px 8px;
  border: 1px solid #d1d5db;
  border-radius: 999px;
  background: #fff;
  color: #111827;
  cursor: pointer;
  white-space: nowrap;
}
.corridor-selector__chip:disabled { cursor: default; opacity: 0.7; }
.corridor-selector__chip:focus-visible { outline: 2px solid var(--wb-brand, #047857); outline-offset: 1px; }
.corridor-selector__name { color: #6b7280; }
.corridor-selector__menu {
  position: absolute;
  z-index: 30;
  top: calc(100% + 4px);
  left: 0;
  display: flex;
  flex-direction: column;
  min-width: 160px;
  padding: 4px;
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  background: #fff;
  box-shadow: 0 8px 20px rgba(15, 23, 42, 0.15);
}
.corridor-selector__menu button {
  padding: 6px 10px;
  border: 0;
  border-radius: 6px;
  background: transparent;
  text-align: left;
  cursor: pointer;
}
.corridor-selector__menu button[aria-checked='true'] { font-weight: 600; background: #ecfdf5; }
.corridor-selector__menu button:hover { background: #f3f4f6; }
.corridor-selector__error { flex-basis: 100%; margin: 0; color: #b91c1c; }
.corridor-selector--compact { padding: 4px 0; }
</style>
