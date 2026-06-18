<!--
  PuzzleCard — рендер однієї задачі (3 типи) + результат. MVP.
  Правильність на клієнт НЕ приходить (anti-cheat) → грейд показуємо з result.
  LaTeX рендеримо через renderTextWithLatex (KaTeX) — той самий util, що й НМТ-тести
  у winterboard. Matching: нативний <select> не рендерить HTML в <option>,
  тому кастомний дропдаун (як WBTestMatchingEl).
-->
<template>
  <div class="pcard">
    <div class="pcard__meta">
      {{ typeLabel }} · {{ t('practice.card.difficulty') }} {{ puzzle.difficulty }}/5 ·
      {{ puzzle.index + 1 }}/{{ puzzle.total }}
    </div>
    <div class="pcard__q" v-html="renderTextWithLatex(puzzle.question)" />

    <!-- single_choice -->
    <div v-if="puzzle.problem_type === 'single_choice'" class="pcard__choices">
      <button
        v-for="c in puzzle.payload.choices"
        :key="c.index"
        type="button"
        class="pcard__choice"
        :class="{ 'is-sel': selectedIndex === c.index }"
        :disabled="answered"
        @click="selectedIndex = c.index"
      >
        <span class="pcard__letter">{{ c.label }}</span>
        <span class="pcard__choice-txt" v-html="renderTextWithLatex(c.text)" />
      </button>
    </div>

    <!-- open_answer -->
    <div v-else-if="puzzle.problem_type === 'open_answer'" class="pcard__open">
      <input
        v-model="openValue"
        type="text"
        inputmode="text"
        :disabled="answered"
        :placeholder="t('practice.card.answerPlaceholder')"
        @keyup.enter="canSubmit && onSubmit()"
      />
    </div>

    <!-- matching (кастомний дропдаун — LaTeX у варіантах) -->
    <div v-else-if="puzzle.problem_type === 'matching'" class="pcard__match">
      <div v-for="l in puzzle.payload.left_items" :key="l.id" class="pcard__pair">
        <span class="pcard__left" v-html="renderTextWithLatex(l.text)" />
        <div class="pcard__select" :class="{ 'is-open': openLeft === l.id, 'is-disabled': answered }">
          <button
            type="button"
            class="pcard__select-btn"
            :disabled="answered"
            @click.stop="toggleDropdown(l.id)"
          >
            <span
              v-if="pairs[l.id]"
              class="pcard__select-val"
              v-html="renderTextWithLatex(rightText(pairs[l.id]))"
            />
            <span v-else class="pcard__select-ph">—</span>
            <span class="pcard__select-arr" :class="{ 'is-open': openLeft === l.id }">▾</span>
          </button>
          <div v-if="openLeft === l.id" class="pcard__dropdown">
            <button
              v-for="r in puzzle.payload.right_items"
              :key="r.id"
              type="button"
              class="pcard__option"
              :class="{ 'is-sel': pairs[l.id] === r.id }"
              @click.stop="selectOption(l.id, r.id)"
              v-html="renderTextWithLatex(r.text)"
            />
          </div>
        </div>
      </div>
    </div>

    <!-- результат -->
    <div v-if="result" class="pcard__result" :class="result.correct ? 'is-ok' : 'is-bad'">
      <div class="pcard__verdict">
        {{ result.correct ? t('practice.card.correct') : t('practice.card.wrong') }}
        <span v-if="result.xp_earned">· +{{ result.xp_earned }} {{ t('practice.stat.xp') }}</span>
      </div>
      <div v-if="result.solution" class="pcard__solution" v-html="renderTextWithLatex(result.solution)" />
    </div>

    <!-- дії -->
    <div class="pcard__actions">
      <button
        v-if="!answered"
        type="button"
        class="pcard__btn"
        :disabled="!canSubmit || submitting"
        @click="onSubmit"
      >
        {{ t('practice.card.check') }}
      </button>
      <button v-else type="button" class="pcard__btn" @click="emit('next')">
        {{ result && result.correct ? t('practice.card.next') : t('practice.card.retry') }}
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, reactive, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { renderTextWithLatex } from '@/modules/learning-content/utils/contentRenderer'

