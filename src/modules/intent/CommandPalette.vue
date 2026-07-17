<!--
  UIA Command Palette (Ctrl+Shift+K) — ГЛОБАЛЬНА точка входу (App.vue). Producer (Закон №6).

  Sprint 4 — COMMAND DIALOG ENGINE: команди декларують `params`; invoke() добирає відсутні
  діалогом. Типи параметрів: text | number | list | SELECT (показує людські label, надсилає value).
  Це «отвір», у який AI-Producer вставиться (усі params → запуск; бракує → спитати) без зміни capabilities.
  Помилки — людською мовою (ERR_MSG). Gated VITE_FEATURE_UIA + tutor/staff. Removable.
-->
<template>
  <Teleport to="body">
    <!-- Плаваючий «Інтегралик» (маскот з DATA/integral): живе поверх УСЬОГО застосунку
         (і дошки, і сторінки з хедером — справа зверху, під дзвіночком). Клік = палітра. -->
    <button
      v-if="enabled && AI_ENABLED && !open"
      class="cmdp-fab"
      :style="fabStyle"
      title="Інтегралик — AI-помічник (Ctrl+Shift+K). Перетягніть, куди зручно"
      aria-label="Відкрити Інтегралика — AI-помічника"
      @pointerdown="fabPointerDown"
      @pointermove="fabPointerMove"
      @pointerup="fabPointerUp"
      @pointercancel="fabPointerUp"
      @click="onFabClick"
      v-html="MASCOT_SVG"
    ></button>

    <div v-if="enabled && open" class="cmdp-overlay" @click.self="close">
      <div class="cmdp-panel" role="dialog" aria-label="Командна палітра">

        <!-- MODE: команди -->
        <template v-if="mode === 'commands'">
          <input
            ref="inputEl" v-model="query" class="cmdp-input"
            placeholder="Що зробити? (напр. «урок», «дошку», «мої уроки»)"
            @keydown.down.prevent="move(1)" @keydown.up.prevent="move(-1)"
            @keydown.enter.prevent="runSelected"
          />
          <ul class="cmdp-list">
            <li
              v-for="(c, i) in filtered" :key="c.id"
              :class="['cmdp-item', { active: i === selected }]"
              @mouseenter="selected = i" @click="invoke(c)"
            >{{ c.label }}</li>
            <li v-if="!filtered.length" class="cmdp-empty">Нічого не знайдено</li>
          </ul>
        </template>

        <!-- MODE: діалог параметрів -->
        <template v-else-if="mode === 'dialog' && currentParam">
          <div class="cmdp-head">
            <button class="cmdp-back" @click="toCommands">← Скасувати</button>
            <span class="cmdp-title">{{ dialog.cmd.label }}</span>
            <span class="cmdp-meta">крок {{ dialog.idx + 1 }}/{{ dialog.queue.length }}</span>
          </div>
          <div class="cmdp-dialog">
            <label class="cmdp-dlabel">{{ currentParam.label }}</label>

            <!-- SELECT: список людських назв -->
            <template v-if="currentParam.type === 'select'">
              <input
                ref="dialogSearchEl" v-model="dialogQuery" class="cmdp-input"
                placeholder="Оберіть або почніть вводити…"
                @keydown.down.prevent="moveOpt(1)" @keydown.up.prevent="moveOpt(-1)"
                @keydown.enter.prevent="pickHighlighted"
              />
              <ul class="cmdp-list">
                <li v-if="dialogOptLoading" class="cmdp-empty">Завантаження…</li>
                <li
                  v-for="(o, i) in dialogOptionsFiltered" :key="o.value"
                  :class="['cmdp-item', { active: i === dialogOptIdx }]"
                  @mouseenter="dialogOptIdx = i" @click="pickOption(o)"
                >{{ o.label }}</li>
                <li v-if="!dialogOptLoading && !dialogOptionsFiltered.length" class="cmdp-empty">Немає варіантів</li>
              </ul>
            </template>

            <!-- TEXT / NUMBER / LIST -->
            <template v-else>
              <input
                ref="dialogInputEl" v-model="dialogInput" class="cmdp-input"
                :type="currentParam.type === 'number' ? 'number' : 'text'"
                @keydown.enter.prevent="submitStep"
              />
            </template>

            <div class="cmdp-hint">Enter — далі · Esc — скасувати</div>
          </div>
        </template>

        <!-- MODE: мої дошки -->
        <template v-else-if="mode === 'boards'">
          <div class="cmdp-head">
            <button class="cmdp-back" @click="toCommands">← Команди</button>
            <span class="cmdp-title">Мої дошки</span>
          </div>
          <ul class="cmdp-list">
            <li v-for="b in boards" :key="b.id" class="cmdp-board">
              <span class="cmdp-bname" @click="openBoard(b)" :title="'Відкрити: ' + b.name">{{ b.name || 'Без назви' }}</span>
              <span class="cmdp-actions">
                <button title="Відкрити" :disabled="loading" @click="openBoard(b)">↗</button>
                <button title="Дублювати" :disabled="loading" @click="invoke(actDuplicate, { board_id: b.id })">⧉</button>
                <button title="Перейменувати" :disabled="loading" @click="invoke(actRename, { board_id: b.id })">✎</button>
                <button title="Експорт PDF" :disabled="loading" @click="invoke(actExport, { board_id: b.id })">⬇</button>
                <button title="Видалити" :disabled="loading" @click="confirmDelete(actDeleteBoard, { board_id: b.id }, b.name)">🗑</button>
              </span>
            </li>
            <li v-if="!boards.length && !loading" class="cmdp-empty">Дошок ще немає</li>
          </ul>
        </template>

        <!-- MODE: AI-Producer #1 (parse ≠ execute): пропозиція → Resolution Policy → звичайний intent -->
        <template v-else-if="mode === 'ai'">
          <div class="cmdp-head">
            <button class="cmdp-back" @click="toCommands">← Команди</button>
            <span class="cmdp-mascot" :class="{ thinking: aiPhase === 'loading' }" v-html="MASCOT_SVG"></span>
            <span class="cmdp-title">Інтегралик</span>
            <span class="cmdp-meta">«{{ aiPhrase }}»</span>
          </div>
          <div class="cmdp-dialog">
            <p v-if="aiPhase === 'loading'" class="cmdp-empty">Думаю…</p>

            <!-- propose (medium/high) → підтвердження; high/destructive — ЗАВЖДИ -->
            <template v-else-if="aiPhase === 'confirm'">
              <p class="cmdp-ai-explain">{{ aiResp.explain }}</p>
              <p v-if="aiResp.risk === 'high'" class="cmdp-ai-danger">⚠️ Незворотна дія — потрібне підтвердження.</p>
              <div class="cmdp-ai-actions">
                <button :class="['cmdp-btn', { 'cmdp-btn--danger': aiResp.risk === 'high' }]"
                        :disabled="loading" @click="confirmAi">
                  {{ aiResp.risk === 'high' ? 'Так, виконати' : 'Так, зробити' }}
                </button>
                <button class="cmdp-back" :disabled="loading" @click="toCommands">Скасувати</button>
              </div>
            </template>

            <!-- clarify → кандидати (+Explain у label) -->
            <template v-else-if="aiPhase === 'clarify'">
              <p class="cmdp-ai-explain">{{ aiResp.question }}</p>
              <ul class="cmdp-list">
                <li v-for="c in aiResp.candidates" :key="c.id" class="cmdp-item"
                    @click="pickAiCandidate(c)">{{ c.label }}</li>
              </ul>
            </template>

            <!-- none → чесне пояснення + що робити далі (без глухого кута) -->
            <template v-else>
              <p class="cmdp-ai-explain">{{ aiResp.explain }}</p>
              <p class="cmdp-ai-tip">Спробуйте перефразувати, напр.: «видали дошку Алгебра» · «відкрий останній урок» · «згенеруй урок з логарифмів на 6 задач»</p>
              <div class="cmdp-ai-actions">
                <button class="cmdp-back" @click="toCommands">← Спробувати ще раз</button>
              </div>
            </template>
          </div>
        </template>

        <!-- MODE: мої уроки -->
        <template v-else>
          <div class="cmdp-head">
            <button class="cmdp-back" @click="toCommands">← Команди</button>
            <span class="cmdp-title">Мої уроки</span>
          </div>
          <ul class="cmdp-list">
            <li v-for="l in lessons" :key="l.id" class="cmdp-board">
              <span class="cmdp-bname" @click="invoke(actOpenLesson, { lesson_id: l.id })" :title="'Відкрити: ' + l.title">
                {{ l.title || 'Без назви' }} <small class="cmdp-meta">· {{ l.status }}</small>
              </span>
              <span class="cmdp-actions">
                <button title="Відкрити (редагувати)" :disabled="loading" @click="invoke(actOpenLesson, { lesson_id: l.id })">↗</button>
                <button title="Видалити" :disabled="loading" @click="confirmDelete(actDeleteLesson, { lesson_id: l.id }, l.title)">🗑</button>
              </span>
            </li>
            <li v-if="!lessons.length && !loading" class="cmdp-empty">Уроків ще немає</li>
          </ul>
        </template>

        <div v-if="loading" class="cmdp-status">Виконую…</div>
        <div v-if="notice" class="cmdp-status">✓ {{ notice }}</div>
        <div v-if="error" class="cmdp-error">{{ error }}</div>
        <div class="cmdp-hint">Ctrl+Shift+K (або Ctrl/⌘+K) — відкрити · ↑↓/Enter — команди · Esc — назад/закрити<span v-if="AI_ENABLED"> · ∫ Інтегралик: просто опишіть дію словами</span></div>
      </div>
    </div>
  </Teleport>
