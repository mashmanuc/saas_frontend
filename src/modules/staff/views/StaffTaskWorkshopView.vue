<template>
  <div class="ws" data-testid="staff-task-workshop">
    <header class="ws-head">
      <h1 class="ws-title">{{ $t('staff.taskWorkshop.title') }}</h1>
      <p class="ws-help">{{ $t('staff.taskWorkshop.help') }}</p>
    </header>

    <div class="ws-grid">
      <!-- Теми -->
      <aside class="ws-col ws-topics" data-testid="ws-topics">
        <input v-model="topicSearch" class="ws-input" :placeholder="$t('staff.taskWorkshop.topicsSearch')" />
        <button type="button" class="ws-topic" :class="{ active: !selectedTopic }" @click="chooseTopic('')">
          {{ $t('staff.taskWorkshop.allTopics') }}
        </button>
        <template v-for="row in visibleTopics" :key="row.id">
          <button
            type="button"
            class="ws-topic"
            :class="{ active: selectedTopic === row.id }"
            :style="{ paddingLeft: `${8 + row.depth * 14}px` }"
            :data-testid="`ws-topic-${row.id}`"
            @click="chooseTopic(row.id)"
          >
            <span v-if="row.hasChildren" class="ws-caret" @click.stop="toggle(row.id)">{{ expanded.has(row.id) ? '▾' : '▸' }}</span>
            <span class="ws-topic-label">{{ row.label }}</span>
            <span class="ws-count">{{ row.verified }}/{{ row.total }}</span>
          </button>
        </template>
      </aside>

      <!-- Список -->
      <section class="ws-col ws-list" data-testid="ws-list">
        <div class="ws-states">
          <button
            v-for="s in STATES"
            :key="s"
            type="button"
            class="ws-chip"
            :class="{ active: state === s }"
            :data-testid="`ws-state-${s}`"
            @click="setState(s)"
          >{{ $t(`staff.taskWorkshop.states.${s}`) }}</button>
        </div>
        <input
          v-model="query"
          class="ws-input"
          :placeholder="$t('staff.taskWorkshop.search')"
          @keydown.enter="loadList(1)"
        />
        <p v-if="list && !list.items.length" class="ws-muted">{{ $t('staff.taskWorkshop.empty') }}</p>
        <button
          v-for="(item, i) in list?.items || []"
          :key="item.id"
          type="button"
          class="ws-item"
          :class="{ active: current?.id === item.id }"
          :data-testid="`ws-item-${item.id}`"
          @click="openAt(i)"
        >
          <span class="ws-item-badges">
            <span v-if="item.verified" class="ws-badge ok" :class="{ stale: item.stale }">✓{{ item.level }}</span>
            <span v-if="item.rejected" class="ws-badge bad">✕</span>
            <span v-if="item.edited" class="ws-badge">✎</span>
          </span>
          <span class="ws-item-text">{{ item.text }}</span>
        </button>
        <div v-if="list && pages > 1" class="ws-pager">
          <button type="button" class="ws-btn" :disabled="list.page <= 1" @click="loadList(list.page - 1)">‹</button>
          <span>{{ $t('staff.taskWorkshop.pageOf', { page: list.page, pages }) }}</span>
          <button type="button" class="ws-btn" :disabled="list.page >= pages" @click="loadList(list.page + 1)">›</button>
        </div>
      </section>

      <!-- Задача -->
      <main v-if="current && draft" class="ws-col ws-main" data-testid="ws-task">
        <div class="ws-nav">
          <button type="button" class="ws-btn" data-testid="ws-prev" @click="step(-1)">← {{ $t('staff.taskWorkshop.prev') }}</button>
          <span class="ws-muted">{{ $t('staff.taskWorkshop.taskOf', { index: absoluteIndex, total: list?.total || 0 }) }} · {{ current.external_id }}</span>
          <button type="button" class="ws-btn" data-testid="ws-next" @click="step(1)">{{ $t('staff.taskWorkshop.next') }} →</button>
        </div>
        <p v-if="message" class="ws-message" :class="{ bad: messageBad }" data-testid="ws-message">{{ message }}</p>

        <div class="ws-split">
          <div class="ws-left">
            <h2 class="ws-h">{{ $t('staff.taskWorkshop.asStudent') }}</h2>
            <div class="ws-card" data-testid="ws-preview">
              <div class="ws-card-text" v-html="html(draft.text)" />
              <img v-for="r in current.resources.filter(x => x.uri)" :key="r.resource_id" :src="r.uri || ''" class="ws-img" alt="" />
              <ol v-if="draft.content.choices" class="ws-choices">
                <li v-for="(c, i) in draft.content.choices" :key="i" :class="{ correct: c.is_correct }">
                  <b>{{ c.label || letters[i] }}</b> <span v-html="html(c.text)" />
                </li>
              </ol>
              <p v-if="isOpen" class="ws-answer">{{ $t('staff.taskWorkshop.fieldAnswer') }}: <span v-html="html(String(draft.content.correct_answer ?? ''))" /></p>
              <div v-if="isMatching" class="ws-matching">
                <div><p v-for="l in draft.content.left_items" :key="l.id"><b>{{ l.id }}</b> <span v-html="html(l.text)" /></p></div>
                <div><p v-for="r in draft.content.right_items" :key="r.id"><b>{{ r.id }}</b> <span v-html="html(r.text)" /></p></div>
              </div>
              <details class="ws-solution" open>
                <summary>{{ $t('staff.taskWorkshop.fieldSolution') }}</summary>
                <div v-html="html(draft.solution)" />
              </details>
            </div>

            <h2 class="ws-h">{{ $t('staff.taskWorkshop.editor') }}</h2>
            <label class="ws-label">{{ $t('staff.taskWorkshop.fieldText') }}
              <textarea v-model="draft.text" class="ws-area" rows="4" data-testid="ws-edit-text" />
            </label>
            <div v-if="draft.content.choices" class="ws-label">{{ $t('staff.taskWorkshop.fieldChoices') }}
              <div v-for="(c, i) in draft.content.choices" :key="i" class="ws-choice-row">
                <input
                  type="radio"
                  name="ws-correct"
                  :checked="c.is_correct"
                  :title="$t('staff.taskWorkshop.correct')"
                  :data-testid="`ws-correct-${i}`"
                  @change="setCorrect(i)"
                />
                <b>{{ c.label || letters[i] }}</b>
                <input v-model="c.text" class="ws-input" :data-testid="`ws-choice-${i}`" />
              </div>
            </div>
            <label v-if="isOpen" class="ws-label">{{ $t('staff.taskWorkshop.fieldAnswer') }}
              <input v-model="draft.content.correct_answer" class="ws-input" data-testid="ws-edit-answer" />
            </label>
            <div v-if="isMatching" class="ws-label">{{ $t('staff.taskWorkshop.fieldPairs') }}
              <div v-for="l in draft.content.left_items" :key="l.id" class="ws-choice-row">
                <b>{{ l.id }}</b>
                <input v-model="l.text" class="ws-input" />
                <select class="ws-input ws-narrow" :value="pairOf(l.id)" @change="setPair(l.id, ($event.target as HTMLSelectElement).value)">
                  <option v-for="r in draft.content.right_items" :key="r.id" :value="r.id">{{ r.id }}</option>
                </select>
              </div>
              <div v-for="r in draft.content.right_items" :key="`r-${r.id}`" class="ws-choice-row">
                <b>{{ r.id }}</b>
                <input v-model="r.text" class="ws-input" />
              </div>
            </div>
            <label class="ws-label">{{ $t('staff.taskWorkshop.fieldSolution') }}
              <textarea v-model="draft.solution" class="ws-area" rows="4" data-testid="ws-edit-solution" />
            </label>
            <label class="ws-label">{{ $t('staff.taskWorkshop.reason') }}
              <input v-model="reason" class="ws-input" />
            </label>
            <button type="button" class="ws-btn primary" :disabled="busy || !dirty" data-testid="ws-save" @click="save">
              {{ $t('staff.taskWorkshop.save') }}
            </button>

            <details v-if="current.edits.length" class="ws-history">
              <summary>{{ $t('staff.taskWorkshop.history') }} ({{ current.edits.length }})</summary>
              <div v-for="e in current.edits" :key="e.id" class="ws-edit-row">
                <span>{{ fmtDate(e.at) }} · {{ $t(`staff.taskWorkshop.fields.${e.field}`) }}{{ e.reason ? ` · ${e.reason}` : '' }}</span>
                <button type="button" class="ws-btn" @click="revert(e.id)">{{ $t('staff.taskWorkshop.revert') }}</button>
              </div>
            </details>
          </div>

          <!-- Розмітка -->
          <aside class="ws-right" data-testid="ws-markup">
            <h2 class="ws-h">{{ $t('staff.taskWorkshop.markup') }}</h2>
            <label class="ws-label">{{ $t('staff.taskWorkshop.topic') }}
              <select v-model="topicDraft" class="ws-input" data-testid="ws-topic-select">
                <option v-for="row in topicOptions" :key="row.id" :value="row.id">{{ '— '.repeat(row.depth) }}{{ row.label }}</option>
              </select>
            </label>
            <div class="ws-label">{{ $t('staff.taskWorkshop.level') }}
              <div class="ws-levels">
                <button
                  v-for="n in 5"
                  :key="n"
                  type="button"
                  class="ws-level"
                  :class="{ active: level === n }"
                  :data-testid="`ws-level-${n}`"
                  @click="level = n"
                >{{ n }}</button>
              </div>
            </div>
            <label class="ws-label">{{ $t('staff.taskWorkshop.note') }}
              <input v-model="note" class="ws-input" />
            </label>

            <p v-if="current.verification" class="ws-state ok" :class="{ stale: current.verification.stale }">
              {{ $t('staff.taskWorkshop.verifiedAt', { at: fmtDate(current.verification.at), level: current.verification.level }) }}
              <template v-if="current.verification.stale"> · {{ $t('staff.taskWorkshop.stale') }}</template>
            </p>
            <p v-if="current.rejection" class="ws-state bad">{{ $t('staff.taskWorkshop.rejected', { reason: current.rejection.reason }) }}</p>

            <button type="button" class="ws-btn primary wide" :disabled="busy" data-testid="ws-verify" @click="verifyAndNext">
              ✓ {{ $t('staff.taskWorkshop.verify') }}
            </button>
            <p class="ws-muted small">{{ $t('staff.taskWorkshop.verifyHint') }}</p>
            <template v-if="!current.rejection">
              <input v-model="rejectReason" class="ws-input" :placeholder="$t('staff.taskWorkshop.rejectPrompt')" data-testid="ws-reject-reason" />
              <button type="button" class="ws-btn danger wide" :disabled="busy || !rejectReason.trim()" data-testid="ws-reject" @click="reject">
                {{ $t('staff.taskWorkshop.reject') }}
              </button>
            </template>
            <button v-else type="button" class="ws-btn wide" :disabled="busy" @click="unreject">{{ $t('staff.taskWorkshop.unreject') }}</button>
            <button type="button" class="ws-btn wide" @click="step(1)">{{ $t('staff.taskWorkshop.skip') }}</button>

            <h2 class="ws-h">{{ $t('staff.taskWorkshop.checks') }}</h2>
            <ul class="ws-checks" data-testid="ws-checks">
              <li :class="formulasOk ? 'ok' : 'bad'">{{ formulasOk ? '✓' : '⚠' }} {{ $t(formulasOk ? 'staff.taskWorkshop.checkFormulas' : 'staff.taskWorkshop.checkFormulasBad') }}</li>
              <li :class="current.duplicates ? 'bad' : 'ok'">{{ current.duplicates ? '⚠' : '✓' }} {{ current.duplicates ? $t('staff.taskWorkshop.checkDuplicatesBad', { n: current.duplicates }) : $t('staff.taskWorkshop.checkDuplicates') }}</li>
              <li :class="draft.solution.trim() ? 'ok' : 'bad'">{{ draft.solution.trim() ? '✓' : '⚠' }} {{ $t(draft.solution.trim() ? 'staff.taskWorkshop.checkSolution' : 'staff.taskWorkshop.checkSolutionBad') }}</li>
            </ul>
            <p class="ws-muted small">{{ $t('staff.taskWorkshop.source') }}: {{ current.source }}</p>
          </aside>
        </div>
      </main>
    </div>
  </div>
