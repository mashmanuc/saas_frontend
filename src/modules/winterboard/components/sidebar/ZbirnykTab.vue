<!--
  «Збірник» — третя вкладка бічної панелі (власник 2026-10-28: «щоб я міг зразу гортати і притягувати
  завдання собі»). НАШ збірник із задач банку: розділи → рівень → задачі (умова з формулами). Задача йде на
  дошку перетягуванням або «+» — тим самим шляхом, що й «Інструменти» (MIME + payload →
  useContentDrop.addAtPosition); на дошці — картка задачі, як із генератора уроку. Відповідь бачить лише
  вчитель тут.
-->
<template>
  <div class="zb" data-testid="zbirnyk-tab">
    <p v-if="state === 'loading'" class="zb__status">{{ t('winterboard.zbirnyk.loading') }}</p>
    <div v-else-if="state === 'failed'" class="zb__status" role="status" data-testid="zbirnyk-failed">
      <p>{{ t('winterboard.zbirnyk.loadFailed') }}</p>
      <button type="button" class="zb__retry" @click="loadOverview">{{ t('winterboard.zbirnyk.retry') }}</button>
    </div>

    <!-- Теми -->
    <template v-else-if="!openTheme">
      <p class="zb__hint">{{ t('winterboard.zbirnyk.hint') }}</p>
      <div class="zb__themes">
        <button
          v-for="th in themes"
          :key="th.id"
          type="button"
          class="zb__theme"
          :data-testid="`zbirnyk-theme-${th.id}`"
          @click="showTheme(th.id)"
        >
          <span class="zb__theme-num">{{ th.number }}</span>
          <span class="zb__theme-title">{{ th.title }}</span>
          <span class="zb__theme-count">{{ th.levels.reduce((n, lv) => n + lv.count, 0) }}</span>
        </button>
      </div>
    </template>

    <!-- Тема: рівні й задачі -->
    <template v-else>
      <div class="zb__crumb">
        <button
          type="button"
          class="zb__back"
          :title="t('common.back')"
          :aria-label="t('common.back')"
          data-testid="zbirnyk-back"
          @click="zbirnykView.themeId = null"
        >←</button>
        <span class="zb__crumb-label">{{ openTheme.number }}. {{ openTheme.title }}</span>
      </div>
      <div class="zb__levels" role="tablist">
        <button
          v-for="lv in openTheme.levels"
          :key="lv.level"
          type="button"
          role="tab"
          class="zb__level"
          :class="{ 'zb__level--active': lv.level === currentLevel }"
          :aria-selected="lv.level === currentLevel"
          :data-testid="`zbirnyk-level-${lv.level}`"
          @click="zbirnykView.level = lv.level"
        >{{ t('winterboard.zbirnyk.level', { n: lv.level }) }}</button>
      </div>

      <p v-if="themeState === 'loading'" class="zb__status">{{ t('winterboard.zbirnyk.loading') }}</p>
      <div v-else-if="themeState === 'failed'" class="zb__status" role="status" data-testid="zbirnyk-theme-failed">
        <p>{{ t('winterboard.zbirnyk.loadFailed') }}</p>
        <button type="button" class="zb__retry" @click="loadTheme(openTheme.id)">{{ t('winterboard.zbirnyk.retry') }}</button>
      </div>
      <div v-else class="zb__tasks">
        <div
          v-for="task in tasks"
          :key="task.ref.id"
          class="zb__task"
          :class="{ 'zb__task--adding': zbirnykAdding.has(task.ref.id) }"
          draggable="true"
          :data-testid="`zbirnyk-task-${task.number}`"
          @dragstart="onDragStart($event, task)"
        >
          <div class="zb__task-head">
            <span class="zb__task-num">{{ t('winterboard.zbirnyk.taskNumber', { n: task.number }) }}</span>
            <span v-if="zbirnykAdding.has(task.ref.id)" class="zb__adding" role="status">{{ t('winterboard.zbirnyk.adding') }}</span>
            <button
              v-else
              type="button"
              class="zb__add"
              :title="t('winterboard.zbirnyk.add')"
              :aria-label="t('winterboard.zbirnyk.add')"
              :data-testid="`zbirnyk-add-${task.number}`"
              @click.stop="add(task)"
            >+</button>
          </div>
          <!-- Текст банку (LaTeX) — той самий показ, що на картці задачі дошки -->
          <div class="zb__text" v-html="renderTextWithLatex(task.text)" />
          <div v-if="task.type === 'single_choice' && task.choices?.length" class="zb__choices">
            <span v-for="c in task.choices" :key="c.label" class="zb__choice">
              <b>{{ c.label }})</b>&nbsp;<span v-html="renderTextWithLatex(c.text)" />
            </span>
          </div>
          <div v-else-if="task.type === 'matching'" class="zb__match">
            <ol class="zb__match-col">
              <li v-for="i in task.left" :key="i.id"><b>{{ i.id }})</b>&nbsp;<span v-html="renderTextWithLatex(i.text)" /></li>
            </ol>
            <ol class="zb__match-col">
              <li v-for="i in task.right" :key="i.id"><b>{{ i.id }})</b>&nbsp;<span v-html="renderTextWithLatex(i.text)" /></li>
            </ol>
          </div>
          <button
            v-if="task.answer !== null"
            type="button"
            class="zb__answer"
            :class="{ 'zb__answer--open': answersShown.has(task.ref.id) }"
            :data-testid="`zbirnyk-answer-${task.number}`"
            @click.stop="toggleAnswer(task.ref.id)"
          >{{ answersShown.has(task.ref.id)
            ? t('winterboard.zbirnyk.answer', { answer: task.answer })
            : t('winterboard.zbirnyk.showAnswer') }}</button>
        </div>
      </div>
    </template>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, reactive, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useAddToolToBoard } from '../../composables/useAddToolToBoard'