</template>

<script setup>
import { ref, computed, onMounted, onBeforeUnmount, nextTick } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { useAuthStore } from '../auth/store/authStore'
import { parseAi, sendIntent } from './sendIntent'
// SSOT «Стилю карток» — той самий список, що показує конструктор (Класичний/Наочний).
// Reuse, щоб палітра й конструктор ніколи не розходились.
import { THEMES } from '@/modules/lesson_constructor/api/lessonConstructorApi'

const SHORTCUTS = [
  { ctrl: true, shift: false, key: 'k' },
  { meta: true, shift: false, key: 'k' },
  { ctrl: true, shift: true, key: 'k' },
]
function matchesShortcut(e) {
  const k = (e.key || '').toLowerCase()
  return SHORTCUTS.some(s => k === s.key && !!s.ctrl === e.ctrlKey && !!s.meta === e.metaKey && !!s.shift === e.shiftKey)
}
const ALLOWED_ROLES = ['tutor', 'admin', 'staff', 'superadmin']

// Людські повідомлення для кодів помилок (замість сирого технічного detail).
const ERR_MSG = {
  TASK_SELECTION_FAILED: 'Для цієї теми й кількості недостатньо задач. Оберіть іншу тему або зменшіть кількість.',
  GENERATION_FAILED: 'Не вдалося згенерувати урок. Спробуйте ще раз.',
  CANNOT_PUBLISH: 'Порожню дошку не можна опублікувати — спершу щось намалюйте на ній.',
  LESSON_CONSTRUCTOR_DISABLED: 'Генерація уроків зараз недоступна.',
  EXPORT_DISABLED: 'Експорт PDF зараз недоступний.',
  FORBIDDEN: 'Немає доступу (потрібна роль тьютора).',
  NOT_FOUND: 'Не знайдено або не належить вам.',
  BAD_REQUEST: 'Бракує даних для команди.',
  INTENT_INVALID: 'Невідома команда.',
}