</template>

<script setup lang="ts">
/**
 * Майстерня банку задач (власник 2026-10-23; ТЗ saas_docs/domains/learning_program/TZ_TASK_WORKSHOP_ADMIN_2026-10-23.md).
 * Ліворуч теми з лічильниками «перевірено мною / усього», посередині список, праворуч задача «як побачить учень»,
 * редагування й розмітка. Показ формул — той самий `renderTextWithLatex`, що й картки іспиту.
 * Клавіші (поза полями вводу): Enter — «перевірено мною» й наступна, ←/→ — попередня/наступна, 1–5 — рівень.
 */
import { computed, onBeforeUnmount, onMounted, reactive, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { renderTextWithLatex } from '@/modules/learning-content/utils/contentRenderer'
import {
  getWorkshopTask, getWorkshopTopics, listWorkshopTasks, rejectWorkshopTask, revertWorkshopEdit,
  unrejectWorkshopTask, updateWorkshopTask, verifyWorkshopTask,
  type WorkshopContent, type WorkshopList, type WorkshopState, type WorkshopTask, type WorkshopTopic,
} from '../api/taskWorkshopApi'

const STATES: WorkshopState[] = ['all', 'new', 'verified', 'rejected', 'edited']
const letters = ['А', 'Б', 'В', 'Г', 'Д', 'Е']
const { t, locale } = useI18n()

const topics = ref<WorkshopTopic[]>([])
const topicSearch = ref('')
const expanded = reactive(new Set<string>())
const selectedTopic = ref('')
const state = ref<WorkshopState>('all')
const query = ref('')
const list = ref<WorkshopList | null>(null)
const current = ref<WorkshopTask | null>(null)
const currentIndex = ref(0)
const draft = ref<{ text: string; solution: string; content: WorkshopContent } | null>(null)
const topicDraft = ref('')
const level = ref<number | null>(null)
const note = ref('')
const reason = ref('')
const rejectReason = ref('')
const busy = ref(false)
const message = ref('')
const messageBad = ref(false)

// ── Дерево тем ──
const childrenOf = computed(() => {
  const map = new Map<string | null, WorkshopTopic[]>()
  for (const tp of topics.value) {
    const key = tp.parent ?? null
    if (!map.has(key)) map.set(key, [])
    map.get(key)!.push(tp)
  }
  for (const arr of map.values()) arr.sort((a, b) => a.label.localeCompare(b.label, 'uk'))
  return map
})

interface Row extends WorkshopTopic { depth: number; hasChildren: boolean }

function flatten(parent: string | null, depth: number, all: boolean, out: Row[]): Row[] {
  for (const tp of childrenOf.value.get(parent) || []) {
    const hasChildren = (childrenOf.value.get(tp.id) || []).length > 0
    out.push({ ...tp, depth, hasChildren })
    if (hasChildren && (all || expanded.has(tp.id))) flatten(tp.id, depth + 1, all, out)
  }
  return out
}

const topicOptions = computed(() => flatten(null, 0, true, []))
const visibleTopics = computed(() => {
  const needle = topicSearch.value.trim().toLowerCase()
  if (!needle) return flatten(null, 0, false, [])
  return topicOptions.value.filter(r => r.label.toLowerCase().includes(needle)).map(r => ({ ...r, depth: 0 }))
})

// Сервер рахує «перевірено» лише при відкритті сторінки (власник 23.10 бачив 0/614 після десяти перевірених),
// тож першу перевірку задачі додаємо до всіх її тем на місці, без перерахунку всієї бази.
function countVerified(rawTopics: string[]) {
  const ids = new Set(rawTopics)
  topics.value = topics.value.map(tp => (ids.has(tp.id) ? { ...tp, verified: tp.verified + 1 } : tp))
}

function toggle(id: string) {
  if (expanded.has(id)) expanded.delete(id)
  else expanded.add(id)
}

// ── Повідомлення й помилки ──
function say(text: string, bad = false) {
  message.value = text
  messageBad.value = bad
}

function fail(err: unknown) {
  const e = err as { response?: { status?: number; data?: { detail?: string } } }
  if (e?.response?.status === 409) say(t('staff.taskWorkshop.conflict'), true)
  else say(e?.response?.data?.detail || t('staff.taskWorkshop.error'), true)
}

// ── Завантаження ──
async function loadTopics() {
  try {
    topics.value = (await getWorkshopTopics()).topics
  } catch (err) {
    fail(err)
  }
}

async function loadList(page = 1, openIndex: number | 'last' = 0) {
  try {
    list.value = await listWorkshopTasks({ topic: selectedTopic.value || undefined, state: state.value,
                                           q: query.value.trim() || undefined, page })
    const items = list.value.items
    if (items.length) await openAt(openIndex === 'last' ? items.length - 1 : Math.min(openIndex, items.length - 1))
    else current.value = null
  } catch (err) {
    fail(err)
  }
}

function setDraft(task: WorkshopTask) {
  current.value = task
  draft.value = { text: task.text, solution: task.solution || '', content: JSON.parse(JSON.stringify(task.content || {})) }
  topicDraft.value = task.topic
  level.value = task.verification?.level ?? null
  note.value = ''
  reason.value = ''
  rejectReason.value = ''
}

async function openAt(index: number) {
  const item = list.value?.items[index]
  if (!item) return
  currentIndex.value = index
  try {
    setDraft(await getWorkshopTask(item.id))
  } catch (err) {
    fail(err)
  }
}

async function step(delta: number) {
  if (!list.value) return
  const next = currentIndex.value + delta
  if (next >= 0 && next < list.value.items.length) return openAt(next)
  if (delta > 0 && list.value.page < pages.value) return loadList(list.value.page + 1, 0)
  if (delta < 0 && list.value.page > 1) return loadList(list.value.page - 1, 'last')
}

function chooseTopic(id: string) {
  selectedTopic.value = id
  if (id) expanded.add(id)
  loadList(1)
}

function setState(s: WorkshopState) {
  state.value = s
  loadList(1)
}

const pages = computed(() => (list.value ? Math.max(1, Math.ceil(list.value.total / list.value.page_size)) : 1))
const absoluteIndex = computed(() => (list.value ? (list.value.page - 1) * list.value.page_size + currentIndex.value + 1 : 0))

// ── Редагування ──
const isOpen = computed(() => current.value?.problem_type === 'open_answer')
const isMatching = computed(() => current.value?.problem_type === 'matching')

const dirty = computed(() => {
  if (!current.value || !draft.value) return false
  return draft.value.text !== current.value.text
    || draft.value.solution !== (current.value.solution || '')
    || JSON.stringify(draft.value.content) !== JSON.stringify(current.value.content || {})
    || topicDraft.value !== current.value.topic
})

function setCorrect(i: number) {
  draft.value?.content.choices?.forEach((c, j) => { c.is_correct = j === i })
}

function pairOf(leftId: string): string {
  return draft.value?.content.correct_pairs?.find(p => String(p[0]) === String(leftId))?.[1] ?? ''
}

function setPair(leftId: string, rightId: string) {
  const content = draft.value?.content
  if (!content) return
  const pairs = (content.correct_pairs || []).filter(p => String(p[0]) !== String(leftId))
  content.correct_pairs = [...pairs, [leftId, rightId]]
}

function replaceListItem(task: WorkshopTask) {
  const item = list.value?.items.find(i => i.id === task.id)
  if (!item) return
  item.verified = !!task.verification
  item.stale = !!task.verification?.stale
  item.level = task.verification?.level ?? null
  item.rejected = !!task.rejection
  item.edited = task.edited
  item.text = task.text.slice(0, 220)
  item.topic = task.topic
}

async function save() {
  if (!current.value || !draft.value) return
  const payload: Record<string, unknown> = { expected_revision: current.value.revision, reason: reason.value }
  if (draft.value.text !== current.value.text) payload.text = draft.value.text
  if (draft.value.solution !== (current.value.solution || '')) payload.solution = draft.value.solution
  if (JSON.stringify(draft.value.content) !== JSON.stringify(current.value.content || {})) payload.content = draft.value.content
  if (topicDraft.value && topicDraft.value !== current.value.topic) payload.topic = topicDraft.value
  busy.value = true
  try {
    const task = await updateWorkshopTask(current.value.id, payload as never)
    setDraft(task)
    replaceListItem(task)
    say(t('staff.taskWorkshop.saved'))
    if (payload.topic) loadTopics()   // задача перейшла в іншу тему — лічильники обох тем змінились
  } catch (err) {
    fail(err)
  } finally {
    busy.value = false
  }
}

async function verifyAndNext() {
  if (!current.value) return
  if (!level.value) return say(t('staff.taskWorkshop.levelRequired'), true)
  say('')
  if (dirty.value) {
    await save()
    if (messageBad.value || !current.value) return
  }
  const firstCheck = !current.value.verification
  busy.value = true
  try {
    const task = await verifyWorkshopTask(current.value.id, { level: level.value, note: note.value,
                                                             expected_revision: current.value.revision })
    replaceListItem(task)
    if (firstCheck) countVerified(task.raw_topics)
    say('')
  } catch (err) {
    busy.value = false
    return fail(err)
  }
  busy.value = false
  await step(1)
}

async function reject() {
  if (!current.value || !rejectReason.value.trim()) return
  busy.value = true
  try {
    const task = await rejectWorkshopTask(current.value.id, { reason: rejectReason.value.trim(),
                                                             expected_revision: current.value.revision })
    setDraft(task)
    replaceListItem(task)
  } catch (err) {
    fail(err)
  } finally {
    busy.value = false
  }
}

async function unreject() {
  if (!current.value) return
  busy.value = true
  try {
    const task = await unrejectWorkshopTask(current.value.id, { expected_revision: current.value.revision })
    setDraft(task)
    replaceListItem(task)
  } catch (err) {
    fail(err)
  } finally {
    busy.value = false
  }
}

async function revert(editId: number) {
  busy.value = true
  try {
    const task = await revertWorkshopEdit(editId)
    setDraft(task)
    replaceListItem(task)
  } catch (err) {
    fail(err)
  } finally {
    busy.value = false
  }
}

// ── Показ і автоперевірки ──
function html(text: string | undefined): string {
  return renderTextWithLatex(text || '')
}

const formulasOk = computed(() => {
  if (!draft.value) return true
  const parts = [draft.value.text, draft.value.solution,
                 ...(draft.value.content.choices || []).map(c => c.text),
                 ...(draft.value.content.left_items || []).map(x => x.text),
                 ...(draft.value.content.right_items || []).map(x => x.text)]
  return parts.every(p => !/\\\\\(|\\\\\)/.test(p || '') && !html(p).includes('katex-error'))
})

function fmtDate(iso: string): string {
  return new Date(iso).toLocaleString(locale.value === 'uk' ? 'uk-UA' : 'en-GB', { dateStyle: 'short', timeStyle: 'short' })
}

// ── Клавіші ──
function onKey(e: KeyboardEvent) {
  const tag = (e.target as HTMLElement | null)?.tagName
  if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || !current.value) return
  if (e.key === 'Enter') { e.preventDefault(); verifyAndNext() }
  else if (e.key === 'ArrowRight') step(1)
  else if (e.key === 'ArrowLeft') step(-1)
  else if (/^[1-5]$/.test(e.key)) level.value = Number(e.key)
}

