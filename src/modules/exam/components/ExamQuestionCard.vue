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

    <!-- matching -->
    <div v-else-if="item.problem_type === 'matching'" class="eq__match">
      <div v-for="l in item.content.left_items || []" :key="l.id" class="eq__pair">
        <span class="eq__left" v-html="renderTextWithLatex(l.text)" />
        <div class="eq__select" :class="{ 'is-open': openLeft === l.id, 'is-disabled': disabled }">
          <button type="button" class="eq__select-btn" :disabled="disabled" @click.stop="toggle(l.id)">
            <span v-if="pairs[l.id]" class="eq__select-val" v-html="renderTextWithLatex(rightText(pairs[l.id]))" />
            <span v-else class="eq__select-ph">—</span>
            <span class="eq__select-arr" :class="{ 'is-open': openLeft === l.id }">▾</span>
          </button>
          <div v-if="openLeft === l.id" class="eq__dropdown">
            <button
              v-for="r in item.content.right_items || []"
              :key="r.id"
              type="button"
              class="eq__option"
              :class="{ 'is-sel': pairs[l.id] === r.id }"
              @click.stop="selectPair(l.id, r.id)"
              v-html="renderTextWithLatex(r.text)"
            />
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, reactive, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { renderTextWithLatex } from '@/modules/learning-content/utils/contentRenderer'

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
const pairs = reactive<Record<string, string>>({})
const openLeft = ref<string | null>(null)

const sectionName = computed(() => props.item.section_name || '')
const typeLabel = ref('')

function hydrate() {
  selectedIndex.value = props.answer?.selected_index ?? null
  openValue.value = props.answer?.value ?? ''
  for (const k of Object.keys(pairs)) delete pairs[k]
  for (const [l, r] of props.answer?.pairs || []) pairs[l] = r
  typeLabel.value = t(`exam.type.${props.item.problem_type}`)
  openLeft.value = null
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

function rightText(rid: string): string {
  const items = (props.item.content.right_items || []) as Array<{ id: string; text: string }>
  return items.find((r) => r.id === rid)?.text ?? ''
}
function toggle(id: string) {
  if (props.disabled) return
  openLeft.value = openLeft.value === id ? null : id
}
function selectPair(leftId: string, rightId: string) {
  pairs[leftId] = rightId
  openLeft.value = null
  const out: [string, string][] = Object.entries(pairs).filter(([, r]) => r) as [string, string][]
  emit('commit', { pairs: out })
}
function closeDropdown() {
  openLeft.value = null
}

onMounted(() => {
  hydrate()
  document.addEventListener('click', closeDropdown)
})
onBeforeUnmount(() => document.removeEventListener('click', closeDropdown))
watch(() => props.item.external_id, hydrate)
</script>

<style scoped>
.eq {
  --eq-accent: #3B6D11;
  --eq-soft: rgba(59,109,17,0.08);
  --eq-soft-strong: rgba(59,109,17,0.12);
  --eq-field: #fafafa;
  --eq-muted-bg: rgba(0,0,0,0.06);
  background: var(--card-bg, #fff); border: 1px solid var(--border-color, rgba(0,0,0,0.1));
  border-radius: 12px; padding: 20px; color: var(--text-primary, inherit);
}
[data-theme="dark"] .eq {
  --eq-accent: #6cae3e; --eq-soft: rgba(125,211,80,0.14); --eq-soft-strong: rgba(125,211,80,0.20);
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
.eq__match { display: flex; flex-direction: column; gap: 8px; }
.eq__pair { display: flex; align-items: center; gap: 10px; }
.eq__left { flex: 1; font-size: 15px; line-height: 1.4; }
.eq__select { flex: 1; position: relative; min-width: 0; }
.eq__select-btn { width: 100%; min-height: 38px; padding: 8px 10px; border: 1px solid var(--border-color, rgba(0,0,0,0.15)); border-radius: 8px; background: var(--eq-field); color: var(--text-primary, inherit); font-size: 15px; display: flex; align-items: center; gap: 6px; text-align: left; cursor: pointer; }
.eq__select.is-open .eq__select-btn { border-color: var(--eq-accent); box-shadow: 0 0 0 3px var(--eq-soft-strong); }
.eq__select.is-disabled .eq__select-btn { opacity: 0.7; cursor: default; }
.eq__select-val { flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.eq__select-ph { flex: 1; color: var(--text-secondary, #9ca3af); }
.eq__select-arr { flex-shrink: 0; font-size: 11px; color: var(--text-secondary, #9ca3af); transition: transform 0.15s ease; }
.eq__select-arr.is-open { transform: rotate(180deg); }
.eq__dropdown { position: absolute; top: calc(100% + 3px); left: 0; right: 0; background: var(--card-bg, #fff); border: 1px solid var(--border-color, rgba(0,0,0,0.15)); border-radius: 8px; box-shadow: 0 4px 16px rgba(0,0,0,0.18); z-index: 50; max-height: 220px; overflow-y: auto; }
.eq__option { width: 100%; padding: 9px 12px; font-size: 15px; background: none; border: none; text-align: left; cursor: pointer; line-height: 1.4; color: inherit; }
.eq__option:hover { background: var(--eq-soft); }
.eq__option.is-sel { background: var(--eq-soft-strong); font-weight: 500; }
.eq :deep(.lc-display-math) { text-align: center; margin: 8px 0; }
.eq :deep(.katex) { font-size: 1.05em; }
.eq :deep(.lc-formula-error) { color: #dc2626; font-family: monospace; }
</style>