import { renderTextWithLatex } from '@/modules/learning-content/utils/contentRenderer'
import {
  ZBIRNYK_TASK_MIME, getZbirnykOverview, getZbirnykTheme, zbirnykAdding, zbirnykView,
  type ZbirnykTask, type ZbirnykTheme, type ZbirnykThemeSummary,
} from '../../zbirnyk/zbirnykApi'

const { t } = useI18n()
const addTool = useAddToolToBoard()

const state = ref<'loading' | 'ready' | 'failed'>('loading')
const themes = ref<ZbirnykThemeSummary[]>([])
const themeState = ref<'loading' | 'ready' | 'failed'>('loading')
const loadedTheme = ref<ZbirnykTheme | null>(null)
const answersShown = reactive(new Set<string>())

/** Відкрита тема: заголовок і рівні — з огляду одразу, задачі — коли прийде тема. */
const openTheme = computed(() => themes.value.find(th => th.id === zbirnykView.themeId) ?? null)
const currentLevel = computed(() => {
  const levels = openTheme.value?.levels ?? []
  return levels.some(lv => lv.level === zbirnykView.level) ? zbirnykView.level : (levels[0]?.level ?? 1)
})
const tasks = computed<ZbirnykTask[]>(() => {
  if (!loadedTheme.value || loadedTheme.value.id !== zbirnykView.themeId) return []
  return loadedTheme.value.levels.find(lv => lv.level === currentLevel.value)?.tasks ?? []
})

async function loadOverview(): Promise<void> {
  state.value = 'loading'
  try {
    const r = await getZbirnykOverview()
    if (r.status !== 'ready') {
      state.value = 'failed'
      return
    }
    themes.value = r.themes
    state.value = 'ready'
    if (zbirnykView.themeId) await loadTheme(zbirnykView.themeId)
  } catch (err) {
    console.warn('[WB:zbirnyk] overview failed', err)
    state.value = 'failed'
  }
}