onMounted(() => {
  window.addEventListener('keydown', onKey)
  loadTopics()
  loadList(1)
})
onBeforeUnmount(() => window.removeEventListener('keydown', onKey))
</script>

<style scoped>
.ws { display: flex; flex-direction: column; gap: var(--space-md); container-type: inline-size; }
.ws-title { font-size: var(--text-2xl); font-weight: 700; color: var(--text-primary); margin: 0; }
.ws-help, .ws-muted { font-size: var(--text-sm); color: var(--text-secondary); margin: 0; }
.ws-muted.small { font-size: var(--text-xs); }
/* Адмінка обмежує ширину сторінки (~1040px): на ній теми й список стають стовпчиком ліворуч, задача — праворуч. */
.ws-grid { display: grid; grid-template-columns: 220px 240px minmax(0, 1fr); grid-template-areas: 'topics list main';
  gap: var(--space-md); align-items: start; }
.ws-topics { grid-area: topics; }
.ws-list { grid-area: list; }
.ws-main { grid-area: main; }
.ws-col { background: var(--surface-card, var(--bg-primary)); border: 1px solid var(--border-color); border-radius: 10px;
  padding: var(--space-sm); display: flex; flex-direction: column; gap: 4px; max-height: calc(100vh - 170px); overflow-y: auto; }