const auth = useAuthStore()
const router = useRouter()
const route = useRoute()
const currentBoardId = computed(() =>
  ['winterboard-solo', 'winterboard-prepare'].includes(route.name) ? route.params.id : null,
)
const enabled = computed(() => {
  if (import.meta.env.VITE_FEATURE_UIA !== 'true' || !auth.user) return false
  return ALLOWED_ROLES.includes(auth.user.role) || auth.user.is_staff === true
})

const open = ref(false)
const mode = ref('commands')
const query = ref('')
const selected = ref(0)
const loading = ref(false)
const error = ref('')
const notice = ref('')
const inputEl = ref(null)
const boards = ref([])
const lessons = ref([])

// dialog engine state
const dialog = ref({ cmd: null, queue: [], idx: 0, values: {} })
const dialogInput = ref('')
const dialogInputEl = ref(null)
const dialogSearchEl = ref(null)
const dialogOptions = ref([])
const dialogOptIdx = ref(0)
const dialogQuery = ref('')
const dialogOptLoading = ref(false)

const currentParam = computed(() => dialog.value.queue?.[dialog.value.idx] || null)
const dialogOptionsFiltered = computed(() => {
  const q = dialogQuery.value.trim().toLowerCase()
  return q ? dialogOptions.value.filter(o => o.label.toLowerCase().includes(q)) : dialogOptions.value
})

async function run(fn, onOk) {
  if (loading.value) return
  loading.value = true; error.value = ''; notice.value = ''
  try { const r = await fn(); if (onOk) onOk(r) }
  catch (e) {
    const d = e?.response?.data
    error.value = ERR_MSG[d?.error] || d?.detail || e?.message || 'Помилка'
  } finally { loading.value = false }
}

// ════════════ COMMAND DIALOG ENGINE ════════════
function invoke(cmd, ctx = {}) {
  if (cmd.run) { cmd.run(); return }
  const values = { ...(cmd.context ? cmd.context() : {}), ...ctx }
  const missing = (cmd.params || []).filter((p) => {
    const v = values[p.key]
    return v === undefined || v === null || v === ''
  })
  if (!missing.length) { execute(cmd, values); return }
  dialog.value = { cmd, queue: missing, idx: 0, values }
  mode.value = 'dialog'
  enterStep()
}
async function enterStep() {
  const p = currentParam.value
  error.value = ''
  if (p.type === 'select') {
    dialogQuery.value = ''; dialogOptIdx.value = 0; dialogOptions.value = []
    if (p.options) {
      dialogOptions.value = p.options
    } else if (p.optionsFrom) {
      dialogOptLoading.value = true
      try { dialogOptions.value = await p.optionsFrom() }
      catch { error.value = 'Не вдалося завантажити варіанти' }
      finally { dialogOptLoading.value = false }
    }
    if (p.default != null) {
      const i = dialogOptions.value.findIndex(o => o.value === p.default)
      if (i >= 0) dialogOptIdx.value = i
    }
    nextTick(() => dialogSearchEl.value?.focus())
  } else {
    dialogInput.value = p.default != null ? String(p.default) : ''
    nextTick(() => dialogInputEl.value?.focus())
  }
}
function advance(value) {
  dialog.value.values[currentParam.value.key] = value
  error.value = ''
  if (dialog.value.idx + 1 >= dialog.value.queue.length) {
    const { cmd, values } = dialog.value
    mode.value = 'commands'
    execute(cmd, values)
  } else {
    dialog.value.idx += 1
    enterStep()
  }
}
function submitStep() {
  const p = currentParam.value
  let raw = dialogInput.value
  if (raw === '' && p.default != null) raw = String(p.default)
  let val = raw
  if (p.type === 'number') {
    val = Number(raw)
    if (raw === '' || Number.isNaN(val)) { error.value = 'Потрібне число'; return }
  } else if (p.type === 'list') {
    val = String(raw).split(',').map(s => s.trim()).filter(Boolean)
    if (p.required && !val.length) { error.value = 'Вкажіть хоча б одне значення'; return }
  } else if (p.required && raw === '') {
    error.value = 'Обовʼязкове поле'; return
  }
  advance(val)
}
function pickOption(o) { advance(o.value) }
function pickHighlighted() { const o = dialogOptionsFiltered.value[dialogOptIdx.value]; if (o) advance(o.value) }
function moveOpt(d) { const n = dialogOptionsFiltered.value.length; if (n) dialogOptIdx.value = (dialogOptIdx.value + d + n) % n }
function execute(cmd, values) { run(() => cmd.act(values), cmd.after) }
function confirmDelete(spec, ctx, name) { if (window.confirm(`Видалити «${name || 'Без назви'}»?`)) invoke(spec, ctx) }