async function loadTheme(id: string): Promise<void> {
  themeState.value = 'loading'
  try {
    const r = await getZbirnykTheme(id)
    if (zbirnykView.themeId !== id) return   // поки чекали — вчитель відкрив іншу тему
    if (r.status !== 'ready') {
      themeState.value = 'failed'
      return
    }
    const { status: _s, ...theme } = r
    loadedTheme.value = theme
    themeState.value = 'ready'
  } catch (err) {
    console.warn('[WB:zbirnyk] theme failed', err)
    if (zbirnykView.themeId === id) themeState.value = 'failed'
  }
}

function showTheme(id: string): void {
  zbirnykView.themeId = id
  zbirnykView.level = openTheme.value?.levels[0]?.level ?? 1
  void loadTheme(id)
}

function payload(task: ZbirnykTask): string {
  return JSON.stringify({ id: task.ref.id })
}

function add(task: ZbirnykTask): void {
  if (zbirnykAdding.has(task.ref.id)) return
  addTool(ZBIRNYK_TASK_MIME, payload(task))
}

function onDragStart(e: DragEvent, task: ZbirnykTask): void {
  if (!e.dataTransfer) return
  e.dataTransfer.setData(ZBIRNYK_TASK_MIME, payload(task))
  e.dataTransfer.effectAllowed = 'copy'
}

function toggleAnswer(id: string): void {
  if (answersShown.has(id)) answersShown.delete(id)
  else answersShown.add(id)
}

watch(() => zbirnykView.themeId, (id) => {
  if (!id) loadedTheme.value = null
})

onMounted(loadOverview)
</script>