.ws-input, .ws-area { width: 100%; box-sizing: border-box; border: 1px solid var(--border-color); border-radius: 6px;
  padding: 6px 8px; background: var(--bg-primary); color: var(--text-primary); font: inherit; }
.ws-area { resize: vertical; font-family: ui-monospace, monospace; font-size: 13px; }
.ws-narrow { width: 70px; flex: none; }
.ws-topic, .ws-item { display: flex; align-items: center; gap: 6px; width: 100%; text-align: left; border: none;
  background: transparent; padding: 5px 8px; border-radius: 6px; cursor: pointer; color: var(--text-primary); font-size: 13px; }
.ws-topic:hover, .ws-item:hover { background: var(--bg-secondary); }
.ws-topic.active, .ws-item.active { background: var(--color-primary-soft, rgba(16, 185, 129, 0.15)); }
.ws-caret { width: 14px; flex: none; }
.ws-topic-label { flex: 1; min-width: 0; }
.ws-count { font-size: 11px; color: var(--text-secondary); }
.ws-states { display: flex; flex-wrap: wrap; gap: 4px; }
.ws-chip { border: 1px solid var(--border-color); background: transparent; border-radius: 999px; padding: 3px 9px;
  font-size: 12px; cursor: pointer; color: var(--text-primary); }
