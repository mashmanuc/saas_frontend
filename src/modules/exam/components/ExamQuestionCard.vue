<!--
  ExamQuestionCard — рендер однієї задачі (3 типи) в екзаменаційному режимі.
  БЕЗ грейду/розбору (exam-семантика: правильність лише наприкінці). Відповідь
  редагується вільно; commit → UPSERT на сервер. LaTeX через renderTextWithLatex (KaTeX).
-->
<template>
  <div class="eq">
    <div class="eq__meta">{{ sectionName }} · {{ typeLabel }} · {{ position }}/{{ totalCount }}</div>
    <div class="eq__q" v-html="renderTextWithLatex(item.text)" />

    <!-- single_choice -->
    <div v-if="item.problem_type === 'single_choice'" class="eq__choices">
      <button
        v-for="(c, idx) in item.content.choices || []"
        :key="idx"
        type="button"
        class="eq__choice"
        :class="{ 'is-sel': selectedIndex === idx }"
        :disabled="disabled"
        @click="selectChoice(idx)"
      >
        <span class="eq__letter">{{ c.label }}</span>
        <span class="eq__choice-txt" v-html="renderTextWithLatex(c.text)" />
      </button>
    </div>

    <!-- open_answer -->
    <div v-else-if="item.problem_type === 'open_answer'" class="eq__open">
      <input
        v-model="openValue"
        type="text"
        :disabled="disabled"
        :placeholder="t('exam.answerPlaceholder')"
        @blur="commitOpen"
        @keyup.enter="commitOpen"
      />
    </div>

    <!-- matching — усі варіанти видимі одразу + перетягування (pointer) / tap-фолбек -->
    <MatchingField
      v-else-if="item.problem_type === 'matching'"
      :left-items="item.content.left_items || []"
      :right-items="item.content.right_items || []"
      :answer="answer"
      :disabled="disabled"
      @change="onMatchChange"
    />
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { renderTextWithLatex } from '@/modules/learning-content/utils/contentRenderer'
import MatchingField from './MatchingField.vue'

const props = defineProps<{
  item: { external_id: string; problem_type: string; text: string; content: any; section_name?: string }
  answer: Record<string, any> | null
  disabled?: boolean
  position: number
  totalCount: number
}>()
const emit = defineEmits<{ (e: 'commit', answer: Record<string, any>): void }>()
const { t } = useI18n()

const selectedIndex = ref<number | null>(null)
const openValue = ref('')

const sectionName = computed(() => props.item.section_name || '')
const typeLabel = ref('')

function hydrate() {
  selectedIndex.value = props.answer?.selected_index ?? null
  openValue.value = props.answer?.value ?? ''
  typeLabel.value = t(`exam.type.${props.item.problem_type}`)
}

function selectChoice(idx: number) {
  if (props.disabled) return
  selectedIndex.value = idx
  emit('commit', { selected_index: idx })
}

function commitOpen() {
  if (props.disabled) return
  if (openValue.value.trim() !== '') emit('commit', { value: openValue.value })
}

function onMatchChange(answer: Record<string, any>) {
  emit('commit', answer)
}

onMounted(hydrate)
watch(() => props.item.external_id, hydrate)
</script>

<style scoped>
.eq {
  /* Формальна «екзаменаційна» палітра (slate), у тон focus-mode чрому — не застосунковий зелений. */
  --eq-accent: #1f3a5f;
  --eq-soft: rgba(31,58,95,0.08);
  --eq-soft-strong: rgba(31,58,95,0.12);
  --eq-field: #fafafa;
  --eq-muted-bg: rgba(0,0,0,0.06);
  background: var(--card-bg, #fff); border: 1px solid var(--border-color, rgba(0,0,0,0.1));
  border-radius: 12px; padding: 20px; color: var(--text-primary, inherit);
}
[data-theme="dark"] .eq {
  --eq-accent: #7aa2d6; --eq-soft: rgba(122,162,214,0.14); --eq-soft-strong: rgba(122,162,214,0.20);
  --eq-field: rgba(255,255,255,0.04); --eq-muted-bg: rgba(255,255,255,0.07);
}
.eq__meta { font-size: 12px; opacity: 0.6; margin-bottom: 10px; }
.eq__q { font-size: 17px; line-height: 1.55; margin-bottom: 18px; }
.eq__choices { display: flex; flex-direction: column; gap: 8px; }
.eq__choice { display: flex; align-items: center; gap: 10px; text-align: left; padding: 11px 13px; border: 1px solid var(--border-color, rgba(0,0,0,0.12)); border-radius: 8px; background: transparent; cursor: pointer; font-size: 15px; color: inherit; }
.eq__choice.is-sel { border-color: var(--eq-accent); background: var(--eq-soft); }
.eq__choice:disabled { cursor: default; opacity: 0.75; }
.eq__letter { width: 26px; height: 26px; flex-shrink: 0; display: inline-flex; align-items: center; justify-content: center; border-radius: 50%; background: var(--eq-muted-bg); font-size: 13px; font-weight: 600; }
.eq__open input { width: 100%; padding: 11px 13px; border: 1px solid var(--border-color, rgba(0,0,0,0.15)); border-radius: 8px; font-size: 15px; background: var(--eq-field); color: var(--text-primary, inherit); }
/* matching рендериться окремим компонентом MatchingField (усі варіанти видимі + DnD). */
.eq :deep(.lc-display-math) { text-align: center; margin: 8px 0; }
.eq :deep(.katex) { font-size: 1.05em; }
.eq :deep(.lc-formula-error) { color: #dc2626; font-family: monospace; }
</style>