import type { NextPuzzle, SubmitResult } from '../api/practiceApi'

const props = defineProps<{
  puzzle: NextPuzzle
  result: SubmitResult | null
  submitting: boolean
}>()
const emit = defineEmits<{ (e: 'submit', answer: Record<string, any>): void; (e: 'next'): void }>()
const { t } = useI18n()

const selectedIndex = ref<number | null>(null)
const openValue = ref('')
const pairs = reactive<Record<string, string>>({})
const openLeft = ref<string | null>(null) // який matching-дропдаун відкритий

const answered = computed(() => props.result !== null)

const typeLabel = computed(() => t(`practice.type.${props.puzzle.problem_type}`))

const canSubmit = computed(() => {
  const p = props.puzzle
  if (p.problem_type === 'single_choice') return selectedIndex.value !== null
  if (p.problem_type === 'open_answer') return openValue.value.trim() !== ''
  if (p.problem_type === 'matching') {
    const left = p.payload.left_items || []
    return left.length > 0 && left.every((l: any) => pairs[l.id])
  }
  return false
})

// matching: текст вибраного right-елемента (для рендеру у кнопці селекта)
function rightText(rid: string): string {
  const items = (props.puzzle.payload.right_items || []) as Array<{ id: string; text: string }>
  return items.find((r) => r.id === rid)?.text ?? ''
}

function toggleDropdown(id: string) {
  if (answered.value) return
  openLeft.value = openLeft.value === id ? null : id
}

function selectOption(leftId: string, rightId: string) {
  pairs[leftId] = rightId
  openLeft.value = null
}

function closeDropdown() {
  openLeft.value = null
}

onMounted(() => document.addEventListener('click', closeDropdown))
onBeforeUnmount(() => document.removeEventListener('click', closeDropdown))

function buildAnswer(): Record<string, any> {
  const p = props.puzzle
  if (p.problem_type === 'single_choice') return { selected_index: selectedIndex.value }
  if (p.problem_type === 'open_answer') return { value: openValue.value }
  // matching
  const out: [string, string][] = []
  for (const [l, r] of Object.entries(pairs)) {
    if (r) out.push([l, r])
  }
  return { pairs: out }
}

function onSubmit() {
  if (!canSubmit.value) return
  emit('submit', buildAnswer())
}

// Скидаємо локальний стан, коли приходить НОВА задача (нова reference з loadNext).
watch(
  () => props.puzzle,
  () => {
    selectedIndex.value = null
    openValue.value = ''
    openLeft.value = null
    for (const k of Object.keys(pairs)) delete pairs[k]
  },
)
</script>

<style scoped>
/* Тема-aware: surfaces/text/soft-tints через app-vars + локальні --pc-* (light) з
   [data-theme="dark"]-перевизначенням. Зелений акцент --pc-accent адаптується. */
