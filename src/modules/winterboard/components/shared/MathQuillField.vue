<!--
  MathQuillField — WYSIWYG-редагування формули (MathQuill), як у standalone
  /mash/grapher/. Монтується ЛИШЕ коли loadMathQuill() дав інтерфейс і вираз
  конвертований у LaTeX (renderable) — інакше caller показує звичайний input.

  Контракт (дзеркалить mount() з mq-adapter.js):
    modelValue (ascii, як у store) → asciiMathToLatex → mq.latex(init, silent)
    typing → handlers.edit → latexToSrc(mq.latex()) → update:modelValue (ascii)
    Enter → emit('enter'); втрата фокуса → emit('blur')
  Формат зберігання НЕ міняється — ascii завжди (ТЗ §0.1).
  «/» у полі — дріб (рішення owner 2026-07-21); slash-меню шаблонів у
  MQ-режимі відсутнє (шаблони — у quick-add кнопках).
-->
<template>
  <span ref="host" class="wb-mq-field" @focusout="onFocusOut" />
</template>

<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { asciiMathToLatex } from '../../utils/asciiMathToLatex'
import { latexToSrc } from '../../utils/latexToSrc'
import { loadMathQuill, type MQFieldApi } from '../../utils/mathquillLoader'

const props = defineProps<{
  modelValue: string
  autofocus?: boolean
}>()

const emit = defineEmits<{
  'update:modelValue': [src: string]
  enter: []
  blur: []
  /** MQ не змонтувався (недоступний/помилка) — caller перемикається на input. */
  unavailable: []
}>()

const host = ref<HTMLElement | null>(null)
let mqField: MQFieldApi | null = null
let silent = false
let focused = false

onMounted(async () => {
  const MQ = await loadMathQuill()
  if (!MQ || !host.value) { emit('unavailable'); return }
  try {
    mqField = MQ.MathField(host.value, {
      spaceBehavesLikeTab: false,
      autoCommands: 'pi theta sqrt',
      autoOperatorNames:
        'sin cos tan sec csc cot sinh cosh tanh asin acos atan arcsin arccos arctan ' +
        'ln log exp abs min max mod floor ceil round sign cbrt',
      handlers: {
        edit: (mf: MQFieldApi) => {
          if (silent) return
          let src: string
          try { src = latexToSrc(mf.latex()) } catch { src = '' }
          emit('update:modelValue', src)
        },
        enter: () => emit('enter'),
      },
    })
    // Init: ascii → LaTeX, silent (щоб edit-handler не стрельнув фантомним апдейтом)
    silent = true
    try {
      mqField.latex(asciiMathToLatex(props.modelValue || ''))
    } catch (err) {
      // Caller зобов'язаний давати renderable src (isRenderableAscii) — якщо
      // сюди дійшло, це баг верхнього рівня; кажемо вголос, поле лишається порожнім.
      console.warn('[MathQuillField] init latex failed for src:', props.modelValue, err)
    }
    silent = false
    if (props.autofocus) mqField.focus()
    focused = props.autofocus === true
  } catch (err) {
    console.warn('[MathQuillField] mount failed — falling back to plain input:', err)
    mqField = null
    emit('unavailable')
  }
})

// Зовнішні зміни (ops з іншої вкладки/реплей) — тихо синхронізуємо, коли не друкуємо.
watch(() => props.modelValue, (v) => {
  if (!mqField || focused) return
  silent = true
  try {
    mqField.latex(asciiMathToLatex(v || ''))
  } catch (err) {
    // Зовнішній апдейт приніс не-renderable src — поле лишає попередній вигляд;
    // визначена деградація, логуємо для діагностики.
    console.warn('[MathQuillField] external src not renderable, keeping view:', v, err)
  }
  silent = false
})

function onFocusOut(e: FocusEvent): void {
  // focusout спливає з внутрішніх textarea MathQuill; ігноруємо переходи всередині поля
  const to = e.relatedTarget as Node | null
  if (to && host.value?.contains(to)) return
  focused = false
  emit('blur')
}

onBeforeUnmount(() => {
  try {
    mqField?.revert()
  } catch (err) {
    void err // revert після зовнішнього demontage DOM — очікуваний no-op
  }
  mqField = null
})
</script>

<style scoped>
.wb-mq-field {
  flex: 1 1 auto;
  min-width: 0;
  display: block;
}

/* Метрики як в input-а поруч (без стрибка лейауту) */
.wb-mq-field :deep(.mq-editable-field) {
  width: 100%;
  min-width: 0;
  padding: 2px 6px;
  border: 1px solid rgba(59, 123, 155, 0.45);
  border-radius: 4px;
  background: #fff;
  font-size: 13px;
}
</style>