// каталог тем для select
async function fetchTopics() {
  const r = await sendIntent('QUERY', [{ type: 'Topics' }], 'command-palette')
  return r.result.topics || []
}

// IPC-5: продуктовий save/publish дренує ВСІ pending board-ops ПЕРЕД знімком стану
// (WBSoloRoom.openSaveLessonDialog → opsSync.flushAll). Без цього palette зберегла б
// застарілий стан дошки. Try/continue — дзеркало продукту (flush-fail не блокує).
async function flushBoardOps() {
  try {
    const { useOpsSyncStore } = await import('@/modules/winterboard/stores/opsSyncStore')
    await useOpsSyncStore().flushAll()
  } catch (e) {
    console.warn('[palette] flushAll before save/publish failed (continuing):', e)
  }
}

// ════════════ COMMAND SPECS ════════════
const cmdCreateBoard = {
  id: 'create-board', label: 'Створити дошку',
  params: [{ key: 'title', label: 'Назва дошки?', default: 'Нова дошка' }],
  act: (v) => sendIntent('CREATE', [{ type: 'Board', params: { title: v.title } }], 'command-palette'),
  // IPC-5: дзеркало «+ Нова дошка» → winterboard-prepare (не solo).
  after: (r) => { close(); router.push({ name: 'winterboard-prepare', params: { id: r.result.board_id } }) },
}
const cmdGenerateLesson = {
  id: 'generate-lesson', label: 'Згенерувати урок',
  params: [
    { key: 'topics', label: 'Тема уроку?', type: 'select', required: true, optionsFrom: fetchTopics },
    { key: 'task_count', label: 'Скільки задач? (1–30)', type: 'number', default: 4 },
    {
      key: 'theme', label: 'Оформлення уроку?', type: 'select', default: THEMES[0].value,
      options: THEMES.map(t => ({ value: t.value, label: `${t.label} — ${t.desc}` })),
    },
  ],
  // ⚠️ Мусимо слати ПРОДУКТОВІ дефолти конструктора, а не покладатись на дефолти
  // серіалайзера (вони інші!). Дзеркало LessonConstructorPage.vue:290-390:
  // include_solution_page=false — інакше бекенд-дефолт True генерує зайву сторінку
  // розбору на кожну задачу (→ подвоєння сторінок). include_theory_page=true, tutorial, balanced.
  act: (v) => sendIntent('CREATE', [{
    type: 'Lesson',
    params: {
      topics: Array.isArray(v.topics) ? v.topics : [v.topics],
      task_count: v.task_count,
      theme: v.theme,
      diff_profile: 'balanced',
      pacing_mode: 'tutorial',
      include_theory_page: true,
      include_solution_page: false,
    },
  }], 'command-palette'),
  after: (r) => { close(); router.push({ name: 'winterboard-prepare', params: { id: r.result.session_id } }) },
}
const cmdPublishCurrent = {
  id: 'publish-current', label: 'Опублікувати поточну дошку',
  context: () => ({ board_id: currentBoardId.value }),
  params: [{ key: 'title', label: 'Назва публічного уроку?' }],
  act: async (v) => {
    await flushBoardOps()
    return sendIntent('PUBLISH', [{ type: 'Lesson', params: { board_id: v.board_id, title: v.title } }], 'command-palette')
  },
  after: (r) => { notice.value = 'Опубліковано: ' + (r.result?.title || '') },
}
const cmdSaveDraft = {
  id: 'save-current-draft', label: 'Зберегти поточну дошку як урок (чернетку)',
  context: () => ({ board_id: currentBoardId.value }),
  params: [{ key: 'title', label: 'Назва уроку-чернетки?', required: true }],
  act: async (v) => {
    await flushBoardOps()
    return sendIntent('CREATE', [{ type: 'LessonDraft', params: { board_id: v.board_id, title: v.title } }], 'command-palette')
  },
  after: (r) => { notice.value = 'Збережено чернетку: ' + (r.result?.title || '') },
}
const cmdMyBoards = { id: 'my-boards', label: 'Мої дошки…', run: myBoards }
const cmdMyLessons = { id: 'my-lessons', label: 'Мої уроки…', run: myLessons }
const cmdOpenLast = { id: 'open-last-lesson', label: 'Відкрити останній урок', run: openLast }