.ws-chip.active { background: var(--color-primary, #10b981); color: #fff; border-color: transparent; }
.ws-item { align-items: flex-start; }
.ws-item-text { flex: 1; min-width: 0; overflow: hidden; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; }
.ws-item-badges { display: flex; gap: 2px; flex: none; min-width: 34px; }
.ws-badge { font-size: 11px; border-radius: 4px; padding: 0 4px; background: var(--bg-secondary); }
.ws-badge.ok { background: #d1fae5; color: #065f46; }
.ws-badge.ok.stale { background: #fef3c7; color: #92400e; }
.ws-badge.bad { background: #fee2e2; color: #991b1b; }
.ws-pager { display: flex; align-items: center; justify-content: space-between; gap: 6px; font-size: 12px; padding-top: 6px; }
.ws-main { max-height: none; overflow: visible; container-type: inline-size; }
.ws-nav { display: flex; align-items: center; justify-content: space-between; gap: 8px; }
.ws-split { display: grid; grid-template-columns: minmax(0, 1fr); gap: var(--space-md); }
@container (min-width: 620px) { .ws-split { grid-template-columns: minmax(0, 1fr) 230px; } }
.ws-left, .ws-right { display: flex; flex-direction: column; gap: 8px; }
.ws-h { font-size: var(--text-base, 15px); font-weight: 600; margin: 8px 0 0; color: var(--text-primary); }
.ws-card { border: 1px solid var(--border-color); border-radius: 10px; padding: 14px; background: #fff; color: #111; font-size: 16px; }
.ws-card-text { line-height: 1.5; }
.ws-img { max-width: 100%; margin-top: 8px; }
.ws-choices { list-style: none; padding: 0; margin: 10px 0 0; display: grid; gap: 4px; }
.ws-choices li { padding: 4px 8px; border-radius: 6px; }
.ws-choices li.correct { background: #d1fae5; }
.ws-answer { margin: 10px 0 0; background: #d1fae5; padding: 4px 8px; border-radius: 6px; }
.ws-matching { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-top: 10px; }
.ws-matching p { margin: 2px 0; }
.ws-solution { margin-top: 10px; font-size: 14px; color: #374151; }
.ws-label { display: flex; flex-direction: column; gap: 4px; font-size: 13px; color: var(--text-secondary); }
.ws-choice-row { display: flex; align-items: center; gap: 6px; }
.ws-btn { border: 1px solid var(--border-color); background: var(--bg-primary); color: var(--text-primary); border-radius: 6px;
  padding: 6px 10px; cursor: pointer; font-size: 13px; }
.ws-btn:disabled { opacity: 0.5; cursor: default; }
.ws-btn.primary { background: var(--color-primary, #10b981); color: #fff; border-color: transparent; }
.ws-btn.danger { color: #b91c1c; border-color: #fca5a5; }
.ws-btn.wide { width: 100%; }
.ws-levels { display: flex; gap: 4px; }
.ws-level { width: 36px; height: 32px; border: 1px solid var(--border-color); border-radius: 6px; background: transparent;
  cursor: pointer; color: var(--text-primary); }
.ws-level.active { background: var(--color-primary, #10b981); color: #fff; border-color: transparent; }
.ws-state { margin: 0; font-size: 13px; padding: 6px 8px; border-radius: 6px; }
.ws-state.ok { background: #d1fae5; color: #065f46; }
.ws-state.ok.stale { background: #fef3c7; color: #92400e; }
.ws-state.bad { background: #fee2e2; color: #991b1b; }
.ws-checks { list-style: none; padding: 0; margin: 0; font-size: 13px; display: grid; gap: 2px; }
.ws-checks .ok { color: #047857; }
.ws-checks .bad { color: #b45309; }
.ws-message { margin: 0; font-size: 13px; color: #047857; }
.ws-message.bad { color: #b91c1c; }
.ws-history { font-size: 13px; }
.ws-edit-row { display: flex; justify-content: space-between; align-items: center; gap: 6px; padding: 3px 0; }
@container (max-width: 1400px) {
  .ws-grid { grid-template-columns: 230px minmax(0, 1fr); grid-template-rows: min-content 1fr;
    grid-template-areas: 'topics main' 'list main'; }
  .ws-topics { max-height: 38vh; }
  .ws-list { max-height: 48vh; }
}
@container (max-width: 700px) {
  .ws-grid { grid-template-columns: 1fr; grid-template-areas: 'topics' 'list' 'main'; }
}
</style>
