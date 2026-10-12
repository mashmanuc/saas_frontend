<!--
  Вибір вигляду помічника — «Інтегралик» / «Інтегралка» (ТЗ TZ_INTEGRALYK_INTEGRALKA_VARIANT).
  Одне налаштування акаунта для обох місць: `full` — у «Профіль → Налаштування → Загальні» з живим
  прев'ю обох варіантів; `compact` — одна кнопка в шапці відкритої панелі помічника (не на
  плаваючій кнопці: випадкове натискання чи перетягування не має перемикати вигляд).
  Зберігається одразу (`setAssistantLook`); відмова сервера — попередній вибір і повідомлення.
  З `v-model` (форма налаштувань, власник 2026-10-12: «після зміни треба активувати кнопку
  "зберегти"») — нічого не зберігає сам: лише змінює чернетку форми, зберігає «Зберегти».
  SVG у v-html — лише з нашого генератора, без даних користувача.
-->
<template>
  <div v-if="variant === 'full'" class="alp">
    <div class="alp-opts" role="radiogroup" :aria-label="t('users.settings.general.assistantLook.title')">
      <button
        v-for="opt in ASSISTANT_LOOKS"
        :key="opt"
        type="button"
        role="radio"
        class="alp-opt"
        :class="{ 'is-on': look === opt }"
        :aria-checked="look === opt"
        :disabled="busy"
        :data-testid="`assistant-look-${opt}`"
        @click="choose(opt)"
      >
        <span class="alp-pic" aria-hidden="true" v-html="previewMascotSvg(opt)" />
        <span class="alp-name">{{ t(`users.settings.general.assistantLook.${opt}`) }}</span>
      </button>
    </div>
    <p v-if="error" class="alp-error" role="alert">{{ error }}</p>
  </div>
  <button
    v-else
    type="button"
    class="alp-compact"
    :disabled="busy"
    :title="switchLabel"
    :aria-label="switchLabel"
    data-testid="assistant-look-switch"
    @click="choose(other)"
  >
    <span class="alp-mini" aria-hidden="true" v-html="previewMascotSvg(other)" />
  </button>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { ASSISTANT_LOOKS, setAssistantLook, useAssistantLook, type IntegralykLook } from './assistantLook'
import { previewMascotSvg } from './integralykMascotSvg'

const props = withDefaults(defineProps<{ variant?: 'full' | 'compact'; modelValue?: IntegralykLook | null }>(), {
  variant: 'full',
  modelValue: null,
})
const emit = defineEmits<{
  (e: 'error', message: string): void
  (e: 'update:modelValue', value: IntegralykLook): void
}>()

const { t } = useI18n()
const { look: savedLook } = useAssistantLook()
// Керований (`v-model`) — показуємо чернетку форми; інакше — збережене в акаунті.
const controlled = computed(() => props.modelValue != null)
const look = computed<IntegralykLook>(() => (controlled.value ? (props.modelValue as IntegralykLook) : savedLook.value))
const other = computed<IntegralykLook>(() => (look.value === 'integralka' ? 'integralyk' : 'integralka'))
const switchLabel = computed(() => t('users.settings.general.assistantLook.switchTo', {
  name: t(`users.settings.general.assistantLook.${other.value}`),
}))

const busy = ref(false)
const error = ref('')

async function choose(next: IntegralykLook) {
  if (busy.value || next === look.value) return
  if (controlled.value) {
    emit('update:modelValue', next)   // збереже форма — кнопкою «Зберегти»
    return
  }
  busy.value = true
  error.value = ''
  try {
    await setAssistantLook(next)
  } catch {
    // Вибір уже повернуто до попереднього (`setAssistantLook`); тут — лише показати чому.
    error.value = t('users.settings.general.assistantLook.saveError')
    emit('error', error.value)
  } finally {
    busy.value = false
  }
}
</script>

<style scoped>
/* Токени — з запасом: нові `--color-*` є не в кожній темі (у «light» — лише старі `--border-color`,
   `--accent`…). Без запасу `var()` робить усю властивість недійсною — рамка зникала. */
.alp-opts { display: flex; gap: 12px; flex-wrap: wrap; }
.alp-opt {
  display: flex; flex-direction: column; align-items: center; gap: 6px;
  min-width: 112px; padding: 10px 14px; border-radius: 12px; cursor: pointer;
  border: 2px solid var(--color-border, var(--border-color, #cbd5e1));
  background: var(--color-surface, var(--surface-card, transparent));
  color: var(--color-text, var(--text-primary, inherit));
  transition: border-color .15s ease;
}
.alp-opt:hover:not(:disabled) { border-color: var(--color-border-strong, var(--accent-hover, #64748b)); }
.alp-opt.is-on {
  border-color: var(--color-accent, var(--accent, #0d9488));
  background: var(--color-surface-sunken, var(--bg-hover, rgba(13, 148, 136, .08)));
}
.alp-opt:disabled { cursor: default; opacity: .7; }
.alp-opt:focus-visible, .alp-compact:focus-visible {
  outline: 2px solid var(--color-accent, var(--accent, #0d9488)); outline-offset: 2px;
}
.alp-pic { width: 64px; height: 64px; display: block; }
.alp-pic :deep(svg), .alp-mini :deep(svg) { width: 100%; height: 100%; display: block; }
.alp-name { font-size: 14px; font-weight: 600; }
.alp-error { margin-top: 8px; font-size: 13px; color: var(--color-danger, var(--danger-bg, #dc2626)); }
.alp-compact {
  border: 0; background: transparent; width: 28px; height: 28px; padding: 2px; border-radius: 8px;
  cursor: pointer; display: inline-flex; align-items: center; justify-content: center;
}
.alp-compact:hover:not(:disabled) { background: var(--color-surface-sunken, var(--bg-hover, rgba(255, 255, 255, .15))); }
.alp-compact:disabled { cursor: default; opacity: .6; }
.alp-mini { width: 24px; height: 24px; display: block; }
</style>