const baseCommands = [cmdCreateBoard, cmdGenerateLesson, cmdMyBoards, cmdMyLessons, cmdOpenLast]
const commands = computed(() => {
  const list = [...baseCommands]
  if (currentBoardId.value) list.push(cmdPublishCurrent, cmdSaveDraft)
  return list
})
const filtered = computed(() => {
  const q = query.value.trim().toLowerCase()
  const list = q ? commands.value.filter(c => c.label.toLowerCase().includes(q)) : [...commands.value]
  // AI-Producer: будь-яку фразу можна віддати AI — останній пункт списку (і єдиний, якщо збігів нема)
  if (AI_ENABLED && query.value.trim().length >= 3) {
    const phrase = query.value.trim()
    list.push({ id: '__ai__', label: `∫ Спитати Інтегралика: «${phrase}»`, run: () => askAi(phrase) })
  }
  return list
})

// row-action specs
const actDuplicate = {
  act: (v) => sendIntent('DUPLICATE', [{ type: 'Board', params: { board_id: v.board_id } }], 'command-palette'),
  after: (r) => { close(); router.push({ name: 'winterboard-solo', params: { id: r.result.board_id } }) },
}
const actRename = {
  params: [{ key: 'name', label: 'Нова назва дошки?', required: true }],
  act: (v) => sendIntent('MODIFY', [{ type: 'Board', params: { board_id: v.board_id, name: v.name } }], 'command-palette'),
  after: () => { notice.value = 'Перейменовано'; fetchBoards(); notifyBoardsChanged() },
}
// IPC-5 (виправлено після польового прогону): справжній продуктовий експорт — це
// WBExportDialog, який ПЕРЕД BE-експортом робить capture-фазу інтерактивних віджетів
// (GraphMASH 3D, графіки, NMT-картки). Прямий інтент-виклик оминав capture → PDF з
// [nmt_task]-плейсхолдерами. Тому палітра/AI ЗАПУСКАЮТЬ продуктовий діалог:
// дошка відкрита → подія; інша/зі списку → навігація з ?export=1.
function openProductExport(boardId, format = 'pdf') {
  close()
  if (currentBoardId.value && String(currentBoardId.value) === String(boardId)) {
    window.dispatchEvent(new CustomEvent('m4sh:open-export-dialog', { detail: { format } }))
  } else {
    router.push({ name: 'winterboard-solo', params: { id: boardId }, query: { export: '1', format } })
  }
}
const actExport = {
  act: (v) => Promise.resolve(v.board_id),
  after: (boardId) => openProductExport(boardId, 'pdf'),
}
const actDeleteBoard = {
  act: (v) => sendIntent('DELETE', [{ type: 'Board', params: { board_id: v.board_id } }], 'command-palette'),
  after: () => { notice.value = 'Видалено'; fetchBoards(); notifyBoardsChanged() },
}
const actOpenLesson = {
  act: (v) => sendIntent('CREATE', [{ type: 'Session', params: { lesson_id: v.lesson_id } }], 'command-palette'),
  after: (r) => { close(); router.push({ name: 'winterboard-solo', params: { id: r.result.session_id } }) },
}
const actDeleteLesson = {
  act: (v) => sendIntent('DELETE', [{ type: 'Lesson', params: { lesson_id: v.lesson_id } }], 'command-palette'),
  after: () => { notice.value = 'Видалено'; fetchLessons() },
}

// Сторінка «Студія уроків» живе під палітрою зі своїм станом — після мутації дощок
// повідомляємо її (WBBoardList слухає), інакше список застаріває до ручного F5.
function notifyBoardsChanged() {
  window.dispatchEvent(new CustomEvent('m4sh:boards-changed'))
}

// ── lists ──
async function fetchBoards() {
  const r = await sendIntent('QUERY', [{ type: 'Boards' }], 'command-palette')
  boards.value = r.result.boards || []
}
async function myBoards() { await run(fetchBoards, () => { mode.value = 'boards' }) }
function openBoard(b) { close(); router.push({ name: 'winterboard-solo', params: { id: b.id } }) }

async function fetchLessons() {
  const r = await sendIntent('QUERY', [{ type: 'Lessons' }], 'command-palette')
  lessons.value = r.result.lessons || []
}
async function myLessons() { await run(fetchLessons, () => { mode.value = 'lessons' }) }
async function openLast() {
  await run(async () => {
    const list = await sendIntent('QUERY', [{ type: 'Lessons' }], 'command-palette')
    const last = (list.result.lessons || [])[0]
    if (!last) return { _empty: true }
    return await sendIntent('CREATE', [{ type: 'Session', params: { lesson_id: last.id } }], 'command-palette')
  }, (res) => {
    if (res._empty) { notice.value = 'Уроків ще немає'; return }
    close(); router.push({ name: 'winterboard-solo', params: { id: res.result.session_id } })
  })
}