.pcard {
  --pc-accent: #3B6D11;
  --pc-soft: rgba(59,109,17,0.08);
  --pc-soft-strong: rgba(59,109,17,0.12);
  --pc-field: #fafafa;
  --pc-muted-bg: rgba(0,0,0,0.06);
  --pc-bad: rgba(160,45,45,0.10);
  background: var(--card-bg, #fff); border: 1px solid var(--border-color, rgba(0,0,0,0.1));
  border-radius: 12px; padding: 16px; max-width: 560px; color: var(--text-primary, inherit);
}
[data-theme="dark"] .pcard {
  --pc-accent: #6cae3e;
  --pc-soft: rgba(125,211,80,0.14);
  --pc-soft-strong: rgba(125,211,80,0.20);
  --pc-field: rgba(255,255,255,0.04);
  --pc-muted-bg: rgba(255,255,255,0.07);
  --pc-bad: rgba(220,90,90,0.16);
}
.pcard__meta { font-size: 12px; opacity: 0.6; margin-bottom: 8px; }
.pcard__q { font-size: 16px; line-height: 1.5; margin-bottom: 14px; }
.pcard__choices { display: flex; flex-direction: column; gap: 8px; }
.pcard__choice { display: flex; align-items: center; gap: 10px; text-align: left; padding: 10px 12px; border: 1px solid var(--border-color, rgba(0,0,0,0.12)); border-radius: 8px; background: transparent; cursor: pointer; font-size: 14px; color: inherit; }
.pcard__choice.is-sel { border-color: var(--pc-accent); background: var(--pc-soft); }
.pcard__choice:disabled { cursor: default; }
.pcard__choice-txt { line-height: 1.4; }
.pcard__letter { width: 24px; height: 24px; flex-shrink: 0; display: inline-flex; align-items: center; justify-content: center; border-radius: 50%; background: var(--pc-muted-bg); font-size: 12px; font-weight: 600; }
.pcard__open input { width: 100%; padding: 10px 12px; border: 1px solid var(--border-color, rgba(0,0,0,0.15)); border-radius: 8px; font-size: 14px; background: var(--pc-field); color: var(--text-primary, inherit); }
.pcard__match { display: flex; flex-direction: column; gap: 8px; }
.pcard__pair { display: flex; align-items: center; gap: 10px; }
.pcard__left { flex: 1; font-size: 14px; line-height: 1.4; }

/* matching: кастомний селект (нативний <select> не рендерить LaTeX) */
.pcard__select { flex: 1; position: relative; min-width: 0; }
.pcard__select-btn { width: 100%; min-height: 36px; padding: 8px 10px; border: 1px solid var(--border-color, rgba(0,0,0,0.15)); border-radius: 8px; background: var(--pc-field); color: var(--text-primary, inherit); font-size: 14px; display: flex; align-items: center; gap: 6px; text-align: left; cursor: pointer; }
.pcard__select.is-open .pcard__select-btn, .pcard__select-btn:focus { border-color: var(--pc-accent); background: var(--card-bg, #fff); outline: none; box-shadow: 0 0 0 3px var(--pc-soft-strong); }
.pcard__select.is-disabled .pcard__select-btn { opacity: 0.7; cursor: default; }
.pcard__select-val { flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.pcard__select-ph { flex: 1; color: var(--text-secondary, #9ca3af); }
.pcard__select-arr { flex-shrink: 0; font-size: 11px; color: var(--text-secondary, #9ca3af); transition: transform 0.15s ease; }
.pcard__select-arr.is-open { transform: rotate(180deg); }
.pcard__dropdown { position: absolute; top: calc(100% + 3px); left: 0; right: 0; background: var(--card-bg, #fff); border: 1px solid var(--border-color, rgba(0,0,0,0.15)); border-radius: 8px; box-shadow: 0 4px 16px rgba(0,0,0,0.18); z-index: 50; max-height: 220px; overflow-y: auto; }
.pcard__option { width: 100%; padding: 8px 12px; font-size: 14px; background: none; border: none; text-align: left; cursor: pointer; line-height: 1.4; color: inherit; }
.pcard__option:hover { background: var(--pc-soft); }
.pcard__option.is-sel { background: var(--pc-soft-strong); font-weight: 500; }

.pcard__result { margin-top: 14px; padding: 12px; border-radius: 8px; font-size: 14px; }
.pcard__result.is-ok { background: var(--pc-soft-strong); }
.pcard__result.is-bad { background: var(--pc-bad); }
.pcard__verdict { font-weight: 600; }
.pcard__solution { margin-top: 8px; font-size: 13px; line-height: 1.6; }
.pcard__actions { margin-top: 16px; }
.pcard__btn { background: var(--pc-accent); color: #fff; border: none; border-radius: 8px; padding: 11px 20px; font-size: 15px; font-weight: 500; cursor: pointer; }
.pcard__btn:disabled { opacity: 0.5; cursor: default; }

/* LaTeX (v-html-вміст не скоупиться — :deep). KaTeX-шрифти йдуть з katex.min.css (імпорт у util). */
.pcard :deep(.lc-display-math) { text-align: center; margin: 8px 0; }
.pcard :deep(.katex) { font-size: 1.04em; }
.pcard :deep(.lc-formula-error) { color: #dc2626; font-family: monospace; }
</style>