<style scoped>
.zb { display: flex; flex-direction: column; min-height: 0; }
.zb__status { padding: 16px 12px; font-size: 12px; color: #64748b; display: flex; flex-direction: column; gap: 8px; align-items: flex-start; }
.zb__status p { margin: 0; }
.zb__retry {
  border: 1px solid #c7d2fe; background: #f5f3ff; color: #4338ca; border-radius: 6px;
  padding: 4px 10px; font-size: 12px; font-weight: 600; cursor: pointer;
}
.zb__hint { margin: 10px 12px; font-size: 12px; line-height: 1.45; color: #64748b; }
.zb__themes { display: flex; flex-direction: column; padding: 0 8px 12px; gap: 2px; }
.zb__theme {
  display: flex; align-items: baseline; gap: 8px; width: 100%; text-align: left;
  padding: 8px; border: 1px solid transparent; border-radius: 8px; background: transparent; cursor: pointer;
}
.zb__theme:hover { background: #e0f2fe; border-color: #7dd3fc; }
.zb__theme-num { min-width: 20px; font-size: 12px; font-weight: 700; color: #2563eb; }
.zb__theme-title { flex: 1; min-width: 0; font-size: 13px; color: #1e293b; }
.zb__theme-count { font-size: 11px; color: #94a3b8; }
.zb__crumb {
  display: flex; align-items: center; gap: 8px; padding: 8px 12px;
  border-bottom: 1px solid #f1f5f9; background: #fff;
}
.zb__back {
  border: 1px solid #e2e8f0; background: #f8fafc; border-radius: 6px; flex-shrink: 0;
  width: 24px; height: 24px; cursor: pointer; color: #475569; font-size: 14px; line-height: 1;
}
.zb__back:hover { background: #e0f2fe; border-color: #7dd3fc; }
.zb__crumb-label { font-size: 13px; font-weight: 700; color: #1e293b; min-width: 0; }
.zb__levels { display: flex; gap: 4px; padding: 8px 12px; }
.zb__level {
  flex: 1; height: 28px; border: 1px solid #e2e8f0; border-radius: 6px; background: #f8fafc;
  font-size: 12px; font-weight: 600; color: #64748b; cursor: pointer;
}
.zb__level--active { background: #2563eb; border-color: #2563eb; color: #fff; }
.zb__tasks { display: flex; flex-direction: column; gap: 8px; padding: 0 12px 12px; }
.zb__task {
  display: flex; flex-direction: column; gap: 6px; padding: 8px;
  border: 1px solid #e2e8f0; border-radius: 10px; background: #fff; cursor: grab;
}
.zb__task:hover { border-color: #7dd3fc; }
.zb__task--adding { opacity: 0.6; cursor: progress; }
.zb__task-head { display: flex; align-items: center; justify-content: space-between; gap: 8px; }
.zb__task-num { font-size: 12px; font-weight: 700; color: #475569; }
.zb__adding { font-size: 11px; color: #64748b; }
.zb__add {
  width: 24px; height: 24px; padding: 0; display: flex; align-items: center; justify-content: center;
  background: #f5f3ff; color: #6366f1; border: 1px solid #c7d2fe; border-radius: 6px;
  font-size: 16px; font-weight: 700; line-height: 1; cursor: pointer;
}
.zb__add:hover { background: #ede9fe; border-color: #818cf8; color: #4338ca; }
.zb__text { font-size: 13px; line-height: 1.5; color: #1e293b; overflow-wrap: anywhere; }
.zb__choices { display: flex; flex-wrap: wrap; gap: 4px 12px; font-size: 12px; color: #334155; }
.zb__choice { display: inline-flex; align-items: baseline; }
.zb__match { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; font-size: 12px; color: #334155; }
.zb__match-col { margin: 0; padding: 0; list-style: none; display: flex; flex-direction: column; gap: 2px; min-width: 0; }
/* KaTeX у вузькій панелі: довга формула прокручується, а не розпирає панель */
.zb__text :deep(.katex-display), .zb__choices :deep(.katex-display) { overflow-x: auto; overflow-y: hidden; margin: 4px 0; }
.zb__answer {
  align-self: flex-start; border: 1px dashed #cbd5e1; background: transparent; border-radius: 6px;
  padding: 3px 8px; font-size: 12px; color: #64748b; cursor: pointer;
}
.zb__answer--open { border-style: solid; border-color: #86efac; background: #f0fdf4; color: #166534; font-weight: 600; }
@media (any-pointer: coarse) {
  .zb__add { width: 32px; height: 32px; font-size: 20px; }
}

[data-theme="dark"] .zb__theme:hover,
[data-theme="dark"] .zb__back:hover { background: var(--color-accent-soft); border-color: var(--color-border-strong); }
[data-theme="dark"] .zb__theme-num { color: var(--color-accent); }
[data-theme="dark"] .zb__theme-title,
[data-theme="dark"] .zb__crumb-label,
[data-theme="dark"] .zb__text { color: var(--color-text); }
[data-theme="dark"] .zb__choices,
[data-theme="dark"] .zb__match { color: var(--color-text-secondary); }
[data-theme="dark"] .zb__hint,
[data-theme="dark"] .zb__status,
[data-theme="dark"] .zb__theme-count,
[data-theme="dark"] .zb__adding,
[data-theme="dark"] .zb__task-num { color: var(--color-text-muted); }
[data-theme="dark"] .zb__crumb { background: var(--color-surface); border-color: var(--color-border); }
[data-theme="dark"] .zb__back,
[data-theme="dark"] .zb__level,
[data-theme="dark"] .zb__task { background: var(--color-surface-sunken); border-color: var(--color-border); color: var(--color-text-secondary); }
[data-theme="dark"] .zb__level--active { background: var(--color-accent); border-color: var(--color-accent); color: var(--color-on-accent); }
[data-theme="dark"] .zb__answer { color: var(--color-text-secondary); border-color: var(--color-border-strong); }
[data-theme="dark"] .zb__answer--open { background: var(--color-accent-soft); color: var(--color-text); border-color: var(--color-accent); }
</style>