// ════════════ AI-PRODUCER #1 (Phase 1b) ════════════
// parse ≠ execute: /intents/ai/parse лише ПРОПОНУЄ Intent; тут — Resolution Policy (§3.1):
//   low + 1 кандидат  → авто-виконання
//   medium            → confirm «Зроблю: …?»
//   high/destructive  → ЗАВЖДИ confirm (навіть після explicit-вибору кандидата)
//   2+ кандидатів     → вибір списком (explicit pick = підтвердження для low/medium)
//   none              → чесне пояснення
const AI_ENABLED = import.meta.env.VITE_FEATURE_UIA_AI === 'true'

// «Інтегралик» — маскот AI-помічника (перенесено з DATA/integral/assistant.js).
// Анімації (дихання/кліпання/«думає») — у scoped-стилях через :deep().
const MASCOT_SVG =
  '<svg viewBox="0 0 100 100" aria-hidden="true"><circle cx="50" cy="50" r="46" fill="#d6f1ed" stroke="#0d9488" stroke-width="3"></circle>'
  + '<g class="itg-body">'
  + '<path d="M60 22 C55 12, 42 14, 42 27 C42 42, 58 52, 58 70 C58 85, 45 92, 40 82" fill="none" stroke="#0f5f57" stroke-width="8" stroke-linecap="round" stroke-linejoin="round"></path>'
  + '<path d="M37 24 Q43 23 48 26" fill="none" stroke="#0f5f57" stroke-width="2" stroke-linecap="round"></path>'
  + '<path d="M51 29 Q56 28 61 31" fill="none" stroke="#0f5f57" stroke-width="2" stroke-linecap="round"></path>'
  + '<g class="itg-eye" style="transform-origin:43px 34px;"><circle cx="43" cy="34" r="7" fill="#fff" stroke="#0f5f57" stroke-width="2"></circle><circle cx="43" cy="34" r="3.5" fill="#0f5f57"></circle></g>'
  + '<g class="itg-eye itg-e2" style="transform-origin:55px 40px;"><circle cx="55" cy="40" r="7" fill="#fff" stroke="#0f5f57" stroke-width="2"></circle><circle cx="55" cy="40" r="3.5" fill="#0f5f57"></circle></g>'
  + '<path d="M46 49 Q50 53 54 48" fill="none" stroke="#0f5f57" stroke-width="2.5" stroke-linecap="round"></path>'
  + '</g></svg>'
const aiPhase = ref('loading')      // loading | confirm | clarify | none
const aiResp = ref({})
const aiPhrase = ref('')

async function askAi(phrase) {
  aiPhrase.value = phrase
  mode.value = 'ai'
  aiPhase.value = 'loading'
  aiResp.value = {}
  error.value = ''; notice.value = ''
  try {
    const r = await parseAi(phrase, currentBoardId.value)
    aiResp.value = r
    if (r.status === 'propose') {
      if (r.risk === 'low') executeAi(r)
      else aiPhase.value = 'confirm'
    } else if (r.status === 'clarify') {
      aiPhase.value = 'clarify'
    } else {
      aiPhase.value = 'none'
    }
  } catch (e) {
    const d = e?.response?.data
    aiResp.value = {
      explain: d?.error === 'AI_UNAVAILABLE'
        ? 'AI зараз недоступний — спробуйте пізніше.'
        : (ERR_MSG[d?.error] || d?.detail || 'Помилка AI'),
    }
    aiPhase.value = 'none'
  }
}

function confirmAi() { executeAi(aiResp.value) }

function pickAiCandidate(c) {
  const t = aiResp.value.pick_template
  const proposal = {
    capability: t.capability, risk: t.risk, verb: t.verb,
    objects: [{ type: t.type, params: { [t.param]: c.id } }],
    explain: `${aiResp.value.question} → «${c.label}»`,
  }
  aiResp.value = proposal
  if (t.risk === 'high') aiPhase.value = 'confirm'   // destructive — ще один явний confirm
  else executeAi(proposal)                            // explicit вибір = підтвердження
}

// Після успіху — ТА САМА поведінка, що в ручних команд палітри (per capability).
const AI_AFTER = {
  'workspace.create_board': (r) => { close(); router.push({ name: 'winterboard-prepare', params: { id: r.result.board_id } }) },
  'lesson.generate': (r) => { close(); router.push({ name: 'winterboard-prepare', params: { id: r.result.session_id } }) },
  'knowledge.open_lesson': (r) => { close(); router.push({ name: 'winterboard-solo', params: { id: r.result.session_id } }) },
  'knowledge.list_lessons': (r) => { lessons.value = r.result.lessons || []; mode.value = 'lessons' },
  'workspace.list_boards': (r) => { boards.value = r.result.boards || []; mode.value = 'boards' },
  'workspace.rename_board': () => { notice.value = 'Перейменовано'; mode.value = 'commands'; notifyBoardsChanged() },
  'workspace.delete_board': () => { notice.value = 'Видалено'; mode.value = 'commands'; notifyBoardsChanged() },
  'knowledge.save_draft': (r) => { notice.value = 'Збережено чернетку: ' + (r.result?.title || ''); mode.value = 'commands' },
}

