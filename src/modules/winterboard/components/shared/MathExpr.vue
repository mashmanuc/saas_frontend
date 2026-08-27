<!--
  MathExpr — read-only KaTeX-рендер ascii-виразу (ТЗ 2026-07-21 P0-B).

  props.expr — ascii-рядок ЯК ЗБЕРІГАЄТЬСЯ у store/ops (`3x^2-4x+1`).
  Конверсія ascii→LaTeX — utils/asciiMathToLatex (view-only; формат
  зберігання НЕ міняється — hard-заборона ТЗ §0).

  Fallback (LAW §12 — НЕ silent): невалідний вираз → plain <code> + ОДИН
  console.warn на унікальний вираз (не спам на кожен re-render).

  Патерн KaTeX — learning-content/utils/contentRenderer.ts
  (output: htmlAndMathml + katex.min.css: видимий HTML для export-capture,
  прихований MathML для screen readers).

  translate="no" (2026-08-15): браузерний переклад сторінки переписує
  текстові вузли DOM і не розуміє змішаної структури KaTeX (прихований
  MathML + видимий HTML) — радикали й дробові риски мовчки зникали.
  Другий call-site KaTeX у застосунку (перший — contentRenderer.ts); обидва
  мусять бути захищені, інакше формули ламаються там, де фікс не доїхав.
  Fallback-<code> теж: у ньому лежить сирий математичний вираз.
-->
<template>
  <span v-if="html" class="wb-math-expr notranslate" translate="no" v-html="html" />
  <code v-else class="wb-math-expr wb-math-expr--fallback notranslate" translate="no">{{ expr }}</code>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import katex from 'katex'
import { toKatexCompatible } from '@/utils/katexCompat'
import 'katex/dist/katex.min.css'
import { asciiMathToLatex } from '../../utils/asciiMathToLatex'

const props = defineProps<{
  /** ascii-вираз зі store (напр. "x^2" або "y = 3x^2-4x+1"). */
  expr: string
  /** Display-режим KaTeX (блочний, більший). Default: inline. */
  display?: boolean
}>()

// Один warn на унікальний невалідний вираз (module-scope — спільний для всіх
// інстансів; без нього кожен re-render спамив би консоль тим самим виразом).
const warned = new Set<string>()

const html = computed<string | null>(() => {
  const src = (props.expr ?? '').trim()
  if (!src) return null
  try {
    const latex = toKatexCompatible(asciiMathToLatex(src))
    return katex.renderToString(latex, {
      output: 'htmlAndMathml',
      displayMode: props.display === true,
      throwOnError: true,
    })
  } catch (err) {
    if (!warned.has(src)) {
      warned.add(src)
      console.warn('[MathExpr] fallback to plain text for expr:', src, err)
    }
    return null
  }
})
</script>

<style scoped>
.wb-math-expr {
  /* КaTeX сам задає шрифти; успадковуємо розмір контексту */
  font-size: inherit;
  line-height: inherit;
}

.wb-math-expr--fallback {
  font-family: 'JetBrains Mono', monospace;
  font-size: 0.95em;
}
</style>
