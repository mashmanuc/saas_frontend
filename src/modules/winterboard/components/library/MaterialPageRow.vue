<template>
  <li class="material-page" :class="{ 'material-page--confirmed': !!page.confirmed_at }">
    <div class="material-page__head">
      <span class="material-page__no">{{ t('winterboard.materials.page', { n: page.page_no }) }}</span>

      <span class="material-page__source">{{ sourceLabel }}</span>

      <!--
        Підпис стоїть для ВСЬОГО, що не текстовий шар, навіть коли попереджень
        немає. Порожній `warnings` означає «наші перевірки нічого не знайшли»,
        а не «тут усе правильно»: vision дав 96.9 %, OCR — 98.87 %, і жодне не
        100 (C2). Слова «перевірено» в цьому компоненті немає ніде.
      -->
      <span v-if="page.needs_review" class="material-page__machine">
        {{ t('winterboard.materials.machineRead') }}
      </span>

      <span v-if="page.confirmed_at" class="material-page__ok">
        {{ t('winterboard.materials.confirmed') }}
      </span>

      <button
        type="button"
        class="material-page__toggle"
        :aria-expanded="expanded"
        :aria-controls="`material-page-text-${page.page_no}`"
        @click="expanded = !expanded"
      >{{ expanded ? t('winterboard.materials.collapse') : t('winterboard.materials.expand') }}</button>
    </div>

    <p v-if="page.status === 'failed'" class="material-page__failed" role="alert">
      {{ t('winterboard.materials.failed', { code: page.error }) }}
    </p>

    <!-- Дефекти й мітки — РІЗНІ за виглядом, бо різні за суттю -->
    <ul v-if="defects.length" class="material-page__warnings">
      <li v-for="(w, i) in defects" :key="`d${i}`" class="material-page__warning">
        <strong>{{ t(`winterboard.materials.warning.${w.code}`) }}</strong>
        <span class="material-page__warning-detail">{{ w.detail }}</span>
        <code v-if="w.sample" class="material-page__sample">{{ w.sample }}</code>
      </li>
    </ul>

    <!--
      `formula_block` — НЕ дефект, а класифікація: «це теорія, у задачі не
      піде». Малювати її тим самим червоним, що й зіпсований текст, було б
      брехнею (C2: `inferred` ≠ `wrong`).
    -->
    <p v-if="theoryMarks" class="material-page__theory">
      {{ t('winterboard.materials.theoryMark', { n: theoryMarks }) }}
    </p>

    <pre
      v-show="expanded"
      :id="`material-page-text-${page.page_no}`"
      class="material-page__text"
    >{{ page.text }}</pre>

    <div class="material-page__confirm">
      <!--
        ⛔ Підтвердити можна ЛИШЕ розгорнуту сторінку, і кнопки «підтвердити
        всі» в панелі немає навмисно. Ворота 6-2 існують тому, що роздільника
        рукопису в нас немає — чотири ознаки провалились на вимірі — і людина
        лишається єдиним роздільником. Масове підтвердження без читання
        перетворює ворота на клікання й робить усі три пакети декорацією.
      -->
      <button
        type="button"
        class="material-page__confirm-btn"
        :disabled="!canConfirm"
        :title="expanded ? '' : t('winterboard.materials.expandFirst')"
        @click="$emit('confirm', page.page_no)"
      >{{ t('winterboard.materials.confirmRead') }}</button>

      <span v-if="!expanded && !page.confirmed_at" class="material-page__hint">
        {{ t('winterboard.materials.expandFirst') }}
      </span>
    </div>
  </li>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'

import type { MaterialPage } from '../../api/materials'

const props = defineProps<{ page: MaterialPage; busy?: boolean }>()
defineEmits<{ (e: 'confirm', pageNo: number): void }>()

const { t } = useI18n()
const expanded = ref(false)

const sourceLabel = computed(() =>
  t(`winterboard.materials.source.${props.page.source}`))

/** Дефекти — те, що зіпсовано. `formula_block` сюди НЕ входить. */
const defects = computed(() =>
  (props.page.warnings || []).filter((w) => w.code !== 'formula_block'))

const theoryMarks = computed(() =>
  (props.page.warnings || []).filter((w) => w.code === 'formula_block').length)

const canConfirm = computed(() =>
  expanded.value && !props.page.confirmed_at && props.page.status === 'done'
  && !props.busy)

defineExpose({ expanded })
</script>

<style scoped>
.material-page { border-bottom: 1px solid rgba(0,0,0,0.08); padding: 0.6em 0; list-style: none; }
.material-page--confirmed { background: rgba(25,124,75,0.05); }
.material-page__head { display: flex; gap: 0.6em; align-items: center; flex-wrap: wrap; }
.material-page__no { font-weight: 600; }
.material-page__source { font-size: 0.85em; opacity: 0.75; }
.material-page__machine { font-size: 0.78em; padding: 0.1em 0.5em; border-radius: 0.4em;
  background: rgba(0,0,0,0.06); }
.material-page__ok { font-size: 0.8em; color: #197c4b; font-weight: 600; }
.material-page__toggle { margin-left: auto; background: none; border: 0;
  text-decoration: underline; cursor: pointer; }
.material-page__warnings { list-style: none; padding: 0; margin: 0.4em 0; }
.material-page__warning { border-left: 3px solid #d97706; padding: 0.2em 0.6em;
  margin: 0.3em 0; font-size: 0.86em; }
.material-page__warning-detail { display: block; opacity: 0.85; }
.material-page__sample { display: block; margin-top: 0.2em; font-size: 0.85em;
  background: rgba(0,0,0,0.05); padding: 0.2em 0.4em; overflow-x: auto; }
/* Нейтрально — це мітка класу, не дефект */
.material-page__theory { font-size: 0.84em; opacity: 0.7; margin: 0.3em 0;
  border-left: 3px solid rgba(0,0,0,0.15); padding-left: 0.6em; }
.material-page__failed { color: #dc3545; font-size: 0.86em; }
.material-page__text { white-space: pre-wrap; font-size: 0.86em; max-height: 22em;
  overflow-y: auto; background: rgba(0,0,0,0.03); padding: 0.6em; margin: 0.4em 0; }
.material-page__confirm { display: flex; gap: 0.6em; align-items: center; }
.material-page__hint { font-size: 0.8em; opacity: 0.7; }
</style>