function executeAi(p) {
  if (p.capability === 'workspace.export_board') {
    // launcher-патерн: продуктовий діалог експорту (capture-фаза всередині) з autostart
    // формату, який користувач назвав у фразі — без повторного вибору.
    openProductExport(p.objects[0].params.board_id, p.objects[0].params.format || 'pdf')
    return
  }
  run(async () => {
    // IPC-5: перед збереженням/публікацією стану дошки — дренувати pending ops (як продукт)
    if (p.capability === 'knowledge.save_draft' || p.capability === 'knowledge.publish_board') {
      await flushBoardOps()
    }
    return sendIntent(p.verb, p.objects, 'ai')
  }, (r) => {
    const after = AI_AFTER[p.capability]
    if (after) after(r)
    else { notice.value = 'Готово'; mode.value = 'commands' }
  })
}

// ── Інтегралик: перетягування (юзер сам обирає місце; позиція живе в localStorage) ──
// Pointer-події: працює мишею, ПЕРОМ планшета і пальцем. Клік vs drag розрізняємо
// порогом 5px; після перетягування click-подію гасимо, щоб палітра не відкривалась.
const FAB_POS_KEY = 'm4sh_integralyk_pos'
const FAB_SIZE = 46
const fabPos = ref(null)               // {x,y} | null → дефолтна позиція з CSS (top-right)
let fabDrag = null                     // {startX,startY,origX,origY,moved}
let fabDragJustMoved = false

const fabStyle = computed(() =>
  fabPos.value ? { left: fabPos.value.x + 'px', top: fabPos.value.y + 'px', right: 'auto' } : {},
)

function clampFab(x, y) {
  const maxX = window.innerWidth - FAB_SIZE - 4
  const maxY = window.innerHeight - FAB_SIZE - 4
  return { x: Math.min(Math.max(4, x), maxX), y: Math.min(Math.max(4, y), maxY) }
}

function fabPointerDown(e) {
  if (e.pointerType === 'mouse' && e.button !== 0) return
  const rect = e.currentTarget.getBoundingClientRect()
  fabDrag = { startX: e.clientX, startY: e.clientY, origX: rect.left, origY: rect.top, moved: false }
  try { e.currentTarget.setPointerCapture(e.pointerId) } catch { /* older browsers */ }
}
function fabPointerMove(e) {
  if (!fabDrag) return
  const dx = e.clientX - fabDrag.startX
  const dy = e.clientY - fabDrag.startY
  if (!fabDrag.moved && Math.hypot(dx, dy) < 5) return
  fabDrag.moved = true
  fabPos.value = clampFab(fabDrag.origX + dx, fabDrag.origY + dy)
}
function fabPointerUp() {
  if (!fabDrag) return
  fabDragJustMoved = fabDrag.moved
  if (fabDrag.moved && fabPos.value) {
    try { localStorage.setItem(FAB_POS_KEY, JSON.stringify(fabPos.value)) } catch { /* private mode */ }
  }
  fabDrag = null
}
function onFabClick() {
  if (fabDragJustMoved) { fabDragJustMoved = false; return }  // це був drag, не клік
  openPalette()
}
function restoreFabPos() {
  try {
    const saved = JSON.parse(localStorage.getItem(FAB_POS_KEY) || 'null')
    if (saved && Number.isFinite(saved.x) && Number.isFinite(saved.y)) {
      fabPos.value = clampFab(saved.x, saved.y)   // clamp — раптом екран став меншим
    }
  } catch { /* зіпсований запис — лишаємо дефолт */ }
}

// ── palette lifecycle ──
// Compat-шим для ГОЛОСОВОГО вводу (Voice In та ін. розширення): вони пишуть текст
// прямо в DOM-поле БЕЗ події `input`, тож v-model не оновлюється (поле заповнене,
// а query порожній → AI-пункт не з'являється). Поки палітра відкрита — синкаємо
// значення з DOM; при зміні скидаємо підсвітку на перший пункт.
let domSyncTimer = null
function syncQueryFromDom() {
  const dom = inputEl.value?.value
  if (typeof dom === 'string' && dom !== query.value) {
    query.value = dom
    selected.value = 0
  }
}

function openPalette() {
  open.value = true; mode.value = 'commands'; query.value = ''; selected.value = 0
  error.value = ''; notice.value = ''
  nextTick(() => inputEl.value?.focus())
  clearInterval(domSyncTimer)
  domSyncTimer = setInterval(syncQueryFromDom, 300)
}
function close() { open.value = false; loading.value = false; clearInterval(domSyncTimer) }
function toCommands() { mode.value = 'commands'; error.value = ''; nextTick(() => inputEl.value?.focus()) }
function move(d) { syncQueryFromDom(); const n = filtered.value.length; if (n) selected.value = (selected.value + d + n) % n }
function runSelected() {
  syncQueryFromDom()
  if (selected.value >= filtered.value.length) selected.value = 0
  const c = filtered.value[selected.value]
  if (c) invoke(c)
}

function onKeydown(e) {
  if (matchesShortcut(e)) {
    e.preventDefault(); open.value ? close() : openPalette()
  } else if (open.value && e.key === 'Escape') {
    mode.value !== 'commands' ? toCommands() : close()
  }
}

onMounted(() => {
  if (enabled.value) window.addEventListener('keydown', onKeydown)
  restoreFabPos()
})
onBeforeUnmount(() => { window.removeEventListener('keydown', onKeydown); clearInterval(domSyncTimer) })
</script>

<style scoped>
/* Плаваючий «Інтегралик»: напівпрозорий, під зоною дзвіночка; z нижче за оверлей (60). */
.cmdp-fab { position: fixed; top: 74px; right: 18px; z-index: 55;
  width: 46px; height: 46px; border: 0; border-radius: 50%; cursor: grab;
  background: transparent; padding: 0;
  touch-action: none; /* drag пером/пальцем, а не скрол сторінки */
  opacity: .6; transition: opacity .15s ease;
  filter: drop-shadow(0 3px 8px rgba(13, 148, 136, .35)); }
.cmdp-fab:hover { opacity: 1; }
.cmdp-fab:active { cursor: grabbing; }
.cmdp-fab :deep(svg) { width: 100%; height: 100%; display: block; overflow: visible; }

/* Маскот у шапці AI-режиму */
.cmdp-mascot { width: 28px; height: 28px; display: inline-block; flex: none; }
.cmdp-mascot :deep(svg) { width: 100%; height: 100%; display: block; overflow: visible; }

/* Анімації Інтегралика (перенесено з DATA/integral/assistant.css; :deep — svg іде через v-html) */
@keyframes itg-breath { 0%, 100% { transform: translateY(0) scale(1); } 50% { transform: translateY(-1.4px) scale(1.012); } }
:deep(.itg-body) { transform-origin: 50px 62px; animation: itg-breath 4.2s ease-in-out infinite; }
@keyframes itg-blink { 0%, 93%, 100% { transform: scaleY(1); } 96% { transform: scaleY(.12); } }
:deep(.itg-eye) { animation: itg-blink 4.6s linear infinite; }
:deep(.itg-e2) { animation-delay: .05s; }
@keyframes itg-think { 0%, 100% { transform: rotate(0deg) translateY(0); } 25% { transform: rotate(-7deg) translateY(-2px); } 75% { transform: rotate(7deg) translateY(-1px); } }
.cmdp-mascot.thinking :deep(.itg-body) { animation: itg-think .55s ease-in-out infinite; }

.cmdp-overlay { position: fixed; inset: 0; z-index: 60; background: rgba(0,0,0,.35);
  display: flex; align-items: flex-start; justify-content: center; padding-top: 12vh; }
.cmdp-panel { width: min(600px, 94vw); background: #fff; color: #111;
  border-radius: 12px; box-shadow: 0 12px 40px rgba(0,0,0,.25); overflow: hidden; }
.cmdp-input { width: 100%; box-sizing: border-box; padding: 14px 16px; border: 0;
  border-bottom: 1px solid #eee; font-size: 16px; outline: none; }
.cmdp-head { display: flex; align-items: center; gap: 12px; padding: 10px 14px; border-bottom: 1px solid #eee; }
.cmdp-back { border: 0; background: #f3f3f3; border-radius: 6px; padding: 4px 8px; cursor: pointer; }
.cmdp-title { font-weight: 600; flex: 1; }
.cmdp-dialog { padding: 14px 16px; }
.cmdp-dlabel { display: block; margin-bottom: 6px; font-size: 14px; color: #333; }
.cmdp-dialog .cmdp-input { border: 1px solid #ddd; border-radius: 8px; }
.cmdp-list { list-style: none; margin: 0; padding: 6px; max-height: 46vh; overflow: auto; }
.cmdp-item { padding: 10px 12px; border-radius: 8px; cursor: pointer; }
.cmdp-item.active { background: #eef2ff; }
.cmdp-board { display: flex; align-items: center; justify-content: space-between; padding: 8px 12px; border-radius: 8px; }
.cmdp-board:hover { background: #f7f7f8; }
.cmdp-bname { cursor: pointer; flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.cmdp-meta { color: #999; font-size: 12px; }
.cmdp-actions button { border: 0; background: transparent; cursor: pointer; font-size: 16px; padding: 2px 5px; }
.cmdp-actions button:hover { background: #e9e9ef; border-radius: 6px; }
.cmdp-actions button:disabled { opacity: .4; cursor: default; }
.cmdp-empty { padding: 12px; color: #888; }
.cmdp-ai-explain { font-size: 15px; color: #111; margin: 4px 0 10px; }
.cmdp-ai-danger { color: #b91c1c; font-size: 13px; margin-bottom: 10px; }
.cmdp-ai-tip { color: #6b7280; font-size: 13px; margin: 0 0 10px; }
.cmdp-ai-actions { display: flex; gap: 8px; align-items: center; }
.cmdp-btn { background: #16a34a; color: #fff; border: 0; border-radius: 8px; padding: 10px 16px; font-weight: 600; cursor: pointer; }
.cmdp-btn:disabled { opacity: .5; cursor: default; }
.cmdp-btn--danger { background: #dc2626; }
.cmdp-status { padding: 8px 16px; color: #555; }
.cmdp-error { padding: 8px 16px; color: #c00; }
.cmdp-hint { padding: 8px 16px; border-top: 1px solid #eee; color: #999; font-size: 12px; }
</style>
